/**
 * HudsonSeed Pitch Machine - Daily Outreach Agent
 * Version: 1.4 - Production Ready
 * Using your NEW full anon key
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = 'https://pebhikfbpgntedvbxqph.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlYmhpa2ZicGdudGVkdmJ4cXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDg2ODEsImV4cCI6MjA5MjM4NDY4MX0.h2-mXnf8WAt3canjhSwDjQVgAhpThhTZl9IvEee_DK4';

// Email configuration
const SENDER_EMAIL = 'trevorvaughan@hudsonseed.com';
const SENDER_NAME = 'Trevor Vaughan';

// Safety limits
const BATCH_LIMIT = 7;
const IS_DRY_RUN = false;   // ← Change to false when you want real drafts

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function runDailyOutreach() {
  const startTime = new Date();
  
  if (!isAutonomousMode()) {
    Logger.log('❌ AUTONOMOUS MODE OFF - Exiting');
    return;
  }
  
  Logger.log('🚀 Starting daily outreach run...');
  Logger.log(`📅 Timestamp: ${startTime.toISOString()}`);
  Logger.log(`🧪 Dry run mode: ${IS_DRY_RUN}`);
  
  try {
    const schools = fetchPendingSchools();
    
    if (!schools || schools.length === 0) {
      Logger.log('✅ No pending schools found. Nothing to do.');
      return;
    }
    
    Logger.log(`📋 Found ${schools.length} pending schools`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const school of schools) {
      try {
        if (validateSchool(school)) {
          const draft = createEmailDraft(school);
          
          if (IS_DRY_RUN) {
            Logger.log(`🧪 [DRY RUN] Would create draft for: ${school.contact_name} at ${school.school_name}`);
            successCount++;
          } else {
            saveDraftToGmail(draft);
            markSchoolDrafted(school.id);
            Logger.log(`✅ Draft created: ${school.contact_name} at ${school.school_name}`);
            successCount++;
          }
        }
      } catch (error) {
        Logger.log(`❌ Failed to process ${school.school_name}: ${error.message}`);
        markSchoolFailed(school.id, error.message);
        failCount++;
      }
    }
    
    if (IS_DRY_RUN) {
      Logger.log(`🧪 DRY RUN COMPLETE — ${successCount} schools previewed`);
    } else {
      Logger.log(`✅ Outreach run complete — Success: ${successCount} | Failed: ${failCount}`);
    }
    
  } catch (error) {
    Logger.log(`❌ FATAL ERROR: ${error.message}`);
    Logger.log(error.stack);
  }
}

// ============================================================================
// SUPABASE OPERATIONS
// ============================================================================

function fetchPendingSchools() {
  const query = `draft_status=eq.pending&limit=${BATCH_LIMIT}`;
  const url = `${SUPABASE_URL}/rest/v1/jc_schools_contacts?${query}&order=school_name.asc`;
  const response = supabaseFetch(url, 'GET');
  if (!response) throw new Error('Failed to fetch pending schools');
  return JSON.parse(response.getContentText());
}

function markSchoolDrafted(schoolId) {
  if (IS_DRY_RUN) return;
  const url = `${SUPABASE_URL}/rest/v1/jc_schools_contacts?id=eq.${schoolId}`;
  supabaseFetch(url, 'PATCH', { draft_status: 'drafted', last_contact_date: new Date().toISOString() });
}

function markSchoolFailed(schoolId, errorMessage) {
  if (IS_DRY_RUN) return;
  const url = `${SUPABASE_URL}/rest/v1/jc_schools_contacts?id=eq.${schoolId}`;
  supabaseFetch(url, 'PATCH', { draft_status: 'failed', notes: `Error: ${errorMessage}` });
}

function isAutonomousMode() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/system_config?select=value&key=eq.autonomous_mode`;
    const response = supabaseFetch(url, 'GET');
    const data = JSON.parse(response.getContentText());
    return data && data.length > 0 ? data[0].value === 'ON' : true;
  } catch (e) {
    return true;
  }
}

function supabaseFetch(url, method, payload = null) {
  const options = {
    method: method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    muteHttpExceptions: true
  };
  if (payload) options.payload = JSON.stringify(payload);
  
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
    return response;
  }
  throw new Error(`Supabase error ${response.getResponseCode()}: ${response.getContentText()}`);
}

// ============================================================================
// EMAIL GENERATION
// ============================================================================

function validateSchool(school) {
  return !!(school.contact_email && school.contact_name && school.school_name && school.draft_status === 'pending');
}

function getCleanSalutation(rawName) {
  if (!rawName) return "Principal";
  let clean = rawName.trim();
  if (clean.toLowerCase().startsWith('dr.') || clean.toLowerCase().startsWith('mr.') || clean.toLowerCase().startsWith('ms.')) return clean;
  const parts = clean.split(/\s+/);
  return parts.length > 1 ? `Principal ${parts[parts.length - 1]}` : `Principal ${clean}`;
}

function createEmailDraft(school) {
  const isElementary = school.school_name.toUpperCase().includes('(PS ') || school.school_name.toUpperCase().includes('ELEMENTARY');
  const subjectPrefix = isElementary ? '[Vendor ID: V00108320] ' : '';
  const subject = `${subjectPrefix}Partnership Opportunity: Mindfulness Programming at ${school.school_name}`;
  
  const salutation = getCleanSalutation(school.contact_name);
  
  let scaleContextClause = "Our programs are specifically designed to support social-emotional learning and help students develop focus, self-regulation, and resilience.";
  if (school.student_count && school.student_count > 800) {
    scaleContextClause = `With your campus scaling past ${school.student_count} students, our structures are specialized to integrate system-wide.`;
  }

  const body = `Dear ${salutation},

I hope this message finds you well. My name is Trevor Vaughan, and I'm the founder of HudsonSeed, a K-12 mindfulness and yoga education organization.

We currently serve eight schools across Hudson County, including PS 28, Waldo School, and Step by Step Preschool. ${scaleContextClause}

I'd love to explore how HudsonSeed might support ${school.school_name}'s students and staff.

Would you be open to a brief conversation in the coming weeks?

Thank you for your time.

Warm regards,

Trevor Vaughan
Founder & Director, HudsonSeed
trevorvaughan@hudsonseed.com
862-371-4966
www.hudsonseed.com`;

  return { to: school.contact_email, subject: subject, body: body };
}

function saveDraftToGmail(draft) {
  GmailApp.createDraft(draft.to, draft.subject, draft.body, {
    from: SENDER_EMAIL,
    name: SENDER_NAME
  });
}

// ============================================================================
// TRIGGER SETUP
// ============================================================================

/**
 * Install time-based triggers for Tue/Wed/Thu 10:00 AM ET
 * Run this function ONCE manually to set up automation
 */
function setupDailyTrigger() {
  // Delete existing triggers first
  const existingTriggers = ScriptApp.getProjectTriggers();
  existingTriggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runDailyOutreach') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create Tuesday trigger
  ScriptApp.newTrigger('runDailyOutreach')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY)
    .atHour(10)
    .nearMinute(0)
    .inTimezone('America/New_York')
    .create();
  
  // Create Wednesday trigger
  ScriptApp.newTrigger('runDailyOutreach')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.WEDNESDAY)
    .atHour(10)
    .nearMinute(0)
    .inTimezone('America/New_York')
    .create();
  
  // Create Thursday trigger
  ScriptApp.newTrigger('runDailyOutreach')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.THURSDAY)
    .atHour(10)
    .nearMinute(0)
    .inTimezone('America/New_York')
    .create();
  
  Logger.log('✅ All 3 weekly triggers installed (Tue/Wed/Thu 10:00 AM ET)');
}
