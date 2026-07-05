"""
test_supabase_key.py -- isolated, READ-ONLY test.

This does ONE thing: tries to read (not write) from your current_affairs
table using whatever SUPABASE_SERVICE_ROLE_KEY is currently set. This
completely isolates "is this key valid at all?" from every other part
of the bigger script.
"""

import os
import sys
import requests

supabase_url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not supabase_url:
    sys.exit("❌ SUPABASE_URL is not set.")
if not key:
    sys.exit("❌ SUPABASE_SERVICE_ROLE_KEY is not set.")

endpoint = f"{supabase_url.rstrip('/')}/rest/v1/current_affairs?select=id&limit=1"

print(f"Testing GET request to: {endpoint}\n")

response = requests.get(
    endpoint,
    headers={
        'apikey': key,
        'Authorization': f'Bearer {key}',
    },
    timeout=15,
)

print(f"HTTP Status Code: {response.status_code}")
print(f"Response body:\n{response.text}\n")

if response.status_code == 200:
    print("✅ SUCCESS -- this key IS valid and can read from the table.")
    print("   If insert still fails after this, the problem is specifically")
    print("   about WRITE permission, not the key itself.")
elif response.status_code == 401:
    print("❌ FAILED -- Supabase does not recognize this key as valid at all.")
    print("   This means the key value itself is wrong/incomplete, regardless")
    print("   of which row you copied it from.")
else:
    print(f"⚠️  Unexpected status code {response.status_code} -- see response body above.")