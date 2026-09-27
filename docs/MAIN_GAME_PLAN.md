# Main game: survive the network

Status: integrated through `feat/fail-states` `fb8dc6b`. G04 runs with server-acknowledged start/bind; G05 uses the canonical admission-aware SQLite run APIs; G06 admission/post/like completions are connected to the current gate/feed. Game over replaces gameplay and saves through the finish API with idempotent retry. Manual End game is an unranked interruption; Start again returns to fresh registration. Detector/device calibration and broader G08 rehearsal remain. See the newest HANDOFF entry for checks and limits. Public CAPTCHA leaderboard stays fastest successful time; survival scores use their separate API.

This is the current product direction for the main game. It supersedes the older S01–S05 sequence where that sequence conflicts with continuous play across the app. Keep the existing Next.js, React and SQLite app, gate verification, posts, likes and recorded results. The game surrounds those interactions; it does not insert challenge cards into the feed.

## 1. Player experience and decisions

The player tries to behave like a machine for as long as possible. A persistent instrument shows survival time, difficulty, the next objective deadline, and warnings about the currently measured behavior. Idling, an erratic movement, inconsistent typing, inconsistent scrolling, or a missed objective can end the run. There is no winning terminal state in the first version: survive longer and beat your previous time.

These are proposed defaults so an implementer does not have to invent product rules:

- An explicit **Start run** action starts monitoring before username entry. Show the rules before this action. Anonymous browsing before starting is allowed. Starting from another page uses the same action and begins the admission objective if needed.
- The run persists through every app page and client navigation. Returning to the gate does not reset difficulty, warnings, deadlines or survival time. Future routes participate by default.
- The leaderboard is the only in-app safe surface: pause every game clock and sensor while it is open, and exclude that time from the score. The current implementation uses `/leaderboard`; route entry acquires the leaderboard pause reason.
- Hiding the tab or losing browser focus pauses play, with no survival credit. On return, require **Resume** and show a three-second countdown with the clock frozen. Do not punish browser scheduling or claim paused time as survival.
- Refreshing or closing a page interrupts an active run. Do not silently resume with reset counters. Persist a small session checkpoint and show an interrupted result on reload, without publishing it as a scored failure. A retry starts a new run. Cross-refresh continuation is deferred.
- A confirmed CAPTCHA rejection ends the run as `verification_failed`. A transport/recording error does not. Existing admission and verification API behavior remains intact.
- Game over immediately freezes the local result and prevents new gameplay actions. The player can inspect their evidence, retry result saving, open the leaderboard, or explicitly start again. A new run does not erase posts, likes or the existing user identity.
- Pointer scoring applies to mouse/pen movement; touch uses scrolling and the other available detectors. Do not require unavailable devices. Rank input modes separately: `pointer` and `touch_or_keyboard`. Determine the mode at Start, show it, and do not quietly switch during a run.

Flow: rules → Start → designation/verification when needed → objectives while navigating and using the network → increasing difficulty → first terminal failure → result → leaderboard or new run.

## 2. State, clocks and precedence

One provider in `src/app/layout.tsx` owns the run. Route components must not create their own engines or global listeners. Keep scoring as pure functions outside React.

| State | Behavior | Exit |
| --- | --- | --- |
| `ready` | Rules and Start; no sensors or score | Start acknowledged → `countdown` |
| `countdown` | Three seconds to get ready; clocks frozen | Countdown ends → `running` |
| `running` | Sensors, active clock, difficulty and objectives advance | Pause reason → `paused`; first failure → `ended` |
| `paused` | No collection, scoring or deadline progression | Successful objective acknowledgement with no other reason → `running`; otherwise all reasons clear + Resume countdown |
| `ended` | Immutable failure snapshot; no new gameplay submissions | Explicit new run → `ready` |

Keep result persistence separate: `not_sent`, `saving`, `saved`, `save_error`. An unsaved result is still game over locally. Never label it ranked before acknowledgement.

Use a monotonic active-play clock derived from `performance.now()`, not interval tick counts or `Date.now()`. Use wall time only for request metadata/checkpoints. A set of pause reasons prevents closing the leaderboard from resuming a hidden tab or blocked objective.

