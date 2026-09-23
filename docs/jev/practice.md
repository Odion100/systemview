# Jev — practice: what bites, and the patterns that work

Practitioner-reported behavior (vendor cookbook + independent write-ups, 2026-09-23). These are
the things the API reference does not say and a first integration discovers expensively.

## Failure modes with teeth

- **It reads literally.** Negations and scoping words land at face value. Write instructions
  that say exactly what you mean; do not rely on pragmatic reading.
- **It cannot count.** No arithmetic; counting error grows with the size of the thing counted.
  Code calculates, Jev judges — put counts in the state, computed by code.
- **Dates are text.** Ordering, comparison, and window checks fail. Extract dates as categorical
  choices with an explicit "not stated" option, or compare in code.
- **Context rot.** Accuracy falls as the state fills with material the question does not need.
  Retrieve and filter BEFORE composing state — smaller state is more accurate state.
- **State is not treated as hostile.** Adversarial text inside user content can shift a
  classification. Anything user-controlled in the state is an injection surface; do not let a
  Jev verdict on raw user text authorize anything sensitive.

## Patterns that work

- **Decompose.** Five narrow questions composed in code beat one broad verdict by ~30 points
  (see evidence.md). Atomic questions, each about one observable property.
- **Always an escape hatch.** Every choice carries `other` / `none of these` — a forced choice
  confabulates a match. Every extraction carries `not stated`.
- **Confidence-gated routing.** Act only above a locally-fitted threshold; below it, fall back
  (to an LLM, to a human, to "pass through untouched"). Keep the fallback — do not automate the
  whole distribution.
- **Shadow eval before production.** Run every question bank on 1–2k labeled local decisions
  first; it costs cents. Fit thresholds there, per question.
- **Compose with supervision when labels exist.** The 95% phishing result used a logistic
  regression over five Jev signals — a few hundred labels turn typed probabilities into a
  strong classifier.
- **Exploit the parallel fan-out.** Many questions per call is the pricing model's sweet spot —
  input tokens are the only cost, and questions share one state ingestion.

## Score design

Keep score levels descriptive, mutually exclusive, and few (2–10 supported). The returned
`score` is a probability-weighted mean over levels — treat it as a distribution summary, not a
measurement.
