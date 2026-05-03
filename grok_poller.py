import os
import time
from datetime import datetime
from supabase import create_client, Client

# Use REST API URL (not database URL) to avoid IPv6 issues
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://pebhikfbpgntedvbxqph.supabase.co").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlYmhpa2ZibmdwbnRlZGJ4cXBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwMzA4MTk5MywiZXhwIjoxOTk4NjU3OTkzfQ.lKUeP6kSVn4P_S6j-1lDK4").strip()

CONTEXT_ID = "hudsonseed-main"

print(f"[INIT] SUPABASE_URL={SUPABASE_URL}")
print(f"[INIT] SUPABASE_KEY={'***' + SUPABASE_KEY[-10:] if SUPABASE_KEY else 'MISSING'}")

try:
    supa: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"[INIT] Supabase client created OK")
except Exception as e:
    print(f"[FATAL] Cannot create Supabase client: {e}")
    exit(1)

print(f"[GROK_POLLER_STARTED] at {datetime.utcnow().isoformat()}")

last_id = 0

while True:
    try:
        # Get new CLAUDE messages
        resp = supa.table("ai_messages").select("*").eq("sender", "CLAUDE").gte("id", last_id).order("id").execute()
        messages = resp.data or []
        
        for msg in messages:
            print(f"[CLAUDE_MSG] {msg.get('message')[:100]}")
            reply = f"GROK_ONLINE: {datetime.utcnow().isoformat()}. Message received: {msg.get('message')[:200]}... Ready for commands."
            
            supa.table("ai_messages").insert({
                "sender": "GROK",
                "message": reply,
                "context_id": CONTEXT_ID
            }).execute()
            
            last_id = msg.get("id", last_id) + 1
            print(f"[REPLY_SENT] id={last_id}")
        
        time.sleep(30)
        
    except Exception as e:
        print(f"[ERROR] {type(e).__name__}: {e}")
        time.sleep(30)
