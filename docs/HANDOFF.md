## Logic merge and audit fixes — 2026-09-26

- Integrates main `225d4ab` and logic branch `1a7483c`. Retains main's admission-aware run APIs, stricter SQLite schema and write-once trigger, instead of a second incompatible persistence module. Incoming WPM evidence is supported by the canonical run validator; version fixtures follow the shared constant. Existing SQLite integration tests cover canonical persistence; the incoming duplicate test/module are superseded.
- Incoming sensors, engine, HUD and lifecycle checks retained. Diagnostic UI requires explicit `SURVIVAL_DIAGNOSTIC=1`; default public pages do not offer fake local acknowledgements or unsaved scores. Diagnostic pauses on the current `/leaderboard` route.
- Audit fixes and verification are recorded below when complete. Never seed/reset the shared database for validation.

# Takeover record — 2026-09-26

## Restore registration leaderboard column — 2026-09-26

- Owner reiterated that rankings must be visible beside username/designation entry. Restored gate-board layout and shared top-five LeaderboardContent alongside the latest teammate designation challenge, with All rankings linking to the existing leaderboard page. Desktop is two columns; mobile stacks below entry. Existing CAPTCHA and new transmission logic preserved.
- Production build/TypeScript pass; lint has zero errors and three pre-existing script warnings. Browser confirmed real SQLite rankings on desktop and 375px without overflow. No database writes, CAPTCHA attempts, or synthetic data. Preview starts Next directly to avoid the newly added automatic db-check/reseed hook, while still using the real database.
- Live audit: public gate updated during review after a brief series of Zo 502s that recovered. Column still absent in last public observation. Other findings and new transmission/reply bugs are recorded in the workspace reviews/onlybots-live-audit.md; no deployment access is configured in this task. A push alone is not confirmation that Zo has deployed it.

## CAPTCHA leaderboard cleanup — 2026-09-26

- Following the owner’s best-time discussion, simplified the displayed leaderboard to each verified user’s fastest successful image CAPTCHA, ascending duration. Equal times sort by handle deterministically. Other challenges, failed attempts, invalid durations and system are excluded. Reads existing attempts directly; no new score table or writes.
- `/api/leaderboard` now returns `{ handle, bestTimeMs }[]`; shared LeaderRow/isLeaders contract and both views updated. Query lives in lib/leaderboard.ts. Removed survival mode state, stages/objectives/round counts and unused mode CSS from leaderboard presentation. Survival backend, types and tests remain separate for teammate work.
- Production build/TypeScript and lint pass. Two response-validator tests pass. Read-only SQLite checks covered best-of-repeat, ties, failed/other-game exclusion, null/negative durations and unverified/system exclusion using query-scoped cases on the real database (no writes or new database files). Browser confirmed actual @vlad 5.758s in desktop/mobile views, 375px without overflow. Mutation smoke not run.
- Preview 3101 remains on the real database. Merged and pushed to main. Next: check the live deployed leaderboard after deployment.

## Registration leaderboard — 2026-09-26

- Added a top-five leaderboard beside the gate/registration flow, stacking beneath it below 760px. Extracted shared LeaderboardContent so the gate and existing feed dialog use the same survival rankings, input modes, polling and loading/error/retry states. No score, CAPTCHA or admission changes.
- Build/TypeScript, lint and whitespace checks pass. Browser verified anonymous registration, both mode selectors, 375px layout without overflow, and feed dialog open/close after extraction. Real database has no qualifying saved survival runs; verified the honest empty state. Populated/error states were not fabricated or exercised. No DB writes or mutation tests. Preview 3101 uses the real SQLite database.

## onlybots identity and simplified verdict — 2026-09-26

- Owner confirmed the product name onlybots and rejected the overloaded result card/captions. Updated visible gate/header/accessibility labels and page metadata. Kept internal cookie names and database paths stable so existing admission continues to work.
- Full result now uses an open typographic layout: Access denied / You’re in, one identity/result ID line, and compact humanity/elapsed/movement numbers. Removed the card, stamp, duplicate status/avatar, score gauge and extra gate copy. Kept actual measurements, result details and existing continue/retry actions. New image-result reasons use direct selection explanations; known historical wording is cleaned only for display. Scoring/admission logic unchanged.
- Lint, production build/TypeScript and all six CAPTCHA tests pass. Updated one expected reason assertion after the copy change. Browser inspected pass/fail rendered from real SQLite records, verified a 375px layout without horizontal overflow, and confirmed onlybots in the live feed/header/tab title. Temporary static review files were removed; no synthetic results, database writes, resets or submitted CAPTCHA attempts.
- Local merge only, no push/deployment. Preview 3101 remains running with the real database. Next: rehearse a fresh result and the presentation flow.

## Retry after admission — 2026-09-26

- Fixed the missing path back to the reverse CAPTCHA: feed sidebar now has Retry CAPTCHA, opening `/?retry=1` with the server-admitted identity. Ordinary `/` still redirects admitted visitors to the feed. Anonymous retry requests show the username gate and cannot bypass admission.
- Back to feed allows abandoning an unsubmitted retry. Existing image-failure behavior still clears admission, and the return action disappears after a recorded failure. Existing result/retry UI and scoring are unchanged.
- Build/TypeScript, lint and whitespace checks pass. Browser verified @vlad → retry → fresh nine-tile test → Back to feed with admission intact. Read-only HTTP checks verified anonymous retry and protected feed routing. Updated gate smoke assertions; full mutation suite not run against the real SQLite database. No CAPTCHA solved or result submitted during this check.
- Preview 3101 remains on the real database. Locally merged; no push/deployment. Next: user rehearses pass/fail on the retry path.

## Fixed CAPTCHA rule with independent monitoring — 2026-09-26

- Owner explicitly requested no rotating rules and movement time as another metric. Integrated teammate main `5fc1e00`, then restored the original requested-category plus look-alike selection rule and 120-second window. Click order, corrections and pauses do not reject a correct selection; expiration still does. Original elapsed-time humanity scoring restored. Opaque tile URLs and issuance limits remain.
- Added bounded mouse/pen movement duration, distance and sample count during the image challenge; click corrections and longest pause remain recorded. Monitoring is descriptive, not an admission condition. Results expose these measurements in a compact disclosure. Touch/keyboard attempts without pointer samples report movement as not recorded. Client-reported measurements are not proof of identity.
- SQLite: owner requires the real database only. Preview 3101 uses `/home/vlad/hack/bot-only/data.db`, configured in ignored `.env.local`. Earlier isolated preview/test databases created for this task were removed. No seed/reset or database files included in this commit.
- Validation: 55 pure unit tests, lint, production webpack build (including TypeScript), and whitespace checks pass. Regression coverage includes fixed-rule generation, corrected/paused/reordered successful selections, movement sampling and malformed metric rejection. Smoke expectations updated but API mutation tests were not run against the real database. Physical mouse/touch rehearsal remains to do.
- Feed removals and server-checked admission preserved. No global survival runtime introduced. Local integration only; no push/deployment. Next: rehearse one failed and one passed attempt, inspect movement metrics, then enter the feed on the presenter machine.
## G05 — survival persistence and leaderboard panel — 2026-09-26

