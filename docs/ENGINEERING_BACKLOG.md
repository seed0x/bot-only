# Supporting engineering work

These are implementation details supporting the showstopper in [DEMO.md](DEMO.md). **They are not a mandatory cleanup sequence before the demo.** The execution order is S01–S05 in [PLAN.md](../PLAN.md). Pull in only the checks and changes required for each completed demo slice. Keep the remaining items as follow-on work.

| Demo slice | Relevant engineering detail |
| --- | --- |
| S01 live evidence and verdict | T03 lifecycle/acknowledgement, T02 validation needed for its payload, T06 evidence layout |
| S02 actual automated contender | T02 durable submissions plus the shared scoring protocol in DEMO.md |
| S03 network reveal and receipt | T04 resource states, T05 truthful data and deterministic ordering |
| S04 adaptive experience | T06–T07, T01 source/lint repairs |
| S05 rehearsal and integration | T08 |

Timebox source repairs; prioritize faults that break the demonstrated path. Never suppress failed checks or claim the entire matrix passed. A focused failed check is still a release blocker for the behavior it covers.

### T01 — reproducible baseline

- Files: `eslint.config.mjs`, `src/app/page.tsx`, `src/app/feed/page.tsx`, `src/components/HashRecall.tsx`, `scripts/seed.mjs`; `src/lib/session.ts` if needed for a proper session subscription.
- Exclude generated `dist/` from lint without deleting its tracked artifacts. Fix authored-source violations; do not switch off React rules to make the command green.
- Resolve session hydration without a hydration mismatch. Move hash timing/lifecycle state out of render; keep scoring behavior unchanged until T03.
- Exit: lint and typecheck pass; existing 11 API smoke checks pass in isolated data; cold loads retain two closed cards. Update evidence with commands and commit.

### T02 — requests that can safely be retried

- Files: `src/lib/types.ts`, new `src/lib/api.ts`, `src/lib/db.ts`, mutation handlers, minimal request callers and smoke script, focused tests under `tests/`.
- Use the S02 protocol in FRONTEND.md as the authoritative request shape; then add JSON/runtime validation for handles, live challenge IDs, booleans, bounded raw solutions, finite coordinates, monotonic sample times and valid challenge instances, post lengths and post IDs. Reserve `system` from visitor writes.
- Use one request ID per logical attempt/transmission. Persist its response with an operation/payload binding; apply the domain write, score, activity and receipt in one SQLite transaction. Same ID/same payload returns the original response; changed payload returns conflict. Preserve duplicate-like behavior while making the like/count/activity update atomic. Catch only the actual duplicate constraint as a duplicate.
- Add typed transport errors, an initial 10-second request deadline and response-shape validation. GET may be retried; POST retry keeps the same ID and payload. Migrate existing callers and smoke together so this increment remains runnable; missing/invalid request IDs then return an explicit error.
- Exit: V02–V04, V06 and V09 at the API layer in the [test matrix](TESTING.md). Retrying cannot duplicate activity. User-facing recovery controls land in T03/T04.

### T03 — gate, verification and in-feed test lifecycle

- Files: gate/verify pages, `session.ts`, `TestCard.tsx`, `MovementCaptcha.tsx`, `HashRecall.tsx`; introduce `useAttemptSubmission` only for behavior shared by verify and TestCard.
- Implement the states in [FRONTEND.md](FRONTEND.md). Distinguish local verdict, pending recording, confirmed recording, rejected input and uncertain delivery. Retry delivery reuses the captured result; new attempt creates a new run.
- Prevent duplicate callbacks/submissions; disable the player while recording; use an explicit run ID rather than `duration_ms` as a React key. Invalid/missing handles return to the gate through a valid route lifecycle.
- Enforce starting near A and reaching B, pointer capture/cancellation and animation cleanup. Use the shared server-issued hash deadline, automatic expiry after 4 seconds, exact length/content, and fresh timer/hash per new run. Paste stays allowed by design.
- Keep Shift+B demonstration explicit and scoped to the active idle player. Timers/animations must not submit after unmount.
- Exit: V02–V05, V07, V09 for this flow. New attempt and resend are visibly different actions. Storage failure has a visible recovery action.

