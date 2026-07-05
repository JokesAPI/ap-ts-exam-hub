"""
inspect_rss_fields.py -- diagnostic only, run once.

Before we build full webpage scraping (fragile, breaks when sites redesign),
let's check if the RSS feed already gives us a fuller article body in a
field we haven't looked at yet. This costs nothing to check and could save
a lot of unnecessary work.
"""

import feedparser

FEED_URL = "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"

feed = feedparser.parse(FEED_URL)

if len(feed.entries) == 0:
    print("No entries found -- feed may be temporarily unavailable.")
else:
    entry = feed.entries[0]
    print("=== ALL AVAILABLE FIELDS ON FIRST ENTRY ===\n")
    print(f"Available keys: {list(entry.keys())}\n")

    print(f"--- .title ---\n{entry.get('title', 'N/A')}\n")
    print(f"--- .summary (length: {len(entry.get('summary', ''))}) ---\n{entry.get('summary', 'N/A')}\n")

    if 'content' in entry:
        for i, c in enumerate(entry.content):
            print(f"--- .content[{i}] (length: {len(c.value)}) ---\n{c.value}\n")
    else:
        print("--- .content field: NOT PRESENT on this feed ---\n")

    if 'summary_detail' in entry:
        print(f"--- .summary_detail.value (length: {len(entry.summary_detail.value)}) ---\n{entry.summary_detail.value}\n")