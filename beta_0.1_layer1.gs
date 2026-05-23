// ================================================
// LAYER 1 PITCHING MACHINE - PURE MVP
// Google Sheets → Personalized Gmail Drafts
// Mon–Fri 10:00 AM ET | 7-10 drafts max | ZERO SPAM
// ================================================

const CONFIG = {
  SHEET_ID: "1HG7AhjaM5x8d_a3Od-eWmY9ooPXNdA2snpi5-ypaGgg",
  SHEET_NAME: "Schools",
  VENDOR_CODE: "9615",
  BATCH_LIMIT: 10,
  RUN_TIME_HOUR: 10,
  TIMEZONE: "America/New_York"
};

const PITCH_TEMPLATE = {
  subject: (schoolName) => `HudsonSeed | Vendor ${CONFIG.VENDOR_CODE} | K-12 Yoga & Mindfulness for ${schoolName}`,

  htmlBody: (principalName, schoolName) => `
    <p>Dear ${principalName || 'Principal'},</p>
    
    <p>I'm Trevor Vaughan, founder of HudsonSeed and a 500-hour Registered Yoga Teacher with the RCYT (Registered Children's Yoga Teacher) credential through Yoga Alliance. I'm reaching out because ${schoolName} is part of our current Jersey City beta cohort, and HudsonSeed is already an approved JCPS vendor — Vendor Code <strong>${CONFIG.VENDOR_CODE}</strong>.</p>
    
    <p>We deliver evidence-based yoga and mindfulness programming for K-12 students that directly supports nervous system regulation, attention, and emotional resilience — outcomes that translate to fewer classroom disruptions and stronger student readiness to learn.</p>
    
    <p>I'd like to offer your school a short 20-30 minute introductory conversation about what your students and teachers need right now. No obligation, no pitch deck — just a real conversation.</p>
    
    <p>Would you be open to a brief call this week or next? I'm happy to work around your schedule.</p>
    
    <br>
    <p>Warm regards,<br>
    <strong>Trevor Vaughan</strong><br>
    Founder, HudsonSeed<br>
    trevorvaughan@hudsonseed.com<br>
    500HR ERYT+RCYT | JCPS Vendor ${CONFIG.VENDOR_CODE}</p>
    
    <p style="font-size:11px; color:#666;">
      <a href="https://calendly.com/trevorvaughan/hudsonseed-intro">Schedule a Brief Intro Call</a>
    </p>
  `
};

function generateDailyDrafts() {
  const lock = PropertiesService.getScriptProperties();
  const today = new Date().toDateString();

  if (lock.getProperty('LAST_RUN_DATE') === today) {
    Logger.log('⚠️ Script already ran today — skipping to prevent duplicates');
    return;
  }

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!sheet) throw new Error(`Sheet "${CONFIG.SHEET_NAME}" not found`);

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) throw new Error("No data in sheet");

    const headers = data[0];
    const schoolNameIdx = headers.indexOf("school_name");
    const principalNameIdx = headers.indexOf("principal_name");
    const emailIdx = headers.indexOf("email");
    const statusIdx = headers.indexOf("status");

    if (schoolNameIdx === -1 || emailIdx === -1 || statusIdx === -1) {
      throw new Error("Missing required columns: school_name, email, or status");
    }

    let drafted = 0;

    for (let i = 1; i < data.length && drafted < CONFIG.BATCH_LIMIT; i++) {
      const row = data[i];
      const status = row[statusIdx];
      const schoolName = row[schoolNameIdx];
      const principalName = row[principalNameIdx] || "";
      const email = row[emailIdx];

      const absoluteSheetRow = i + 1;

      if (status !== "pending") continue;
      if (!email || !email.toString().trim()) continue;

      try {
        const subject = PITCH_TEMPLATE.subject(schoolName);
        const htmlBody = PITCH_TEMPLATE.htmlBody(principalName, schoolName);

        const draft = GmailApp.createDraft(
          email.toString().trim(),
          subject,
          "",
          { htmlBody: htmlBody }
        );

        sheet.getRange(absoluteSheetRow, statusIdx + 1).setValue("drafted");

        Logger.log(`✅ Draft #${drafted + 1} created → ${email} (${schoolName}) | Row ${absoluteSheetRow}`);
        drafted++;

      } catch (e) {
        Logger.log(`❌ ERROR on row ${absoluteSheetRow} (${email}): ${e.toString()}`);
      }
    }

    lock.setProperty('LAST_RUN_DATE', today);
    Logger.log(`🎯 Layer 1 complete: ${drafted} drafts created (Mon-Fri 10am batch)`);

  } catch (e) {
    Logger.log(`💥 FATAL ERROR: ${e.toString()}`);
  }
}

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'generateDailyDrafts') {
      ScriptApp.deleteTrigger(t);
    }
  });

  const days = [
    ScriptApp.WeekDay.MONDAY,
    ScriptApp.WeekDay.TUESDAY,
    ScriptApp.WeekDay.WEDNESDAY,
    ScriptApp.WeekDay.THURSDAY,
    ScriptApp.WeekDay.FRIDAY
  ];

  days.forEach(day => {
    ScriptApp.newTrigger('generateDailyDrafts')
      .timeBased()
      .atHour(CONFIG.RUN_TIME_HOUR)
      .nearMinute(0)
      .onWeekDay(day)
      .inTimezone(CONFIG.TIMEZONE)
      .create();
  });

  Logger.log(`✅ Mon–Fri ${CONFIG.RUN_TIME_HOUR}:00 AM ET triggers installed`);
}
