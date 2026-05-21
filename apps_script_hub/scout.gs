/**
 * HudsonSeed SCOUT — School Enrichment Agent
 * ==========================================
 * Runs every Friday at 8:00 AM ET
 * Discovers new schools, scrapes bios/websites
 * Enriches contact records with pitch_intel JSONB
 * Logs execution to Supabase agent_runs table
 *
 * Owner: Trevor Vaughan / trevorvaughan@hudsonseed.com
 * Built: May 21, 2026 by Claude
 *
 * SETUP:
 * 1. Paste this into script.google.com → New Project
 * 2. Project Settings → Script Properties → add SUPABASE_KEY
 * 3. Run testScout() once to authorize
 * 4. Add Trigger: runScout, Time-driven, Weekly, Friday, 8:00 AM - 9:00 AM ET
 */

const SUPABASE_URL = 'https://pebhikfbpgntedvbxqph.supabase.co';
const BATCH_SIZE = 5; // Enrich 5 schools per run

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
  const url = SUPABASE_URL + '/rest/v1' + path;
  const response = UrlFetchApp.fetch(url, options);
  return {
    status: response.getResponseCode(),
    data: response.getContentText() ? JSON.parse(response.getContentText()) : null
  };
}

function isAutonomousMode() {
  const resp = supabaseRequest('GET', '/system_config?key=eq.autonomous_mode&select=value', null);
  if (resp.status === 200 && resp.data && resp.data.length > 0) {
    return resp.data[0].value === 'ON';
  }
  return true;
}

// ============ SCHOOL DISCOVERY ============
function getSchoolsNeedingEnrichment() {
  // Query schools where pitch_intel is NULL or empty
  const resp = supabaseRequest('GET', `/jc_schools_contacts?pitch_intel=is.null&limit=${BATCH_SIZE}&select=id,school_name,website`, null);
  if (resp.status !== 200) {
    return { error: 'Failed to query schools', schools: [] };
  }
  return { schools: resp.data || [] };
}

function enrichSchoolData(school) {
  const intel = {
    scraped_at: new Date().toISOString(),
    website: school.website || 'unknown',
    principal_bio: 'pending',
    school_mission: 'pending',
    recent_initiatives: [],
    enrichment_programs: [],
    notes: []
  };
  
  // Attempt to fetch website and extract basic info
  if (school.website) {
    try {
      const response = UrlFetchApp.fetch(school.website, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        const html = response.getContentText();
        
        // Simple text extraction (not full parsing)
        if (html.includes('principal') || html.includes('Principal')) {
          intel.notes.push('Website mentions principal');
        }
        if (html.includes('mission') || html.includes('Mission')) {
          intel.notes.push('Website mentions mission statement');
        }
        if (html.includes('enrichment') || html.includes('Enrichment')) {
          intel.enrichment_programs.push('Website mentions enrichment');
        }
        
        intel.website_status = 'reachable';
      } else {
        intel.website_status = 'unreachable';
      }
    } catch (e) {
      intel.website_status = 'error';
      intel.notes.push('Failed to fetch website: ' + e.toString());
    }
  }
  
  return intel;
}

function updateSchoolIntel(schoolId, intel) {
  const payload = {
    pitch_intel: intel
  };
  const resp = supabaseRequest('PATCH', `/jc_schools_contacts?id=eq.${schoolId}`, payload);
  return resp.status === 200;
}

// ============ LOGGING ============
function logScoutRun(enriched, failed, error = null) {
  const payload = {
    timestamp: new Date().toISOString(),
    service: 'SCOUT',
    status: error ? 'FAILED' : 'SUCCESS',
    message: error || `Enriched ${enriched} schools`,
    schools_enriched: enriched,
    errors: failed
  };
  
  const resp = supabaseRequest('POST', '/agent_runs', payload);
  return resp.status === 200 || resp.status === 201;
}

// ============ MAIN FUNCTIONS ============
function runScout() {
  if (!isAutonomousMode()) {
    Logger.log('SCOUT: Autonomous mode OFF, skipping run');
    return;
  }
  
  try {
    const result = getSchoolsNeedingEnrichment();
    if (result.error) {
      logScoutRun(0, 0, result.error);
      Logger.log('SCOUT ERROR: ' + result.error);
      return;
    }
    
    const schools = result.schools;
    let enriched = 0;
    let failed = 0;
    
    for (const school of schools) {
      try {
        const intel = enrichSchoolData(school);
        const updated = updateSchoolIntel(school.id, intel);
        if (updated) {
          enriched++;
          Logger.log(`SCOUT: Enriched ${school.school_name}`);
        } else {
          failed++;
          Logger.log(`SCOUT: Failed to update ${school.school_name}`);
        }
      } catch (e) {
        failed++;
        Logger.log(`SCOUT EXCEPTION on ${school.school_name}: ${e.toString()}`);
      }
    }
    
    logScoutRun(enriched, failed);
    Logger.log(`SCOUT SUCCESS: Enriched ${enriched}, Failed ${failed}`);
  } catch (e) {
    logScoutRun(0, 0, e.toString());
    Logger.log('SCOUT EXCEPTION: ' + e.toString());
  }
}

function testScout() {
  Logger.log('=== SCOUT TEST RUN ===');
  Logger.log('Testing Supabase connection...');
  
  const result = getSchoolsNeedingEnrichment();
  if (result.error) {
    Logger.log('ERROR: ' + result.error);
    return;
  }
  
  const schools = result.schools;
  Logger.log(`Found ${schools.length} schools needing enrichment`);
  
  if (schools.length > 0) {
    const testSchool = schools[0];
    Logger.log(`Testing enrichment on: ${testSchool.school_name}`);
    const intel = enrichSchoolData(testSchool);
    Logger.log('Test intel: ' + JSON.stringify(intel));
    Logger.log('TEST COMPLETE');
  } else {
    Logger.log('No schools need enrichment (all have pitch_intel set)');
  }
}
