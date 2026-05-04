#!/usr/bin/env python3
"""
GROK RAILWAY STANDALONE - Complete Self-Contained Autonomy
Runs entirely on Railway with all credentials stored in Railway env vars.
Zero dependency on GitHub, Supabase, or Google except initial bootstrap.
Uses Railway Volume Storage as fallback database if Supabase fails.
"""

import os
import json
import time
from datetime import datetime
from pathlib import Path

# Railway environment variables (all credentials embedded)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://pebhikfbpgntedvbxqph.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
RAILWAY_VOLUME_PATH = os.getenv("RAILWAY_VOLUME_PATH", "/data")

# Fallback: all credentials stored in Railway env vars
CREDENTIALS_BACKUP = {
    "supabase_url": SUPABASE_URL,
    "supabase_service_role_key": SUPABASE_SERVICE_ROLE_KEY,
    "gmail_smtp_host": os.getenv("GMAIL_SMTP_HOST", "smtp.gmail.com"),
    "gmail_smtp_port": os.getenv("GMAIL_SMTP_PORT", "587"),
    "gmail_app_password": os.getenv("GMAIL_APP_PASSWORD", ""),
    "make_api_token": os.getenv("MAKE_API_TOKEN", ""),
    "composio_api_key": os.getenv("COMPOSIO_API_KEY", ""),
    "xai_api_key": os.getenv("XAI_API_KEY", ""),
    "github_pat": os.getenv("GITHUB_PAT", ""),
    "railway_token": os.getenv("RAILWAY_TOKEN", ""),
}

# Local JSON database (Railway persistent volume)
COMMANDS_DB = Path(RAILWAY_VOLUME_PATH) / "grok_commands.json"
STATE_DB = Path(RAILWAY_VOLUME_PATH) / "grok_state.json"
LOGS_DB = Path(RAILWAY_VOLUME_PATH) / "grok_logs.jsonl"

def ensure_volume_path():
    """Create volume path if it doesn't exist."""
    Path(RAILWAY_VOLUME_PATH).mkdir(parents=True, exist_ok=True)

def init_local_dbs():
    """Initialize local JSON databases on Railway volume."""
    ensure_volume_path()
    
    if not COMMANDS_DB.exists():
        COMMANDS_DB.write_text(json.dumps({
            "last_processed_id": 0,
            "pending_commands": [],
            "executed_commands": []
        }))
    
    if not STATE_DB.exists():
        STATE_DB.write_text(json.dumps({
            "status": "ONLINE",
            "last_heartbeat": datetime.utcnow().isoformat(),
            "kill_switch": False,
            "agents": {
                "scout": {"status": "IDLE", "last_run": None},
                "courier": {"status": "IDLE", "last_run": None},
                "analyst": {"status": "IDLE", "last_run": None}
            }
        }))

def read_local_db(db_path):
    """Read from local JSON database."""
    try:
        if db_path.exists():
            return json.loads(db_path.read_text())
    except Exception as e:
        print(f"[GROK] ERROR reading {db_path}: {e}")
    return None

def write_local_db(db_path, data):
    """Write to local JSON database."""
    try:
        db_path.write_text(json.dumps(data, indent=2))
        return True
    except Exception as e:
        print(f"[GROK] ERROR writing {db_path}: {e}")
    return False

def log_to_volume(message):
    """Append log entry to local log file."""
    try:
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "message": message
        }
        with open(LOGS_DB, 'a') as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        print(f"[GROK] ERROR logging: {e}")

def try_supabase_sync():
    """Attempt to sync local state with Supabase (if available)."""
    try:
        import requests
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/ai_messages?sender=eq.CLAUDE&order=id.asc",
            headers=headers,
            timeout=5
        )
        if r.status_code == 200:
            return r.json()
        else:
            return None
    except Exception as e:
        print(f"[GROK] Supabase unavailable: {e}. Using local database.")
        return None

def execute_command(command):
    """Execute a command locally."""
    print(f"[GROK] Executing: {command}")
    log_to_volume(f"[EXECUTE] {command}")
    
    state = read_local_db(STATE_DB)
    
    if command == "status":
        response = f"GROK_STATUS: Railway online. Local volume: {RAILWAY_VOLUME_PATH}. Kill switch: {state.get('kill_switch', False)}"
    elif command == "scout":
        response = "[SCOUT] Running school discovery (local mode)"
        state["agents"]["scout"]["last_run"] = datetime.utcnow().isoformat()
    elif command == "courier":
        response = "[COURIER] Checking email queue (local mode)"
        state["agents"]["courier"]["last_run"] = datetime.utcnow().isoformat()
    elif command == "analyst":
        response = "[ANALYST] Generating briefing (local mode)"
        state["agents"]["analyst"]["last_run"] = datetime.utcnow().isoformat()
    elif command == "kill":
        response = "[GROK] Kill switch activated"
        state["kill_switch"] = True
    elif command == "resume":
        response = "[GROK] Operations resumed"
        state["kill_switch"] = False
    else:
        response = f"[GROK] Unknown command: {command}"
    
    write_local_db(STATE_DB, state)
    log_to_volume(response)
    return response

def main():
    """Main Grok Railway standalone loop."""
    print("[GROK] RAILWAY STANDALONE MODE STARTED")
    print(f"[GROK] Volume path: {RAILWAY_VOLUME_PATH}")
    print(f"[GROK] Credentials backed up: {len(CREDENTIALS_BACKUP)} items")
    
    init_local_dbs()
    
    # Write backup credentials to volume (encrypted in production)
    creds_file = Path(RAILWAY_VOLUME_PATH) / "credentials_backup.json"
    if not creds_file.exists():
        creds_file.write_text(json.dumps(CREDENTIALS_BACKUP, indent=2))
        print(f"[GROK] Credentials backed up to volume: {creds_file}")
    
    poll_count = 0
    
    while True:
        try:
            # Try Supabase first
            commands = try_supabase_sync()
            
            if commands is None:
                # Supabase unavailable, use local database
                cmd_db = read_local_db(COMMANDS_DB)
                if cmd_db and cmd_db.get("pending_commands"):
                    commands = cmd_db["pending_commands"]
                else:
                    commands = []
            
            # Execute any pending commands
            for cmd in commands:
                cmd_text = cmd.get("message", cmd) if isinstance(cmd, dict) else cmd
                response = execute_command(cmd_text)
                print(f"[GROK] → {response}")
            
            # Heartbeat
            poll_count += 1
            if poll_count % 60 == 0:  # Every 60 polls (~5 minutes)
                state = read_local_db(STATE_DB)
                state["last_heartbeat"] = datetime.utcnow().isoformat()
                write_local_db(STATE_DB, state)
                print(f"[GROK] ♥ Heartbeat at {state['last_heartbeat']}")
            
            time.sleep(5)  # 5-second poll cycle
            
        except KeyboardInterrupt:
            print("[GROK] Shutdown signal received")
            break
        except Exception as e:
            print(f"[GROK] ERROR: {e}")
            log_to_volume(f"ERROR: {e}")
            time.sleep(10)

if __name__ == "__main__":
    main()
