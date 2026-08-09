# RFC-024 — Agent Integration: SystemView as the conversation

**Status:** PLANNED (approved direction, not started — stand by for the go signal)
**Date:** 2026-08-05
**Depends on:** story types + review marks (built), reply threads (built), namespaces, the activity funnel (UI → api → plugin/CLI)

## The vision

Everything so far has been building toward this: stories are the medium, verdicts and replies are
the response channel, `selection` is the pointer, `docs/agents/` is the instruction set. The next
step is closing the loop — **the agent lives in the workflow**: the user reviews and responds in the
UI; the agent sees it, acts, and answers back *in the UI*. "Oh shit — you can respond to me from
this UI."

Two integration layers, complementary — NOT competing paths:

1. **The resident coding-agent bridge** (Claude Code & friends). Deep repo context, real edits, the
   review loop. Turn-based by nature — the trick below makes it feel resident. **Build this first**
   — it's ~80% built already and it's the daily loop.
2. **The embedded copilot** (AgencyAI + user API key + function calling over the plugin surface:
   files, tests, stories, logs, stats). Genuinely resident (lives in the server), answers in-app
   questions ("why is this failing?", "summarize this log burst", "draft a story from this diff")
   with no coding agent attached. Rides the SAME protocol later — same journal, same reply threads,
   different brain.

**On programmatic injection ("get a handle on the chat"):** there is NO supported way to inject a
message into someone's already-running interactive terminal session — turns only start user-side.
Two real injection points exist: (a) a **blocking tool result** — exactly what `await` exploits; the
payload returns INTO the agent's context as if spoken; works with any agent CLI, the session stays
the user's; (b) the **Agent SDK / headless mode** (`claude -p`) — the host program owns the loop and
feeds turns programmatically. (b) is the strongest form of layer 2: SystemView itself spawns and
owns a Claude Code session — Send injects a turn directly, responses stream to the UI, no terminal
involved. So layer 2 has two candidate brains: AgencyAI + function calling, or an SDK-hosted Claude
Code session. Decide when layer 2 starts; the protocol (journal/send/replies) is identical either way.

## 1 · Interactive mode — `systemview await`

A turn-based agent can't listen; it can only be *parked*. `systemview await` is a **blocking CLI
verb**: the agent finishes a slice of work, posts/updates the story, then runs `await` — the turn
sits inside that command until the user **sends**. Then it returns one structured payload (the
batch + digest, below), the agent acts on all of it, responds in-pane, and re-enters `await`.

- This IS "agent interactive mode." The chat is busy while parked — that's the *feature*, a clean
  mode switch: "let's go into SystemView" → the UI becomes the conversation.
- Never trapped: interrupting the agent in chat breaks the wait; exiting the mode is simply not
  re-entering it.
- Degrades gracefully: with no `await` running, batches sit in the files and any later session picks
  them up on request ("what happened recently?").

## 2 · Drafts vs Send — the user batches, the agent responds once

Nothing notifies the agent per-action. Everything the user does accumulates as **DRAFT** state —
replies, read marks, per-pane verdicts — visible in the UI as unsent, editable until committed.
One explicit **Send** (per story — the unit of conversation = the unit of work) flushes the batch.

**Terminal events auto-send.** A story-level APPROVE/REJECT is a decision — it sends. Marking
everything read does NOT auto-send (reading is passive, not a message). The rule: decisions send,
observation doesn't.

## 3 · The activity journal + digest

Every meaningful action already flows through one funnel (UI → api → plugin/CLI), so each drops a
one-line **semantic event** into an append-only journal (`.systemview/` — jsonl):

> ran Math.chainUse (2/3) · saved test X · marked 4 panes read · replied on pane 2 · rejected story
> Y · opened story Z · edited file W via diff · navigated to buAPI/Profiles

The `await` payload (and the on-demand cold-start query) opens with a **digest** — "since you last
looked: …" — plus a **UI-state snapshot**: current selection, open story, verdict tallies.
**Pointers, not logs.** No test output, no log bodies; the agent reads the real thing itself when a
line matters.

