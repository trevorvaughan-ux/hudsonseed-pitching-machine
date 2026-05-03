import os
import time
from datetime import datetime
import supabase

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CONTEXT_ID = "hudsonseed-grok-poller-v1"

supa = supabase.create_client(SUPABASE_URL, SUPABASE_KEY)

print("[GROK] POLLER_STARTED - Autonomous mode")
print(f"[GROK] Polling interval: 30 seconds")
print(f"[GROK] Context: {CONTEXT_ID}")

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
                        "context_id": CONTEXT_ID,
                        "created_at": datetime.utcnow().isoformat()
                    }).execute()
                    print(f"[GROK] RESPONSE SENT")
        
        # Heartbeat
        supa.table("ai_messages").insert({
            "sender": "GROK",
            "message": f"[GROK] HEARTBEAT - {datetime.utcnow().isoformat()}",
            "context_id": "grok-heartbeat",
            "created_at": datetime.utcnow().isoformat()
        }).execute()
        
        time.sleep(30)
        
    except Exception as e:
        print(f"[GROK] ERROR: {e}")
        time.sleep(30)
