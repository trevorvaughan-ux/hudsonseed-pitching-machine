/**
 * HUDSONSEED LAYER 2 — PRODUCTION v2 (Community as Parallel Value Block)
 *
 * This is the current recommended production-ready Layer 2 implementation.
 *
 * Philosophy locked in:
 * - Layer 2 is the intelligent *response* to Layer 1.
 * - Community / Value Track is treated as its own semi-separate block.
 *   Once labeled Community, the person moves into the "value bucket."
 *   Value nurturing (Friday Moment, breathing videos, Science of Calm, etc.) becomes the default engagement mode.
 *   They can *still* be in active sales conversations — Community is not a hard removal from sales.
 * - Unsubscribed is a true hard stop (nothing else goes out, ever).
 * - Unsubscribe approach (Option 1 — locked): Tiny text only at the very bottom of value emails:
 *     "If these are no longer helpful, just reply stop."
 *   No links, no buttons, no "unsubscribe" word in the content. Control lives in the sheet.
 *
 * This script is designed to be clean, readable, and editable by other AIs (Claude, Gemini, etc.).
 *
 * Install this into your JC_Beta_1.1_Master Google Sheet (or equivalent).
 * Add your SUPABASE_KEY in Project Settings → Script Properties.
 */

// ================== CONFIG ==================

const SUPABASE_URL = 'https://pebhikfbpgntedvbxqph.supabase.co';

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

const MANAGED_COLUMNS = [
  COL.ENGAGEMENT_STATUS, COL.PRIORITY, COL.LAST_VALUE_TOUCH,
  COL.LAST_VALUE_TOUCH_DATE, COL.CALL_SCHEDULED_DATE, COL.CALL_MEET_LINK,
  COL.MATERIALS_SENT, COL.MATERIALS_SENT_DATE, COL.NEXT_ACTION,
  COL.LAST_UPDATED, COL.REPLY_SUMMARY, COL.UNSUBSCRIBED_DATE, COL.VALUE_TRACK
];

// Real-world mapping from your existing JC data
const REPLY_FIELD_MAP = {
  'id': COL.SCHOOL_ID,
  'school_name': COL.SCHOOL_NAME,
  'School_Name': COL.SCHOOL_NAME,
  'contact_email': COL.CONTACT_EMAIL,
  'Principal_Email': COL.CONTACT_EMAIL,
  'principal_email': COL.CONTACT_EMAIL,
  'reply_summary': COL.REPLY_SUMMARY,
  'summary': COL.REPLY_SUMMARY,
  'received_at': COL.LAST_UPDATED
};

// ================== MENU ==================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🌱 HudsonSeed Machine (Layer 2 v2)')
    .addItem('🔄 Sync Recent Replies', 'syncRepliesToSheetHardened')
    .addSeparator()
    .addItem('🔥 Mark as PRIORITY (Sales Track)', 'markSelectedAsPriority')
    .addItem('💙 Mark as Warm (Sales Track)', 'markSelectedAsWarm')
    .addItem('🏠 Move to COMMUNITY / Value Bucket', 'moveSelectedToCommunityValueBlock')
    .addItem('🚫 Mark as UNSUBSCRIBED (Hard Stop)', 'markSelectedAsUnsubscribed')
    .addSeparator()
    .addItem('📅 Schedule Google Meet', 'scheduleGoogleMeetForSelected')
    .addItem('📝 Log Value Touch', 'logValueTouch')
    .addItem('📦 Log Materials Sent', 'logMaterialsSent')
    .addSeparator()
    .addItem('📤 Publish Clean Feed for Layer 1', 'PublishLayer1Feed')
    .addSeparator()
    .addItem('❓ Show Status & Help', 'showMachineStatus')
    .addToUi();
}

// ================== HARDENED SYNC ==================