At each event/tick: advance active time to the event timestamp, apply already-due deadlines, evaluate the input, then publish at most one terminal transition. An objective expires only when active time is greater than its deadline; a qualifying action at the exact deadline remains eligible while recording is acknowledged. Idle expires at its limit as specified below. For equal-time failures, priority is verification, objective deadline, idle, pointer, typing, scroll. Save all simultaneous measurements in evidence but display one primary cause.

Reset unfinished sensor windows on pause, route change, input-target change and Resume. Preserve the idle elapsed time, current objective remaining time, difficulty and already accumulated bad-window counts. Only actual qualifying activity resets idle. A new run resets all run state. Complete late network writes can still be reflected in the feed, but cannot resurrect an ended run.

## 3. Difficulty defaults

All values live in one versioned configuration module. These numbers are initial playtest settings, not claims about human behavior or validated balance.

| Active survival time | Stage | Idle limit | Pointer deviation ratio | Typing interval CV | Scroll speed CV | Objective budget | Consecutive bad windows to fail |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0–29.999s | Boot | 12s | 0.18 | 0.90 | 1.00 | 35s | 3 |
| 30–59.999s | Observe | 10s | 0.14 | 0.70 | 0.80 | 30s | 3 |
| 60–89.999s | Inspect | 8s | 0.10 | 0.55 | 0.60 | 25s | 2 |
| 90–119.999s | Audit | 6s | 0.075 | 0.40 | 0.45 | 20s | 2 |
| 120s onward | Purge | 4s | 0.05 | 0.30 | 0.35 | 15s | 1 |

- Tighten at stage boundaries without resetting the run. Stage five is the initial maximum; further stages require explicit tuning.
- An objective keeps the budget assigned when issued. A sensor window keeps the thresholds/stage it had at its start. The current idle limit tightens immediately at a stage boundary; the HUD must show the upcoming limit beforehand.
- CV means population standard deviation divided by mean. Insufficient samples mean `insufficient_data`, never zero irregularity or a pass.
- A qualified good window resets that detector's bad-window count. Incomplete windows do not increment or reset it. Warnings show the count and the next failure condition; at Purge, one qualified bad window ends the run.
- Survival time is the score. Completed 30-second intervals are `roundsSurvived = floor(activeMs / 30000)`; leaderboard ordering is survival time descending, then completed objectives descending, then stable designation ordering.

## 4. Detector contracts

Sensors observe real browser input. They do not modify text, force motion, synthesize input or send raw keystrokes to the server. Use bounded buffers. Every evaluator returns `insufficient_data`, `good` or `bad`, plus measured value, threshold and a compact explanation.

### Inactivity

Count pointer movement of at least 4 cumulative CSS pixels, actual user-driven scroll displacement of at least 4 pixels, a non-repeat keydown, a text input event, or pointerdown as activity. Hover events, polling, animation, programmatic focus/scroll and held-key repeat do not reset idle. IME composition activity counts as activity even though it is excluded from typing regularity scoring.

Warn when 75% of the current idle budget is used. Fail at `idleElapsed >= idleLimit`. Paused time does not consume the budget. Small pointer noise must not keep the run alive.

### Pointer straightness

Use mouse/pen `pointermove` positions in viewport CSS coordinates; cap collection at 30 Hz. End a stroke after a 180ms gap, pointerdown/up, or 750ms duration. Consecutive windows may share one endpoint but not score the same segment twice. A qualified stroke has at least six samples and 60px path length. End below those limits with insufficient data.

Measure the maximum perpendicular distance from the start-to-end line segment, divided by `max(endpointDistance, 60px)`. A ratio above the stage limit is bad. A path of at least 60px that returns within 15px of its start is also bad (loop/reversal); do not divide by a near-zero distance. A straight diagonal is valid. Straight-line speed is not judged by this detector. Turns between completed strokes are permitted.

Store at most the last qualified failing stroke, normalized to its captured viewport, for the result illustration. Scroll and resize reset the pointer window so moving content cannot distort evidence. Pointer lock and unsupported coordinates produce an explicit unavailable state.

### Typing consistency

