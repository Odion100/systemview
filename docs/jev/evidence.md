# Jev — independent evidence vs vendor claims

What is actually known beyond TypeSafe's marketing, as of 2026-09-23. Jev shipped 2026-09-15;
this page exists because every headline number is the vendor's and several have been checked.

## The vendor's eval methodology is circular

TypeSafe grades accuracy by **agreement with other frontier models** (average of GPT-6 Astra and
Fable 5.1 as the reference answer), not ground truth. Structural consequence: Jev cannot beat
the models that are its grading key. The vendor's "67.8%, level with GPT-5.6 Terra" workflow
number measures **imitation fidelity**, not correctness. Trust only local shadow evals.

## One broad question is weak; decomposition wins

Independent phishing bench (2,000 labeled PhishNChips v5.2 emails):

- Jev, asked ONE question ("is this phishing?"): **62.6%** — caught 43.2% of phishing, flagged
  18.0% of legit. Haiku on the same single question: 81.3% (McNemar p < 0.0001).
- Jev, split into FIVE narrow questions (URL shorteners, free hosting, sender-domain claims, …)
  composed by a logistic regression fitted on 1,000 emails and scored on the held-out 1,000:
  **95.0%**. Haiku with the same treatment: 93.2% (gap not significant, p = 0.063).

The lesson is the vendor's own line, confirmed the hard way: fan out narrow semantic questions,
compose the answers in code. A single broad verdict wastes the model.

## Can you trust the confidence? Calibration is per question type — thresholds do not transfer

Independent out-of-distribution study: ECE 0.107 (4.4× the 0.024 noise floor), with the errors
in OPPOSITE directions by type:

- **noul (yes/no): underconfident** — refit temperature 0.66
- **choice and score: overconfident** — refit temperatures 3.29 and 3.40
- On **unknowable** questions: 44.7% accuracy while claiming 0.74 average confidence

So for confidence-gated routing: calibration ≠ correctness; a high-confidence answer can be
wrong; and a routing threshold fitted on one question type says nothing about another. Trust the
confidence only after fitting the threshold per question, on local labels.

## Latency, measured independently

- Vendor: "most calls ~100ms", range 70–500ms
- Independent: **239ms median from France**; a **~430ms floor from Europe** via OpenRouter, with
  advice against designing sub-300ms loops from Europe
- Same bench measured Haiku at 687ms — Jev is genuinely much faster, just not vendor-fast
- Circulating headline: a TypeSafe employee measured **15.9%** of the claimed speedup on a real
  pipeline — the 193× claim is a best-case, not a deployment expectation

## Costs that held up

- 1,018 papers classified for $0.08; a 2,000-decision shadow eval for $0.176; a browser agent
  booking flights at $0.0039/run. The cheapness is real even if the multipliers are marketing.

## Version pinning is not optional

`jev-latest` moves silently, and model updates shift decision boundaries. Any fitted threshold
or calibration is tied to the version it was fitted on — pin `jev-1.13.0`-style in production.
