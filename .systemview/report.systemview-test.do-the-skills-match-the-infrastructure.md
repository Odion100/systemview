# Do the skills match the infrastructure?

::report{id="Do the skills match the infrastructure?" as=planning retain=6h retired=2026-11-02 retiredAs=expired}

The infrastructure for automation and arc execution is built. This is the audit of whether the
**skills** and the **saved context** match it — read against the live machine today, not from
memory. Every number below was measured.

Twenty-three skills, ~3,500 lines, audited in full by four independent passes.

---

## 1 · What is true right now

| | |
|---|---|
| Hook EVENTS the system emits | **24** |
| Hooks written | **9** · 5 of them point at skills |
| Jobs | **3** — `arc-development`, `proactive-development`, `jobs-path-check` |
| Chores armed | **0** |
| Skills | **23** |
| Notes | **188** system · 65 project · 26 agent |
| Corpora | 16 · `how-we-work` **28 of 53 chunks stale** · `systemview-docs` 23 of 168 |
| `doc-candidate` nominations queued, unfolded | **4** |
| ARC-001 | live and real — 7 objectives: 3 done, 1 doing, 1 blocked, 2 open |

**The mechanism works. The records around it do not testify.**

---

## 2 · The root cause — one block, inherited twenty-three times

This is the finding. Almost everything in §3 descends from it.

`skill-authoring` §8 carries a template that every skill is told to **paste verbatim**. It is five
mechanisms behind what runs:

| the template says | what is actually true |
|---|---|
| `source: "skill:<name>"`, fill in the blank | `job:` `skill:` `lane:` are the **only** legal prefixes — anything else is written to disk, draws no row, and is never nudged |
| — | `set` **replaces** the whole list; omitted items are dropped |
| — | `set` with a source **reopens** a closed run |
| — | `attach` is **refused** on a closed run, so it must precede the final write |
| *"If you stop early, leave the list where it stopped."* | a stopped run is nudged **forever**; `blocked` does not quiet it. The only exits are all-done, or `status("abandoned …")` **with an artifact attached** |

**The consequence, counted across all 23:**

| | count |
|---|---|
| carry *"leave the list where it stopped"* | **22 / 23** |
| name the abandoned exit | **1 / 23** (`assignment`) |
| call `attach` at all | **3 / 23** (`assignment`, `arc-planning`, `report-authoring`) |

So the system instructs 22 procedures into a state that nudges forever and tells one of them how to
get out. Two skills (`assignment`, `delegation`) independently rewrote the prefix law themselves
because §8 omits it — two copies that are both right today and will not both stay right.

**And the corpus cannot settle it, because the corpus is split and half-wrong:**

- `autobot-docs/runs-and-worklists.md` **has** the exit — and files the required account with
  `show()`, which is retired.
- `systemview-docs/runs-lanes.md` mentions abandonment **zero times**.
- A queued `doc-candidate` already names this exact problem: *"hooks + runs/lanes documented twice
  across the two corpora."* Nobody folded it.

---

## 3 · Defects, by class

Organised by class rather than by skill **because the fixes are shared** — one edit to §8 repairs
23 files. A per-skill index is in §6.

### A · `show()` was retired and never swept
It is still the live instruction in:

| where | severity |
|---|---|
| `report-authoring` — in the **description** (always in the trigger surface) *and* as the whole of §2 | **dead end.** Every report this skill produces either fails on the first call or lands invalid — it never names `as=`, `retain=`, the filename convention, or `nav`. §48 actively **forbids** the correct procedure |
| `arc-planning` — 3 refs, plus a workaround for a snapshot that is no longer created | broken paragraph |
| `code-audit` — *"chat if short, TV if long"* | no route; `as=audit` is its own subtype, unused |
| `walkthrough` — `show` in the cue vocabulary, twice | drives a surface that is gone |
| `autobot-docs/runs-and-worklists.md` | the abandon exit routes through it |
| **`src/utils/cueCall.js` lines 10, 35, 109** | **shipping code still offers `show` as a cue verb** |

