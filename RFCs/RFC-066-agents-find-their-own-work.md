# RFC-066 — Agents find their own work

**Status:** design, settled with Odion in conversation and in threads on this document, 2026-10-02/03.
**Design only — nothing here is built**, except the two fixes noted in §7.
**Owner:** systemview-test.

---

## 1. What this is — self-directed, not unrequested

An agent is nudged, not told. It goes looking, finds work, does it in a lane it cuts and REGISTERS itself — no subagent, no
delegation; registering is the `worklist set` with `source: "lane:<branch>"` and it is what draws the
row — and leaves a report
attached to that lane. He walks in later, reads the report, and either takes it forward with the agent
or throws the whole thing away.

> *"In my imagination, agents will really be working on their own, solving problems. Then I look at
> the report, review it together, refine it — or reject it whole cloth."*

**The axis is directed vs self-directed, not requested vs unrequested** — his correction, and it
matters because the first draft of this RFC had it wrong. The board, an RFC whose STATUS section says
what is left, a recorded gap: those are all work he *did* ask for. They were asked for once and left
standing. What makes a lane proactive is that **nobody pointed the agent at it in this turn** — the
agent went looking instead of being sent.

That reframing is not cosmetic. It says the strongest proactive work is not the agent's invention but
**his own backlog**: requested, then forgotten. Forgetting is the thing a human is worst at and a
system is good at, which is why §4's evidence is mostly his own trail rather than the agent's ideas.

The lane still looks different from one he commissioned, because the deal is different: **a proposal
that arrives with the work already done.**

## 2. Why it is a plan and not a feature

His reason for planning it at all:

> *"we want to update the context of the agents in the system to make it better — agents to
> proactively also find work."*

That is the subject. The trigger exists, lanes exist, reports render, a lane can be deleted and the
row disappears by itself. **What is missing is that agents do not look.** Looking is a context problem
— a skill, and a step added to one that already runs — and context is where this is won or lost. The
code in §5 is the small half.

## 3. What the work actually is

Not new features. **Things that already exist and half-work.** He named three, mid-conversation, as
examples of the class rather than as requests:

- You click a row in the commit log expecting it to expand and show the whole commit — the file list,
  the diff — and it does not.
- There is no undo-a-commit anywhere. Undoing one meant an agent running `git reset HEAD~1` by hand,
  which is him dropping to a command line for a flow this system claims to own.
- Clicking one lane row expands it, but the panel lands underneath **all** the rows instead of under
  the one he pressed — so at ten lanes it appears at the bottom, nowhere near the click.

> *"It's not like I really want that. It's just that there's so many things that can work more fully
> and better."*

This class is the richest source of proactive work and the only one with **no detector**, because it is
found by *using* the thing. Every real finding of 2026-10-02 arrived that way: a commit block that
reported success for a commit containing three unrelated files; 31 jest suites that never load, so
`yarn test` reads green at 363 passed while skipping half the file; a lane row printing an entire step
sentence as its status; a fire-rate picker offering three of the nine rates that existed.

None of those were looked for. All of them were hit.

## 4. Choosing what to do — and the board is the queue

**Evidence, not a priority list.** A fixed hierarchy of "docs first, then tests, then refactors" is a
parallel list, it rots, and it decides in advance what matters.

The rule is **strongest evidence, smallest blast radius**. The evidence:

1. **A surface that half-works** — §3. Found by use, recorded when found or lost forever.
2. **An RFC whose STATUS section says what is left.** Uncommitted, which is his signal.
3. **The board.**
4. **`doc-candidate` notes, and notes that contradict the code.**
5. **Tests that do not run** — not failing, *not loading*, which reads as passing.
6. **Corpus drift.**

### The collector, which was the missing half

The first draft said the evidence is already recorded and nothing reads it. True, and not enough:
"recorded" meant scattered across note scopes, a `gaps/` folder, and test output nobody re-reads. His
answer is better and uses a surface that already exists:

**`context-maintenance` gains a step: anything noticed that would make good proactive work goes on the
board.**

That makes every maintenance pass a collector, and the board the queue the proactive skill reads
first. It also closes an asymmetry worth naming: a gap written into a note is a gap nobody is handed,
while the board is a place he actually looks. A step in a skill that already runs beats a new
mechanism, and beats a sentence in an agent doc.

The skill must still **write down what it found and did not do** — on the board, now. A pass that
surfaces four gaps and fixes one has produced five things, and four of them evaporate otherwise.

## 5. The report

> **RETRACTED, 2026-10-03 — the MECHANISM, not the account.** This section was built: `report` as a
> parameter on `worklist set`, stamped onto the lane's run record beside the receipt, carried through
> `save()`, on every lane row, with a live-agent test proving a model could reach it. He killed it
> before it was ever committed, on sight, and his reason is the one to keep: *"I'm not going to use
> it such as it is… it was never necessary."*
>
> **Why it was never necessary:** a report already has a home. `show` files one into the reports
> panel, `nav({report})` opens it, `comments`/`reply` thread on it — the surface he actually reads
> reports in, with none of this. A second report store hanging off the run record was a new place for
> the same artifact, which is the one thing this system is supposed to refuse.
>
> **What was removed:** the parameter, `markReport`, the `save()` carry, the row field, the
> `run.report` event, and six test claims. What SURVIVED is §5's other half — `selfDirected`, read off
> the session by the host — because that was never the report; it is provenance, and it is still the
> thing a row needs.
>
> **What stays open for the job work:** where a self-directed lane's account lands. The paragraphs
> below still describe what the account must SAY, and that part was never in dispute. Where it is
> stored is now an open question, and RFC-067's answer — a deliverable is what makes a job a job —
> is where it gets settled. Do not re-add a field to the run record to answer it.

