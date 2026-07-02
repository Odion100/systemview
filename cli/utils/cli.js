const HELP_TEXT = `
  SystemView — Documentation and testing suite for SystemLynx

  Usage:
    systemview [command] [args] [flags]

  Commands:
    start [port]                           Launch SystemView UI (default port 3000)
    test <projectCode> [namespace]         Run saved tests for a project
    list [projectCode] [namespace]         List projects, services, or tests
    logs [projectCode] [namespace]         View log entries
    connect <serviceId> <url>             Register a service and write manifest
    connect                               Re-probe all services in existing manifest
    probe <ServiceId.Module.method> [args] Call a method ad-hoc
    open [projectCode] [namespace]         Open the browser UI
    shutdown [port]                        Stop a running SystemView instance

  Flags:
    --version                              Print version and exit
    --json                                 Output results as JSON (for agents/CI)
    --verbose                              test: full results and args for all phases; list: expand to show methods and test titles
    --manifest <path>                      Path to manifest file (default: ./systemview.manifest.json)
    --header "Name: Value"                 Extra request header (repeatable; overrides manifest.probeHeaders)
    --skip <pattern>                       Exclude tests matching pattern (repeatable)
    --bail                                 Stop after first failure
    --dry-run                              Print which tests would run without executing
    --phase <before|main|events|after>     Run only specified phase(s), comma-separated
    --index <n>                            Run only action at index n within each phase (0-based)
    --level <trace|info|warn|error|debug>  logs: filter by level
    --limit <n>                            logs: max entries to return (default 50)
    --follow                               logs: stream new entries as they arrive
    --clear                                logs: wipe the log file

  Examples:
    systemview start
    systemview test buAPI
    systemview test buAPI Users.signUp --json
    systemview test buAPI --skip deleteUser --bail
    systemview test buAPI Users.signIn --phase main --index 0
    systemview list
    systemview list buAPI
    systemview list buAPI --verbose
    systemview list buAPI signUp
    systemview connect ProfilesService http://localhost:4100/bu/api/profiles
    systemview probe ProfilesService.Users.getUser '{"userId":"123"}'
    systemview open buAPI signUp
    systemview test buAPI --header "X-Api-Key: secret"
`;

const rawArgs = process.argv.slice(2);

const flagValueArgs = ["--manifest", "--header", "--skip", "--phase", "--index", "--level", "--limit", "--follow", "--filter", "--or"];

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
  clear: rawArgs.includes("--clear"),
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
  showHelp() {
    console.log(HELP_TEXT);
    process.exit(0);
  },
};
