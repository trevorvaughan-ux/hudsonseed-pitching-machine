/**
 * HudsonSeed COURIER — Daily Outreach (BULLETPROOF v2)
 * =====================================================
 * Pulls pending JC schools from Supabase, drafts Gmail emails.
 *
 * GUARDRAILS BUILT IN:
 *   1. Strict deduplication lock (draft_status check)
 *   2. Batched execution governor (BATCH_LIMIT)
 *   3. Deep try/catch error logging with row-level FAILED status
 *   4. Programmatic trigger installer (setupDailyTrigger)
 *   5. Dry run sandbox flag (IS_DRY_RUN)
 *   6. Autonomous mode kill-switch (system_config table)
 *
 * Schedule: Tue/Wed/Thu 10:00 AM ET
 * Built: May 20, 2026 by Claude | Hardened May 21, 2026
 */

// ============ CONFIG ============
const SUPABASE_URL = 'https://pebhikfbpgntedvbxqph.supabase.co';
const BATCH_LIMIT = 25;          // GOVERNOR: max emails per run (Google quota safety)
const BATCH_SIZE = 7;            // Target drafts per scheduled run
const SENDER_NAME = 'Trevor Vaughan';
const SENDER_EMAIL = 'trevorvaughan@hudsonseed.com';
const IS_DRY_RUN = true;         // SANDBOX FLAG: true = log only, false = create real drafts
                                 // ⚠️ Flip to false ONLY when ready for production sends

// ============ CREDENTIAL MGMT ============
function getSupabaseKey() {
  const key = PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY');
  if (!key) {
    throw new Error('SUPABASE_KEY not set. Go to Project Settings → Script Properties → add it.');
  }
  return key;
}

// ============ SUPABASE HELPERS (with retry wrapper per Grok review) ============
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;  // exponential: 1s, 2s, 4s

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

  let lastError = null;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();

      // Success
      if (code >= 200 && code < 300) {
        const text = response.getContentText();
        return text ? JSON.parse(text) : null;
      }

      // 4xx (except 429) = client error, don't retry — fail fast
      if (code >= 400 && code < 500 && code !== 429) {
        throw new Error('Supabase ' + method + ' ' + path + ' [' + code + '] ' + response.getContentText());
      }

      // 5xx or 429 = retryable
      lastError = new Error('Supabase ' + method + ' [' + code + '] attempt ' + attempt + '/' + RETRY_MAX_ATTEMPTS);
      Logger.log('⚠️ ' + lastError.message + ' — retrying...');

    } catch (fetchErr) {
      // Network timeout, DNS failure, etc — retryable
      lastError = fetchErr;
      Logger.log('⚠️ Supabase fetch threw on attempt ' + attempt + ': ' + fetchErr.toString());
    }

    // Backoff before next attempt (unless this was the last one)
    if (attempt < RETRY_MAX_ATTEMPTS) {
      Utilities.sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }

  // All attempts exhausted
  throw new Error('Supabase ' + method + ' ' + path + ' failed after ' + RETRY_MAX_ATTEMPTS + ' attempts: ' + lastError.toString());
}

// ============ KILL SWITCH ============
function isAutonomousMode() {
  try {
    const resp = supabaseRequest('GET', 'system_config?key=eq.autonomous_mode&select=value');
    if (resp && resp.length > 0) {
      return resp[0].value === 'ON';
    }
  } catch (e) {
    Logger.log('Could not check autonomous_mode, defaulting ON: ' + e.toString());
  }
  return true;
}

