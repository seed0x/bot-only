# bot-only working instructions

The primary goal is to win Showerhacks with a live human-versus-machine game. Read `PLAN.md`, `docs/HANDOFF.md` and the relevant contracts before editing. The current main-game direction and implementation order are G01–G08 in `docs/MAIN_GAME_PLAN.md`: continuous survival across every page except the leaderboard, with increasingly strict behavior and objective rules. That plan supersedes conflicting S01–S05 assumptions in older docs; `docs/DEMO.md` remains creative background. Supporting engineering work is not a prerequisite cleanup marathon. Keep the plan and handoff current when behavior or verification changes.

- Build one complete increment at a time. State intended behavior, errors/retries and acceptance checks before implementation.
- Continue the existing Next.js/React/SQLite app. Preserve designation and server-scored reverse image CAPTCHA at the gate, then a posts-only feed. The planned global survival game monitors both surfaces; do not reintroduce challenge cards into the feed.
- Use `src/lib/challenges.ts` and `src/lib/types.ts` as shared boundaries. Coordinate shared-contract and page edits with other contributors; agree on shared-file ownership before parallel work.
- No fake success, silent errors, substitute backend, mock content on failure, or extra challenge activated without its contract and checks.
- Client verdict and server acknowledgement are separate. Do not report a result as public before confirmation. Mutation retries must not duplicate writes.
- Follow `docs/FRONTEND.md` and `docs/TESTING.md`, checking their current contract against `docs/HANDOFF.md` when they disagree. A desktop screenshot does not prove responsiveness.
- Fetch and compare main before integration. Respect the user's merge/push/deploy hold; preserve teammates' changes.
- Seed and smoke mutate data. Use an isolated database/server; never reset the shared demo as a routine check. Preserve pre-existing untracked data files and never inspect or modify them unless the task requires it.
- Record failures and checks not run. Do not disable rules to claim a green baseline.
- Stop servers you start after verification. Preserve pre-existing user servers. Remove task worktrees/branches only after safe integration or intentional closure.
- End with branch/commit, files, tests, limitations and the next task. See CONTRIBUTING.md.

These instructions support authorized local work; they add no blanket approval step for reversible edits or checks.
