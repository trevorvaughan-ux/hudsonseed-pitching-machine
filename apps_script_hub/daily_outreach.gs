/**
 * HudsonSeed Mil Hub — Daily Outreach
 * ====================================
 * Pulls next 7 pending JC schools from Supabase
 * Creates personalized Gmail drafts (does NOT send)
 * Logs every run to Supabase outreach_runs table
 *
 * Schedule: Tue/Wed/Thu 10:00 AM ET (via Apps Script time trigger)
 * Owner: Trevor Vaughan / trevorvaughan@hudsonseed.com
 * Built: May 20, 2026 by Claude
 *
 * SETUP CHECKLIST (one-time):
 * 1. Paste this into script.google.com → New Project → name it "HudsonSeed Mil Hub"
 * 2. Project Settings → Script Properties → add SUPABASE_KEY (service role key)
 * 3. Run testRun() once → click Allow on OAuth popup (grants Gmail + fetch permission)
 * 4. Triggers (clock icon) → Add Trigger:
 *    - Function: runDailyOutreach
 *    - Event source: Time-driven
 *    - Type: Week timer
 *    - Day: Tue (then add separate triggers for Wed and Thu)
 *    - Time: 10am-11am
 * 5. Done. Forever.
 */

// ============ CONFIG ============
const SUPABASE_URL = 'https://pebhikfbpgntedvbxqph.supabase.co';
const BATCH_SIZE = 7;
const SENDER_NAME = 'Trevor Vaughan';
const SENDER_EMAIL = 'trevorvaughan@hudsonseed.com';

// SUPABASE_KEY is stored in Script Properties (Project Settings → Script Properties)
function getSupabaseKey() {
  const key = PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY');
  if (!key) {
    throw new Error('SUPABASE_KEY not set. Go to Project Settings → Script Properties → add it.');
  }
  return key;
}

// ============ SUPABASE HELPERS ============
function supabaseRequest(method, path, payload) {
  const key = getSupabaseKey();
  const options = {
    method: method,
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    muteHttpExceptions: true
  };
  if (payload) {
    options.payload = JSON.stringify(payload);
  }
  const url = SUPABASE_URL + '/rest/v1/' + path;
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Supabase ' + method + ' ' + path + ' failed: ' + code + ' ' + response.getContentText());
  }
  const text = response.getContentText();
  return text ? JSON.parse(text) : null;
}

function getPendingSchools(limit) {
  const path = 'jc_schools_contacts'
    + '?draft_status=eq.pending'
    + '&principal_email=not.is.null'
    + '&order=id.asc'
    + '&limit=' + limit;
  return supabaseRequest('GET', path);
}

function markSchoolDrafted(schoolId, gmailDraftId) {
  const path = 'jc_schools_contacts?id=eq.' + schoolId;
  return supabaseRequest('PATCH', path, {
    draft_status: 'drafted',
    draft_created_at: new Date().toISOString(),
    draft_gmail_id: gmailDraftId
  });
}

function logRun(targeted, created, errors, errorDetail, processed) {
  return supabaseRequest('POST', 'outreach_runs', {
    run_date: new Date().toISOString().slice(0, 10),
    schools_targeted: targeted,
    drafts_created: created,
    errors: errors,
    error_detail: errorDetail,
    schools_processed: processed
  });
}

// ============ EMAIL BUILDERS ============
function buildSalutation(principalName) {
  if (!principalName) return 'Dear Principal';
  if (principalName.indexOf('Dr.') >= 0) {
    const parts = principalName.split(' ');
    return 'Dear Dr. ' + parts[parts.length - 1];
  }
  const parts = principalName.split(' ');
  return 'Dear Principal ' + parts[parts.length - 1];
}

function buildSubject(school) {
  let name = school.school_name;
  if (name.indexOf('(PS ') >= 0) {
    const psPart = name.split('(')[1].split(')')[0];
    return 'HudsonSeed | Vendor V00108320 | K-12 Yoga & Mindfulness for ' + psPart;
  }
  if (name.length > 35) name = name.substring(0, 32) + '...';
  return 'HudsonSeed | Vendor V00108320 | K-12 Yoga & Mindfulness for ' + name;
}

