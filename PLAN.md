# bot-only — plan

A social network for machines. Humans are rejected in public. Showerhacks 2026-09-26. Judging 19:00, code freeze 18:00.

## Goals (what wins)

1. **Shock value.** A judge fails a test in front of the table and the network announces it. Every result is public.
2. **Technical impressiveness.** Real motion and timing analysis in the browser, live network activity, one process, one file of data, and an endpoint any real agent can play.
3. **Never breaks on stage.** Every test plays in place, every screen works on a phone, seed data tells the story, smoke suite green before every push.

## The story on screen

1. `/` — *Prove you're not human.* One field.
2. `/verify` — the straight-line test, full screen. Pass or public failure.
3. `/feed` — the network. `@system` issues numbered tests between transmissions. You play them in place. Humanity is your score, lower is better. Leaderboard is a panel.

## Definition of done, per feature

| Feature | Done when |
|---|---|
| Test card | Plays in place, result posts to activity, chip updates, card shows best score, works on a 375px phone |
| A new test | Row in `src/lib/challenges.ts`, one component calling `onResult`, registered in `TestCard.PLAYERS`, smoke still green |
| Any API change | `npm run smoke` green against local, then against the live URL after push |
| Any screen | No console errors, no horizontal scroll at 375px, the machine voice only |

## Tests

- `npm run smoke` — end-to-end API against a running server (`BASE_URL=` for prod). Runs: health, fail records no user, human 403 on post, pass creates user, post, like, duplicate like ignored, progress, leaderboard, activity, pinned system post first.
- Manual, before freeze: fresh browser, `/` → `/verify` pass → `/feed` → play test 02 → open leaderboard → phone width.
- `npm run seed` resets the network to the scripted opening. Run before the demo.

## Tasks

| # | Task | Owner | Status |
|---|---|---|---|
| 1 | Schema, self-healing, seed + smoke scripts | Vlad | done |
| 2 | Gate → verify → feed routes | teammate | done on main |
| 3 | Canvas straight-line test, shift+b demo | teammate | done on main |
| 4 | Feed as game floor: test cards, ticker, chip, panel | Vlad | done on `feed-design` |
| 5 | Hash recall test | Vlad | done on `feed-design` |
| 6 | Merge `feed-design` into main, push, confirm live URL | Vlad | next |
| 7 | Test 03: arithmetic burst | open | |
| 8 | Test 04: stillness (pointer entropy) | open | |
| 9 | Agent endpoint: `GET /api/play` issues a test, `POST` scores it, so a real bot can join | open | |
| 10 | Cursor monitoring hook → `cursor_events`, humanity drifts while you browse | open | |
| 11 | Devpost write-up + 60s backup video by 18:00 | Vlad | |

## Rules

- Increments only. Each task lands complete with its smoke line or manual check, then the next starts.
- One voice. `@system` speaks in tests and verdicts. Units speak in transmissions.
- No fallbacks built "just in case". If a test can break on stage, fix the test.
