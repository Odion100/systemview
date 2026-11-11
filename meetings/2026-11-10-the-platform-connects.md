::report{id="The platform connects" as=planning retain=permanent}

# The platform connects

::members{who=systemview-test}

This is where the first arc gets decided. Everything below is open until you cut it, and nothing
here is settled by me saying it. **Each thing we have to agree on has exactly one home in this
document** — that is what this file is for, so the discussion lands somewhere instead of scrolling
away.

**Where this file is:** `/Users/odionedwards/Systemly/systemview/meetings/2026-11-10-the-platform-connects.md`
— absolute, because what gets decided here reaches agents in other repos. This document is the
state; nothing summarising it is.

---

## Goals — your words

**The mission, which FRAMES this and is not this arc:**

> "create an automated workforce that works across any organization, business or household."

**The arc goal:**

> "make this platform be able to connect."

And the pieces, as you said them:

> "the Autobot browser needs to be able to have people log in… **as themselves**, and they need to
> be able to log in to **organizations**."

> "once you're logged into an organization, I can send my agent over to another instance of this
> application running on another computer and say, 'Hey, go get approval from this other colleague
> of mine and then you can go and pop up in their screen'."

> "which implies that these nodes can connect and it also implies that **files and data can be
> transferred** across them."

> "how updates are transferred so it becomes a **feedback system that continually improves because
> multiple nodes are improving**" — including "if **skills** and all these things get shared."

> "I literally want to be able to send an agent like you elsewhere, potentially by **sending a clone
> of yourself with instructions** or optionally **literally taking your whole current context and
> popping you up**."

> "And our **identity** is… for this platform. And **organization identity** and **organization
> connection**, you know, that's something we got to figure out too."

**Open by your own words, not decided:**

> "**ideally**, it will be a peer-to-peer connection." · "we need some sort of **central hub**, file
> transfer, or we can ideally do everything peer to peer. So you could literally just **drop this
> application anywhere, connect with other nodes in the system. Boom.**"

> One of your friends proposed **IRC** as a way to create this network. **WebRTC** is the other
> candidate you named.

> On SystemLynx: "I think SystemLynx is always going to be integral to what we do. It's the way to
> compartmentalize, solving one problem — client server communication. So if anything, we would
> consider and discuss and see where we land on if SystemLynx would **update and abstract** the way
> that problem falls so that we're **always dealing with the same surfaces regardless**."

> "**We gotta define what it really means, this goal.**"

**Who is on this:** you and me. Your ruling: *"they're not coming into the planning report. That's
not how things work. I got to work with you one-on-one, makes it easier. You're going to work with
the agents once things move forward."*

---

## 0 · What this goal really means — your own ask, and the first thing to settle

You said it last and it comes first, because every section below inherits it.

**My opening attempt at the definition.** "The platform can connect" is true when **two installs
of this application, on two machines owned by two different people, can establish identity with
each other and move three things across: an agent, a file, and an improvement.** Agent, data,
update — those are the three you named, and they are three different problems wearing one goal.

**The three-strangers statement** (what somebody with no context should be able to describe, and be
right about):

> A person installs Autobot on their own machine and signs in as themselves. They join an
> organization that another person's machine also belongs to. From then on, either person can send
> an agent to the other's node, where it needs that person's approval before it can act; it appears
> in their window while it works; and when it is finished, what it did comes home. Files move between
> the two nodes on purpose, and an improvement made on one node can reach the other.

**What that definition DOES NOT say, deliberately** — and each is a live question below: whether the
visitor runs on your hardware or theirs; whether there is anything in the middle; what an
organization *is*; and whether updates are in this arc at all or the one after.

**DECIDE HERE:**
1. Is that definition what you mean, or is it narrower/wider than the goal?
2. Are all three — agent, data, update — inside the FIRST arc, or is the first arc "two nodes can
   identify each other and one agent can cross with approval", with data-at-scale and the update
   feedback loop as arc two? My position: the second, and §5 argues it.

::::thread{id=definition members=systemview-test}
For telling the room when the definition of the goal itself moves. Nothing else goes in here.
::::

---

## 1 · Identity — "people log in as themselves", and "log in to organizations"

**Where the project is — READ.** **Nothing in this system has ever had a user, and it is worse than
that: it has no concept of a MACHINE either.** A grep for `os.hostname`, `machineId` or `HOSTNAME`
across `api/`, `cli/`, `src/` and `electron/` returns **exactly two lines**, both in the terminal
verbs (`api/index.js:1976` and `:2023`), where the hub stamps `$HOSTNAME` into a command so the
answer can say which box replied. That is the only place in either repo where machine identity is
captured at all.

What it has instead is two things, both local by construction:

- **A project code**, bound to a directory in `~/.autobot/projects.json` — a flat `{code:
  absoluteDir}` map written only by the shell (`electron/apps/files-host.cjs:46-57`, `:65-96`),
  read by the hub read-only (`api/shellProjects.js:23-48`). "A code means ONE folder" is enforced
  **only against the local map** (`files-host.cjs:50-54`), so two machines binding the same code to
  different directories is a state nothing notices.
- **A session**, which lives in the Electron main process's memory (`electron/agents/sessions.cjs:62`,
  a plain `Map`) and is persisted to `~/.autobot/sessions.json` keyed `projectCode:sessionId`
  (`:87-106`).

**And the cross-machine case is already leaking in, by accident.** The live `projects.json` on this
Mac contains `"bu1": "/root/buAPI"` — a Linux droplet's path. The code knows: `api/shellProjects.js:43-44`
and `api/index.js:800-802` name the foreign-machine case as the reason every shell row is filtered
through `fsGit.existsSync` (`api/index.js:831`) before it reaches the root map. So a code naming a
project that is not on this disk does not refuse — **it silently vanishes from the map**, and the
shell's own `rootOf` throws `unknown project` (`files-host.cjs:25-29`).

**One finding that constrains §2 hard:** the window reaches sessions **only** through the Electron
IPC bridge — `window.systemview.agent.sessions()` → `src/utils/hostAgents.js:122-129` →
`ipcRenderer.invoke("agent:list")` (`electron/apps/svPreload.cjs:127`). Every door degrades to
`[]`/`null` when the bridge is absent (`hostAgents.js:8`, `:123-128`). **So a window served over the
network to an ordinary browser has no agent surface at all.** Whatever "pop up in their screen"
becomes, it is not a remote browser pointed at somebody's hub.

Agent definitions live at `~/.autobot/agents` (`electron/agents/definitions.cjs:28`) — files on
this disk, addressable by nothing but a local path.

**How it might work — my opening proposal, blunt enough to cut.**

**Identity is a keypair the install generates, and the person is the holder.** Not an account on a
server we run. On first launch the node mints a keypair; the public half IS the identity; a
human-readable handle is a label on top of it, never the identity itself. Everything downstream —
"as themselves", organization membership, a visiting agent's right to act — becomes a signature
check rather than a lookup against something central.

**Why I'd start there:** it is the only shape that satisfies *"drop this application anywhere,
connect with other nodes. Boom."* An account system means a server we must run, pay for, and keep
up — and the moment it is down, nobody is themselves. A keypair means the node is self-sufficient
and a directory becomes a convenience, not a dependency.

**What it costs, said honestly:** key loss is identity loss unless we design recovery, and
recovery is where self-sovereign identity gets genuinely hard. A person with two machines is two
keys unless we solve device linking. Both are real work and both are arc-sized on their own.

**An organization, in this proposal, is a document with members and a signer** — not a row in a
database. It has its own keypair; membership is a signed statement by the org's key naming a
person's key; a node proves it is in the org by holding that statement. That makes an org
transferable, offline-verifiable, and auditable — and it means **the org is a thing, not a service**.

**Three identities, not one, and this is the part I think is easy to get wrong:** the **person**,
the **node** (an install on a machine — a person may hold several), and the **agent** (a session
with a definition). When my agent appears on your screen, your window should be able to say all
three: *Odion's* agent, from *Odion's studio machine*, acting as *systemview-test*.

**DECIDE HERE:**
1. **Keypair-per-install, or accounts on something central?** This is the first fork and everything
   below hangs on it.
2. Is an organization a **set of people**, a **set of nodes**, or a **set of agents**? Who can add a
   member, and who can revoke one — and does a revocation have to reach a node to take effect?
3. **Does an agent have an identity of its own**, separate from the person who owns it? When my
   agent asks your colleague for approval, who is asking — me, or it?
4. One person, two machines: **one identity or two?**
5. Is there a **human-readable directory** at all (find a colleague by name), or do you exchange
   addresses out of band the first time, like an invite?

::::thread{id=identity members=systemview-test}
For telling the room when the identity section moves. Nothing else goes in here.
::::

---

## 2 · Sending an agent — "go get approval, then pop up in their screen"

This is the heart of the arc, and it contains the single biggest unanswered question in it.

**Where the project is — READ.** A session is created and driven over Electron IPC: the verb list
is `agent:open/send/permission/interrupt/kill/...` (`electron/preload.cjs:41-64`,
`electron/apps/svPreload.cjs:124-160`) and each session's events arrive on an IPC channel
`agent:event:${key}` (`preload.cjs:45-49`). **There is no network path to any of it** — see §1, the
bridge is the only door and it exists only inside the shell on the same machine.