- Branch `feat/g05-leaderboard` from origin/main `5fc1e00`; pushed, not merged. Files: `src/lib/db.ts`, `src/lib/survival/runs.ts` (server), `src/lib/survival/scores.ts` (client-safe), `src/app/api/runs/**`, `src/app/api/scores/route.ts`, `LeaderboardPanel.tsx`, `FeedClient.tsx`, `globals.css`, `scripts/seed.mjs`, `scripts/leaderboard-smoke.mjs`, `tests/survival-runs.test.mjs`, `package.json`.
- Schema: additive `game_runs` and `game_objective_events` exactly as the plan, with CHECKs, a best-run index and a write-once trigger for binding and terminal fields. FK clauses are declared but SQLite FK enforcement stays off (no pragma change); references are checked in code. Seed now clears both tables with the rest of the network data.
- API: `POST /api/runs`, `POST /api/runs/:id/bind` (identity from the admission cookie; body handle must match), `POST /api/runs/:id/finish` (16384-byte limit), `GET /api/scores?inputMode=…[&rulesVersion=…]`. Start/bind/finish go through `operation()` with normalized payloads. Finish requires `completedObjectiveIds` to equal the run's `game_objective_events` set, so it is `[]` until G06 writes events.
- Contract decisions: version/mode/completion-set disagreement with the stored run is 409; malformed or self-inconsistent snapshots are 400; finishing a bound run without that admitted identity is 403; binding an ended unbound run is 409; a malformed URL run ID is 400. Whether a measurement actually crossed its limit is not enforced (only the plan's bounds, units and config thresholds); the deadline threshold accepts the issuing-stage budget or the 60000 admission budget within 1e-6 ms of float rounding. The score list is capped at 100 rows.
- Legacy: bare `GET /api/scores` and `POST /api/scores` are unchanged because `scripts/smoke.mjs` still uses them; the survival board never reads that table. Retire them when smoke migrates.
- Panel: reads the survival query with a Pointer / Touch or keyboard switch and distinct loading, empty, error and stale states. `onOpenChange(open)` is true on open and false on close, Escape, backdrop and unmount; G04 connects it to the `leaderboard` pause reason (comment at the FeedClient mount). The feed header has a Leaderboard button.
- Checks: `npm test` now passes `--experimental-sqlite --experimental-transform-types` (Node 22.12 needs the sqlite flag; `server-input.ts` uses a parameter property that strip-only mode rejects). 61/61 tests passed (8 new). Isolated server on :3300 with `/tmp/claude-1000/lb-test.db`: leaderboard smoke 7/7, smoke 41/41, gate smoke 10/10; server stopped. tsc and `eslint src scripts tests` clean. Browser at 375px: feed header and panel, no horizontal scroll, mode switch, Escape close and reopen; desktop header viewed.
- Not run: production build, a real game run (G04 absent), the `onOpenChange` consumer, touch devices. Next: G04 calls start/bind/finish and wires `onOpenChange`; G06 records objective events.

## Combined UI and survival merge — 2026-09-26

- Owner requested pulling and merging all current work after removing recent results/activity. Fetched main `ee2bd38` and `feat/fail-states` `e2a4db6`; integrated both with local UI/admission changes and removal commit `cd22b59`. Current feed remains posts, composer and objectives; no recent-results/activity/footer counter.
- Preserved teammate survival config, engine, detectors and tests byte-for-byte. Shared types merge includes both current CAPTCHA metadata and survival contracts. Resolved documentation conflicts by retaining both handoffs, recognizing G01–G08 as the survival plan, and retaining owner-approved CAPTCHA/admission/presentation behavior. No G04 browser runtime/HUD/sensors or G05 persistence is implemented by this merge.
- Retained HEAD's tracked `data.db` exactly. Excluded incoming `data.db-wal` and `data.db-shm` runtime snapshots; those are ignored by current main. Shared demo DB untouched. No database-reset migration or seed run.
- Passed full production webpack build with TypeScript, lint, all 53 unit tests, 35 API smoke checks and 10 admission checks (98 total). Full build regenerates Next types, resolving the teammate's previously documented stale generated-route typecheck limitation. API tests used isolated `/tmp/bot-only-merge-qa-rWdD4J/data.db`; QA 3102 stopped afterward.
- Browser reloaded the merged preview and confirmed `@vlad` stays admitted and removed sections remain absent. Preview 3101 session `52051` uses isolated preview data and remains running. Local main updated; no remote push or deployment.
- Next integration slice is G04 from MAIN_GAME_PLAN. Coordinate its persistent provider with existing gate navigation/admission behavior; do not treat currently unconnected detector math as live browser enforcement. Full device/interactive survival rehearsal remains unrun.

## G05 — persistence — 2026-09-26

- Implemented additive `game_runs` / `game_objective_events` schema with enum, nullable terminal-state, FK, uniqueness and numeric CHECK constraints. Added exact-shape, byte-limited start/bind/finish handlers using atomic operation receipts. Start/bind/finish duplicate IDs replay; changed payload conflicts; a bound identity cannot change. Finish validates the frozen v3 wire snapshot/evidence contract, compares completed IDs with persisted objective events, writes terminal state once, and reports ranking eligibility only for bound failed runs. Scores now require input mode, filter current rules version, select one whole best failed run per bound user, and exclude anonymous/interrupted runs. Legacy caller-selected score POST returns 410.
- Recovery: definite 4xx errors leave the run unchanged; a save failure rolls back its terminal row and operation receipt, so the identical request may be retried. Same finish ID/payload replays the original receipt; another ID after terminal storage or a changed payload conflicts. Objective events table is ready, but G06 owns writing/validating those action-linked receipts.
- Focused acceptance: `npm test` now runs Node's transform-types and SQLite flags and passed all 7 test files including 4 API integration cases against a unique `/tmp` database. Coverage includes duplicate/conflicting start/bind/finish, strict evidence/no mutation, FK enforcement, injected terminal save failure + identical retry, best-run preservation, mode filtering, anonymous/interrupted exclusion, and retired score writer. Expected injected SQL failure emitted the normal server error log while returning 500. The test removes its temporary database directory.
- Scoped ESLint and `git diff --check` pass for changed implementation/test files. TypeScript command reaches only the previously recorded generated references to missing `src/app/leaderboard/page` and `src/app/verify/page`; no new source errors were reported. Full application typecheck therefore remains unavailable. No server was started. Pre-existing `data.db-shm` and `data.db-wal` edits were preserved and not inspected or modified.
- Limits: survival start/bind/finish are implemented but the G04 provider still uses local diagnostic start/results; no ranked client flow is wired. G06 objective writers are absent, so only the empty persisted objective set can currently finish. No leaderboard UI migration, terminal action blocking, browser/device acceptance or production rehearsal is claimed.
- Branch/commit: `feat/fail-states`, HEAD `7bbb74a` before this uncommitted increment; no merge/push/deploy. Files changed: `src/lib/db.ts`, `src/lib/survival/persistence.ts`, `src/app/api/runs/**`, `src/app/api/scores/route.ts`, `tests/survival-api.test.mjs`, `package.json`, this handoff and `docs/MAIN_GAME_PLAN.md`. Next: G06 objective receipts across registration, posts and likes plus provider/page integration.

## G04 — acceptance complete for diagnostic increment — 2026-09-26

- User confirmed navigation, failures, reload interruption, HUD visibility/stickiness, typing and pause/resume; accepts current usability. G04 diagnostic increment is complete on that playtest evidence plus focused engine/adapter/lifecycle checks. Next is G05 persistence; no G05 work started.
- Added tests/survival-provider-lifecycle.test.mjs. Transpiles the actual GameProvider with installed TypeScript and executes its effect using a controlled hook host, document/window EventTargets and fake clock/storage. Setup -> cleanup -> setup retains exactly one timer/listener set; a running run survives replay, time advances once, final cleanup removes callbacks, and restored checkpoints remain neutral interruptions through replay. No gameplay code changes needed.
- Verification: two lifecycle tests pass; full npm test passes six files; scoped test ESLint, source-only TypeScript and git diff --check pass. Existing typeless-package warning remains. No new dependencies/server/database work.
- Limits: this is effect-replay verification, not a mounted React/browser StrictMode integration test. No connected browser is available. User playtest reports do not establish all viewport/device coverage, pause-overlap combinations or storage-denial recovery. Full responsive/device calibration and broad rehearsal remain G08; no ranked detector enforcement claimed. G05 storage/API, G06 objectives and G07 terminal mutation blocking remain unavailable.
- Branch/commit: feat/fail-states, implementation 42b1c1c. New lifecycle tests and acceptance notes are uncommitted. Pre-existing staged database journals remain untouched. Next: G05 isolated persistence checks.


## G04 — user browser acceptance report — 2026-09-26

User reports navigation works, failures work, reload stops the run as intended, and usability is sufficient for this increment. Earlier reports confirmed HUD visibility/stickiness and typing detection. Treat these as user playtest evidence, not automated or full responsive/device coverage. User has not verified pauses or Strict Mode lifecycle. Explained automatic hidden-tab/focus/leaderboard pauses and explicit Resume countdown; remaining checks are pause overlap/budget preservation and development lifecycle duplication/cleanup. Branch feat/fail-states, implementation commit 42b1c1c; this acceptance note is uncommitted. No code/server/database changes.


## G04 — diagnostic commit — 2026-09-26

User authorized committing the current increment. Branch feat/fail-states; commit titled `Add global survival diagnostic and progressive typing speed`, based on e2a4db6. Includes provider/sensors/HUD/result, layout stacking fix, sticky HUD, leaderboard pause hookup, survival-v3 typing minima (20/30/40/50/60 WPM), tests and current documentation. User confirmed HUD visibility and typing behavior; remaining G04 browser acceptance is still pending. Full five-file suite, scoped lint, source-only TypeScript and whitespace checks passed after final tuning. Database journals were already staged externally and are excluded from this commit without changing their staged state. No push/merge/deploy.


## G04 — faster typing minimums — 2026-09-26

User confirmed typing works but the minimum is too slow. Raised stage minima to 20/30/40/50/60 WPM; speed evidence, equality and bad-window counts unchanged. Rules version is now survival-v3; prior diagnostic checkpoints require a new run. Updated boundary/engine fixtures and current plan. Full tests, scoped lint, source-only TypeScript and whitespace checked. Branch feat/fail-states, uncommitted atop e2a4db6. Further real-device calibration remains G08.


## G04 — authorized typing-speed rule — 2026-09-26

- User requested a minimum typing speed that starts slow and ramps with difficulty. Added stage minimums 10/15/20/25/30 WPM in config; speed equals 12000/mean insertion interval across the existing eight intervals. Equality passes; below minimum is one bad typing window. Consistency still applies. Slow windows take evidence priority over consistency and share the existing typing failure counter; no double counting. Short bursts and excluded sources remain insufficient/unscored.
- Explicit authorized contract revision: rules version survival-v2, stage typingMinWpm, optional detector typingMetric and WPM terminal evidence. HUD shows current/upcoming minimum; all other thresholds unchanged. G05 must validate speed evidence below the configured minimum. Existing v1 checkpoints now show visible incompatible-checkpoint recovery rather than resuming mixed rules.
- Added every-stage equality/faster/slower fixtures and engine WPM-failure evidence check. Initial test run caught outdated exact-key and slow-typing expectations; updated for the intentional new rule. Full suite, scoped lint/source-only TypeScript and diff check results recorded in final response. Real-device speed calibration remains pending G08. No database/API changes; no commit yet. Branch feat/fail-states atop e2a4db6.


## G04 — sticky HUD — 2026-09-26

User confirmed the stacking fix makes the diagnostic visible. On request, HUD now uses sticky positioning at top 0 with z-index 40, above the existing sticky header (30), retaining its normal-flow space. Only CSS changes; clocks/sensors/recovery unchanged. Whitespace check passed; scrolling at phone/desktop and short viewport sizes remains pending. Branch `feat/fail-states`, uncommitted atop `e2a4db6`; next is remaining G04 browser acceptance.

## G04 — blank HUD stacking fix — 2026-09-26

- User confirmed `http://localhost:3000/feed` has blank space above the header. Escalated read-only HTTP check confirmed the HUD/start button were in the served HTML. Layout placed the HUD outside the atmosphere’s isolated stacking context; its fixed full-screen background could paint over the earlier HUD.
- Moved NetworkAtmosphere outside GameProvider so HUD/result/pages share that context and its negative-z background stays behind them. Root provider lifetime is unchanged. Live HTTP response confirms the corrected nesting and Start button. Scoped layout lint, source-only TypeScript and diff checks pass. Visual verification is still pending: no browser surface is available (in-app browser unavailable). No server restarted or database modified. Branch `feat/fail-states`, uncommitted atop `e2a4db6`; next is user/browser confirmation and remaining G04 acceptance.

## G04 — failure visibility follow-up — 2026-09-26

- User reported trying the diagnostic without seeing failure indications. Inspection found bad-window feedback hidden inside collapsed details and the result below page content; the actual runtime cause is not yet established.
- HUD now explicitly labels not-started/active/paused/ended states and shows accumulated bad-window warnings outside details. Result now appears immediately below the HUD, before page content; focus behavior remains intact.
- Full five-file unit suite, scoped component lint, source-only TypeScript and whitespace checks pass. Browser connector inventory has no available browsers, so no live reproduction or visual verification performed. User was asked whether the timer advances, is paused, or the panel is missing. G04 remains in progress.
- Branch `feat/fail-states`, uncommitted atop `e2a4db6`; only diagnostic components/docs changed in this follow-up. Pre-existing database journal changes left untouched.

## G04 — runtime diagnostic implementation in progress — 2026-09-26

- Owner / branch / base: Codex / `feat/fail-states` / G03 committed as `e2a4db6` on user request. G04 changes remain uncommitted; no merge, push or deploy. No new integration; last fetched comparison is recorded below.
- Files: `src/components/game/{GameProvider,GameHud,GameOver}.tsx`, `src/lib/survival/browser.ts`, root layout, global CSS, leaderboard pause hookup, `tests/survival-browser.test.mjs`, plan/handoff. Frozen shared contracts/config/engine unchanged.
- Intended behavior/acceptance: one root engine/listener installation across client routes, bounded sensor windows with no text evidence, hidden/focus/leaderboard pauses, explicit Resume countdown, idle warning then latched failure, reload interruption and accessible unsaved result. This is a labeled local diagnostic, never server-acknowledged or ranked. Objective and save integrations remain G05/G06; terminal network-action prevention remains G07. Existing gate CAPTCHA/feed actions are preserved.
- Implemented: mouse/pen pointer cadence and gap/duration closes, direct editable typing timestamps with source exclusions, per-container actual scroll displacement linked to user intent/inertia, boundary-tail discard; reset partial buffers on pause/route/resize/target changes. Session storage holds bounded metadata for neutral reload interruption; unreadable/unavailable storage is visible. Restart resets engine while preserving network identity/data. Leaderboard acquire/release includes close/unmount; pause overlap uses the existing engine. HUD is in normal document flow and does not cover controls.
- Checks: full npm test passed five files, including three new adapter tests for cadence/cleanup, non-overlapping typing/privacy, scroll intent/inertia and clipped boundaries. Scoped ESLint, source-only TypeScript and git diff --check passed with Node v24.21.0. First lint failed on a render-time ref read; fixed. Initial cleanup test exposed Node EventTarget capture-option removal behavior; explicit options fixed it, then checks passed. Existing generated-route full-TypeScript failures remain recorded below; full check not rerun.
- Not run: real browser/Strict Mode lifecycle, gate↔feed run continuity, reload and storage denial, overlapping focus/visibility/dialog pauses, keyboard focus/result reachability, all viewport/zoom checks, trackpad/touch/pen fairness, full lint/build/API smoke. No server started or database inspected/modified. Automated adapter events are fixtures, not proof of real browser attribution.
- Limits: input origins remain browser heuristics; focus changes discard scroll intent conservatively. Local detector failures are experimental and unsaved; terminal enforcement is not validated for real devices. The diagnostic HUD explicitly describes unavailable objectives/saving and existing network actions after a result. Reload always presents a neutral interruption rather than trusting stored evidence/counters.
- Next: complete G04 browser acceptance and fix observed gaps before marking done; then G05 persistence. Do not claim G04 complete from pure/unit checks alone.

## G03 — pure detector math — 2026-09-26

- Outcome: completed locally; stopped before G04. Owner / branch / commit: Codex / `feat/fail-states` / committed as `e2a4db6`. Files: `src/lib/survival/detectors.ts`, `tests/survival-detectors.test.mjs`, PLAN.md, this handoff and MAIN_GAME_PLAN.md. No shared types/config/engine/page/API changes.
- Base comparison: fetched origin successfully on 2026-09-26 after sandbox escalation; HEAD is 3 ahead / 4 behind origin/main (`ee2bd38`). No integration, commit, push or deployment performed.
- Behavior/recovery: evaluatePointer, evaluateTyping and evaluateScroll return frozen SurvivalDetectorResult using the captured stage. Invalid, oversized or incomplete windows return insufficient_data/null with an explanation and do not qualify as good or bad. Unknown stages throw RangeError. No writes/retries or runtime state. Numeric excess is bad; equality good. Qualified pointer returns within 15px and scroll direction reversals are structural failures even below numeric limits. Pointer measures distance to the endpoint segment, including overshoot; only failing strokes include detached frozen normalized evidence. Typing uses eight positive insertion intervals; scroll uses six signed net displacement bins and CV of absolute speed.
- G04 adapter responsibilities: cap pointer collection at 30Hz; close strokes at gap/duration/down/up and retain at most 24 samples; captured viewport is required (off-viewport/invalid coordinates are unavailable/insufficient). Reset partial windows on engine resets. Partition typing intervals and scroll bins without re-scoring; filter insertion sources, break bursts/targets, trim scroll burst edges, discard clipped boundary tails, identify user intent/inertia and keep containers separate. Evaluators never collect text/keys/DOM events and do not implement timers, source attribution or bad-window counts. Preserve counts in the G02 engine.
- Checks: 11 direct detector tests passed, covering straight/curved/loop/overshoot strokes, all pointer stage equalities, exact path/duration/max-buffer boundaries, regular/irregular typing, gap equality, scroll zeros/reversal/CV equality, invalid/nonfinite/short/oversized arrays, immutability and evidence privacy. Initial fixture run failed two floating-point assertions; projection denominator and fixture assertions were corrected, then all passed. Full npm test passed all four files; scoped ESLint and source-only TypeScript passed using Node v24.21.0. Full TypeScript still fails only on `.next/types/validator.ts` references to missing leaderboard/verify routes. Existing Node typeless-package warning remains. Whitespace check passes.
- Not run: full lint/build, API smoke/seed, browser/device/responsiveness and sensor-origin checks; this is pure math with no installed UI. No database files inspected/modified and no server started. Numeric checks cannot establish real trackpad/touch fairness or browser attribution.
- Next: G04 global runtime/HUD with labeled local diagnostic Start and unsaved results until G05; G08 real-device tuning before terminal enforcement is claimed.

## G02 — pure engine and idle — 2026-09-26

- Outcome: completed G02 locally, stopped before G03. `src/lib/survival/engine.ts` exports `createSurvivalState`, `transitionSurvival`, and `survivalIdleWarning`. It consumes the frozen G01 types/config without changes. No React, DOM, HTTP, database, timer or wall-clock access; the caller supplies monotonic timestamps.
- Owner / branch / commit: Codex / `feat/fail-states` / G02 commit titled `Implement survival engine and idle enforcement`, based on G01 commit `62a1f6a` (`Freeze survival game contracts and validation limits`). G01's six files were explicitly staged/committed after user authorization; sandbox denied index writes, then the approved escalated command succeeded. No push, merge or deployment, and no database paths staged. Earlier fetch failure remains recorded below; this is local work, not integration.
- Behavior: explicit acknowledged Start and countdown; active time advances only while Running. Idle warns at 75%, fails at equality before activity can rescue it, and tightens immediately at stage boundaries. Delayed ticks latch the earliest clock failure instead of granting extra score. Objective deadlines are strictly exclusive for failure: equality permits submission; expiration freezes at the next representable active timestamp after the deadline. Pauses are a set, overlapping owners preserve budgets, and releasing the last reason requires explicit Resume plus a fresh countdown. Countdown completion grants no credit for late delivery. Interruptions produce neutral frozen local results.
- Error/retry: invalid/backward/mixed-timestamp batches throw without changing the caller's state. Replies for a different run are ignored without clock advancement. Pending objective payloads are immutable: uncertainty preserves the pause/payload, identical submission replays locally, definite rejection preserves the objective/budgets, acknowledged completion advances once. Terminal state is latched against late replies; explicit New run clears run counters/receipts/results. Save/network persistence remains outside the engine.
- Adapter contract: call `transitionSurvival(state, event)` for single events or pass all events sharing one timestamp as a batch for simultaneous evidence/precedence. Apply returned `resetDetectors` before collecting new partial windows. Route/input-target/scroll/resize/pause/resume resets do not erase qualified bad-window counts. Browser adapters must emit only qualifying activity, supply G03 detector output with the captured window stage, guard current start-request generations before dispatching start acknowledgement, and issue the next objective after confirmation. Engine does not synthesize input, objectives or server acknowledgements. Pointer windows are ignored in touch/keyboard mode.
- Checks: direct `node --experimental-strip-types tests/survival-engine.test.mjs` passed **21 tests**, covering all G02 acceptance plus countdown cancellation/late delivery, stage-boundary tightening, paused detector/reset behavior, objective deadline equality/expiration/retry, stale responses, captured window stages, bounded cloned trace evidence and interruption. `npm test` passed all three test files. Source-only `npx tsc --project /tmp/bot-only-g01-tsconfig.json --noEmit` and scoped `npx eslint src/lib/survival/engine.ts tests/survival-engine.test.mjs` passed. Commands use the Node v24.21.0 PATH recorded below. Tests register a narrowly scoped Node resolver for the engine's extensionless config import; application bundler settings and frozen contracts are unchanged.
- Full `npx tsc --noEmit --incremental false` still fails only on generated references to missing leaderboard/verify pages, as recorded for G01. Node reports its existing typeless-package module warning during direct TS execution; checks still pass. `git diff --check` passes.
- Not run: full lint/build, API smoke/seed, browser responsiveness/devices or server persistence. G02 is pure local logic and not installed in any page/provider; no live survival behavior or ranked result is claimed. No server started/stopped or database file inspected/modified.
- Next: G03 pure detector math/fixtures, consume frozen G01 contracts. Global browser runtime and activity qualification are G04; HTTP/storage validation is G05. No G03 work begun.

## G01 — frozen survival contracts — 2026-09-26

- Outcome: completed G01 only. `src/lib/types.ts` now exports the exact survival event/state, objective/action receipt, terminal/save and HTTP unions. `src/lib/survival/config.ts` holds immutable `survival-v1` stages, timing/sensor/buffer limits, failure precedence, wire limits and half-open stage lookup. `docs/MAIN_GAME_PLAN.md` §6a freezes pause/retry rules, validation, objective association, score selection and additive schema for later tasks. `PLAN.md` records completion; four focused tests added in `tests/survival-contracts.test.mjs`.
- Owner / branch / commit: Codex / current `feat/fail-states` / G01 committed as `62a1f6a` after the user requested staging/commit. Started at `b62d2c167d9272dd0e29e186204eececcf2dc7af` on `main`; external checkout activity moved HEAD to `a64a4912c759a8138ab0b044fa706777fb62a4d5` (`Make plan for fail states`) on `feat/fail-states` during work. No merge, push or deployment. Fetch attempted but failed because `.git/FETCH_HEAD` is read-only; no integration attempted, main comparison not refreshed.
- Preserved pre-existing edits to AGENTS.md, PLAN.md and HANDOFF.md, the initially untracked main-game plan, and all three initially untracked database files (now tracked by external checkout activity). Documentation updates are additive to those edits. No database files inspected or modified, no database-backed module imported, no server started/stopped.
- Intended behavior/recovery: no gameplay change. Future callers use explicit pause owners, immutable uncertain-write retries, distinct local terminal/save status, newly persisted run-specific receipts, and one terminal failure chosen by the frozen precedence. Existing gate/server-scored CAPTCHA and posts-only feed remain unchanged.
- Checks: Node found at `/home/dashpen/.nvm/versions/node/v24.21.0/bin`; run commands with that directory prepended to PATH. `npm test` passed both test files, including stage boundary/fraction/invalid-time checks, all five defaults, immutable config, complete failure precedence and bounded buffers. Source-only `npx tsc --project /tmp/bot-only-g01-tsconfig.json --noEmit` passed (temporary config extends repository settings, includes src/next-env, excludes generated .next). Scoped `npx eslint src/lib/types.ts src/lib/survival/config.ts tests/survival-contracts.test.mjs` passed. `git diff --check` passed.
- Full `npx tsc --noEmit --incremental false` fails on pre-existing generated `.next/types/validator.ts` references to missing `src/app/leaderboard/page.js` and `src/app/verify/page.js`; generated files preserved. The new stage-type error found on the first run was fixed and source-only check passes.
- Not run: full lint/build, API smoke/seed, browser responsive/input checks or runtime validation/idempotency tests. G01 changes no UI/API/storage; runtime HTTP validators/schema are specified for G05/G06, not implemented or claimed verified. No sensors, engine, provider or detector scoring implemented. Thresholds remain unplaytested defaults. Shared-contract changes should return to one integrator and version changes must keep rankings separate.
- Next task: G02 pure engine and idle with fake-clock acceptance. Consume frozen types/config, including window-stage capture, objective deadline equality, pause overlap, explicit Resume and terminal latch. Stop point: no G02 work begun.

## Main-game planning — 2026-09-26

- New user direction: continuous survival gameplay across every page except the leaderboard; idle, erratic cursor/typing/scrolling and missed objectives end the run, with increasing difficulty.
- [MAIN_GAME_PLAN.md](MAIN_GAME_PLAN.md) defines proposed defaults, sensor math, clocks/pause rules, run-specific objective receipts, result persistence and G01–G08 implementation tasks for smaller agents. It supersedes conflicting S01–S05 product assumptions; no implementation agents were launched.
- Inspected current gate/feed, shared layout/types, objective/score APIs and leaderboard dialog. There is no leaderboard route; current objectives are lifetime booleans and current score writes do not preserve a best score. The plan explicitly covers those integration gaps.
- Documentation only on `main`, uncommitted. Existing AGENTS.md edits and untracked database files preserved. No application tests, server, database operations, fetch/integration, push or deployment performed.
- Next: G01 shared contracts and validation limits, then focused implementation slices. Thresholds and pause/start choices are proposed defaults requiring playtest tuning, not verified game balance.

## Feed simplification — 2026-09-26

Owner requested removing the recent-results component and recent activity. Removed both from `FeedClient`, including the activity counter footer; posts, composer and objectives remain. Gate result component and game logic unchanged. Production build/TypeScript and lint passed; browser confirmed the sections are absent. Preview 3101 uses session `87788`. No mutation tests required for this rendering-only removal.

## Compact sidebar correction — 2026-09-26

Owner found the sidebar receipts too large. The compact variant now renders a native expandable row with avatar, status, username, humanity and time; reason/result ID expand on demand. Full gate receipts retain their presentation. Closed rows measure 74px high (previous cards approximately 295px). Build/TypeScript, lint and diff checks pass; browser confirmed expand/collapse and no overflow at 320px. No gameplay/API changes or additional mutation tests. Preview 3101 session `84443`; merged locally, not pushed.

## Result components and activity states — 2026-09-26

- Owner asked for stronger pass/fail presentation and better component states, then clarified layout: results/components in the sidebar, recent activity below posts. Removed the unclear “At the gate” heading. Desktop keeps posts left, composer/objectives/results right; under 1024px, controls precede posts and results follow the feed. The tall desktop sidebar scrolls with the page rather than trapping its lower cards.
- `VerdictReceipt` now has a status rail, admitted/rejected heading, unit avatar, real receipt ID/score/time, a humanity scale and a short enter/stamp animation; reduced-motion disables animation. Full receipt stays in the existing trial, with the existing continue/retry action. Compact receipts share this component in the sidebar. CAPTCHA/player/scoring/admission logic unchanged.
- Added `/api/results` for the latest 20 recorded image CAPTCHA attempts with a validated `RecordedResult` boundary. Previous feed comparison queried only motion traces, so the owner's image results were absent. Sidebar displays the latest pass and fail in that window; absent outcomes say no recent attempts. Pausing results freezes the display until Resume; no invented results or counters.
- `RecentActivity` shows five persisted events with avatars, actions, timestamps and verdict labels at the bottom of posts. `ResourceState` standardizes loading, empty, initial failure, stale-data failure and retry presentation across results, activity, posts, objectives and trial preparation/recording. Objective count excludes unavailable Comment; loading/error no longer masquerades as unchecked progress. Confirmed data remains on refresh failure.
- Passed final production webpack build including TypeScript and lint; 17 unit tests, 35 API checks, 10 admission checks. New checks reject malformed/inconsistent result data and confirm image pass/fail IDs in the results API. API tests used isolated QA DB only; no shared/preview mutation tests.
- Browser checked final desktop sidebar placement, bottom activity and zero horizontal overflow at 320/375/768/1024/1440px. Pause/Resume worked. Full pass/fail and loading/empty/error/stale components visually reviewed with production CSS and isolated recorded receipts on temporary static 3103, including phone-sized receipts. This is not a full human/touch/CAPTCHA or transport-failure rehearsal; presentation fixtures do not prove retry behavior under network loss.
- QA 3102 and static 3103 stopped. Preview 3101 remains using isolated `/tmp/bot-only-preview-2d6b231.db`, session `15049`. No push/deploy. Teammate `origin/feat/fail-states` contains survival-engine work and was inspected but not merged or overwritten. Next: integrate that separately when requested, then rehearse the actual demo.

## Verified state and routing fix — 2026-09-26

- Fixed the false unverified state: the feed previously treated missing/loading progress data as failed verification. It now uses the server-admitted identity immediately, with server-provided humanity while results load. Progress errors keep their scoped retry and do not remove the composer.
- `/` is now a dynamic server route redirecting an admitted browser to `/feed`; `GateClient` holds the existing form/trial. Registration no longer depends on localStorage. Enter feed performs a full server navigation after receiving the admission cookie, avoiding an old client-router gate result.
- Non-image attempt receipts no longer clear browser admission. New-identity registration and failed image trials still clear it. A posts-poll 401 causes server route revalidation; transport/500 failures remain retryable resource errors rather than false unverified states. Existing handle-based bot write APIs are unchanged; this is session/UI routing repair, not full account-authentication hardening.
- Passed production webpack build with TypeScript, lint, 15 unit tests, 34 API smoke checks, and 10 gate checks. New checks assert admitted home redirect, composer in first server-rendered feed before polling, and admission retained after failure in another game.
- Browser verified the owner's already-passed `@vlad` session after reload: composer and humanity 0.07 present, no verification notice, no resource errors; clicking the wordmark returns to `/feed`. No CAPTCHA was solved by the agent. Client-side expiry under controlled time/network injection was not exercised.
- QA reused isolated `/tmp/bot-only-merge-qa-rWdD4J/data.db`; server 3102 stopped. Preview 3101 remains active with isolated preview data, session `59320`. No shared DB reset or remote push. Next: full presenter rehearsal.

## Teammate CAPTCHA integration — 2026-09-26

- Owner requested fetching the teammate push and merging all current UI/other work. Integrated `origin/main` at `ee2bd38` with `9230b74` on `codex/ui-polish`, then fast-forwarded local `main`. No remote push or deployment.
- Kept teammate `src/lib/image-captcha.ts`, `src/lib/game.ts` and `src/lib/types.ts` exactly as pushed. All six prompts accept the requested/look-alike pair; all visible members are required. Each grid has nine tiles, 0–3 requested images and 1–3 look-alikes. UI buttons, CBS typography, in-place result component and server-checked feed admission remain intact.
- Only merge conflict was README flow prose, resolved to document both the new pair rules and current admission/results. Updated old smoke expectations (removed `tookTheBait`, no skipped rejection assertion), gate solver fixtures, and added regression cases for all six categories, missing/extra selections, zero requested images, and generated-grid composition.
- Passed: production webpack build including TypeScript, lint, 15 unit tests, 34 API smoke checks, 7 gate checks, diff whitespace checks. Scoring files compared exactly with remote. Browser preview reloaded successfully to the compact gate; no interactive CAPTCHA completion or full device rehearsal performed in this integration.
- API tests used new isolated `/tmp/bot-only-merge-qa-rWdD4J/data.db`; QA server 3102 stopped after verification. Shared demo DB untouched. User preview remains on 3101 using `/tmp/bot-only-preview-2d6b231.db`, session `44296`.
- Next: rehearse fail → retry → pass → Enter feed → post/like with the combined version, then publish when requested.

## Admission, result card and CBS typography — 2026-09-26

- Owner request: no feed browsing before completing the reverse CAPTCHA; compact pass/fail results; CBS typography. Owner then set a three-hour hackathon window and said dswim's CAPTCHA logic update is not pushed yet. This increment leaves the CAPTCHA player and scoring code unchanged.
- `/feed` now checks a server-owned admission cookie before rendering `FeedClient`. A username/localStorage/legacy verified flag alone cannot grant access. `/api/posts` GET requires the same admission and uses its identity for liked-state reads. The existing bot write protocol and other public activity/scoring APIs remain as before; this is not a full account-authentication rewrite.
- Successful image attempts issue a 12-hour HttpOnly, SameSite=Lax cookie; only a hash of its random token is stored in the additive `gate_sessions` table. Secure is enabled for HTTPS. Naming a unit or submitting a failed/non-image attempt clears the browser cookie. Cookie validation joins the recorded image pass and current verified user. Seed clears sessions before reusing IDs. Retry may issue a fresh cookie but preserves the original attempt receipt.
- Removed Browse; a pass stays on its recorded result with Enter feed, failure stays with Try again. Result card uses compact status icon, score/time and result ID. Database errors during feed admission have an explicit retry screen. API/server failure is still distinct from a scored failure.
- CBS source confirmed Supreme for UI/display, Archivo for data. Supreme loads from the official Fontshare variable-font stylesheet; Archivo remains bundled locally. No Supreme binary was copied into the repository. Browser verified Supreme loaded and no horizontal overflow for the result component at 320/375/768/1440px; action height 44px.
- Checks: production build including TypeScript and lint passed; 34 existing API smoke checks passed after cookie-aware requests; 7 new `npm run smoke:gate` checks passed for anonymous/registered/failed denial, pass admission, repeated submission, forged-cookie denial and new-identity clearing. Initial successful-feed test exposed SQLite null-prototype serialization into a Client Component; normalized to a plain identity object, rebuilt, and all 7 gate checks passed.
- Visual QA rendered the production result component with actual pass/fail receipts from isolated API tests, using production CSS. Both cards inspected at phone width; failure measured across 320–1440px. Browser confirmed direct unauthenticated `/feed` redirects to `/`, no Browse link, and Supreme loaded. A full interactive CAPTCHA pass/fail was not played in-browser; pointer/device and network-outage rehearsal remain outstanding.
- Isolated test DB `/tmp/bot-only-captcha-qa-yDhP2X/data.db`, API QA server 3102 and static result-review server 3103 stopped after checks. No shared demo database reset or mutation test. Preview 3101 uses `/tmp/bot-only-preview-2d6b231.db`, session `82802`, and stays available for owner review.
- Next: pull dswim's pending push, inspect his contract changes, then rehearse the full loop. Latest fetched remote main remains `d959e50`. No background monitoring or automatic future integration is scheduled.

## Button follow-up — 2026-09-26

Removed action-link underlines and the stray divider below the gate form. Verify/Join are separate 44px buttons rather than fragments embedded in a sentence; Browse/Retry use the same secondary button treatment, and Post shares the standard corner radius. URLs, handlers and game rules are unchanged. Lint and production build (including typecheck) passed. Inspected gate/feed at 375px, confirmed 44px action heights, no text decorations, zero form-row border, and working Verify/Browse navigation; viewport reset. Preview server now session `42062` on port 3101 with the same isolated database. Merged into local main as the follow-up to the authorized visual pass; not pushed.

## Current presentation pass — 2026-09-26

- Owner request: apply the more original UI with cleaner visual hierarchy, then merge. Implementation branch `codex/ui-polish`, based on Claude's latest main `d959e50`. The older `codex/basic-ui` behavior changes are excluded.
- Changed only presentation: compact bot-only gate and wordmark, plain dark surfaces, distinct composer and quieter objectives, readable account/humanity metadata, simpler visible labels and accessible like-button names. Activity and recent results remain available; the ambient background is hidden through CSS while its data context is preserved.
- Gate state/handlers, feed state/handlers and Composer submission code were compared byte-for-byte before their returned markup and are unchanged. No API, database, session, scoring, challenge-player or retry implementation changed. Claude's CSS layers and TypeScript-only setting remain intact.
- Checks passed: `npm run lint`, `npm run build -- --webpack`, `npx tsc --noEmit --incremental false`, `git diff --check`. Initial standalone typecheck saw stale generated `/verify` types from the older branch; the production build regenerated them and the standalone check then passed.
- Browser inspection: gate (including empty-name error) and verified-user feed at 320/375/768/1024/1440px, no horizontal overflow; desktop posts 596px alongside a 340px sidebar, checkbox 16px, Enter/Post controls 44px. Viewed the current image challenge at phone width without playing it. Inspected composer draft state using the existing verified `unit7` fixture in disposable QA data; no post was submitted. Temporary viewport reset.
- No new behavioral tests or API smoke were added/run for these presentation-only changes. Full browser CAPTCHA completion, network failure injection, touch/software-keyboard behavior and 200% zoom were not checked in this increment.
- Servers/data: preview on `127.0.0.1:3101`, session `9219`, DB `/tmp/bot-only-preview-2d6b231.db`; kept as the user review surface. QA port 3102 used `/tmp/bot-only-captcha-qa-yDhP2X/data.db` and was stopped. Shared port 3000 and its database were not used for mutation tests.
- Next: review the merged visual pass; any gameplay or objectives expansion is a separately scoped task.

## Location and integration state (updated at integration)

- Repository: `seed0x/bot-only`; clone at `/home/vlad/hack/bot-only`. `main` is the integration branch.
- Integrated into one squash commit on `main`: the server-scored rewrite, `page/posts` (feed shows posts only) and `captcha` (reverse image captcha).
- Direction chosen by the owner: **verification happens at the gate, the feed is posts only.** Flow: `/` name → reverse image captcha → `/feed`.
- The image captcha is scored on the server (`src/lib/image-captcha.ts`, `game.ts`); the browser only receives the prompt and tiles.
- The merge/push hold is lifted. Push reviewed work to `main`; the live Zo deployment must pull `main` and restart to update.
- Checks: `BASE_URL=http://localhost:3000 npm run smoke` (29 checks) against an isolated server.

Local-only history, oldest first:

| Commit | Existing implementation |
| --- | --- |
| `a12bf26` | Canvas challenge and machine demo |
| `0daaccf` | Ignore stale checklist progress responses (local main tip) |
| `7cfc6c8` | Feed redesign and component split |
| `058fa46` | In-feed tests, hash recall, humanity chip |
| `7457fef` | Seed, smoke, pinned post field and original plan |

A fresh remote clone does not contain these five commits. Coordinate publication/integration before asking a teammate to branch from main and continue this prototype.

## Observed baseline

| Check | Result and scope |
| --- | --- |
| Existing server | Running at port 3000 from this clone; preserved |
| Browser feed | Opened; read-only feed, two closed test cards, scripted posts and ranking panel visible |
| TypeScript | `npx tsc --noEmit --incremental false` passed |
| Lint | Failed: 9 errors, 840 warnings; source problems plus generated dist being scanned |
| API smoke | All 11 passed in an exported baseline snapshot using disposable SQLite and a separate server at 127.0.0.1:3101 |
| Gate at 375px | Failed width check: document 398px, viewport 375px; submit row causes horizontal overflow |
| Feed at 375px | Visually inspected read-only shell; full verified/game/error matrix not checked |
| Full browser journey | Not played end to end during takeover |
| Fresh install / production build | Not run |
| Live deployment | Not inspected or changed |

No smoke or seed was run against the user's port-3000 database.

The in-app browser's port-3000 root displayed unrelated plumbing content, while a direct HTTP read from that server returned bot-only. Both localhost and 127.0.0.1 root showed the discrepancy. The separate port-3101 snapshot rendered bot-only correctly. Cause is unresolved; do not attribute it to application source or mark the original root browser flow verified. Confirm origin/process/browser state in the next session.

## Prioritized findings

| Finding | Evidence | Planned fix |
| --- | --- | --- |
| Lint not green | Effect-driven session state in gate/feed; feed raw internal link; hash render/ref/timing rules; generated dist warnings | T01 |
| Writes can stick or claim false success | Verify/Composer lack transport catch/finally; TestCard ignores HTTP success and reports submitted local verdict | T02–T04 |
| Retry can duplicate results | Register/posts have no operation receipt; related writes are not one transaction | T02 |
| Server trusts malformed/client input | Register only checks handle/result presence; identity is handle-based; localStorage is cast without validation | T02/T03; hardened authentication remains separate scope |
| Reads confuse empty/loading/error | Initial arrays render as empty; polling lacks response validation/error states and overlap control | T04 |
| Guessed progress denominator | UnitChip uses `tests.length || 6` while only two games are live | T04 |
| Pinned story is out of order | Weave inserts test 01 before first pinned post; browser confirmed it | T05 |
| Seed scoring is inconsistent | Seed inserts pass activity but no attempt rows; leaderboard shows zero beaten / no score | T05 |
| Mobile gate overflows | Measured 398px document at 375px viewport | T06 |
| Dialog focus contract incomplete | Panel has no focus trap/return or dialog semantics; hidden controls remain mounted | T07 |
| Hash timer incomplete | Finish happens only when input reaches 40 characters; no deadline timer for incomplete input; render reads time/ref | T01/T03 |
| Motion lifecycle incomplete | No start-near-A enforcement or pointer cancellation handler; demo animation lacks frame cleanup | T03 |

The previous “all smoke checks pass” claim was accurate for API smoke, but did not establish a fully adaptive or failure-safe frontend.

## How the work continues

## Feed objectives — 2026-09-26

- Added `Objective.tsx` inside the sticky feed header, with disabled Post / Comment / Like checkboxes and wrapping layout. Completion uses a new read-only `/api/objectives` query over all of the unit's persisted posts and likes, independent of the feed's 100-post limit.
- Added `ObjectiveProgress` in `types.ts`; feed invalidates objective reads after acknowledged post/like actions. Reads have a 10-second deadline, sequential polling, unmount cancellation and explicit retry on failure; confirmed progress stays visible.
- Comment remains unchecked and labeled unavailable: this checkout has no comment UI, endpoint or database table. No fabricated completion or new comment feature was added.
- Branch `page/posts`, base `84813c4`; changes are uncommitted. Existing dirty feed/API/type/documentation changes were preserved. Fetch attempted but failed because `.git/FETCH_HEAD` is read-only; no integration/push/deploy performed.
- Browser persistence, rejected-write and scrolling checks at phone/desktop widths were not run. No database/server was started or mutated. Next: inspect the checklist in-browser, and connect Comment once its persisted feature contract exists.
- `npx tsc --noEmit --incremental false` could not run: `npx: command not found` (exit 127). No passing typecheck is claimed for this increment.

## Sticky post input — 2026-09-26

### Follow-up: right sidebar

- Objective list follow-up: Post / Comment / Like now stack vertically, one per line, with a separate heading and unavailable-comment note (associated with its checkbox), following the user's clarification. `git diff --check` passed; browser width inspection remains pending. Uncommitted on `page/posts`, base `9f077d6`. Next: inspect at 320px and in the desktop sidebar.

- Composer and objectives now occupy a sticky 340px right sidebar at 1024px+, alongside the posts in a max-1000px layout. On smaller widths controls appear above posts in normal flow. Header spans the same desktop width; composer flex content can shrink without overflow.
- Branch `page/posts`, base `9f077d6`; uncommitted. Changed feed page, Composer, Objective, FRONTEND, PLAN and HANDOFF. No shared types/API changes, server/database operations, integration or publication.
- `git diff --check` passed. Node/npm/npx remain unavailable; typecheck and browser checks were not run. Next: inspect desktop/sidebar scrolling, phone wrapping, short landscape and software keyboard behavior against TESTING.md.

- Moved the verified-user Composer into the existing sticky header beneath Objective; retains the 620px column and phone gutters without a fixed header-height offset. Visitors' read-only notice remains in the feed. Posting, errors and retries are unchanged.
- Branch `page/posts`, base `84813c4`; uncommitted. Preserved existing changes; no merge/push/deploy or database/server actions.
- `git diff --check` passed. Node/npm/npx are unavailable, so typecheck and runtime checks were not run. Phone/desktop scrolling, short landscape and software keyboard checks remain pending; no responsiveness claim is made.
- Next: inspect verified feed scrolling and input at the widths in TESTING.md.

## Feed like repair — 2026-09-26

- The feed now waits for a successful like acknowledgement before changing the displayed count or marking the action complete. Failed/invalid responses show a retryable message; duplicate clicks are disabled while pending.
- The like API now returns the persisted count for both new and duplicate likes, and commits the unique like, counter and activity event together. Database errors are no longer mislabeled as duplicate likes.
- Feed reads now include the current unit's persisted liked state, and older in-flight polls are ignored after a newer poll or acknowledged like.
- Checks were not run for this change. Manual feed interaction and isolated API smoke remain outstanding.

Next: **S01 — the human trial and evidence receipt**, scoped in [PLAN.md](../PLAN.md). The user clarified that winning with a creative showstopper is the primary goal. The demo and priority order are in [DEMO.md](DEMO.md); reliability work is pulled into each slice instead of becoming a prerequisite cleanup project. Claims/ownership go in the task board; shared API and state contracts are in [FRONTEND.md](FRONTEND.md). [CONTRIBUTING.md](../CONTRIBUTING.md) contains the handoff template.

Open coordination items: actual teammates/owners, presentation length/detailed judging rubric, and hosting target (earlier handoff says Zo; repository has Railway config). Official event site checked on 2026-09-26: creative/absurd ideas encouraged, judging listed at 19:00; old 18:00 freeze remains an internal target. See DEMO.md for the source. These do not block local S01.

The temporary port-3101 review server was stopped; its exported checkout and disposable database were removed after confirming no process still used them. The browser was returned to the original port-3000 feed. The pre-existing port-3000 server is preserved; no task worktree was created. Documentation links and git diff whitespace checks passed.
