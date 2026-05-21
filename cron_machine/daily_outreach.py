"""
HudsonSeed Daily Outreach Cron
==============================
Pulls next 7 pending JC schools from Supabase, creates personalized
Gmail drafts (does NOT send), logs results.

Schedule: Tue/Wed/Thu at 10am ET
Owner: Trevor Vaughan
Status: Built May 20, 2026 by Claude
"""

import os
import sys
import json
import base64
from datetime import datetime
from email.mime.text import MIMEText
import requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# ============ CONFIG ============
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://pebhikfbpgntedvbxqph.supabase.co')
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']  # Required env var
GMAIL_TOKEN_JSON = os.environ['GMAIL_TOKEN_JSON']  # Required env var
BATCH_SIZE = 7
SENDER_NAME = "Trevor Vaughan"
SENDER_EMAIL = "trevorvaughan@hudsonseed.com"

# ============ SUPABASE ============
def supabase_request(method, path, payload=None):
    """Direct REST call to Supabase - no SDK needed."""
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if method == 'GET':
        r = requests.get(url, headers=headers)
    elif method == 'POST':
        r = requests.post(url, headers=headers, json=payload)
    elif method == 'PATCH':
        r = requests.patch(url, headers=headers, json=payload)
    r.raise_for_status()
    return r.json() if r.text else {}

def get_pending_schools(limit=BATCH_SIZE):
    """Pull next N schools where draft_status='pending' and has principal email."""
    path = (
        "jc_schools_contacts"
        "?draft_status=eq.pending"
        "&principal_email=not.is.null"
        "&order=id.asc"
        f"&limit={limit}"
    )
    return supabase_request('GET', path)

def mark_school_drafted(school_id, gmail_draft_id):
    """Update school row after draft created."""
    path = f"jc_schools_contacts?id=eq.{school_id}"
    payload = {
        'draft_status': 'drafted',
        'draft_created_at': datetime.utcnow().isoformat(),
        'draft_gmail_id': gmail_draft_id
    }
    return supabase_request('PATCH', path, payload)

def log_run(targeted, created, errors, error_detail, processed):
    """Log every run to outreach_runs table."""
    payload = {
        'run_date': datetime.utcnow().date().isoformat(),
        'schools_targeted': targeted,
        'drafts_created': created,
        'errors': errors,
        'error_detail': error_detail,
        'schools_processed': processed
    }
    return supabase_request('POST', 'outreach_runs', payload)

# ============ GMAIL ============
def get_gmail_service():
    """Build Gmail API service from stored token JSON."""
    token_data = json.loads(GMAIL_TOKEN_JSON)
    creds = Credentials.from_authorized_user_info(token_data)
    return build('gmail', 'v1', credentials=creds)

def build_email_body(school):
    """Personalized body using real school data."""
    principal_name = school.get('principal_name') or 'Principal'
    # Handle "Dr. Joseph Galano" -> "Dr. Galano" style salutation
    if 'Dr.' in principal_name:
        last_name = principal_name.split()[-1]
        salutation = f"Dear Dr. {last_name}"
    elif principal_name == 'Principal':
        salutation = "Dear Principal"
    else:
        last_name = principal_name.split()[-1]
        salutation = f"Dear Principal {last_name}"
    
    school_name = school['school_name']
    grade_level = school.get('grade_level', 'K-12')
    enrollment = school.get('enrollment')
    
    enrollment_clause = ""
    if enrollment and enrollment > 800:
        enrollment_clause = f" With over {enrollment} students across {grade_level}, we believe a measured rollout could meaningfully support your teachers and students."
    
    body = f"""{salutation},

I'm Trevor Vaughan, founder of HudsonSeed and a 500-hour Registered Yoga Teacher with the RCYT (Registered Children's Yoga Teacher) credential through Yoga Alliance. I'm reaching out because {school_name} is part of our Jersey City beta cohort, and HudsonSeed is already an approved JCPS vendor — Vendor Code V00108320 — meaning we can begin programming with zero procurement friction.

HudsonSeed delivers evidence-based yoga and mindfulness programming for K-12 students. Our work directly supports nervous system regulation, attention, and emotional resilience — outcomes that translate to fewer classroom disruptions and stronger student readiness to learn. We currently run live programs across Hoboken, Jersey City, and Union City, and we are expanding our Jersey City footprint this spring.

I'd like to offer your school a 30-minute introductory conversation to explore whether HudsonSeed would be a fit for {school_name}.{enrollment_clause} No obligation, no pitch deck — just a real conversation about what your {grade_level} students need and how we can support your teachers.

Would you be open to a brief call this week or next? I'm happy to work around your schedule.

Warm regards,

Trevor Vaughan
Founder, HudsonSeed
trevorvaughan@hudsonseed.com
500HR ERYT+RCYT | JCPS Vendor V00108320"""
    return body

def build_subject(school):
    """Subject with HudsonSeed branding + vendor code."""
    school_short = school['school_name']
    # Try to extract PS number if present
    if '(PS ' in school_short:
        ps_part = school_short.split('(')[1].split(')')[0]
        return f"HudsonSeed | Vendor V00108320 | K-12 Yoga & Mindfulness for {ps_part}"
    else:
        # Truncate long names
        if len(school_short) > 35:
            school_short = school_short[:32] + "..."
        return f"HudsonSeed | Vendor V00108320 | K-12 Yoga & Mindfulness for {school_short}"

def create_gmail_draft(gmail, school):
    """Create draft, return Gmail draft ID."""
    body = build_email_body(school)
    subject = build_subject(school)
    
    message = MIMEText(body)
    message['to'] = school['principal_email']
    message['from'] = SENDER_EMAIL
    message['subject'] = subject
    
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    draft = gmail.users().drafts().create(
        userId='me',
        body={'message': {'raw': raw_message}}
    ).execute()
    return draft['id']

# ============ MAIN ============
def main():
    print(f"[{datetime.utcnow().isoformat()}] HudsonSeed Daily Outreach starting")
    
    # 1. Pull pending schools
    schools = get_pending_schools(BATCH_SIZE)
    print(f"Found {len(schools)} pending schools")
    
    if not schools:
        log_run(0, 0, 0, "No pending schools", [])
        print("No pending schools. Outreach complete.")
        return 0
    
    # 2. Build Gmail service
    try:
        gmail = get_gmail_service()
    except Exception as e:
        log_run(len(schools), 0, 1, f"Gmail auth failed: {e}", [])
        print(f"FATAL: Gmail auth failed - {e}")
        return 1
    
    # 3. Create drafts for each school
    created = 0
    errors = 0
    error_messages = []
    processed = []
    
    for school in schools:
        try:
            draft_id = create_gmail_draft(gmail, school)
            mark_school_drafted(school['id'], draft_id)
            created += 1
            processed.append({
                'school_id': school['id'],
                'school_name': school['school_name'],
                'principal_email': school['principal_email'],
                'draft_id': draft_id,
                'status': 'success'
            })
            print(f"  ✓ Drafted: {school['school_name']} -> {school['principal_email']}")
        except Exception as e:
            errors += 1
            error_messages.append(f"{school['school_name']}: {str(e)}")
            processed.append({
                'school_id': school['id'],
                'school_name': school['school_name'],
                'status': 'error',
                'error': str(e)
            })
            print(f"  ✗ ERROR: {school['school_name']} - {e}")
    
    # 4. Log run
    log_run(
        targeted=len(schools),
        created=created,
        errors=errors,
        error_detail='; '.join(error_messages) if error_messages else None,
        processed=processed
    )
    
    print(f"\n[DONE] Created {created} drafts, {errors} errors")
    return 0 if errors == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
