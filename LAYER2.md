## Layer 2 — Response Handling & Visibility (HudsonSeed Pitching Machine)

**Important:** Layer 2 work lives in a dedicated repo:

**https://github.com/trevorvaughan-ux/LVL2GB**

### What is Layer 2?

- Layer 1 (in this repo) = Outbound outreach (generating email drafts for districts)
- **Layer 2** = Inbound response handling, visibility, and prioritization

Layer 2 is responsible for:
- Capturing and organizing replies from schools/districts
- Making it easy to see which leads are hot / need a call (the "actionable bar")
- Tracking status so people don’t get spammed
- Supporting community/nurture tracks for contacts who haven’t bought yet

### Current Status (as of May 24, 2026)

We are building Layer 2 as an MVP, starting with the real live **Beta 1.1 – Jersey City** (39 public + 10 private schools).

The goal is to have something actually usable for the current campaign within days, not months.

### Where to Find the Work

- Main Layer 2 repo: https://github.com/trevorvaughan-ux/LVL2GB
- Recommended Google Sheet structure: `docs/MVP_Sheet_Structure.md`
- Starter Apps Script for response tracking: `apps_script/Layer2_Response_Tracking_MVP.gs`

### How This Connects to the Rest of the Machine

- Data lives in Supabase (contact-centric model)
- Google Sheets is the primary human-readable layer
- Layer 1 (draft generation) lives in this repo
- Layer 2 (this repo) will eventually feed clean, prioritized leads back into Layer 1 and future campaign automation

If you’re looking for the code or thinking for response handling, visibility, and running the "back half" of the outreach machine, start in the LVL2GB repo.

---

**Owner:** Trevor Vaughan
**Status:** Active development (MVP phase)