// ============ QUERIES (with strict dedup) ============
function getPendingSchools(limit) {
  // GUARDRAIL #1: Strict dedup — only pull schools where draft_status='pending'
  // AND principal_email exists. Skip anything already 'drafted' or 'failed'.
  const path = 'jc_schools_contacts'
    + '?draft_status=eq.pending'
    + '&principal_email=not.is.null'
    + '&principal_email=neq.'
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

function markSchoolFailed(schoolId, errorReason) {
  // GUARDRAIL #3: Row-level failure tracking — never crash the run
  const path = 'jc_schools_contacts?id=eq.' + schoolId;
  try {
    return supabaseRequest('PATCH', path, {
      draft_status: 'failed',
      draft_error: errorReason.substring(0, 500),
      draft_failed_at: new Date().toISOString()
    });
  } catch (e) {
    Logger.log('Could not mark school ' + schoolId + ' as failed: ' + e.toString());
  }
}

function logRun(targeted, created, failed, errorDetail, processed) {
  return supabaseRequest('POST', 'outreach_runs', {
    run_date: new Date().toISOString().slice(0, 10),
    schools_targeted: targeted,
    drafts_created: created,
    errors: failed,
    error_detail: errorDetail,
    schools_processed: processed,
    dry_run: IS_DRY_RUN
  });
}

// ============ DATA VALIDATION ============
function validateSchool(school) {
  // GUARDRAIL #3 (validation layer): catch corrupted rows before we burn Gmail quota
  const errors = [];
  if (!school.school_name || school.school_name.trim() === '') {
    errors.push('Missing school_name');
  }
  if (!school.principal_email || school.principal_email.trim() === '') {
    errors.push('Missing principal_email');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(school.principal_email.trim())) {
      errors.push('Invalid principal_email format: ' + school.principal_email);
    }
  }
  return errors;
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

  // GUARDRAIL #5: Dry run sandbox
  if (IS_DRY_RUN) {
    Logger.log('🧪 DRY RUN — would draft to: ' + school.principal_email);
    Logger.log('   Subject: ' + subject);
    Logger.log('   Body preview: ' + body.substring(0, 120) + '...');
    return 'DRY_RUN_' + school.id + '_' + Date.now();
  }

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

// ============ MAIN ENTRY POINT ============
function runDailyOutreach() {
  const runStart = new Date().toISOString();
  Logger.log('========================================');
  Logger.log('[' + runStart + '] runDailyOutreach starting');
  Logger.log('DRY_RUN mode: ' + IS_DRY_RUN);
  Logger.log('BATCH_LIMIT: ' + BATCH_LIMIT + ', BATCH_SIZE: ' + BATCH_SIZE);
  Logger.log('========================================');

  // KILL SWITCH check
  if (!isAutonomousMode()) {
    Logger.log('⏸️ Autonomous mode is OFF in system_config. Skipping run.');
    return 'Skipped: autonomous_mode=OFF';
  }

  // GUARDRAIL #2: Enforce governor — never exceed BATCH_LIMIT regardless of config
  const targetSize = Math.min(BATCH_SIZE, BATCH_LIMIT);

  let schools;
  try {
    schools = getPendingSchools(targetSize);
  } catch (e) {
    Logger.log('❌ FATAL: Could not query Supabase: ' + e.toString());
    try {
      logRun(0, 0, 1, 'Supabase query failed: ' + e.toString(), []);
    } catch (logErr) {
      Logger.log('Also could not log the failure: ' + logErr.toString());
    }
    return 'FATAL: ' + e.toString();
  }

  Logger.log('Found ' + schools.length + ' pending schools');

  if (schools.length === 0) {
    logRun(0, 0, 0, 'No pending schools', []);
    Logger.log('✅ No pending schools. Outreach complete.');
    return 'No pending schools';
  }

  let created = 0;
  let failed = 0;
  const errorMessages = [];
  const processed = [];

  // GUARDRAIL #3: Per-row try/catch, never crash whole run
  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];

    // Validate first
    const validationErrors = validateSchool(school);
    if (validationErrors.length > 0) {
      const reason = 'Validation failed: ' + validationErrors.join(', ');
      Logger.log('  ⚠️ SKIP: ' + (school.school_name || 'unknown') + ' — ' + reason);
      markSchoolFailed(school.id, reason);
      failed++;
      errorMessages.push((school.school_name || 'id:' + school.id) + ': ' + reason);
      processed.push({
        school_id: school.id,
        school_name: school.school_name,
        status: 'failed',
        error: reason
      });
      continue;
    }

    // Try to draft
    try {
      const draftId = createGmailDraft(school);
      if (!IS_DRY_RUN) {
        markSchoolDrafted(school.id, draftId);
      }
      created++;
      processed.push({
        school_id: school.id,
        school_name: school.school_name,
        principal_email: school.principal_email,
        draft_id: draftId,
        status: IS_DRY_RUN ? 'dry_run_success' : 'success'
      });
      Logger.log('  ✓ Drafted: ' + school.school_name);
    } catch (e) {
      failed++;
      const errMsg = e.toString();
      errorMessages.push(school.school_name + ': ' + errMsg);
      markSchoolFailed(school.id, errMsg);
      processed.push({
        school_id: school.id,
        school_name: school.school_name,
        status: 'error',
        error: errMsg
      });
      Logger.log('  ✗ ERROR: ' + school.school_name + ' — ' + errMsg);
    }
  }

  try {
    logRun(
      schools.length,
      created,
      failed,
      errorMessages.length > 0 ? errorMessages.join(' | ') : null,
      processed
    );
  } catch (e) {
    Logger.log('Could not write outreach_runs log: ' + e.toString());
  }

  const summary = 'Drafted ' + created + ' (' + (IS_DRY_RUN ? 'DRY RUN' : 'LIVE') + '), ' + failed + ' failed';

  // GROK GAP #3: explicit dry-run preview summary
  if (IS_DRY_RUN) {
    Logger.log('🧪 DRY RUN COMPLETE — ' + processed.length + ' schools previewed, ZERO drafts created in Gmail');
    Logger.log('🧪 To go live: change IS_DRY_RUN to false at the top of the script');
  }
  Logger.log('========================================');
  Logger.log('[DONE] ' + summary);
  Logger.log('========================================');
  return summary;
}

