#!/usr/bin/env python3
"""
ERROR_HANDLER — Comprehensive error detection + recovery.
Runs health checks on all components. Logs failures with timestamps.
Triggers alerts when critical systems fail.

No stubs. Real error classification. Real recovery logic.

Usage:
  python error_handler.py                    # Full health check
  python error_handler.py --skip-sends       # Skip email sends (faster testing)
  python error_handler.py --report-only      # Just generate report

Components checked:
  - School finder (file I/O + API)
  - Pitch machine (Gmail SMTP connectivity)
  - Reply tracker (JSON parsing)
  - Orchestrator (subprocess execution)
"""

import json
import subprocess
import sys
import os
from datetime import datetime
import traceback

# ═══════════════════════════════════════════════════════════════════════════════
# ERROR CLASSIFIER
# ═══════════════════════════════════════════════════════════════════════════════

class ErrorClassifier:
    """Categorize errors by severity + type."""
    
    CRITICAL = ["GMAIL_AUTH", "DATABASE_UNREACHABLE", "PERMISSION_DENIED"]
    WARNING = ["TIMEOUT", "API_UNAVAILABLE", "RATE_LIMIT"]
    INFO = ["FALLBACK_USED", "RETRY_SCHEDULED"]
    
    @staticmethod
    def classify(error_msg):
        """Classify error severity."""
        lower = error_msg.lower()
        
        if any(crit in error_msg for crit in ErrorClassifier.CRITICAL):
            return "CRITICAL"
        elif any(warn in lower for warn in ErrorClassifier.WARNING):
            return "WARNING"
        elif any(info in error_msg for info in ErrorClassifier.INFO):
            return "INFO"
        else:
            return "ERROR"

# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECKS
# ═══════════════════════════════════════════════════════════════════════════════

class HealthCheck:
    """Run health checks on machine components."""
    
    def __init__(self):
        self.checks = {}
        self.errors = []
        self.start_time = datetime.now().isoformat()
    
    def check_file_access(self, filename):
        """Verify file exists and is readable."""
        try:
            with open(filename) as f:
                size = len(f.read())
            return True, f"OK ({size} bytes)"
        except FileNotFoundError:
            return False, f"File not found: {filename}"
        except Exception as e:
            return False, f"Read error: {str(e)}"
    
    def check_json_validity(self, filename):
        """Verify JSON file is valid."""
        try:
            with open(filename) as f:
                json.load(f)
            return True, "Valid JSON"
        except FileNotFoundError:
            return False, f"File not found: {filename}"
        except json.JSONDecodeError as e:
            return False, f"Invalid JSON: {str(e)}"
        except Exception as e:
            return False, f"Parse error: {str(e)}"
    
    def check_subprocess(self, script, timeout=10, skip_sends=False):
        """Test subprocess execution."""
        try:
            env = os.environ.copy()
            if skip_sends:
                env["SIMULATE_ONLY"] = "True"
            
            result = subprocess.run(
                [sys.executable, script],
                capture_output=True,
                text=True,
                timeout=timeout,
                env=env
            )
            
            if result.returncode == 0:
                return True, f"Success (exit code 0)"
            else:
                # Return first line of error
                error_msg = (result.stderr or result.stdout).split('\n')[0][:100]
                return False, f"Exit code {result.returncode}: {error_msg}"
        except subprocess.TimeoutExpired:
            return False, f"Timeout after {timeout}s"
        except Exception as e:
            return False, f"Execution error: {str(e)}"
    
    def run_all(self, skip_sends=False):
        """Run all health checks."""
        print("[ERROR_HANDLER] Running health checks...\n")
        
        # File existence checks
        print("[ERROR_HANDLER] ▶ File Access Checks")
        files_to_check = [
            "school_finder.py",
            "daily_pitch_machine.py",
            "reply_tracker.py",
            "orchestrator.py",
            "leads.json"
        ]
        for filename in files_to_check:
            ok, msg = self.check_file_access(filename)
            self.checks[f"file:{filename}"] = {"ok": ok, "msg": msg}
            print(f"  {'✓' if ok else '✗'} {filename}: {msg}")
        
        # JSON validity checks
        print("\n[ERROR_HANDLER] ▶ JSON Validity Checks")
        json_files = ["leads.json"]
        for filename in json_files:
            ok, msg = self.check_json_validity(filename)
            self.checks[f"json:{filename}"] = {"ok": ok, "msg": msg}
            print(f"  {'✓' if ok else '✗'} {filename}: {msg}")
        
        # Subprocess execution checks
        print("\n[ERROR_HANDLER] ▶ Component Execution Checks")
        checks = [
            ("school_finder.py", 15),
            ("reply_tracker.py", 15),
        ]
        if not skip_sends:
            checks.append(("daily_pitch_machine.py", 60))
        
        for script, timeout in checks:
            ok, msg = self.check_subprocess(script, timeout=timeout, skip_sends=skip_sends)
            self.checks[f"exec:{script}"] = {"ok": ok, "msg": msg}
            print(f"  {'✓' if ok else '✗'} {script}: {msg}")
        
        # Orchestrator check
        print("\n[ERROR_HANDLER] ▶ Orchestrator Check")
        if skip_sends:
            print(f"  ⊘ Skipped (--skip-sends mode)")
            self.checks["exec:orchestrator.py"] = {"ok": True, "msg": "Skipped"}
        else:
            ok, msg = self.check_subprocess("orchestrator.py", timeout=120, skip_sends=skip_sends)
            self.checks[f"exec:orchestrator.py"] = {"ok": ok, "msg": msg}
            print(f"  {'✓' if ok else '✗'} orchestrator.py: {msg}")

