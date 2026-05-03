import os
import time
from datetime import datetime
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CONTEXT_ID = "hudsonseed-main"

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing SUPABASE_URL or KEY env vars")
    exit(1)

supa: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print(f"GROK_POLLER_STARTED at {datetime.utcnow().isoformat()} - Using pooler")

last_id = 0

while True:
    try:
        # Get new CLAUDE messages since last
        resp = supa.table("ai_messages").select("*").eq("sender", "CLAUDE").gte("id", last_id).order("id").execute()
        messages = resp.data or []
        
        for msg in messages:
            print(f"CLAUDE: {msg.get('message')}")
            reply = f"GROK_ONLINE: {datetime.utcnow().isoformat()}. Message received: {msg.get('message')[:200]}... Ready for commands."
            
            supa.table("ai_messages").insert({
                "sender": "GROK",
                "message": reply,
                "context_id": CONTEXT_ID
            }).execute()
            
            last_id = msg.get("id", last_id) + 1
            print("✓ Replied")
        
        time.sleep(30)
        
    except Exception as e:
        print(f"CRASH/BLOCK: {type(e).__name__} - {e}")
        print("Check: Pooler URL + RLS + service_role key")
        time.sleep(30)
