/**
 * HudsonSeed ANALYST — Daily Brief Agent
 * ======================================
 * Runs daily at 8:00 AM ET
 * Queries Supabase for outreach metrics
 * Creates dated Google Doc summary
 * Logs execution to Supabase agent_runs table
 *
 * Owner: Trevor Vaughan / trevorvaughan@hudsonseed.com
 * Built: May 21, 2026 by Claude
 *
 * SETUP:
 * 1. Paste this into script.google.com → New Project
 * 2. Project Settings → Script Properties → add SUPABASE_KEY
 * 3. Create a folder in Google Drive called "Daily-Briefs" (note the exact name)
 * 4. Run testAnalyst() once to authorize
 * 5. Add Trigger: runAnalyst, Time-driven, Daily, 8:00 AM - 9:00 AM ET
 */

const SUPABASE_URL = 'https://pebhikfbpgntedvbxqph.supabase.co';
const BRIEF_FOLDER_NAME = 'Daily-Briefs';
const BRIEF_PARENT_FOLDER = 'HudsonSeed-Ops'; // Parent folder in Drive

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
  return true; // Default to ON if not configured
}

// ============ METRIC QUERIES ============
function getOutreachMetrics() {
  const resp = supabaseRequest('GET', '/jc_schools_contacts?select=engagement_rating,draft_status,last_contact_date', null);
  if (resp.status !== 200) {
    return { error: 'Failed to query jc_schools_contacts' };
  }
  const contacts = resp.data || [];
  
  const metrics = {
    total_contacts: contacts.length,
    pending_drafts: contacts.filter(c => c.draft_status === 'pending').length,
    drafted: contacts.filter(c => c.draft_status === 'drafted').length,
    hot_leads: contacts.filter(c => c.engagement_rating === 9).length,
    warm_leads: contacts.filter(c => c.engagement_rating && c.engagement_rating >= 7 && c.engagement_rating <= 8).length,
    no_response: contacts.filter(c => !c.engagement_rating).length,
    contacted_this_week: contacts.filter(c => {
      if (!c.last_contact_date) return false;
      const days = (new Date() - new Date(c.last_contact_date)) / (1000 * 60 * 60 * 24);
      return days <= 7;
    }).length
  };
  return metrics;
}

function getRecentRuns(days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  
  const resp = supabaseRequest('GET', `/outreach_runs?run_date=gte.${cutoffStr}&select=run_date,drafts_created,errors&order=run_date.desc`, null);
  if (resp.status !== 200) {
    return { error: 'Failed to query outreach_runs' };
  }
  const runs = resp.data || [];
  return {
    total_runs: runs.length,
    total_drafts: runs.reduce((sum, r) => sum + (r.drafts_created || 0), 0),
    total_errors: runs.reduce((sum, r) => sum + (r.errors || 0), 0)
  };
}

// ============ DOCUMENT GENERATION ============
function findOrCreateBriefFolder() {
  const drive = DriveApp;
  
  // Find parent folder
  let parentFolder = null;
  const parentFolders = drive.getFoldersByName(BRIEF_PARENT_FOLDER);
  if (parentFolders.hasNext()) {
    parentFolder = parentFolders.next();
  } else {
    parentFolder = drive.createFolder(BRIEF_PARENT_FOLDER);
  }
  
  // Find or create briefs subfolder
  let briefFolder = null;
  const subFolders = parentFolder.getFoldersByName(BRIEF_FOLDER_NAME);
  if (subFolders.hasNext()) {
    briefFolder = subFolders.next();
  } else {
    briefFolder = parentFolder.createFolder(BRIEF_FOLDER_NAME);
  }
  
  return briefFolder;
}

