const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const Client = createClient(createCookieHttpClient());

// THE FILE LAYER, FROM THE CLI. Every verb that writes into a project's folder — reports (`show`),
// thread replies (`reply`), the board, skills — comes through here.
//
// IT USED TO HUNT FOR A LIVE SERVICE with a plugin that could write, which is how a project whose
// services were down could READ its whole codebase in the UI and not answer a thread in its own RFC.
// systemlynx reported it with the repro that makes it obvious — same command, testbed down: "no live
// service in systemlynx can write files"; start the testbed, works. Their case is the common one:
// a testbed is up only while you're testing.
//
// The UI moved to the hub today and the CLI did not, so half the app knew where the folder was and
// half still asked a process. The hub knows every project's folder from the registry and runs beside
// it; nothing here needs a service to be alive. The shape stays `Plugin.readFile/writeFile/...` so no
// caller changes — it is the same object the browser's `hostFiles` hands its callers.
module.exports = async function projectPlugin(uiUrl, projectCode) {
  const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
  const roots = await SystemView.projectRoots();
  if (!roots[projectCode]) {
    const known = Object.keys(roots).join(", ") || "(none)";
    throw new Error(`no folder known for "${projectCode}" — projects with folders: ${known}`);
  }
  const unwrap = (res, what) => {
    if (res && res.ok === false) throw new Error(res.error || `could not ${what}`);
    return res;
  };
  return {
    readFile: async ({ path }) => {
      const res = unwrap(await SystemView.readFile(projectCode, { path }), "read that file");
      return { path, content: res.content || "" };
    },
    writeFile: async ({ path, content }) =>
      unwrap(await SystemView.writeFile(projectCode, { path, content }), "write that file"),
    deleteFile: async ({ path }) => unwrap(await SystemView.deleteFile(projectCode, { path }), "delete that file"),
    listFiles: async ({ dir } = {}) => unwrap(await SystemView.listFiles(projectCode, { dir }), "list that folder"),
    changedFiles: async () => unwrap(await SystemView.changedFiles(projectCode, {}), "read git"),
    gitState: async () => unwrap(await SystemView.gitState(projectCode, {}), "read git"),
  };
};