Listen only in editable controls. Collect input timestamps, never characters, key names or field contents. Score eight consecutive insertion intervals within a burst. A gap over 1500ms ends the burst; stopping to think is handled by idle/objective clocks. Partition into non-overlapping windows. Require a positive mean; invalid timestamps discard the window.

Require minimum typing speed of 20/30/40/50/60 WPM at Boot/Observe/Inspect/Audit/Purge. Measure WPM as 12000 divided by the mean insertion interval in milliseconds (five insertion events per word); equality and faster speed are safe for this speed check. A slower qualified window is bad. Also use the CV of insertion intervals; fail the window when it exceeds the current threshold. If both fail, show speed evidence; increment the typing bad-window count only once. Keep the captured window-start stage for both checks. Paste, autofill, speech input, composition and deletion break the window and do not create invented timings. They remain usable and still count as activity. Keyboard shortcuts and autorepeat do not count as typing samples. The first version intentionally measures observable regularity, not tamper-proof human detection.

### Scrolling consistency

Score actual user-caused scroll position changes in the document or active scroll container; wheel deltas alone are insufficient. Link them to wheel, touch or scrolling-key intent, and exclude programmatic scrolling, focus movement and layout shifts. Keep each container separate.

Sample net displacement in 100ms bins during a scrolling burst, including zero bins between the first and last changing bins. Finish after 250ms without displacement; trim leading/trailing empty bins. Evaluate six-bin non-overlapping windows with at least 60px total absolute movement. Use CV of absolute speed; a direction reversal within a qualified window also makes it bad. Beginning/ending a short gesture is insufficient data, not failure. Hitting a scroll boundary closes the window without scoring the clipped tail.

Inertial scrolling remains part of the observed burst, including on touch devices; show this rule to the player and tune against real trackpads/phones before enabling terminal enforcement. If scroll origin cannot be identified, report unavailable rather than assigning a fabricated score.

## 5. Objectives

Replace lifetime checklist booleans as game authority with one current, run-specific objective. Keep lifetime progress available separately if useful. The HUD always names the action and remaining active time.

1. **Get admitted**, if the current identity is not verified: choose a designation and pass the existing image CAPTCHA within 60 active seconds. Bind the run to the acknowledged identity. This admission budget does not shrink midway through registration.
2. **Transmit once**: create a new nonempty valid post after this objective was issued.
3. **Like a transmission**: make a new like on an eligible visible post not already liked by this user.
4. Repeat steps 2–3 with new action IDs and the current stage budget. If no eligible like target exists, issue Transmit instead. Never issue Comment: it has no implementation.

Issue the next objective immediately after the previous one is acknowledged. Route changes do not replace it or pause its deadline. Include a Go to feed / Go to gate action where the current route cannot complete it. The navigation time is part of its budget. Snapshot available targets when issuing a like objective; if all disappear/become unavailable, replace it explicitly with Transmit and a new full budget.

Only an acknowledged, newly persisted action associated with the current `runId` and `objectiveId` completes an objective. Historical posts/likes, duplicate likes, local optimistic state and the current `/api/objectives` lifetime booleans do not qualify. A replay of the same write returns the same completion, once. Never reuse an action ID for two objectives.

While an on-time qualifying mutation is awaiting acknowledgement, pause the entire run with `objective_request` and show Recording; retain its immutable request payload. Success completes it and immediately continues Running if no other pause reason remains; no Resume or countdown is required for successful completion. A definite rejection resumes with the pre-request remaining budget and preserves editable input. An uncertain write or outage stays paused with explicit Retry; the same request ID reconciles it. A failed background feed refresh alone does not pause play unless no actionable objective can be rendered. Required resource failure pauses with a visible recovery action; no synthetic objective success.

## 6. Result, persistence and leaderboard

Result copy: **Human detected**, primary reason, measured value versus limit, active survival time, stage reached, objectives completed, input mode, and saving status. Interrupted runs have their own neutral label. Evidence must be from the actual failed window, with units. HUD warnings should identify how to correct behavior before failure.

Minimal new records:

- `game_runs`: run ID, rules version, optional bound user, input mode, start time, terminal status, active duration, completed objective count, primary failure/evidence summary, finish time.
- `game_objective_events`: run ID, objective ID, action kind, persisted post/like/attempt ID and completion receipt; unique objective/action association.
- Use the existing operation receipt helper for idempotent start/bind/finish and post retries. Additive schema only. Keep behavioral runs separate from CAPTCHA attempts and the challenge registry.

Proposed HTTP contracts, finalized in task G01 before implementation:

| Operation | Request | Acknowledgement / errors |
| --- | --- | --- |
| `POST /api/runs` | requestId, rulesVersion, inputMode | runId; replay same ID returns same run; failed start stays Ready |
| `POST /api/runs/:id/bind` | requestId, acknowledged handle | Bound identity; same binding replays; conflicting binding is 409 |
| Existing register/play/post/like writes | Existing fields plus optional runId/objectiveId when relevant | Existing response plus persisted action/completion ID; invalid association rejected; non-game callers still work |
| `POST /api/runs/:id/finish` | requestId, terminal snapshot, compact evidence | Persisted result ID and ranked eligibility; same payload replays, conflict is 409 |
| `GET /api/scores?inputMode=…` | Selected mode | Best confirmed eligible survival run per identity; empty/loading/error are distinct |

The client measures behavior and active time; the server validates bounds, versions, identity binding, referenced objective events and terminal-write uniqueness. This is an honest browser game, not anti-cheat proof. Do not imply server-observed pointer behavior. Anonymous runs show a local result but do not enter named rankings. Only confirmed bound failure runs rank; interrupted runs do not. Compare runs within the same rules version and input mode; tuning must not silently mix incompatible scores.

Do not reuse the current `/api/scores` POST as-is: it accepts caller-selected totals and overwrites a previous best even with a worse score. Make run finish the only new score-writing path, and explicitly retire that legacy writer when migrating its consumers. Derive best time and objective count from the same stored run, not independent maxima.

The existing leaderboard dialog reads challenge rankings from `/api/leaderboard`. Change its main display to survival rankings from `/api/scores`, with clear units and mode filter; retain the legacy challenge endpoint for existing consumers. Opening or closing the dialog must acquire/release the provider's pause reason, including Escape, backdrop close and unmount. Expose a leaderboard action on gate, feed and results.

## 6a. G01 contract with authorized typing-speed revision (`survival-v3`)

The exported `Survival*` types in `src/lib/types.ts` and constants in `src/lib/survival/config.ts` are authoritative for G02–G07. G01 adds no runtime HTTP validation, schema, engine or page changes. Future validators must enforce these rules before mutation; casts alone are insufficient. Changing scoring/eligibility/limits requires a new rules version and explicit contract review.

### Engine events and pause ownership

`SurvivalEvent` is the complete engine input union: start acknowledgement, tick, countdown finished, pause acquire/release, Resume, qualifying activity, sensor reset/evaluation, objective issue/submit/acknowledge/reject/uncertain, identity binding, acknowledged verification rejection, interruption and new run. Saving is separate `SurvivalSaveState`, outside the scoring engine. All events carry finite monotonic `atMs`; earlier timestamps are rejected without state changes. Async events identify the run; responses for another run cannot affect it. Start failure leaves Ready and is not an engine event. G04's diagnostic start is explicitly local/unranked until G05.

Pause reasons form a set: `leaderboard`, `hidden`, `blurred`, `objective_request`, `required_resource`. Each owner releases only its own reason; duplicate acquire/release is idempotent. Acquiring during countdown cancels the countdown. Clearing the last reason leaves Paused until explicit Resume starts a fresh 3000ms countdown. Definite rejections release `objective_request`, preserving the objective/input and pre-request budgets; uncertain delivery retains it until an identical retry reconciles. Authorized revision: a successful objective acknowledgement or definite objective rejection immediately continues Running if clearing `objective_request` leaves no other pause reason; its response timestamp is the new clock baseline, so recording time earns no credit. Other pauses and resource recovery still require explicit Resume. No active time, idle time, deadlines, or sensor samples accrue in Paused/Countdown. Reset partial sensor windows on pause/resume and the reset events; preserve qualified bad counts. Routes never pause clocks. New run clears all engine state; browser conditions must reacquire their reasons before play.