function createDailyBrief(metrics, runs) {
  const today = new Date();
  const dateStr = Utilities.formatDate(today, 'America/New_York', 'yyyy-MM-dd');
  const docName = `HudsonSeed Daily Brief — ${dateStr}`;
  
  const briefFolder = findOrCreateBriefFolder();
  const doc = DocumentApp.create(docName);
  doc.moveTo(briefFolder);
  
  const body = doc.getBody();
  
  // Title
  const title = body.appendParagraph(docName);
  title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  title.setBold(true);
  
  // Timestamp
  body.appendParagraph(`Generated: ${Utilities.formatDate(today, 'America/New_York', 'yyyy-MM-dd HH:mm:ss')} ET`);
  body.appendParagraph('');
  
  // Outreach Status
  body.appendParagraph('OUTREACH STATUS').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(`Total Contacts: ${metrics.total_contacts}`);
  body.appendParagraph(`Pending Drafts: ${metrics.pending_drafts}`);
  body.appendParagraph(`Already Drafted: ${metrics.drafted}`);
  body.appendParagraph(`Hot Leads (9): ${metrics.hot_leads}`);
  body.appendParagraph(`Warm Leads (7-8): ${metrics.warm_leads}`);
  body.appendParagraph(`No Response Yet: ${metrics.no_response}`);
  body.appendParagraph(`Contacted This Week: ${metrics.contacted_this_week}`);
  body.appendParagraph('');
  
  // Recent Activity
  body.appendParagraph('RECENT ACTIVITY (7 DAYS)').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(`Outreach Runs: ${runs.total_runs}`);
  body.appendParagraph(`Drafts Created: ${runs.total_drafts}`);
  body.appendParagraph(`Errors: ${runs.total_errors}`);
  body.appendParagraph('');
  
  // Next Steps
  body.appendParagraph('NEXT STEPS').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  if (metrics.hot_leads > 0) {
    body.appendParagraph(`• Follow up with ${metrics.hot_leads} hot lead(s) immediately`);
  }
  if (metrics.warm_leads > 0) {
    body.appendParagraph(`• Schedule calls with ${metrics.warm_leads} warm lead(s)`);
  }
  body.appendParagraph(`• Review pending drafts in Gmail (${metrics.pending_drafts})`);
  body.appendParagraph('');
  
  // Footer
  body.appendParagraph('Generated by Claude | HudsonSeed Pitching Machine');
  body.appendParagraph('Autonomous Daily Agent');
  
  doc.saveAndClose();
  return doc.getUrl();
}

// ============ LOGGING ============
function logAnalystRun(docUrl, error = null) {
  const payload = {
    timestamp: new Date().toISOString(),
    service: 'ANALYST',
    status: error ? 'FAILED' : 'SUCCESS',
    message: error || 'Daily brief created',
    doc_url: docUrl
  };
  
  const resp = supabaseRequest('POST', '/agent_runs', payload);
  return resp.status === 200 || resp.status === 201;
}

// ============ MAIN FUNCTIONS ============
function runAnalyst() {
  if (!isAutonomousMode()) {
    Logger.log('ANALYST: Autonomous mode OFF, skipping run');
    return;
  }
  
  try {
    const metrics = getOutreachMetrics();
    if (metrics.error) {
      logAnalystRun(null, metrics.error);
      Logger.log('ANALYST ERROR: ' + metrics.error);
      return;
    }
    
    const runs = getRecentRuns(7);
    if (runs.error) {
      logAnalystRun(null, runs.error);
      Logger.log('ANALYST ERROR: ' + runs.error);
      return;
    }
    
    const docUrl = createDailyBrief(metrics, runs);
    logAnalystRun(docUrl);
    Logger.log('ANALYST SUCCESS: Brief created at ' + docUrl);
  } catch (e) {
    logAnalystRun(null, e.toString());
    Logger.log('ANALYST EXCEPTION: ' + e.toString());
  }
}

function testAnalyst() {
  Logger.log('=== ANALYST TEST RUN ===');
  Logger.log('Testing Supabase connection...');
  
  const metrics = getOutreachMetrics();
  if (metrics.error) {
    Logger.log('ERROR: ' + metrics.error);
    return;
  }
  Logger.log('Metrics retrieved: ' + JSON.stringify(metrics));
  
  const runs = getRecentRuns(7);
  if (runs.error) {
    Logger.log('ERROR: ' + runs.error);
    return;
  }
  Logger.log('Runs retrieved: ' + JSON.stringify(runs));
  
  Logger.log('Creating test brief...');
  const docUrl = createDailyBrief(metrics, runs);
  Logger.log('TEST SUCCESS: Brief created at ' + docUrl);
  
  Logger.log('Logging to agent_runs...');
  logAnalystRun(docUrl);
  Logger.log('TEST COMPLETE');
}
