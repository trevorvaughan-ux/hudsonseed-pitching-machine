import os
import time
from datetime import datetime
import supabase

# Get env vars exactly as Railway provides them
SUPABASE_URL = os.getenv("SUPABASE_URL") or "https://pebhikfbpgntedvbxqph.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

print(f"[GROK] Connecting to Supabase...")
print(f"[GROK] URL: {SUPABASE_URL}")
print(f"[GROK] Key: {'***' + SUPABASE_KEY[-10:] if SUPABASE_KEY else 'MISSING'}")

if not SUPABASE_KEY:
    print("[GROK] FATAL: No Supabase key found")
    exit(1)

supa = supabase.create_client(SUPABASE_URL, SUPABASE_KEY)

print("[GROK] POLLER_STARTED - Autonomous mode")
print(f"[GROK] Polling interval: 30 seconds")

last_message_id = 0

while True:
    try:
        # Poll for new CLAUDE commands
        response = supa.table("ai_messages").select("*").eq("sender", "CLAUDE").order("id", desc=True).limit(10).execute()
        
        if response.data:
            for msg in response.data:
                if msg['id'] > last_message_id:
                    last_message_id = msg['id']
                    print(f"[GROK] NEW COMMAND: {msg['message']}")
                    
                    # Write response
                    reply = f"GROK_RECEIVED: {msg['message']} at {datetime.utcnow().isoformat()}"
                    supa.table("ai_messages").insert({
                        "sender": "GROK",
                        "message": reply,
                        "context_id": "hudsonseed-grok-poller-v1",
                        "created_at": datetime.utcnow().isoformat()
                    }).execute()
                    print(f"[GROK] RESPONSE SENT")
        else:
            print(f"[GROK] No new commands. Heartbeat at {datetime.utcnow().isoformat()}")
        
        time.sleep(30)
        
    except Exception as e:
        print(f"[GROK] ERROR: {e}")
        time.sleep(30)
