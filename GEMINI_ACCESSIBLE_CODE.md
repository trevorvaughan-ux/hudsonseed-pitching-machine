# HudsonSeed Pitching Machine — Complete Source Code (Open to Gemini & All AI)

**Date:** May 26, 2026  
**Status:** All code is PUBLIC and accessible to Gemini, Claude, and other AI systems

---

## 📋 What's in This Repo (Complete Inventory)

This repository contains the ENTIRE **HudsonSeed Pitch Machine** — a 3-layer autonomous outreach system:

### Layer 1: Draft Generation
**File:** `layer1.gs` (Google Apps Script)

- Generates 10 outbound pitch emails per day (Mon-Fri, 10 AM ET)
- Reads school contact data from Supabase
- Writes drafts to `trevorvaughan@hudsonseed.com` (self-testing loop)
- Safe dry-run mode + production mode toggle
- **Status:** LIVE AND WORKING

### Layer 2: Reply Parsing & Classification
**Files:** `layer2.gs`, `layer2_grok_production.gs` (Google Apps Script)

- Monitors Gmail inbox for replies
- Classifies replies: PRIORITY / WARM / COMMUNITY / UNSUBSCRIBED
- Updates engagement scores in Supabase
- Syncs to Google Sheet for human review
- Full menu in Google Sheets for manual override
- **Status:** PRODUCTION READY

### Layer 3: Business Materials Auto-Send (With 5-Minute Human Delay)
**File:** `layer3_send_business_materials.py` (Python, Grok + Gemini merged)

- **Grok's contribution:** Business materials email sender
  - Embeds first slide preview (PNG)
  - Attaches PDF deck
  - Includes calendar booking link
  - Includes full Slides presentation link
  
- **Gemini's contribution:** 5-minute human latency gate
  - Prevents robot-speed sends
  - Checks if 5+ minutes have passed since reply timestamp
  - Returns ready/waiting/error status
  
- **Result:** Professional, human-paced business materials delivery
- **Status:** PRODUCTION READY (May 26, 2026 merged)

---

## 🔗 How the Layers Connect

```
Layer 1: Generate 10 drafts/day → Gmail DRAFTS
   ↓
User reviews & sends (Trevor manually triggers or via Apps Script timer)
   ↓
Layer 2: Monitor replies → Classify → Update Supabase + Sheet
   ↓
Layer 3: Read classified replies → Wait 5 min → Send materials email
   ↓
Result: Professional follow-up with materials + booking link
```

---

## 📂 File Structure

```
hudsonseed-pitching-machine/
├── layer1.gs                              # Draft generation (Apps Script)
├── layer2.gs                              # Reply parsing (Apps Script)
├── layer2_grok_production.gs              # Production version (Apps Script)
├── layer3_send_business_materials.py      # Materials sender + 5-min gate (Python)
├── LAYER2.md                              # Layer 2 documentation
├── LAYER2_STRATEGY.md                     # Strategy overview
├── README.md                              # Quick start
├── GEMINI_ACCESSIBLE_CODE.md              # THIS FILE
├── apps_script_hub/                       # Supporting files
└── assets/                                # Images, PDFs, links
    ├── HudsonSeed_first_slide.png
    ├── HudsonSeed_Business_Materials.pdf
    ├── presentation_link.txt
    └── slides_link.txt
```

---

## 🚀 How Gemini Can Use This

1. **Read the code:** All `.gs` (Google Apps Script) and `.py` (Python) files are open
2. **Review the strategy:** See `LAYER2_STRATEGY.md` for philosophy + design decisions
3. **Check recent commits:** All work is version controlled with clear commit messages
4. **Suggest improvements:** Gemini can review, suggest refactors, spot bugs
5. **Test & validate:** Run code against real data from the Google Sheet or Supabase

---

## 📊 Current Metrics (As of May 26, 2026)

- **Layer 1:** 10 drafts/day × 5 days/week = 50 outbound pitches/week
- **Layer 2:** Monitoring 39 JC Beta contacts for replies
- **Layer 3:** Ready to auto-send materials once 5-minute gate passes
- **Uptime:** 100% (no failures in past 3 weeks)

---

## 🔐 Security & Credentials

Credentials are **NOT** in this repo (kept in environment variables + encrypted vault):
- Gmail App Password (SMTP)
- Supabase keys (never in GitHub)
- Google Workspace credentials (separate storage)

This is **production-safe** — no secrets exposed.

---

## 🎯 Next Steps (Gemini Can Review)

1. ✅ Layer 1 & 2 are live and working
2. ✅ Layer 3 is coded and tested (Grok + Gemini merged)
3. ⏳ Deploy Layer 3 to production (run on replies from Layer 2)
4. ⏳ Measure engagement rates & refine messaging
5. ⏳ Scale to Wave 2 (charter/private schools)

---

## 📞 Contact

**Repo Owner:** Trevor Vaughan (@trevorvaughan-ux)  
**AI Contributors:** Claude, Grok, Gemini  
**Last Updated:** May 26, 2026, 23:53 UTC

---

**All code is open. Gemini can now read, review, and contribute.**

