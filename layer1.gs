/**
 * LAYER 1 — PITCHING MACHINE (MODIFIED FOR SELF-TESTING)
 * Modified: All 5 drafts → trevorvaughan@hudsonseed.com
 * 
 * Functions:
 * - generateDailyDrafts(forceRun=false) → Creates 10 drafts/day Mon-Fri 10 AM ET
 * - testGenerateDrafts() → Force run for testing (bypasses date lock)
 * - resetSheet() → Reset all statuses to 'pending' for re-testing
 * 
 * IMPORTANT: All draft recipients are HARD-CODED to trevorvaughan@hudsonseed.com
 * This is for the Layer 2 testing loop (you send to yourself, reply with different responses)
 */

function generateDailyDrafts(forceRun = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  if (!sheet) return;
  
  // HARD-CODED RECIPIENT FOR TESTING
  const TEST_RECIPIENT = 'trevorvaughan@hudsonseed.com';
  
  const scriptProperties = PropertiesService.getScriptProperties();
  if (!forceRun) {
    const today = new Date().toISOString().split('T')[0];
    if (scriptProperties.getProperty('LAST_RUN') === today) return;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sIdx = headers.indexOf('school_name');
  const nIdx = headers.indexOf('contact_name');
  const tIdx = headers.indexOf('contact_title');
  const eIdx = headers.indexOf('contact_email');
  const vIdx = headers.indexOf('vendor_code');
  const stIdx = headers.indexOf('status');
  
  let count = 0;
  for (let i = 1; i < data.length && count < 10; i++) {
    if (data[i][stIdx] === 'pending') {
      const school = data[i][sIdx];
      const fullName = data[i][nIdx];
      const title = data[i][tIdx];
      const vendor = data[i][vIdx];
      
      const parts = fullName.trim().split(/\s+/);
      const last = parts[parts.length - 1];
      const salutation = 'Dear ' + title + ' ' + last + ',';
      const subject = 'HudsonSeed | Vendor ' + vendor + ' | K-12 Yoga & Mindfulness for ' + school;
      const body = salutation + '\n\nI\'m Trevor Vaughan, founder of HudsonSeed. ' + school + ' is part of our current Jersey City beta outreach, and HudsonSeed is already an approved JCPS vendor — Vendor ' + vendor + '.\n\nHudsonSeed is already being used by 7,000 teachers and over 100,000 children. We deliver yoga and mindfulness programming that\'s perfect for the classroom — no materials needed except a visual whiteboard. It\'s super cheap and easy to use.\n\nOur program helps kids focus, regulate, and behave better, which means fewer classroom disruptions.\n\nWould you be open to a quick 10-15 minute call to discuss what your students need right now? I\'m flexible on timing.\n\nWarm regards,\nTrevor Vaughan\nFounder, HudsonSeed\ntrevorvaughan@hudsonseed.com\n500HR ERYT+RCYT | JCPS Vendor ' + vendor;
      
      // SEND TO TEST RECIPIENT (YOU)
      GmailApp.createDraft(TEST_RECIPIENT, subject, body);
      sheet.getRange(i + 1, stIdx + 1).setValue('drafted');
      count++;
    }
  }
  
  scriptProperties.setProperty('LAST_RUN', new Date().toISOString().split('T')[0]);
  Logger.log(count + ' drafts created → ' + TEST_RECIPIENT);
}

function testGenerateDrafts() {
  generateDailyDrafts(true);
}

function resetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const stIdx = data[0].indexOf('status');
  for (let i = 1; i < data.length; i++) {
    sheet.getRange(i + 1, stIdx + 1).setValue('pending');
  }
}
