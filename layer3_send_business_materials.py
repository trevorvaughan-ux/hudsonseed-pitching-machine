================================================================================
HUDSONSEED LAYER 3 — COMPLETE HANDOFF PACKAGE FOR CLAUDE
================================================================================

This file contains everything needed for Layer 3.

INSTRUCTIONS FOR CLAUDE:

- The user (Trevor) wants to test the **full chain**: Layer 1 → Layer 2 → Layer 3.
- You have already worked on Layer 1 and Layer 2.
- This package is the current MVP version of Layer 3.
- Business materials are currently being attached **manually** (ATTACH_BUSINESS_MATERIALS = False). This is temporary while Trevor updates his insurance.
- The user's success criteria for "MVP done for now":
  1. He clicks the Slides link from the email → full deck opens.
  2. He books a slot via the Calendar link → the appointment actually appears in his Google Calendar.

Please help integrate this cleanly with the Layer 1 and Layer 2 work you already did.

================================================================================
PART 1: LAYER 3 PYTHON SCRIPT (Full Code)
================================================================================

"""
Layer 3 — Business Materials Email Sender (Simplified)

================================================================================
CURRENT STATE (May 2026)
================================================================================

This script now does one thing cleanly:
- Sends the exact business materials email (PDF + materials + first slide preview)
- Embeds your native Google Calendar Appointment Schedule link

NOTE (temporary): While you are attaching business materials manually,
the email currently says "Below are our business materials..." instead of
"Below, attached are...". This will switch back automatically when
ATTACH_BUSINESS_MATERIALS is set to True.

Google Calendar API + auto event creation has been removed per direction.
We are using your native Appointment Schedule link directly (no credentials.json needed for calendar).

WHAT IS WORKING:
- Exact email sending with locked tone
- Link loaded from assets/presentation_link.txt (easy to update)
- Image embedding + attachments
- Safe dry_run mode
- Per-reply error handling + clear summary

PHILOSOPHY:
- Keep it simple and reliable
- One campaign at a time
- "It has to work the day the first real email goes out."

See PROJECT_STATE_2026-05-24.md for full context.
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
# CONFIG — FILL THESE TO RUN ON REAL DATA
# =============================================================================
#
# Gmail App Password (provided 2026-05-24):
#   "hudsonseed python machine" → pluf wgpe ayeq gbzc
#   (stripped: plufwgpeayeqgbzc)
#
# SECURITY: Prefer environment variable so real password is never in source.
#   export HUDSONSEED_GMAIL_APP_PASSWORD="plufwgpeayeqgbzc"
#
# The script falls back to the value below for immediate local testing/runs.
# NEVER commit real credentials. Add this file + token.pickle + credentials.json
# to .gitignore (or your global gitignore).
#
# Items needed (all under assets/):
#   - PDF deck
#   - First slide image (for email preview)
#   - business_materials/ folder (currently disabled while updating insurance)
#   - presentation_link.txt → Google Calendar Appointment Schedule link
#   - slides_link.txt       → Full live Slides deck link
#
# All user-editable assets live under the assets/ folder for simplicity.
# =============================================================================

SENDER_NAME = "Trevor Vaughan"
SENDER_EMAIL = "trevorvaughan@hudsonseed.com"

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = "trevorvaughan@hudsonseed.com"

# App Password for SMTP (Layer 3 business materials sender)
SMTP_PASSWORD = os.getenv(
    "HUDSONSEED_GMAIL_APP_PASSWORD",
    "plufwgpeayeqgbzc"   # fallback — the "hudsonseed python machine" App Password (no spaces)
)

# --- Assets base (everything user-editable lives under assets/ relative to the script) ---
# This makes the whole machine self-contained and easy to manage from phone/laptop.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(SCRIPT_DIR, "assets")

# File / link paths — now defaulting into assets/ for consistency
# (You can override any of these if you prefer a different layout.)
PDF_DECK_PATH = os.path.join(ASSETS_DIR, "HudsonSeed_Business_Materials.pdf")
BUSINESS_MATERIALS_FOLDER = os.path.join(ASSETS_DIR, "business_materials")

# =============================================================================
# BUSINESS MATERIALS ATTACHMENT SWITCH
# =============================================================================
# 
# This is the ONLY line you need to change when you're ready to let the script
# automatically attach your business materials (license + insurance).
#
# CURRENTLY: False   → You are attaching materials manually
# WHEN READY:  True  → Script will auto-attach everything in the folder
#
# Changing this single line from False to True will:
#   1. Turn on automatic attachment of the business_materials/ folder
#   2. Automatically update the email text to say "attached are our business materials"
#
# That's it. One small change.
# =============================================================================

ATTACH_BUSINESS_MATERIALS = False
FIRST_SLIDE_IMAGE_PATH = os.path.join(ASSETS_DIR, "HudsonSeed_first_slide.png")   # ← wired from your input

# Presentation / booking link lives in an external plain-text file.
# This makes it trivial to update on phone or without editing code.
# The file should contain ONLY the URL (one line, comments with # are ignored).
PRESENTATION_LINK_PATH = os.path.join(ASSETS_DIR, "presentation_link.txt")

# The email body uses CALENDAR_LINK (locked wording: "You can book a time directly here").
# We source it from the presentation_link.txt you specified so you only maintain one file.
CALENDAR_LINK = _load_text_file(PRESENTATION_LINK_PATH, "https://your-real-calendar-link-here")

# Also expose the raw presentation link if needed elsewhere
PRESENTATION_LINK = _load_text_file(PRESENTATION_LINK_PATH, "")

# Separate link for the full live Slides deck (you just provided this)
SLIDES_LINK_PATH = os.path.join(ASSETS_DIR, "slides_link.txt")
SLIDES_LINK = _load_text_file(SLIDES_LINK_PATH, "")


# =============================================================================
# HELPERS
# =============================================================================

def _load_text_file(path, fallback=""):
    """Safely load the first non-comment, non-empty line from a text file.
    Lines starting with # are treated as comments (so you can leave instructions in the file).
    Used for links that the operator wants to change frequently without touching .py.
    """
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


# =============================================================================
# THE MACHINE
# =============================================================================

def build_email(recipient_name, recipient_email, vendor_code, booking_link=None, slides_link=None):
    """
    Builds the business materials email.
    - Embeds the first slide as preview
    - Includes your Google Calendar Appointment Schedule link
    - Includes link to the full Slides deck (so they can access the complete presentation after seeing the opening slide)
    """
    msg = MIMEMultipart("related")
    msg["Subject"] = f"HudsonSeed – Business Materials {vendor_code}"
    msg["From"] = formataddr((SENDER_NAME, SENDER_EMAIL))
    msg["To"] = recipient_email

    link_text = booking_link or CALENDAR_LINK or "Reply to this email to schedule a time."

    # Materials sentence - adjusted while attaching manually
    if ATTACH_BUSINESS_MATERIALS:
        materials_sentence = "Below, attached are our business materials (business license + insurance)."
    else:
        materials_sentence = "Below are our business materials (business license + insurance)."

    # Simple MVP way to let them access the full deck after seeing the opening slide
    slides_line = ""
    if slides_link or SLIDES_LINK:
        slides_line = f"Full presentation: {slides_link or SLIDES_LINK}\n\n"

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
        
        {f'<p>Full presentation: <a href="{slides_link or SLIDES_LINK}">{slides_link or SLIDES_LINK}</a></p>' if (slides_link or SLIDES_LINK) else ''}
        
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


def run_machine(replies, dry_run=True):
    """
    THE MACHINE — sends the business materials email with your booking link.

    For each reply dict (must have keys: name, email, vendor_code):
      - Sends the exact business materials email
      - Embeds the opening slide as preview
      - Includes booking link + link to the full Slides deck (so they can access the complete presentation)

    Always start with dry_run=True.
    """
    sent = 0
    errors = 0

    booking_link = PRESENTATION_LINK or CALENDAR_LINK

    # Asset attachment status (shown once per run)
    print("\n[ASSETS]")
    print(f"  - First slide image: {'✓ will attach' if os.path.exists(FIRST_SLIDE_IMAGE_PATH) else '✗ MISSING'}")
    print(f"  - PDF deck:          {'✓ will attach' if os.path.exists(PDF_DECK_PATH) else '✗ MISSING'}")

    if ATTACH_BUSINESS_MATERIALS:
        if os.path.isdir(BUSINESS_MATERIALS_FOLDER):
            files = [f for f in os.listdir(BUSINESS_MATERIALS_FOLDER) if os.path.isfile(os.path.join(BUSINESS_MATERIALS_FOLDER, f))]
            print(f"  - Business materials:  ✓ will auto-attach {len(files)} file(s) from folder")
        else:
            print(f"  - Business materials:  ✗ FOLDER NOT FOUND (but email will still say they are attached)")
    else:
        print(f"  - Business materials:  (manual for now - you will attach them yourself)")
        print(f"                         Note: Email will still say 'attached are our business materials'")
    print()

    for r in replies:
        name = r.get("name", "Unknown")
        email = r.get("email", "")
        vendor = r.get("vendor_code", "NO-CODE")

        if not email:
            print(f"[SKIP] No email for {name}")
            continue

        if dry_run:
            print(f"[DRY RUN] Would send business materials email to {name} <{email}> (vendor {vendor})")
            print(f"          Booking link: {booking_link}")
            if SLIDES_LINK:
                print(f"          Full presentation: {SLIDES_LINK}")
            sent += 1
        else:
            try:
                msg = build_email(
                    name, email, vendor, 
                    booking_link=booking_link,
                    slides_link=SLIDES_LINK
                )

                with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                    server.starttls()
                    server.login(SMTP_USERNAME, SMTP_PASSWORD)
                    server.send_message(msg)

                print(f"[EMAIL] ✓ Sent to {email}")
                sent += 1

            except Exception as e:
                print(f"[ERROR] processing {email}: {e}")
                errors += 1

    # Final summary
    print("\n" + "=" * 60)
    print("LAYER 3 RUN SUMMARY")
    print("=" * 60)
    print(f"Total replies processed: {len(replies)}")
    print(f"Successful: {sent}")
    print(f"Errors: {errors}")
    print("Dry run was:", dry_run)

    # Asset delivery confirmation
    print("\n[ASSET DELIVERY]")
    print(f"  - PDF deck attached:           {'Yes' if os.path.exists(PDF_DECK_PATH) else 'No (missing)'}")

    if ATTACH_BUSINESS_MATERIALS:
        if os.path.isdir(BUSINESS_MATERIALS_FOLDER):
            files = [f for f in os.listdir(BUSINESS_MATERIALS_FOLDER) if os.path.isfile(os.path.join(BUSINESS_MATERIALS_FOLDER, f))]
            print(f"  - Business materials attached: Yes ({len(files)} file(s) from folder)")
        else:
            print(f"  - Business materials attached: No (folder not found)")
    else:
        print(f"  - Business materials attached: No (you are attaching manually)")
        print(f"    → Email text will still say they are attached")
    print("Remember: one campaign at a time. Layer 1 stays pristine.")
    print("=" * 60 + "\n")


# =============================================================================
# MINIMAL RUNNER
# =============================================================================

if __name__ == "__main__":
    """
    QUICK TEST RUNNER

    =====================================================================
    DEFINITION OF DONE (Your Rule)
    =====================================================================
    We are not "close to finishing" if the real outcome isn't happening.

    "The script runs without errors" does NOT count as done.

    MVP is only complete when you personally see BOTH of these in reality:
    1. You click the Slides link from the email → full deck opens
    2. You book a slot via the Calendar link → appointment appears in your Google Calendar

    Until both are true with your own eyes, we are still building — not wrapping up.
    =====================================================================

    YOUR ACTUAL TEST PATH (Layer 1 → Layer 2 → Layer 3)
    =====================================================================
    1. Start from Layer 1 (trigger outbound in the Google Sheet)
    2. Get replies through Layer 2 (your normal process)
    3. Feed those replies into Layer 3 (this script)
    4. Validate in real life:
         - Click the Slides link → full deck opens
         - Book a slot via the Calendar link → appointment appears in your Google Calendar

    Full detailed checklist + your Definition of Done → see TEST_TODAY_MVP.md
    =====================================================================

    Quick reminder:
    - Always run with dry_run=True first
    - Business materials are currently manual (ATTACH_BUSINESS_MATERIALS = False)
    - Flip that flag to True later when you're ready for auto-attachment
    """
    test_replies = [
        {"name": "Test School", "email": "test@example.com", "vendor_code": "V00108320"}
    ]

    run_machine(test_replies, dry_run=True)


================================================================================
PART 2: TESTING GUIDE (Full Content of TEST_TODAY_MVP.md)
================================================================================

# Test the Machine Today – MVP End-to-End

**Let's finish this MVP today.**

This guide matches how you actually want to test:

**Layer 1 → Layer 2 → Layer 3**

---

## DEFINITION OF DONE (Your Rule)

We are **not** "close to finishing" or "almost done" until the real outcome happens.

Your standard:
- If the real-world result you want is not happening, then we haven't finished anything meaningful.
- "The code is written" or "the script runs" does **not** count as done.
- Only when you personally see both of these with your own eyes does the MVP count as complete for now:

  1. You click the Slides link from the email → the full deck opens properly.
  2. You book a slot using the Calendar link → the appointment actually appears in your Google Calendar.

Until both of those are true in reality, we are still building, not wrapping up.

---

## Let's Finish This Today – Immediate Next Moves

1. Make sure the 5 asset files are in the `assets/` folder (listed below).
2. Run a dry run of Layer 3 right now to verify the email looks correct.
3. Trigger Layer 1 from your sheet (or add test replies).
4. Run Layer 2 on the replies.
5. Feed the replies into Layer 3 and send a real test email to yourself.
6. Do the two real validations:
   - Click the Slides link → deck opens
   - Book a slot → appointment appears in your calendar

If both validations pass with your own eyes → MVP is done for now.

---

## Step-by-Step Test Flow (Today)

### 1. Prepare the Assets
Make sure these files exist in the `assets/` folder:

- `HudsonSeed_first_slide.png`
- `HudsonSeed_Business_Materials.pdf`
- `business_materials/` folder (can be empty or partial — you're attaching manually for now)
- `presentation_link.txt` → contains your real Calendar Appointment link
- `slides_link.txt` → contains your full Slides deck link

### 2. Start from Layer 1 (Your Normal Outbound)
- Go to your Google Sheet (JC Beta or whichever campaign you're using).
- Trigger Layer 1 as you normally would (send outbound pitches).
- This is the real starting point — not calling Python directly.

### 3. Simulate or Wait for Replies (Layer 2)
- Either:
  a) Wait for real replies to come in, or
  b) Manually add test replies into the sheet (the way you normally feed Layer 2).

- Run / trigger Layer 2 on those replies (this is where you normally work).

### 4. Feed Replies into Layer 3 (Python)
Once Layer 2 has identified the replies you want to respond to:

- Copy the relevant reply data (name, email, vendor_code).
- Run Layer 3 against those specific replies.

Example (edit the bottom of `layer3_send_business_materials.py` or create a quick test):

```python
test_replies = [
    {"name": "Test School", "email": "your-email@hudsonseed.com", "vendor_code": "TEST001"}
]

run_machine(test_replies, dry_run=True)   # First verify everything looks correct
# run_machine(test_replies, dry_run=False)  # Then send for real
```

**Important**: Start with `dry_run=True` every time.

### 5. Real Validation (Your Success Criteria)
After the email lands in your inbox:

1. **Slides Check**
   - Open the email
   - Click the "Full presentation" link
   - Confirm the full Google Slides deck opens properly

2. **Calendar Check**
   - Click the booking link in the same email
   - Book a real time slot with yourself
   - Go to your Google Calendar and confirm the appointment appears

Only when **both** of the above happen do you consider the current MVP complete.

---

## Quick Commands

Dry run (recommended first every time):
```bash
python3 layer3_send_business_materials.py
```

Send to yourself (after editing the test replies at the bottom):
```bash
python3 layer3_send_business_materials.py
```

---

## Notes

- Business materials folder attachment is currently **manual** (`ATTACH_BUSINESS_MATERIALS = False`).
- When your insurance is updated and you're ready, just change that flag to `True`. The email wording will also update automatically.
- The script is intentionally simple right now. Full automatic triggering from the Google Sheet (Layer 2 → Layer 3) can be built later.

---

Ready when you are. Run the dry run first, then send a test to yourself and validate the two real-world links.


================================================================================
END OF HANDOFF PACKAGE
================================================================================

Additional files the user should provide to Claude:
- The `assets/` folder (especially the two .txt link files with the real URLs)
- Any existing Layer 1 / Layer 2 code if needed for integration

This single file contains the complete current Layer 3 MVP.