# Main game: survive the network

Status: implementation plan only. Requested 2026-09-26. No game behavior described here has been implemented or verified.

This is the current product direction for the main game. It supersedes the older S01–S05 sequence where that sequence conflicts with continuous play across the app. Keep the existing Next.js, React and SQLite app, gate verification, posts, likes and recorded results. The game surrounds those interactions; it does not insert challenge cards into the feed.

## 1. Player experience and decisions

The player tries to behave like a machine for as long as possible. A persistent instrument shows survival time, difficulty, the next objective deadline, and warnings about the currently measured behavior. Idling, an erratic movement, inconsistent typing, inconsistent scrolling, or a missed objective can end the run. There is no winning terminal state in the first version: survive longer and beat your previous time.

These are proposed defaults so an implementer does not have to invent product rules:

- An explicit **Start run** action starts monitoring before username entry. Show the rules before this action. Anonymous browsing before starting is allowed. Starting from another page uses the same action and begins the admission objective if needed.
- The run persists through every app page and client navigation. Returning to the gate does not reset difficulty, warnings, deadlines or survival time. Future routes participate by default.
- The leaderboard is the only in-app safe surface: pause every game clock and sensor while it is open, and exclude that time from the score. The current implementation is a dialog, not a `/leaderboard` route. Support that dialog now; use the same pause reason if a route is added later.
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
| `paused` | No collection, scoring or deadline progression | All pause reasons clear + Resume countdown → `running` |
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

Use the CV of insertion intervals; fail the window when it exceeds the current threshold. Paste, autofill, speech input, composition and deletion break the window and do not create invented timings. They remain usable and still count as activity. Keyboard shortcuts and autorepeat do not count as typing samples. The first version intentionally measures observable regularity, not tamper-proof human detection.

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

While an on-time qualifying mutation is awaiting acknowledgement, pause the entire run with `objective_request` and show Recording; retain its immutable request payload. Success completes it. A definite rejection resumes with the pre-request remaining budget and preserves editable input. An uncertain write or outage stays paused with explicit Retry; the same request ID reconciles it. A failed background feed refresh alone does not pause play unless no actionable objective can be rendered. Required resource failure pauses with a visible recovery action; no synthetic objective success.

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

Next action: G01, freeze shared contracts and exact validation limits. This planning change runs no application tests and starts no server.
