#!/usr/bin/env python3
"""
PITCH_TEST — Standalone test (no Supabase, no Railway).
Runs once, loads Hoboken schools, saves to leads.json, logs ready.
"""

import json
from datetime import datetime

print("[PITCH_TEST] PITCH_MACHINE_STANDALONE_STARTED -", datetime.now().isoformat())

# Test data (Hoboken schools from earlier sessions)
leads = [
    {"school_name": "Hoboken High School", "principal": "Robin Piccapietra", "email": "robin.piccapietra@hoboken.k12.nj.us"},
    {"school_name": "Hoboken Middle School", "principal": "TBD", "email": "hmiddle@hoboken.k12.nj.us"},
    {"school_name": "Brandt Elementary", "principal": "TBD", "email": "brandt@hoboken.k12.nj.us"},
    {"school_name": "Connors Elementary", "principal": "TBD", "email": "connors@hoboken.k12.nj.us"},
    {"school_name": "Wallace Elementary", "principal": "TBD", "email": "wallace@hoboken.k12.nj.us"},
    {"school_name": "Elementary #1", "principal": "TBD", "email": "elem1@hoboken.k12.nj.us"},
    {"school_name": "Elementary #2", "principal": "TBD", "email": "elem2@hoboken.k12.nj.us"},
    {"school_name": "Solomon Schechter", "principal": "TBD", "email": "schechter@hoboken.k12.nj.us"},
    {"school_name": "Christ the King Academy", "principal": "TBD", "email": "ctk@hoboken.k12.nj.us"},
    {"school_name": "Hoboken Charter School", "principal": "TBD", "email": "hcs@hoboken.k12.nj.us"},
    {"school_name": "Hudson County Schools of Technology", "principal": "TBD", "email": "hcst@hoboken.k12.nj.us"},
]

# Save to local JSON
with open("leads.json", "w") as f:
    json.dump(leads, f, indent=2)

print(f"[PITCH_TEST] ✓ {len(leads)} schools saved to leads.json")
print(f"[PITCH_TEST] ✓ Ready for full pitching logic")
print(f"[PITCH_TEST] PITCH_TEST_COMPLETE - {datetime.now().isoformat()}")
print("[PITCH_TEST] Status: READY FOR AUTONOMOUS PITCHER")