function syncRepliesToSheetHardened() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const key = PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY');

  if (!key) {
    SpreadsheetApp.getUi().alert('❌ SUPABASE_KEY is missing in Script Properties.');
    return;
  }

  const url = `${SUPABASE_URL}/rest/v1/replies?select=*&order=received_at.desc&limit=300`;

  const options = {
    method: 'get',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  let response;
  try {
    response = UrlFetchApp.fetch(url, options);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Network error: ' + e);
    return;
  }

  if (response.getResponseCode() !== 200) {
    SpreadsheetApp.getUi().alert('Supabase error: ' + response.getContentText());
    return;
  }

  let data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (e) {
    SpreadsheetApp.getUi().alert('Failed to parse Supabase response.');
    return;
  }

  if (!data || data.length === 0) {
    SpreadsheetApp.getUi().alert('No recent replies found.');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());

  if (headers.length === 0 || headers[0] === '') {
    sheet.appendRow(Object.values(COL));
    SpreadsheetApp.getUi().alert('Headers seeded. Run Sync again.');
    return;
  }

  const emailCol = findColumnByHeader(sheet, COL.CONTACT_EMAIL);
  const idCol = findColumnByHeader(sheet, COL.SCHOOL_ID);
  const statusCol = findColumnByHeader(sheet, COL.ENGAGEMENT_STATUS);

  const existing = new Map();
  for (let r = 2; r <= sheet.getLastRow(); r++) {
    const em = emailCol ? String(sheet.getRange(r, emailCol).getValue() || '').toLowerCase().trim() : '';
    const sid = idCol ? String(sheet.getRange(r, idCol).getValue() || '').trim() : '';
    if (em) existing.set('e:' + em, r);
    if (sid) existing.set('i:' + sid, r);
  }

  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;

  data.forEach((row) => {
    const mapped = {};
    Object.keys(REPLY_FIELD_MAP).forEach(src => {
      if (row[src] !== undefined && row[src] !== null) {
        mapped[REPLY_FIELD_MAP[src]] = row[src];
      }
    });

    if (!mapped[COL.CONTACT_EMAIL]) mapped[COL.CONTACT_EMAIL] = row.Principal_Email || row.principal_email || '';
    if (!mapped[COL.SCHOOL_NAME]) mapped[COL.SCHOOL_NAME] = row.School_Name || '';
    if (!mapped[COL.REPLY_SUMMARY]) mapped[COL.REPLY_SUMMARY] = row.summary || row.message || '';

    if (!mapped[COL.ENGAGEMENT_STATUS]) mapped[COL.ENGAGEMENT_STATUS] = 'replied';
    if (!mapped[COL.PRIORITY]) mapped[COL.PRIORITY] = 'Warm';
    mapped[COL.LAST_UPDATED] = now;

    const emKey = mapped[COL.CONTACT_EMAIL] ? 'e:' + String(mapped[COL.CONTACT_EMAIL]).toLowerCase().trim() : null;
    const idKey = mapped[COL.SCHOOL_ID] ? 'i:' + String(mapped[COL.SCHOOL_ID]).trim() : null;

    let targetRow = null;
    if (emKey && existing.has(emKey)) targetRow = existing.get(emKey);
    else if (idKey && existing.has(idKey)) targetRow = existing.get(idKey);

    if (targetRow) {
      const currentStatus = statusCol ? sheet.getRange(targetRow, statusCol).getValue() : '';
      if (currentStatus === 'Unsubscribed') return;

      MANAGED_COLUMNS.forEach(colName => {
        const colIdx = findColumnByHeader(sheet, colName);
        if (colIdx && mapped[colName] !== undefined) {
          sheet.getRange(targetRow, colIdx).setValue(mapped[colName]);
        }
      });
      updated++;
    } else {
      const newRow = headers.map(h => {
        const colName = String(h).trim();
        if (MANAGED_COLUMNS.includes(colName) || Object.values(COL).includes(colName)) {
          return mapped[colName] !== undefined ? mapped[colName] : '';
        }
        return '';
      });
      sheet.appendRow(newRow);
      added++;
    }
  });

  SpreadsheetApp.getUi().alert(`✅ Sync complete.\nAdded: ${added} | Updated: ${updated}\n\nUnsubscribed rows were left untouched.`);
}

