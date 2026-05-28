/**
 * HUDSONSEED PITCHING MACHINE — Layer 2 + Layer 3 (CONTINUOUS, Gmail-based)
 *
 * Flow:
 *   Layer 1 (separate) drops drafts -> Trevor sends manually.
 *   School REPLIES -> lands in this inbox.
 *   Layer 2 (checkGmailReplies_): every 5 min scans inbox, matches sender -> sheet row,
 *     stamps reply time ONCE, flags Unsubscribed only on stop/remove/not-interested.
 *   Layer 3 (sendMaterials_): every 5 min sends deck + Meet ask to replied rows whose
 *     reply landed >= REPLY_DELAY_MINUTES ago and have not yet received materials.
 *
 * NO Supabase pull. NO Railway. Runs entirely on Google (Gmail + Sheet + Apps Script).
 * Source of truth = this Google Sheet.
 */

// ================== CONFIG ==================

const DECK_URL = 'https://docs.google.com/presentation/d/1C2jmTbzRwp6iGLjShwB7sVzB_iw2-6lRvTCHC2yIuQw/edit';
const CAMPAIGN_ALIAS = '';          // set to the campaign alias email once it exists; '' = send from primary
const REPLY_DELAY_MINUTES = 5;      // Layer 3 waits this long after a reply before sending materials
const REPLY_LOOKBACK_DAYS = 14;     // how far back to scan the inbox for replies

const COL = {
  SCHOOL_ID: 'School_ID',
  SCHOOL_NAME: 'School_Name',
  SCHOOL_TYPE: 'School_Type',
  DISTRICT: 'District',
  CONTACT_NAME: 'Contact_Name',
  CONTACT_TITLE: 'Contact_Title',
  CONTACT_EMAIL: 'Contact_Email',
  VENDOR_CODE: 'Vendor_Code',
  ENGAGEMENT_STATUS: 'Engagement_Status',
  PRIORITY: 'Priority',
  LAST_VALUE_TOUCH: 'Last_Value_Touch',
  LAST_VALUE_TOUCH_DATE: 'Last_Value_Touch_Date',
  CALL_SCHEDULED_DATE: 'Call_Scheduled_Date',
  CALL_MEET_LINK: 'Call_Meet_Link',
  MATERIALS_SENT: 'Materials_Sent',
  MATERIALS_SENT_DATE: 'Materials_Sent_Date',
  NEXT_ACTION: 'Next_Action',
  NOTES: 'Notes',
  LAST_UPDATED: 'Last_Updated',
  REPLY_SUMMARY: 'Reply_Summary',
  UNSUBSCRIBED_DATE: 'Unsubscribed_Date',
  VALUE_TRACK: 'Value_Track'
};

// Statuses that mean "this contact replied and is fair game for Layer 3"
const ENGAGED_STATES = ['replied', 'community', 'warm / future opportunity', 'priority'];

// ================== MENU ==================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🌱 HudsonSeed Machine (Layer 2 v2)')
    .addItem('▶️ Run Machine Now (respect 5-min delay)', 'runMachineOnce')
    .addItem('🧪 TEST: Scan Replies Now', 'checkGmailReplies')
    .addItem('🧪 TEST: Send Materials Now (ignore delay)', 'sendMaterialsIgnoreDelay')
    .addSeparator()
    .addItem('⏰ Install 5-min Auto Trigger', 'installMachineTrigger')
    .addItem('🛑 Remove Auto Trigger', 'removeMachineTrigger')
    .addItem('📊 Show Trigger Status', 'showTriggerStatus')
    .addSeparator()
    .addItem('🔥 Mark as PRIORITY (Sales Track)', 'markSelectedAsPriority')
    .addItem('💙 Mark as Warm (Sales Track)', 'markSelectedAsWarm')
    .addItem('🏠 Move to COMMUNITY / Value Bucket', 'moveSelectedToCommunityValueBlock')
    .addItem('🚫 Mark as UNSUBSCRIBED (Hard Stop)', 'markSelectedAsUnsubscribed')
    .addSeparator()
    .addItem('📝 Log Value Touch', 'logValueTouch')
    .addItem('📦 Log Materials Sent', 'logMaterialsSent')
    .addItem('❓ Show Status & Help', 'showMachineStatus')
    .addToUi();
}