At an event, advance running time and evaluate deadlines before its activity. Idle equality fails (`>=`), objective equality remains eligible (`>` expires), numeric detector equality is good (`>` is bad). A verification rejection means a server-confirmed CAPTCHA failure, not HTTP rejection. Select the earliest failure time; equal-time causes follow exported precedence: verification, objective deadline, idle, pointer, typing, scroll. Retain at most one measurement per cause in that order. Ended is latched; late receipts cannot replace its snapshot. Purge covers all active times from 120000ms onward, without an engine duration cap. The 24-hour persistence bound below is a wire limit, not a new gameplay failure.

Sensors retain at most 24 pointer samples, nine typing timestamps (eight intervals), and six scroll bins per container/window. Only mouse/pen is pointer-scored. Pointer trace coordinates in terminal evidence are viewport-normalized [0,1], with `t` elapsed milliseconds from the first retained point, starting at zero, strictly increasing and at most 750ms. Never transmit text, key names, typing timestamps, scroll buffers or raw event streams. Scroll intent grace is 250ms after wheel/touch/scrolling-key intent; identified inertia continues that burst until its displacement gap closes it. Unidentifiable origin is unavailable. G08 must tune/check real devices before terminal enforcement.

### Wire validation and recovery

- IDs (`requestId`, `runId`, `objectiveId`, `completionId`, `resultId`) use `[a-zA-Z0-9_-]{16,100}`. Server-created IDs follow the same format. Handles retain the existing 1–24 lowercase alphanumeric/underscore rule, excluding `system`. Database IDs are positive safe integers. Wall-time receipt strings are server-generated ISO UTC timestamps.
- New run endpoints reject unknown fields, malformed JSON/types/enums, nonfinite numbers and unknown rules versions with 400, oversized UTF-8 bodies with 413. General request limit is 64000 bytes; finish limit is 16384 bytes. Existing endpoints retain their existing request fields/limits and accept optional `game: SurvivalObjectiveSubmission`; absence preserves non-game behavior. Partial/invalid game data is rejected, never silently treated as non-game. `/api/play` may carry association but never completes admission; only a newly persisted passing register attempt can.
- New run APIs retain the existing `{ error: string }` envelope. 403 means unverified/forbidden identity; 404 missing run/target; 409 operation payload conflict, terminal run, conflicting binding or reused objective/action; 500 operation failure. Invalid input and definite rejection require correction; transport timeout, malformed response and 5xx are uncertain and require explicit retry of the same immutable request ID/payload. No automatic write retries. Receipt and domain write commit atomically with `operation()`.
- Start is exactly `SurvivalStartRequest`; response `SurvivalStartReceipt`. Bind is exactly `SurvivalBindRequest`, with run ID from URL; response `SurvivalBindReceipt`. Verify the existing admitted user on bind. Rebinding the same identity under a new operation ID returns the existing binding; another identity is 409. Anonymous runs may start/finish but only bound failed runs rank.
- Finish is exactly `SurvivalFinishRequest`; URL run ID must match snapshot. Only `failed` or `interrupted` terminal statuses are accepted. Request version/mode must match the stored start. `activeMs` is finite in [0,86400000], may be fractional; stage must equal `survivalStageAt(activeMs)`. Completed objective IDs are unique, at most 6000, and must equal that run's persisted completion set, not caller-selected totals. Derive rounds as floor(activeMs/30000).
- Failed evidence contains 1–6 unique measurements in precedence order, including its primary reason; primary reason is the first. Measurement active times are equal to terminal active time; pointer/typing/scroll stage is the captured window-start stage, objective deadline stage is the issuing stage, and idle/verification stage is the terminal stage. A captured stage cannot be later than the terminal stage. Explanation is 1–240 characters. Value/threshold must be finite nonnegative; ms values at most 86400000, ratio/CV values at most 1000000, boolean values 0 or 1. Units are fixed: verification boolean, deadline/idle ms, pointer ratio, typing consistency/scroll CV, typing speed WPM. Verification uses value 1/threshold 0; typing speed thresholds must equal the captured stage typingMinWpm and fail below that minimum; other thresholds must match config for the measurement stage or the recorded objective budget (deadline measurement is elapsed objective time). Pointer loops/reversals may fail below the ratio threshold and must explain the structural cause; scroll reversal likewise. Numeric bounds do not prove browser-observed behavior.
- Optional failing pointer trace has 6–24 samples satisfying the normalization/time bounds above and requires a pointer measurement. Interrupted snapshots have empty measurements, no primary reason/trace and `reload` or `closed` interruption. Finish replay uses the same ID/payload; different ID after terminal storage or changed payload is 409. An unsaved local terminal result remains ended. `ranked` is authoritative only in `SurvivalFinishReceipt`; resultId equals runId (one terminal row per run).
- Score query requires `inputMode` and accepts `rulesVersion` (default current version); reject unknown filters. Response is `SurvivalScoresResponse`. Only confirmed bound failed runs in that exact version/mode qualify. Select one whole best run per user by activeMs descending, completed objective count descending, then runId ascending for a stable tie. Order rows by time, objective count, handle ascending (binary), then runId; no independently combined maxima. Legacy scores POST retirement is G05, not G01.

