This document is the current strategy summary for the HudsonSeed Pitching Machine, with Layer 2 as the current focus.

It is duplicated here from the dedicated LVL2GB repo for convenience. See the full version and supporting files in https://github.com/trevorvaughan-ux/LVL2GB for the Layer 2 workspace.

---

## Core Philosophy (Non-Negotiable)

- Zero pressure. Ever. Desperation is the worst cologne.
- B2B only (schools and districts). No consumer, no ads, no tracking pixels.
- Value-first, long-cycle nurturing (6–18 months).
- The machine must be **antifragile**: a simple but working Layer 1 that can still deliver ~85% value is better than a complex system that crashes and delivers 0%.
- Google Sheets is the primary human operating layer (phone-friendly, visible, trustworthy).
- Pre-staging of campaign data (sheets or CSVs created days ahead) is a first-class feature.
- We are Google — we should be all sheets where it makes sense for the human experience.

## Layer Model

### Layer 1 — Outbound (The Proactive Pitching Engine)
Generates and sends outreach. Must remain independently runnable ("dumb" or pre-staged mode) even if Layer 2 or the sync systems are unavailable. Primary input is "the dough" — a clean list of leads.

### Layer 2 — Response & Intelligence Layer (Current Focus)
Handles replies, visibility, prioritization, Google Meet scheduling, materials, and value touches (Friday Moment, breathing videos, Science of Calm, etc.). Lives primarily in Google Apps Script + the master Google Sheet.

Manages parallel tracks rather than a purely linear funnel:
- Sales track: Active outreach remains possible.
- Value / Community track: Once someone is labeled Community, they move into the "value bucket" as the primary/default engagement mode. They receive nurturing/value content by default. They can still be in active sales conversations, but value nurturing becomes the default.
- Hard stop: Unsubscribed (nothing else goes out, ever).

Layer 2 is the intelligent *response* to Layer 1. It is not required for Layer 1 to function.

## Modular Architecture (Key Design Choice)

The system is deliberately broken into semi-independent blocks:

- **Data Ingestion Layer** (future): Brings in leads from many sources (pre-staged Sheets/CSVs, Supabase, email, social media, AI-generated lists, etc.) and normalizes them. Social media will eventually feed the Community/value track.
- **Supabase ↔ Google Sheets Sync**: Its own dedicated, schedulable unit. Can be improved or paused independently.
- **Layer 2 (Response + Intelligence)**: Includes the Community/value block as its own semi-separate track.
- **Layer 1 (Outbound)**: Must always have a working "dumb" path.

This modularity enables antifragility and the "pull a sheet from Drive and treat it as the dough for the next pasta" workflow.

## Daily / Campaign Sequence (Seamless in the Sheet)

1. Handle responses and make decisions in the Google Sheet (Layer 2).
2. One action (or export) produces a clean feed for outbound.
3. Layer 1 consumes that feed (or a pre-staged version) for the next round.
4. Repeat.

Pre-staging of campaign sheets in Drive is encouraged and supported.

## Antifragility Rules

- Layer 1 must always be able to run from a simple sheet/CSV export or local file, even if the fancy Layer 2 scripts, sync, or connector are down.
- Status decisions (especially Unsubscribed as a hard stop and Community as a shift to the value track) are respected when the connection is healthy, but never become a hard dependency.
- The Supabase ↔ Sheets sync is intentionally its own module.
- Multiple independent ways to get "the dough" for Layer 1 are supported by design.

## Current Focus

Layer 2 is the current priority. The goal is a clean, complete, reviewable Layer 2 implementation (Apps Script + supporting sheet patterns) that treats the Community/value track as its own block and provides a seamless handoff to Layer 1. This version should be presentable to other AI models (Claude, Gemini, etc.) for review and iteration.

---

For the full detailed version and supporting code, see the LVL2GB repo: https://github.com/trevorvaughan-ux/LVL2GB