// ================== CONTINUOUS ENGINE ==================

/** Time-trigger target. No UI (triggers cannot show alerts). */
function machineTick() {
  checkGmailReplies_();
  sendMaterials_(false);
}

/** Menu: run both layers once, respecting the 5-min delay, with a summary alert. */
function runMachineOnce() {
  const flagged = checkGmailReplies_();
  const sent = sendMaterials_(false);
  SpreadsheetApp.getUi().alert(
    '▶️ Machine run complete.\n\n' +
    'Replies detected/updated: ' + flagged + '\n' +
    'Materials sent (>= ' + REPLY_DELAY_MINUTES + ' min after reply): ' + sent
  );
}

/** Menu wrapper: scan replies only. */
function checkGmailReplies() {
  const n = checkGmailReplies_();
  SpreadsheetApp.getUi().alert('🧪 Reply scan complete.\nRows flagged/updated: ' + n);
}

/** Menu wrapper: send materials immediately, ignoring the delay (for testing). */
function sendMaterialsIgnoreDelay() {
  const n = sendMaterials_(true);
  SpreadsheetApp.getUi().alert('🧪 Materials sent (delay ignored): ' + n);
}

/**
 * LAYER 2: scan inbox, match replies to rows by sender email.
 * Stamps reply time ONCE (does not reset the 5-min clock on later scans).
 * Returns count of rows flagged/updated.
 */
function checkGmailReplies_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const emailCol = findColumnByHeader(sheet, COL.CONTACT_EMAIL);
  const statusCol = findColumnByHeader(sheet, COL.ENGAGEMENT_STATUS);
  const updatedCol = findColumnByHeader(sheet, COL.LAST_UPDATED);
  const summaryCol = findColumnByHeader(sheet, COL.REPLY_SUMMARY);
  const unsubCol = findColumnByHeader(sheet, COL.UNSUBSCRIBED_DATE);
  if (!emailCol || !statusCol) return 0;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  // email(lower) -> row, skipping unsubscribed rows
  const emailToRow = {};
  const emails = sheet.getRange(2, emailCol, lastRow - 1, 1).getValues();
  const statuses = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < emails.length; i++) {
    const em = String(emails[i][0] || '').toLowerCase().trim();
    const st = String(statuses[i][0] || '').trim().toLowerCase();
    if (em && st !== 'unsubscribed') emailToRow[em] = i + 2;
  }
  if (Object.keys(emailToRow).length === 0) return 0;

  const threads = GmailApp.search('in:inbox newer_than:' + REPLY_LOOKBACK_DAYS + 'd', 0, 100);
  const now = new Date();
  const UNSUB_RE = /\b(unsubscribe|remove me|opt out|stop sending|please stop|not interested|no thank|take me off)\b/i;
  let flagged = 0;

  threads.forEach(function (thread) {
    const msgs = thread.getMessages();
    const last = msgs[msgs.length - 1];
    const fromEmail = extractEmail_(last.getFrom()).toLowerCase().trim();
    const row = emailToRow[fromEmail];
    if (!row) return;

    const curStatus = String(sheet.getRange(row, statusCol).getValue() || '').trim().toLowerCase();
    if (curStatus === 'unsubscribed') return;

    const bodyText = last.getPlainBody() || '';
    const snippet = bodyText.slice(0, 300).replace(/\s+/g, ' ').trim();

    if (UNSUB_RE.test(bodyText)) {
      sheet.getRange(row, statusCol).setValue('Unsubscribed');
      if (unsubCol) sheet.getRange(row, unsubCol).setValue(now.toISOString().slice(0, 10));
      if (summaryCol) sheet.getRange(row, summaryCol).setValue('AUTO: unsubscribe detected — ' + snippet);
      flagged++;
      return;
    }

    // Only stamp the FIRST time we see a reply, so the 5-min clock is stable.
    if (ENGAGED_STATES.indexOf(curStatus) === -1) {
      sheet.getRange(row, statusCol).setValue('replied');
      if (updatedCol) sheet.getRange(row, updatedCol).setValue(now.toISOString());
      if (summaryCol) sheet.getRange(row, summaryCol).setValue('AUTO reply: ' + snippet);
      flagged++;
    }
  });

  return flagged;
}

