// THE CONTENT OF THE HOW-WE-WORK PAGE, as data — so the page is a renderer and the words are
// reviewable in one file. Nothing here is fetched: this surface teaches the METHOD, and the method
// does not change when a project disconnects. (His ruling while this was commissioned: hardcode the
// content, make it communicate; live-wiring is a later decision.)
//
// THE SOURCE OF THE LIFECYCLES IS TONIGHT'S PLANNING REPORT, re-read from his tree at 05:43 while
// he was still editing it (the arc's third state was renamed, the report gained `as=spec`, and the
// framing rule was rewritten between the first read and this one) —
// `meetings/2026-10-27-the-lifecycle-of-every-kind-we-register.md`, which is the current definition
// and outranks both the older handbook chapters and the code. `lifecycleState.js` is the code's one
// definition and it has NOT caught up on two kinds yet; `lifecycles.test.js` pins the difference on
// purpose, so when the code lands the test fails and says which exception to delete.

// ───────────────────────────────────────────────────────────────────────────────────────────────
// THE FLOW — the spine of the page, and the thing a newcomer is actually here for. Every stage
// names the artifact it leaves behind, because that is what makes this a method rather than a mood:
// at every step there is a document somebody can open.
export const STAGES = [
  {
    id: "goal",
    label: "A goal",
    hand: "you",
    kicker: "in your words",
    artifact: "a planning report",
    leaf: "::report{id=… as=planning}",
    body:
      "You say what you want to a chat — not a ticket, a working session. The agent researches how " +
      "the project actually works, writes what it found, and puts its own opening proposal under it. " +
      "You argue with it in the document itself: threads, replies, your voice kept verbatim.",
    note: "A planning report is done when its conclusions LEFT it — when it became an arc, a plan or a spec.",
  },
  {
    id: "arc",
    label: "An arc",
    hand: "agent",
    kicker: "a body of work",
    artifact: "objectives, each with an owner",
    leaf: "::arc{id=ARC-004 owner=…}",
    body:
      "What was agreed is broken into numbered objectives. An objective carries a why before its " +
      "what, an owner, and its requirements. The arc is the one document that says WHO BUILDS WHAT.",
    note: "An arc runs the same approval flow a plan does. Nobody should be executing against a draft.",
  },
  {
    id: "rfc",
    label: "A plan",
    hand: "agent",
    kicker: "attached to one objective",
    artifact: "implementation detail, slices, claims",
    leaf: "::rfc{id=RFC-073 arc=ARC-004-O2}",
    body:
      "An arc says who builds what; an RFC says HOW — the implementation detail, the slices in " +
      "landing order, and a verdict block naming what approving commits to and which piece is most " +
      "worth rejecting. It attaches to the objective by id, never by path.",
    note: "Approving is a press inside the document. No verdict means draft — not weak approval.",
  },
  {
    id: "claims",
    label: "Claims",
    hand: "you + agent",
    kicker: "the contract",
    artifact: "a numbered list somebody can check",
    leaf: "::claim[…]{id=c1}",
    body:
      "Extracted from the approved design, on a second day and a second press. Each claim is a " +
      "statement that will be true when the work has landed — and each one can carry its proof in " +
      "a fold: a test, a run, a command you press.",
    note: "A claims list written before the design settles is a list of proposals, and proposals cannot be checked.",
  },
  {
    id: "build",
    label: "The build",
    hand: "agents",
    kicker: "slice by slice",
    artifact: "commits in your tree",
    leaf: "::branch[lane/…]",
    body:
      "Most work lands directly in your tree, unstaged, where you review everything else. Work an " +
      "agent delegates or runs unattended goes to a LANE instead — its own branch and worktree, a " +
      "row you can watch and a record you can throw away.",
    note: "The commit is yours. An agent never commits for you.",
  },
  {
    id: "settle",
    label: "Settled",
    hand: "derived",
    kicker: "and it flows upward",
    artifact: "a plan that answers for itself",
    leaf: "settled=2026-10-27",
    body:
      "The claims get walked and marked, the reviewers co-sign, and the plan settles — the " +
      "modification stops because nothing is left to modify. Then the objective it was attached to " +
      "completes, and when every objective is complete the arc is too.",
    note: "Settled is never derived from quiet. A document nobody touched out of neglect would read as finished.",
  },
];