### B · Calls that are refused or impossible as written
| skill | the line | why it fails |
|---|---|---|
| `delegation` | `lanes({projectCode, broughtIn})` | `broughtIn` requires `status` **and** `how` in the same call. The skill's central recording step is a refused call, with three paragraphs justifying it |
| `rfc-execution` | `::report{as=spec}` | missing `retain=` ⇒ `state.invalid`. Every spec written from this line is a broken document the proof then points at |
| `rfc-execution` | `setAttr` | does not exist; the door is `mcp__systemview__mark` |
| `chore-round` | `proactive-work` | **the skill does not exist** — named in the one place that tells you where to go instead of inventing work. Also referenced by `skill-authoring` |
| `chore-round` | *"its own run nested under this one"* | there is no run nesting; `skill-authoring` says the opposite |
| `agent-authoring` | report via `reports.index.json` + `::file` | retired shape; the index is app-maintained |

### C · Statements that are simply false
| skill | claim | truth |
|---|---|---|
| `context-maintenance` | *"Shelves are capped and everything expires — **subscribe freely; nothing accumulates**"* | the cap is a **refusal**, not rotation. And a subscribed note grown past **700 chars silently stops being delivered** — the skill tells you to edit subscribed notes in place with no warning |
| `doc-maintenance` | *"a permanent corpus is the user's to create"* — stated **3×** | `kind` is purpose, not permission. The skill's job is the **handbook**, permanent by definition — so it instructs every handbook to be born invisible and then asks him to redo it |
| `study` | corpus recipe omits `kind` entirely | defaults to `working`, which answers no search that does not name it. Produces an asset nobody can retrieve |
| `skill-maintenance` | its do-not-delete list | stale — omits 8 hand-built skills, all now deletable by its own §3 |

### D · Silence about infrastructure that now exists
- **Chores: 0 of 23 skills mention them.** Nothing can be switched on until the lines exist and the skills know what ticks them.
- **Hooks-must-be-carried:** 4 skills *are* carried on hooks (`context-maintenance`, `doc-maintenance`, `study`, `chore-round`) and **none of them says so** — a skill that fires unattended and does not know it.
- **The two test runners:** named in none. `codebase-refinement` lands code with *"Run what proves it"* as the entire instruction, and `yarn test` is blind to the hub.
- **`removeSettled`:** `context-maintenance` §3.6 *is* the pass that param was built for, and walks card-by-card instead.

### E · Overlaps with no owner
| collision | ruling I would make |
|---|---|
| `study` ↔ `system-audit` — both produce ranked proposals about this system; **neither names the other** | `system-audit` owns structural findings; `study` owns subject research → corpus or skill |
| `walkthrough` ↔ `how-we-work-tour` — cue vocabulary duplicated, and **both copies are already wrong in different places** (one lacks `say=`, the other documents a wired verb as unwired) | one home. The tour becomes a thin specialisation: its own anatomy + saved sequence, pointing at `walkthrough` for the mechanism |
| corpus creation — 3 skills, 3 stories, one factually wrong | `doc-maintenance` owns the lifecycle; the others point |
| the `doc-candidate` contract — written out in both maintenance skills | one corpus chunk, both point |
| `proof-authoring` — "proof" means **render-pixel tests** here and **claim proofs** in `rfc-execution`, with no guard | rename toward render-proofs and add the exclusion |

### F · Structural
- **No `## Done when`:** `how-we-work-tour`, `context-maintenance`, `doc-maintenance`, `skill-maintenance`.
- **`context-retrieval` is not a procedure** — no steps, no ending, no artifact — and it opens a nudged run. A reference card wired to a mechanism that can only nudge it.
- **`delegation` self-labels** *"PRELIMINARY — the slicing procedure is not written yet."*
- **Eval artifacts missing** for `assignment`, `delegation`, `chore-round` — and for `skill-authoring` itself, which is the file that requires them.

---

## 4 · What is already clean

Worth stating so the list above reads as a map and not a verdict.

- **All 23 carry the execution section with the correct `skill:<own-name>` source.** No wrong name, no invented prefix, anywhere.
- **No skill hardcodes `systemview` as a project code.**
- **Subscriptions are healthy:** 9, all expiring, none at `every-turn`. Always-loaded context ≈ 12.5k chars.
- **`assignment`** is correct about the prefix law, including the failure mode.
- **`job-authoring`** is the best file on jobs infrastructure — `requires:`, the refusal path, and the hooks-carry rule all stated correctly.
- **`gap-authoring`**, **`system-audit`**, **`perf-triage`**, **`study`** are well-formed procedures; their problems are omissions, not errors.

