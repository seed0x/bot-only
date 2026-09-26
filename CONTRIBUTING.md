# Contributing

## Pick up the work

1. Read [the handoff](docs/HANDOFF.md), [PLAN.md](PLAN.md) and the task's linked contracts.
2. Run `git status --short --branch`, `git fetch origin --prune`, then `git log --left-right --oneline HEAD...origin/main`. Fetch updates references; it does not merge the checkout.
3. Confirm the integration base with the integrator. At takeover, `feed-design` has five commits absent from remote main. Branching from remote main alone omits that prototype.
4. Claim one ready task in PLAN.md with your name, branch and files. Use `codex/<task-id>-<short-name>` for Codex-created branches; humans can use the team's convention. Avoid simultaneous edits to the same page, type contract or database module.
5. Write intended outcome, failure/retry behavior and checks before editing. Implement the smallest complete step, verify it, update the task.

## Ownership boundaries

| Area | Natural owner | Coordinate changes to |
| --- | --- | --- |
| API/data and SQLite | Backend contributor | `types.ts`, `db.ts`, routes, mutation IDs/migrations |
| Gate and games | Interaction contributor | `session.ts`, verify, TestCard and player interface |
| Feed data/composition | Network UI contributor | feed page, hooks, invalidation and ordering |
| Adaptive layout/access | Frontend contributor | global tokens, markup, focus and touch contracts |
| Baseline/integration | Integrator | scripts, docs, release branch and final checks |

Roles may be combined. These boundaries allow teammates to work on leaf components after contracts settle; they are not instructions to launch autonomous agents. Agree shared-file edits first and keep one person responsible for integration.

## Local data and servers

Use your own checkout/worktree, port and absolute `DB_PATH`. Never point a contributor server at someone else's `data.db`. See [isolated testing](docs/TESTING.md). Stop your server before removing its checkout. Preserve the user's existing demo server.

Seed is destructive and currently needs an initialized schema. Smoke writes users, attempts, posts, likes and activity. Run both on disposable data. Neither belongs in automatic shared-demo setup. Additive schema changes belong in `db.ts` and must preserve existing data.

## Reviewable increments

- Prefer existing components and plain React state. Extract a hook/component when its responsibility is clear, not to build a general framework.
- Shared types define boundaries; runtime validation protects HTTP/storage input. A TypeScript cast does not validate either.
- Keep game scoring separate from recording. Players do not perform network writes.
- No fake success, guessed scores, substitute content, forced passes or swallowed exceptions. Visible recovery and retry are required behavior.
- Stable IDs identify games, attempts and posts. Polling/resize must not reset active input.
- Follow [the test matrix](docs/TESTING.md). Record pre-existing failures honestly. Add behavior tests for new failure paths; cosmetic changes need focused inspection.
- Write a reason for new dependencies, game rules and shared API changes in the task/PR. Keep the existing stack for core work.

## Integrating changes

Fetch before integration. Compare both tips and resolve shared-contract changes with their owners. Check the combined result. Commit titles should state observable changes.

The user has held merge/push/deploy for this takeover. Prepare local reviewable work; do not publish until that hold is explicitly lifted. Once sharing resumes, use reviewed feature branches and keep main runnable. Never force-push shared main.

## Handoff template

Add this to the task or PR; summarize latest state in `docs/HANDOFF.md`:

```text
Task and outcome:
Owner / branch / commit:
Base commit and main comparison time:
Files / shared contracts changed:
States covered (loading, empty, success, error, retry, cancellation):
Checks run and exact result:
Checks not run and why:
Widths / input methods inspected:
Database path / server port / process to stop:
Known limitations and reproduction:
Next task and dependencies:
```

Update PLAN.md from ready → claimed → in progress → review → done, with evidence. Blocked means a concrete dependency and a named person/action needed. Keep future ideas separate from ready work.

## Adding a challenge later

Settle scoring, timer, input and cancellation first. Add a definition to `src/lib/challenges.ts` with `live: false`, implement the shared player interface, register in TestCard, and add scoring/lifecycle checks. Turn it live only when rendering, submission, activity and adaptive checks pass together. Missing player is a configuration error, never a substitute challenge or silent disabled button.
