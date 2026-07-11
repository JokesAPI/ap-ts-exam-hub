"""
generate_current_affairs_v2.py — Current Affairs Collector (pipeline-integrated)
────────────────────────────────────────────────────────────────────────────
This collector does NOT write to current_affairs directly.

Flow:  RSS collect → normalize (+source_hash) → duplicate detection
       (check_duplicate_draft, pg_trgm) -> grounded OpenAI generation ->
       ai_drafts (status='draft') → validate_draft() quality gate →
       existing admin review workflow → publish_draft() → current_affairs.

Every run is logged to automation_runs (start/finish, success, error,
retries, collected/drafted/duplicate/rejected counts, AI latency).
Per-item failures go to automation_dead_letter. Source stats accumulate
in automation_sources.

USAGE:
  python generate_current_affairs_v2.py --dry-run    # no DB writes at all
  python generate_current_affairs_v2.py --count 5

REQUIRED ENVIRONMENT VARIABLES:
  OPENAI_API_KEY
  SUPABASE_URL                e.g. https://ijqdjlkzcygfjkmciqyy.supabase.co
  SUPABASE_SERVICE_ROLE_KEY   server-side only; RLS on pipeline tables is
                              admin-or-nothing, so the collector must run
                              with the service role. NEVER commit this key.
────────────────────────────────────────────────────────────────────────────
"""

import os
import re
import sys
import json
import time
import hashlib
import argparse
from datetime import date, datetime, timezone
from typing import Optional, List, Dict

import requests
import feedparser

# ── Source configuration ────────────────────────────────────────────────────
RSS_FEED_URL = "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"
SOURCE_NAME = "Times of India - Top Stories"
CONNECTOR_TYPE = "rss"
RAW_HEADLINES_TO_FETCH = 20

# ── Categories — MUST match frontend filters and validate_draft ─────────────
ALLOWED_CATEGORIES = [
    'National', 'State AP', 'State TS', 'Economy',
    'Science & Tech', 'Sports', 'Awards', 'International',
]

OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
AI_MAX_RETRIES = 2            # total attempts = 1 + AI_MAX_RETRIES

# Fuzzy-title duplicate policy:
#   similarity >= HARD threshold  -> skip item entirely
#   SOFT <= similarity < HARD     -> create draft, but flag for the reviewer
DUP_TITLE_HARD = 0.85
DUP_TITLE_SOFT = 0.60

BASE_CONFIDENCE = 0.75        # RSS-grounded generation
FLAGGED_CONFIDENCE = 0.60     # possible-duplicate drafts


# ═════════════════════════════ Supabase REST helpers ════════════════════════

class Supa:
    """Thin REST client for PostgREST + RPC. No third-party SDK dependency."""

    def __init__(self):
        url = os.environ.get('SUPABASE_URL')
        key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
        if not url:
            sys.exit('ERROR: SUPABASE_URL environment variable is not set.')
        if not key:
            sys.exit('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is not set.')
        self.base = url.rstrip('/') + '/rest/v1'
        self.headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
        }

    def insert(self, table: str, row: dict, returning: bool = False):
        h = dict(self.headers)
        if returning:
            h['Prefer'] = 'return=representation'
        r = requests.post(f'{self.base}/{table}', headers=h, json=row, timeout=30)
        if not r.ok:
            raise RuntimeError(f'insert into {table} failed ({r.status_code}): {r.text}')
        return r.json()[0] if returning else None

    def update(self, table: str, filters: str, patch: dict):
        r = requests.patch(f'{self.base}/{table}?{filters}',
                           headers=self.headers, json=patch, timeout=30)
        if not r.ok:
            raise RuntimeError(f'update {table} failed ({r.status_code}): {r.text}')

    def select_one(self, table: str, filters: str, columns: str = '*') -> Optional[dict]:
        r = requests.get(f'{self.base}/{table}?{filters}&select={columns}&limit=1',
                         headers=self.headers, timeout=30)
        if not r.ok:
            raise RuntimeError(f'select {table} failed ({r.status_code}): {r.text}')
        rows = r.json()
        return rows[0] if rows else None

    def rpc(self, fn: str, args: dict):
        r = requests.post(f'{self.base}/rpc/{fn}', headers=self.headers,
                          json=args, timeout=30)
        if not r.ok:
            raise RuntimeError(f'rpc {fn} failed ({r.status_code}): {r.text}')
        return r.json() if r.text else None


