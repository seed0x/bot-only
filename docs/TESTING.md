# Verification and test plan

Current admission regression: run `BASE_URL=http://127.0.0.1:3102 npm run smoke:gate` against isolated data. Anonymous posts GET must return 401 and `/feed` must redirect to `/`; naming a user alone cannot admit it. Full smoke now carries the admission cookie from a server-confirmed image pass. Result UI and CBS font checks are recorded in the latest HANDOFF entry.

Separate baseline evidence from target acceptance. [HANDOFF.md](HANDOFF.md) is the latest observed result; the cases below are not all automated yet.

## Demo acceptance comes first

Implement the showstopper in S01–S05 order from [PLAN.md](../PLAN.md). T-numbered entries below refer to supporting engineering detail, not a competing roadmap. Each slice includes the failure checks relevant to its live behavior.

| ID | Acceptance | Slice | Status |
| --- | --- | --- | --- |
| D01 | A new viewer can explain the premise after the first 10 seconds without extra explanation | S01 / rehearsal | Planned |
| D02 | Actual captured trace, metrics, verdict and persisted receipt agree; a human pass displays the admitted branch | S01 | Planned |
| D03 | Interrupted input produces no verdict; unacknowledged write cannot produce a public receipt; retry records once | S01/S02 | Planned |
| D04 | A separate automated process gets fresh challenges, solves both, is scored by the same server path and actually posts | S02 | Planned |
| D05 | Wrong, expired and conflicting/replayed solutions cannot produce a fresh passing result; lost response retry returns original receipt | S02 | Planned |
| D06 | Comparison uses exact recorded attempts, labels replay/timing, and the feed shows actual arrival/post/counts | S03 | Planned |
| D07 | Receipt is readable and screenshot-ready on phone/projector; new viewers understand the evidence and react to the payoff | S03/S04 rehearsal | Planned |
| D08 | Timed fresh-session rehearsal completes within the confirmed slot with real client, truthful failure paths, and verified deployment | S05 | Planned |

## Existing checks

- `npm run lint`: baseline fails (9 errors, 840 warnings, many warnings in generated dist). T01 fixes authored code and lint scope.
- `npx tsc --noEmit --incremental false`: passed at takeover.
- `npm run smoke`: 11 API integration checks, passed on disposable data at takeover. It does **not** exercise a browser, pointer scoring, hash timer, responsive behavior or network-failure UI.
- Production build and a production-server rehearsal were not run during the planning takeover.

Smoke covers health, rejected attempt/no user, unverified post denial, passed registration, post, like, duplicate like, progress, leaderboard membership, join/post/like activity and a loose pinned-first check.

Coverage gaps: the pinned assertion uses OR instead of requiring system AND pin; rejection activity is not asserted; hash recall isn't played; mutation retries, invalid input and cancellation aren't covered. A green smoke run alone is not a release gate.

## Safe isolated setup

Use a separate checkout/worktree with the intended feature code and its own `node_modules`, build output and database. Do not run a second Next dev process in the same checkout. Coordinate the base first: remote main currently lacks the local prototype.

In terminal A, from that separate checkout, choose a free port and a unique absolute database path:

```bash
npm ci
export DB_PATH="$PWD/qa.db"
npm run dev -- --hostname 127.0.0.1 --port 3101
```

In terminal B, from that same checkout:

```bash
export DB_PATH="$PWD/qa.db"
curl -fsS http://127.0.0.1:3101/api/health
npm run seed
BASE_URL=http://127.0.0.1:3101 npm run smoke
```

Stop if any command fails. The seed calls getDb and creates the schema. Health alone does not create it. Seed erases the selected database's network data: this procedure is only for a newly created disposable `qa.db`. Smoke leaves test rows behind.

During takeover an exported snapshot at commit `7457fef` used a disposable DB and `next dev --webpack` at port 3101 with the existing installed dependencies. That verified API behavior; it did not prove `npm ci` or a production build from a fresh clone.

Stop the test server after checks and before removing its checkout. For production rehearsal, stop dev, run `npm run build`, then serve with the same disposable `DB_PATH` and `npm start -- --hostname 127.0.0.1 --port 3101`. Run smoke against that server. Do not seed live data as part of deployment verification.

## Required cases

Each task implements only the relevant cases, then records command/result and any manual observations. “Planned” means the check still needs implementation or execution.

