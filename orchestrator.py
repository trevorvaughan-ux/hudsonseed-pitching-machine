#!/usr/bin/env python3
"""
ORCHESTRATOR — The brain of the pitching machine.
Chains all components: finder → generator → sender → tracker.
Single command runs the entire daily cycle autonomously.

No stubs. Real execution. Full logging.

Usage:
  python orchestrator.py                    # Full daily cycle
  python orchestrator.py --finder-only      # Just load schools
  python orchestrator.py --sender-only      # Just send pitches
  python orchestrator.py --tracker-only     # Just track replies
  
Railway Cron:
  Schedule: 0 9 * * * (daily 9 AM UTC)
  Command: python orchestrator.py
"""

import json
import subprocess
import sys
from datetime import datetime

# ═══════════════════════════════════════════════════════════════════════════════
# ORCHESTRATOR LOGGER
# ═══════════════════════════════════════════════════════════════════════════════

class OrchestratorLog:
    def __init__(self):
        self.start_time = datetime.now().isoformat()
        self.log = {
            "orchestrator_start": self.start_time,
            "phases": {}
        }
    
    def phase_start(self, phase_name):
        print(f"\n[ORCHESTRATOR] ▶ PHASE: {phase_name}")
        self.log["phases"][phase_name] = {
            "status": "RUNNING",
            "started_at": datetime.now().isoformat()
        }
    
    def phase_complete(self, phase_name, status="SUCCESS", details=None):
        print(f"[ORCHESTRATOR] ✓ {phase_name}: {status}")
        self.log["phases"][phase_name]["status"] = status
        self.log["phases"][phase_name]["completed_at"] = datetime.now().isoformat()
        if details:
            self.log["phases"][phase_name]["details"] = details
    
    def phase_error(self, phase_name, error):
        print(f"[ORCHESTRATOR] ✗ {phase_name}: ERROR - {error}")
        self.log["phases"][phase_name]["status"] = "FAILED"
        self.log["phases"][phase_name]["error"] = str(error)
    
    def save(self):
        self.log["orchestrator_complete"] = datetime.now().isoformat()
        try:
            with open("orchestrator_log.json", "w") as f:
                json.dump(self.log, f, indent=2)
            print(f"[ORCHESTRATOR] ✓ Log saved to orchestrator_log.json")
        except Exception as e:
            print(f"[ORCHESTRATOR] ✗ Error saving log: {e}")

# ═══════════════════════════════════════════════════════════════════════════════
# COMPONENT RUNNERS
# ═══════════════════════════════════════════════════════════════════════════════

def run_school_finder(log):
    """Phase 1: Load schools from NJ API or fallback."""
    log.phase_start("SCHOOL_FINDER")
    try:
        result = subprocess.run([sys.executable, "school_finder.py"], capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            log.phase_complete("SCHOOL_FINDER", "SUCCESS")
            return True
        else:
            log.phase_error("SCHOOL_FINDER", result.stderr)
            return False
    except Exception as e:
        log.phase_error("SCHOOL_FINDER", e)
        return False

def run_pitch_machine(log):
    """Phase 2: Generate and send pitches."""
    log.phase_start("DAILY_PITCH_MACHINE")
    try:
        result = subprocess.run([sys.executable, "daily_pitch_machine.py"], capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            log.phase_complete("DAILY_PITCH_MACHINE", "SUCCESS")
            return True
        else:
            log.phase_error("DAILY_PITCH_MACHINE", result.stderr or result.stdout)
            return False
    except subprocess.TimeoutExpired:
        log.phase_error("DAILY_PITCH_MACHINE", "Timeout - check Gmail connectivity")
        return False
    except Exception as e:
        log.phase_error("DAILY_PITCH_MACHINE", e)
        return False

def run_reply_tracker(log):
    """Phase 3: Track and classify replies."""
    log.phase_start("REPLY_TRACKER")
    try:
        result = subprocess.run([sys.executable, "reply_tracker.py"], capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            log.phase_complete("REPLY_TRACKER", "SUCCESS")
            return True
        else:
            log.phase_error("REPLY_TRACKER", result.stderr)
            return False
    except Exception as e:
        log.phase_error("REPLY_TRACKER", e)
        return False

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    # Parse arguments
    args = sys.argv[1:]
    finder_only = "--finder-only" in args
    sender_only = "--sender-only" in args
    tracker_only = "--tracker-only" in args
    
    # Initialize logger
    log = OrchestratorLog()
    
    print("[ORCHESTRATOR] ═══════════════════════════════════════════════════════════")
    print(f"[ORCHESTRATOR] ORCHESTRATOR_STARTED - {datetime.now().isoformat()}")
    print("[ORCHESTRATOR] ═══════════════════════════════════════════════════════════")
    
    # Determine which phases to run
    if finder_only:
        phases = ["finder"]
    elif sender_only:
        phases = ["sender"]
    elif tracker_only:
        phases = ["tracker"]
    else:
        phases = ["finder", "sender", "tracker"]
    
    print(f"[ORCHESTRATOR] Running phases: {', '.join(phases)}\n")
    
    # Run phases
    success_count = 0
    
    if "finder" in phases:
        if run_school_finder(log):
            success_count += 1
    
    if "sender" in phases:
        if run_pitch_machine(log):
            success_count += 1
    
    if "tracker" in phases:
        if run_reply_tracker(log):
            success_count += 1
    
    # Save log
    log.save()
    
    # Final report
    print("\n[ORCHESTRATOR] ═══════════════════════════════════════════════════════════")
    print(f"[ORCHESTRATOR] ORCHESTRATOR_COMPLETE - {datetime.now().isoformat()}")
    print("[ORCHESTRATOR] ═══════════════════════════════════════════════════════════")
    print(f"[ORCHESTRATOR] Phases completed: {success_count}/{len(phases)}")
    
    if success_count == len(phases):
        print("[ORCHESTRATOR] ✓ FULL DAILY CYCLE SUCCESS")
        print("[ORCHESTRATOR] Machine is operational. Next run tomorrow via Railway cron.")
    else:
        print("[ORCHESTRATOR] ⚠ SOME PHASES FAILED - Check logs")
    
    print("[ORCHESTRATOR] ═══════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