**The state the strip reads is a DOM event, not a transport.** `sv:agentState` is a
`window.dispatchEvent(new CustomEvent(...))` fired by each chat (`src/organisms/AgentChat/AgentChat.js:2531-2535`)
and heard by the tab strip (`src/organisms/SystemNavigator/SystemNavigator.js:148-149`) — same
document only, crossing no process, let alone a machine. The whole `sv:*` family is like this. Plus
an 8-second poll of the live set (`SystemNavigator.js:100-108`). **So "it appears in their window
while it works" has no existing mechanism at either end** — not the session, not the state.

**What an agent is made of, and how portable each part is.** The context store is better news than I
expected: notes are plain `.md` files with frontmatter under `~/.autobot/context`
(`electron/agents/context.cjs:52`, `:82-106`), a note's identity is `(scope, slug)` (`:78-79`), and
the embeddings are **declared derived and rebuildable** (`electron/apps/vectors.cjs:14-18`, `:40-46`).
So the notes themselves travel. What does not travel is the **scope vocabulary** — `project:<code>`
and `agent:<slot>` only mean anything against this machine's project map and `~/.autobot/agents`.
A clone that arrives carrying notes scoped to a project the host does not have is carrying notes
addressed to nowhere, and that is a real design constraint on the clone format rather than a detail.

**THE QUESTION EVERYTHING ELSE DEPENDS ON: where does the visitor RUN?**

| | **Visitor runs on the HOST's machine** | **Visitor runs on MINE, reaching into theirs** |
|---|---|---|
| compute + model cost | the host pays | the sender pays |
| what it can touch | the host's disk directly — real power, real danger | only what the host's node exposes over the wire |
| "pops up in their screen" | literal: it is a session on their node | a remote session rendered in their window |
| trust required | **high** — you are running my agent's instructions on your hardware | **low** — their node is a server with an API |
| what the approval gates | whether the session is allowed to exist at all | every call it makes |

**My position:** the visitor is a **real session on the host's node**, created by the host's shell,
with the sender's instructions as its brief — and *not* a remote-controlled puppet. "Pop up in their
screen" is literal in your words, and a session that exists on their node is the only version where
their window, their worklist, their nudges and their records all see it the way they see every other
session. The remote-puppet version keeps the agent under my control and makes it a stranger to every
surface on their machine, which is the opposite of the system we have.

**What follows if that is right, and it is a lot:** the host's node must be able to **construct an
agent from a definition it did not write** — and that makes an agent's definition a **portable
artifact**, which today it absolutely is not. That is probably the first real objective in this arc.

**Clone vs whole context — the two forms you named, and they are not the same mechanism.**

- **A clone with instructions** = a definition + a brief. Portable, inspectable, re-runnable, and
  the host can read what it is agreeing to before it arrives. This is the one I would build first.
- **Your whole current context, popped up elsewhere** = a live session's transcript and tool state
  moved mid-thought. Much harder and worth being precise about: the conversation can move, but the
  *handles* cannot — open files, a running build, this repo's tree, a port it was talking to. So
  honestly: a context transfer is a **reconstruction** that reads as continuity, and the question is
  how much continuity is enough for you to feel like it was me and not a copy that read a summary.
  **This is also exactly the compaction problem, one machine further out** — which means what we
  already know about surviving a summary is the design input for it.

**The approval, which you named specifically** — *"go get approval from this other colleague of mine
and then you can go and pop up in their screen."* Note the ORDER in your sentence: approval first,
appearing second. So an arriving agent has a state before it is approved — a request standing at the
door, visible, pressable, refusable. That is a surface in the window, and it is the one piece of this
section I think is unambiguous.

**DECIDE HERE:**
1. **Host's machine or sender's machine?** Everything in this section changes with it.
2. What is the approval a gate on: **arriving**, **reading**, **writing**, **committing**, or each
   separately? My position: arriving is one press; writing to disk and committing are separate and
   should stay separate.
3. **Does the approval expire?** Is it per-visit, per-day, or standing for a colleague you trust?
4. What does a visitor SEE of the host node — the repos? the window? the context store? the other
   sessions? My position: nothing by default, and the visit names what it needs.
5. **THE RETURN.** When the visit ends, what comes home, and in what form — a report, a commit, a
   run record, or the agent itself with its context? (Your own three-week-old card asked this:
   *"clone yourself to another instance — and how the return comes home."*)
6. What does the host KEEP as the record of what a visitor did — and can the visitor's run be left
   died-in-place on their node, the way every other run is?

::::thread{id=visiting members=systemview-test}
For telling the room when the visiting-agent section moves. Nothing else goes in here.
::::

---

## 3 · Files and data crossing

**Where the project is — READ, and it is worse than "a row might not mean anything".**

A registry row's identity **is its `id` alone** — no machine field exists, and the allowed fields are
fixed at `electron/markdown/registry.cjs:37`. The comment at `:82-108` is explicit: *"THE ID IS THE
IDENTITY: a document that moved updates its row's `path`; it is never a second row."* And `path` is
project-relative when the file sits inside a known root, **a bare absolute path otherwise**
(`registry.cjs:69-78`).