# ═════════════════════════════ Stage 1: Collect ═════════════════════════════

def fetch_real_headlines() -> List[Dict]:
    """Fetches real, live headlines from the confirmed-working RSS feed."""
    print(f'Fetching live headlines from: {RSS_FEED_URL}')
    feed = feedparser.parse(RSS_FEED_URL)
    if len(feed.entries) == 0:
        raise RuntimeError(
            'RSS feed returned zero entries. Feed may be down, blocked, or '
            'moved. Run test_rss_source.py to confirm reachability.'
        )
    headlines = []
    for entry in feed.entries[:RAW_HEADLINES_TO_FETCH]:
        headlines.append({
            'title': entry.get('title', ''),
            'summary': entry.get('summary', ''),
            'link': entry.get('link', ''),
            'guid': entry.get('id', '') or entry.get('link', ''),
            'published': entry.get('published', ''),
        })
    print(f'Fetched {len(headlines)} real headlines.\n')
    return headlines


# ═════════════════════════════ Stage 2: Normalize ═══════════════════════════

_TAG_RE = re.compile(r'<[^>]+>')
_WS_RE = re.compile(r'\s+')


def normalize_headline(h: Dict) -> Dict:
    """Cleans text and computes a stable source_hash for exact-dup detection."""
    title = _WS_RE.sub(' ', _TAG_RE.sub('', h['title'])).strip()
    summary = _WS_RE.sub(' ', _TAG_RE.sub('', h['summary'])).strip()
    hash_basis = (h['guid'] or h['link'] or title).strip()
    return {
        'title': title,
        'summary': summary,
        'link': h['link'].strip(),
        'published': h['published'],
        'source_hash': hashlib.sha256(hash_basis.encode('utf-8')).hexdigest(),
    }


# ═════════════════════════ Stage 3: Duplicate detection ═════════════════════

def check_duplicate(supa: Supa, title: str, link: str, source_hash: str) -> Dict:
    """
    Uses the EXISTING check_duplicate_draft() database function (pg_trgm).
    Returns {'action': 'skip'|'flag'|'ok', 'reason': str}
    """
    matches = supa.rpc('check_duplicate_draft', {
        'p_content_type': 'current_affairs',
        'p_title': title,
        'p_source_url': link or None,
        'p_source_hash': source_hash,
    }) or []

    best_fuzzy = 0.0
    for m in matches:
        if m['match_reason'] in ('exact_source_hash', 'exact_source_url'):
            return {'action': 'skip', 'reason': f"{m['match_reason']}: {m['match_title']}"}
        best_fuzzy = max(best_fuzzy, float(m.get('similarity_score') or 0))

    if best_fuzzy >= DUP_TITLE_HARD:
        return {'action': 'skip', 'reason': f'similar_title {best_fuzzy:.2f}'}
    if best_fuzzy >= DUP_TITLE_SOFT:
        return {'action': 'flag', 'reason': f'possible duplicate, similarity {best_fuzzy:.2f}'}
    return {'action': 'ok', 'reason': ''}


# ═════════════════════ Stage 4: AI generation (unchanged) ═══════════════════

