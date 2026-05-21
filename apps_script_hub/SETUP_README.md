# HudsonSeed Mil Hub — Setup Instructions

## What this is
A Google Apps Script that lives in YOUR Workspace, runs on a schedule, and creates
personalized Gmail drafts for JC schools using data from Supabase.

## One-time setup (10 minutes)

### Step 1: Create the project
1. Open https://script.google.com
2. Click **+ New Project**
3. Rename it to **"HudsonSeed Mil Hub"** (top-left, click "Untitled project")

### Step 2: Paste the code
1. Delete the default `function myFunction() {}` boilerplate
2. Paste the entire contents of `daily_outreach.gs`
3. Click **Save** (Cmd+S)

### Step 3: Add your Supabase key
1. Click the **gear icon** (Project Settings) on left sidebar
2. Scroll down to **Script Properties**
3. Click **Add script property**
4. Property: `SUPABASE_KEY`
5. Value: (paste your Supabase service role key — get from Supabase dashboard → Settings → API → service_role)
6. Click **Save script properties**

### Step 4: Authorize (this is the key step)
1. In the code editor, select function `testRun` from the dropdown at top
2. Click **Run** ▶
3. **OAuth popup appears** — click **Review permissions**
4. Pick your Google account (trevorvaughan@hudsonseed.com)
5. Click **Advanced** → **Go to HudsonSeed Mil Hub (unsafe)** — it's safe, it's your own script
6. Click **Allow** for Gmail + External requests permissions
7. Script runs. Check **Execution log** at bottom — should say "Test passed."

### Step 5: Test the dry run
1. Select function `dryRun` from dropdown
2. Click **Run** ▶
3. Execution log shows what would be drafted (no actual drafts yet)
4. Confirm the list looks right

### Step 6: Set the time trigger
1. Click the **clock icon** (Triggers) on left sidebar
2. Click **+ Add Trigger** (bottom right)
3. Settings:
   - Choose function to run: `runDailyOutreach`
   - Choose deployment: Head
   - Select event source: **Time-driven**
   - Select type of time based trigger: **Week timer**
   - Select day of week: **Every Tuesday**
   - Select time: **10am to 11am**
4. Click **Save**
5. Repeat for **Wednesday** and **Thursday**

### Step 7: Done
- Apps Script will run automatically Tue/Wed/Thu 10am ET
- 7 new Gmail drafts each run
- Logs go to Supabase `outreach_runs` table
- No further setup ever needed

## Available functions

| Function | What it does |
|---|---|
| `runDailyOutreach` | THE production function. Drafts 7 emails + logs. Time trigger calls this. |
| `testRun` | Check Supabase connection (no drafts created) |
| `dryRun` | Preview what would be drafted (no actual drafts) |
| `pipelineStatus` | Show current pending/drafted counts |

## Verifying it works
After a real run, check:
1. **Gmail Drafts folder** — 7 new drafts with subject "HudsonSeed | Vendor V00108320..."
2. **Supabase**: `SELECT * FROM outreach_runs ORDER BY run_time DESC LIMIT 1`
3. **Supabase**: `SELECT draft_status, COUNT(*) FROM jc_schools_contacts GROUP BY draft_status`

## What if it fails?
- Open Apps Script → **Executions** (left sidebar) → see error log
- Most likely cause: SUPABASE_KEY missing or wrong
- Re-check Script Properties

## Built by
Claude for Trevor Vaughan, May 20, 2026