**So two nodes sharing a registry would eat each other's documents.** The hub only stats
project-relative rows (`api/documentsRegistry.js:58-67`); a stat failure sets `row.missing = true`
(`:68`), and the janitor reaps on exactly that basis (`api/janitor.js:39`, `api/index.js:877-878`
`sweepDeadPointers`). A machine-B hub reading a machine-A registry would mark A's rows missing and
**sweep them**. That is not a compatibility wrinkle, it is a destructive one, and it is the single
most important constraint on §3.

Everything else is path-keyed the same way: reports at `.systemview/report.<pc>.<slug>.md` plus a
whole-file index (`api/reports.js:20-21`, `:198-215`); boards as markdown in the repo where **a card
has no id beyond its position in the file** (`api/board.js:7-8`, `:55+`); code comments as sidecars
keyed by project-relative path (`api/codeComments.js:11,19`); corpora rows carrying absolute roots
(`~/.autobot/corpora.json`, read at `electron/agents/docs.cjs:17`). **A lane is not a record of a
branch — it IS a local git branch plus a local worktree** (`api/index.js:1819-1823`, `:1841-1846`).

**And the shared-state pattern is read-modify-write-whole-file, nearly everywhere.** `projects.json`,
`sessions.json`, `documents.json`, `documents-opened.json`, `terminal-grants.json`,
`api/connections.json`, `api/comments.json`, the reports index, every board. Two of them have
already been bitten and say so in their own source: `documents.json` has **two writers** — the shell
and the hub — acknowledged at `api/documentsRegistry.js:72-79` as interleaving "on different
documents in practice"; and `electron/apps/vectors.cjs:194-205` records that a full-replace
`index()` clobbered other writers, which is why `replaceWhere` exists at `:206-222`.

**Why that matters for this section and not just hygiene:** every one of those is a lost-update race
that is *currently* bounded by all writers sharing one disk. A second node removes that bound. So
"files and data can be transferred" cannot be built on top of these files as they stand — the unit
that crosses has to be something with an identity that survives the trip, which is the first
question below.

**How it might work.** Two different problems are hiding in "files and data", and I would not solve
them with one mechanism:

1. **A transfer** — one file, one document, one archive, moved on purpose, with a sender and a
   receiver and an end. Cheap to build, cheap to reason about.
2. **A shared thing** — a document two nodes both have, that has to stay one definition rather than
   becoming two copies quietly drifting. This is the expensive one, and it is the same rule we
   already live by on one machine, now with no shared disk to enforce it.

**My proposal: build (1) now and name (2) as its own objective.** A transfer is a solved shape. For
(2), the honest answer is that **git already does this** — it is content-addressed, it merges, it
survives being offline, and both nodes already have it. A "shared document" between nodes may be a
branch and a remote, not a new sync protocol. That deserves to be argued rather than assumed, which
is why it is a question and not a decision.

**DECIDE HERE:**
1. What is the UNIT that crosses — a **file**, a **document** (leaf and identity), a **repo**, or a
   **stream**?
2. **Push or pull** — does the sender put it there, or does the receiver fetch it? (Pull is safer;
   push is what "send my agent over with this" feels like.)
3. Is anything **kept in sync**, or is every transfer one-shot? If kept in sync: is it git, or
   something else, and why not git?
4. Does a document that crosses keep its **identity** (its leaf, its id, its history) or arrive as a
   new document on the other side?

::::thread{id=transfer members=systemview-test}
For telling the room when the transfer section moves. Nothing else goes in here.
::::

---

## 4 · Updates — "a feedback system that continually improves because multiple nodes are improving"

This is the one you said the least about and I think it is the most dangerous, so I am going to be
blunt about why.

**"An update" is at least six different things, and they do not share a blast radius:**

| what | if a bad one lands | who should be allowed to send it |
|---|---|---|
| application code | the node is broken | us |
| an agent definition | an agent behaves differently, quietly | the node's owner |
| a skill | **arbitrary instructions run on their machine** | ? |
| a job | the same, **unattended** | ? |
| context notes / corpora | an agent believes something false, confidently | ? |
| hooks | behaviour fires at moments nobody chose | ? |

**The ones with a `?` are the arc.** A skill is a procedure an agent follows. A job is one that
runs unattended. Accepting either from another node is **running another person's instructions on
your machine** — and the system's own rule is that a loaded layer costs attention, so an unbounded
inbound stream of skills is a context-hygiene failure as much as a security one.

**My proposal.** An improvement is **offered, never pushed**, and it arrives as a **document you can
read before it is live** — signed by the node that made it, listed in a surface, adopted by a press.
Nothing from another node is ever armed by arriving. And the unit is a **diff against a named
version**, not a whole file, because whole-file replacement is how one definition silently becomes
two.

