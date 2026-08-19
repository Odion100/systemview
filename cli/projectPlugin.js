const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const Client = createClient(createCookieHttpClient());

// RFC-040 — reach a project's OWN plugin from the CLI.
//
// Siblings share a working directory, so any live service of the project can read and write its
// files. `board` already did this inline; reports need the same thing, and two copies of a lookup
// that decides WHERE A FILE LANDS is exactly the kind of duplication that drifts into writing into
// the wrong repo.
module.exports = async function projectPlugin(uiUrl, projectCode) {
  const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
  const projects = await SystemView.getProjects();
  if (!projects[projectCode]) {
    const known = Object.keys(projects).join(", ") || "(none)";
    throw new Error(`no connected project "${projectCode}" — projects: ${known}`);
  }
  for (const s of projects[projectCode]) {
    try {
      const svc = await Client.loadService(s.connectionData.serviceUrl);
      if (svc.Plugin && svc.Plugin.writeFile) return svc.Plugin;
    } catch {} // down or plugin-less — try the next one
  }
  throw new Error(`no live service in ${projectCode} can write files`);
};
