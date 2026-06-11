# CLAUDE STATUS | 2026-06-10 (June 10, 2026) | READ THIS FIRST ON WAKE-UP

NO SECRETS IN THIS FILE. Credentials come from Trevor's vault upload.

## ONE-LINE RESUME
Beta = machine writes DRAFTS ONLY, Trevor reviews + sends manually. 22 clean drafts staged. Email auth all green. Deck v2 live in this repo. Next: send drip starting with Valerie Roper.

## ARCHITECTURE (LOCKED - do not relitigate)
- LINK PRE-FLIGHT RULE (locked 2026-06-11): Any Drive-hosted asset referenced in outreach MUST be verified shared (anyone-with-link, reader) via get_file_permissions BEFORE the link ships anywhere. Drive uploads default to PRIVATE - an unshared deck link means principals hit a Request Access wall. Claude cannot change sharing settings (account permission boundary) so Claude must verify and flag, Trevor flips. Deck v2.0 Drive copy (1juIR6nViMsRkpDQzcDddCqNkzzQqJmCQ): VERIFIED anyone/reader 2026-06-11.
- ARCHIVE RULE (locked 2026-06-10): Nothing is deleted, it is archived. Old/superseded files move to _archive/YYYY-MM-DD/ with a README tombstone explaining what each was. Exceptions: accidental junk (diagnostic artifacts) may be git rm-ed since git history preserves everything; Gmail items use Trash (30-day recovery).
- Pitch Machine runtime = Google Apps Script + Google Sheets (source of truth) + Supabase (write-only pushes)
- Railway = WEBSITE ONLY. Pitch Machine has zero Railway dependency.
- Classification binary: COMMUNITY or NOT. No tiers.
- Pixel ban absolute. Replies are the only engagement metric.
- Em-dashes banned in ALL copy (deck, site, emails). The AI tell.
- NO guest-code promises in any outreach. No mechanism exists.
- Vendor 9615 claims: JC PUBLIC schools only, subject line + email body. Never private schools, never NYC, never in the deck.
- From address = human name (trevorvaughan@). Role addresses get deleted by principals.

## TODAY'S VERIFIED WINS (June 10)
1. Deck v2 BUILT+VERIFIED: HudsonSeed_Asynchronous.pdf in this repo. Beta language stripped, PD-day anchor x2 ("less than the cost of one PD day"), new Class Close closing slide (ritual + 10-min ask + contact), zero em-dashes (machine-audited), 9 live hyperlinks, footer URL every page.
2. DECK_URL in Code.gs repointed: old editable Slides link -> versioned GitHub PDF (commit 4b0a7f7). assets/presentation_link.txt synced.
3. Website mirrored to deck v2 (hudsonseed-website repo, commits 86ad7ed + 8f46131): title "HudsonSeed | The Science of Calm", SEO/OG meta tags, video poster frame + autoplay fallback (video rendered invisible when autoplay blocked - fixed), beta language gone, PD-day anchor in Worth It, Hanuman bubble voice fixed.
4. Gmail drafts cleaned: trashed 5 rogue Pingry drafts (em-dashes + guest-code promises + vendor 9615 claims to a PRIVATE school - triple rule violation), Stevens Coop (Trevor killed it June 9), old PS 22 guess-address draft. All recoverable from Trash 30 days.
5. PS 22 draft rebuilt: Dr. Janine Anderson, janderson@jcboe.org (pattern-derived - flag on first bounce).
6. Mile Square mystery solved: old Squarespace site is disconnected, Trevor has no login. Stale Google index only. Apex domain already serves new site (verified via Trevor screenshot). Meta tags will flush old titles on reindex.

## DRAFT INVENTORY (22 clean, ready for Trevor's manual send)
- 1 Valerie Roper (CSS, 9 JC community schools, CC Janeen Maniscalco) <- SEND FIRST, highest value
- 10 JC public w/ Vendor 9615 subject: PS 6, 14, 22, 27, 28, 33, 37, Ferris, Infinity, Liberty
- 10 NYC @schools.nyc.gov: Campbell, Bender, Chory, Rippe-Hofmann, Agostinelli, Najjar, Severin, Fong, Sestak, Esposito
- 1 The Hudson School (info@, "Dear Head of School")
- Known cosmetic: links are Gmail-wrapped google.com/url redirects. Works, looks mediocre. Fix only if rebuilding drafts anyway.

## OPEN QUESTIONS / RISKS
0. LINK CORRUPTION (found 2026-06-11, CONFIRMED NOT COSMETIC): Every draft created via API (Apps Script Layer 1 AND Claude MCP create_draft) gets URLs wrapped in a broken google.com/url redirect with a corrupted character (= becomes control char in ust param). PROVEN: sent emails deliver the ugly wrapper as visible link text (Abbruscato 6/11). Controlled test confirmed Claude MCP pipeline wraps at creation. RULE: never put URLs in API-created draft bodies. FIX for existing drafts: Trevor deletes the link line and types www.hudsonseed.com fresh in Gmail compose during his send review (typed-in-UI links are clean). FIX for future drafts: replace the URL in the Layer 1 source template (Google Sheet) with plain text www.hudsonseed.com and verify the next machine-generated draft.
1. WHO generated the 5 Pingry drafts at 3:08 AM June 10? Not Claude. Off-spec content (banned promises, wrong vendor claims). Suspect Grok or Gemini session, or an unaccounted cron. INVESTIGATE before any agent gets send authority.
2. Railway graveyard: pretty-liberation has 3 broken services (hudsonseed_pm crash-looping, hudsonseed-pitching-machine + ample-recreation fail-building on every push to this repo). They spam failure emails. TREVOR: delete all three services in Railway dashboard, keep only the website service.
3. Website Railway deploy trigger UNVERIFIED: pushes 86ad7ed/8f46131 produced no failure email but live title had not flipped at last check. If tab still shows "HudsonSeed - The Science of Calm" with a dash instead of pipe, redeploy the website service manually in Railway.
4. GitHub PAT exposed in multiple chat sessions + this repo is PUBLIC. Rotate PAT, consider making repo private (note: deck blob URL in outreach emails requires PUBLIC repo - if going private, move deck hosting first).
5. Corrupt 2,730-byte "HudsonSeed_Asynchronous_Deck.pdf" in Trevor's Drive root from a failed truncated upload. Trevor: trash it. Real deck lives in this repo.

## TREVOR'S 5-MINUTE MANUAL QUEUE
1. Railway: delete the 3 dead services (keep website service)
2. Drive: trash the corrupt deck PDF
3. Apps Script health monitor: 3-min setup from prior session (script.google.com, paste, two script properties, run createTrigger + testRun)
4. Rotate GitHub PAT when convenient

## NEXT WORK QUEUE
1. Send drip: Valerie first, then JC publics ~10 min apart, watch bounces (PS 22 janderson@ is pattern-derived)
2. Hudson School: find actual Head of School name, upgrade draft
3. Pingry rogue-agent investigation
4. Layer 2 reply-classification watch once sends begin