// ───────────────────────────────────────────────────────────────────────────────────────────────
// THE FOUR LEAVES — a document declares what it is on its first line, and from that moment the
// system knows it, tracks its state, and can point at it.
export const LEAVES = [
  {
    kind: "rfc",
    leaf: "::rfc{id=RFC-073 arc=ARC-004}",
    one: "a decision about how something will be built",
    hint: "`arc=` is the one relationship the registry holds — \"what is being built for this arc\" becomes a read, not a grep.",
  },
  {
    kind: "arc",
    leaf: "::arc{id=ARC-004 owner=systemview-test}",
    one: "a body of work, made of objectives",
    hint: "Its state is a summary of its plans, so it cannot lie about them.",
  },
  {
    kind: "gap",
    leaf: "::gap{id=G-12}",
    one: "a problem somebody found",
    hint: "Written INTO the other project's repo, where the fix lives — a message from outside, for that project's owner.",
  },
  {
    kind: "report",
    leaf: "::report{id=lifecycle-kinds as=planning}",
    one: "a view — planning, notice, audit, account, brief, spec",
    hint: "`as=` is an OPEN vocabulary: it only picks which fact may end the document, so it can grow by being used.",
  },
];

// ───────────────────────────────────────────────────────────────────────────────────────────────
// THE LIFECYCLES. Per station: the FACT it reads, what MOVES it there, and what a press can do —
// which is the whole lesson of this page. A station whose fact a press cannot honestly write says
// what is missing instead of sitting dead.
export const LIFECYCLES = [
  {
    kind: "rfc",
    title: "RFC",
    sub: "a decision about how something gets built",
    lede:
      "Five states, and written as conditions they are mutually exclusive — exactly one holds at a " +
      "time, so there is no precedence rule, no if-chain, no \"which wins\".",
    stations: [
      {
        id: "draft",
        reads: "no `verdict=` anywhere on its approval blocks",
        moves: "it starts here. What RETURNS it: a reviewer clearing their verdict",
        press: "Backward only — it clears every verdict. Your claim marks and co-signatures stay, because neither one defines draft.",
        pressable: true,
        means:
          "Every state above draft needs the verdicts present, so draft is their complement: you " +
          "never have to undo the states above — pulling the verdicts breaks all of them at once.",
      },
      {
        id: "approved",
        reads: "every `:::approval` carries `verdict=approved`, and the claims are not yet all met",
        moves: "a reviewer pressing the last approval",
        press: "Forward, nothing — a verdict is a signature, with a who and a when. Backward from built is a real GATE and it blocks: reaching approved needs the claims UN-met, and the marks are the agent's.",
        pressable: false,
        means:
          "The one state that is expensive to get back to. You must break built and settled while " +
          "KEEPING the verdicts, so the cheap move is unavailable.",
      },
      {
        id: "built",
        reads: "at least one claim, every claim met, and not every reviewer has co-signed",
        moves: "an agent marking the last claim",
        press: "Forward it marks every claim that is YOURS, then names the ones that are not — \"3 belong to another agent\". Backward costs only your own co-signatures.",
        pressable: true,
        means:
          "Built is landed AND still moving — reviewed, amended, proofs pressed. Forward can stop " +
          "short where backward cannot, because forward costs claims that may not be yours.",
      },
      {
        id: "settled",
        reads: "every claim co-signed by every reviewer, and no `retired=`",
        moves: "the last reviewer co-signing — always a human hand, because a human is always implicitly a reviewer",
        press: "Forward checks off all of YOUR reviews at once, and names who you are still waiting on. It never offers another reviewer's signature as a step.",
        pressable: true,
        means:
          "Not quiet — a roll call: the people who needed to look have looked. Which is how settled " +
          "derives AND cannot arrive without a human, at the same time.",
      },
      {
        id: "retired",
        reads: "`retired=` on the leaf, carrying a reason",
        moves: "a hand, with a reason. That is the only trigger there is — no timer moves state on any kind",
        press: "The reason menu IS the gate — picking the reason is the confirmation, and it says more than a yes ever did. Press again to remove it; rejoining a list costs nothing.",
        pressable: true,
        means:
          "The only station referencing no other artifact, which is why it holds from ANYWHERE — " +
          "`cancelled` has to be pressable from draft, because that is exactly what the word is for.",
      },
    ],
  },
  {
    kind: "arc",
    title: "ARC",
    sub: "a body of work, and its state derives upward",
    lede:
      "The kind with the most derivation and the least pressing: three of its five states cannot be " +
      "pressed at all, because the facts they read live in OTHER documents.",
    stations: [
      {
        id: "draft",
        reads: "no `verdict=` on any approval block",
        moves: "it starts here",
        press: "Backward clears the verdicts. Forward is a pointer — \"2 blocks await a verdict\" — that jumps to the first one.",
        pressable: true,
        means:
          "An arc nobody has approved is a proposal. It does not stop you building — it stops the " +
          "record from claiming the direction was agreed.",
      },
      {
        id: "approved",
        reads: "every approval approved, and at least one objective has no plan attached",
        moves: "the last reviewer pressing approve",
        press: "Nothing to press forward — a plan is a document somebody has to write. The step list IS the unplanned objectives, each one a jump into writing it.",
        pressable: false,
        means: "The decision is made and the subplans are not all written. This is where an arc sits for most of its life.",
      },
      {
        id: "inProgress",
        reads: "every objective has at least one plan, and at least one plan is not settled",
        moves: "the last unplanned objective getting its first plan",
        press: "No button, because none of the work is here — the panel lists what it is waiting on. Backward would mean detaching a plan, which nobody should press as a shortcut.",
        pressable: false,
        means: "In flight. Every objective has somewhere to put its work, and the plans usually belong to several agents.",
      },
      {
        id: "settled",
        reads: "every attached plan is settled, so every objective is complete",
        moves: "the last plan settling, in its own document",
        press: "Cannot be pressed at all, and the panel says why: an arc settles when its plans do. It names the last plan that closed.",
        pressable: false,
        means:
          "Derived upward and never pressed into place — the one station on this kind that nothing " +
          "can fake. An objective with no plan is INCOMPLETE, which is the floor that stops an empty " +
          "arc taking the whole trail for free.",
      },
      {
        id: "retired",
        reads:
          "`retired=` on the leaf, carrying a reason from the same closed list an RFC uses — because an arc is a living spec too, so the ways it leaves active service are the ways an RFC's are",
        moves: "a hand, with a reason. No timer",
        press: "Pick the reason, and it is the same list: `cancelled` and `superseded` are endings, `shelf` and `sideline` are pauses, `out of service` is the settled ending. It writes `supersededBy=` where the reason needs a pointer.",
        pressable: true,
        means: "Still open, and it is an honest open question: does retiring an arc retire the plans that serve it?",
      },
    ],
  },
  {
    kind: "gap",
    title: "GAP",
    sub: "a problem somebody found, and the trail forks at the end",
    lede:
      "Four states, and the only kind with TWO endings — so a surface drawing it has to show " +
      "`rejected` as a real destination rather than a failure to reach `resolved`.",
    stations: [
      {
        id: "open",
        reads: "no `resolved=` and no `rejected=` on the leaf",
        moves: "somebody filing it. It starts here",
        press: "Backward only, and it names the person: remove `resolved=` or `rejected=`, each with a line saying who closed it and when.",
        pressable: true,
        means: "Where every gap starts. One line of body is enough — it is a message from outside, filed where the fix lives.",
      },
      {
        id: "resolved",
        reads: "`resolved=` on the leaf AND a proof attached to it — a `::test` chip, a `:::run`, or a `:::cmd`",
        moves: "usually the owning project's agent writing it, not the author",
        press: "Pressing it with no proof does not refuse — it OFFERS one: point at the test that closed it, drop in a `:::run` that runs here, or a `:::cmd`.",
        pressable: true,
        means:
          "The one state in the whole system a press cannot outrun. `resolved=` on its own does not " +
          "reach it — something has to be re-runnable — which makes it the least arguable state on " +
          "any kind. And which proof is not a judgement call: **did closing it change the suite?** " +
          "then the test chip IS the proof, because plenty of gaps are fixed by editing a test. Did " +
          "it change something the suite cannot see — a service, the registry, the window? then a " +
          "run block, because nothing else can answer.",
      },
      {
        id: "rejected",
        fork: true,
        reads: "`rejected=` on the leaf, with a reason",
        moves: "a hand. Nothing derives a rejection",
        press: "The reason is the step, not a confirm. Backward clears it and lands back on open — reopening a declined gap is a real move.",
        pressable: true,
        means:
          "Declined on purpose. Without the reason it is indistinguishable from a gap nobody ever " +
          "looked at, which is the exact failure a gap exists to prevent.",
      },
      {
        id: "retired",
        reads: "`retired=` on the leaf, carrying a reason",
        moves: "a hand, with a reason. No timer",
        press: "Offered from `resolved` only — from open or rejected the honest answer is that there is nothing to retire from.",
        pressable: true,
        means:
          "A resolved gap carries a proof, so it has BECOME a living spec — something you re-run. " +
          "Retiring one says the spec stopped being worth re-running.",
      },
    ],
  },
  {
    kind: "report",
    title: "REPORT",
    sub: "a view — it is never done, it only gets old",
    lede:
      "Two states is the whole trail, and the subtype does not add a third. What `as=` changes is " +
      "WHICH FACT `retired` is allowed to read — so a planning report and a notice behave nothing " +
      "alike while sharing one parse and one control.",
    stations: [
      {
        id: "filed",
        reads: "the file exists, and has no `retired=`",
        moves: "an agent filing it. No report is ever pressed into being",
        press: "No forward step — existence is not a fact a press can write. Backward un-retires one.",
        pressable: false,
        means: "Existence is the only artifact in the whole system that no press can write, which is why `filed` is never pressed.",
      },
      {
        id: "retired",
        reads: "`retired=` on the leaf",
        moves: "a hand with a reason — OR the subtype's own clock, which only starts when you first OPEN the document",
        press: "One press, no confirm: a report is a view, and retiring one is reversible and loses nothing.",
        pressable: true,
        means:
          "The one kind where a clock may write the state, and it earns the exception by measuring " +
          "YOUR ATTENTION instead of wall time: while the document is unopened the clock does not " +
          "run at all, and surfacing \"this retires in 3 days\" comes with a press that diverts it.",
      },
    ],
  },
];

