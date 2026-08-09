# RFC-029 — Agent control: navigate, refresh, act

**Status: BUILT + LIVE-VERIFIED 2026-08-09** — he watched all three verbs work on his own
screen ("things navigated… you definitely populated the scratch pad. Pretty cool."): nav walked
him from BUApp to the design record, act loaded and ran Math.add in his scratchpad, refresh
re-read the pane. (The build signal was "get to work" — sent through the UI chat itself and
delivered by a held join poll: the feature's own front door carried its build order). Shipped:
`chatCommand` (kind:"command" records, same JSONL, `chat-updated` push), the UI executor
(live-push-only; history renders receipts, never re-executes), `systemview nav/refresh/act`,
refresh scopes docs/reports/nav/all, `act test <Module.method>` (loads the saved test into the
scratchpad and runs it live; auto-opens the scratchpad), three-section view stamp, the
`?rdoc=`-by-name-or-path fix (a `:report` chip now opens the report from anywhere), and — his
mid-build addition — the **agent HUB** in the page header beside the version: right-click a bot →
"Turn off — park in the hub"; the 🤖 dropdown lists every bot and pulls parked ones back out.
Found-in-build bug: a join hold took delivery of its own command records (`from` was the `--as`
name, not "agent" verbatim) — fixed with the `forAgent` filter (only `from:"you"`, never
commands), unit-verified on both transports. Design record = the Stage report (approved, threads
answered).

If the agent can send chats, it can send commands. Three verbs cover the feature:

1. **navigate** — drive what the window shows.
2. **refresh** — make a pane re-read its data after the agent edits files. Never a page reload.
3. **act** — trigger the system's OWN defined operations visibly in the UI (his t5 revision: "run
   the test in the UI and I can sit there and watch it"). Not arbitrary forms — the operations
   the system already defines: run a saved test, press a `:::run` block's play. Results render in
   the pane in front of him.

## Settled decisions

- **Commands ride the chat** as typed records (`kind: "command"` beside `kind: "message"`) in the
  same JSONL file — visible in the thread as distinct command lines, delivered over the existing
  `chat-updated:<pc>` push, auditable because the chat history IS the command history.
- **The replay rule (trust-critical):** a command executes only when it arrives on the live push.
  Loading history renders old command lines but NEVER re-executes them.
- **URL control, per-section params** (his t1 go-ahead): every meaningful view state rides the
  URL, with section-prefixed keys as new state gets added (the UI is broken into nav / center /
  scratchpad — params should say which section they belong to). Existing keys (`tab`, `rdoc`,
  `file`, `help`) stay for compatibility. Every move is a router push — smooth, no reloads, back
  button walks it.
- **Grammar leads with the SECTION, not the project** (his t3): the UI is broken down into
  sections and future pages (stats is coming), so the command names what it controls:
  `systemview nav <pc> center --report <path>` / `nav <pc> center --file path#L40-80` /
  `nav <pc> nav TestService/Math` / `nav <pc> page stats` (when it exists).
- **"Story" is dead vocabulary** (his t2): it's REPORTS on the Stage tab, everywhere. The open
  report already rides `?rdoc=` — the old localStorage story restore is dead-Stage code to delete,
  not a chore to build around.
- **Layout is not commandable** — panel widths, collapsed corners stay his furniture.
- **Voice-to-text is a fast-follow, not skipped** (his t4): a mic button on the chat input via the
  browser's native speech recognition (~a day, no external service). Duplex voice calls stay out.

## The richer view stamp

Three-section breakdown stamped on every message, mostly a URL decode:

```json
{ "path": "/specs/systemview-test/TestService/Math?tab=reports&rdoc=…",
  "page": "specs", "projectCode": "systemview-test",
  "nav":    { "lens": "systemlynx", "selected": "TestService/Math" },
  "center": { "tab": "reports", "rdoc": "…", "openFile": null, "help": null },
  "scratchpad": { "open": true, "namespace": "TestService/Math" } }
```

"On stage" says which report; "in the scratchpad" says which namespace. The `page` field is ready
for the stats page.

## Build order

1. Command records in the chat store + hub method + `chat-updated` push + the UI executor +
   command-line rendering in the thread (replay rule enforced).
2. CLI: `systemview nav`, `systemview refresh`, `systemview act` (all take `--as <agent>`),
   section-first grammar.
3. Refresh subscribers, four scopes: `docs` / `reports` / `nav` / `all` (a `sv:refresh` window
   event; each data-holding organism re-runs its loaders on scope match).
4. `act` v1: run a saved test in the scratchpad/pane so the run is watchable; result lands where
   his own click would put it.
5. The three-section view stamp on send.
6. Delete the dead `sv.story` restore; naming pass (reports, not stories).
7. `agents/chat.md` control section — pull things up when asked or when presenting work, never as
   a surprise.
8. Fast-follow: mic dictation on the chat input.

## Known issues to fold in during the build

- The `:report` chip pushes `?tab=reports&rdoc=…` but the Reports tab doesn't open the document
  from the URL alone in all states ("you gotta select the report") — fix as part of the navigate
  executor work.
- Reports list vs short/empty document: the picker collides with the document until a report is
  selected full-size (his description) — polish alongside.
- RFC-030 material (not this build): the avatar walking the window, knowing what it's next to;
  interactive mode docking.
