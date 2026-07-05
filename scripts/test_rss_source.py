"""
test_rss_source.py -- run this FIRST, before anything else.

This only checks ONE thing: can we actually read real news headlines from
a real RSS feed? If this works, we know Phase 2 can be built on a real,
live source instead of Groq's memory (which is what caused the stale/wrong
dates you saw earlier).

Run:
    pip install feedparser
    python test_rss_source.py
"""

import feedparser

FEED_URL = "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"

print(f"Trying to fetch: {FEED_URL}\n")
feed = feedparser.parse(FEED_URL)

print(f"Feed title: {feed.feed.get('title', 'UNKNOWN')}")
print(f"Number of entries found: {len(feed.entries)}\n")

if len(feed.entries) == 0:
    print("❌ NO ENTRIES FOUND -- this source did not return usable news items.")
    print("This could mean the feed is blocked, moved, or empty right now.")
else:
    print("✅ SUCCESS -- here are the first 3 real headlines:\n")
    for i, entry in enumerate(feed.entries[:3], 1):
        print(f"--- Headline {i} ---")
        print(f"Title: {entry.get('title', 'N/A')}")
        print(f"Published: {entry.get('published', 'N/A')}")
        print(f"Summary: {entry.get('summary', 'N/A')[:150]}...")
        print(f"Link: {entry.get('link', 'N/A')}\n")