// WHY RETIREMENT IS A HAND AND NEVER A TIMER — the reason is not decoration on the state, it
// decides what the document DOES afterwards. Two lists behind one press.
export const REASONS = [
  { word: "cancelled", group: "ending", gloss: "we are not doing this. Legal from draft — that is its whole point" },
  { word: "superseded", group: "ending", gloss: "something replaced it, and it carries the pointer to what" },
  { word: "out of service", group: "ending", gloss: "the settled ending: it was built, it is done, it leaves the lists" },
  { word: "shelf", group: "pause", gloss: "parked. Still listed under its own heading, because you intend to come back" },
  { word: "sideline", group: "pause", gloss: "set aside for now. Coming back is the expected case, not a reversal" },
];

// THE SUBTYPE DECIDES WHAT DONE MEANS — five different answers to one question, which is what makes
// a dynamic leaf earn itself.
export const SUBTYPES = [
  { as: "planning", what: "a table to argue with — members, threads, replies", done: "its conclusions LEFT it: it became an RFC, an arc or a spec, and it carries the pointer to what it produced", clock: "none" },
  { as: "notice", what: "here is what happened, here is what I found", done: "you read it", clock: "the natural home for the read-triggered clock" },
  { as: "audit", what: "a count against a tree at one moment — \"67 RFCs, five with a verdict\"", done: "never. It is re-run or out of date, so it carries the command that regenerates it", clock: "none" },
  { as: "account", what: "what a job, a lane or a run actually did", done: "filed. Never edited, only superseded — amending a record is lying about history", clock: "none" },
  { as: "brief", what: "context handed to another agent", done: "the recipient acted — the one report whose state is per-member rather than per-document", clock: "none" },
  // The newest one, and the one with a different shape: the other four are READ, a spec is PRESSED.
  { as: "spec", what: "what something is supposed to do, with runnable evidence — prose plus `:::run` and `:::cmd` blocks you can press", done: "never. It is **current** or **drifted**, and the difference is pressable rather than asserted, because its proof runs", clock: "whatever `retain=` says — **not permanent by nature**; the subtype only picks a different default" },
];