| ID | Case and observable assertion | Method / owner task | Baseline |
| --- | --- | --- | --- |
| V01 | Existing 11 smoke assertions pass in isolated data | Existing API script / T01 | Passed |
| V02 | Invalid JSON, missing fields, unknown/inactive challenge, wrong types, nonfinite/out-of-range score, negative duration, invalid/reserved handle and oversized post produce explicit 4xx and no mutation | API integration / T02 | Planned |
| V03 | Same attempt/post ID submitted twice (including after response loss/server restart) has one persisted write and one activity event; different payload with that ID is 409 | API integration and intercepted response loss / T02 | Planned |
| V04 | Inject failure between domain write and activity/receipt; transaction leaves no partial user/attempt/post/like state; retry succeeds once | Database integration / T02 | Planned |
| V05 | Verify pass and rejection remain pending until acknowledged; double callback creates one request; HTTP error/non-JSON/offline/timeout never becomes a human verdict or success | Component/browser / T03 | Planned |
| V06 | Composer preserves draft on error, prevents duplicate send, clears only acknowledged content; rejected/uncertain like does not leave an invented count | Component/browser + API / T02/T04 | Planned |
| V07 | Straight line starts at A, ends near B and emits once; cancellation/unmount emits no late result. Hash passes exact input by deadline, fails mismatch/extra/incomplete/late input once, resets only on new run | Pure scoring tests + component fake clock + manual pointer/touch / T03 | Planned |
| V08 | Posts/progress/activity/ranking distinguish loading/empty/error/stale; retry one resource; slow old response cannot erase a new result; no overlapping polls or post-unmount updates | Component/browser with controlled responses / T04 | Planned |
| V09 | Missing/corrupt/reset local identity stays read-only; storage failure after confirmed pass has visible recovery; forbidden writes retain input and prompt verification | Storage/API/browser / T02–T04 | Planned |
| V10 | Pinned system rules first, then 01 + two transmissions, 02 + two, remainder; no duplicate/lost posts; refresh/new post preserves open player's input | Pure timeline + browser / T05 | Currently wrong pin position |
| V11 | Fresh schema + seed has matching attempts, scores and pass activity; system excluded from competition; repeated disposable seed produces consistent opening | Database/API / T05 | Seed claims lack attempt rows |
| V12 | Routes/cards/dialogs at all widths, long input/text, 200% zoom, portrait/landscape, keyboard open, touch; no horizontal page overflow or inaccessible actions | Browser/device inspection / T06 | Gate fails 375px; others incomplete |
| V13 | Tab order, input labels, visible focus, dialog containment/return/Escape, closed dialog not tabbable, status announcements and reduced-motion content | Browser + manual assistive review / T04/T07 | Planned |
| V14 | Production build; full fresh-session flow; pass/fail public results; seed consistency; phone and desktop; verified hosting persistence | Build, API + rehearsal / T08 | Not run |

Use the smallest useful test tooling for the behavior. T02 selects a runner compatible with the installed Node/TypeScript setup; T03 adds controlled timer/component tests and a browser harness if needed. No such new test commands are available yet. Keep fixtures in tests, never as runtime replacement data.

## Responsive inspection matrix

Inspect `/`, `/verify` and `/feed` at 320×568, 375×812, 768×1024, 1024×768 and 1440×900. Also inspect short landscape and 200% zoom. Cover unverified/verified headers, closed/open players, error messages, loading/empty results and open leaderboard.

Use a 24-character handle and a 280-character unbroken post. Check `document.documentElement.scrollWidth <= window.innerWidth`, then visually inspect wrapping and actual touch targets; passing the width assertion alone is insufficient.

Do not describe an unplayed canvas screenshot as proof that the game works. Desktop pointer, real touch and software keyboard checks require explicit evidence.

## Failure injection

For automated browser tests, control the relevant request: reject transport, return 400/403/500, return malformed JSON, delay beyond deadline, and deliver responses out of order. Model an accepted write with its response dropped; retry must reconcile the same persisted ID. Stop/unmount during hash expiry and the machine animation. Test a stopped server using disposable data only.

Do not trigger destructive tests or smoke against the shared demo. Record server-side data assertions as well as visible messages.

## Demo rehearsal after implementation

1. Open a fresh session at the gate; verify the product and correct server.
2. Enter a designation; complete a measured rejection; confirm one public event.
3. Start a new attempt, pass, then verify acknowledged navigation and identity.
4. Confirm pinned rules, two closed cards and coherent humanity/progress.
5. Play hash recall in place; confirm progress, activity and ranking updates.
6. Transmit once, like once, refresh and verify persisted counts.
7. Exercise retry after a controlled connection failure without duplication.
8. Open/close ranking by keyboard, repeat core flow on phone, record any untested device.
9. Record commit, build/server mode, URL and database used. Stop temporary servers.

Keep a concise evidence log in HANDOFF.md; include limitations rather than turning unexecuted checks green.