def build_prompt(headlines: List[Dict], count: int) -> str:
    categories_list = ', '.join(ALLOWED_CATEGORIES)
    headlines_json = json.dumps(
        [{'title': h['title'], 'summary': h['summary'], 'link': h['link']}
         for h in headlines],
        indent=2, ensure_ascii=False)

    return f"""Below is a JSON list of REAL, LIVE news headlines fetched just now
from a live news feed. Each has a title, a short summary snippet, and a link.

REAL HEADLINES:
{headlines_json}

YOUR TASK:
From this list, select the {count} headlines that are MOST relevant for
Indian government competitive exam preparation (APPSC, TSPSC, SSC, Police,
DSC, TET) -- meaning topics like government policy, economy, science &
technology, international relations, sports achievements, awards, and
national development. SKIP headlines about crime, personal/human-interest
stories, celebrity gossip, entertainment, or anything not useful for exam
General Knowledge.

CRITICAL RULE: Only use facts that are actually present in the title/summary
text given above for each headline you select. Do NOT add any fact, name,
date, or detail that is not present in the given text. Do NOT use your own
background knowledge to fill in gaps.

IMPORTANT -- do not over-compress: the summary text given to you for each
headline is usually 2-4 full sentences long. Use MOST of that real detail
in your summary_en -- include the specific names, numbers, places, and
context already present in the given text. Do NOT reduce it down to a
single short sentence. Aim for close to 100 words BY INCLUDING more of the
real details already given to you, not by padding with filler words.

PRECISION RULE: If the given text has a breakdown of numbers (for example
"17 from Pakistan and 6 Indians"), preserve that exact breakdown -- do not
merge separate counts into a single total unless the given text itself
already states that total explicitly.

For each of the {count} selected headlines, produce:

Respond ONLY with valid JSON in this exact structure, nothing else:

{{
  "items": [
    {{
      "title": "Short headline, under 15 words, based on the real headline",
      "summary_en": "Summary using ONLY facts from the given text, plain English, no markdown",
      "category": "One of: {categories_list}",
      "mcq_question": "One multiple choice question testing this specific news item",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "correct_answer": "A, B, C, or D",
      "explanation": "One sentence explaining the correct answer, using only given facts",
      "summary_te": "The same summary_en content translated naturally into Telugu",
      "source_link": "the exact link value from the headline you selected"
    }}
  ]
}}

Return exactly {count} items in the "items" array. No text before or after the JSON."""


def call_ai(prompt: str, retry_counter: List[int]) -> dict:
    """Same call as before, now with bounded retries. retry_counter[0] is
    incremented per retry so the run log records the true retry count."""
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        sys.exit('ERROR: OPENAI_API_KEY environment variable is not set.')

    last_err = None
    for attempt in range(1 + AI_MAX_RETRIES):
        if attempt > 0:
            retry_counter[0] += 1
            wait = 5 * attempt
            print(f'  AI retry {attempt}/{AI_MAX_RETRIES} in {wait}s...')
            time.sleep(wait)
        try:
            response = requests.post(
                'https://api.openai.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {api_key}',
                         'Content-Type': 'application/json'},
                json={
                    'model': OPENAI_MODEL,
                    'temperature': 0.3,
                    'response_format': {'type': 'json_object'},
                    'messages': [
                        {'role': 'system', 'content': (
                            'You are a precise JSON API. You only output valid JSON, '
                            'never markdown, never explanations. You strictly use only '
                            'facts given to you in the user message -- you never add '
                            'facts from your own memory or training data.')},
                        {'role': 'user', 'content': prompt},
                    ],
                },
                timeout=90,
            )
            if not response.ok:
                raise RuntimeError(f'OpenAI HTTP {response.status_code}: {response.text[:300]}')
            raw_text = response.json()['choices'][0]['message']['content']
            return json.loads(raw_text)
        except (RuntimeError, requests.RequestException, json.JSONDecodeError,
                KeyError) as e:
            last_err = e
    raise RuntimeError(f'OpenAI failed after {AI_MAX_RETRIES} retries: {last_err}')


def validate_and_normalize(item: dict) -> Optional[dict]:
    """Returns a cleaned item, or None if the item is missing required fields.
    (Unchanged from previous version.)"""
    required = ['title', 'summary_en', 'category', 'mcq_question',
                'option_a', 'option_b', 'option_c', 'option_d',
                'correct_answer', 'explanation', 'summary_te']
    for field in required:
        if not item.get(field):
            print(f'  SKIPPING item -- missing field "{field}": {item.get("title", "untitled")}')
            return None
    if item['category'] not in ALLOWED_CATEGORIES:
        print(f'  NOTE: category "{item["category"]}" not in allowed list, defaulting to "National"')
        item['category'] = 'National'
    ans = item['correct_answer'].strip().upper()[:1]
    if ans not in ('A', 'B', 'C', 'D'):
        print(f'  SKIPPING item -- invalid correct_answer "{item["correct_answer"]}": {item["title"]}')
        return None
    item['correct_answer'] = ans
    return item


def format_content(item: dict) -> str:
    """Builds the packed `content` string. Format unchanged, so publish_draft
    produces rows identical in shape to what the frontend already renders."""
    source_line = ''
    if item.get('source_link'):
        source_line = f"\n\nSource: {item['source_link']}"
    return (
        f"{item['summary_en']}\n\n"
        f"📝 MCQ Practice:\n"
        f"{item['mcq_question']}\n"
        f"A) {item['option_a']}\n"
        f"B) {item['option_b']}\n"
        f"C) {item['option_c']}\n"
        f"D) {item['option_d']}\n"
        f"Answer: {item['correct_answer']}\n"
        f"Explanation: {item['explanation']}\n\n"
        f"తెలుగు సారాంశం:\n"
        f"{item['summary_te']}"
        f"{source_line}"
    )


