// A PROJECT IS A NAME. Everything else attaches to it.
//
// His design, and it dissolved the problem I spent a whole session failing to solve. I had been
// treating where a project CAME FROM as what it IS — a plugin project or a host folder — which is
// why I kept producing two of everything and two registries to reconcile. There was never a second
// kind of project:
//
//   > *"you should be able to add a project. Boom, you give it a name. The project shows up —
//   > codebase, it shows services, code, terminal. Code is empty. There's a button there: pick a
//   > folder. … technically you could create a project code and show the services alone, or the
//   > code alone. Terminal wouldn't exist without a codebase, so it just shows the project code
//   > husk. Nothing there really, except it says add this and add that."*
//
// A HUSK is that project between being named and having anything in it. It lives here rather than
// in `connections.json` (which stores SERVICE connections — a husk has none) or in the shell's
// registry (which stores FOLDERS — a husk has none either). It is deliberately the flimsiest store
// in the app, because a husk is the most temporary thing in it: the moment a folder or a service
// attaches, the project is real and the husk is redundant and gets dropped.
const KEY = "sv.husks";

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((h) => h && h.projectCode) : [];
  } catch {
    return [];
  }
};

const write = (rows) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {}
};

export const listHusks = () => read();

// Newest first — a project you just named belongs at the TOP of the list, not scrolled off the
// bottom of eight others ("you don't need to swipe all the way down when you add a project").
export const addHusk = (projectCode) => {
  const code = String(projectCode || "").trim();
  if (!code) return null;
  const rows = read().filter((h) => h.projectCode !== code);
  const husk = { projectCode: code, ts: Date.now() };
  write([husk, ...rows]);
  return husk;
};

export const removeHusk = (projectCode) => {
  write(read().filter((h) => h.projectCode !== projectCode));
};

// A husk that has grown a folder or a service is not a husk any more. Reconciled on every load so
// the store cannot accumulate ghosts of projects that became real.
export const reconcileHusks = (realCodes = []) => {
  const real = new Set(realCodes);
  const rows = read();
  const kept = rows.filter((h) => !real.has(h.projectCode));
  if (kept.length !== rows.length) write(kept);
  return kept;
};

// The husk, wearing the shape the navigator renders. No services, no root — which is the whole
// point: the card draws its empty slots and offers to fill them.
export const huskEntry = (projectCode) => ({
  projectCode,
  serviceId: null,
  root: null,
  husk: true,
  system: { connectionData: { __husk: projectCode, serviceUrl: `husk://${projectCode}`, modules: [] } },
});
