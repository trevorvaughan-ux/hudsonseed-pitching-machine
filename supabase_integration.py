#!/usr/bin/env python3
"""
SUPABASE_INTEGRATION — Load leads from Supabase or fallback to JSON.
Credentials from environment variables only (no hardcoding).
"""

import json
import os
from datetime import datetime

# Supabase config from env vars
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://pebhikfbpgntedvbxqph.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def load_leads_from_supabase():
    """Load leads from Supabase leads table."""
    if not SUPABASE_KEY:
        print("[SUPABASE] ✗ No API key in env")
        return None
    
    try:
        import requests
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/leads?select=*",
            headers=headers,
            timeout=5
        )
        if r.status_code == 200:
            leads = r.json()
            print(f"[SUPABASE] ✓ Loaded {len(leads)} leads")
            return leads
        return None
    except Exception as e:
        print(f"[SUPABASE] ✗ Failed: {e}")
        return None

def load_leads_fallback():
    """Fallback: Load from JSON."""
    try:
        with open("leads.json") as f:
            leads = json.load(f)
        print(f"[FALLBACK] ✓ Loaded {len(leads)} leads from JSON")
        return leads
    except Exception as e:
        print(f"[FALLBACK] ✗ Error: {e}")
        return None

def load_leads(prefer_supabase=True):
    """Load leads: try Supabase first, fallback to JSON."""
    if prefer_supabase:
        leads = load_leads_from_supabase()
        if leads:
            return leads
    return load_leads_fallback()

def log_reply(email, subject, body):
    """Log email reply."""
    try:
        with open("reply_tracker.json", "a") as f:
            f.write(json.dumps({
                "from": email,
                "subject": subject,
                "body": body[:100],
                "at": datetime.now().isoformat()
            }) + "\n")
        print(f"[REPLY_TRACKER] ✓ Logged {email}")
        return True
    except Exception as e:
        print(f"[REPLY_TRACKER] ✗ Error: {e}")
        return False

if __name__ == "__main__":
    leads = load_leads()
    if leads:
        print(f"✓ Ready: {len(leads)} schools loaded")