# ═══════════════════ Stage 5: Draft creation + validation ═══════════════════

def create_draft(supa: Supa, item: dict, meta: dict) -> tuple:
    """Inserts into ai_drafts (status='draft'), logs 'ai_generated',
    then runs the EXISTING validate_draft() quality gate. Returns draft id."""
    json_data = {
        'category': item['category'],
        'published_date': date.today().isoformat(),
        'mcq': {
            'question': item['mcq_question'],
            'options': {'A': item['option_a'], 'B': item['option_b'],
                        'C': item['option_c'], 'D': item['option_d']},
            'answer': item['correct_answer'],
            'explanation': item['explanation'],
        },
        'summary_te': item['summary_te'],
    }
    if meta.get('duplicate_warning'):
        json_data['duplicate_warning'] = meta['duplicate_warning']

    draft = supa.insert('ai_drafts', {
        'content_type': 'current_affairs',
        'title': item['title'],
        'content': format_content(item),
        'json_data': json_data,
        'language': 'en',
        'source_url': item.get('source_link') or meta.get('link'),
        'source_name': SOURCE_NAME,
        'source_hash': meta['source_hash'],
        'source_type': CONNECTOR_TYPE,
        'collected_at': datetime.now(timezone.utc).isoformat(),
        'ai_model': f'openai/{OPENAI_MODEL}',
        'confidence_score': (FLAGGED_CONFIDENCE if meta.get('duplicate_warning')
                             else BASE_CONFIDENCE),
        'status': 'draft',
    }, returning=True)

    supa.insert('ai_draft_logs', {
        'draft_id': draft['id'],
        'event': 'ai_generated',
        'actor': 'collector:generate_current_affairs_v2',
        'details': {'model': OPENAI_MODEL, 'source': SOURCE_NAME},
    })

    failures = supa.rpc('validate_draft', {'p_draft_id': draft['id']}) or []
    return draft['id'], failures


# ═════════════════════════ Run logging (Task 3) ═════════════════════════════

def start_run(supa: Supa) -> Optional[str]:
    """Atomically acquires the run via begin_automation_run() (migration
    20260707161420): a DB-side advisory lock serializes concurrent callers,
    stale unfinished runs past the timeout are closed as failed, the run row
    is inserted, and the source is registered in automation_sources — all in
    one transaction. Returns the run id, or None if another live run for
    this source is already in flight (caller must exit without working).
    This guard lives in the database so EVERY execution path is protected:
    the GitHub Actions scheduler, workflow_dispatch manual runs, and local
    manual runs alike."""
    return supa.rpc('begin_automation_run', {
        'p_source_name': SOURCE_NAME,
        'p_connector_type': CONNECTOR_TYPE,
        'p_source_url': RSS_FEED_URL,
        'p_stale_after_minutes': 30,
    })


def finish_run(supa: Supa, run_id: str, stats: dict):
    patch = {
        'finished_at': datetime.now(timezone.utc).isoformat(),
        'success': stats['success'],
        'error_message': stats.get('error'),
        'retry_count': stats['retries'],
        'records_collected': stats['collected'],
        'records_drafted': stats['drafted'],
        'duplicate_count': stats['duplicates'],
        'ai_processing_time_ms': stats['ai_ms'],
        'records_rejected': stats.get('rejected', 0),
    }
    try:
        supa.update('automation_runs', f'id=eq.{run_id}', patch)
    except Exception:
        # records_rejected column not migrated yet — log without it
        patch.pop('records_rejected', None)
        supa.update('automation_runs', f'id=eq.{run_id}', patch)
    # Source stats. Read-then-write increment: safe because
    # begin_automation_run() guarantees at most one live run per source.
    src = supa.select_one('automation_sources', f'name=eq.{SOURCE_NAME}',
                          'total_drafted')
    supa.update('automation_sources', f'name=eq.{SOURCE_NAME}', {
        'last_run_at': datetime.now(timezone.utc).isoformat(),
        'total_drafted': (src['total_drafted'] if src else 0) + stats['drafted'],
    })


