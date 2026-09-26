# Takeover record — 2026-09-26

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