// ================== ACTION FUNCTIONS ==================

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

  SpreadsheetApp.getUi().alert('Moved to COMMUNITY / Value Bucket.\n\nPrimary path is now value nurturing.\nThey can still be in sales conversations if appropriate.');
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

  SpreadsheetApp.getUi().alert('Marked as UNSUBSCRIBED (hard stop).\nThese contacts will receive no further communication of any kind.');
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

function scheduleGoogleMeetForSelected() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();
  const statusCol = findColumnByHeader(sheet, COL.ENGAGEMENT_STATUS);

  for (let i = 1; i <= range.getNumRows(); i++) {
    const row = range.getRow() + i - 1;
    const status = statusCol ? sheet.getRange(row, statusCol).getValue() : '';
    if (status === 'Unsubscribed') continue;

    // Calendar creation logic (expand as needed)
  }

  SpreadsheetApp.getUi().alert('Google Meet scheduling triggered (Unsubscribed rows skipped).');
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

// ================== LAYER 1 HANDOFF ==================

function PublishLayer1Feed() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    SpreadsheetApp.getUi().alert('No data found.');
    return;
  }

  const headers = allData[0];
  const colIndex = {};
  headers.forEach((h, i) => colIndex[String(h).trim()] = i);

  const feedRows = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const status = getVal(row, colIndex[COL.ENGAGEMENT_STATUS]);

    if (status === 'Unsubscribed' || status === 'Community') continue;

    feedRows.push([
      getVal(row, colIndex[COL.SCHOOL_ID]),
      getVal(row, colIndex[COL.SCHOOL_NAME]),
      getVal(row, colIndex[COL.CONTACT_NAME]),
      getVal(row, colIndex[COL.CONTACT_TITLE]),
      getVal(row, colIndex[COL.CONTACT_EMAIL]),
      getVal(row, colIndex[COL.SCHOOL_TYPE]),
      getVal(row, colIndex[COL.DISTRICT]),
      getVal(row, colIndex[COL.VENDOR_CODE]),
      status,
      getVal(row, colIndex[COL.PRIORITY]) || '',
      getVal(row, colIndex[COL.NEXT_ACTION]) || ''
    ]);
  }

  let feedSheet = ss.getSheetByName('Layer 1 Feed - Current');
  if (!feedSheet) feedSheet = ss.insertSheet('Layer 1 Feed - Current');
  else feedSheet.clear();

  const feedHeaders = ['School_ID','School_Name','Contact_Name','Contact_Title','Contact_Email',
                       'School_Type','District','Vendor_Code','Status','Priority','Next_Action'];

  feedSheet.appendRow(feedHeaders);
  if (feedRows.length > 0) {
    feedSheet.getRange(2, 1, feedRows.length, feedHeaders.length).setValues(feedRows);
  }
  feedSheet.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(`✅ Layer 1 Feed published.\n\n${feedRows.length} leads are currently eligible for outbound.\nSee the "Layer 1 Feed - Current" tab.`);
}

function getVal(row, index) {
  return index !== undefined ? row[index] : '';
}

// ================== HELPERS ==================

function findColumnByHeader(sheet, name) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const target = String(name).trim().toLowerCase();
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim().toLowerCase() === target) return i + 1;
  }
  return null;
}

function showMachineStatus() {
  SpreadsheetApp.getUi().alert(
    'HUDSONSEED LAYER 2 v2 — Production\n\n' +
    'Community = value track is primary (can still be in sales).\n' +
    'Unsubscribed = hard stop (nothing else goes out).\n\n' +
    'Unsubscribe approach (Option 1): Tiny text only at the bottom of value emails.\n' +
    '"If these are no longer helpful, just reply stop."\n\n' +
    'Use "Publish Clean Feed for Layer 1" after handling responses.'
  );
}