/**
 * LAYER 3: send deck + Meet ask to replied rows.
 * Conditions: has email, status engaged (replied/community/warm/priority), NOT unsubscribed,
 *   Materials_Sent empty, and reply landed >= REPLY_DELAY_MINUTES ago (unless ignoreDelay).
 * Returns count sent.
 */
function sendMaterials_(ignoreDelay) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const emailCol = findColumnByHeader(sheet, COL.CONTACT_EMAIL);
  const nameCol = findColumnByHeader(sheet, COL.CONTACT_NAME);
  const titleCol = findColumnByHeader(sheet, COL.CONTACT_TITLE);
  const schoolCol = findColumnByHeader(sheet, COL.SCHOOL_NAME);
  const statusCol = findColumnByHeader(sheet, COL.ENGAGEMENT_STATUS);
  const updatedCol = findColumnByHeader(sheet, COL.LAST_UPDATED);
  const matCol = findColumnByHeader(sheet, COL.MATERIALS_SENT);
  const matDateCol = findColumnByHeader(sheet, COL.MATERIALS_SENT_DATE);
  const meetCol = findColumnByHeader(sheet, COL.CALL_MEET_LINK);
  if (!emailCol || !statusCol || !matCol) return 0;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const now = new Date();
  let sent = 0;

  for (let row = 2; row <= lastRow; row++) {
    const email = String(sheet.getRange(row, emailCol).getValue() || '').trim();
    const status = String(sheet.getRange(row, statusCol).getValue() || '').trim().toLowerCase();
    const already = String(sheet.getRange(row, matCol).getValue() || '').trim();

    if (!email) continue;
    if (status === 'unsubscribed') continue;
    if (ENGAGED_STATES.indexOf(status) === -1) continue; // must have replied
    if (already) continue;                                // already sent

    if (!ignoreDelay) {
      const t = parseDate_(updatedCol ? sheet.getRange(row, updatedCol).getValue() : '');
      if (!t) continue;
      if ((now - t) / 60000 < REPLY_DELAY_MINUTES) continue;
    }

    const name = nameCol ? String(sheet.getRange(row, nameCol).getValue() || '').trim() : '';
    const title = titleCol ? String(sheet.getRange(row, titleCol).getValue() || '').trim() : '';
    const school = schoolCol ? String(sheet.getRange(row, schoolCol).getValue() || '').trim() : '';
    const meet = meetCol ? String(sheet.getRange(row, meetCol).getValue() || '').trim() : '';

    if (sendMaterialsEmail_(email, name, title, school, meet)) {
      sheet.getRange(row, matCol).setValue('Auto-sent: deck + meet ask');
      if (matDateCol) sheet.getRange(row, matDateCol).setValue(now.toISOString());
      sent++;
    }
  }

  return sent;
}

/** Builds + sends the Layer 3 email. Replies in-thread when possible. */
function sendMaterialsEmail_(email, name, title, school, meetLink) {
  const greetName = name || 'there';
  const subject = 'Re: Vendor Code 9615 / K-12 Mindfulness Programming' + (school ? ' — ' + school : '');
  const meetLine = meetLink
    ? ('Here is our Google Meet link for the intro: ' + meetLink)
    : 'Just reply with the time that works best and I will send a Google Calendar invite with the Meet link attached.';

  const body =
    'Hi ' + greetName + ',\n\n' +
    'Thank you for getting back to me. Here is a quick overview of our K-12 yoga and mindfulness programming:\n\n' +
    DECK_URL + '\n\n' +
    meetLine + '\n\n' +
    'Looking forward to connecting.\n\n' +
    'Best,\nTrevor Vaughan\nFounder, HudsonSeed\ntrevorvaughan@hudsonseed.com';

  const opts = { name: 'Trevor Vaughan' };
  if (CAMPAIGN_ALIAS) opts.from = CAMPAIGN_ALIAS;

  try {
    const threads = GmailApp.search('from:' + email + ' newer_than:' + REPLY_LOOKBACK_DAYS + 'd', 0, 1);
    if (threads && threads.length > 0) {
      threads[0].reply(body, opts);
    } else {
      GmailApp.sendEmail(email, subject, body, opts);
    }
    return true;
  } catch (e) {
    Logger.log('Layer 3 send error to ' + email + ': ' + e);
    return false;
  }
}

