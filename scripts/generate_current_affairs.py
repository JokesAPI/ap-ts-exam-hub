"""
generate_current_affairs.py
────────────────────────────────────────────────────────────────────────────
Generates daily current-affairs entries using Groq, formats them to match
your EXISTING current_affairs table exactly (title, content, category,
published_date -- no schema changes needed), and inserts them into Supabase.

The English summary, MCQ, and Telugu translation are all packed into the
single `content` field as clearly separated sections, since that's the only
text field your current site displays.

USAGE:
  Dry run (prints what would be inserted, does NOT touch the database):
    python generate_current_affairs.py --dry-run

  Real run (actually inserts into Supabase):
    python generate_current_affairs.py

  Change how many items to generate (default 5):
    python generate_current_affairs.py --count 8

REQUIRED ENVIRONMENT VARIABLES (set these before running):
  GROQ_API_KEY               -- same key used in your website
  SUPABASE_URL                -- e.g. https://ijqdjlkzcygfjkmciqyy.supabase.co
  SUPABASE_SERVICE_ROLE_KEY   -- the "secret"/"service_role" key, NOT anon key
                                  (required because RLS blocks public writes
                                   to this table -- only service_role bypasses it)
────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import json
import argparse
from datetime import date
from typing import Optional, List, Dict

import requests

# ── Allowed categories -- MUST match exactly what your frontend filters on ──
ALLOWED_CATEGORIES = [
    'National', 'State AP', 'State TS', 'Economy',
    'Science & Tech', 'Sports', 'Awards', 'International',
]

GROQ_MODEL = 'llama-3.3-70b-versatile'  # larger model: this runs offline once
                                         # a day, so quality matters more than
                                         # speed -- unlike the live chat feature


def build_prompt(count: int) -> str:
    categories_list = ', '.join(ALLOWED_CATEGORIES)
    today_str = date.today().strftime('%B %Y')
    return f"""Generate exactly {count} current affairs items relevant to Indian
government exam preparation (APPSC, TSPSC, SSC, Police, DSC, TET).

IMPORTANT -- freshness requirement: Today's context is {today_str}. Prioritize
genuinely recent developments (roughly the last 2-3 months of real events you
are aware of) over older, well-established topics. This is a "general
knowledge refresher" for exam prep, not necessarily literally today's news --
but AVOID defaulting to old, frequently-repeated, already-well-known topics.

DO NOT use these overused/stale topics -- they have already been covered
extensively and should be skipped entirely:
- Navaratnalu scheme (Andhra Pradesh, from 2019)
- Kaleshwaram Lift Irrigation Project (Telangana, already completed)
- New Education Policy 2020
- Any scheme, policy, or project older than 12 months from {today_str}

Prefer categories like Science & Tech, Sports, Awards, and International,
which naturally have more recent real instances (new launches, tournaments,
award ceremonies, appointments) compared to State schemes which tend to be
older and already well-known.

Do not invent fake events. If unsure whether something is recent, prefer a
well-known scientific, sports, or international development over a repeated
old state government scheme.

Respond ONLY with valid JSON in this exact structure, nothing else:

{{
  "items": [
    {{
      "title": "Short headline, under 15 words",
      "summary_en": "Exactly around 100 words, plain English, no markdown",
      "category": "One of: {categories_list}",
      "mcq_question": "One multiple choice question testing this news item",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "correct_answer": "A, B, C, or D",
      "explanation": "One sentence explaining the correct answer",
      "summary_te": "The same summary_en content translated naturally into Telugu"
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
            'temperature': 0.7,
            'response_format': {'type': 'json_object'},
            'messages': [
                {
                    'role': 'system',
                    'content': 'You are a precise JSON API. You only output valid JSON, never markdown, never explanations.',
                },
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=60,
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

    # Fix category if the model returned something not in our allowed list
    if item['category'] not in ALLOWED_CATEGORIES:
        print(f'  NOTE: category "{item["category"]}" not in allowed list, defaulting to "National"')
        item['category'] = 'National'

    # Normalize correct_answer to a single uppercase letter
    ans = item['correct_answer'].strip().upper()[:1]
    if ans not in ('A', 'B', 'C', 'D'):
        print(f'  SKIPPING item -- invalid correct_answer "{item["correct_answer"]}": {item["title"]}')
        return None
    item['correct_answer'] = ans

    return item


def format_content(item: dict) -> str:
    """
    Builds the single `content` string stored in the database.
    Sections are separated by blank lines -- displays correctly now that
    CurrentAffairs.jsx has whitespace-pre-line applied.
    """
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
    parser = argparse.ArgumentParser(description='Generate daily current affairs via Groq and insert into Supabase.')
    parser.add_argument('--count', type=int, default=5, help='Number of items to generate (default: 5)')
    parser.add_argument('--dry-run', action='store_true', help='Print results without inserting into the database')
    args = parser.parse_args()

    print(f'Generating {args.count} current affairs item(s) via Groq ({GROQ_MODEL})...')
    prompt = build_prompt(args.count)
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