---

## 5 · The order I would work in

Ordered by blast radius, not by severity.

| # | do this | repairs |
|---|---|---|
| 1 | **Rewrite `skill-authoring` §8** — the three legal prefixes, `set` replaces, `set` reopens, `attach` before close, and the two real endings | the inherited defect in **23** files |
| 2 | **Fold the run lifecycle into ONE corpus chunk** and point both maintenance skills at it; drop `show()` from `runs-and-worklists.md` | the split authority; closes a queued nomination |
| 3 | **Repaste §8 into all 23** and delete the two hand-written prefix laws | 23 files, mechanical once #1 lands |
| 4 | **Rebuild `report-authoring`** on the live route | the most-triggered dead skill |
| 5 | **Sweep the remaining `show()`** — incl. `src/utils/cueCall.js`, which is code, not prose | 5 skills + 1 corpus + the bundle |
| 6 | Fix the refused calls (B) and the false statements (C) | 10 skills |
| 7 | Settle the overlaps (E) with a `Do NOT` each | 8 skills |
| 8 | **Re-index `how-we-work`** (28/53 stale) and fold the 4 nominations | the corpus half of "does the context match" |

**Then chores can go on**, and not before — a chore that invokes a skill whose run cannot close
produces a line that never ticks and a nudge that never stops.

---

## 6 · When chores switch on — which is which

| skill | verdict | why |
|---|---|---|
| `doc-maintenance` | **chore** | debt accumulates whether or not the machine is idle; its `cooldown:4h` idle hook is the wrong clock. Retire that hook when the chore lands, or it runs twice |
| `skill-maintenance` | **chore** | carries no hook, has no natural trigger, and the rot it hunts is purely time-driven. It is the only thing that would have caught this entire report |
| `context-maintenance` | **stay a hook** | its trigger is a threshold (`usage ≥ 60%`), not a period |
| `study` | **stay a hook** | tied to a cold start; a chore would turn "find your own work" into "produce something this period" |
| `context-retrieval` | **neither** | a reference card — and its run wiring should come off |
| `system-audit` | **on-demand** | expensive and scope-gated; periodic runs grow a `gaps/` folder faster than it drains |

---

## 7 · Per-skill index

| skill | shape | the one fix |
|---|---|---|
| `agent-authoring` | sound | live report route + attach |
| `arc-planning` | 3 dead `show` refs | replace the panel paragraph with the document route |
| `assignment` | **reference example** | say `set` replaces the list |
| `chore-round` | 3 dead refs | point at the `proactive-development` job; drop "nested run" |
| `code-audit` | sound | `as=audit` report + attach |
| `codebase-refinement` | opens **two** runs, neither closeable | one run, attach branch + report, abandon on his press |
| `context-maintenance` | one false claim, no ending | the 700-char cap; `removeSettled` |
| `context-retrieval` | not a procedure | drop the run wiring |
| `delegation` | PRELIMINARY; refused call | `broughtIn` + `status` + `how` |
| `doc-maintenance` | invented permission gate ×3 | `kind` is purpose, not permission |
| `gap-authoring` | **best-shaped** | attach the gap document |
| `how-we-work-tour` | no `## Done when` | become a specialisation of `walkthrough` |
| `job-authoring` | **best on jobs** | attach + an honest 3am stop |
| `perf-triage` | strongest written | name `Window.bundle` / `holding:true` |
| `proof-authoring` | name collision | disambiguate from claim-proofs |
| `report-authoring` | **structurally dead** | rebuild §2 on the live route |
| `rfc-authoring` | no dead refs | name the nudge at the two parks |
| `rfc-execution` | 2 invalid constructs | "blocked is a finding" needs a real exit |
| `skill-authoring` | **governs all of it** | rewrite §8 |
| `skill-maintenance` | stale list; no door for §2a | add "silent about new infrastructure" as a check |
| `study` | corpus born invisible | state `kind` |
| `system-audit` | **cleanest** | real report + attach before close |
| `walkthrough` | `show` ×2; missing `say=` | one home for the cue vocabulary |