// ================== TRIGGER MANAGEMENT ==================

function installMachineTrigger() {
  removeMachineTrigger_();
  ScriptApp.newTrigger('machineTick').timeBased().everyMinutes(5).create();
  SpreadsheetApp.getUi().alert(
    '✅ Auto trigger installed.\n\n' +
    'machineTick runs every 5 minutes:\n' +
    '  • Layer 2 scans replies\n' +
    '  • Layer 3 sends materials ' + REPLY_DELAY_MINUTES + ' min after a reply\n\n' +
    'The machine now runs itself.'
  );
}

function removeMachineTrigger() {
  const n = removeMachineTrigger_();
  SpreadsheetApp.getUi().alert('🛑 Removed ' + n + ' machine trigger(s).');
}

function removeMachineTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  let n = 0;
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'machineTick') {
      ScriptApp.deleteTrigger(triggers[i]);
      n++;
    }
  }
  return n;
}

function showTriggerStatus() {
  const active = ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'machineTick'; });
  SpreadsheetApp.getUi().alert(
    active.length > 0
      ? '✅ Machine trigger is ACTIVE (every 5 min).'
      : '🛑 No machine trigger installed.\nClick "Install 5-min Auto Trigger" to go continuous.'
  );
}

// ================== MANUAL CLASSIFICATION (Grok v2, preserved) ==================

function markSelectedAsPriority() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();
  const statusCol = findColumnByHeader(sheet, COL.ENGAGEMENT_STATUS);
  const priCol = findColumnByHeader(sheet, COL.PRIORITY);
  for (let i = 1; i <= range.getNumRows(); i++) {
    const row = range.getRow() + i - 1;
    const status = statusCol ? sheet.getRange(row, statusCol).getValue() : '';
    if (status === 'Unsubscribed') continue;
    if (priCol) sheet.getRange(row, priCol).setValue('Yes');
    if (statusCol) sheet.getRange(row, statusCol).setValue('priority');
  }
}

function markSelectedAsWarm() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();
  const statusCol = findColumnByHeader(sheet, COL.ENGAGEMENT_STATUS);
  const priCol = findColumnByHeader(sheet, COL.PRIORITY);
  for (let i = 1; i <= range.getNumRows(); i++) {
    const row = range.getRow() + i - 1;
    const status = statusCol ? sheet.getRange(row, statusCol).getValue() : '';
    if (status === 'Unsubscribed') continue;
    if (priCol) sheet.getRange(row, priCol).setValue('Warm');
    if (statusCol) sheet.getRange(row, statusCol).setValue('Warm / Future Opportunity');
  }
}

function moveSelectedToCommunityValueBlock() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();
  const statusCol = findColumnByHeader(sheet, COL.ENGAGEMENT_STATUS);
  const valueCol = findColumnByHeader(sheet, COL.VALUE_TRACK);
  const nextCol = findColumnByHeader(sheet, COL.NEXT_ACTION);
  for (let i = 1; i <= range.getNumRows(); i++) {
    const row = range.getRow() + i - 1;
    const status = statusCol ? sheet.getRange(row, statusCol).getValue() : '';
    if (status === 'Unsubscribed') continue;
    if (valueCol) sheet.getRange(row, valueCol).setValue('Yes');
    if (statusCol) sheet.getRange(row, statusCol).setValue('Community');
    if (nextCol) {
      const existing = sheet.getRange(row, nextCol).getValue() || '';
      sheet.getRange(row, nextCol).setValue(existing ? existing + ' | Value track active' : 'Value track active');
    }
  }
  SpreadsheetApp.getUi().alert('Moved to COMMUNITY / Value Bucket.');
}

