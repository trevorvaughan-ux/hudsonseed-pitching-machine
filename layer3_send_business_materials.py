================================================================================
HUDSONSEED LAYER 3 — GROK + GEMINI MERGED (May 26, 2026)
================================================================================

MERGED FEATURES:
- Grok: Business materials email (PDF + first slide + calendar link)
- Gemini: 5-minute human latency gate (prevents robot-speed sends)
- Result: Clean, enforced human delay before auto-send

================================================================================

"""
Layer 3 — Business Materials Email Sender with 5-Minute Human Delay Gate
(Grok's business logic + Gemini's latency enforcement)

PHILOSOPHY:
- No pitch. Pure value delivery (materials + booking link).
- 5-minute human latency gate: prevents automation from feeling robotic.
- One campaign at a time. Layer 1 stays pristine.
"""

import os
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.mime.image import MIMEImage
from email import encoders
from email.utils import formataddr

# =============================================================================
# CONFIG
# =============================================================================

SENDER_NAME = "Trevor Vaughan"
SENDER_EMAIL = "trevorvaughan@hudsonseed.com"

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = "trevorvaughan@hudsonseed.com"

# App Password for SMTP (Layer 3 business materials sender)
SMTP_PASSWORD = os.getenv(
    "HUDSONSEED_GMAIL_APP_PASSWORD",
    "plufwgpeayeqgbzc"   # fallback
)

# Assets
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(SCRIPT_DIR, "assets")

PDF_DECK_PATH = os.path.join(ASSETS_DIR, "HudsonSeed_Business_Materials.pdf")
BUSINESS_MATERIALS_FOLDER = os.path.join(ASSETS_DIR, "business_materials")
FIRST_SLIDE_IMAGE_PATH = os.path.join(ASSETS_DIR, "HudsonSeed_first_slide.png")
PRESENTATION_LINK_PATH = os.path.join(ASSETS_DIR, "presentation_link.txt")
SLIDES_LINK_PATH = os.path.join(ASSETS_DIR, "slides_link.txt")

ATTACH_BUSINESS_MATERIALS = False

# =============================================================================
# GEMINI'S 5-MINUTE DELAY GATE (MERGED)
# =============================================================================

def check_human_delay(reply_timestamp_str, min_minutes=5):
    """
    GEMINI'S 5-MINUTE HUMAN LATENCY GATE
    
    Args:
        reply_timestamp_str: ISO format timestamp or datetime object
        min_minutes: minimum minutes to wait (default 5)
    
    Returns:
        (is_ready: bool, minutes_elapsed: float, wait_time_remaining: float)
    
    Philosophy:
    - Enforces human-like latency (prevents robot-speed sends)
    - Returns (ready, elapsed, remaining) so caller can log/wait/decide
    """
    try:
        if isinstance(reply_timestamp_str, str):
            reply_time = datetime.fromisoformat(reply_timestamp_str.replace('Z', '+00:00'))
        else:
            reply_time = reply_timestamp_str
        
        now = datetime.utcnow() if reply_time.tzinfo is None else datetime.now(reply_time.tzinfo)
        minutes_elapsed = (now - reply_time).total_seconds() / 60.0
        is_ready = minutes_elapsed >= min_minutes
        wait_remaining = max(0, min_minutes - minutes_elapsed)
        
        return is_ready, minutes_elapsed, wait_remaining
    
    except Exception as e:
        print(f"[WARN] Could not parse timestamp {reply_timestamp_str}: {e}")
        # Assume it's old enough to send (don't block on parse error)
        return True, float('inf'), 0.0


# =============================================================================
# HELPERS
# =============================================================================

def _load_text_file(path, fallback=""):
    """Load first non-comment line from a text file."""
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    stripped = line.strip()
                    if stripped and not stripped.startswith("#"):
                        return stripped
    except Exception as e:
        print(f"[WARN] Could not read {path}: {e}")
    return fallback


def load_links():
    """Load presentation and slides links from assets."""
    calendar_link = _load_text_file(PRESENTATION_LINK_PATH, "https://your-real-calendar-link-here")
    slides_link = _load_text_file(SLIDES_LINK_PATH, "")
    return calendar_link, slides_link