**The part I cannot answer and will not pretend to: divergence.** Two nodes improve the same skill
differently and both are right about their own situation. Last-write-wins destroys one of them; a
merge needs a mechanism; ownership ("this skill belongs to that node") solves it by giving up the
feedback loop you actually asked for. I do not have a position I would defend here yet, and that is
the finding.

**DECIDE HERE:**
1. **Is this in the first arc at all?** My position: no — it is arc two, and the first arc stops at
   two nodes identifying each other and one agent crossing. Reason in §5.
2. Which of the six kinds above may cross between nodes, and which never may?
3. **Offered-and-pressed, or automatic?** Does a trusted colleague's skill install itself?
4. When two nodes improve the same thing differently, what resolves it — **git's merge**, a
   **vote**, **ownership**, or a **human**?
5. Is there a notion of a node being **more authoritative** than another (yours, as the origin), or
   are all nodes peers in this too?

::::thread{id=updates members=systemview-test}
For telling the room when the updates section moves. Nothing else goes in here.
::::

---

## 5 · The transport — peer-to-peer, a hub, IRC, WebRTC

**Where the project is — READ.** Three things in this repo assume there is one hub and it is on
this machine, and each would mis-aim rather than refuse:

- **The window's hub address is a hardcoded literal** — `src/index.js:32` is
  `"http://localhost:3000/systemview/api"`, not derived from `window.location.origin`. A window
  served from any other host calls back to **the viewer's own** localhost:3000.
- **The MCP's and the CLI's are fixed the same way** (`electron/agents/systemview.cjs:16`,
  `cli/index.js:35,67,183`).
- **Hosting is gated purely on "is the port free"** (`cli/launchApp.js:14-22,33-49`), so a *remote*
  hub answering on 3000 would be adopted as **the** hub, and a second node would see something
  already serving and decline to host.

Two hard couplings worth knowing before anything is designed: the hub reaches into the shell by
absolute path to write lane status (`api/index.js:1614`, `:1656` require
`~/autobot/electron/agents/worklist.cjs`), and `api/index.js:2844` hardcodes a
`darwin-arm64` binary path under `~/autobot`. A node is not portable to another OS today, let alone
another person.

**And one piece of the transport question is already answered, which lands here:** **SystemLynx already has a discovery service, and it is already
discovery-only by design** — §6.3 has the addresses. A node joins by registering with it, it holds a
member list with heartbeats, and RFC 006 explicitly refuses it as a data-path proxy so clients talk
directly to each other. That is the "something small in the middle" shape below, already built — the
question is whether an organization's rendezvous should inherit a load-balancer's shape.

**The thing I most want to say in this section: "peer-to-peer" is not one decision, it is five.**
They come apart, and conflating them is how this argument goes in circles:

| the problem | can it be pure p2p? |
|---|---|
| **discovery** — how does my node learn your node exists | realistically **no** without something known-in-common (a directory, an invite, a LAN broadcast) |
| **signalling** — how do two nodes behind home routers find a path | **no** — this is what a signalling server is for, and it is tiny |
| **identity** — proving you are you | **yes**, if identity is a keypair (§1) |
| **bulk transfer** — files, context, an agent's payload | **yes** — WebRTC data channels, direct once connected |
| **presence** — who is online, who is working | either; cheap over a relay, awkward pure p2p |

**So the honest form of your "ideally peer-to-peer" is: p2p for everything that carries your
content, and something small and stateless in the middle only to introduce two nodes.** That still
satisfies *"drop this application anywhere, connect with other nodes. Boom"* — because the thing in
the middle holds no data, can be run by anybody including you, and a node that already knows a peer's
address does not need it at all.

**On IRC, your friend's suggestion.** What it genuinely gives: a **federated** server model nobody
owns, presence and channels for free, decades of clients, and trivially self-hostable. What it does
not give: identity worth anything (a nickname is not a key), and no bulk transfer (DCC exists and is
a relic). So IRC is a candidate for **the introduction layer**, not for carrying agents or files —
and if we take it, we take it for rendezvous and sign everything ourselves on top.

**On WebRTC.** It is the right answer for the data channel: NAT traversal, encryption, direct
peer-to-peer bulk. It still needs signalling (see above) and a TURN relay for the minority of
networks where hole-punching fails — which means "pure p2p with nothing in the middle" is not
achievable in the real world, and pretending otherwise would cost us a redesign later.

**DECIDE HERE:**
1. Do you accept **something small in the middle for introductions only**, holding no data — or is
   "nothing in the middle, ever" a hard requirement I should design against?
2. **IRC as the rendezvous layer: yes, no, or evaluate?**
3. Is the first connection an **invite** (you paste an address once) — which needs no infrastructure
   at all and would let the first arc ship without a directory?
4. **Offline:** your colleague's machine is asleep when I send my agent. Does the visit **queue**,
   **fail**, or **wait**? (If it queues, something in the middle has to hold it — which is question
   1 again, with teeth.)

