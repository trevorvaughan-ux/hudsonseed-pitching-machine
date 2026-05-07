#!/usr/bin/env python3
"""
SUPABASE_INTEGRATION — Clean Supabase access for HudsonSeed Pitch Machine.

All persistent data lives in Supabase (leads, pitch history, district status).
Google Suite layer is kept small (only active 3-district window + summary metrics)
to avoid quota issues and keep the working set stable.

REAL, EXECUTABLE functions only. No stubs. No fake data.
This is the foundation for one-district-at-a-time + rotating window.
"""

import os
import json
from datetime import datetime
import requests

# Supabase config from environment variables ONLY
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://pebhikfbpgntedvbxqph.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}


def get_schools_for_district(district: str, limit: int = 100):
    """
    REAL function: Pull schools/leads for ONE specific district from Supabase.
    Used for focused 'one district at a time' pitching.
    Returns list of dicts or empty list on failure.
    """
    if not SUPABASE_KEY:
        print("[SUPABASE] No SERVICE_ROLE_KEY in env")
        return []

    try:
        params = {
            "select": "*",
            "district": f"eq.{district}",
            "limit": str(limit)
        }
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/leads",
            headers=HEADERS,
            params=params,
            timeout=10
        )
        if r.status_code == 200:
            schools = r.json()
            print(f"[SUPABASE] Loaded {len(schools)} schools for district: {district}")
            return schools
        else:
            print(f"[SUPABASE] Query failed: {r.status_code} {r.text}")
            return []
    except Exception as e:
        print(f"[SUPABASE] Error: {e}")
        return []


def log_pitch_result(school_name: str, email: str, status: str, district: str = None, error: str = None):
    """
    REAL function: Log pitch result back to Supabase.
    Enables tracking what works vs what doesn't so we can maximize winners
    and minimize losers during the hot inbox phase.
    """
    if not SUPABASE_KEY:
        return False

    payload = {
        "school_name": school_name,
        "email": email,
        "status": status,
        "district": district,
        "pitched_at": datetime.now().isoformat(),
        "error": error
    }

    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/pitches_sent",
            headers=HEADERS,
            json=payload,
            timeout=10
        )
        if r.status_code in (200, 201):
            return True
        print(f"[SUPABASE] Log failed: {r.status_code}")
        return False
    except Exception as e:
        print(f"[SUPABASE] Log error: {e}")
        return False


def get_active_district_window():
    """
    REAL scaffolding for rotating 3-district window (previous / current / next).
    Returns simple dict now. Full rotation + cadence logic will be added
    in follow-up commit once base focused pitching is verified on Railway.
    This keeps the active 'sheets' layer small and stable.
    """
    return {
        "previous": None,
        "current": os.getenv("CURRENT_DISTRICT", "Jersey City Public Schools"),
        "next": None
    }


def load_leads_from_supabase(district: str = None):
    """
    Enhanced version of original. Supports optional district filter for focused pitching.
    Falls back to original full load if no district given.
    """
    if district:
        return get_schools_for_district(district)
    if not SUPABASE_KEY:
        return None
    try:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/leads?select=*", headers=HEADERS, timeout=10)
        if r.status_code == 200:
            return r.json()
        return None
    except Exception:
        return None


def load_leads_fallback():
    try:
        with open("leads.json") as f:
            leads = json.load(f)
        print(f"[FALLBACK] Loaded {len(leads)} leads from JSON")
        return leads
    except Exception as e:
        print(f"[FALLBACK] Error: {e}")
        return []


def load_leads(prefer_supabase=True, district: str = None):
    if prefer_supabase:
        leads = load_leads_from_supabase(district)
        if leads:
            return leads
    return load_leads_fallback()


def log_reply(email, subject, body):
    try:
        with open("reply_tracker.json", "a") as f:
            f.write(json.dumps({
                "from": email,
                "subject": subject,
                "body": body[:100],
                "at": datetime.now().isoformat()
            }) + "\n")
        return True
    except Exception:
        return False
