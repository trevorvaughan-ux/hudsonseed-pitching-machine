#!/usr/bin/env python3
"""
PITCH_GENERATOR — Full pitching logic (no Supabase, no email sending yet).
Loads leads from leads.json, generates personalized pitches, saves to pitches_sent.json.
"""

import json
from datetime import datetime

print("[PITCH_GENERATOR] PITCH_GENERATOR_STARTED -", datetime.now().isoformat())

# Load leads
try:
    with open("leads.json") as f:
        leads = json.load(f)
    print(f"[PITCH_GENERATOR] ✓ Loaded {len(leads)} leads from leads.json")
except Exception as e:
    print(f"[PITCH_GENERATOR] ERROR loading leads.json: {e}")
    leads = []

# Generate pitches for first 5 schools (test batch)
pitches = []

for lead in leads[:5]:
    school_name = lead.get("school_name", "School")
    principal = lead.get("principal", "Principal")
    email = lead.get("email", "unknown@hoboken.k12.nj.us")
    
    pitch = f"""Subject: Yoga + Mindfulness Program for {school_name} Students

Dear {principal},

HudsonSeed brings proven kids yoga to Hoboken schools. 

Build focus, calm, and emotional regulation across your student body.

First 4 weeks free for 2026 pilot.

Reply or call 862-371-4966 to schedule demo.

Mr. Trevor
HudsonSeed"""
    
    pitch_record = {
        "school": school_name,
        "principal": principal,
        "email": email,
        "pitch": pitch,
        "generated_at": datetime.now().isoformat(),
        "status": "DRAFT"
    }
    
    pitches.append(pitch_record)
    
    print(f"\n[PITCH_GENERATOR] --- PITCH FOR {school_name} ---")
    print(pitch)
    print("[PITCH_GENERATOR] ---")

# Save generated pitches to file
try:
    with open("pitches_sent.json", "w") as f:
        json.dump(pitches, f, indent=2)
    print(f"\n[PITCH_GENERATOR] ✓ {len(pitches)} pitches saved to pitches_sent.json")
except Exception as e:
    print(f"[PITCH_GENERATOR] ERROR writing pitches_sent.json: {e}")

print(f"[PITCH_GENERATOR] PITCH_GENERATOR_COMPLETE - {datetime.now().isoformat()}")
print("[PITCH_GENERATOR] ✓ Pitching logic layer complete. Ready for email sender next.")
