const HELP_TEXT = `
  SystemView — Documentation and testing suite for SystemLynx

  Usage:
    systemview [command] [args] [flags]

  Commands:
    start [port]                           Launch SystemView UI (default port 3000)
    test <projectCode> [namespace]         Run saved tests for a project
    connect <serviceId> <url>             Register a service and write manifest
    connect                               Re-probe all services in existing manifest
    probe <ServiceId.Module.method> [args] Call a method ad-hoc
    open [projectCode] [namespace]         Open the browser UI
    shutdown [port]                        Stop a running SystemView instance

  Flags:
    --json                                 Output results as JSON (for agents/CI)
    --verbose                              Print all phases including Before/After on pass
    --manifest <path>                      Path to manifest file (default: ./systemview.manifest.json)
    --header "Name: Value"                 Extra request header (repeatable; overrides manifest.probeHeaders)

  Examples:
    systemview start
    systemview test buAPI
    systemview test buAPI Users.signUp --json
    systemview connect ProfilesService http://localhost:4100/bu/api/profiles
    systemview probe ProfilesService.Users.getUser '{"userId":"123"}'
    systemview probe ProfilesService.Users.get --header "Origin: http://localhost:3300"
    systemview test buAPI --header "X-Api-Key: secret"
`;

const rawArgs = process.argv.slice(2);

const flags = {
  json: rawArgs.includes("--json"),
  verbose: rawArgs.includes("--verbose") || rawArgs.includes("-v"),
  debug: rawArgs.includes("--debug") || rawArgs.includes("-d"),
  manifest: (() => {
    const i = rawArgs.indexOf("--manifest");
    return i !== -1 ? rawArgs[i + 1] : null;
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
  if (i > 0 && (rawArgs[i - 1] === "--manifest" || rawArgs[i - 1] === "--header")) return false;
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
