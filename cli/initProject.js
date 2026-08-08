const fs = require("fs");
const path = require("path");
const readline = require("readline");
const log = require("./logger");
const appIsRunning = require("./appIsRunning");
const { manifestDir } = require("./manifestStore");

// RFC-027 — `systemview init`: the ONE command that makes a codebase with no services testable.
// It interviews with defaults (enter accepts), writes the configuration, scaffolds the committed
// folder — named by the PROJECT CODE, default project name `systemview` — and registers it with
// the hub (a manifest entry, never name-scanning). The hub hosts configured projects as part of
// its own boot; if a hub is already running, init asks it to host right now.
//
// The scaffold TEACHES: one working example method + its documentation (service and method level,
// in the interactive vocabulary) + one saved test — the first `systemview test` is green out of
// the box. Existing files are never overwritten: re-running init on a cloned repo just re-registers.

const sanitizeName = (s) => String(s || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-");

// EOF (piped stdin, `init < /dev/null`, an agent's non-TTY run) accepts the default for every
// remaining question — otherwise a pending rl.question never resolves and the process silently
// exits with nothing scaffolded. Listeners are removed once a question settles, so a LONG-LIVED
// reader (the interactive REPL passes its own) doesn't accumulate them across init runs.
function makeAsk(rl) {
  let closed = false;
  const markClosed = () => {
    closed = true;
  };
  rl.once("close", markClosed);
  return (question, def) =>
    new Promise((resolve) => {
      if (closed) return resolve(String(def));
      let done = false;
      const onClose = () => settle(String(def));
      const settle = (v) => {
        if (done) return;
        done = true;
        rl.removeListener("close", onClose);
        resolve(v);
      };
      rl.once("close", onClose);
      rl.question(`  ${question} (${def}): `, (answer) => settle(answer.trim() || String(def)));
    });
}

// Write only if absent — a re-run must never clobber what the user or an agent wrote.
function writeIfMissing(file, content) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  return true;
}

const methodsTemplate = (folder) => `// ${folder}/methods/Tests.js — this file IS the \`Tests\` module.
//
// Every function exported here becomes a callable method with the full SystemView
// surface: probe, saved tests, documentation, \`:::run\` blocks in documents.
// Add a method by writing a function. Add a module by adding a file to this
// folder — the filename is the module name. Save, and the service updates live.
//
// Write functions that call YOUR system the way it really talks — HTTP, a spawned
// process, a database client — and return a result object for the engine to evaluate.

async function example({ name = "world" } = {}) {
  // Replace this body with a real check against your system.
  return { ok: true, greeting: \`Hello, \${name}!\` };
}

module.exports = { example };
`;

const savedTestTemplate = (serviceId) =>
  JSON.stringify(
    [
      {
        title: "The example method answers",
        namespace: { serviceId, moduleName: "Tests", methodName: "example" },
        Before: [],
        Main: [
          {
            title: "Say hello",
            namespace: { serviceId, moduleName: "Tests", methodName: "example" },
            args: [
              {
                name: "argument:",
                input: { name: "SystemView" },
                input_type: "object",
                data_type: "",
                targetValues: [],
              },
            ],
            savedEvaluations: [
              {
                namespace: "results.ok",
                expected_type: "boolean",
                validations: [{ name: "boolEquals", value: true }],
                save: true,
              },
              {
                namespace: "results.greeting",
                expected_type: "string",
                validations: [{ name: "strEquals", value: "Hello, SystemView!" }],
                save: true,
              },
            ],
          },
        ],
        Events: [],
        After: [],
      },
    ],
    null,
    2,
  );

const serviceDocTemplate = (serviceId, folder) => `# ${serviceId} — this project's testing service

Hosted by the SystemView hub from the committed \`${folder}/\` folder — no framework in this repo.
The folder is the service:

- **The configuration**: ::file[${folder}/service.json]
- **A file per module** — the filename is the module name, the exported object is the module:
  ::file[${folder}/methods/Tests.js]
- **Write a function, get a method** — save the file and it appears here, probe-able and testable.
- Saved tests live in \`${folder}/specs/tests/\`, docs like this one in \`${folder}/specs/docs/\`.

Try the scaffold's working example — runnable right here:

::test[Tests.example]

Or assemble a call on the fly. This is the markdown that writes one — a step is a method call,
the nested list under it is the assertions:

\`\`\`markdown
:::run{title="Call the example"}
- Tests.example({ "name": "world" })
  - results.ok = true
:::
\`\`\`

…and here is that same block live:

:::run{title="Call the example"}
- Tests.example({ "name": "world" })
  - results.ok = true
:::
`;