// ───────────────────────────────────────────────────────────────────────────────────────────────
// EVENTS → HOOKS → JOBS → ACCOUNTS. The chain that turns a moment nobody was watching into a
// record somebody can read. Rendered as a chain you can send a pulse down.
export const CHAIN = [
  {
    id: "event",
    label: "an event",
    one: "the system announces a moment",
    body:
      "A compaction. A window filling up. A file changing. A permission request. Hooks fire from the " +
      "same emit() that feeds the session feed, so observability and hookability are one surface — a " +
      "new event source is hookable by being emitted, with nothing to wire.",
  },
  {
    id: "hook",
    label: "a hook",
    one: "watches for one, and points",
    body:
      "A markdown file with front matter — the event, a declarative match on its payload, and a rate " +
      "so a frequent moment cannot leak context forever. A hook holds no procedure, only a POINTER, " +
      "which is why it can never drift from the thing it points at. Writing one does not arm it: it " +
      "stays inert until an agent CARRIES it.",
  },
  {
    id: "skill",
    label: "a skill",
    one: "offered — the agent decides",
    body:
      "A procedure: an ordered list of steps followed to an outcome. Its name and description are " +
      "always loaded; the body loads only when it fires. A pointer at a skill arrives as context and " +
      "the agent chooses — and the pointer itself says to finish the human's work first.",
  },
  {
    id: "job",
    label: "a job",
    one: "given — with its inputs",
    body:
      "A written agreement: an aim, the inputs it declares, the procedure, where its output lands, " +
      "what it must never do, and what to do when it is unsure. It is never injected and carries no " +
      "trigger of its own. A hook that cannot supply every declared input is refused at the writing " +
      "door, rather than refusing silently on every match at 3am.",
  },
  {
    id: "account",
    label: "an account",
    one: "what it actually did",
    body:
      "The run files a report of its own — `as=account`, attached to what produced it. Never edited, " +
      "only superseded. That is what makes unattended work checkable instead of hopeful: the thing " +
      "that ran left a document behind, and it has an address.",
  },
];