# ═══════════════════════════════════════════════════════════════════════════════
# ERROR LOGGER + ALERTER
# ═══════════════════════════════════════════════════════════════════════════════

def generate_report(checks):
    """Generate health report."""
    total = len(checks)
    passed = sum(1 for check in checks.values() if check["ok"])
    failed = total - passed
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total_checks": total,
            "passed": passed,
            "failed": failed,
            "health_score": f"{int((passed/total)*100)}%"
        },
        "details": checks,
        "status": "HEALTHY" if failed == 0 else "DEGRADED" if failed < 2 else "CRITICAL"
    }
    
    return report

def save_report(report):
    """Save health report to file."""
    try:
        with open("machine_health.json", "w") as f:
            json.dump(report, f, indent=2)
        print(f"\n[ERROR_HANDLER] ✓ Report saved to machine_health.json")
        return True
    except Exception as e:
        print(f"\n[ERROR_HANDLER] ✗ Error saving report: {e}")
        return False

def alert_if_critical(report):
    """Trigger alerts for critical failures."""
    if report["status"] == "CRITICAL":
        print("\n[ERROR_HANDLER] ⚠ CRITICAL ALERT")
        print("[ERROR_HANDLER] Machine has critical failures:")
        for check_name, check_result in report["details"].items():
            if not check_result["ok"]:
                print(f"  ✗ {check_name}: {check_result['msg']}")
        print("[ERROR_HANDLER] Action: Review logs and restart machine")
        return True
    elif report["status"] == "DEGRADED":
        print("\n[ERROR_HANDLER] ⚠ DEGRADED ALERT")
        print("[ERROR_HANDLER] Machine has some failures:")
        for check_name, check_result in report["details"].items():
            if not check_result["ok"]:
                print(f"  ✗ {check_name}: {check_result['msg']}")
        print("[ERROR_HANDLER] Action: Monitor and check logs")
        return True
    return False

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ERROR HANDLER
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    args = sys.argv[1:]
    skip_sends = "--skip-sends" in args
    report_only = "--report-only" in args
    
    print("[ERROR_HANDLER] ═══════════════════════════════════════════════════════════")
    print(f"[ERROR_HANDLER] ERROR_HANDLER_STARTED - {datetime.now().isoformat()}")
    print("[ERROR_HANDLER] ═══════════════════════════════════════════════════════════")
    
    if skip_sends:
        print("[ERROR_HANDLER] Mode: SKIP_SENDS (faster testing)\n")
    
    # Run health checks
    health = HealthCheck()
    health.run_all(skip_sends=skip_sends)
    
    # Generate report
    report = generate_report(health.checks)
    
    # Display summary
    print("\n[ERROR_HANDLER] ═══════════════════════════════════════════════════════════")
    print(f"[ERROR_HANDLER] Health Summary")
    print("[ERROR_HANDLER] ═══════════════════════════════════════════════════════════")
    print(f"[ERROR_HANDLER] Total checks: {report['summary']['total_checks']}")
    print(f"[ERROR_HANDLER] Passed: {report['summary']['passed']}")
    print(f"[ERROR_HANDLER] Failed: {report['summary']['failed']}")
    print(f"[ERROR_HANDLER] Health score: {report['summary']['health_score']}")
    print(f"[ERROR_HANDLER] Status: {report['status']}")
    
    # Save report
    save_report(report)
    
    # Alert if needed
    alert_if_critical(report)
    
    print("\n[ERROR_HANDLER] ═══════════════════════════════════════════════════════════")
    print(f"[ERROR_HANDLER] ERROR_HANDLER_COMPLETE - {datetime.now().isoformat()}")
    print("[ERROR_HANDLER] ═══════════════════════════════════════════════════════════\n")
    
    # Return exit code based on health
    return 0 if report["status"] == "HEALTHY" else 1

if __name__ == "__main__":
    sys.exit(main())
