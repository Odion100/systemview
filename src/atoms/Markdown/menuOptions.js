import { hostFiles } from "../../utils/hostFiles";
import loadServiceWithHeaders from "../../utils/loadService";
import { isSystemModule } from "../../systemModules";

// What the document menu's DRAWERS offer. Inserting `::logs` and getting every log in the project,
// or `:::run` with a `Module.method` that doesn't exist, is not inserting — it's leaving you a
// chore. A drawer asks the one question the block actually needs (which namespace? which file?
// which saved test?) and writes a block that WORKS on the first render.
//
// Everything here is read off the live connection tree or the project's plugin — never a guess.

const modulesOf = (s) => ((s.system && s.system.connectionData && s.system.connectionData.modules) || []);
const hasPlugin = (s) => modulesOf(s).some((m) => m.name === "Plugin");

// service.module.method for every connected method in the project, plus the coarser levels above it.
// Used by the logs / run / test drawers, which all want "point me at a namespace".
export function namespaceOptions(services, { methods = true } = {}) {
  const out = [];
  services.forEach((s) => {
    out.push({ label: s.serviceId, value: s.serviceId, kind: "service" });
    modulesOf(s).forEach((m) => {
      if (isSystemModule(m.name)) return;
      out.push({ label: `${s.serviceId}.${m.name}`, value: `${s.serviceId}.${m.name}`, kind: "module" });
      if (!methods) return;
      (m.methods || []).forEach((fn) => {
        const name = fn.fn || fn.name;
        if (!name) return;
        out.push({
          label: `${s.serviceId}.${m.name}.${name}`,
          value: `${s.serviceId}.${m.name}.${name}`,
          kind: "method",
        });
      });
    });
  });
  return out;
}

// The saved tests in a project, as `Module.method` — from each service's spec list, which the nav
// already keeps current, so no extra round trip.
export function testOptions(services) {
  const out = [];
  services.forEach((s) => {
    ((s.specList && s.specList.tests) || []).forEach((t) => {
      const ns = [t.moduleName, t.methodName].filter(Boolean).join(".");
      if (ns) out.push({ label: `${s.serviceId}.${ns}`, value: ns, kind: "test" });
    });
  });
  return out;
}

// Files, from the project's plugin. `changed` asks for only what differs from HEAD — the right list
// for a diff, and a short one for a file too, since what you're documenting is usually what you just
// touched. Falls back to the full listing when nothing has changed.
export async function fileOptions(services, { changed = false } = {}) {
  const host = services.find(hasPlugin);
  if (!host) return [];
  // Addressed by project, served by the hub — a row menu must not depend on a service being up.
  const Plugin = hostFiles(host.projectCode);
  const pick = (res) => (res && (res.files || res)) || [];
  try {
    if (changed) {
      const list = pick(await Plugin.changedFiles({}));
      if (list.length) return list.map((f) => ({ label: f.path || f, value: f.path || f, kind: "file" }));
      return [];
    }
    const list = pick(await Plugin.listFiles({}));
    return list.slice(0, 300).map((f) => ({ label: f.path || f, value: f.path || f, kind: "file" }));
  } catch {
    return [];
  }
}

// A picked value → the block that gets written. Kept beside the option lists so a new drawer is one
// entry, not a change in three files.
export const TEMPLATES = {
  // A limit rides along by default — an inserted log block should be a readable tail, not a wall.
  logs: (v) => (v ? `::logs[${v}]{limit=50}` : "::logs{limit=50}"),
  test: (v) => `::test[${v}]`,
  chart: (v) => `::chart{report=${v} range=1h}`,
  file: (v) => `::file[${v}]`,
  diff: (v) => `::diff[${v}]`,
  // A run block written against a REAL method, with the argument left for you to fill in. NO
  // placeholder assertion: a made-up `results.ok = true` would fail on the first run and teach you
  // to distrust the red. Add assertions as nested bullets when you know what you're checking.
  run: (v) => `:::run{title="${(v || "steps").split(".").pop()}"}\n- ${v}({ })\n:::`,
};
