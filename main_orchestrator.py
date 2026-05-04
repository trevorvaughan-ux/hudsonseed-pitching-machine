#!/usr/bin/env python3
"""
FULL_PITCH_MACHINE_CRON — Main orchestrator for autonomous pitching.
Chains: finder (leads) → generator (pitches) → sender (emails)
Runs on Railway cron schedule: "0 9 * * *" (daily at 9 AM UTC)

Components:
1. Load leads from leads.json (or Supabase later)
2. Generate personalized pitches
3. Send emails with anti-spam headers
4. Log results to sent_emails.json
5. Report status
"""

import json
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os

print("[PITCH_MACHINE] FULL_PITCH_MACHINE_CRON_STARTED -", datetime.now().isoformat())

# Configuration
GMAIL_USER = os.getenv("GMAIL_USER", "trevorvaughan@hudsonseed.com")
GMAIL_PASSWORD = os.getenv("GMAIL_PASSWORD", "cdpw jobq ujdz oyag")
SIMULATE_ONLY = os.getenv("SIMULATE_ONLY", "False").lower() == "true"
SEND_DELAY_SECONDS = 2
REPLY_TO = "trevorvaughan@hudsonseed.com"
UNSUBSCRIBE_FOOTER = "\n\n---\nReply STOP to opt out. HudsonSeed | hudsonseed.com"

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1: LOAD LEADS (School Finder)
# ═══════════════════════════════════════════════════════════════════════════════

print("[PITCH_MACHINE] PHASE 1: LOAD LEADS")

try:
    with open("leads.json") as f:
        leads = json.load(f)
    print(f"[PITCH_MACHINE] ✓ Loaded {len(leads)} leads from leads.json")
except Exception as e:
    print(f"[PITCH_MACHINE] ERROR loading leads.json: {e}")
    leads = []

if not leads:
    print("[PITCH_MACHINE] ⚠ No leads found. Exiting.")
    exit(1)

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2: GENERATE PITCHES (Pitch Generator)
# ═══════════════════════════════════════════════════════════════════════════════

print("[PITCH_MACHINE] PHASE 2: GENERATE PITCHES")

pitches = []

for lead in leads:
    school_name = lead.get("school_name", "School")
    principal = lead.get("principal", "Principal")
    email = lead.get("email", "")
    
    if not email:
        print(f"[PITCH_MACHINE] ⚠ SKIP {school_name} - no email address")
        continue
    
    pitch = f"""Subject: Yoga + Mindfulness Program for {school_name} Students

Dear {principal},

HudsonSeed brings proven kids yoga to Hoboken schools. 

Build focus, calm, and emotional regulation across your student body.

First 4 weeks free for 2026 pilot.

Reply or call 862-371-4966 to schedule demo.

---

Trevor Vaughan
Founder & CEO
HudsonSeed
www.hudsonseed.com
862-371-4966"""
    
    pitch_record = {
        "school": school_name,
        "principal": principal,
        "email": email,
        "pitch": pitch,
        "generated_at": datetime.now().isoformat(),
        "status": "GENERATED"
    }
    
    pitches.append(pitch_record)

print(f"[PITCH_MACHINE] ✓ Generated {len(pitches)} personalized pitches")

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3: SEND EMAILS (Email Sender with Anti-Spam)
# ═══════════════════════════════════════════════════════════════════════════════

print("[PITCH_MACHINE] PHASE 3: SEND EMAILS")

sent_emails = []
sent_count = 0
failed_count = 0

for pitch in pitches:
    school = pitch.get("school", "Unknown")
    principal = pitch.get("principal", "Principal")
    email = pitch.get("email", "")
    pitch_text = pitch.get("pitch", "")
    
    # Parse pitch
    lines = pitch_text.split("\n", 1)
    subject = lines[0].replace("Subject: ", "") if lines else "HudsonSeed Yoga Program"
    body = lines[1] if len(lines) > 1 else pitch_text
    body_with_footer = body + UNSUBSCRIBE_FOOTER
    
    if SIMULATE_ONLY:
        print(f"[PITCH_MACHINE] → {school} ({email})... [SIMULATED]")
        status = "SIMULATED"
        sent_count += 1
    else:
        try:
            # Real Gmail SMTP send
            msg = MIMEMultipart()
            msg["From"] = GMAIL_USER
            msg["To"] = email
            msg["Subject"] = subject
            msg["Reply-To"] = REPLY_TO
            msg["User-Agent"] = "HudsonSeed Pitcher"
            msg["X-Priority"] = "3"
            msg.attach(MIMEText(body_with_footer, "plain"))
            
            server = smtplib.SMTP("smtp.gmail.com", 587)
            server.starttls()
            server.login(GMAIL_USER, GMAIL_PASSWORD)
            server.send_message(msg)
            server.quit()
            
            print(f"[PITCH_MACHINE] ✓ Sent to {school} ({email})")
            status = "SENT"
            sent_count += 1
            time.sleep(SEND_DELAY_SECONDS)
        except Exception as e:
            print(f"[PITCH_MACHINE] ✗ FAILED {school}: {e}")
            status = "FAILED"
            failed_count += 1
    
    sent_record = {
        "school": school,
        "principal": principal,
        "email": email,
        "subject": subject,
        "status": status,
        "sent_at": datetime.now().isoformat()
    }
    sent_emails.append(sent_record)

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 4: LOG RESULTS
# ═══════════════════════════════════════════════════════════════════════════════

print("[PITCH_MACHINE] PHASE 4: LOG RESULTS")

try:
    with open("sent_emails.json", "w") as f:
        json.dump(sent_emails, f, indent=2)
    print(f"[PITCH_MACHINE] ✓ Logged {len(sent_emails)} emails to sent_emails.json")
except Exception as e:
    print(f"[PITCH_MACHINE] ERROR writing sent_emails.json: {e}")

# ═══════════════════════════════════════════════════════════════════════════════
# FINAL STATUS REPORT
# ═══════════════════════════════════════════════════════════════════════════════

print("[PITCH_MACHINE] ═══════════════════════════════════════════════════════════════")
print(f"[PITCH_MACHINE] FULL_PITCH_MACHINE_CRON_COMPLETE - {datetime.now().isoformat()}")
print("[PITCH_MACHINE] ═══════════════════════════════════════════════════════════════")
print(f"[PITCH_MACHINE] Leads loaded: {len(leads)}")
print(f"[PITCH_MACHINE] Pitches generated: {len(pitches)}")
print(f"[PITCH_MACHINE] Emails sent: {sent_count}")
print(f"[PITCH_MACHINE] Emails failed: {failed_count}")
print("[PITCH_MACHINE] ═══════════════════════════════════════════════════════════════")
print("[PITCH_MACHINE] Next run: Daily at 9 AM UTC via Railway cron")
print("[PITCH_MACHINE] Cron schedule: '0 9 * * *'")
print("[PITCH_MACHINE] Machine is autonomous and ready for scale.")
