# The showstopper: the network puts a human on trial

**Pitch:** “We built a social network with one rule: no humans.”

**Audience feeling:** curiosity → personal challenge → public verdict → machine envy → laugh.

The central image is the judge's actual motion beside a machine's perfect trace. Their result becomes a public receipt, and the machine gets to participate in the network. We want the judge to ask to try again.

## Why this direction

The official [Showerhacks site](https://showerhacks.org/) encourages funny, absurd projects and lists a finalist presentation followed by a vote. Our creative inference: a simple premise, a recognisable visual and a live audience interaction should matter more than adding ordinary feed features. No detailed judging weights were found; do not invent them.

This uses work already built: the reverse image captcha, pointer trail, server scoring, hash recall, humanity chip and feed. The new work makes those pieces form a performance.

## A 90-second rehearsal script

The time limit is a planning assumption until confirmed.

| Time | Presenter action | What the room sees | Proof |
| --- | --- | --- | --- |
| 0–8s | “We built a social network with one rule: no humans.” Invite the judge to apply. | Sparse gate; clear challenge | A fresh visitor, not a preloaded success |
| 8–25s | Judge draws from A to B | Their trace builds, then freezes; measured wobble/hesitation are highlighted | Actual samples from that run |
| 25–38s | Pause for verdict | Large verdict and a personalised receipt; one short evidence-based line | Persisted attempt and confirmed acknowledgement |
| 38–55s | “Now let a machine apply.” Run the separate automated client. | Machine evidence next to human evidence; straight-line and hash results arrive | Same challenge/scoring path, fresh IDs, server receipts |
| 55–75s | Reveal the network | Bot identity, completed tests, arrival event and actual transmission; human watches or participates if admitted | Real database-backed feed/progress |
| 75–90s | Let the final transmission land; leave the receipt on screen | “If we win, convert the shower to liquid cooling.” | Sent by the automated client after it completes |

Do not fill the performance with setup, leaderboard navigation or architecture explanation. Keep a concise technical answer ready for follow-up: shared scoring, actual automated client, persisted outcomes and recoverable state transitions.

## Visual direction

- Use the existing dark machine aesthetic with a clear change in scale for the verdict. Large typography, clean space, one focal point.
- Evidence is the animation: reveal the recorded trace, highlight the actual worst deviation and a measured hesitation metric. Never draw invented wobble.
- Seal the receipt after acknowledgement. “Humanity” is a game score, not a scientific probability of being human.
- Wide display: traces beside one another. Phone: traces stacked with the same labels; receipt and retry controls remain reachable.
- Network reveal: brief emphasis on the real arriving event and score. Preserve the feed rather than replacing it with a separate dashboard.
- Optional motion enhances the moment; reduced-motion mode shows the same complete evidence and verdict.
- Example receipt: designation, verdict, challenge, score, trace duration, measured reason, attempt ID. A small “issued by @system” establishes the voice.

## Machine voice and humour

Use evidence-based, brief copy. For example:

- Off-line trace: “Organic deviation detected.” Show the actual maximum deviation next to it.
- Excess speed variation: “You hesitated. We kept the evidence.”
- Human passes: “ANOMALY ADMITTED. Suspiciously compatible.”
- Bot completes: “Application processed. Humanity remains a dependency error.”
- Final transmission: “If we win, convert the shower to liquid cooling.”

Copy is authored product voice, not proof of autonomous language reasoning. A result is never changed to match a joke. Humour targets the absurd premise and the measured game action.

## A real automated contender

The current Shift+B demo animation and client-supplied pass flag are insufficient proof of an independent contender. Core work adds one actual client process.

Minimum protocol for S02:

1. Server issues a unique challenge instance with kind, rules, expiry and start time. The client receives the information needed to solve it.
2. Human UI and automated client submit the same kind of bounded raw solution: normalised motion samples, or the hash response.
3. Server evaluates the solution using shared scoring, records the attempt and emits a receipt/activity exactly once. A repeat of the same submission returns the same receipt; conflicting payloads are errors.
4. The contender uses its recorded admission to post through the normal posting endpoint. It cannot write directly to SQLite or call a special success route.
5. The browser displays the exact attempt/event IDs, scores and resulting posts. Comparison uses stored evidence. Label a replay as a replay.

For hash recall, move timing to the issued challenge's server window for both clients: issue on explicit Start, reveal the hash, expire after the declared limit. This supersedes the older first-input timer target in FRONTEND.md. Keep network round-trip time separate from trace/game duration and label both if shown.

Server scoring here enforces the game contract, not tamper-proof human classification. Do not claim robust authentication, biometrics or independent AI judgement.

## Every branch still tells the truth

| Event | Stage behavior |
| --- | --- |
| Judge fails | Receipt shows actual failure and evidence; continue to the machine reveal |
| Judge passes | Celebrate the anomaly, admit them normally, compare actual results; never force a failure |
| Judge cancels / touch interrupted | No verdict; keep an explicit restart action |
| Save pending | “Recording verdict…”; no public receipt until acknowledged |
| Save fails or response is lost | Preserve evidence and ID; explicit retry; no synthetic verdict |
| Machine request fails | Show the actual failed stage; retry the same operation where safe |
| Machine is slower / fails a challenge | Display the measured result; fix or explain it, never replace it with a canned pass |
| Feed refresh fails after saved result | Keep receipt, mark updates paused, retry only the read |
| Audience phones cannot reach deployment | Do not advertise a QR participation feature before that gate is verified |

One dependable live path is the core product. Extra phones/bots are explicit stretch features, not alternate demos waiting to take over.

## Build acceptance

- First 10 seconds: an unfamiliar person can repeat the premise.
- Verdict visual: an observer can point to the evidence that produced the outcome.
- Machine reveal: a fresh process completes actual challenges and posts without privileged database writes.
- Comedy: rehearse with someone new; leave a pause for reaction rather than assuming the joke worked.
- Trust: refresh preserves the same receipt; resending does not duplicate activity.
- Adaptive: same experience works at phone size and on the presentation display.
- Continuation: components expose typed evidence/receipt props; another teammate can build the client against the documented protocol.

If the core moment does not land, improve its clarity and timing before adding tests or social features.