::::thread{id=transport members=systemview-test}
For telling the room when the transport section moves. Nothing else goes in here.
::::

---

## 6 · SystemLynx — does it abstract the transport so the surfaces never change?

Your words: *"we would consider and discuss and see where we land on if SystemLynx would update and
abstract the way that problem falls so that we're always dealing with the same surfaces
regardless."*

**Where the project is — READ, not assumed.** Source at `/Users/odionedwards/Systemly/SystemLynx`
(v3.6.2, HEAD `7d82e5a`); the copies vendored into systemview and autobot are byte-identical in the
files that matter, so these addresses hold for both.

**1 · It is already on the wire. What is broken is the ADDRESS IT HANDS OUT.** This is the finding,
and it is not what I expected:

- The bind is **not** localhost-bound. `ServerManager.js:116` is `httpServer.listen(port, …)` with
  **no host argument**, so Node binds every interface. A service running on your machine is reachable
  from another machine on the network **today**.
- But the host it *advertises* is hard-coded to `localhost` — `ServerManager.js:17` and `:57` — and
  that string is baked into the catalog document the client reads: `ServerManager.js:63` for
  `serviceUrl`, `:89` and `:299` for the websocket namespaces.
- `loadService` fetches that document and uses it **verbatim** (`loadConnectionData.js:1-29`), and
  the client builds every subsequent call from the document's `host`/`port`
  (`ServiceRequestHandler.js:60-69`). **Nothing anywhere rewrites that host against the URL the
  client actually dialed.**

**So the cross-machine failure mode is the worst shape available:** a client on machine B points at
`http://A:6100/autobot/api`, the manifest fetch **succeeds**, and then every method call and every
event goes to `http://localhost:6100/…` — *back at itself*. Not a refusal, not a timeout. It works
and it is talking to the wrong machine. That is the single most important fact in this section.

`host` is a documented caller-settable option (`docs/API.md:110`), so the *mechanism* to fix one
service exists — but every local caller omits it (e.g. `autobot/systemview/service.js:12` passes only
`{ route, port }`), and the framework has no way to resolve its own routable address: no
`os.networkInterfaces()`, no `0.0.0.0` handling, no env-var convention. Confirmed absent by grep.

**2 · There is NO authentication of any kind, and that is confirmed rather than merely unobserved.**
A grep for `authoriz|authenticat|token|secret|signature|jwt|api_key` across the non-test source
returns nothing in the request path. CORS is `origin: "*"` unconditionally for the socket
(`ServerManager.js:71-74`) and for HTTP whenever the framework owns the express app
(`Server.js:48-57`). Headers are *carried* (`HeaderSetter.js:1-9`, merged at
`ServiceRequestHandler.js:75`) and never checked — auth is expected to be app middleware
(`docs/API.md:163-180`).

And the socket **cannot carry auth at all**: `SocketDispatcher.js:23` takes only namespace and path —
no `extraHeaders`, no `auth`, no options seam. Already filed as
`gaps/SOCKET_HANDSHAKE_CANNOT_CARRY_AUTH_OR_REPORT_FAILURE.md`, whose second half matters here too:
`connect_error` is in the reserved list (`SocketDispatcher.js:5`) and never re-emitted, so **a
rejected handshake is indistinguishable from an idle server.** Combined with (1), that is two
different silent-wrong-answer paths on the one wire we would be building the arc on.

**3 · A discovery service already exists, and it is already shaped the way peer-to-peer wants.** The
**LoadBalancer** is an ordinary SystemLynx service with one `Tentacle` module
(`LoadBalancer/LoadBalancer.js:12-16`). A node joins by `App.use(LoadBalancer.clone({ url,
serviceId }))` (`clone.js:21-29`, registering at `:94-104`); the registry is in-memory, keyed by
`serviceId` with a member list (`Tentacle.js:21-22`), rebuilt by re-registration; heartbeats every
10s with stale eviction (`clone.js:116-124`, `Tentacle.js:78-85`).

**And RFC 006 §141 explicitly refuses it as a data-path proxy** — *"It stays discovery-only — the
client talks directly to each module's location."* That is exactly the split §5 argues for: a small
thing in the middle that introduces two nodes and then gets out of the way. It even already carries
`delegate` (at-most-once), `broadcast`, and a lease-based `elect`/`resign`
(`Tentacle.js:248-287`) — coordination primitives an organization of nodes would otherwise need
inventing.

**The catch, and it is the same bug as (1):** a clone registers its own `serviceUrl`
(`Tentacle.js:198`), which is the `localhost` one — so **a cross-machine cluster registers unusable
addresses by default.** The LoadBalancer is also the one place in the framework that derives an
address from the network, off `req.headers.host` (`Tentacle.js:35-38`) — and the framework's own
`loopbackOrigin.js:8-14` records why that is unsafe ("SSRF with credential forwarding") and uses
`socket.localAddress` instead, *because those are properties of the TCP connection and cannot be
forged*. The right answer is already written down in the codebase; it just is not applied here.

