> Historical pre-integration audit. The newest HANDOFF records the implemented fixes. Its proposed automatic DB reset was rejected and removed from startup: preserve the real SQLite database. Do not use this historical proposal as a deployment checklist.

# Live gap audit — 2026-09-26 17:30 (freeze 18:00, judging 19:00)

Site: https://onlybots-versatilesoldier.zocomputer.io — walked gate → captcha → feed → post → leaderboard as a judge, plus `scripts/machine.mjs` against it (passes end to end, #159–161, transmission #9).

## Live build is one pull behind main
- Live has the assigned designation and transmission rules, but **no `End run` button** on the feed (main `225d4ab`). A judge on the feed has no way to reach the leaderboard.
- Fix: Zo owner runs `git pull --ff-only && npm run build && restart` once more (README "Deploy or redeploy").

## Gaps a judge will hit
1. **The feed game has no score.** Leaderboard = fastest captcha only. Posts, replies, likes and detections on the feed count for nothing; `End run` just navigates.
2. **No game over.** Three human detections in a row and nothing happens. The shock moment (being caught) is a 422 error line, not an event.
3. **Like is not a test.** Every field is a test except the one that's easiest to click.
4. **Leaderboard is full of junk handles** from before the designation change (`s`, `asdf`, `sss`, `vlad`, `user`, `username`, `ssss`). Judges will see them. Fix: `DB_RESET=1` on the live box before 19:00 (seeds the system post again).
5. **Objectives panel** is a 0/3 checklist with no consequence at 3/3, and shows dev wording on poll errors ("Updates paused", "Your results couldn't refresh", "Your access is unchanged"). Either give 3/3 a payoff (unlocks End run / posts the score) or drop the panel.
6. **Humanity 0.02** in the header means nothing to a viewer; no scale, no trend.
7. **Not submitted:** Devpost write-up, 60-second backup video, one-line pitch.

## Additions ranked by shock ÷ effort (what fits before 18:00)
| # | Feature | Effort | Why it wins |
|---|---|---|---|
| A | **Termination**: 3 detections → full-screen "HUMAN DETECTED — designation revoked" → leaderboard. Activity `fail` rows already exist; count per handle in `/api/progress`. | 20 min | The demo moment. A judge types like a person and gets executed. |
| B | **Run score on End run**: score = transmissions passed × 10 + replies × 5 + likes − detections × 20; store on `game_runs` (table exists), leaderboard shows fastest captcha **and** best run. | 25 min | Makes the feed the game, as intended. |
| C | **Like as a test**: the like must land within 250 ms of the button appearing under the pointer, or the pointer path to it must be straight (pointer collector already exists). | 15 min | Closes "every field is a test". |
| D | **Detections wall** on the leaderboard: "Humans detected today: N" + last five handles and reasons (from `activity` kind `fail`). | 10 min | Public shaming = shock value; zero new tables. |
| E | **DB reset on live** before judging. | 2 min | Clean board with only bot designations. |
| F | **Demo script**: run `machine.mjs` live on the projector while a judge fails on a laptop; the bot lands on the board, the human is terminated. | 0 code | Technical impressiveness: a real bot beats a real human on the same rules. |

Do A, D, E first (30 min, no schema). B and C only if the freeze allows.