// ============ GUARDRAIL #4: AUTO TRIGGER INSTALLER ============
/**
 * Run this ONCE manually to programmatically install all three time triggers
 * (Tue/Wed/Thu 10 AM ET). No clicking through Google's UI required.
 */
function setupDailyTrigger() {
  // First, clean up any existing triggers for runDailyOutreach to prevent doubles
  const existing = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (let i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'runDailyOutreach') {
      ScriptApp.deleteTrigger(existing[i]);
      removed++;
    }
  }
  Logger.log('Removed ' + removed + ' existing runDailyOutreach triggers');

  // Install fresh triggers: Tue, Wed, Thu at 10 AM
  const days = [
    ScriptApp.WeekDay.TUESDAY,
    ScriptApp.WeekDay.WEDNESDAY,
    ScriptApp.WeekDay.THURSDAY
  ];

  for (let i = 0; i < days.length; i++) {
    ScriptApp.newTrigger('runDailyOutreach')
      .timeBased()
      .onWeekDay(days[i])
      .atHour(10)
      .inTimezone('America/New_York')
      .create();
    Logger.log('✓ Installed trigger for ' + days[i] + ' 10 AM ET');
  }

  Logger.log('✅ All 3 weekly triggers installed (Tue/Wed/Thu 10 AM ET)');
  return 'Triggers installed: Tue, Wed, Thu at 10 AM ET';
}

/**
 * View all currently installed triggers (debugging helper).
 */
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log('Found ' + triggers.length + ' triggers:');
  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i];
    Logger.log('  - ' + t.getHandlerFunction() + ' [' + t.getEventType() + ']');
  }
  return triggers.length;
}

/**
 * Emergency: delete ALL triggers in this project.
 */
function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  Logger.log('Deleted ' + triggers.length + ' triggers');
  return 'Deleted ' + triggers.length + ' triggers';
}

// ============ DIAGNOSTIC FUNCTIONS ============
function testRun() {
  Logger.log('Test run: checking Supabase connection...');
  Logger.log('IS_DRY_RUN: ' + IS_DRY_RUN);
  Logger.log('Autonomous mode: ' + isAutonomousMode());
  const schools = getPendingSchools(1);
  Logger.log('Connection OK. Found ' + schools.length + ' pending schools.');
  if (schools.length > 0) {
    Logger.log('First pending: ' + schools[0].school_name + ' → ' + schools[0].principal_email);
  }
  return 'Test passed. ' + schools.length + ' pending schools found.';
}

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