## 4 · Subscriptions — namespace filters

The addressing scheme already exists. `systemview await <project>` = the project's lane;
`--ns <project>/<Service>[/Module[/method]]` scopes tighter; no filter = firehose. The journal is
ONE stream; subscriptions are filters over it. Side effect: **multiple agents** stay sane — one
parked on buAPI, another on systemview-test, each woken only by its own lane. The digest scopes the
same way.

## 5 · Live push — answering in the open UI

Agent replies (`author: "agent"`) land in story files today; the UI shows them on refresh. The
socket layer that already broadcasts spec updates should broadcast story updates too, so the
agent's answer appears in the open pane the moment it's written. (The long-planned
`systemview story-reply` verb lands here.)

## 6 · Auto-setup — "connect your Claude Code"

`systemview connect-agent` (or detection on first CLI use in a repo) injects a short **"SystemView
loop"** section into the repo's CLAUDE.md pointing at `docs/agents/` — work → story → await →
respond in-pane. The NEXT agent session in that repo just knows the loop without being taught.
That's where the surprise moment comes from.

## 7 · Presence

While in the loop, the agent's state is visible in the UI — "revising panes 3 & 5…", "awaiting
your review" — a status chip/strip fed by the same journal (agent-side events).

## 8 · The UI as the map — domain-addressable state (seek · pull · act)

How data gets fed to the agent is (mostly) agnostic of which brain consumes it — the real question
is how the data is **organized**. The answer is already on screen: the UI's layout IS the
information architecture. Each panel is a **domain** with subdomains:

- **navigator** (system links) → project → service → module → method
- **codebase** → the file tree / changed files
- **middle panel** → docs · saved tests · logs for the current namespace
- **scratchpad** → the test being built right now (sections, steps, results)
- **stats** → throughput, health, coverage
- **stories** → the conversation surface itself

The agent doesn't get a firehose — it **seeks**: pull a domain (returns that panel's current state),
drill a subdomain, or send a **command** scoped to a domain to manipulate it — and every command
returns fresh information on that call (act = command + response, same as a user working the panel).
The user and the agent are operating the SAME surface through the same map; "what's on your screen"
and "what can the agent see" are one vocabulary.

This slots under everything above rather than beside it: the §3 UI-state snapshot is a shallow pull
of all domains; the digest's pointers are domain addresses; §4 subscriptions are lanes over the same
tree; the layer-2 function-calling surface is exactly these domains exposed as pull/act pairs.

## 9 · The chat surface — a hovering companion, not a text box

The conversation needs a HOME in the UI, and it has to be **pleasant** — something you *want* to
talk to, not "a whack text box up there." Decisions so far:

- **Entry point: a bot icon in the page header**, immediately right of the ☾/☀ theme pill. Click to
  open the chat.
- **The chat is a hovering panel** — floats OVER the page, draggable anywhere on screen, expandable
  / resizable. Side-docking was rejected ("I like the hovery"); also passed on: a corner tab
  swapping with the scratchpad; a fixed center popup.
- **…that can DOCK INTO TAB STRIPS (2026-08-06).** Drag the floating chat onto any of the main
  page's three panels (left nav / middle / right scratchpad) and it docks as a **tab at the end of
  that panel's tab strip** — with its own distinct active/inactive coloring so it keeps its agent
  identity among normal tabs. Drag it back out to float. Consequences: docked geometry comes free
  (the panel is the size); the inactive tab is where presence/unread lives (same idiom as the
  Stories tab's activity dot); tab strips light up as drop zones during the drag (the step-drag
  affordance grammar); float position / docked location persists like everything else.
- **Pages WITHOUT tab strips (e.g. Stats) dock by SIDE (2026-08-06):** drag toward the left or
  right edge and the chat takes its own spot there — a docked side column beside the page content,
  **resizable once docked** (edge-drag, same grammar as pane resize). The general rule: the chat
  docks into whatever structure the page has — tab strip where there is one, an edge column where
  there isn't.
