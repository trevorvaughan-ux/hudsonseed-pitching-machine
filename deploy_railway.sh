#!/bin/bash
# Railway Deploy Script - Grok Executed May 6 2026
export RAILWAY_TOKEN="18e8d51b-5e5a-47a6-9623-1593a1b73c1a"
railway login --token $RAILWAY_TOKEN
railway link 2fb7c7dc-efbd-445c-8974-4afe05d47e0e
railway up --detach
railway cron create "Daily Pitch Orchestrator" "0 9 * * *" "python daily_pitch_machine.py"
railway cron create "Reply Tracker" "0 12 * * *" "python reply_tracker.py"
echo "Railway deploy + crons complete. Check https://railway.app/project/2fb7c7dc-efbd-445c-8974-4afe05d47e0e"