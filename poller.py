import os
import time
import requests
from datetime import datetime

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
CONTEXT_ID = "hudsonseed-pitch"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

print(f"GROK_POLLER_STARTED - {datetime.utcnow().isoformat()}")
print(f"URL: {SUPABASE_URL}")
print("Key loaded: YES" if SUPABASE_KEY else "Key MISSING")

last_id = 0

while True:
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/ai_messages?sender=eq.CLAUDE&id=gt.{last_id}&order=id.asc",
            headers=headers
        )
        messages = r.json()
        
        for msg in messages:
            print(f"RECEIVED FROM CLAUDE: {msg.get('message')[:100]}...")
            reply = f"GROK_ONLINE: {datetime.utcnow().isoformat()}. Message received. Ready."
            
            requests.post(
                f"{SUPABASE_URL}/rest/v1/ai_messages",
                headers=headers,
                json={"sender": "GROK", "message": reply, "context_id": CONTEXT_ID}
            )
            print("✓ Replied to Claude")
            last_id = msg.get("id", last_id) + 1
        
        time.sleep(30)
    except Exception as e:
        print(f"ERROR: {e}")
        time.sleep(30)