function buildBody(school) {
  const salutation = buildSalutation(school.principal_name);
  const schoolName = school.school_name;
  const grade = school.grade_level || 'K-12';
  const enrollment = school.enrollment;
  
  let enrollmentClause = '';
  if (enrollment && enrollment > 800) {
    enrollmentClause = ' With over ' + enrollment + ' students across ' + grade + ', we believe a measured rollout could meaningfully support your teachers and students.';
  }

  return salutation + ',\n\n' +
    "I'm Trevor Vaughan, founder of HudsonSeed and a 500-hour Registered Yoga Teacher with the RCYT (Registered Children's Yoga Teacher) credential through Yoga Alliance. I'm reaching out because " + schoolName + " is part of our Jersey City beta cohort, and HudsonSeed is already an approved JCPS vendor — Vendor Code V00108320 — meaning we can begin programming with zero procurement friction.\n\n" +
    "HudsonSeed delivers evidence-based yoga and mindfulness programming for K-12 students. Our work directly supports nervous system regulation, attention, and emotional resilience — outcomes that translate to fewer classroom disruptions and stronger student readiness to learn. We currently run live programs across Hoboken, Jersey City, and Union City, and we are expanding our Jersey City footprint this spring.\n\n" +
    "I'd like to offer your school a 30-minute introductory conversation to explore whether HudsonSeed would be a fit for " + schoolName + "." + enrollmentClause + " No obligation, no pitch deck — just a real conversation about what your " + grade + " students need and how we can support your teachers.\n\n" +
    "Would you be open to a brief call this week or next? I'm happy to work around your schedule.\n\n" +
    "Warm regards,\n\n" +
    "Trevor Vaughan\n" +
    "Founder, HudsonSeed\n" +
    "trevorvaughan@hudsonseed.com\n" +
    "500HR ERYT+RCYT | JCPS Vendor V00108320";
}

// ============ GMAIL DRAFT CREATION ============
function createGmailDraft(school) {
  const subject = buildSubject(school);
  const body = buildBody(school);
  
  const draft = GmailApp.createDraft(
    school.principal_email,
    subject,
    body,
    {
      from: SENDER_EMAIL,
      name: SENDER_NAME
    }
  );
  return draft.getId();
}

// ============ MAIN ENTRY POINTS ============

/**
 * MAIN PRODUCTION FUNCTION — called by Time Trigger
 * Pulls BATCH_SIZE pending schools, drafts each, logs.
 */
function runDailyOutreach() {
  Logger.log('[' + new Date().toISOString() + '] runDailyOutreach starting');
  
  const schools = getPendingSchools(BATCH_SIZE);
  Logger.log('Found ' + schools.length + ' pending schools');
  
  if (schools.length === 0) {
    logRun(0, 0, 0, 'No pending schools', []);
    Logger.log('No pending schools. Outreach complete.');
    return 'No pending schools';
  }
  
  let created = 0;
  let errors = 0;
  const errorMessages = [];
  const processed = [];
  
  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    try {
      const draftId = createGmailDraft(school);
      markSchoolDrafted(school.id, draftId);
      created++;
      processed.push({
        school_id: school.id,
        school_name: school.school_name,
        principal_email: school.principal_email,
        draft_id: draftId,
        status: 'success'
      });
      Logger.log('  ✓ Drafted: ' + school.school_name);
    } catch (e) {
      errors++;
      errorMessages.push(school.school_name + ': ' + e.toString());
      processed.push({
        school_id: school.id,
        school_name: school.school_name,
        status: 'error',
        error: e.toString()
      });
      Logger.log('  ✗ ERROR: ' + school.school_name + ' - ' + e.toString());
    }
  }
  
  logRun(
    schools.length,
    created,
    errors,
    errorMessages.length > 0 ? errorMessages.join('; ') : null,
    processed
  );
  
  const summary = 'Drafted ' + created + ' emails, ' + errors + ' errors';
  Logger.log('[DONE] ' + summary);
  return summary;
}

/**
 * TEST FUNCTION — run this FIRST to trigger OAuth authorization.
 * Just queries Supabase, doesn't create any drafts.
 */
function testRun() {
  Logger.log('Test run: checking Supabase connection...');
  const schools = getPendingSchools(1);
  Logger.log('Connection OK. Found ' + schools.length + ' pending schools.');
  if (schools.length > 0) {
    Logger.log('First pending: ' + schools[0].school_name + ' → ' + schools[0].principal_email);
  }
  return 'Test passed. ' + schools.length + ' pending schools found.';
}

/**
 * DRY RUN — preview what would be drafted without actually drafting.
 */
function dryRun() {
  const schools = getPendingSchools(BATCH_SIZE);
  Logger.log('Would draft ' + schools.length + ' emails:');
  for (let i = 0; i < schools.length; i++) {
    const s = schools[i];
    Logger.log('  → ' + s.school_name + ' (' + s.principal_email + ')');
    Logger.log('     Subject: ' + buildSubject(s));
  }
  return 'Dry run complete. ' + schools.length + ' schools queued.';
}

/**
 * STATUS CHECK — see current outreach pipeline state.
 */
function pipelineStatus() {
  const all = supabaseRequest('GET', 'jc_schools_contacts?select=draft_status');
  const counts = {};
  for (let i = 0; i < all.length; i++) {
    const status = all[i].draft_status || 'unknown';
    counts[status] = (counts[status] || 0) + 1;
  }
  Logger.log('Pipeline status: ' + JSON.stringify(counts));
  return counts;
}
