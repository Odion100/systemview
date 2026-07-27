const HELP_TEXT = `
  SystemView — Documentation and testing suite for SystemLynx

  Usage:
    systemview [command] [args] [flags]

  Commands:
    start [port]                           Launch SystemView UI (default port 3000)
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
    toggle cs | ci                         Toggle namespace case-sensitivity (sticky; default insensitive)
                                           [also: bare cs / ci; works in interactive mode]
    open [projectCode] [namespace]         Open the browser UI
    story <target> "<name>" [--ns ns] [--text|--source|--file|--diff|--test]… [--note md]  Create/update a saved, namespaced Story (see docs/stories-for-agents.md)
    stories <target>                       List saved Stories (name · namespace · pane count)
    show <target> [--file|--source|--text] Drive the live Window to one thing (a file, a method's source, or prose)
    assemble <target> [--text|--source|--file]…  Fill the live Window with several panes at once
    stage add <target> [--file|--source|--text]  Append a pane to the live Window   stage clear <target>  Empty it
    highlight <target> --lines A-B|--match s      Emphasize a region of the last pane on the stage
    view save|open|list|delete <target> [name]   Save the live Window as a reopenable view, or reopen one
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
    --file <path>                          show/assemble/stage: a project file to display (repeatable)
    --source <Mod.method>                  show/assemble/stage: a method's source span to display (repeatable)
    --diff <path>                          show/assemble/stage: a file's before/after vs git HEAD (repeatable)
    --test <target>                        story/show/assemble/stage: saved tests as runnable examples — any level: * | Service | Module | Mod.method | Mod.method:N (repeatable)
    --text "…"                             story/show/assemble/stage: inline markdown/prose pane (repeatable)
    --ns <path>                            story: namespace to file it under (project | project/Service | …/Module | …/method)
    --note "<md>"                          story: markdown attached to a test pane, rendered with the block
    --lines A-B                            show/highlight: emphasize a line range on the pane
    --match <string>                       show/highlight: emphasize the first match on the pane
    --layout <column|grid|single|gallery>  story/assemble: how to frame multiple panes

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

const flagValueArgs = ["--manifest", "--header", "--skip", "--phase", "--index", "--level", "--limit", "--follow", "--filter", "--or", "--include", "--highlight", "--save", "--save-limit", "--file", "--source", "--text", "--lines", "--match", "--layout", "--diff", "--test", "--ns", "--note"];

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
    follow: rawArgs.includes("--follow") || rawArgs.includes("-f"),
    current: rawArgs.includes("--current"),
    filter: listOf("--filter"),
    or: listOf("--or"),
    include: listOf("--include"),
    highlight: listOf("--highlight"),
    clear: rawArgs.includes("--clear"),
    force: rawArgs.includes("--force"),
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
    diff: listOf("--diff"),
    test: listOf("--test"),
    lines: valOf("--lines"),
    match: valOf("--match"),
    layout: valOf("--layout"),
    ns: valOf("--ns"),
    note: valOf("--note"),
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
