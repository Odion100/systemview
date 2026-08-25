const HELP_TEXT = `
  SystemView — Documentation and testing suite for SystemLynx

  Usage:
    systemview [command] [args] [flags]

  Commands:
    start [port]                           Launch SystemView UI (default port 3000)
    init                                   Make THIS codebase testable with no framework: interview
                                           (enter = defaults) → committed <project>/ folder with
                                           service.json + methods/ (a file per module) + specs/;
                                           the hub hosts it (immediately if running, else at boot)
    delete <projectCode>                   init's opposite — hosted projects only: unhost, remove
                                           the registration AND the committed folder (y/N confirm;
                                           --force skips). Plain connections: use disconnect
    join <project> [--once]                Agent presence (RFC-028): hold the line — each message
                                           sent from the UI chat streams out as one JSON line
                                           ({text, view}); the hold IS the "he's in" indicator.
                                           VISITING (RFC-031): join ANOTHER project's room with
                                           --as <yourProject> — you hear it like a member, your
                                           bubbles wear your project's name, the roster shows you
    say <project> "<text>"                 Reply into the UI chat (repeat calls = streamed chunks).
                                           In someone else's room: --as <yourProject>
    status <project> "<text>"              The cooking line shown while the agent works ("" clears)
    inbox <project>                        File mode: drain pending UI messages as JSON + ack them
                                           (call from your hooks; registers the outlined-bubble
                                           listener). See agents/chat.md
    test [target]                          Run saved tests. target = projectCode OR any namespace
                                           (service / module / method / dotted, e.g. Posts.add) — no
                                           projectCode required; it resolves where it lives
    list [target]                          List projects, services, or tests (target resolves like test)
    logs [target]                          Stream logs (target resolves like test)
    unsubscribe                            Stop streaming logs (keeps log file)  [alias: stoplogs]
    flush                                  Wipe the log file and stop streaming  [alias: clearlogs]
    connect [url|projectCode]             Connect a service URL, reconnect a stored project, or connect all
    connect <url> --manifest              Connect via plugin manifest — registers under real projectCode
    connect <url> --manifest --save       Connect, then persist the connection (services + headers + cookie) to the manifest
    disconnect [projectCode] [serviceId]  Remove a project or service from the UI store
    manifest save                          Persist session manifest — services, auth headers, cookies  [interactive]
    manifest clean                        Re-probe manifest entries, remove stale ones
    probe <ServiceId.Module.method> [args] Call a service method ad-hoc
    comments <project> <path> --at <n> --reply "…"
                                           Answer his comment WHERE HE LEFT IT — on the line, not in
                                           the chat. --at is the line; optional when the file has one.
    comments <project> [path] [--json]     His comments on the code — every file that has them,
                                           or one file's, with the lines they sit on
    board <project> [--json]               His board — the notes he leaves for you between sessions
    board <project> --reply "…" --at <n>   Answer ONE note (n from the listing); replaces that answer
    stats <project> [service] [--range <r>] [--json]   Read live stats — the Stats page's numbers
                                           in a digest (top load, error hotspots, deltas); --json
                                           for the full structured read; range: 15m|1h|4h|24h|all
    toggle cs | ci                         Toggle namespace case-sensitivity (sticky; default insensitive)
                                           [also: bare cs / ci; works in interactive mode]
    open [projectCode] [namespace]         Open the browser UI

  Agent control (RFC-029) — drive the OPEN window; every command shows in the chat as a "→ …" receipt:
    nav <project> <namespace>              NAVIGATE (select for real): route to a live namespace —
                                           validated + fuzzily resolved against the live tree
                                           ("Math.add" works); a bad name is refused, never a ghost
    nav <project> center --report <path>   Open a report on the Stage tab (path or indexed name)
    nav <project> center --file <p[#La-b]> Open a file in the Code tab (tree selection follows)
    nav <project> center --tab <t>         Switch the center tab (docs | reports | logs)
    nav <project> center --topic <help>    Open a help topic over the page
    nav <project> stats [tab] [--range <r>] [--service <s>]   Walk the human to the Stats page —
                                           tab: state|load|reliability|coverage|change|topology|coupling,
                                           range: 15m|1h|4h|24h|all; service focuses one service
    highlight <project> <ns> | --file <p>  POINT, don't navigate: the tree expands to the target,
                                           marks it, scrolls it into view — nothing else moves
    refresh <project> [docs|reports|nav|stats|all]  Panes re-read their data in place — never a page reload
    act <project> test <Mod.method|title|all>  Run a saved test where the human is LOOKING: a doc
                                           block showing it claims the run; else the saved-tests
                                           area; "all" = the whole saved list, in sequence
    act <project> run "<block title>"      Press a :::run block's play in the open document
    tv <project> [--json]                  READ THE TV BACK: the clicked-up show — his picked
                                           answers, approval verdicts and typed thread replies
    show <project> --text "<md>"|--file <p.md>|--clear   THE TV: push interactive markdown onto the
                                           chat's show surface (runnables, tests, charts — all live);
                                           one show at a time, every show stays clickable in the thread

    shutdown [port]                        Stop a running SystemView instance  [aliases: exit, stop, q]

  Flags:
    --version                              Print version and exit
    -d, --debug                            Verbose debug output
    --json                                 Output results as JSON (for agents/CI)
    --verbose                              test: full results and args for all phases; list: expand hierarchy
    --manifest                             connect: use plugin manifest to get real projectCode
    --manifest <path>                      read connection data from a combined manifest file (default: assembled from .systemview/)
    --header "Name: Value"                 Extra request header (repeatable; overrides manifest headers).
                                             For a standing token, add it to the manifest "headers"
                                             (literal or "@file") — see docs/cli.md.
    --skip <pattern>                       Exclude tests matching pattern (repeatable)
    --bail                                 Stop after first failure
    --dry-run                              Print which tests would run without executing
    --phase <before|main|events|after>     Run only specified phase(s), comma-separated
    --index <n>                            Run only action at index n within each phase (0-based)
    --level <trace|log|warn|error|debug>   logs: filter by level
    --limit <n>                            logs: max entries to show with --current (default 50)
    --current                              logs: show existing entries (use --follow to also stream)
    -f, --follow                           logs: keep streaming after --current
    --clear                                logs: wipe log store then stream
    --filter <field=value>                 logs: AND filter on a field (repeatable); field can be a dot path
    --filter has=<field>                     → only entries where field is present
    --filter missing=<field>                 → only entries where field is absent
    --or <field=value>                     logs: OR filter on a field (repeatable)
    --include <field>                      logs: include extra field as a column (repeatable)
    --highlight <field=value>              logs: emphasize matching entries, keep all rows (repeatable; same grammar as --filter)
    --save                                 connect: persist this connection to the manifest (headers + cookie tag along)
    --save-session                         probe/connect: persist a captured session cookie so the next
                                             process reuses it (single-origin unless -g)
    -g, --global                           with --save-session: make the session PROJECT-WIDE — the cookie
                                             rides to every service in that project (not just its origin)
    --save [path]                          logs: append streamed entries to a local snapshot file
    --saved                                logs: read from local snapshot instead of live service
    --save-limit <n>                       logs: max entries to keep in snapshot (default 500)
    --force                                connect: re-probe even if already connected
    --say "<text>"                         any command: the sentence the bot says while the window
                                             moves — what you are showing them, not what you did
    --file <path[#La-b]>                   nav/highlight: the file to open (nav, with an optional
                                             line range to scroll+mark) or to point the tree at
    --report <path|name>                   nav: the report to open on the Stage tab
    --tab <docs|reports|logs>              nav: the center tab to switch to
    --topic <name>                         nav: the help topic to open
    --chat <name>                          chat verbs: a named chat (default "main")
    --as <projectCode>                     chat verbs: the PROJECT you speak as (RFC-031 — the
                                           agent IS the project; omitted or unknown = the room's
                                           own agent; another live project's code = visiting)
    --once                                 join: exit after the first message (one wake per message)

  Examples:
    systemview start
    systemview test buAPI
    systemview test buAPI Users.signUp --json
    systemview test buAPI --skip deleteUser --bail
    systemview test buAPI Users.signIn --phase main --index 0
    systemview list
    systemview list buAPI
    systemview list buAPI --verbose
    systemview logs buAPI
    systemview logs buAPI --current --limit 20
    systemview logs buAPI --current --follow
    systemview logs buAPI --filter level=error
    systemview logs buAPI --filter has=log.userId
    systemview logs buAPI --filter missing=error --include log
    systemview logs buAPI --highlight level=error
    systemview logs buAPI --save
    systemview logs buAPI --saved
    systemview connect http://localhost:4100/bu/api/profiles
    systemview connect http://localhost:4100/bu/api/profiles --manifest
    systemview connect http://localhost:4100/bu/api/profiles --manifest --save-session
    systemview connect buAPI
    systemview disconnect buAPI
    systemview disconnect buAPI ProfilesService
    systemview probe ProfilesService.Users.getUser '{"userId":"123"}'
    systemview open buAPI signUp
    systemview test buAPI --header "X-Api-Key: secret"
    systemview show buAPI --source Users.signUp
    systemview show buAPI --file src/modules/Users.js --lines 40-70
    systemview assemble buAPI --text "Here's the sign-up flow" --source Users.signUp --file src/modules/Users.js
    systemview highlight buAPI --match "await hash"
`;