### Objective association and additive schema

Optional `game` contains run/objective/request IDs, kind, submitted active time, issued active time, deadline and issuing stage. Its requestId must equal the enclosing mutation's requestId (add requestId to game likes). Admission has a fixed 60000ms budget; other budgets match the issuing stage, with `deadline = issued + budget`. All times are finite, nonnegative, at most 86400000; submitted time lies inclusively between issue/deadline. Browser-reported time is not server-observed time. A pending on-time mutation pauses the whole run. Definite rejection preserves its objective/input, uncertain delivery retains its request, success advances exactly once after receipt. Issuing a like snapshots 1–100 unique visible eligible post IDs; other kinds use an empty target list. No eligible target means explicit replacement with a new post objective ID/full budget. Retired objective IDs never qualify again.

Because objective issuance is client-local, G05/G06 do not add an issuance endpoint. First qualifying mutation records issue/deadline/stage from `game`; the server validates version, bound identity, budget, kind/reference and newly-created action. Eligibility targets are enforced by the engine; the server validates that the post exists and this like is newly created. Existing likes and old posts/attempts cannot produce completion. Admission may atomically bind its acknowledged admitted identity; other actions require prior binding. Run has no terminal row yet. Server sequence begins with admission when unbound or post when already bound, then alternates post/like, allowing post replacement for unavailable like targets. A client-local objective may be retired without a stored event; completed sequence and receipts are the authority for finish.

`SurvivalObjectiveReceipt` is included as optional `completion` in an existing successful write response; game write success requires it. `action` is discriminated: admission references attemptId, post references postId, like references newly-created likeId and target postId. No new action ID is fabricated for a duplicate like. Retrying the original write replays its original completion. At most one completion per objective and one objective per action, even across runs. Historical activity and lifetime progress never qualify.

Additive schema to implement in G05 (no G01 migration):

- `game_runs`: `id TEXT PRIMARY KEY`, `rules_version TEXT NOT NULL`, `input_mode TEXT NOT NULL`, `user_id INTEGER NULL REFERENCES users(id)`, `started_at TEXT NOT NULL`, `terminal_status TEXT NULL`, `active_ms REAL NULL`, `completed_objectives INTEGER NULL`, `primary_reason TEXT NULL`, `snapshot_json TEXT NULL`, `finished_at TEXT NULL`. Null terminal fields mean started, not ranked; terminal fields are written once atomically. Bound user cannot change. Index version/mode/user/status for best-run reads. Result ID is this row's ID.
- `game_objective_events`: `completion_id TEXT PRIMARY KEY`, `run_id TEXT NOT NULL REFERENCES game_runs(id)`, `objective_id TEXT NOT NULL`, `request_id TEXT NOT NULL UNIQUE`, `user_id INTEGER NOT NULL REFERENCES users(id)`, `action_kind TEXT NOT NULL`, `action_id INTEGER NOT NULL`, `target_post_id INTEGER NULL`, `issued_active_ms REAL NOT NULL`, `submitted_active_ms REAL NOT NULL`, `deadline_active_ms REAL NOT NULL`, `stage TEXT NOT NULL`, `receipt_json TEXT NOT NULL`, `recorded_at TEXT NOT NULL`; UNIQUE(run_id, objective_id), UNIQUE(action_kind, action_id). Store attempt/post/like IDs in action_id; validate references transactionally (polymorphic column has no single FK). Target is required only for like.
- Use existing operation receipts for start/bind/finish and objective mutations, including likes; normalized field order feeds the fingerprint. Do not alter/delete legacy records or use cursor_events. Table CHECK constraints enforce enum/status/nullability/numeric bounds in addition to runtime validation. Objective event insertion, identity binding where needed, action/activity and operation receipt share one transaction.