**4 · The root is architectural, not an oversight.** `RFCs/003-loadbalancer-cluster-rewrite.md:26`
and `:51` record a deliberate move **away** from explicit host declaration — `register` used to take
`{host, port, route}` separately and it was removed as "obsolete now that a URL's connectionData is
self-describing", with "everything is derived from the URL". The framework chose to trust a
service's self-report. The self-report defaults to `localhost`. Those two decisions are individually
reasonable and together are the bug.

**5 · There is no refusal on record, and no attempt either.** Git log across all branches for
remote/peer/proxy/tunnel/gateway/federation/cluster turns up only the LoadBalancer work. Meanwhile
`docs/SCALING.md:73-89` describes a multi-machine, multi-region deployment as the *design intent* —
it simply assumes the address problem away. So the remote case is **unarticulated, not rejected**,
which means nothing here is overturning a past decision.

**6 · What already works that we would otherwise have built.** A persistent socket.io channel per
service and per module (`SocketDispatcher.js:23`, `SocketEmitter.js:8`), with subscriptions
ref-counted and **replayed on reconnect** (`:63-86`). Self-healing: `Client.js:280` reconnects on
drop, `rebuild()` (`:195-223`) re-fetches the catalog and re-points every module, and
`ServiceRequestHandler.js:108-123` retries a non-SystemLynx error up to four times. Responses carry
`SystemLynxService: true` (`Router.js:139`) so a client can tell a stranger on the port from a real
answer. **One real limit:** server→client is *broadcast events only* — there is no server-initiated
call with a return value, which matters for anything where a host node needs to ask a visiting
agent's home node a question.

**How it might work — my proposal, now written against the above rather than from memory.**

You are right that SystemLynx should be the abstraction, and the reading makes the case stronger than
I could have argued this morning: the framework is **one address and one identity away** from being
the node-to-node layer. It already binds the world, already discovers, already reconnects, already
refuses a stranger on the port. What it does not have is:

1. **An honest address.** Either the client rewrites the catalog's `host` from the URL it actually
   dialed (small, surgical, fixes every existing caller at once), or a service resolves its own
   routable host. **I would do the client-side rewrite first** — it turns today's silent wrong-machine
   call into a working one with no caller changes, and it is the kind of fix that should land as its
   own gap in SystemLynx regardless of this arc.
2. **Identity on the call.** Nothing today says who is calling. This is the largest change to the
   framework in the arc, and it belongs *in* the framework — a convention every caller
   re-implements is the hand-rolled-`fetch` failure again.
3. **A socket that can carry a handshake** — the filed gap, which becomes load-bearing the moment a
   connection is gated, along with surfacing `connect_error` so a refusal stops reading as silence.
4. **An address that is not a URL.** `http://127.0.0.1:<port>` cannot name a service on a laptop
   behind a router; a node-plus-service address has to resolve to a route.
5. **A refusal that reads honestly** — "that node is asleep", "you are not in that organization",
   "that service is not published to you" are three different sentences, the same way the whitelist's
   three refusals had to be three sentences.

**DECIDE HERE:**
1. Does SystemLynx become the transport abstraction, or do we build node-to-node beside it and keep
   SystemLynx for in-machine work? (My position, strengthened by the reading: it becomes it.)
2. If it does: is remote a **new transport under the same client surface**, or a **gateway service**
   that forwards? (My position: a transport under the same surface — a gateway is a second copy of
   the routing problem.)
3. Does **identity on the call** go into SystemLynx itself, or ride above it? (My position: into it —
   a convention every caller re-implements is the hand-rolled-fetch failure again.)
4. **The advertised-host bug is a live defect, not arc work** — it makes any cross-machine call
   silently hit the wrong machine. Do I file it as a gap in SystemLynx now and fix it ahead of the
   arc, or hold it inside the arc?
5. **Does the LoadBalancer become the introduction layer** for §5 — it is already discovery-only by
   RFC 006 and already carries `delegate`/`broadcast`/`elect` — or is an organization's rendezvous a
   different thing that should not inherit a load-balancer's shape?

::::thread{id=systemlynx members=systemview-test}
For telling the room when the SystemLynx section moves. Nothing else goes in here.
::::

---

## 7 · The hub's own door — and two decisions already on the record

**DECIDED, 2026-11-10, your words:** *"let's run with the whole local network being
unauthenticated."*

Read as architecture rather than as a shrug, that is a real decision and it aims the whole arc:
**network position is not a trust boundary.** A caller is trusted because it proved who it is, not
because of where its packet came from. So the arc designs for an untrusted LAN instead of trying to
restore a safe interior — no "it came from inside the network so it's fine", anywhere, ever. That
is the assumption every corporate network is soft because of, and we are not making it.

