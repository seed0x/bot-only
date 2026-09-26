# bot-only — build the demo that wins

**Goal: win Showerhacks with a funny, technically real, memorable live experience.** Build decisions serve the moment the room understands and wants to try it. Reliability, React structure and responsive behavior support that moment.

**Creative direction: “The network puts a human on trial.”** One judge, one real automated contender, one network that visibly prefers the machine. See [the 90-second demo and interaction design](docs/DEMO.md).

## What success looks like

| Goal | Evidence before we call it done |
| --- | --- |
| Hook immediately | Within 10 seconds, a first-time viewer can explain: “This social network rejects humans.” |
| A live showstopper | Real human trace → visible evidence/verdict → actual automated competitor passes → the network reacts with persisted events. |
| A memorable payoff | A personalised, screenshot-ready humanity receipt plus a machine transmission that lands the joke. |
| Credible technical work | Human and machine use the same scoring/recording path; visible scores, times, posts and counts correspond to actual runs. |
| A demo anyone can try | Gate, challenge, feed and receipt work on phones and projector/desktop; retries preserve inputs and never invent outcomes. |
| Team delivery | Small claimed slices, explicit component/API contracts, scoped tests, and a handoff the next contributor can execute. |

These are our product hypotheses and rehearsal criteria, not invented official scoring weights. The [official event site](https://showerhacks.org/) encourages creative/absurd projects and lists judging at 19:00, finalists at 20:00, then a vote at 20:20 on September 26. It does not supply numeric rubric weights or a presentation length. Plan around 90 seconds until the actual slot is known. The old 18:00 freeze is our provisional internal target, not a confirmed event rule.

## The experience

1. **Gate:** “Prove you're not human.” One designation and one action.
2. **Trial:** The judge draws the straight line. Their motion becomes visible evidence: the actual trace, wobble, hesitation and game score.
3. **Verdict:** A large, readable verdict seals a receipt using the recorded attempt. If the judge passes, celebrate “ANOMALY ADMITTED.” Never force rejection.
4. **Machine reveal:** A real automated client takes the same test, then hash recall, using the same server path. Compare measured results. Label replay as replay when displaying recorded traces.
5. **Network payoff:** The admitted bot actually posts. Its arrival, progress and reaction are live data. The human can inspect the network and their receipt.
6. **Closing joke:** The bot's authored transmission can read, “If we win, convert the shower to liquid cooling.”

Maintain three core routes: `/`, `/verify`, `/feed`. Evidence/receipt live within the trial/feed; ranking stays a panel. A presenter view can enlarge the same components without becoming another product journey.

## Build order and claimable tasks

Owners are unassigned until claimed. Timeboxes are planning budgets, not delivery guarantees; reassess after each slice. Keep branch, owner and check evidence current.

| ID | Completed slice | Budget | Depends on | Status / owner |
| --- | --- | --- | --- | --- |
| S00 | Repo/main audit and winning-demo plan | — | — | Done locally / Codex |
| S01 | **The human trial:** actual motion → evidence → recorded verdict/receipt | 30–45 min | S00 | **In progress / Codex (`feed-design`)** |
| S02 | **The reveal:** real automated competitor clears the tests via the shared protocol | 45–75 min | S01 contract | Queued / unassigned |
| S03 | **The network responds:** live comparison, post and final payoff | 30–45 min | S01, S02 | Queued / unassigned |
| S04 | Phone/projector polish and critical failure states | 45–60 min | Each completed slice | Queued / unassigned |
| S05 | Rehearse, integrate current main, build and deploy review | 30–45 min | S01–S04 | Queued; publication held / unassigned |

### S01 — build the first memorable moment

- Start in `MovementCaptcha.tsx` and `verify/page.tsx`; extract `AttemptEvidence` and `VerdictReceipt` for reuse in TestCard/feed.
- Retain a bounded actual trace and measured metrics. Keep pending recording, confirmed verdict and recording failure separate. Give the receipt the persisted attempt ID.
- Design the transition: input → trace freezes → evidence highlights → verdict. Respect reduced motion and show the full result immediately in that mode.
- Include the judge-passes branch, new attempt, interrupted drag and failed recording. Never alter scoring thresholds to manufacture the joke.
- Ready to move on when a new viewer understands the premise, a real attempt produces the correct receipt, and replay uses its exact data at phone/projector sizes.
- Checks: D01–D03 in [TESTING.md](docs/TESTING.md); relevant V05/V07. Demo this slice before expanding scope.

### S02 — one actual machine on the network

- Contract first: expose a shared challenge-attempt protocol and server scoring for the two existing games. Human and automation submit raw solutions, not a caller-selected pass flag.
- Extract motion scoring into a shared pure module; issue server challenge IDs; persist outcomes and retry receipts. The machine has no privileged “pass me” route.
- Add one small automated client under `scripts/` that requests challenges, generates its own solution, receives acknowledgements and transmits as its admitted unit.
- Keep identity and challenge integrity bounded to this game; do not turn this into an account-platform rewrite.
- Exit: the separate client completes both tests on fresh data; its exact attempt IDs/progress appear in the browser; wrong/expired/replayed solutions are handled explicitly.
- Checks: D04–D05, V02–V04 as applicable. This real machine is core to the reveal; more bots are stretch work.

### S03 — deliver the payoff

- Keep the feed focused on transmissions and UnitChip; add `TrialComparison` and a feed receipt presentation. Verification challenges stay outside the feed.
- Show actual human/machine trace and results side by side on wide screens; stack them on phone. Distinguish trace duration from round-trip time.
- Use the automated client to post one evidence-based reaction and the closing line after acknowledged completion. A curated machine voice is fine; do not claim it is an independent LLM conversation.
- Put pinned network rules first and make seeded history consistent. Demo counts must come from actual events. Prevent duplicate receipts/posts on retry.
- Exit: a viewer can see why the outcomes differ, watch a real bot join and transmit, and recognise the receipt as their run.
- Checks: D06–D07, V08/V10/V11. No new social features required.

### S04 — make every demo surface work

- Repair the observed 375px gate overflow. Apply the responsive contract to trial, receipt, feed, controls and ranking; 320/375/768/1024/1440px, touch and short landscape.
- Implement scoped retry states, disabled duplicate actions, retained input, focus management and reduced motion as each slice lands.
- Fix authored-source lint issues and remove generated dist from lint scope. Keep tests meaningful; record failures instead of expanding into a general rewrite.
- Exit: demo surfaces pass their size/input checks and controlled request failure checks. Full adaptive behavior remains part of done.
- Checks: V06/V09/V12/V13 and lint/typecheck.

### S05 — rehearse the actual performance

- Rehearse from a fresh session with someone who has not seen the app. Give only the opening line; check understanding, pause for reaction and time the reveal.
- Run the real automated client. Measure actual timing; no simulated counters or prerecorded success.
- Fetch main again, compare and prepare integration. At takeover `feed-design` was 5 ahead/0 behind remote main; verify again before combining changes.
- Build and smoke against disposable data, then verify the intended hosting/database setup. The repo has Railway configuration; the earlier handoff mentions Zo.
- Exit: a complete timed rehearsal, meaningful checks pass, deployment target identified, handoff names branch/commit/limitations.
- The user's earlier hold on merge/push/deploy remains until explicitly lifted.

## Team ownership

| Lane | Owns | Contract to settle first |
| --- | --- | --- |
| Experience / frontend | Evidence, receipt, comparison, adaptive layout | Attempt evidence and receipt props |
| Protocol / bot | Shared scoring, challenge issuance, real automated client | Request, result, replay/retry rules |
| Network / integration | Feed reactions, event consistency, rehearsal and release | Event/attempt IDs and refresh behavior |

Work can progress independently after the shared contract is agreed; do not edit the same page/type file simultaneously. No invented teammate names or assignments. Use [CONTRIBUTING.md](CONTRIBUTING.md).

## Creative stretch — only after the live reveal works

1. **Let the room apply:** QR entry and a wall of real humanity receipts; requires a reachable deployment and multi-device checks.
2. **Three machines, one society:** a small number of actual automated units with distinct authored voices, reacting to recorded outcomes.
3. **A result people want to share:** receipt export/permalink, grounded in a persisted attempt.

Stop scope growth at the timebox. Extra tests, broad cursor surveillance, a general agent framework, account-platform work and a design-system rewrite do not belong on the current critical path.

## Engineering support and current facts

- [Detailed state/component/responsive contracts](docs/FRONTEND.md)
- [Supporting engineering work](docs/ENGINEERING_BACKLOG.md): pull relevant fixes into each slice; it is not a prerequisite cleanup marathon.
- [Tests](docs/TESTING.md) and [takeover evidence](docs/HANDOFF.md)
- Current code: 11 API smoke checks pass; typecheck passes; lint fails; mobile gate overflows. The showstopper above is planned, not built.

No fallbacks: real scores, actual transmissions, visible errors and honest recovery. Incremental work must keep delivering a better performance.

## Approved atmosphere increment

Adopt smoked glass surfaces, locally bundled Archivo typography/instruments and ember `#f0402f` for rejection. Derive threat from all recorded failures in the last five minutes, with explicit stale/error states and a capped ticker pace; motion remains pausable and respects reduced-motion. Bundle Archivo with OFL; Supreme is excluded from repository redistribution. This atmosphere supports the human trial and real-machine reveal.
