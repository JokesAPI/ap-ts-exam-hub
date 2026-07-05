"""
generate_current_affairs_v2.py
────────────────────────────────────────────────────────────────────────────
PHASE 2 -- fixes the "stale/wrong dates" problem from Phase 1.

Phase 1 asked Groq to recall current affairs from its own memory -- which
has a training cutoff, so it confidently produced old/wrong-dated topics.

Phase 2 instead:
  1. Fetches REAL, LIVE headlines right now from a real news RSS feed
     (confirmed working -- Times of India top stories, verified by you
      directly on your machine, returning today's actual headlines).
  2. Sends those real headlines + real summaries to Groq, and INSTRUCTS
     Groq to only use facts present in that real text -- not to invent
     or recall anything from its own memory.
  3. Groq picks the ones actually relevant to exam prep (skips crime/
     gossip/entertainment), and produces: category, ~100-word summary,
     MCQ + answer + explanation, Telugu translation -- all grounded in
     the real fetched text.
  4. Inserts into your EXISTING current_affairs table -- same as Phase 1,
     no schema changes.

USAGE:
  Dry run (prints what would be inserted, does NOT touch the database):
    python generate_current_affairs_v2.py --dry-run

  Real run:
    python generate_current_affairs_v2.py

  Change how many items to select (default 5):
    python generate_current_affairs_v2.py --count 5

REQUIRED ENVIRONMENT VARIABLES (same as Phase 1):
  GROQ_API_KEY
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import json
import argparse
from datetime import date
from typing import Optional, List, Dict

import requests
import feedparser

# ── Confirmed working, live source (verified directly on 5 July 2026) ──────
RSS_FEED_URL = "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"

# ── Allowed categories -- MUST match exactly what your frontend filters on ──
ALLOWED_CATEGORIES = [
    'National', 'State AP', 'State TS', 'Economy',
    'Science & Tech', 'Sports', 'Awards', 'International',
]

GROQ_MODEL = 'llama-3.3-70b-versatile'

# How many raw headlines to fetch and offer to Groq to choose from.
# We fetch more than we need so Groq has real choice to skip crime/
# gossip/entertainment items and pick genuinely exam-relevant ones.
RAW_HEADLINES_TO_FETCH = 20


def fetch_real_headlines() -> List[Dict]:
    """Fetches real, live headlines from a confirmed-working RSS feed."""
    print(f'Fetching live headlines from: {RSS_FEED_URL}')
    feed = feedparser.parse(RSS_FEED_URL)

    if len(feed.entries) == 0:
        sys.exit(
            'ERROR: RSS feed returned zero entries. The feed may be down, '
            'blocked, or moved. Run test_rss_source.py again to confirm '
            'the feed is still reachable before re-running this script.'
        )

    headlines = []
    for entry in feed.entries[:RAW_HEADLINES_TO_FETCH]:
        headlines.append({
            'title': entry.get('title', ''),
            'summary': entry.get('summary', ''),
            'link': entry.get('link', ''),
            'published': entry.get('published', ''),
        })

    print(f'Fetched {len(headlines)} real headlines.\n')
    return headlines


def build_prompt(headlines: List[Dict], count: int) -> str:
    categories_list = ', '.join(ALLOWED_CATEGORIES)

    headlines_json = json.dumps(headlines, indent=2, ensure_ascii=False)

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


def call_groq(prompt: str) -> dict:
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        sys.exit('ERROR: GROQ_API_KEY environment variable is not set.')

    response = requests.post(
        'https://api.groq.com/openai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': GROQ_MODEL,
            'temperature': 0.3,  # lower temperature -- we want faithful
                                 # extraction from real text, not creativity
            'response_format': {'type': 'json_object'},
            'messages': [
                {
                    'role': 'system',
                    'content': (
                        'You are a precise JSON API. You only output valid JSON, '
                        'never markdown, never explanations. You strictly use only '
                        'facts given to you in the user message -- you never add '
                        'facts from your own memory or training data.'
                    ),
                },
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=90,
    )

    if not response.ok:
        sys.exit(f'ERROR: Groq API call failed ({response.status_code}): {response.text}')

    data = response.json()
    raw_text = data['choices'][0]['message']['content']

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as e:
        sys.exit(f'ERROR: Groq did not return valid JSON. Raw output:\n{raw_text}\n\nParse error: {e}')


def validate_and_normalize(item: dict) -> Optional[dict]:
    """Returns a cleaned item, or None if the item is missing required fields."""
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
    """
    Builds the single `content` string stored in the database.
    Includes the source link for credibility/verification -- students can
    click through to the real article.
    """
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


def insert_into_supabase(rows: List[dict]) -> None:
    supabase_url = os.environ.get('SUPABASE_URL')
    service_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url:
        sys.exit('ERROR: SUPABASE_URL environment variable is not set.')
    if not service_key:
        sys.exit('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is not set.')

    endpoint = f'{supabase_url.rstrip("/")}/rest/v1/current_affairs'

    response = requests.post(
        endpoint,
        headers={
            'apikey': service_key,
            'Authorization': f'Bearer {service_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        },
        json=rows,
        timeout=30,
    )

    if not response.ok:
        sys.exit(f'ERROR: Supabase insert failed ({response.status_code}): {response.text}')

    inserted = response.json()
    print(f'\n✅ Successfully inserted {len(inserted)} item(s) into current_affairs.')


def main():
    parser = argparse.ArgumentParser(description='Fetch real news, generate exam-focused current affairs via Groq, insert into Supabase.')
    parser.add_argument('--count', type=int, default=5, help='Number of items to select and generate (default: 5)')
    parser.add_argument('--dry-run', action='store_true', help='Print results without inserting into the database')
    args = parser.parse_args()

    headlines = fetch_real_headlines()

    print(f'Asking Groq to select and process {args.count} exam-relevant item(s)...')
    prompt = build_prompt(headlines, args.count)
    result = call_groq(prompt)

    raw_items = result.get('items', [])
    if not raw_items:
        sys.exit('ERROR: Groq response contained no "items" array.')

    today = date.today().isoformat()
    rows = []

    print(f'\nValidating {len(raw_items)} item(s)...')
    for item in raw_items:
        cleaned = validate_and_normalize(item)
        if cleaned is None:
            continue
        rows.append({
            'title': cleaned['title'],
            'content': format_content(cleaned),
            'category': cleaned['category'],
            'published_date': today,
        })

    if not rows:
        sys.exit('ERROR: No valid items survived validation. Nothing to insert.')

    print(f'\n{len(rows)} valid item(s) ready:\n')
    for i, row in enumerate(rows, 1):
        print(f'--- Item {i} ---')
        print(f'Title: {row["title"]}')
        print(f'Category: {row["category"]}')
        print(f'Published Date: {row["published_date"]}')
        print(f'Content:\n{row["content"]}\n')

    if args.dry_run:
        print('🔍 DRY RUN -- nothing was inserted into Supabase. Remove --dry-run to actually insert.')
        return

    insert_into_supabase(rows)


if __name__ == '__main__':
    main()