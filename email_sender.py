#!/usr/bin/env python3
"""
EMAIL_SENDER — Email sending layer (simulated + real Gmail SMTP ready).
Loads pitches from pitches_sent.json, sends via Gmail SMTP or simulated.
Logs sent emails to sent_emails.json for tracking.
"""

import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os

print("[EMAIL_SENDER] EMAIL_SENDER_STARTED -", datetime.now().isoformat())

# Gmail credentials (from environment variables for security)
GMAIL_USER = os.getenv("GMAIL_USER", "trevorvaughan@hudsonseed.com")
GMAIL_PASSWORD = os.getenv("GMAIL_PASSWORD", "")  # App password from Gmail
SIMULATE_ONLY = True  # Set to False to actually send emails

# Load pitches
try:
    with open("pitches_sent.json") as f:
        pitches = json.load(f)
    print(f"[EMAIL_SENDER] ✓ Loaded {len(pitches)} pitches from pitches_sent.json")
except Exception as e:
    print(f"[EMAIL_SENDER] ERROR loading pitches_sent.json: {e}")
    pitches = []

# Track sent emails
sent_emails = []

for pitch in pitches:
    school = pitch.get("school", "Unknown School")
    principal = pitch.get("principal", "Principal")
    email = pitch.get("email", "")
    pitch_text = pitch.get("pitch", "")
    
    if not email:
        print(f"[EMAIL_SENDER] ⚠ SKIP {school} - no email address")
        continue
    
    # Parse pitch (subject + body)
    lines = pitch_text.split("\n", 1)
    subject = lines[0].replace("Subject: ", "") if lines else "HudsonSeed Yoga Program"
    body = lines[1] if len(lines) > 1 else pitch_text
    
    if SIMULATE_ONLY:
        # Simulated send
        print(f"[EMAIL_SENDER] → Sending to {school} ({email})... [SIMULATED]")
        status = "SIMULATED"
    else:
        # Real Gmail SMTP send
        try:
            msg = MIMEMultipart()
            msg["From"] = GMAIL_USER
            msg["To"] = email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))
            
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(GMAIL_USER, GMAIL_PASSWORD)
                server.send_message(msg)
            
            print(f"[EMAIL_SENDER] ✓ Email sent to {school} ({email})")
            status = "SENT"
        except Exception as e:
            print(f"[EMAIL_SENDER] ✗ ERROR sending to {school}: {e}")
            status = "FAILED"
    
    # Log sent email
    sent_record = {
        "school": school,
        "principal": principal,
        "email": email,
        "subject": subject,
        "body": body[:100] + "..." if len(body) > 100 else body,
        "status": status,
        "sent_at": datetime.now().isoformat()
    }
    sent_emails.append(sent_record)

# Save sent emails log
try:
    with open("sent_emails.json", "w") as f:
        json.dump(sent_emails, f, indent=2)
    print(f"\n[EMAIL_SENDER] ✓ {len(sent_emails)} emails logged to sent_emails.json")
except Exception as e:
    print(f"[EMAIL_SENDER] ERROR writing sent_emails.json: {e}")

print(f"[EMAIL_SENDER] EMAIL_SENDER_COMPLETE - {datetime.now().isoformat()}")
print("[EMAIL_SENDER] ✓ Email sender layer complete. Machine has finder + generator + sender.")
print("[EMAIL_SENDER] For cron: Run this file daily via Railway cron job.")
print("[EMAIL_SENDER] To enable real sends: Set GMAIL_PASSWORD env var + set SIMULATE_ONLY=False")