// ───────────────────────────────────────────────────────────────────────────────────────────────
// CONTEXT — what an agent runs on. The layers differ in WHO PULLS THE TRIGGER, and a fact in the
// wrong layer is either paid for every turn forever or never found at all.
export const LAYERS = [
  { name: "presence", carries: "where it is, what the harness offers", when: "loaded every turn, every agent", cost: "attention", group: "loaded" },
  { name: "the system context", carries: "how any agent here acts — the store rules, the work norms, the room", when: "loaded every turn, every agent", cost: "attention", group: "loaded" },
  { name: "the agent doc", carries: "the ROLE: what this one agent is for, owns, and cares about — and its standing intent", when: "loaded every turn, this agent", cost: "attention", group: "loaded" },
  { name: "CLAUDE.md", carries: "that repo's operating rules — the commands, what needs a restart", when: "loaded when working in that repo", cost: "attention", group: "loaded" },
  { name: "skills", carries: "procedures — name and description always, the body when one fires", when: "on demand", cost: "a tool call", group: "retrieved" },
  { name: "the note store", carries: "info: fresh, cheap, written the moment something is learned", when: "when the agent asks", cost: "a search", group: "retrieved" },
  { name: "the corpora", carries: "crystallized knowledge — real documents, chunked by heading", when: "when the agent asks", cost: "a search", group: "retrieved" },
  { name: "hooks", carries: "a pointer at a procedure, at a moment the agent would not think to ask", when: "on the event, if carried", cost: "nothing until it fires", group: "pushed" },
];

// The closed pipeline — a note in the store about a documented topic is a bug report against the doc.
export const PIPELINE = [
  { step: "notes accumulate", body: "every lesson learned the hard way is written down the moment it is learned. The bar is \"would this help anyone this month\"." },
  { step: "curation nominates", body: "several notes circling one subject, or one note read constantly, becomes a single `doc-candidate:` note naming the ids and the demand. A pointer — zero knowledge moves here." },
  { step: "doc maintenance folds", body: "for each note, not \"where does this go\" but \"what should the doc have said, so this note never had to exist?\"" },
  { step: "the fold retires", body: "the absorbed notes are forgotten, and so is the nomination. The chunk answers now, and two copies drift." },
];

// ───────────────────────────────────────────────────────────────────────────────────────────────
// THE DOORS. They hand you the WORDS, because the words are the real door — this system is driven
// by telling an agent what you want. Each one copies to the clipboard; nothing here writes to a
// repo, and the page says so rather than shipping a button that silently does nothing.
export const DOORS = [
  {
    id: "project",
    label: "Bring in a project",
    kind: "command",
    say: "systemview init",
    hint: "Run it in the repo's folder. A repo with no services is one command away from a hosted testing service.",
  },
  {
    id: "arc",
    label: "Start an arc",
    kind: "say",
    say: "Here's the goal — plan it out. Research how this actually works first, then write me your opening proposal.",
    hint: "Opens the arc meeting as a document, researches the landscape, and writes a proposal for you to push back on.",
  },
  {
    id: "rfc",
    label: "Write a plan",
    kind: "say",
    say: "This design is settled — write it up as an RFC, with the claims list.",
    hint: "Implementation detail, slices in landing order, a verdict block, and claims you can check later.",
  },
  {
    id: "report",
    label: "File a report",
    kind: "say",
    say: "Write that up as a report and file it, as=notice.",
    hint: "Lands in the reports panel, registered and findable until it ages out.",
  },
  {
    id: "gap",
    label: "File a gap in another project",
    kind: "say",
    say: "That's a bug in the other repo — file a gap into it, where the fix lives.",
    hint: "A document written into THAT project's repo, done when its leaf says resolved= with a proof.",
  },
];
