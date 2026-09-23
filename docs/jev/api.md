# Jev — the API surface

TypeSafe AI's System One model. No generation: state in, typed probabilistic decisions out.
Everything below is from the vendor's primary docs (docs.typesafe.ai), fetched 2026-09-23.

## Endpoint and auth

- Base: `POST https://api.typesafe.ai/v1/systemone`
- Key in `TYPESAFE_API_KEY` (SDKs read it from the environment)
- Model string: `jev-latest`, or a pinned version like `jev-1.13.0`

## The three primitives

| type | asks | returns |
| --- | --- | --- |
| **noul** | yes/no | a single probability 0–1 (`"noul": 0.93`) |
| **choice** | pick from a fixed set (≤255 options) | `choice`, full `probabilities` map, `confidence` |
| **score** | position on an ordered scale (2–10 levels) | `score` (probability-weighted mean), `probabilities`, `confidence` |

Questions ride together: many independent questions evaluate against ONE state in parallel, in
one call ("speculative fan-out"). Questions never see each other's answers — composition happens
in your code.

## Request shape

- `state` — the content judged: string, JSON object, or array. Jev trusts it entirely.
- `questions` — map of name → question, each with `type`, `instructions`, `criteria`
  (the options for choice, the levels for score).
- `model` — version string.

## Response shape (quickstart, verbatim)

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "is_urgent": { "type": "noul", "noul": 1.0 }
  },
  "usage": { "input_tokens": 392, "output_tokens": 65 }
}
```

## SDKs

**JavaScript** — `npm install @typesafe-ai/sdk` (Node ≥ 20, ESM+CJS+types):

```ts
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
const client = new TypeSafeClient();
const response = await client.systemOne({
  state: { document: "I was charged twice. Please fix this ASAP." },
  questions: {
    category: choice("What is this ticket about?", { billing: null, technical: null, other: null }),
  },
});
response.answers.category.choice;
```

Helpers: `choice()`, `score()`, `noul()`; answer types are inferred from the questions.
Full options: github.com/typesafe-ai/typesafe-sdk-js (`src/client.ts`, `src/types.ts`).

**Python** — `pip install typesafe-sdk`; `TypeSafeClient` / `AsyncTypeSafeClient`;
`client.system_one(state=…, questions={"name": Noul(instructions=…), …})`;
answers at `response.answers["name"].noul` etc.

## Hard limits

- **64k tokens** combined state + all questions; **32k** state + longest single question
- **255 options** max per choice; score scales 2–10 levels
- Rate: **1,200 requests/min**, 250,000 tokens/sec
- Pricing: **$0.042 / 1M input tokens, output free**
- Cannot generate text, code, or summaries — decisions only

## Training

RLCD — "Reinforcement Learning for Calibrated Decisions": probabilities optimized against
outcomes rather than human preference. Calibration is the product; see evidence.md for how well
it holds independently.