A lane today shows a **brief** in its panel — what it was told. The report is the mirror: **what it
found.** Being markdown it renders interactively like everything else.

### It opens with an overview, and the overview says how the work was found

His addition, and the part a proposal cannot skip: **the report begins like an RFC — an overview — and
that overview says how the agent came upon this work.**

For commissioned work the *why* is settled before the lane starts: he asked. A proposal has no such
standing. It arrives unbidden, costs him a read, and the first thing it owes him is the answer to *why
is this in front of me*, before any of what it did.

1. **How I came upon this.** The evidence, named and checkable — the board line, the RFC's STATUS, the
   suite that would not load, the surface that came up short while I was using it for something else.
   Not "I noticed"; the actual trace.
2. **What I judged, and what I passed over.** The other candidates and why this one. A proposal
   presenting itself as the only option hides the judgement that is the most interesting thing in it.
3. **What I did.**
4. **What I could not verify.**

§4 and this section are one requirement seen from two ends: an agent that must *write down* how it
found the work cannot pick a subject it invented, because section 1 would be empty.

### The row, and the confirm

The lane row has to say *nobody sent me here*. **Not by the agent declaring it** — the harness knows
whether the turn that spawned the lane began with his message or with a hook firing, and that is
readable state rather than an agent's word for it.

And the delete confirm **inverts**. Today its vocabulary is *do not lose work you asked for*: "branch
not merged — real work dies with it." For a proposal, discarding is the **default outcome**, so there
is no warning. The burden is on the report to earn a keep. That is what makes switching this on safe:
a proposal is cheap to throw away.

## 6. It does not bring itself in — and the report is the delivery

For work he asked for, the owner applies the lane's diff into the tree. **Self-directed work inverts
that:** it stays on its branch until he says yes.

**No `::branch` block.** His correction: he already sees every branch on the chat's bottom lip, so
putting one in the chat re-announces state he can read — the same mistake as a row that testifies. The
delivery is **the report**; if a branch belongs anywhere it is inside the report, as part of the
argument rather than as the handover. (That the delivery is an account rather than a branch block is
untouched by §5's retraction — what changed is only where the account is kept.)

`delegation` gains one sentence, not a redesign: **a lane you were sent to do comes in; a lane you went
and found waits.** Step 6 is unchanged for every lane that exists today.

## 7. One dial: the rate

An earlier draft had two dials — a rate, and a cap on standing proposals. Then I tried to move the cap
onto the hook. Both were wrong, and his reason is the one to keep:

> *"A hook fires. What are we limiting? In our minds we want to limit the amount of lanes. The hook has
> nothing to do with that."*

A `limit` on a hook caps the wrong noun. The hook does not know how many proposals are standing, and
asking it to care is how a field comes to mean something adjacent to what it says. **Rate over time is
the dial**, and it is sufficient: duplicate the hook, name it for the agent, enable it there, turn the
rate down when it fires too often.

Which makes **duplicating a hook load-bearing** rather than a nicety — per-agent rates are the whole
answer, and authoring one from scratch per agent is not that. There is no copy today. §8.

### Two things fixed on 2026-10-03, because this section could not be used otherwise

- **The rate picker offered three of the nine rates that existed.** Once per session, every 5 minutes,
  every hour, and nothing else — so `once-per-day`, `once-per-week`, `once-per-month` and the
  `cooldown:` duration spellings were live in the shell and **unreachable from the window.** That is
  why a feature he spent conversations designing never appeared. It now offers session · 5 min ·
  hourly · 12 hours · daily · 3 days · weekly · 2 weeks · monthly · none.
- **The form was still writing `guard:`**, the deprecated spelling, so every hook authored from the
  profile used the old key. Reading tolerates both; writing does not.

## 8. The pieces

1. ~~The **report** — written by the lane, shown in its panel beside the brief, dies with the lane.~~
   **Retracted** — see §5. The account's *shape* stands; its storage is RFC-067's question.
2. **Self-direction read from the trigger**, not declared by the agent.
3. The **row and the confirm**: a proposal reads as one, and discarding it is the default.
4. The **skill**: read the board and the rest of §4 → judge → pick → work in a lane → file the report →
   put what it found and did not do back on the board.
5. **A step in `context-maintenance`**: proactive-work candidates go on the board.
6. **Duplicate-a-hook**, so a per-agent rate is a tweak rather than a re-authoring.
7. A **hook** per agent — idle plus the rate he chooses — pointing at the skill.

**Why a skill and not just a hook:** a hook's `do` is `skill:<name>` — it carries a pointer, never a
procedure, so it cannot drift from the thing it names. With no skill there is nothing to fire at. And
the procedure is not one step: read, judge, pick on blast radius, open the lane, work, report with
provenance, record the rest. That is where the thinking is, and it is the one item here with real
substance — three of the others are a single field each.

## 9. Open

- **Which agents carry the hook, at what rate.** His call, and not all of them at once — the agents he
  works with daily and the ones deliberately left alone want different rates, which is what §7's
  duplication is for.
- **Whether a proposal may ever land itself** — a one-line fix with a test, where a branch is more
  ceremony than the change. §6 says no; the first ten proposals will say whether that holds.
- **How a proposal he keeps becomes ordinary work.** Does the lane convert, or does he commission it
  fresh?
- **`remember(subscribe:)` instead of a separate subscribe tool.** Raised and deliberately not chased.
  It bears on §4: recording is weaker than delivery, and the board step is the cheap version of the
  same fix.

## STATUS — built and running, 2026-10-16

Seventeen closed proactive runs on disk, every one with its report; evaluation-before-work recorded
on the board each run; lanes always; the rate is the hook's. §9's open items are design calls that
stay his — they are questions about the system, not missing parts of it.