const flagValueArgs = ["--manifest", "--header", "--skip", "--phase", "--index", "--level", "--limit", "--follow", "--filter", "--or", "--include", "--highlight", "--save", "--save-limit", "--file", "--source", "--text", "--lines", "--match", "--layout", "--diff", "--test", "--ns", "--note", "--at", "--from", "--to", "--chat", "--as", "--report", "--tab", "--topic", "--range", "--service", "--say", "--reply"];

// Quote-aware tokenizer: a single/double-quoted arg (e.g. a JSON payload with spaces) stays ONE token,
// surrounding quotes stripped. Turns an interactive REPL line into the same argv shape the shell hands
// one-shot mode — so both feed the SAME parseArgs below instead of each rolling their own.
function tokenize(str) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
  }
  return tokens;
}

// THE single arg parser — used by BOTH one-shot (process.argv) and interactive (a tokenized line).
// Any flag added here works in EVERY mode; that's the whole point (interactive used to keep its own
// partial list and silently drift, which is how --save-session died in the REPL).
function parseArgs(rawArgs) {
  const listOf = (name) => {
    const r = [];
    rawArgs.forEach((a, i) => { if (a === name && rawArgs[i + 1]) r.push(rawArgs[i + 1]); });
    return r;
  };
  const valOf = (name) => {
    const i = rawArgs.indexOf(name);
    return i !== -1 ? rawArgs[i + 1] : null;
  };
  const intOf = (name, dflt) => {
    const i = rawArgs.indexOf(name);
    if (i === -1) return dflt;
    const v = parseInt(rawArgs[i + 1], 10);
    return isNaN(v) ? dflt : v;
  };
  const flags = {
    json: rawArgs.includes("--json"),
    verbose: rawArgs.includes("--verbose"),
    debug: rawArgs.includes("--debug") || rawArgs.includes("-d"),
    bail: rawArgs.includes("--bail"),
    dryRun: rawArgs.includes("--dry-run"),
    manifest: valOf("--manifest"), // probe: path after --manifest
    useManifest: rawArgs.includes("--manifest"), // connect: boolean presence
    phase: valOf("--phase"),
    index: (() => {
      const i = rawArgs.indexOf("--index");
      if (i === -1) return undefined;
      const v = parseInt(rawArgs[i + 1], 10);
      return isNaN(v) ? 0 : v;
    })(),
    skip: listOf("--skip"),
    level: valOf("--level"),
    limit: intOf("--limit", undefined),
    // `read --since <ms>` — the reader carries its own position (the timestamp `read` handed back
    // last time), so the hub stores no cursor for anyone. That is the whole cursor retirement.
    since: intOf("--since", undefined),
    follow: rawArgs.includes("--follow") || rawArgs.includes("-f"),
    current: rawArgs.includes("--current"),
    filter: listOf("--filter"),
    or: listOf("--or"),
    include: listOf("--include"),
    highlight: listOf("--highlight"),
    clear: rawArgs.includes("--clear"),
    force: rawArgs.includes("--force"),
    // RFC-039 — `skill --print` (show it without writing), `inbox --history` (ask for the
    // back-catalog on purpose), `nav … --pin` (keep the --say line in the chat).
    print: rawArgs.includes("--print"),
    history: rawArgs.includes("--history"),
    pin: rawArgs.includes("--pin"),
    // `--room` — say's deliberate override for the reply-into-the-void wall: "I really do mean my
    // own room." Every flag lives HERE or it exists nowhere (the drift lesson above).
    room: rawArgs.includes("--room"),
    save: (() => {
      const i = rawArgs.indexOf("--save");
      if (i === -1) return false;
      const next = rawArgs[i + 1];
      return next && !next.startsWith("-") ? next : true;
    })(),
    saved: rawArgs.includes("--saved"),
    saveSession: rawArgs.includes("--save-session"),
    global: rawArgs.includes("--global") || rawArgs.includes("-g"),
    saveLimit: intOf("--save-limit", 500),
    // RFC-018 AI Window (show/stage/assemble/highlight): file/source/text are repeatable so `assemble`
    // can take several; `show`/`stage add` use the first of each. lines/match drive highlight.
    file: listOf("--file"),
    source: listOf("--source"),
    text: listOf("--text"),
    say: listOf("--say"),
    diff: listOf("--diff"),
    test: listOf("--test"),
    lines: valOf("--lines"),
    match: valOf("--match"),
    layout: valOf("--layout"),
    ns: valOf("--ns"),
    note: valOf("--note"),
    at: valOf("--at"),
    reply: valOf("--reply"),
    // RFC-039 — `board --add "…"`, or `--add --file <path.md>` when it's long enough to write in a
    // file. Bare `--add` with a file is why this can't just be valOf: the value may be absent.
    add: (() => {
      const i = rawArgs.indexOf("--add");
      if (i === -1) return undefined;
      const next = rawArgs[i + 1];
      return next && !next.startsWith("--") ? next : "";
    })(),
    from: valOf("--from"),
    to: valOf("--to"),
    // RFC-028 chat verbs
    chat: valOf("--chat"),
    as: valOf("--as"),
    once: rawArgs.includes("--once"),
    // RFC-029 agent control (nav/refresh/act)
    report: valOf("--report"),
    tab: valOf("--tab"),
    topic: valOf("--topic"),
    // RFC-032 — nav <pc> stats [tab] [--range] [--service]
    range: valOf("--range"),
    service: valOf("--service"),
    // ORDERED pane sequence for `assemble` — walk the raw args left→right so panes render in the
    // order given (markdown can sit BETWEEN code/diff/test to tell a story). Grouping by kind would
    // clump all the prose at the top and kill the narrative.
    paneSeq: (() => {
      const PANE = { "--text": "markdown", "--source": "source", "--file": "file", "--diff": "diff", "--test": "test" };
      const seq = [];
      rawArgs.forEach((a, i) => { if (PANE[a] && rawArgs[i + 1] != null) seq.push({ kind: PANE[a], value: rawArgs[i + 1] }); });
      return seq;
    })(),
    headers: (() => {
      const result = {};
      rawArgs.forEach((a, i) => {
        if (a === "--header" && rawArgs[i + 1]) {
          const val = rawArgs[i + 1];
          const colonIdx = val.indexOf(":");
          if (colonIdx !== -1) result[val.slice(0, colonIdx).trim()] = val.slice(colonIdx + 1).trim();
        }
      });
      return result;
    })(),
  };
  const input = rawArgs.filter((a, i) => {
    if (a.startsWith("-")) return false;
    if (i > 0 && flagValueArgs.includes(rawArgs[i - 1])) return false;
    return true;
  });
  return { input, flags };
}

const { input, flags } = parseArgs(process.argv.slice(2));

module.exports = {
  input,
  flags,
  parseArgs,
  tokenize,
  showHelp(exit = true) {
    console.log(HELP_TEXT);
    if (exit) process.exit(0);
  },
};