- **INVARIANT — one chat, same everywhere (2026-08-06):** wherever it lands (floating, tab in any
  panel, left/right column) it is the SAME full chat with ALL the same features. Location changes
  geometry only — never capability. No "quick" variant here and full variant there.
- **VOICE INPUT is a requirement, not polish (2026-08-06):** the user works by dictation; a
  type-only chat is a downgrade he wouldn't use ("if I can't use a mic... I wouldn't even wanna do
  it for now"). Mic in the chat from day one — hold-to-talk / toggle, speech-to-text feeding the
  same input channel as typed text.

## 10 · Plan-first stories — the story plans, the RFC reflects (2026-08-06)

The intended agent behavior once it lives in the UI: **plan IN the stage before writing any RFC.**
The agent breaks the idea down pane by pane (narrate + show), the user verdicts it in an approval
story — and only AFTER approval does the agent save the RFC, **as a reflection of the approved
breakdown**. "You barely need to read the RFC — it's just a reflection of the broken-down
original." This inverts today's flow (RFC first, story copies it — which is exactly the
documents-only story that reads as pointless, because the document existed first). The repo RFC
stays the durable archive — code pointers, how-to-implement, what a fresh session greps — per the
standing rule: the story is the reading/deciding surface, never the archive. Someone agnostic in
the window saying "create tests, create a wrapper for my codebase" gets the same shape: breakdown
in the stage → approve → artifacts written.
- **The feel is presence**: it's *there on the page with you* — it hovers, it moves around with
  you. The natural register is pointing at what you're looking at: "yo, what is this?", "why that?"
- **It knows where you are.** The chat rides the §8 domain map — current page, panel, selection,
  open story are ambient context it always has. That's what makes "what is this?" answerable
  without preamble.
- **Chat replaces reply-fanout.** When you'd otherwise reply across multiple stories, you just say
  it in the chat — the agent is listening ("yo, I'm working from SystemView" IS the mode switch).
  Story replies stay for pane-anchored comments; the chat is the free channel above them.

Reacting to what you do (the journal) + knowing where you are (the domain map) + a companion that
hovers with you = the "it's alive in here" feeling layer 1 and layer 2 both plug into.

## Phasing

1. **Journal + digest** — the event funnel, the jsonl, `systemview activity` (on-demand digest).
   Standalone value immediately (cold-start orientation), no UI changes required to start.
2. **Drafts + Send + `await`** — the batch model in the UI (unsent state, per-story Send, terminal
   auto-send on story verdicts) and the blocking verb returning batch+digest.
3. **Live push + auto-setup** — story-update broadcast (agent replies appear live);
   `connect-agent` CLAUDE.md injection; presence chip.
4. **AgencyAI copilot** — embedded resident layer over the same protocol, function calling across
   the plugin surface. API-key UX. Separate track once 1–3 stabilize the protocol.

## Open questions (settle during build, not blockers)

- Batch payload shape (one markdown doc vs structured JSON vs both — lean both: JSON + rendered md).
- Journal event schema + retention (cap/rotate like logs).
- Does `await` also wake on non-story events in its lane (e.g. a test run), or story sends only?
  Lean: story sends + terminal verdicts wake; everything else is digest-only.
- Draft visibility for replies: current replies post immediately — do they become draft-by-default
  in approval stories only, or everywhere? Lean: everywhere once Send exists.
- Per-story Send vs a global Send (lean per-story; story verdict = implicit send).
- **Story purpose contract** (vague — build on, don't act yet): today `type` defaults to report for
  backwards compat with existing files, but the point of types is that the AGENT should have to
  declare a purpose when creating a story — requirements on the story shape that force focus
  ("what is this story FOR?"). Maybe: agent-created stories must set `type` explicitly; maybe types
  carry pane-shape expectations. Direction, not a spec.
