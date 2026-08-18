// WHICH SERVICE ANSWERS FOR THE FILES — and which one can do git.
//
// A project's services share a working directory, so any one of them with the plugin can read the
// tree. But a plugin is a VERSION: an older one reads files and lists changes and has never heard
// of staging. Picking "the first service with a Plugin module" therefore picks a reader that may be
// unable to stage, and the failure lands as `Plugin.stageFiles is not a function` at the moment you
// press the button — after the whole panel has drawn as if it worked.
//
// So the choice is made on CAPABILITY, not on order: prefer a sibling whose plugin actually carries
// version control, fall back to any plugin at all (reading still works, and the git surfaces say
// plainly that this project's plugin predates them).

export const pluginModule = (s) =>
  (((s || {}).system || {}).connectionData || {}).modules
    ? s.system.connectionData.modules.find((m) => m.name === "Plugin")
    : null;

export const pluginFns = (s) => {
  const mod = pluginModule(s);
  return mod ? (mod.methods || []).map((m) => m.fn) : [];
};

export const hasPlugin = (s) => !!pluginModule(s);

// The version-control set. `changedFiles` alone is NOT enough — the plugins that predate staging
// have it, which is exactly how a project can list its changes and then refuse to stage one.
const GIT_FNS = ["stageFiles", "commit", "gitState"];
export const canGit = (s) => {
  const fns = pluginFns(s);
  return GIT_FNS.every((f) => fns.includes(f));
};

// Pick a host out of candidates already narrowed to one project: the git-capable one first, then
// any plugin, then nothing.
export const pickHost = (candidates = []) => {
  const withPlugin = candidates.filter(hasPlugin);
  return withPlugin.find(canGit) || withPlugin[0] || null;
};