G01 acceptance: focused tests verify every stage boundary/fraction, invalid stage lookup, frozen defaults/limits, and complete precedence; TypeScript checks the shared unions/config. Engine clocks, detectors, HTTP/schema validation and idempotency remain G02–G06 acceptance, not claimed by this contract increment.

## 7. Implementation boundaries

| File/module | Responsibility |
| --- | --- |
| `src/lib/types.ts` | Shared run, event, objective, result and API types; one contract owner |
| Proposed `src/lib/survival/config.ts` | Versioned thresholds, stages and sample limits |
| Proposed `src/lib/survival/engine.ts` | Pure state transitions, active clock accounting, deadlines, first failure |
| Proposed `src/lib/survival/detectors.ts` | Pure numeric scoring; no React, DOM or HTTP |
| Proposed `src/components/game/GameProvider.tsx` | One engine instance, pause reasons, browser sensor lifecycle, context actions |
| Proposed `GameHud.tsx`, `GameOver.tsx` | Read state; explain warnings, evidence, save/retry and next actions |
| `src/app/layout.tsx` | Install provider around existing atmosphere/pages; preserve server layout |
| Gate, `ChallengeTrial`, Composer, feed like handler | Emit acknowledged run events; respect game-over controls; retain existing error handling |
| `Objective.tsx` | Display current run objective/deadline from provider; no competing polling clock |
| `LeaderboardPanel.tsx` | Safe-surface pause integration and survival rankings |
| `src/lib/db.ts`, `operations.ts`, API routes | Additive storage, validation and idempotent receipts |

Avoid high-frequency React updates: listeners fill bounded buffers; scoring runs at window boundaries; HUD time updates at most 10 Hz. No raw event stream in SQLite, no per-move HTTP requests, no dependence on the existing `cursor_events` table. Do not use network threat/rejection counts as player difficulty.

## 8. Small work packages for implementation agents

Execute in order. Each task gets this document, only its listed files plus relevant contracts, and the previous task's handoff. Require a diff summary, checks/results, limitations and next task. Do not ask a small agent to implement the entire system in one prompt. No agents have been launched for this planning task.

| Task | Scope and ownership | Required acceptance before handoff |
| --- | --- | --- |
| G01 — freeze contracts | `types.ts`, survival config, this plan's HTTP/schema details; no page edits | Exact event union, pause rules, payload limits, objective receipt association and failure precedence agreed; stages cover all times and boundaries |
| G02 — engine and idle | Pure engine + tests; consume G01 types without changing them | Fake-clock tests: stage progression, idle failure, pause overlap, no paused survival credit, terminal latch, new run, same-time precedence |
| G03 — detector math | Pure detector module + fixtures/tests | Straight/curved/loop traces; regular/irregular timings; short/invalid samples; scroll reversal; threshold equality; bounded arrays; no content collection |
| G04 — global runtime and HUD | Provider, browser adapters, layout, HUD, game-over view | Same run survives gate↔feed; one listener set; cleanup/Strict Mode safe; warning then exactly one failure; hidden/focus pause; explicit resume; interrupted reload |
| G05 — persistence | DB additions, run APIs, score reads/writer migration; coordinate all shared API files | Isolated API tests: duplicate/conflicting start/bind/finish, invalid evidence, worse score preserves best, mode filtering, anonymous/interrupted excluded, save failure/retry |
| G06 — objectives | Register/play/post/like receipts, gate/feed/Composer/Objective integration | On-time acknowledgement advances once; old activity/duplicate like cannot satisfy; deadline fails; uncertain mutation pauses/retries once; no target fallback; verified start skips admission |
| G07 — leaderboard and terminal actions | Leaderboard panel, navigation controls, final result hookup | Every entry/exit pauses/resumes correctly; clock unchanged while browsing rankings; game-over stops new writes; late replies cannot change result; saved score appears once |
| G08 — tune and rehearse | Only fixes justified by acceptance failures; update handoff/contracts | Full run at all target sizes/input modes; all five requested failures demonstrated; difficulty rises; retry/restart/leaderboard verified; actual limitations documented |

