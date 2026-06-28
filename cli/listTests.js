const fs = require("fs");
const path = require("path");
const { createCookieClient } = require("./cookieClient");
const log = require("./logger");
const chalk = require("chalk");

module.exports = async function listTests(url, project_code, namespace, { manifest: manifestPath, verbose = false } = {}) {
  const api = `${url}/systemview/api`;
  const Client = createCookieClient();

  if (!project_code) {
    await listAllProjects(api, Client, verbose);
    return;
  }

  const connectedServices = await loadServices(api, project_code, manifestPath, Client);
  if (!connectedServices.length) {
    log.warn("No connected services found for project: " + project_code);
    return;
  }

  console.log("");
  console.log(`  ${chalk.bold(project_code)}`);

  for (let si = 0; si < connectedServices.length; si++) {
    const { serviceId, system } = connectedServices[si];
    const isLastService = si === connectedServices.length - 1;
    const servicePrefix = isLastService ? "  └── " : "  ├── ";
    const childPad = isLastService ? "       " : "  │    ";

    let testList = [];
    try {
      const svc = createCookieClient().createService(system.connectionData);
      testList = await svc.Plugin.getTests();
    } catch {
      console.log(`${servicePrefix}${chalk.dim(serviceId)}  ${chalk.dim("(could not load tests)")}`);
      continue;
    }

    const filtered = namespace
      ? testList.filter(({ namespace: n }) =>
          `${n.serviceId}.${n.moduleName}.${n.methodName}`.includes(namespace)
        )
      : testList;

    if (!filtered.length) {
      console.log(`${servicePrefix}${chalk.dim(serviceId)}  ${chalk.dim("(no matching tests)")}`);
      continue;
    }

    const tree = {};
    filtered.forEach(({ namespace: n, title }) => {
      if (!tree[n.moduleName]) tree[n.moduleName] = {};
      if (verbose) {
        if (!tree[n.moduleName][n.methodName]) tree[n.moduleName][n.methodName] = [];
        tree[n.moduleName][n.methodName].push(title);
      } else {
        tree[n.moduleName][n.methodName] = (tree[n.moduleName][n.methodName] || 0) + 1;
      }
    });

    console.log(`${servicePrefix}${chalk.bold(serviceId)}`);

    const modules = Object.keys(tree);
    modules.forEach((moduleName, mi) => {
      const isLastModule = mi === modules.length - 1;
      const modPrefix = childPad + (isLastModule ? "└── " : "├── ");
      const modPad = childPad + (isLastModule ? "     " : "│    ");
      console.log(`${modPrefix}${moduleName}`);

      const methods = Object.keys(tree[moduleName]);
      methods.forEach((methodName, mei) => {
        const isLastMethod = mei === methods.length - 1;
        const methodPrefix = modPad + (isLastMethod ? "└── " : "├── ");
        const methodPad = modPad + (isLastMethod ? "     " : "│    ");
        if (verbose) {
          const titles = tree[moduleName][methodName];
          console.log(`${methodPrefix}${chalk.cyan(methodName)}`);
          titles.forEach((title, ti) => {
            const isLastTitle = ti === titles.length - 1;
            const titlePrefix = methodPad + (isLastTitle ? "└── " : "├── ");
            console.log(`${titlePrefix}${chalk.dim(title)}`);
          });
        } else {
          const count = tree[moduleName][methodName];
          const countStr = chalk.dim(`${count} ${count === 1 ? "test" : "tests"}`);
          console.log(`${methodPrefix}${chalk.cyan(methodName)}   ${countStr}`);
        }
      });
    });
  }

  console.log("");
};

async function listAllProjects(api, Client, verbose = false) {
  let projects;
  try {
    const { SystemView } = await Client.loadService(api);
    projects = await SystemView.getProjects();
  } catch {
    log.error("Could not connect to SystemView. Is it running?");
    return;
  }

  const codes = Object.keys(projects);
  if (!codes.length) {
    log.warn("No connected projects found.");
    return;
  }

  const total = codes.reduce((n, c) => n + projects[c].length, 0);
  console.log("");
  console.log(chalk.dim(`  ${codes.length} ${codes.length === 1 ? "project" : "projects"}, ${total} ${total === 1 ? "service" : "services"}`));
  console.log("");
  codes.forEach((projectCode, pi) => {
    console.log(`  ${chalk.bold(projectCode)}`);
    const services = projects[projectCode];
    services.forEach(({ serviceId, serviceUrl, connectionData }, si) => {
      const isLastService = si === services.length - 1;
      const servicePrefix = isLastService ? "  └── " : "  ├── ";
      const childPad = isLastService ? "       " : "  │    ";

      if (verbose && connectionData && connectionData.modules) {
        console.log(`${servicePrefix}${chalk.bold(serviceId)}   ${chalk.dim(serviceUrl)}`);
        const mods = connectionData.modules.filter((m) => m.name !== "Plugin");
        mods.forEach((mod, mi) => {
          const isLastMod = mi === mods.length - 1;
          const modPrefix = childPad + (isLastMod ? "└── " : "├── ");
          const modPad = childPad + (isLastMod ? "     " : "│    ");
          console.log(`${modPrefix}${mod.name}`);
          const methods = mod.methods || [];
          methods.forEach((m, mei) => {
            const isLastMethod = mei === methods.length - 1;
            const methodPrefix = modPad + (isLastMethod ? "└── " : "├── ");
            console.log(`${methodPrefix}${chalk.cyan(m.fn)}`);
          });
        });
      } else {
        console.log(`${servicePrefix}${serviceId}   ${chalk.dim(serviceUrl)}`);
      }
    });
    if (pi < codes.length - 1) console.log("");
  });
  console.log("");
}

async function loadServices(api, project_code, manifestPath, Client) {
  const manifestFile = manifestPath || path.join(process.cwd(), "systemview.manifest.json");
  if (fs.existsSync(manifestFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
      return raw.services ? raw.services : [raw];
    } catch {}
  }
  try {
    const { SystemView } = await Client.loadService(api);
    return (await SystemView.getServices(project_code)) || [];
  } catch {
    return [];
  }
}