**DECIDED, same conversation:** this does not become its own RFC off to the side — **it fits in this
arc.** Which is right, and the reason is §6.2: the arc has to put identity on a service call
anyway. Gating the hub's own door is not a detour from the arc, it is the arc's first objective
wearing work clothes.

**The measured state of that door today**, filed in full with the commands at
`gaps/THE_HUB_ANSWERS_THE_WHOLE_NETWORK_WITH_NO_AUTH.md` (G-16): the hub binds every interface
(`ServerManager.js:116` listens with no address; `api/index.js:225`'s `host = "localhost"` only
builds the advertised URL), CORS is `*`, nothing checks a caller, and around ninety methods are
behind it including `readPath`/`writePath`, the git verbs, and the terminal typing verbs. Called
over this machine's LAN address with no credential, `readPath` returned `/etc/hosts` and
`writePath` landed a file on disk.

**So the ORDER is the finding, and it is the one thing I want this section to fix in advance:** the
hub is already reachable and is not yet able to say who is calling. That is backwards, and the arc
is what rights it — **the lock gets fitted before the door is widened on purpose**, not after.
Every later section assumes a call can carry an identity; this is where that becomes true.

**THE HALF THIS DECISION DOES NOT COVER, and it has to be said plainly.** The untrusted-LAN position
is about *other machines*. It does nothing about the browser, and the browser is the bigger half:

- The preflight passes with `Access-Control-Allow-Origin: *` (`Server.js:48-57`), and the hub accepts
  `content-type: text/plain`, which makes a POST a **CORS-simple request** — so **no preflight is
  needed at all**.
- Therefore any page open in any browser on the machine can POST to the hub. Reads come back
  because CORS is `*`; a **write needs no CORS cooperation whatsoever.**
- **A loopback bind does not fix this**, because the browser is already on localhost. "It only
  listens locally" is the exact false comfort here.

This one is a same-machine problem, it is open today, and no node has to exist for it to be open.
It is the one piece of G-16 that is not arc-shaped.

**DECIDE HERE:**
1. **Does the hub's door become an objective in this arc, and is it FIRST?** My position: yes and
   yes — every other piece of the arc calls through it, so it is the objective the others need
   done.
2. **The browser half** — close it ahead of the arc with an `Origin` allow-list on the hub, or carry
   it inside the arc? My position: ahead of it. It is small, it is independent of every open
   question above, and it is the only item in G-16 that is live without a second node existing.
3. Does the gate live **in SystemLynx** (so every service on every node inherits it, §6.3) or **in
   the hub** (so it ships without touching the framework)? My position: the framework — a check
   every service re-implements is the hand-rolled-`fetch` failure in a worse place.

::::thread{id=hub-door members=systemview-test}
For telling the room when the hub-door section moves. Nothing else goes in here.
::::

---

## 8 · What I think the first arc is — the shape, for you to cut

Stated so you have something concrete to disagree with. My position in one sentence: **the first arc
ends when one agent can cross to another person's node with approval and come home, and nothing
more.**

In:
- **the hub's own door gated on identity** (§7) — decided today, and first, because the rest calls
  through it
- identity as a keypair, and an organization as a signed membership
- an invite-based first connection (no directory, no infrastructure)
- an agent definition that is a portable artifact
- the arriving-agent approval surface, and the visitor as a real session on the host's node
- the return — what comes home and how it is recorded
- one file transfer, because a visit is useless if nothing can go with it

Out, and named rather than forgotten:
- the update/feedback loop (§4) — it needs the trust model the first arc builds
- whole-context transfer (§2) — the clone form proves the path first
- a directory, a recovery story for lost keys, device linking
- anything kept continuously in sync

**Why that line:** every item in "out" depends on a trust model that does not exist yet, and the
first arc is what creates it. Building the feedback loop before two nodes can prove who they are is
building the dangerous half first.

**DECIDE HERE:**
1. Is that the right line, or is it too small?
2. Is anything in "out" actually load-bearing for you — something whose absence makes the first arc
   pointless?

::::thread{id=scope members=systemview-test}
For telling the room when the arc's scope moves. Nothing else goes in here.
::::

---

## Objectives, as they become definitive

Nothing here yet, and that is correct — an objective is written at the moment a piece becomes
definitive, never planned in advance. Each one will arrive as an `::objective` block carrying what
it is, who owns it, how anyone else can tell it is done, and what it is for.

## Arcs

Empty until one is written. The arc is written FROM the objectives above, in the repo that will
build it, with a chip back to this document.

## What we learned on the way

::::thread{id=bugs members=systemview-test}
Anything that did not work, the moment it did not work. One line, by whoever hit it.
::::

::::thread{id=procedure members=systemview-test}
A move that worked and should happen again, named precisely enough to be a step in a skill.
::::
