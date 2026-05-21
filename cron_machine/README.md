# HudsonSeed Cron Machine

Daily outreach automation. Pulls pending schools from Supabase, creates personalized Gmail drafts, logs results.

## Schedule
- **Days:** Tuesday / Wednesday / Thursday
- **Time:** 10:00 AM ET (14:00 UTC)
- **Volume:** 7 drafts per run = 21 drafts/week

## Required Environment Variables
- `SUPABASE_SERVICE_KEY` — Service role key from Supabase project pebhikfbpgntedvbxqph
- `GMAIL_TOKEN_JSON` — Full OAuth token JSON for trevorvaughan@hudsonseed.com

## What It Does
1. Queries `jc_schools_contacts` for `draft_status='pending'` rows
2. Creates a Gmail draft for each (personalized with principal name, school, vendor code)
3. Updates Supabase row to `draft_status='drafted'` with the Gmail draft ID
4. Logs the run to `outreach_runs` table

## What It Does NOT Do
- ❌ Send emails (drafts only — human reviews + clicks Send)
- ❌ Process replies (separate service)
- ❌ Handle follow-ups (separate service)

## Manual Test
```bash
SUPABASE_SERVICE_KEY=xxx GMAIL_TOKEN_JSON='{...}' python daily_outreach.py
```

## Files
- `daily_outreach.py` — main cron script
- `requirements.txt` — Python deps
- `railway.toml` — Railway cron schedule
- `Procfile` — process declaration

## Logs
Every run logs to `outreach_runs` table in Supabase. Query:
```sql
SELECT * FROM outreach_runs ORDER BY run_time DESC LIMIT 10;
```

Built May 20, 2026 by Claude for Trevor Vaughan.
