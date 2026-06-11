# HudsonSeed Pitching Machine

> **WAKE-UP POINTER: Read [CLAUDE_STATUS_2026-06-10.md](CLAUDE_STATUS_2026-06-10.md) first.** Dated status files are the source of truth for session state.


**Autonomous email outreach engine for K-12 school sales.**

## Status
- ✅ **Production:** Google Apps Script (Workspace-native, no external infra)
- ✅ **Database:** Supabase (pebhikfbpgntedvbxqph)
- ✅ **Deployment:** Manual (GitHub → Google Apps Script)

## What's in this repo

```
/apps_script_hub/
  ├── daily_outreach.gs       → Production script (Tue/Wed/Thu 10am ET)
  └── SETUP_README.md         → One-time setup guide (10 min)
```

## Quick Start

1. Read `apps_script_hub/SETUP_README.md`
2. Paste `daily_outreach.gs` into [script.google.com](https://script.google.com)
3. Add Supabase key to Script Properties
4. Set 3 time triggers (Tue/Wed/Thu 10am ET)
5. Done. Runs automatically.

## How It Works

- **Every Tue/Wed/Thu at 10 AM:** Script queries Supabase for pending JC schools
- **Drafts 7 emails:** Personalized to each principal/superintendent
- **Gmail Drafts folder:** You review, edit, and send manually
- **Logs everything:** Supabase `outreach_runs` table tracks each run

## Data

- **Source:** `jc_schools_contacts` table (39 contacts)
- **Logs:** `outreach_runs` table (run history + error tracking)
- **Config:** `system_config` table (feature flags, kill switches)

## Monitoring

Check Supabase:
```sql
SELECT * FROM outreach_runs ORDER BY run_time DESC LIMIT 10;
SELECT draft_status, COUNT(*) FROM jc_schools_contacts GROUP BY draft_status;
```

## Built By
Claude for Trevor Vaughan | HudsonSeed | May 21, 2026