const methodDocTemplate = (folder) => `# Tests.example

The scaffold's teaching method — proof the hosted service works end to end.

\`\`\`js
Tests.example({ name }) // → { ok, greeting }
\`\`\`

It lives in :file[${folder}/methods/Tests.js#L11-14] — edit the function there, save, and this
method updates live. Replace the body with a real check against your system (HTTP, a spawned
process, a database client), return an object, and assert on it. The saved example:

::test[Tests.example]
`;

// `rl` is optional: the interactive REPL passes ITS OWN line reader (two readline interfaces on
// one stdin fight over lines — rl.question consumes answers before the REPL's line handler runs,
// which is exactly what we want). One-shot mode creates and closes its own.
module.exports = async function initProject({ uiUrl, Client, rl: sharedRl = null }) {
  const rl =
    sharedRl || readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = makeAsk(rl);
  console.log("\nSystemView init — enter accepts the default.\n");

  const projectCode = sanitizeName(await ask("Project name", "systemview")) || "systemview";
  const dir = path.resolve(process.cwd(), projectCode);
  const configPath = path.join(dir, "service.json");
  let existing = null;
  try {
    existing = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {}
  if (existing) log.info(`found existing ${projectCode}/service.json — its values are the defaults`);

  const serviceId = sanitizeName(await ask("Service name", (existing && existing.serviceId) || "Test")) || "Test";
  const portAnswer = await ask("Port, 0 = hub picks", (existing && existing.port) || 0);
  if (!sharedRl) rl.close();
  const port = Number(portAnswer) || 0;

  // The config — the reason the service exists. Written/updated to what was just answered.
  const config = { serviceId, port };
  if (!existing || existing.serviceId !== serviceId || (existing.port || 0) !== port) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  }

  // The teaching scaffold — example module + docs + one saved test, never overwriting.
  const wrote = [];
  if (writeIfMissing(path.join(dir, "methods", "Tests.js"), methodsTemplate(projectCode)))
    wrote.push(`${projectCode}/methods/Tests.js`);
  if (writeIfMissing(path.join(dir, "specs", "tests", "Tests.example.json"), savedTestTemplate(serviceId)))
    wrote.push(`${projectCode}/specs/tests/Tests.example.json`);
  if (writeIfMissing(path.join(dir, "specs", "docs", `${serviceId}.md`), serviceDocTemplate(serviceId, projectCode)))
    wrote.push(`${projectCode}/specs/docs/${serviceId}.md`);
  if (writeIfMissing(path.join(dir, "specs", "docs", "Tests.example.md"), methodDocTemplate(projectCode)))
    wrote.push(`${projectCode}/specs/docs/Tests.example.md`);

  // REGISTRATION — the manifest entry is how the hub finds the folder (discovery is by
  // registration, never by scanning for a name). The hosted plugin fills in the live system data
  // on first host, keeping the `hosted` pointer.
  const svDir = manifestDir();
  fs.mkdirSync(svDir, { recursive: true });
  const manifestPath = path.join(svDir, `${serviceId}.manifest.json`);
  let entry = null;
  try {
    entry = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {}
  if (!entry || entry.hosted !== projectCode || entry.projectCode !== projectCode) {
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ projectCode, serviceId, hosted: projectCode }, null, 2),
      "utf8",
    );
    wrote.push(`.systemview/${serviceId}.manifest.json`);
  }

  console.log("");
  log.success(`${projectCode}.${serviceId} configured`);
  console.log(`  config   → ${path.relative(process.cwd(), configPath)}`);
  console.log(`  methods  → ${projectCode}/methods/  (a file per module)`);
  console.log(`  specs    → ${projectCode}/specs/  (docs + saved tests)`);
  if (wrote.length) console.log(`  created  → ${wrote.join(", ")}`);

  // A running hub hosts it NOW; otherwise the hub hosts configured projects as part of its boot.
  const api = `${uiUrl}/systemview/api`;
  if (await appIsRunning(api)) {
    try {
      const { SystemView } = await Client.loadService(api);
      const r = await SystemView.hostProject({ projectDir: process.cwd(), folder: projectCode });
      log.success(`hosted @ ${r.serviceUrl} (${(r.modules || []).join(", ")})`);
    } catch (err) {
      log.warn(`hosting failed: ${(err && err.message) || err}`);
      return 1;
    }
  } else {
    console.log(`\n  Next: \`systemview\` opens the UI with it hosted, \`systemview test ${projectCode}\` runs the scaffolded test.`);
  }
  return 0;
};
