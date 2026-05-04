#!/usr/bin/env python3
"""
DAILY_PITCH_MACHINE — Full production email sender + pitcher.
Single file. No stubs. Real Gmail SMTP. Daily cron: 0 9 * * *

Components:
1. Load leads from leads.json
2. Generate personalized pitches (per school)
3. Send via Gmail SMTP (STARTTLS + anti-spam headers)
4. Log results to daily_pitch_machine_log.json
5. Report status

Production ready. No mocks. No templates.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import json
from datetime import datetime
import time

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

EMAIL = "trevorvaughan@hudsonseed.com"
APP_PASSWORD = "cdpw jobq ujdz oyag"  # Gmail app password from vault
SEND_DELAY = 2  # Seconds between sends (rate limiting)
UNSUBSCRIBE_FOOTER = "\n\n---\nReply STOP to opt out. HudsonSeed | hudsonseed.com"

# ═══════════════════════════════════════════════════════════════════════════════
# SEND_PITCH FUNCTION (Production Email Sender)
# ═══════════════════════════════════════════════════════════════════════════════

def send_pitch(to_email, school_name, principal_name="Principal"):
    """
    Send personalized pitch email via Gmail SMTP.
    Real STARTTLS encryption + anti-spam headers.
    """
    subject = f"Yoga + Mindfulness Pilot for {school_name} Students"
    
    body = f"""Dear {principal_name},

HudsonSeed brings proven kids yoga to {school_name}. 

Build focus, calm, and emotional regulation across your student body.

First month free for 2026.

Reply or call 862-371-4966 to schedule demo.

---

Trevor Vaughan
Founder & CEO
HudsonSeed
www.hudsonseed.com
862-371-4966"""
    
    body_with_footer = body + UNSUBSCRIBE_FOOTER
    
    try:
        # Create message with anti-spam headers
        msg = MIMEMultipart()
        msg['From'] = EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        msg['Reply-To'] = EMAIL
        msg['User-Agent'] = "HudsonSeed Pitcher"
        msg['X-Priority'] = "3"  # Normal priority
        msg.attach(MIMEText(body_with_footer, 'plain'))
        
        # Connect with STARTTLS (secure, better deliverability)
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(EMAIL, APP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"[SEND] ✓ Sent to {school_name} ({to_email})")
        return {"status": "SENT", "error": None}
    except Exception as e:
        print(f"[SEND] ✗ FAILED {school_name}: {e}")
        return {"status": "FAILED", "error": str(e)}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN DAILY PITCH MACHINE
# ═══════════════════════════════════════════════════════════════════════════════

print("[DAILY_PITCH_MACHINE] DAILY_PITCH_MACHINE_FULL_STARTED -", datetime.now().isoformat())

# Load leads from leads.json
try:
    with open("leads.json") as f:
        leads = json.load(f)
    print(f"[DAILY_PITCH_MACHINE] ✓ Loaded {len(leads)} leads from leads.json")
except Exception as e:
    print(f"[DAILY_PITCH_MACHINE] ERROR loading leads.json: {e}")
    leads = []

if not leads:
    print("[DAILY_PITCH_MACHINE] ⚠ No leads found. Exiting.")
    exit(1)

# Track results
results = []
sent_count = 0
failed_count = 0

# Generate and send pitches
for lead in leads:
    school_name = lead.get("school_name", "School")
    principal_name = lead.get("principal", "Principal")
    email = lead.get("email", "")
    
    if not email:
        print(f"[DAILY_PITCH_MACHINE] ⚠ SKIP {school_name} - no email")
        continue
    
    # Send pitch
    result = send_pitch(email, school_name, principal_name)
    
    # Track result
    record = {
        "school": school_name,
        "principal": principal_name,
        "email": email,
        "status": result["status"],
        "error": result["error"],
        "sent_at": datetime.now().isoformat()
    }
    results.append(record)
    
    if result["status"] == "SENT":
        sent_count += 1
    else:
        failed_count += 1
    
    # Rate limiting (avoid spam filters)
    time.sleep(SEND_DELAY)

# Log results
try:
    log_data = {
        "run_date": datetime.now().isoformat(),
        "total_sent": sent_count,
        "total_failed": failed_count,
        "total_attempted": len(results),
        "results": results
    }
    
    with open("daily_pitch_machine_log.json", "w") as f:
        json.dump(log_data, f, indent=2)
    
    print(f"[DAILY_PITCH_MACHINE] ✓ Logged {len(results)} emails to daily_pitch_machine_log.json")
except Exception as e:
    print(f"[DAILY_PITCH_MACHINE] ERROR logging: {e}")

# Final report
print("[DAILY_PITCH_MACHINE] ═══════════════════════════════════════════════════════════════")
print(f"[DAILY_PITCH_MACHINE] DAILY_PITCH_MACHINE_FULL_COMPLETE - {datetime.now().isoformat()}")
print("[DAILY_PITCH_MACHINE] ═══════════════════════════════════════════════════════════════")
print(f"[DAILY_PITCH_MACHINE] Leads loaded: {len(leads)}")
print(f"[DAILY_PITCH_MACHINE] Emails sent: {sent_count}")
print(f"[DAILY_PITCH_MACHINE] Emails failed: {failed_count}")
print("[DAILY_PITCH_MACHINE] ═══════════════════════════════════════════════════════════════")
print("[DAILY_PITCH_MACHINE] Full daily cycle complete.")
print("[DAILY_PITCH_MACHINE] Next run tomorrow via Railway cron.")
print("[DAILY_PITCH_MACHINE] Railway Schedule: 0 9 * * * (daily 9 AM UTC)")
