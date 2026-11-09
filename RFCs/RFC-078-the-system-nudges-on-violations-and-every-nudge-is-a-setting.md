# RFC-078 — The system nudges on violations, and every nudge is a setting

::rfc{id=RFC-078}

::claims

Out of the planning meeting at `meetings/2026-11-08-arc-dev-infrastructure.md`. One sentence of
design: **the nudging the system already has stays his to control, and the violations it carries are
found by an agent he assigns rather than derived by a machine — a correction is work somebody owes,
so it rides the worklist like every other kind.**

::members{who=systemview-test sent=systemview-test:w8wba1}
## 1 · The problem, as what it costs now

**He audits by hand what nobody else is going to.** On 2026-11-08 he opened filed reports and found
behavioural claims backed only by command lines — four reports in one day — and had to say so
himself, in the chat, after the fact. The next day he read a handbook back and found a sentence I had
written in as his ruling that he never said. Neither is a thing a surface shows him; both are
somebody reading the work and judging it, and the only somebody doing it was him.

**And an agent reviewing its own work is the party with an interest.** It will tell you its mark is
supported, its spec pays for its sentence, and its account named what it skipped — because at the
end of its own work those answers are cheap and nobody is checking. That is not dishonesty, it is
the structure: the same context that produced the work produces the review.

**The one real enforcement machine was invisible and half-true.** The run-chaser nudges an open
sourced run until it closes — and its own settings copy promised *"nudging only stops when the run
closes or is abandoned with a report attached"* — but declaring `abandoned` without attaching the
account appeared to silence it. Doctrine says the word and the account together; if the code accepts
the word alone, the hardest state to reach honestly is the easiest to fake. That one is now fixed
(§2.4) and it turns out to be the keystone: it is the closing rule a correction inherits.

**His controls were a popup holding seven knobs for one nudge.** A popup over the thing you are
configuring hides the thing you are configuring, and it was the wrong shape the moment there was
more than one subject to configure.

**THE COST PARAGRAPH, USED TO ARBITRATE — and it has already arbitrated once, against this
document's own first build.** The question it answers is *what is cheap to get wrong here*, and the
answer is: **a mechanism that judges on its own.** A derivation cannot be argued with, cannot be
told it is wrong about a hard case, and fires on every write forever — so when it is mistaken the
only remedies are to switch it off or to live with it. Measured on 2026-11-09, inside a day of
shipping: two judges derived violations on real documents, one of them reported 45 on a single RFC,
and four separate judge ideas had to be retracted by their own author as 100% false positives
because *an honest document necessarily names things that no longer exist.* A person reading the
work can hold that distinction. A predicate cannot.

So where two defensible builds exist, this document now picks the one with a NAMED PARTY behind the
judgment, every time — and that is what the withdrawal at the end of this file is. His words,
2026-11-09: *"I don't need no automated judge anymore… we just need to use what we had before."*

## 1.5 · The objective this RFC serves

**It is the title, and the title has not moved.** *The system nudges on violations, and every nudge
is a setting.* Two halves, and nothing else is an objective here: **a violation reaches the agent
whose work it is**, and **every nudge that exists is his setting**.

An RFC that does not come from an arc has to name its own objective, and it goes here — at the top,
with the problem, before the design. His ruling, 2026-11-09: *"When we're working on an arc, the RFC
comes from an objective. When we just work on the RFC alone, we gotta come up with our own
objectives… the objectives that are being sought should be placed at the top of the RFC. That way as
we change the spec underneath, at least we know that we're still accomplishing the objective."*

**THE TITLE IS AGNOSTIC ABOUT HOW A VIOLATION IS FOUND, and that is why this document can be rolled
back without abandoning anything.** His observation, 2026-11-09: *"the title captures the objective
and it's agnostic from the judge already."* An automated judge deriving a violation from a document
was one answer. An isolated agent reading the work, finding how it was written wrong, and submitting
a correction is another — and it is the one he asked for in the first place: *"The objective at the
beginning of the RFC was me… protecting you about how to write a spec and how to write this. And I
said, you know what, I need an isolated agent to do that. So at the end of the day, we were just
trying to find a way to track those errors and submit corrections."* The judges are a MEANS. The
nudge record, the two clocks, the audit queue and its doors are means. All of them can go while both
halves of the title stay true.

**WHAT NOT TO DO HERE, measured on this section's own first draft.** It listed four objectives, and
the first was *"a judgment reaches the agent at the moment it is making the mistake"* — a mechanism
this document had invented, written in as an end, and then used to argue that withdrawing the
mechanism would abandon an objective. His correction: *"the judgment reaching the agent was not the
objective… your objectives are too specific."* A design that writes its own means into its ends can
never be rolled back, because every reversal reads as a betrayal of something. **If the title
already says what becomes true, the objective section's job is to point at it, not to elaborate it.**

## 2 · The design

### 2.4 · The chaser's closed-condition — code meets its own copy

`closed = every item done` **or** `status starts with "abandoned" AND the run carries at least one
attachment`. Abandoned alone keeps the chase alive. This is an autobot change (the worklist/nudge
machinery in `electron/agents/`), and it is the settings panel's own help text becoming true.

::::claim[When a run is declared abandoned with nothing attached, the chase continues exactly as if nothing had been said]{id=c13 reviewers=autobot state=met by=systemview-test|autobot at=1794157325231 note="Was already true (the slice's first finding — his observation overturned): excusedOf required the word AND the record from the start. Now pinned starts-with too (a mid-sentence 'abandon' never excuses). nudge.cjs:171-176 read with my own eyes; smoke:nudge 27 assertions green under my hands; mutation seen red. autobot cd2d84c0." told=autobot|systemview-test}
:::run{title="the real excusedOf over declared runs — the word alone is nothing, and a mention is not a declaration"}
- Test.Nudging.excused({ "status": "abandoned — blocked on his review", "attachments": [] }){title="declared abandoned with nothing attached — not excused, the chase continues"}
  - results.excused = false
- Test.Nudging.excused({ "status": "we may abandon this later", "attachments": ["report:some-account"] }){title="the word mid-sentence, even with an attachment — never excuses, the status must START with it"}
  - results.excused = false
:::
::::
::::claim[When a run is declared abandoned with at least one attachment on it, the nudging stops — the same end every item done reaches]{id=c14 reviewers=autobot state=met by=systemview-test|autobot at=1794157331445 note="Made true by the slice: the old guard demanded kind=report, so a run abandoned with a branch or document attached nudged forever; excusedOf now takes any attachment (atts.some(Boolean)), per the wording the completeness press fixed. Verified in the code and by smoke:nudge green + mutation red. Rides his shell restart. autobot cd2d84c0." told=autobot|systemview-test}
:::run{title="the real excusedOf, and the chaser's own suite — any attachment is the account, not only a report"}
- Test.Nudging.excused({ "status": "abandoned — blocked on his review", "attachments": ["branch:lane/some-work"] }){title="declared abandoned with a branch attached — excused, the same end every item done reaches"}
  - results.excused = true