Before G05, G04 uses a visibly labeled local diagnostic Start and unsaved result; it does not pretend a run-start request was acknowledged. Replace this entry path with the real API when integrating G05. Terminal detector enforcement is ready only after real browser input checks; intermediate diagnostic mode cannot publish ranked runs. Keep each increment runnable, with unavailable integrations clearly labeled.

Only after G01 may separate contributors work on G02/G03 and G05 without overlapping files. One integrator owns `types.ts`, `layout.tsx`, gate/feed pages and API integration. Shared contract changes return to that owner; do not let agents independently rename events or change thresholds.

Suggested task prompt: “Implement G0N from docs/MAIN_GAME_PLAN.md. Read AGENTS.md and the preceding handoff. Own only the listed files. Preserve the frozen contracts. State behavior, recovery and checks; implement the complete slice; run its focused checks on disposable data; report files, results, gaps and the next task. Stop before expanding scope.”

## 9. Acceptance and unresolved tuning

Before calling the main game done:

- Demonstrate idle, pointer, typing, scrolling and missed-objective game overs independently; confirm each freezes one actual result and identifies the right cause.
- Run from gate through admission into feed and back without resetting the clock/difficulty. Stay on the leaderboard longer than the idle limit and resume with exactly the previous remaining budgets.
- Verify progressive thresholds at 30/60/90/120s, qualified-window equality, warnings, deadline equality and simultaneous failure ordering using fake clocks.
- Verify rejected/duplicate/lost-response objective writes, unavailable feed data, failed result save, delayed old responses and restart while an old save is pending. A new run must not inherit old receipts or failures.
- Check mouse, pen if available, keyboard, real trackpad inertia and touch; inspect 320/375/768/1024/1440px, short landscape, software keyboard, 200% zoom and reduced motion. Mark unavailable device checks as not run.
- Keep the HUD readable without covering controls, avoid per-tick screen-reader announcements, and put focus into the game-over result with reachable restart/leaderboard actions.
- Rehearse until a new player understands why they died and can improve on a second run. Adjust only versioned config from measured playtests; record the resulting values. The starting table is deliberately tunable.

Known first-version limits: browser-reported behavior is forgeable; unsupported input styles can yield insufficient evidence; pause surfaces permit rest but grant no score; reload interrupts instead of resuming; repeated objectives create real posts/likes. Use an isolated database during automated checks and rehearsals that create data. Multi-tab ranked play, stronger identity/anti-cheat, a comment objective, touch-specific gesture scoring and endless difficulty scaling are deferred.

Next action: G07 survival leaderboard, result save/retry hookup and complete terminal action blocking. G06 is locally implemented; six disposable API cases and twelve provider lifecycle/objective cases pass, including deadline equality/expiration, lost response reconciliation, verified-start admission skip and no-target fallback. Start now uses the real acknowledged run API and checks verified status before binding. Existing non-game callers remain supported. No G07 work has started. G04 user playtests are prior evidence, not mounted-browser verification of the G06 UI. G08 remains responsible for real-device/viewport tuning.

Authorized scoring revision (2026-09-26): minimum typing WPM added at user request; rules version bumped to survival-v3. Stage values are tunable and unvalidated for real devices. SurvivalDetectorResult.typingMetric distinguishes speed from consistency; terminal speed evidence uses wpm. Older v1 checkpoints are intentionally rejected with visible recovery.