### T04 — reliable feed and public activity

- Files: feed page, `Composer`, `PostCard`, `Ticker`, `UnitChip`, `LeaderboardPanel`; small hooks under `src/hooks/` as needed.
- Separate initial loading, loaded-empty, ready, refresh failure and initial failure for each resource. Never replace failed reads with `[]`, guessed counts or sample data.
- Schedule the next poll after the previous request completes; abort/ignore outdated requests and invalidate affected resources after writes. Failed progress must not erase the current run or show `0/6` as a placeholder.
- Keep composer text on failure and clear only after acknowledgement. Lock the pending submission snapshot; preserve any newer edits. Confirm likes before changing counts; reread after uncertain delivery.
- Exit: V06–V09, V13 for network components. Activity/ranking errors do not hide the timeline. Retry affects the failed operation only.

### T05 — deterministic story and coherent seed

- Files: feed timeline composition (pure helper if needed), `scripts/seed.mjs`, `scripts/smoke.mjs`, leaderboard query/types.
- Render pinned rules before test 01 without duplication or lost transmissions. Preserve stable player keys during updates.
- Seed actual attempt rows matching scripted pass events and humanity values. Exclude the system narrator from competitive rankings. Fix nullable ranking score types.
- Make seeding transactional and explicitly tied to the selected database; initialize schema before insertion and fail clearly instead of swallowing unrelated errors. Keep resets out of app startup.
- Exit: V10–V11. Assert pinned identity AND pin status, both live tests, exact seed relationships and timeline order. Seed pass claims, progress and leaderboard agree.

### T06 — responsive layout and touch

- Files: layout/global tokens, gate/verify/feed composition and affected leaf components. Share the existing feed palette across all three screens incrementally.
- Remove gate input overflow, let long handles/statuses wrap or truncate deliberately, use consistent spacing, and keep actions at least 44×44 CSS pixels.
- Apply the size matrix in FRONTEND.md. Preserve the canvas's logical coordinates while making touch targets usable. Handle rotation, short landscape height and the software keyboard without losing input or resetting a run.
- Exit: V12 at every specified width, including loading, failed submission, 24-character handle, 280-character unbroken post and open panel.

### T07 — keyboard, focus and motion

- Files: inputs/buttons, challenge descriptions, leaderboard panel, ticker and CSS motion rules.
- Provide persistent labels, visible focus and announced request status. Leaderboard is a labelled modal: focus enters, stays inside, Escape closes, focus returns. Closed panel controls are not tabbable.
- The pointer game explicitly requires pointer input and accessible instructions, without awarding a fake keyboard pass. The rest of the journey stays keyboard navigable. Ticker pause/reduced-motion behavior exposes all events without duplicate announcements.
- Exit: V13. Manual keyboard and assistive-technology review is recorded separately from automated checks.

### T08 — integration and release rehearsal

- Files: docs and release/CI configuration if needed; product fixes return to the owning task.
- Fetch main again, compare both sides and inspect changed contracts. Integrate on a review branch, resolve conflicts with owners, then rerun combined checks. Takeover found 5 commits ahead / 0 behind; that is not a permanent guarantee.
- Run production build and production-server smoke in disposable data; rehearse the three-screen flow, recovery and phone/desktop layouts. Confirm hosting target and persistent SQLite path: the repo contains Railway config while the old handoff mentions Zo.
- Prepare a short demo script, claim/evidence list and submission copy. Confirm the actual deadline. No substitute UI, canned success or hidden bypass is a release remedy.
- Exit: core checks green; handoff names deploy commit and limitations. Merge/push/deploy remain paused under the user's earlier hold until explicitly resumed.