# =============================================================================
# GROK'S EMAIL BUILDER (MERGED)
# =============================================================================

def build_email(recipient_name, recipient_email, vendor_code, booking_link=None, slides_link=None):
    """
    GROK'S BUSINESS MATERIALS EMAIL
    
    Builds professional email with:
    - First slide preview (embedded)
    - PDF deck (attached)
    - Calendar booking link
    - Full Slides deck link
    """
    calendar_link, _ = load_links()
    
    msg = MIMEMultipart("related")
    msg["Subject"] = f"HudsonSeed – Business Materials {vendor_code}"
    msg["From"] = formataddr((SENDER_NAME, SENDER_EMAIL))
    msg["To"] = recipient_email

    link_text = booking_link or calendar_link or "Reply to this email to schedule a time."

    if ATTACH_BUSINESS_MATERIALS:
        materials_sentence = "Below, attached are our business materials (business license + insurance)."
    else:
        materials_sentence = "Below are our business materials (business license + insurance)."

    slides_line = ""
    if slides_link:
        slides_line = f"Full presentation: {slides_link}\n\n"

    text_body = f"""{materials_sentence}

You can book a time directly here: {link_text}

{slides_line}In service,

Trevor Vaughan
Director
HudsonSeed
862.371.4966
www.hudsonseed.com
"""

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
        <p>{materials_sentence}</p>
        
        <p><img src="cid:first_slide" style="max-width: 600px; height: auto; border: 1px solid #ddd;"></p>
        
        <p>You can book a time directly here: <a href="{link_text}">{link_text}</a></p>
        
        {f'<p>Full presentation: <a href="{slides_link}">{slides_link}</a></p>' if slides_link else ''}
        
        <p>In service,<br>
        <strong>Trevor Vaughan</strong><br>
        Director<br>
        HudsonSeed<br>
        862.371.4966<br>
        www.hudsonseed.com</p>
      </body>
    </html>
    """

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    if os.path.exists(FIRST_SLIDE_IMAGE_PATH):
        with open(FIRST_SLIDE_IMAGE_PATH, "rb") as img:
            image = MIMEImage(img.read())
            image.add_header("Content-ID", "<first_slide>")
            image.add_header("Content-Disposition", "inline", filename="first_slide.png")
            msg.attach(image)

    if os.path.exists(PDF_DECK_PATH):
        with open(PDF_DECK_PATH, "rb") as f:
            pdf = MIMEBase("application", "pdf")
            pdf.set_payload(f.read())
            encoders.encode_base64(pdf)
            pdf.add_header("Content-Disposition", f"attachment; filename={os.path.basename(PDF_DECK_PATH)}")
            msg.attach(pdf)

    if ATTACH_BUSINESS_MATERIALS and os.path.isdir(BUSINESS_MATERIALS_FOLDER):
        for filename in os.listdir(BUSINESS_MATERIALS_FOLDER):
            filepath = os.path.join(BUSINESS_MATERIALS_FOLDER, filename)
            if os.path.isfile(filepath):
                with open(filepath, "rb") as f:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", f"attachment; filename={filename}")
                    msg.attach(part)

    return msg


# =============================================================================
# THE MACHINE: GROK + GEMINI MERGED
# =============================================================================

def run_machine(replies, dry_run=True, min_delay_minutes=5):
    """
    THE MERGED MACHINE
    
    For each reply:
    1. GEMINI'S GATE: Check if 5 minutes have passed since reply timestamp
    2. GROK'S SEND: If gate passes, send business materials email
    
    Args:
        replies: list of dicts with keys:
                 - name (recipient name for email)
                 - email (recipient email)
                 - vendor_code (your vendor code in their district)
                 - reply_timestamp (ISO format or datetime object)
                 - (optional) booking_link, slides_link
        dry_run: if True, only log what would be sent (no actual SMTP)
        min_delay_minutes: minimum minutes to wait (default 5)
    """
    sent = 0
    delayed = 0
    errors = 0

    calendar_link, slides_link = load_links()

    print("\n" + "="*70)
    print("LAYER 3: GROK + GEMINI MERGED (5-MIN DELAY + BUSINESS MATERIALS)")
    print("="*70)
    print(f"Processing {len(replies)} replies (dry_run={dry_run})")
    print(f"5-minute delay gate: ACTIVE (min={min_delay_minutes}min)")
    print()

    # Asset status
    print("[ASSETS]")
    print(f"  - First slide:        {'✓' if os.path.exists(FIRST_SLIDE_IMAGE_PATH) else '✗ MISSING'}")
    print(f"  - PDF deck:           {'✓' if os.path.exists(PDF_DECK_PATH) else '✗ MISSING'}")
    print(f"  - Calendar link:      {'✓ loaded' if calendar_link else '✗ MISSING'}")
    print(f"  - Slides link:        {'✓ loaded' if slides_link else '⚠ optional'}")
    print()

    # Main loop
    for r in replies:
        name = r.get("name", "Unknown")
        email = r.get("email", "")
        vendor = r.get("vendor_code", "NO-CODE")
        reply_ts = r.get("reply_timestamp", None)

        if not email:
            print(f"[SKIP] No email for {name}")
            continue

        # ===== GEMINI'S 5-MINUTE GATE =====
        if reply_ts:
            is_ready, elapsed, remaining = check_human_delay(reply_ts, min_delay_minutes)
            
            if not is_ready:
                print(f"[WAIT] {name} <{email}> | Elapsed: {elapsed:.1f}min | Remaining: {remaining:.1f}min")
                delayed += 1
                continue
            else:
                print(f"[READY] {name} <{email}> | Elapsed: {elapsed:.1f}min (gate passed)")
        else:
            print(f"[NO TIMESTAMP] {name} <{email}> | Assuming old reply, proceeding")

        # ===== GROK'S SEND =====
        if dry_run:
            print(f"  [DRY RUN] Would send business materials to {email}")
            print(f"            Vendor: {vendor}")
            print(f"            Booking: {calendar_link}")
            if slides_link:
                print(f"            Slides: {slides_link}")
            sent += 1
        else:
            try:
                msg = build_email(
                    name, email, vendor,
                    booking_link=calendar_link,
                    slides_link=slides_link
                )

                with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                    server.starttls()
                    server.login(SMTP_USERNAME, SMTP_PASSWORD)
                    server.send_message(msg)

                print(f"  [SENT] ✓ Business materials to {email}")
                sent += 1

            except Exception as e:
                print(f"  [ERROR] {email}: {e}")
                errors += 1

    # Final summary
    print()
    print("="*70)
    print("LAYER 3 RUN SUMMARY")
    print("="*70)
    print(f"Total replies processed:  {len(replies)}")
    print(f"Sent:                     {sent}")
    print(f"Delayed (waiting gate):   {delayed}")
    print(f"Errors:                   {errors}")
    print(f"Dry run:                  {dry_run}")
    print("="*70 + "\n")


# =============================================================================
# TEST RUNNER
# =============================================================================

if __name__ == "__main__":
    """
    QUICK TEST (with 5-minute delay gate)
    
    Test data includes reply_timestamp so the delay gate can evaluate.
    """
    
    # Example: reply from 10 minutes ago (should send)
    ten_min_ago = (datetime.utcnow() - timedelta(minutes=10)).isoformat() + 'Z'
    
    # Example: reply from 2 minutes ago (should wait)
    two_min_ago = (datetime.utcnow() - timedelta(minutes=2)).isoformat() + 'Z'
    
    test_replies = [
        {
            "name": "Test School (Ready)",
            "email": "test-ready@example.com",
            "vendor_code": "V00108320",
            "reply_timestamp": ten_min_ago  # ← 10 min old, will send
        },
        {
            "name": "Test School (Waiting)",
            "email": "test-waiting@example.com",
            "vendor_code": "V00108321",
            "reply_timestamp": two_min_ago  # ← 2 min old, will wait
        },
    ]

    print("Starting Layer 3 dry run with 5-minute delay gate...\n")
    run_machine(test_replies, dry_run=True, min_delay_minutes=5)

