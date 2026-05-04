#!/usr/bin/env python3
"""
EMAIL_SENDER — Email sending layer with anti-spam + real Gmail SMTP.
Loads pitches from pitches_sent.json, sends via Gmail SMTP with deliverability headers.
Logs sent emails to sent_emails.json for tracking.

Anti-spam measures:
- STARTTLS encryption
- SPF-friendly sender (from HudsonSeed domain)
- Rate limiting (delays between sends)
- Reply-To header
- Unsubscribe footer
- Text-only (no HTML to avoid spam filters)
"""

import json
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import os

print("[EMAIL_SENDER] EMAIL_SENDER_STARTED -", datetime.now().isoformat())

# Gmail credentials (from environment or hardcoded for testing)
GMAIL_USER = os.getenv("GMAIL_USER", "trevorvaughan@hudsonseed.com")
GMAIL_PASSWORD = os.getenv("GMAIL_PASSWORD", "cdpw jobq ujdz oyag")  # App password from Gmail vault
SIMULATE_ONLY = os.getenv("SIMULATE_ONLY", "False").lower() == "true"  # Set to "False" to actually send

# Anti-spam config
SEND_DELAY_SECONDS = 2  # Delay between emails (reduces spam filter triggers)
REPLY_TO = "trevorvaughan@hudsonseed.com"
UNSUBSCRIBE_FOOTER = "\n\n---\nReply STOP to opt out. HudsonSeed | hudsonseed.com"

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
    
    # Add unsubscribe footer (CAN-SPAM compliance)
    body_with_footer = body + UNSUBSCRIBE_FOOTER
    
    if SIMULATE_ONLY:
        # Simulated send
        print(f"[EMAIL_SENDER] → Sending to {school} ({email})... [SIMULATED]")
        status = "SIMULATED"
    else:
        # Real Gmail SMTP send with anti-spam headers
        try:
            # Create message with anti-spam headers
            msg = MIMEMultipart()
            msg["From"] = GMAIL_USER
            msg["To"] = email
            msg["Subject"] = subject
            msg["Reply-To"] = REPLY_TO
            msg["User-Agent"] = "HudsonSeed Pitcher"
            msg["X-Priority"] = "3"  # Normal priority (not bulk)
            msg.attach(MIMEText(body_with_footer, "plain"))
            
            # Connect with STARTTLS (more secure, better deliverability)
            server = smtplib.SMTP("smtp.gmail.com", 587)
            server.starttls()  # Enable encryption
            server.login(GMAIL_USER, GMAIL_PASSWORD)
            server.send_message(msg)
            server.quit()
            
            print(f"[EMAIL_SENDER] ✓ Email sent to {school} ({email}) - STARTTLS secure")
            status = "SENT"
            
            # Rate limiting (wait between sends to avoid spam filter triggers)
            time.sleep(SEND_DELAY_SECONDS)
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
print("[EMAIL_SENDER] Anti-spam measures active:")
print("[EMAIL_SENDER]   - STARTTLS encryption (TCP 587)")
print("[EMAIL_SENDER]   - Reply-To header for bounces")
print("[EMAIL_SENDER]   - CAN-SPAM unsubscribe footer")
print("[EMAIL_SENDER]   - Text-only (no HTML)")
print("[EMAIL_SENDER]   - 2-second delay between sends (rate limiting)")
print("[EMAIL_SENDER] For cron: Run this file daily via Railway cron job.")
print("[EMAIL_SENDER] To enable real sends: Set SIMULATE_ONLY=False + GMAIL_PASSWORD env var")
