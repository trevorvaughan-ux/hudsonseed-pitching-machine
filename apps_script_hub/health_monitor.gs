/**
 * HUDSONSEED PITCH MACHINE | Health Monitor + Daily Digest
 * Last updated: 2026-06-11 (June 11, 2026)
 *
 * Two jobs:
 *  1. heartbeat()    every 4h  - pings Supabase, logs to agent_runs, emails ONLY on failure
 *  2. dailyDigest()  5pm daily - one email: drafts staged, replies in last 24h, system pulse
 *
 * SETUP (one time, ~3 minutes):
 *  1. script.google.com -> New project -> name it "HS Monitor" -> paste this file
 *  2. Project Settings (gear) -> Script Properties -> add:
 *       SUPABASE_URL              = (from vault)
 *       SUPABASE_SERVICE_ROLE_KEY = (from vault)
 *       ALERT_EMAIL               = trevorvaughan@hudsonseed.com
 *  3. Run createTriggers() once (grant permissions when asked), then testRun().
 *  Done. Silent on success, loud on failure, digest at 5pm.
 */

const PROPS = PropertiesService.getScriptProperties();

function cfg_(key) {
  const v = PROPS.getProperty(key);
  if (!v) throw new Error('Missing Script Property: ' + key);
  return v;
}

/* ---------- JOB 1: HEARTBEAT (silent unless broken) ---------- */

function heartbeat() {
  const results = [];
  try {
    const resp = UrlFetchApp.fetch(cfg_('SUPABASE_URL') + '/rest/v1/agent_runs?select=id&limit=1', {
      method: 'get',
      headers: supaHeaders_(),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 300) {
      results.push('Supabase read FAILED: HTTP ' + resp.getResponseCode() + ' ' + resp.getContentText().slice(0, 200));
    }
  } catch (e) {
    results.push('Supabase unreachable: ' + e.message);
  }

  // Log the heartbeat (write attempt is itself part of the check)
  try {
    const resp = UrlFetchApp.fetch(cfg_('SUPABASE_URL') + '/rest/v1/agent_runs', {
      method: 'post',
      headers: supaHeaders_(),
      contentType: 'application/json',
      payload: JSON.stringify({ agent: 'hs_monitor', status: results.length ? 'fail' : 'ok', detail: results.join(' | ').slice(0, 500) }),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() >= 300) {
      results.push('agent_runs write FAILED: HTTP ' + resp.getResponseCode());
    }
  } catch (e) {
    results.push('agent_runs write unreachable: ' + e.message);
  }

  if (results.length) {
    MailApp.sendEmail(cfg_('ALERT_EMAIL'),
      'PITCH MACHINE ALERT: monitor detected a failure',
      'Heartbeat at ' + new Date().toString() + ' found problems:\n\n- ' + results.join('\n- ') +
      '\n\nMachine may still be running; this is the monitor speaking, not the machine.');
  }
}

/* ---------- JOB 2: DAILY DIGEST (the visibility layer) ---------- */

function dailyDigest() {
  const lines = [];
  const now = new Date();

  // Drafts currently staged
  try {
    const drafts = GmailApp.getDrafts();
    const outreach = drafts.filter(function (d) {
      const to = (d.getMessage().getTo() || '').toLowerCase();
      return to.indexOf('jcboe.org') > -1 || to.indexOf('schools.nyc.gov') > -1 ||
             to.indexOf('supportiveschools.org') > -1 || to.indexOf('school') > -1;
    });
    lines.push('DRAFTS STAGED: ' + outreach.length + ' outreach (' + drafts.length + ' total)');
  } catch (e) { lines.push('DRAFTS: check failed - ' + e.message); }

  // Replies from schools in last 24h
  try {
    const q = 'in:inbox newer_than:1d (from:jcboe.org OR from:schools.nyc.gov OR from:supportiveschools.org)';
    const threads = GmailApp.search(q, 0, 20);
    lines.push('SCHOOL REPLIES (24h): ' + threads.length);
    threads.forEach(function (t) {
      lines.push('  - ' + t.getFirstMessageSubject().slice(0, 70) + ' (' + t.getMessages()[t.getMessageCount() - 1].getFrom() + ')');
    });
  } catch (e) { lines.push('REPLIES: check failed - ' + e.message); }

  // Bounces in last 24h
  try {
    const bounces = GmailApp.search('in:inbox newer_than:1d from:mailer-daemon', 0, 10);
    lines.push('BOUNCES (24h): ' + bounces.length + (bounces.length ? '  <- check addresses' : ''));
  } catch (e) { lines.push('BOUNCES: check failed - ' + e.message); }

  // Supabase pulse
  try {
    const resp = UrlFetchApp.fetch(cfg_('SUPABASE_URL') + '/rest/v1/agent_runs?select=status&order=created_at.desc&limit=6', {
      headers: supaHeaders_(), muteHttpExceptions: true
    });
    if (resp.getResponseCode() < 300) {
      const rows = JSON.parse(resp.getContentText());
      const fails = rows.filter(function (r) { return r.status !== 'ok'; }).length;
      lines.push('SYSTEM PULSE: last ' + rows.length + ' heartbeats, ' + fails + ' failures');
    } else {
      lines.push('SYSTEM PULSE: Supabase HTTP ' + resp.getResponseCode());
    }
  } catch (e) { lines.push('SYSTEM PULSE: unreachable - ' + e.message); }

  MailApp.sendEmail(cfg_('ALERT_EMAIL'),
    'Pitch Machine Daily: ' + Utilities.formatDate(now, 'America/New_York', 'EEE MMM d'),
    lines.join('\n') + '\n\n(Sent by HS Monitor. Silent heartbeats run every 4h.)');
}

/* ---------- SETUP ---------- */

function supaHeaders_() {
  return {
    apikey: cfg_('SUPABASE_SERVICE_ROLE_KEY'),
    Authorization: 'Bearer ' + cfg_('SUPABASE_SERVICE_ROLE_KEY')
  };
}

function createTriggers() {
  // wipe old triggers for these handlers, then recreate (idempotent)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['heartbeat', 'dailyDigest'].indexOf(t.getHandlerFunction()) > -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('heartbeat').timeBased().everyHours(4).create();
  ScriptApp.newTrigger('dailyDigest').timeBased().atHour(17).everyDays(1).inTimezone('America/New_York').create();
  Logger.log('Triggers created: heartbeat every 4h, dailyDigest 5pm ET');
}

function testRun() {
  heartbeat();
  dailyDigest();
  Logger.log('Test complete. Check ' + cfg_('ALERT_EMAIL') + ' for the digest (and an alert only if something is broken).');
}
