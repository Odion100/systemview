# RFC-070 — The approval flow: a draft becomes binding work by a press, and the band says when one waits

**His direction, 2026-10-16:** *"We got to start following a procedure now that we have proactive
work… we already used to use the approval comment block at the bottom… we know if something is
approved and we could just plan, plan, plan."*

**STATUS: REDRAFTED 2026-10-17** from the thread discussion on the first draft (threads resolved
and removed; their conclusions are this document). The approval block at the bottom is live and
unanswered.

## 1 · What this is, and what it is not

**One path, not THE process.** This flow exists for exactly one kind of work: something big enough
that building it unattended would be wrong. Everything else is untouched — the board still captures
friction the moment it's noticed and most of it just gets done; gaps stay gaps; small fixes never
see an approval block. His words on the first draft: *"I don't want to create a strict process —
not everything needs to go to an RFC."* The queue's doors don't change; this adds the deepest one:
a run with nothing completable can PREPARE a proposal, and a proposal has a way to become buildable.

## 2 · What already exists, verified on the disk

| piece | where | state |
|---|---|---|
| the `:::approval{…}` block | `src/atoms/Markdown/blocks/Approval.js` | ✓/✗ **writes `verdict=approved\|rejected` into the document** via `setAttr`; clicking again withdraws. No second store. |
| the press, live on real files | `CodePane.js` markdown preview | the preview saves (`onSourceChange` → `writeFile`, conflict-guarded), so a document opened in the center takes the press TODAY. The chat's renderer is read-only by design and its Approval says so. |
| the mailbox flag | `AgentChat.js` approval scan | unanswered blocks flag the band head — **report files only** today |
| the binding rule | `~/.autobot/jobs/proactive-work/job.md` | `verdict=approved` is BINDING for a run; anything else is a draft, never built — including the drafting agent's own |

The spine — draft → press → the document carries the decision → a run reads the document — needs no
new mechanism. What's missing is surfacing and policy, below.

## 3 · The design, as settled in discussion

### 3.1 · Watched folders — agnostic from birth

His correction, verbatim intent: *"I was never saying specifically RFCs… the agent and I should be
able to set up the folder, whatever it may be."* So the band's new line is a **watched folder**, not
an RFCs feature:

- A project declares sections as `{name, folder, flag rule}` in a **config file**
  (`.systemview/sections.json`). **No new verb** — his bar: *"don't casually add tools."* He writes
  it through the UI; an agent writes it through the file doors that already exist; the band reads it.
- This project's first instance: `{"rfcs", "RFCs/", "unanswered :::approval"}` → the band reads
  `rfcs · 4 ⚑ 1 approval waiting`.
- The scan uses `listFiles({dir, shallow: true})` — **never a glob**; `listFiles` silently drops a
  glob option and walks the whole project (the trap the mailbox itself carried; fixed in
  `lane/mailbox-mtime-gate`). Same poll, same mtime gate.
- A row opens the document **in the center pane specifically** — that is where the press is live; a
  flag that led to a read-only surface would point at a locked door.
- **What counts is read from the documents themselves** — unanswered `:::approval` blocks — never
  from git state or any mark he has to maintain. (His correction: leaving unfinished RFCs
  uncommitted is a desk habit he happens to have, "not part of the way we together know some shit" —
  the system cannot read his chair.) So `rfcs · 3` means three documents whose blocks await him,
  however many files the folder holds.

### 3.2 · The verdicts — and reject as the cemetery

`approved` · `rejected` · withdrawn (attribute cleared). No `revise` — an edit before approving IS
the revision, and a thread says why when words are needed.

**In practice he will almost never press ✗** — silence already means "not buildable." Reject's job,
argued out in the threads and kept deliberately:

- **It is the system's memory of no.** A deleted draft erases the lesson — the next idle run holds
  the same direction, re-derives the same idea, and politely proposes it again. A rejected draft is
  precedent: the verdict plus his reply saying why is the context that teaches agents his taste.
- **The verdict in the block IS the headstone** — a rejected document stops counting and stops
  flagging because its block is answered, nothing else required. What he commits is his desk
  business, never load-bearing.
- Delete remains available — for drafts not worth a headstone. When the cemetery itself needs
  thinning, that is §4's retention follow-up, not a per-death decision.
- Unanswered drafts get deepened run after run (the job's rule), so ✗ is also "stop asking me."

### 3.3 · The verdict chips — the decision arrives as a decision

His idea, with his own nuance folded in: **an approval block is scoped to what it wraps, not to the
document** — so top-right chips are only honest when there is nothing to be ambiguous about:

- **Exactly one unanswered block in the document**: the chips are a **remote** for it — same
  `setAttr` write, one source of truth, no scrolling. This is the actual use: prepared proposals
  carry one block at the bottom.
- **No block at all**: the press **writes a document-level block and the verdict in one stroke** —
  an agent's draft stays clean and nothing lives in it until he decides.
- **Two or more unanswered blocks**: the chips hide. A top-right verdict over multiple scoped asks
  would be a guess wearing a button.

### 3.4 · Who writes a verdict — the one hard rule

**No agent writes `verdict=`** — not on its own drafts, not on anyone's. The press is the whole
meaning of the attribute. The surface half is already enforced (`editable` gates the buttons); the
policy half is one short paragraph that belongs in **system context**, so every agent on every
project carries it cold — the HOW stays in the job documents that already load whole.

## 4 · Adjacent, deliberately not in this RFC

- **The how-we-work corpus** (his call in the threads: *"we might have to create a specific
  corpus"*) — four documents distilled from what exists: the-loop, surfaces, evidence,
  context-layers. Its own effort; this RFC only notes the approval flow becomes a chapter of
  the-loop when it lands.
- **RFC retention rules** (his note, 2026-10-17: *"we gotta eventually come up with specific rules
  for when to delete RFCs — a lot more 70s now"*) — when a built or buried RFC leaves the folder.
  The cemetery-commit above is the first half; the folder's own lifecycle is the follow-up.
- Vision/domain corpora, auto-build on approval: still out, same reasons as the first draft.

## 5 · The work, if approved

Two small lanes, both pure surfacing of mechanics that exist:

1. **The watched-folders band line** — the config file, the scan, the flag, row-opens-center.
2. **The verdict chips** — the floating ✓/✗, block-writing on block-less documents included.

Plus the one-paragraph system-context addition (§3.4), which is context work, not code.

:::approval{id=rfc-070 ask="Adopt the approval flow as redrafted: agnostic watched folders by config file, reject kept as the committed cemetery, verdict chips, your press as the only verdict" verdict=rejected}
Approving licenses §5's two lanes and the system-context paragraph. Rejecting or editing first is
equally a working outcome — the edited document is the spec, and a rejected one gets committed as
the first headstone in its own cemetery.
:::