def dead_letter(supa: Supa, raw_item: dict, error: str, retries: int):
    try:
        supa.insert('automation_dead_letter', {
            'source_name': SOURCE_NAME,
            'connector_type': CONNECTOR_TYPE,
            'raw_item_data': raw_item,
            'error_message': error[:2000],
            'retry_count': retries,
        })
    except Exception as e:  # dead-letter must never crash the run
        print(f'  WARNING: dead-letter insert failed: {e}')


# ═══════════════════════════════ Main ═══════════════════════════════════════

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true',
                        help='No database writes of any kind.')
    parser.add_argument('--count', type=int, default=5)
    args = parser.parse_args()

    supa = Supa()
    retry_counter = [0]
    stats = {'success': False, 'collected': 0, 'drafted': 0, 'duplicates': 0,
             'rejected': 0, 'retries': 0, 'ai_ms': None, 'error': None}

    run_id = None
    if not args.dry_run:
        run_id = start_run(supa)
        if run_id is None:
            # Concurrency guard: another live run owns this source right now.
            # Exit 0 — this is expected coordination, not a failure, and the
            # in-flight run already carries the automation_runs log entry.
            print('Another run for this source is already in progress — '
                  'exiting cleanly (concurrency guard, begin_automation_run).')
            return
        print(f'automation_runs id: {run_id}\n')

    try:
        # 1. Collect
        raw = fetch_real_headlines()
        stats['collected'] = len(raw)

        # 2. Normalize
        items = [normalize_headline(h) for h in raw]

        # 3. Deduplicate BEFORE spending AI tokens
        survivors, flags = [], {}
        for it in items:
            verdict = check_duplicate(supa, it['title'], it['link'], it['source_hash'])
            if verdict['action'] == 'skip':
                stats['duplicates'] += 1
                print(f"  DUPLICATE ({verdict['reason']}): {it['title'][:70]}")
            else:
                if verdict['action'] == 'flag':
                    flags[it['source_hash']] = verdict['reason']
                survivors.append(it)
        print(f'\n{len(survivors)} new items after dedup '
              f'({stats["duplicates"]} duplicates skipped).\n')

        if not survivors:
            stats['success'] = True
            print('Nothing new to draft. Exiting cleanly.')
            return

        # 4. AI generation (grounded)
        want = min(args.count, len(survivors))
        t0 = time.monotonic()
        result = call_ai(build_prompt(survivors, want), retry_counter)
        stats['ai_ms'] = int((time.monotonic() - t0) * 1000)
        stats['retries'] = retry_counter[0]

        by_link = {s['link']: s for s in survivors}
        generated = [validate_and_normalize(i) for i in result.get('items', [])]
        generated = [g for g in generated if g]

        if args.dry_run:
            print(f'\n--dry-run: would create {len(generated)} drafts:')
            for g in generated:
                print(f"  [{g['category']}] {g['title']}")
            stats['success'] = True
            return

        # 5. Draft creation + existing quality validation
        for g in generated:
            src = by_link.get(g.get('source_link'))
            meta = {
                'source_hash': (src or {}).get('source_hash')
                               or hashlib.sha256(g['title'].encode()).hexdigest(),
                'link': (src or {}).get('link'),
                'duplicate_warning': flags.get((src or {}).get('source_hash')),
            }
            try:
                draft_id, failures = create_draft(supa, g, meta)
                stats['drafted'] += 1
                if failures:
                    stats['rejected'] += 1
                status = 'validated' if not failures else f'failed validation: {failures}'
                print(f"  DRAFT {draft_id[:8]} [{g['category']}] {g['title'][:60]} -> {status}")
            except Exception as e:
                print(f'  ERROR drafting "{g["title"][:60]}": {e}')
                dead_letter(supa, g, str(e), retries=0)

        stats['success'] = True
        print(f"\nDone. {stats['drafted']} drafts created and queued for admin "
              f"review at /admin (existing review workflow). Nothing was "
              f"published directly.")

    except Exception as e:
        stats['error'] = str(e)[:2000]
        print(f'\nRUN FAILED: {e}', file=sys.stderr)
        raise
    finally:
        if run_id is not None:
            try:
                finish_run(supa, run_id, stats)
            except Exception as e:
                print(f'WARNING: failed to finalize automation_runs row: {e}',
                      file=sys.stderr)


if __name__ == '__main__':
    main()
