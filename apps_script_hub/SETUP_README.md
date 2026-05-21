# HudsonSeed Apps Script Hub

## Overview

Three fully autonomous Google Apps Scripts that run on schedule, zero human intervention needed.

| Script | Schedule | Job | Output |
|---|---|---|---|
| **daily_outreach.gs** | Tue/Wed/Thu 10 AM | Draft 7 emails | Gmail Drafts + Supabase log |
| **scout.gs** | Friday 8 AM | Enrich 5 schools | Supabase pitch_intel JSONB |
| **analyst.gs** | Daily 8 AM | Generate brief | Google Doc + Supabase log |

---

## ONE-TIME SETUP (30 minutes total)

### Common Steps (for all three scripts)

1. **Create three new Google Apps Script projects:**
   - Go to [script.google.com](https://script.google.com)
   - Click **New Project** three times
   - Name them: `HudsonSeed Courier`, `HudsonSeed Scout`, `HudsonSeed Analyst`

2. **For each project:**
   - Delete the default empty function
   - Paste the entire script code (daily_outreach.gs, scout.gs, or analyst.gs)
   - Click **Save** (Ctrl+S)
   - Go to **Project Settings** (gear icon)
   - Scroll to **Script Properties**
   - Add one row: Property `SUPABASE_KEY`, Value `[your service role key]`
   - Save

3. **Authorize each script (one-time OAuth):**
   - Select the test function from dropdown (testRun, testScout, testAnalyst)
   - Click **Run**
   - OAuth popup → click your account → **Allow**
   - Check **Execution log** at bottom → should say SUCCESS

---

### Script-Specific Setup

#### **COURIER (daily_outreach.gs)**

**One-time trigger setup:**
1. Click **Triggers** (clock icon, left sidebar)
2. Click **+ Create a new trigger**
3. Settings:
   - Function: `runDailyOutreach`
   - Event: Time-driven → Week timer → Tuesday, 10:00 AM - 11:00 AM ET
   - Click Save
4. **Repeat for Wednesday and Thursday**

**Result:** Every Tue/Wed/Thu at 10 AM, 7 email drafts appear in your Gmail Drafts folder. You review and send manually.

---

#### **SCOUT (scout.gs)**

**One-time trigger setup:**
1. Click **Triggers**
2. Click **+ Create a new trigger**
3. Settings:
   - Function: `runScout`
   - Event: Time-driven → Week timer → Friday, 8:00 AM - 9:00 AM ET
   - Click Save

**Result:** Every Friday at 8 AM, the script finds 5 schools with no enrichment data, scrapes their websites, and updates Supabase with principal bios + mission statements.

---

#### **ANALYST (analyst.gs)**

**Drive folder setup (ONE TIME):**
1. Open Google Drive
2. Create a folder called `HudsonSeed-Ops` (exact name)
3. Inside it, create a subfolder called `Daily-Briefs` (exact name)
4. The script will populate this folder with dated briefs

**One-time trigger setup:**
1. Click **Triggers**
2. Click **+ Create a new trigger**
3. Settings:
   - Function: `runAnalyst`
   - Event: Time-driven → Day timer → 8:00 AM - 9:00 AM ET
   - Click Save

**Result:** Every day at 8 AM, a new dated Google Doc appears in `HudsonSeed-Ops/Daily-Briefs/` with:
- Total contacts, pending drafts, hot leads, warm leads
- Recent activity (runs, drafts created, errors)
- Next steps (follow up with hot leads, etc.)

---

## MONITORING

All three scripts log their runs to Supabase `agent_runs` table. Ask Claude to query it:

```
SELECT service, status, timestamp, message FROM agent_runs 
ORDER BY timestamp DESC LIMIT 20;
```

You'll see:
- `COURIER` runs (Tue/Wed/Thu 10 AM)
- `SCOUT` runs (Friday 8 AM)
- `ANALYST` runs (Daily 8 AM)
- Success/failure status for each
- Error messages if anything failed

---

## AUTONOMOUS MODE

All three scripts check `system_config` table for `autonomous_mode`:
- If set to `ON` (default), they run automatically
- If set to `OFF`, they skip gracefully (no errors)

This lets you pause all agents with one Supabase update:

```
UPDATE system_config SET value = 'OFF' WHERE key = 'autonomous_mode';
```

---

## WHAT IF SOMETHING BREAKS?

Each script has error handling. If it fails:
1. Check Supabase `agent_runs` table → see the error message
2. Check Google Apps Script **Executions** (left sidebar) → see full logs
3. Most likely cause: SUPABASE_KEY missing or wrong

---

## VERSION

Built: May 21, 2026 by Claude  
Status: PRODUCTION AUTONOMOUS  
All three scripts run 24/7 with zero manual intervention required.
