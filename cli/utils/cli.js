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
    shutdown [port]                        Stop a running SystemView instance  [aliases: exit, stop, q]

  Flags:
    --version                              Print version and exit
    -d, --debug                            Verbose debug output
    --json                                 Output results as JSON (for agents/CI)
    --verbose                              test: full results and args for all phases; list: expand hierarchy
    --manifest                             connect: use plugin manifest to get real projectCode
    --manifest <path>                      probe: path to manifest file (default: ./systemview.manifest.json)
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
    --save-session                         connect: opt in to session persistence — a later probe that
                                             signs in saves its cookie to the manifest so the next probe
                                             reuses it (saving implied: creates a manifest if none, else amends)
    --save [path]                          logs: append streamed entries to a local snapshot file
    --saved                                logs: read from local snapshot instead of live service
    --save-limit <n>                       logs: max entries to keep in snapshot (default 500)
    --force                                connect: re-probe even if already connected

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
`;

const rawArgs = process.argv.slice(2);

const flagValueArgs = ["--manifest", "--header", "--skip", "--phase", "--index", "--level", "--limit", "--follow", "--filter", "--or", "--include", "--highlight", "--save", "--save-limit"];

const flags = {
  json: rawArgs.includes("--json"),
  verbose: rawArgs.includes("--verbose"),
  debug: rawArgs.includes("--debug") || rawArgs.includes("-d"),
  bail: rawArgs.includes("--bail"),
  dryRun: rawArgs.includes("--dry-run"),
  manifest: (() => {
    const i = rawArgs.indexOf("--manifest");
    return i !== -1 ? rawArgs[i + 1] : null;
  })(),
  phase: (() => {
    const i = rawArgs.indexOf("--phase");
    return i !== -1 ? rawArgs[i + 1] : null;
  })(),
  index: (() => {
    const i = rawArgs.indexOf("--index");
    if (i === -1) return undefined;
    const val = parseInt(rawArgs[i + 1], 10);
    return isNaN(val) ? 0 : val;
  })(),
  skip: (() => {
    const result = [];
    rawArgs.forEach((a, i) => {
      if (a === "--skip" && rawArgs[i + 1]) result.push(rawArgs[i + 1]);
    });
    return result;
  })(),
  level: (() => {
    const i = rawArgs.indexOf("--level");
    return i !== -1 ? rawArgs[i + 1] : null;
  })(),
  limit: (() => {
    const i = rawArgs.indexOf("--limit");
    if (i === -1) return undefined;
    const val = parseInt(rawArgs[i + 1], 10);
    return isNaN(val) ? undefined : val;
  })(),
  follow: rawArgs.includes("--follow") || rawArgs.includes("-f"),
  current: rawArgs.includes("--current"),
  filter: (() => {
    const result = [];
    rawArgs.forEach((a, i) => { if (a === "--filter" && rawArgs[i + 1]) result.push(rawArgs[i + 1]); });
    return result;
  })(),
  or: (() => {
    const result = [];
    rawArgs.forEach((a, i) => { if (a === "--or" && rawArgs[i + 1]) result.push(rawArgs[i + 1]); });
    return result;
  })(),
  include: (() => {
    const result = [];
    rawArgs.forEach((a, i) => { if (a === "--include" && rawArgs[i + 1]) result.push(rawArgs[i + 1]); });
    return result;
  })(),
  highlight: (() => {
    const result = [];
    rawArgs.forEach((a, i) => { if (a === "--highlight" && rawArgs[i + 1]) result.push(rawArgs[i + 1]); });
    return result;
  })(),
  clear: rawArgs.includes("--clear"),
  force: rawArgs.includes("--force"),
  save: (() => {
    const i = rawArgs.indexOf("--save");
    if (i === -1) return false;
    const next = rawArgs[i + 1];
    return (next && !next.startsWith("-")) ? next : true;
  })(),
  saved: rawArgs.includes("--saved"),
  saveLimit: (() => {
    const i = rawArgs.indexOf("--save-limit");
    if (i === -1) return 500;
    const val = parseInt(rawArgs[i + 1], 10);
    return isNaN(val) ? 500 : val;
  })(),
  headers: (() => {
    const result = {};
    rawArgs.forEach((a, i) => {
      if (a === "--header" && rawArgs[i + 1]) {
        const val = rawArgs[i + 1];
        const colonIdx = val.indexOf(":");
        if (colonIdx !== -1) {
          result[val.slice(0, colonIdx).trim()] = val.slice(colonIdx + 1).trim();
        }
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

module.exports = {
  input,
  flags,
  showHelp(exit = true) {
    console.log(HELP_TEXT);
    if (exit) process.exit(0);
  },
};
