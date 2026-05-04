#!/usr/bin/env python3
"""
DAILY_PITCH_MACHINE_CRON — Production email sender with real Gmail SMTP.
Runs daily at 9 AM UTC: generates pitches from leads.json, sends to principals.
Logs results for tracking.

Railway Cron Schedule: 0 9 * * *
"""

import json
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os

# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL SENDER FUNCTION (Production)
# ═══════════════════════════════════════════════════════════════════════════════

def send_pitch(to_email, subject, body):
    """Send pitch email via Gmail SMTP with anti-spam headers."""
    EMAIL = "trevorvaughan@hudsonseed.com"
    APP_PASSWORD = "cdpw jobq ujdz oyag"  # Gmail app password
    
    msg = MIMEMultipart()
    msg['From'] = EMAIL
    msg['To'] = to_email
    msg['Subject'] = subject
    msg['Reply-To'] = EMAIL
    msg['User-Agent'] = "HudsonSeed Pitcher"
    msg['X-Priority'] = "3"
    msg.attach(MIMEText(body, 'plain'))
    
    server = smtplib.SMTP("smtp.gmail.com", 587)
    server.starttls()
    server.login(EMAIL, APP_PASSWORD)
    server.send_message(msg)
    server.quit()
    print(f"[SEND_PITCH] ✓ Sent to {to_email}")

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN CRON LOOP
# ═══════════════════════════════════════════════════════════════════════════════

print("[DAILY_PITCHER] DAILY_PITCH_MACHINE_CRON -", datetime.now().isoformat())

# Config
SIMULATE_ONLY = os.getenv("SIMULATE_ONLY", "True").lower() == "true"
SEND_DELAY = 2
UNSUBSCRIBE = "\n\n---\nReply STOP to opt out. HudsonSeed | hudsonseed.com"

# Load leads
try:
    with open("leads.json") as f:
        leads = json.load(f)
    print(f"[DAILY_PITCHER] ✓ Loaded {len(leads)} leads")
except Exception as e:
    print(f"[DAILY_PITCHER] ERROR: {e}")
    exit(1)

# Generate and send pitches
sent = []
for lead in leads[:10]:  # Limit to 10 per run (expand later)
    school = lead.get("school_name", "School")
    principal = lead.get("principal", "Principal")
    email = lead.get("email", "")
    
    if not email:
        print(f"[DAILY_PITCHER] ⚠ SKIP {school} - no email")
        continue
    
    pitch = f"""Subject: Kids Yoga Pilot at {school}

Dear {principal},

HudsonSeed offers science-based yoga/mindfulness for K-12.

Build focus, calm, and emotional regulation across your student body.

First month free for 2026.

Call 862-371-4966 or reply to schedule demo.

---

Trevor Vaughan
Founder & CEO
HudsonSeed
www.hudsonseed.com
862-371-4966"""
    
    lines = pitch.split("\n", 1)
    subject = lines[0].replace("Subject: ", "")
    body = lines[1] + UNSUBSCRIBE if len(lines) > 1 else pitch
    
    if SIMULATE_ONLY:
        print(f"[DAILY_PITCHER] → {school} ({email})... [SIM]")
        status = "SIMULATED"
    else:
        try:
            send_pitch(email, subject, body)
            status = "SENT"
            time.sleep(SEND_DELAY)
        except Exception as e:
            print(f"[DAILY_PITCHER] ✗ FAILED {school}: {e}")
            status = "FAILED"
    
    sent.append({
        "school": school,
        "email": email,
        "status": status,
        "sent_at": datetime.now().isoformat()
    })

# Log
try:
    with open("daily_pitcher_log.json", "w") as f:
        json.dump({
            "run_date": datetime.now().isoformat(),
            "emails_sent": len(sent),
            "results": sent
        }, f, indent=2)
    print(f"[DAILY_PITCHER] ✓ Logged {len(sent)} emails")
except Exception as e:
    print(f"[DAILY_PITCHER] ERROR logging: {e}")

print(f"[DAILY_PITCHER] Daily cycle complete. {len(sent)} pitches generated.")
print("[DAILY_PITCHER] Next run tomorrow via Railway cron.")
