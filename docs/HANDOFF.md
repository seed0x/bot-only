# Takeover record — 2026-09-26

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
