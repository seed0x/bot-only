# Takeover record — 2026-09-26

## Location and integration state

- Repository: `seed0x/bot-only`; existing clone at `/home/vlad/hack/bot-only`.
- Active branch: `feed-design`, implementation baseline `7457fef`.
- Fetched with `git fetch origin --prune` during takeover; confirmed remote HEAD with `git ls-remote --symref origin HEAD`.
- Remote main: `3e91c52` (`url.txt`). Local main: `0daaccf`.
- `git rev-list --left-right --count HEAD...origin/main` returned **5 / 0**: five local commits, no missing commits from remote main.
- No teammate commits were newly available on main at that check. Fetch again before integration.
- No merge, push or deploy performed. The earlier hold remains in effect.
- This increment changes documentation only. The plan/contracts are local working-tree changes on top of the baseline; product fixes are still pending.

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

Next: **S01 — the human trial and evidence receipt**, scoped in [PLAN.md](../PLAN.md). The user clarified that winning with a creative showstopper is the primary goal. The demo and priority order are in [DEMO.md](DEMO.md); reliability work is pulled into each slice instead of becoming a prerequisite cleanup project. Claims/ownership go in the task board; shared API and state contracts are in [FRONTEND.md](FRONTEND.md). [CONTRIBUTING.md](../CONTRIBUTING.md) contains the handoff template.

Open coordination items: actual teammates/owners, presentation length/detailed judging rubric, and hosting target (earlier handoff says Zo; repository has Railway config). Official event site checked on 2026-09-26: creative/absurd ideas encouraged, judging listed at 19:00; old 18:00 freeze remains an internal target. See DEMO.md for the source. These do not block local S01.

The temporary port-3101 review server was stopped; its exported checkout and disposable database were removed after confirming no process still used them. The browser was returned to the original port-3000 feed. The pre-existing port-3000 server is preserved; no task worktree was created. Documentation links and git diff whitespace checks passed.
