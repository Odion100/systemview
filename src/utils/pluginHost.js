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
  // THE HOST SERVES FILES. THE PLUGIN SERVES DOCUMENTATION AND TESTS. One rule, no preference —
  // his correction, and it was the right one to make: *"what do you mean prefer the host? There's
  // one method. Where's the preference coming from?"* A preference is two answers wearing one
  // name, and this app has been burned by that shape all day (two meters on one bar, two meanings
  // on one chip). So there is exactly one file provider: the folder the shell knows.
  //
  // No folder ⇒ no codebase. That is not a failure, it is the husk the project already shows
  // ("no folder yet — choose a folder"). It replaces the old fallback, where a project with
  // services read its own source back over HTTP through the plugin — which is why a dead test
  // service could blank the code panel and flood the console with retries.
  return (
    candidates.find(
      (s) => s && s.system && s.system.connectionData && s.system.connectionData.__hostFiles,
    ) || null
  );
};
