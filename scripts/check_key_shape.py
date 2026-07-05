"""
check_key_shape.py -- safely checks for copy-paste mistakes without
ever printing your full secret key.
"""

import os

key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not key:
    print("❌ SUPABASE_SERVICE_ROLE_KEY is not set in this terminal session.")
else:
    print(f"Length: {len(key)} characters")
    print(f"First 15 chars: {key[:15]}")
    print(f"Last 6 chars:  {key[-6:]}")
    print(f"Starts with quote character? {key[0] in chr(34)+chr(39)}")
    print(f"Ends with quote character?   {key[-1] in chr(34)+chr(39)}")
    print(f"Contains any spaces?         {' ' in key}")
    print(f"Contains newline character?  {chr(10) in key}")