function markSelectedAsUnsubscribed() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();
  const statusCol = findColumnByHeader(sheet, COL.ENGAGEMENT_STATUS);
  const valueCol = findColumnByHeader(sheet, COL.VALUE_TRACK);
  const unsubCol = findColumnByHeader(sheet, COL.UNSUBSCRIBED_DATE);
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 1; i <= range.getNumRows(); i++) {
    const row = range.getRow() + i - 1;
    if (statusCol) sheet.getRange(row, statusCol).setValue('Unsubscribed');
    if (valueCol) sheet.getRange(row, valueCol).setValue('No');
    if (unsubCol) sheet.getRange(row, unsubCol).setValue(today);
  }
  SpreadsheetApp.getUi().alert('Marked as UNSUBSCRIBED (hard stop).');
}

function logValueTouch() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();
  const touchCol = findColumnByHeader(sheet, COL.LAST_VALUE_TOUCH);
  const dateCol = findColumnByHeader(sheet, COL.LAST_VALUE_TOUCH_DATE);
  const valueCol = findColumnByHeader(sheet, COL.VALUE_TRACK);
  const statusCol = findColumnByHeader(sheet, COL.ENGAGEMENT_STATUS);
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt('Value Touch', 'What are you sending?', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;
  const touch = result.getResponseText() || 'Value touch sent';
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 1; i <= range.getNumRows(); i++) {
    const row = range.getRow() + i - 1;
    const status = statusCol ? sheet.getRange(row, statusCol).getValue() : '';
    if (status === 'Unsubscribed') continue;
    if (touchCol) sheet.getRange(row, touchCol).setValue(touch);
    if (dateCol) sheet.getRange(row, dateCol).setValue(today);
    if (valueCol) sheet.getRange(row, valueCol).setValue('Yes');
  }
}

function logMaterialsSent() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();
  const matCol = findColumnByHeader(sheet, COL.MATERIALS_SENT);
  const dateCol = findColumnByHeader(sheet, COL.MATERIALS_SENT_DATE);
  const statusCol = findColumnByHeader(sheet, COL.ENGAGEMENT_STATUS);
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt('Materials Sent', 'What did you send?', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;
  const what = result.getResponseText() || 'Materials packet sent';
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 1; i <= range.getNumRows(); i++) {
    const row = range.getRow() + i - 1;
    const status = statusCol ? sheet.getRange(row, statusCol).getValue() : '';
    if (status === 'Unsubscribed') continue;
    if (matCol) sheet.getRange(row, matCol).setValue(what);
    if (dateCol) sheet.getRange(row, dateCol).setValue(today);
  }
}

function showMachineStatus() {
  SpreadsheetApp.getUi().alert(
    'HUDSONSEED MACHINE — Layer 2 + Layer 3 (continuous)\n\n' +
    'Layer 2: scans inbox every 5 min, flags replies.\n' +
    'Layer 3: sends deck + Meet ask ' + REPLY_DELAY_MINUTES + ' min after a reply.\n' +
    'COMMUNITY = anyone who replied and did not say stop.\n' +
    'Unsubscribed = hard stop (nothing else goes out).\n\n' +
    'Install the trigger once to go fully continuous.'
  );
}

// ================== HELPERS ==================

function getVal(row, index) {
  return index !== undefined ? row[index] : '';
}

function findColumnByHeader(sheet, name) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const target = String(name).trim().toLowerCase();
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim().toLowerCase() === target) return i + 1;
  }
  return null;
}

function extractEmail_(fromStr) {
  const m = String(fromStr).match(/<([^>]+)>/);
  if (m) return m[1];
  const m2 = String(fromStr).match(/[\w.+-]+@[\w.-]+\.\w+/);
  return m2 ? m2[0] : '';
}

function parseDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