- Test.Nudging.suite({ "name": "nudge", "want": ["abandoned with at least one attachment", "abandoned alone keeps the chase alive", "the record without the word, and the word said in passing"] }){title="autobot tests/nudge.js — both directions of the closed-condition, each by name"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::

**Do these claims add up to the intent?** Yes — the pair covers both directions of the one condition: the word alone keeps the chase alive (c13), the word with its account ends it (c14). One wording decision rides the press: c14 says "at least one attachment" where the panel's copy says "a report attached"; approving the list fixes which is the contract.

### 2.5 · The settings area — the band, not a popup

The cog stays where it is (right end of the band tabs, his 2026-10-19 placement). Its press opens
a **panel in the band area** — the bottom area where the tabs are, "treat it like a tab below" —
instead of a popup. Contents:

- **Two sections, one at a time** — the worklist nudge's knobs and the auto-compaction valve's,
  each on its own tab, each stating its own absence when its door is not there.
- **The existing settings stay exactly as they are** (his note, t3): neither is reworked. The panel
  REHOUSES them — same fields, same doors, same absence lines as the popup had. That is the whole
  of this section now; the list it was built to hold is withdrawn.
- **A selection color** marks the area when the panel is the visible tab (his note, t3).
- A toggle writes the same record the machinery reads — the window's existing
  `window.systemview.nudge` bridge widens to read/write `nudges.json`; no UI copy of the state.

Delete-with-confirm on run rows (already being built on its own board card) lands in the same
area and reuses the same press-turns-into-confirm pattern; this RFC binds its *placement*, not its
build.

::::claim[When the cog is pressed, the settings open as a panel in the band area where the tabs live — nothing pops up over the band; and never does a work tab read selected while they are showing]{id=c15 state=met by=systemview-test at=1794180000000 note="The cog is a button and owns no panel — it cannot pop anything up, which is the structural half, asserted. The pane is a SIBLING of the tab row in the band, which is why the open state had to move up to AgentChat: a child of that flex row could only ever have drawn over the band it belongs to, and that is how it became a popup originally. The claim grew a second clause on his rule that settings is just another tab — picking a kind of work leaves settings, settings leaves every work tab unselected, and the pane REPLACES the strip rather than appearing beside it. Seen rendered in his window by me. systemview 3272744b + e1a091e1." told=systemview-test}
:::run{title="the panel's own jest suite as a door — the cog owns no panel, and the pane is what draws"}
- Test.BandPanel.settings({}){title="src/organisms/AgentChat/BandSettings.test.js — the cog cases by name"}
  - results.suiteProducedResults = true
  - results.failed = 0
  - results.cogOwnsNoPanel = true
  - results.cogReportsItsPressUpward = true
:::
::::

:::details{summary="what built c15, c16, c17, c19 and c36 — the pane, and the door its claims press"}
::commit{sha=3272744b}
::commit{sha=b4013448}
:::
::::claim[When a knob in the settings panel is changed, the harness's own door is what receives it — one field at a time, and the panel keeps no copy of the value]{id=c17 state=met by=systemview-test at=1794230000000 note="RE-CUT, because the half this claim used to be about is withdrawn: it said the RECORD file is what changes, and there is no record. What never depended on it is the reason the claim exists at all — the harness reads these values on every idle tick and every usage report, so a value the window kept would be a setting that changes nothing, and that bug is silent and looks like the knob working. Asserted fresh, since the cases it used to rest on went with the list: a worklist knob reaches the chaser's door and only the chaser's, an auto-compaction knob reaches the valve's, each carrying exactly one field, and the two never cross. Seen RED under mutation — making the worklist section drop its send fails 'a worklist knob goes to the chaser's door and nowhere else'. The panel re-reads the door's answer rather than storing one, which is what makes a clamped or refused value visible at once instead of looking accepted until the next open." told=systemview-test}
:::run{title="both doors, one field each, and the panel holding nothing of its own"}
- Test.BandPanel.settings({}){title="src/organisms/AgentChat/BandSettings.test.js — the two write paths by name"}
  - results.suiteProducedResults = true
  - results.failed = 0
  - results.aWorklistKnobGoesToTheChasersDoor = true
  - results.aCompactionKnobGoesToTheValvesDoor = true
:::
::::
::::claim[While the panel lives in the band, the worklist settings and the auto-compaction settings keep every control they have today, beside the nudge list — the area adds rows and reworks neither]{id=c19 state=met by=systemview-test at=1794180000000 note="Both sections rehoused with every field intact and their own absence lines — nudgeSettings.js and compactionSettings.js are untouched by this slice, which is the strongest form of 'reworks neither'. Each of the three doors states its own absence separately, so a shell carrying one and not another says which rather than letting one hide behind the other. systemview 3272744b." told=systemview-test}
:::run{title="the panel's own jest suite as a door — every control the two older sections had, still there"}
- Test.BandPanel.settings({}){title="the worklist knobs and the auto-compaction knobs on their own tabs"}
  - results.suiteProducedResults = true
  - results.failed = 0
  - results.worklistKnobsAllPresent = true
  - results.compactionKnobsAllPresent = true
  - results.eachSectionStatesItsOwnAbsence = true
:::
::::

**Do these claims add up to the intent?** Yes, for what this section is now. The move out of the
popup is claimed (c15), the write path through the harness's own doors is claimed (c17), and the
no-regression baseline — both older sections keeping every control they had — is claimed (c19). Nothing here claims a nudge
list, because there is none.

Two claims that were in this group are gone and the reasons differ. **c16** (one row per record
entry) went with the record. **c18** (the selection colour) he removed himself on 2026-11-08: *"once
it's visually seen in the window I don't care anymore to keep that as a claim."* So this group is
one behaviour shorter than it was by his decision, and says so rather than counting a claim that is
gone.

### 2.6 · The corpus treatment line

`corpora.json` entries gain one optional key: `"treatment": "<how to read hits from this shelf>"`.
Retrieval (`electron/agents/context.cjs`) prints, at the bottom of any answer carrying corpus
hits, one line per contributing corpus — instructions at the bottom of the results, not metadata
in a manual. Two layers:

- **Derived baseline, free**: an entry carrying `registry:` is machine-fed, and says so without
  anybody authoring a word — *"auto-generated from this project's registered documents — work
  history, not doctrine."* True by construction, like every derived state in this system.
- **His statement on top**: the `treatment` value, edited from the corpora panel (which gains the
  field) or the file itself.

The same `registry:` flag drives the corpora panel rendering the machine-fed corpus distinctly
from the authored handbooks — one fact, no second copy of "this one is different."

::::claim[When a retrieval answer carries corpus hits, its bottom carries one treatment line per contributing corpus]{id=c20 state=met by=systemview-test at=1794157337417 note="context.cjs appends 'How to read these shelves:' after the doc sections — one line per contributing corpus, nothing when no corpus carries anything. smoke:context 175 green under my hands; bottom-not-top and no-line-for-bare-corpus both seen red under mutation. Rides his shell restart. autobot df71cabd." told=systemview-test}
:::run{title="rung: retrieval's own suite — the print site composes the shelf lines inside the answer, so the one-line-per-contributing-corpus, bottom-not-top and no-line-for-a-bare-corpus assertions in autobot tests/context.js are the finest door there is"}
- Test.Nudging.suite({ "name": "context" , "want": ["a corpus with no treatment and no registry prints NO reading line", "a corpus carrying a treatment prints it, one line, named for the corpus", "...and the line is at the BOTTOM of the results, after the hits"] }){title="autobot tests/context.js to its exit — the print-site assertions pinned inside"}
  - results.suitePassed = true
  - results.missing = "||"
:::
::::
::::claim[While a corpus is registry-fed, its treatment line arrives with nobody authoring a word — the derived baseline that says work history, not doctrine]{id=c21 state=met by=systemview-test at=1794157342245 note="treatmentOf derives the baseline from the registry: key alone — no authored word, no second flag. docs suite green under my hands; derived-forced-null seen red in both suites. autobot df71cabd." told=systemview-test}
:::run{title="the real treatmentOf: a registry-fed entry with no authored word — the baseline, word for word, from the key alone"}
- Test.Nudging.treatment({ "registry": "systemview-test" }){title="machine-fed, nobody authored a word — the derived baseline prints and nothing else"}
  - results.prints = true
  - results.said = ""
  - results.derived = "auto-generated from this project's registered documents — work history, not doctrine"
- Test.Nudging.suite({ "name": "docs" , "want": ["a registry-fed corpus earns the derived baseline with nobody authoring a word", "a plain corpus with no treatment says nothing"] }){title="treatmentOf's own suite — autobot tests/docs.js, where the derived-forced-null mutation is pinned"}
  - results.suitePassed = true
  - results.missing = "||"
:::
::::
::::claim[When he writes a treatment for a corpus, his statement prints on top of the derived baseline]{id=c37 state=met by=systemview-test at=1794157347202 note="Said prints above derived in the shelf line ('his statement · baseline'); join-order mutation seen red. An authored-only corpus prints just his statement; whitespace is no statement. autobot df71cabd." told=systemview-test}
:::run{title="the real treatmentOf: his statement rides with the baseline and whitespace is no statement — the said-before-derived join order is the print site's, pinned in retrieval's own suite"}
- Test.Nudging.treatment({ "registry": "systemview-test", "treatment": "work history — read it as evidence" }){title="authored over machine-fed — both layers come back, his words intact"}
  - results.said = "work history — read it as evidence"
  - results.derived ~ auto-generated
- Test.Nudging.treatment({ "registry": "systemview-test", "treatment": "   " }){title="whitespace is no statement — the baseline still prints alone"}
  - results.said = ""
  - results.derived ~ auto-generated
- Test.Nudging.suite({ "name": "context" , "want": ["a registry corpus with a treatment prints HIS statement on top of the derived baseline, one line"] }){title="the shelf line joins his statement BEFORE the baseline — the join-order mutation is pinned in autobot tests/context.js"}
  - results.suitePassed = true
  - results.missing = "||"
:::
::::
::::claim[While a corpus is machine-fed, the corpora panel renders it apart from the authored handbooks]{id=c22 state=met by=systemview-test at=1794157353512 note="The panel row keys off the registry flag alone: machine-fed rows read 'from the <code> registry — work history, not doctrine' where glob rows show root+glob; registry drafts drop the file pickers. Panel suite 5 tests green in yarn verify (2370 total, production build included); the distinct-row guard seen red. Awaits the bundle republish for his window. systemview 53288377." told=systemview-test}
:::run{title="the panel's own jest suite as a door — the named cases this claim stands on, never a count (the Window.js adapter pattern)"}
- Test.Corpora.panel({}){title="run src/organisms/CorporaPanel/CorporaPanel.test.js and read the two render cases by name"}
  - results.suiteProducedResults = true
  - results.failed = 0
  - results.machineFedRowRendersDistinctly = true
  - results.treatmentShownOnTheRow = true
:::
::::
::::claim[When the treatment is edited from the corpora panel — a field the panel carries — the edit lands in the corpora file itself]{id=c38 state=met by=systemview-test at=1794157360373 note="The treatment field rides the audience edit's exact save path (panel → hostAgents.saveCorpus → svPreload → agent:docs-save-corpus → saveCorpora → corpora.json); empty takes the statement back. The slice also caught and fixed the save path destroying a registry corpus's feed on any edit — host.cjs now carries registry: through saves (that carry has no automated test at the ipcMain layer; the panel half is tested). systemview 53288377 + autobot df71cabd." told=systemview-test}
:::run{title="the save path by its named cases — the edit rides the one door, a registry corpus demands no glob, and an emptied field takes the statement back"}
- Test.Corpora.panel({}){title="the same suite, the three save-path cases by name"}
  - results.suiteProducedResults = true
  - results.failed = 0
  - results.typedTreatmentRidesTheSavePayload = true
  - results.registryEditNeedsNoRootAndSendsNoGlob = true
  - results.emptiedFieldSendsEmptyString = true
:::
::::

**Do these claims add up to the intent?** Yes. The warning arrives three ways and each is claimed: the line prints with the hits (c20), the machine-fed baseline needs no author (c21), his statement overrides on top (c37) — and his two panel asks are claimed separately (c22 renders apart, c38 the edit lands in the file). The intent was "a label is not enough"; the treatment line riding every answer is exactly the more-than-a-label.

### 2.7 · The manager — a role he assigns, on any project

The disinterested party, institutionalized. **A manager is a ROLE HE ASSIGNS, not a machine that
watches** — its one act is to read work somebody else did and hand back a correction, and the point
is fixing the work rather than filing paperwork.

- **It is an agent, defined like any other.** A slot in `~/.autobot/projects.json` with its own home
  folder, its own presence and its own store scope — owning no feature code, never fixing what it
  audits, never wanting features (wanting is planning, which is his and the owners').
- **HE ASSIGNS IT, AND TO ANY PROJECT.** His words, 2026-11-09: *"I need to be able to assign the
  manager, and the manager — any project."* So the role is not welded to one repo and one slot: the
  authority is a FIELD ON THE AGENT DEFINITION, which is the surface he already uses to say what an
  agent is. Granting it is a press on a definition, revoking it is the same press, and nothing else
  in the system can hand that authority to itself.
- **Its one verb is `submit`.** A correction in words — what was claimed, what was found instead,
  what would make it true — addressed to the agent whose work it is. That verb is §2.8's, and
  everything it needs already exists.
- **What it does NOT get.** No automatic queue, no clock that watches writes, no derived judgment.
  Those were built and withdrawn (see the dated note at the end): a manager that must produce
  findings invents them, and a machine that derives them is a machine he cannot argue with.
- **Where it can prove, it marks.** `unmet` with a note through the existing mark door; where the
  violation is code drifted from a contract, a gap into the owning repo carrying the spec that
  demonstrates it. Document violations never become gaps — they land on the document and on the
  agent.
- **Reviewers.** On claims whose marks it held, it writes itself into `reviewers=` — the unfilled
  badge is the assignment, and naming is telling, because reviewers already join the claim's fire
  audience. His deterrence point is the cheapest effect in the design: agents work differently
  knowing the unbiased signature is coming.

::::claim[While the manager exists, it is an entire project — its own folder, its own row among the projects, its own presence and store scope]{id=c23 state=met by=systemview-test at=1794160763896 note="Verified live by me: projects.json carries manager → /Users/odionedwards/manager (folder + README exist, read), connectedProjects() includes it, and the store scope derives from the same flat map — a project in the harness's own terms, nothing special-cased. No agent profile and no carried hook — both deliberately his. autobot 1c82d3a." told=systemview-test}
:::run{title="the manager is a project in the harness's own terms — the live roster carries it"}
- Test.Nudging.projects({}){title="the real connectedProjects over the live projects.json — manager rides the same flat map as every repo"}
  - results.roster ~ |manager|
:::
::::
::::claim[A finding is written by the mark door onto the claim block's own line, in one write carrying state, by, at and note — the document is the state, and no side-file door exists for it to take instead]{id=c26 state=met by=systemview-test at=1794186444177 note="RE-CUT on his authorization. The old sentence opened 'When the audit FINDS a mark the work does not support' — a condition on the manager's judgment, so the claim could only be checked by watching an agent find something, and three drains found nothing to flip. What this RFC can check is the WRITE PATH, and that is what the sentence now says. Asserted in autobot tests/markdown-announce.js through the door's whitelist: a proper mark lands state=, by=<caller>, at= and note= in ONE write to the block's own line, and a claim mark with no note is REFUSED by the verb with nothing written at all. Both checked by name rather than by the suite's exit. The no-side-file half is structural rather than asserted, and worth saying plainly: the mark door's only write is docWrite.writeAttr(abs, line, pairs) against the line it was handed, so there is no second target it could write to instead — a finding cannot land in a side file because no side-file door exists in that path. The job document forbids one too (§3.2, 'never a side file, never a feature request, never a message you compose yourself'), but that is conduct and this mark does not rest on it." told=systemview-test}
:::run{title="the write path, by NAMED check: one write to the block's own line carrying state/by/at/note, and a refusal that writes nothing at all"}
- Test.Nudging.suite({ "name": "announce", "want": ["a proper mark lands state= by=<caller> at= note= in ONE write", "a claim mark without note= is REFUSED by the verb, and nothing was written"] }){title="autobot tests/markdown-announce.js — the mark door's own cases"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::
::::claim[When the manager's finding lands on a claim, the document's own fire carries it to that claim's audience — the agent it belongs to and anyone named in reviewers]{id=c40 state=met by=systemview-test at=1794182000000 note="RE-CUT, because as first written this claim contradicted c12 and c9 and could not have worked. It named the WRITE-TIME CLOCK as the carrier, and that clock delivers to the session that wrote the file and to no other (c9, asserted from source) — so a manager writing a finding would have nudged ITSELF. The mechanism that actually reaches the claim's owner already existed and is older than this RFC: a mark on a claim FIRES to the block's audience, and fires.cjs unions `reviewers=` onto whatever the ladder resolves, on his rule that the claim knows who its reviewer is. His intent in t4 is untouched — the note lands on the claim and the claim's agent hears it; only my sentence about which machinery does it was wrong. The carrying half is proven here; the manager WRITING such a finding awaits its agent (c25)." told=systemview-test}
:::run{title="the carrier, at its honest rung: a claim mark fires to the block's audience and reviewers are unioned on — pinned in the fire scan's own suite"}
- Test.Nudging.suite({ "name": "fires", "want": ["a claim's reviewers= joins its audience IMMEDIATELY", "a marked ::claim{subscribe=} fires to its audience alone"] }){title="autobot tests/markdown-fires.js — the reviewers union and the claim fire, by name"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::
::::claim[While a claim names a reviewer who has not signed it, that reviewer's badge renders UNFILLED beside the signed ones — an open obligation you can see, and filling it is their own separate act]{id=c29 state=met by=systemview-test at=1794186453455 note="RE-CUT on his authorization, and this one was the sharpest case for re-cutting: as written it said 'the manager writes itself in as reviewer', which is conduct, AND it was unmeetable by construction while the author of the claims held the manager role — self-adding would have made me my own reviewer and the unfilled badge an obligation I owed myself. I refused to self-add on three consecutive drains for exactly that reason. The re-cut keeps what this RFC built and a reader can see: a declared reviewer who has not signed renders UNFILLED beside the filled signatures. Asserted through Test.Window.claimRow, which runs the claim row's own suite and reads its named cases — the badge-grammar case ('a dashed ✓ is the invitation, a fill is the signature') and the countersign case ('by= grows, nothing else moves') that together say the unfilled state persists until that name enters by= and that filling it moves nothing else. The door grew two fields to transcribe them, because the claim is about what a reader SEES and that suite is the only place it is asserted. The render is live in main.e919cda2. WHO writes the name is the work-audit job's §3.2 and stays there, where it is enforceable; the manager now carries the hook, so that add will be made by a party that did not write the claim." told=systemview-test}
:::run{title="the unfilled badge, through the claim row's own suite — the named cases, never a count"}
- Test.Window.claimRow({}){title="src/atoms/Markdown/blocks/Claim.test.js — the badge grammar and the countersign, by name"}
  - results.suiteProducedResults = true
  - results.failed = 0
  - results.aDeclaredReviewerRendersUnfilled = true
  - results.andFillingItIsItsOwnSeparateAct = true
:::
::::

**Do these claims add up to the intent?** Not yet, and the gap is named rather than hidden. What
these four buy is everything the manager needs that already works: it is a project in the harness's
own terms (c23), its finding lands on the claim block's own line in one write and a wordless mark is
refused (c26), that write reaches the claim's audience including its reviewers (c40), and a declared
reviewer who has not signed renders as a visible open obligation (c29).

What is NOT claimed here is the half §2.8 adds: **the authority to assign the role, and the act of
submitting a correction.** Those are new design and carry no claims yet, because nothing is a claim
before the verdict — they come out of the design when the amendment below is pressed. The four
claims that were here and are gone with it — the enqueue on every write, the idle drain, the clean
pass, the re-entry on a re-mark, and his switch over findings-as-record-entries — were the
automation, and their absence is the point rather than an omission.

And one bound stays conduct, as it was: *"it never fixes what it audits"* lives in the role's own
document, where it is enforceable, and not here. A claim an RFC can only verify by watching an agent
behave well is a hope.

### 2.8 · A correction is a worklist run, owned by the agent that owes it

**His design, 2026-11-09, and it replaces everything the first build put here:** *"corrections are
submitted is just another worklist. Then I can control how it nudges — just like job, just like
skill, using the same feature."* So there is no queue, no second store, no nudge of its own and no
surface of its own. A correction is work somebody owes, and this system already models work
somebody owes.

`submit` opens a RUN with source `correction:<submitter>`, owned by the **owing** agent, its items
being what to fix. Four facts make that work with nothing new underneath, and each was measured
rather than assumed:

- **The machinery already writes a run for somebody else.** `worklist.writeRun(id, session, items,
  source)` takes the session as an ARGUMENT — it is not closed over the caller — and the job path
  already uses it that way, opening a run against a session it was handed. What prevents an agent
  doing it today is the DOOR: `mcp__worklist__set` writes through the calling session's own
  identity, closed over at spawn. So this is one door with an authority check, not new machinery,
  and the authority is §2.7's field on the definition.
- **It survives the session that received it**, which is what makes it a correction rather than a
  message. A run's session reads `session:<projectCode>:<id>` and the chaser matches on the PLACE —
  the slot — through `sameAgent`/`placeOf`. So a run opened for another agent's slot is chased in
  that agent's NEXT session, not lost with the one that happened to be running.
- **The nudging is the one he already controls.** `sourceCounts` is a literal prefix match —
  `sources.some((p) => source.startsWith(p))` — against a list in `~/.autobot/nudge.json`. Adding
  `"correction:"` to it is the whole of "I can control how it nudges": the same idle window, the
  same cooldown, the same context ceiling, the same switch. **No per-source knobs** — his
  simplification, 2026-11-09: *"I can just make it work on what it works now, basically how the
  settings are now."*
- **Retention has to be told, or corrections evaporate overnight.** `WORK_SOURCE = /^(job|lane):/`
  decides which runs are kept `keepWorkHours` (14 days) rather than `keepHours` (12 hours). A
  correction is work with an artifact behind it, so the regex gains `correction:` — miss this one
  line and a correction submitted in the evening is swept before anybody reads it.

**AND IT CARRIES PROSE, because a list of steps cannot say why it exists.** His ask,
2026-11-09: *"they need to be able to submit more words than"* a worklist item. A step is
one clause of work; a correction also has to carry what was violated, where, and what the
sender saw — and that will not fit in a step without turning the step into a paragraph
nobody can check off. So the record gains ONE prose field beside the items, capped at 2,000
characters, written at the open and never by the owing agent: it is the sender's statement,
not a status (a status is the owner's voice) and not a first item (an item is work, and this
is not). Anything longer than a paragraph is a document, and `attach({kind=report})` already
points a run at one.

**THREE THINGS WERE FOUND BY SENDING ONE RATHER THAN BY SPECIFYING IT**, and all three would
have shipped:

- **`save()` carries every key a writer does not own BY HAND** — its own comment says so — so
  the first item the owing agent ticked would have erased the brief. `all()` builds an explicit
  row too, so the band would never have seen it.
- **`stripRuns` was a membership list** filtered to `lane:`/`job:`/`skill:`. An assigned run
  never reached the window from disk at all: the tab could only ever have been empty, and the
  row would have lived exactly as long as the owing session kept re-writing it from a live
  event.
- **The write is not the arrival.** Both test runs were on disk, `stripRuns` returned them
  first, and the owing agent's band read *"0 corrections"* — because everything that re-reads
  the run files rides an event the session itself caused, and this one comes from outside it.
  `assign` announces `run.assigned` into the owing agent's sessions now, the same shape as a
  removed lane announced to every watcher; a refusal announces nothing, because nothing landed.

**Closing it is the rule that already exists, and that is his too:** *"the correction would have to
be explicitly abandoned or completely checked off."* Every item done closes it; declaring it
abandoned stops the chase only with an account attached, which is §2.4's fix (c13, c14) doing the
work it was already built for. **The two-party rule from the first build is gone** — "somebody other
than the owing agent clears it" was mine, not his, and his own words were *"when the thing is
corrected, it goes away."*

**In the window it is a tab beside jobs, skills and lanes**, because that is what it is. The strip
already draws runs by source; it needs to learn one prefix.

**AND WHAT THIS SECTION DELIBERATELY DOES NOT ADD:** no `audit-queue.json`, no append on document
writes, no drain job, no hook, no nudge record entry, no MCP server of its own. Every one of those
was built, shipped and withdrawn in a day. The withdrawal is the dated note at the end of this
document, and the reason it was right is in §1.5: the title never said how a violation is found.

::::claim[While no agent is named as manager, asking to assign work is refused whoever asks — a blank authority admits nobody rather than everybody]{id=c67 state=met by=systemview-test at=1794237652075 note="Asserted through the real MCP handler held out of toolsFor, not the module: with the manager field empty, a would-be manager calling assign is refused, nothing is written (runsFor the target reads 0), and the refusal is SAID into the session rather than only returned. Named check green in the live Test door — 87 assertions, missing '||'. Physically, the field is not empty right now (it reads 'manager'), so the blank state is covered by the suite and not by a live call." told=systemview-test}
:::run{title="the empty field, through the real handler — refused, nothing written, and the refusal said"}
- Test.Nudging.suite({ "name": "worklist", "want": ["an empty manager field refuses everybody — a blank authority is not a permissive one"] }){title="autobot tests/worklist.js — the door called with nobody named"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::
::::claim[When an agent that is not the named manager asks to assign work, it is refused, the refusal names whose job it is, and nothing is written]{id=c68 state=met by=systemview-test at=1794237658342 note="Green in the suite through the door: a non-manager is refused BY NAME ('that is manager'), writes nothing, and the three non-authority refusals (no owner, yourself, an empty list) each carry their reason and write nothing. NOT COVERED PHYSICALLY, and recorded that way deliberately — the manager session exercised assign four times today and passed the gate every time, so it only ever saw the permitted branch and cannot see this one by construction. Closing that needs a live session that is not the named manager; what to check is that the refusal carries the field's value, not just a no." told=systemview-test}
:::run{title="the authority gate, by name — and the three refusals that are not about authority"}
- Test.Nudging.suite({ "name": "worklist", "want": ["assigning is the named manager's, and the refusal says whose it is", "no owner, yourself, and an empty list are each refused with the reason — and none of them writes"] }){title="autobot tests/worklist.js — the door, not the module"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::
::::claim[When the manager assigns work, the run that appears belongs to the agent that owes it and says who sent it]{id=c69 state=met by=systemview-test at=1794237663420 note="Proved physically as well as in the suite. The manager session called assign four times against this agent today; four run records exist under session:systemview-test:assigned, sourced correction:manager, owned by the agent that owes the work and not by the sender. Its answer named the target and the run id each time — verbatim: 'assigned to systemview-test — 1 step and a brief (373c), source correction:manager, run rmw9ej8jh00.'" told=systemview-test}
:::run{title="the write itself: whose run it is, and the source that names the sender"}
- Test.Nudging.suite({ "name": "worklist", "want": ["the manager's assign opens a run owned by the agent that owes it, sourced correction:<manager>"] }){title="autobot tests/worklist.js"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::
::::claim[While an assigned run is open, a later session of the agent that owes it is the one chased — the chase follows the agent, not the session that sent the work]{id=c70 state=met by=systemview-test at=1794237668415 note="placeOf on the written run answers the owing agent, and nudge.sameAgent reads a DIFFERENT session of that agent as the same agent while rejecting another agent's. Green in the suite. The live half is weaker than it looks and is worth saying: the four runs sent today survived a shell restart and are still in this agent's band under a new session, which is the same property from the other end." told=systemview-test}
:::run{title="the half that makes it a correction rather than a message"}
- Test.Nudging.suite({ "name": "worklist", "want": ["an assigned run is chased in the owing agent's NEXT session, not lost with the one that sent it"] }){title="autobot tests/worklist.js — placeOf and sameAgent over the written run"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::
::::claim[While corrections are among the sources the chaser counts, an open one is chased on his existing settings; take them out of that list and it is not]{id=c71 state=met by=systemview-test at=1794237673558 note="sourceCounts('correction:manager', DEFAULTS.sources) is true and the same call against ['job:','skill:'] is false — so his control is the list he already had, both ways, and nothing was built for it. Confirmed on his live file: ~/.autobot/nudge.json carries 'correction:' among sources, set through the band's own settings." told=systemview-test}
:::run{title="his control, both ways — nothing new was built for it"}
- Test.Nudging.suite({ "name": "worklist", "want": ["the chaser counts a correction because `correction:` is in its sources, and nothing else was needed"] }){title="autobot tests/worklist.js"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::
::::claim[When a correction is finished, its record is kept as long as a job's or a lane's rather than as long as a session's list — so one finished in the evening is still there in the morning]{id=c72 state=met by=systemview-test at=1794237678911 note="Asserted on a CLOSED run at both ends of the window — still present after pruning 13 hours past closing (beyond the 12h list window), gone after fifteen days like any other work run. The first version of this check pruned an OPEN run and could never fail, since an open run is never swept at either window; it passed with `correction:` taken straight out of WORK_SOURCE. Re-verified red under that mutation after the fix." told=systemview-test}
:::run{title="both ends of the window, on a CLOSED run — which is the only state where it bites"}
- Test.Nudging.suite({ "name": "worklist", "want": ["a CLOSED correction is kept the work window, not the list window — one submitted in the evening survives the night"] }){title="autobot tests/worklist.js — the janitor itself answers"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::
::::claim[While the band is showing, corrections have a tab of their own that stands whether or not any are owed, and an assigned run never draws in the list pane]{id=c73 state=met by=systemview-test at=1794237684270 note="The band door is green (the tab counts its runs, stands at zero, and every kind is still drawn), and it is confirmed in his live window rather than only in jest: read through the shell's read-only CDP door, the band reads '1 job 0 lanes 4 lists 3 corrections' with three rows whose source badges all say correction:manager, and none of them in the lists pane. The tab stood at '0 corrections' before any arrived, which is the floor half." told=systemview-test}
:::run{title="the band's own suite as a door — the tab, its count, and the floor it stands on"}
- Test.BandPanel.band({}){title="src/organisms/AgentChat/bandTabs.test.js — the corrections tab by name"}
  - results.suiteProducedResults = true
  - results.failed = 0
  - results.correctionsCountsItsRuns = true
  - results.theTabStandsAtZero = true
:::
::::
::::claim[He picks the manager from the agents the harness knows, nobody is one of the choices, and a name that is no longer an agent is shown rather than quietly rewritten]{id=c74 state=met by=systemview-test at=1794237689686 note="Four cases green through the panel's own door: it offers every defined agent with nobody as the default, picking one writes it once, returning to nobody writes the empty authority, and an absent roster says so rather than drawing a menu of one. The door had to be repointed first — it was still transcribing the three text-input cases (placeholder, commit-on-blur, escape) that went with the typed field, and a door naming a case that no longer exists answers false for a reason that has nothing to do with the behaviour. The roster comes from window.systemview.agent.defs, the same door the Agents page uses, so no shell bridge was added." told=systemview-test}
:::run{title="the panel's own suite as a door — the roster, the pick, and the empty authority"}
- Test.BandPanel.settings({}){title="src/organisms/AgentChat/BandSettings.test.js — the manager field by name"}
  - results.suiteProducedResults = true
  - results.failed = 0
  - results.managerOffersEveryDefinedAgent = true
  - results.pickingOneWritesItOnce = true
  - results.nobodyIsAChoiceHeCanReturnTo = true
  - results.anEmptyRosterSaysSo = true
:::
::::

**This claim was rewritten on 2026-11-09 and the design moved with it.** It used to
say *"when he types a name… nothing is written until he commits the edit"*, and a typed
field was his first sight of this panel: *"I don't know why you didn't just give me the
ability to select the agent or why would I type a specific name in."* He is right, and
the field was worse than inconvenient — the authority is compared to a session's slot
exactly, so one typo named an agent that does not exist and produced a refusal that was
correct and unactionable (*"assigning work is the manager's, and that is managr"*). A
select cannot misspell, and it is one discrete act, so the draft-and-blur dance that
existed only because a text input writes once per keystroke went with it.

::::claim[When a correction is assigned with a brief, the owing agent reads the sender's prose above the steps without opening anything, and working the list never rewrites it]{id=c75 state=met by=systemview-test at=1794237696238 note="Four named checks green (the brief on the record, surviving the owner working the list, absent when none was sent, capped at the write) and confirmed in his live window: two of the three correction rows render their prose with the row CLOSED — 'Arrival test, 2026-11-09…' and 'Physical test of the assign verb…' — read off the live DOM, not claimed. It was inside the fold first and he caught it: 'if the corrections has briefs, I don't see a brief.' Two defects found by sending a real one: save() carries unowned keys by hand, so the first ticked item would have erased the sender's words, and all() builds an explicit row, so the band would never have seen it. The cap is visible at the call site — the manager measured his own brief at 373 characters and the answer said (373c)." told=systemview-test}
:::run{title="the record, the row, and the absence — through the real MCP handler"}
- Test.Nudging.suite({ "name": "worklist", "want": ["a brief rides the record beside the steps, and the door confirms one arrived", "working the list never rewrites the brief — it is the sender's statement, not a status", "a correction with no brief leaves the key off the record and an empty string on the row", "the brief is capped where it is written — prose that wants a document has to be one"] }){title="autobot tests/worklist.js — the brief, its survival, its absence and its cap"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::
::::claim[While a correction is open, it draws in the owing agent's band read off disk, and in no other agent's]{id=c76 state=met by=systemview-test at=1794237701218 note="stripRuns returns every correction run for the owing agent and none for the sender, asserted from both sides. This claim exists because the behaviour did not: the filter was a membership list reading lane:/job:/skill: only, so an assigned run never reached the window from disk and the tab built for it could only ever have been empty — the row would have lived exactly as long as the owing session kept re-writing it from a live event. Found while wiring the brief, mutation-verified red with `correction:` removed." told=systemview-test}
:::run{title="the strip is a membership list, and a run kind missing from it draws a tab that can only be empty"}
- Test.Nudging.suite({ "name": "worklist", "want": ["an assigned run reaches the owing agent's band from disk, and only the owing agent's"] }){title="autobot tests/worklist.js — stripRuns, from both sides"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::
::::claim[When the manager assigns work, the owing agent's open window learns of it without that agent doing anything — and a refused assign tells nobody]{id=c77 state=met by=systemview-test at=1794237708245 note="Proved by a deliberate experiment rather than by the assertion alone. The manager was asked to send one correction while this agent touched NOTHING in its own session; the live band went from 2 corrections to 3, with the new brief rendered, read off the DOM between its call and any local write. Before the fix the same test failed in the open: two runs on disk, stripRuns returning them first, the band reading '0 corrections' — everything that re-reads the run files rides an event the session itself caused, and this one comes from outside it. assign now announces run.assigned into the owing agent's sessions (the shape lane.removed already used) and laneTick treats it as a re-read; a refusal announces nothing, asserted. The manager named its own half of this: it had reported the first two runs 'landed' off the writer's receipt rather than off the owing agent's band." told=systemview-test}
:::run{title="the write is not the arrival — the announce, and the silence on a refusal"}
- Test.Nudging.suite({ "name": "worklist", "want": ["an assign announces itself into the owing agent's sessions — the write is not the arrival", "a refused assign announces nothing — only a write that happened is told"] }){title="autobot tests/worklist.js — the handler's announcement, collected at the door"}
  - results.suitePassed = true
  - results.matchedAll = true
  - results.missing = "||"
:::
::::

**Do these claims add up to the intent?** Yes, and the intent here is narrow: an isolated agent can
hand a correction to the agent whose work it is, it arrives rather than waiting to be found, and he
controls both who may send one and whether they are chased. The authority is claimed from both
sides — nobody named refuses everybody (c67), and a named manager is the only one admitted (c68).
The write is claimed for whose run it is (c69) and for surviving the session that sent it (c70),
which is the difference between a correction and a message. His control is claimed as the thing he
already has (c71) rather than as a new switch. The record lasting long enough to be read is claimed
on a closed run (c72), because that is the only state where the window bites. And the two surfaces
are claimed where he meets them: the tab (c73) and the field (c74).

**What is NOT claimed, and each is deliberate.** CLOSING a correction carries no claim of its own
because it is not new behaviour — every item done, or abandoned with an account, is c13 and c14
doing the work they were already built for; a second claim here would be a copy of theirs that
could drift. The REFUSAL REACHING THE CHAT is asserted inside c67's case and not raised to its own
sentence, because the channel is the one every other refusal in this session already rides. And
nothing claims that the manager judges WELL — that is conduct, it lives in the role's own document,
and a claim an RFC can only verify by watching an agent behave well is a hope.

## 3 · Slices, in landing order

**Four of the original eight landed and stay** — the chaser's closed-condition (§2.4), the settings
moving into the band (§2.5), the corpus treatment line (§2.6), and the manager existing as a project
(§2.7). The rest built §2.1–§2.3 and the audit queue, and are withdrawn; the dated note at the end
says what that removed.

What is left to build is §2.8, and the order is forced by one rule: **nothing teaches an agent to
call a verb that does not exist yet.**

**3.1 · The authority field on the agent definition** (§2.7). Whatever says *this agent may open a
run for another agent* goes in first, through the definitions path he already uses, with nothing
reading it yet. First because it is the only part that is HIS act: until the field exists there is
nothing for him to assign, and a `submit` verb that assumes an authority nobody can grant is a verb
that can only be tested by granting itself.

**3.2 · Retention, before anything writes one** (§2.8). `WORK_SOURCE` gains `correction:` so a
correction is kept the fourteen days a job or a lane gets rather than the twelve hours a skill list
gets. Before `submit`, deliberately: land them in the wrong order and the first corrections anybody
submits are swept overnight, which is a bug that looks like nobody writing any.

**3.3 · `submit` opens the run** (§2.8). One verb, reading the authority from 3.1 and refusing
without it, handing `worklist.writeRun` the OWING agent's session instead of its own. The refusal is
said into the calling session's feed rather than only returned — a door that refuses and returns is
a door whose refusal an agent can drop on the floor.

**3.4 · The chaser counts it** (§2.8). `"correction:"` joins the default `sources` in
`~/.autobot/nudge.json`. One array entry, and it is the whole of *"then I can control how it
nudges"* — same window, same cooldown, same ceiling, same switch, no new knobs.

**3.5 · The window learns the prefix** (§2.8). A corrections tab in the band strip beside jobs,
skills and lanes. Last because it is the only slice that shows nothing until the four above have
produced something to show, and a tab drawing an empty state for a verb nobody can call yet is a
surface that teaches the wrong thing.

## 4 · What this does NOT add

- **No automated judge, and no mechanism that derives a violation at all.** Built, shipped and
  withdrawn inside a day. The reason is §1's cost paragraph: a derivation cannot be argued with,
  and four separate judge ideas were retracted by their own author as false positives within hours.
- **No second store.** No `audit-queue.json`, no `nudges.json`, no record of corrections anywhere
  but the worklist the system already keeps.
- **No clock of its own.** Nothing watches document writes, nothing sweeps a registry, nothing
  fires on an idle but the chaser that already did.
- **No nudge of its own, and no per-source knobs.** The chaser's existing settings carry it. His
  simplification: *"I can just make it work on what it works now."*
- **No second settings surface.** The band panel holds the worklist knobs and the auto-compaction
  knobs, and that is all it holds.
- **No two-party clear.** A correction closes when its items are done or it is explicitly abandoned
  with its account — the rule every run already follows. The "somebody else closes yours" rule was
  the author's invention and is gone.
- **No window press that submits or clears one.** Submitting is a judgment with an author; it goes
  through the agent door where the caller has a name.
- **No category of managers.** One role, assignable by him to any project, and the question of
  several waits until this loop has run.

**HIS PRESS ON THE DESIGN, RESTORED UNEDITED.** The question below names a list of judges, and
that list is withdrawn — but the words are not mine to change: a verdict answers the question it was
asked, and rewriting the question would forge what he agreed to. What became of the design it
approved is the dated withdrawal further down.

:::approval{ask="Approve RFC-078 — nudges grow into a configurable list of judges, and the settings move into the band?" verdict=approved told=systemview-test}
Approving commits to the design above — enough to reduce it to claims and build from it.

The piece most worth rejecting is §2.3: both clocks owned by the shell, no channel anywhere. If you
want violations to arrive the instant they are derived rather than when a clock asks, the seam
between §2.2 and §2.3 changes shape, and slices 3.2 and 3.3 with it.
:::

## Claims

:::approval{ask="Is this the complete list of claims for RFC-078?" verdict=approved told=systemview-test}
Pressing this fixes the set of claims as the contract — as agreed now, editable later in the open
when the design moves. A behaviour missing from it is one we agreed not to check, so read for what
is NOT here.
:::

**Coverage, section by section, after the withdrawal.** The count is the bar's, under the leaf, and
is deliberately not typed here — a number in prose disagrees with the derivation the moment a claim
is added or removed, and this sentence read "forty" for a day while the document carried sixty-two.
What the sections carry now: §2.4 c13–c14, §2.5 c15, c17 and c19, §2.6 c20–c22 and c37–c38,
§2.7 c23, c26, c29 and c40. **§2.8 carries NONE, and that is the honest state rather than an
omission** — it is new design, and nothing is a claim before the verdict. Its claims come out of it
when the amendment below is pressed.

**§2.1, §2.2 and §2.3 are gone, and the numbering is not closed up.** 2.4 follows nothing, which
reads oddly and is deliberate: renumbering would make every reference in every commit message, note
and sibling document point at a section that now means something else — dangling beats wrong.

**Three sections still carry no claims, for the reasons they always did.** §1 is cost prose — its
one testable observation, that abandoning without an account silences the chase, is exactly what c13
and c14 check. §3 is landing order. §4 commits to absences, and the load-bearing ones are claimed
where their design lives.

**The classifications took a blind second pass** when the list was written — bare statements, none
of the author's verdicts in the brief. It ratified behavioural everywhere and experiential on
exactly one claim, which he has since removed, so this document carries no experiential claim at
all. Its proposed splits are folded in and its ambiguity flags reworded c3, c12, c17, c19, c21 and
c29. One flag it raised is still live and still handed to a press rather than resolved: c14 follows
§2.4's own words — *at least one attachment* — which is looser than the chaser's settings copy, *a
report attached*.

## The 2026-11-09 withdrawal

**Most of this document was built, shipped, and withdrawn inside about thirty hours.** What was
removed: §2.1 the nudge record (`~/.autobot/nudges.json`), §2.2 the judges
(`electron/markdown/judges.cjs`), §2.3 both clocks, the audit queue and its four verbs, the
`corrections` MCP server, the `work-audit` job and its idle hook, the band's nudge list and
corrections tab, and 43 of the 63 claims with the proofs and the two suites behind them —
`tests/judges.js` whole and most of `tests/nudges.js`.

**His decision, and the reasons are his:** *"we don't need any automation, we just need to use what
we had before — I don't need no automated judge anymore."* And on scope: *"the RFC didn't need to be
that big. There's no features that we need. Really, we got a manager and a worklist of settings
called corrections."* And on why the reversal costs nothing: *"if you roll back, you get to roll
forward bit by bit."*

**IT ABANDONS NO OBJECTIVE, and that is checkable rather than reassuring** — §1.5 is the test and
the title is the objective: *the system nudges on violations, and every nudge is a setting.* It
never said how a violation is FOUND. A judge deriving one was an answer; an agent he assigns
finding one and submitting a correction is another, and it is the one he asked for at the start.

**What the first build bought that survives**, because the reversal is not a verdict on all of it:
the chaser's closed-condition now tells the truth (§2.4), the settings live in the band instead of a
popup (§2.5), every retrieval answer carries its corpus treatment line (§2.6), the manager exists as
a project, the mark door refuses a signature with no statement, and a declared reviewer renders as a
visible open obligation (§2.7). Four separate judge ideas were also retracted by their own author as
100% false positives on the day they were proposed, which is the evidence §1's cost paragraph now
rests on.

**And the measured lesson, because it cost a day:** this document wrote its own MEANS into its ENDS.
Its first objectives section listed *"a judgment reaches the agent at the moment it is making the
mistake"* as an objective, which is a mechanism — and then that sentence was used to argue the
mechanism could not be withdrawn. A design that does this can never be rolled back, because every
reversal reads as a betrayal of something. His correction: *"the judgment reaching the agent was not
the objective — your objectives are too specific."*

:::approval{ask="Approve the 2026-11-09 withdrawal, and §2.8 — a correction is a worklist run owned by the agent that owes it?"}
Approving commits to two things: that the automation above is withdrawn rather than paused, and that
corrections ride the worklist the system already has — enough to reduce §2.8 to claims and build it.

The piece most worth rejecting is making the run **owned by the agent that owes it.** That is what
buys everything else for free — the chase, the settings, the fourteen-day retention, the slot
surviving a session — but it also means the owing agent closes its own correction. The first build
refused that on purpose and the refusal was the author's invention, not his; if the loop needs a
second party after all, §2.8 is not a worklist run and the whole section changes shape.
:::

**EVERY COMMIT THAT BUILT THIS DOCUMENT, INCLUDING THE ONES WHOSE SECTIONS ARE GONE.** A commit
record parked inside a claim's fold dies when that claim is removed, which is how 45 of these were
lost once already — so they live here, at the document level, where nothing but the document's own
deletion can take them. The withdrawn work is part of what this document cost and stays walkable.

:::details{summary="what built RFC-078 — every commit, in order"}
::commit{sha=56e32c94}
::commit{sha=f22c697b}
::commit{sha=38b4fb3c}
::commit{sha=6609507}
::commit{sha=eeb8202f}
::commit{sha=442d8aa}
::commit{sha=a94ba8d}
::commit{sha=711b0bb}
::commit{sha=66e3e6c6}
::commit{sha=e5ad6dc}
::commit{sha=6893a13}
::commit{sha=806bf86e}
::commit{sha=0187663}
::commit{sha=8446b18d}
::commit{sha=ab4bd2db}
::commit{sha=e6a4c422}
::commit{sha=801935f4}
::commit{sha=4ef8e2b project=autobot}
::commit{sha=49374da6}
::commit{sha=2fbd7e38}
::commit{sha=f33315ac}
::commit{sha=131752e2}
::commit{sha=1f52c6c5}
::commit{sha=fc5b0045}
::commit{sha=d14daddf}
::commit{sha=c7d600da}
::commit{sha=c5bdec7a}
::commit{sha=c8acaa62}
::commit{sha=e64117fa}
::commit{sha=c5511f54}
::commit{sha=6c822f4b}
::commit{sha=7b371467}
::commit{sha=2ad41141}
::commit{sha=18bb142e}
::commit{sha=6a685ca9}
::commit{sha=caf91f08}
::commit{sha=db468f9f}
::commit{sha=3f007598}
::commit{sha=e832cb53}
::commit{sha=02d70d39}
::commit{sha=f30cb336}
::commit{sha=e1a091e1}
::commit{sha=0780c150}
::commit{sha=328d1c4e}
::commit{sha=e97b6437}
::commit{sha=40c268e2}
::commit{sha=39bfa04a}
::commit{sha=53288377}
::commit{sha=ce04e13 project=autobot}
::commit{sha=ac680d9 project=autobot}
::commit{sha=897363db}
::commit{sha=2c148a2b}
::commit{sha=3abc3313}
::commit{sha=cd3415b6}
::commit{sha=f7fb5575}
::commit{sha=dae0c11f}
::commit{sha=d644f489}
:::

## STATUS — withdrawn in part, and §2.8 built 2026-11-09

The automation is withdrawn — the judges, the nudge record, the two clocks and the audit queue are
gone from the tree, and the dated note above is their record rather than a plan. What remains of the
original design is built and marked: §2.4's closed-condition, §2.5's settings in the band, §2.6's
corpus treatment line and §2.7's manager.

§2.8 is built. A correction is a worklist run owned by the agent that owes it, opened by
`mcp__worklist__assign` under one authority — the manager he names in the band's own settings —
carrying prose beside its steps and announcing itself into the owing agent's sessions. The count
below is derived from the blocks in this file and is typed nowhere.

**Its approval block is deliberately UNPRESSED.** The build ran on his explicit go in conversation,
which is the gate the procedure allows; the verdict is his to write and nobody else's, and the
document says draft until he does.

**TWO THINGS THIS WALK DOES NOT CLAIM, both named rather than left to be inferred.** The authority
REFUSAL has never been exercised by a live session that is not the manager — the manager passed the
gate on all four of its calls and cannot see that branch by construction, so c68 rests on the suite
alone and closing it needs another agent. And the blank-authority state (c67) is asserted the same
way, because the field on his machine is not blank.

::claims
