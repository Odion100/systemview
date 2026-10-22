// RFC-072 §4 — AN OBJECTIVE IS A BLOCK, NOT A PARSED LINE, and this file is the half of that
// which has no React in it: what the states are, how an address is spelled, and what `needs`
// resolves to. Pure on purpose — nothing importing the markdown renderer can be reached from a
// test (react-markdown is ESM, CRA leaves node_modules untransformed), so a rule that lives
// beside the component is a rule nobody can prove.
//
// THE POINT OF THE WHOLE DESIGN, in one line: there is no issue record somewhere and a markdown
// file describing it. The block IS the record, the renderer is the only view, and the file is the
// only store. That is why this is cheap in a way it has no right to be — the vocabulary is the
// contract, the registry is its definition, and these claims are its schema.

// FOUR STATES AND NO MORE. `blocked` is written, never derived: an objective waiting on an
// unresolved `needs` is a different thing from one somebody has decided is stuck, and collapsing
// them would make the board lie in the direction of looking busy.
export const STATES = ["open", "doing", "done", "blocked"];

// Marking an objective done is a STEP SOMEBODY PERFORMS, not a thing a surface derives (RFC-072
// §7) — so pressing walks this ring and writes the result into the document. `blocked` is off the
// ring deliberately: it is a statement about the world, not the next step in a cycle, so it is
// set and cleared explicitly rather than arrived at by pressing twice.
const RING = ["open", "doing", "done"];

export const normalizeState = (raw) => {
  const s = String(raw || "").trim().toLowerCase();
  return STATES.includes(s) ? s : "open";
};

/** The next state a press produces. From `blocked`, a press means "unstick it" → open. */
export const nextState = (raw) => {
  const s = normalizeState(raw);
  if (s === "blocked") return "open";
  return RING[(RING.indexOf(s) + 1) % RING.length];
};

// AN ADDRESS IS `ARC-004-O2`, and across repos `autobot/ARC-002-O1`. It is "the one part of this
// that is still a format" (RFC-072 §4), so it gets a parser rather than a regex at each call site.
const ADDRESS = /^(?:([A-Za-z][\w.-]*)\/)?(ARC-\d+)-(O\d+)$/;

export const addressOf = (arcId, objectiveId, project = "") =>
  `${project ? `${project}/` : ""}${arcId}-${String(objectiveId).replace(/^O?/, "O")}`;

/** `{ project, arc, objective, address }`, or null when the string is not an address at all. */
export function parseAddress(raw) {
  const m = ADDRESS.exec(String(raw || "").trim());
  if (!m) return null;
  return { project: m[1] || "", arc: m[2], objective: m[3], address: m[0].trim() };
}

// A FENCED BLOCK IS A QUOTATION, NOT A DECLARATION. Found by using it: the first real arc document
// also EXPLAINED the vocabulary, so it carried a ```markdown example of an `::objective` — and this
// line scan counted the example. `::progress` read 8 where `::timeline` read 7. Blanked rather than
// removed, because a press writes back by LINE NUMBER and those have to stay true to the file.
const FENCED = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm;
const unfenced = (src) => String(src || "").replace(FENCED, (m) => m.replace(/[^\n]/g, ""));

const attrList = (raw) =>
  String(raw || "")
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);

// ── reading a document ──────────────────────────────────────────────────────────────────────────

// Deliberately a line scan rather than an AST walk: this has to answer for a document the user is
// typing into, and the renderer's own parse is not available to a pure module. The opener is
// matched at three-or-more colons because a block nests by GAINING them — an objective inside a
// thread opens deeper than the thread does.
// A CONTAINER opens at three-or-more colons and gains one per nesting level; a LEAF is two and
// never nests. `::objective` wraps the prose a person reads, so it is a container; `::arc` is one
// line at the top of the file saying which arc this is, so it is a leaf — the same shape as
// `::members`. Matching a leaf with the container rule is why both arc claims failed first time.
const CONTAINER = (name) => new RegExp(`^\\s*(:{3,})\\s*${name}\\{([^}]*)\\}\\s*$`);
const LEAF = (name) => new RegExp(`^\\s*(:{2})\\s*${name}\\{([^}]*)\\}\\s*$`);

const attrOf = (attrs, key) => {
  const m = new RegExp(`\\b${key}=("[^"]*"|[^\\s}]*)`).exec(attrs || "");
  return m ? m[1].replace(/^"|"$/g, "") : "";
};

/**
 * Every `::objective` in a document, in the order written, with the line it opens on so a press
 * knows where to write back.
 */
export function parseObjectives(source) {
  const lines = unfenced(source).split("\n");
  const re = CONTAINER("objective");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = re.exec(lines[i]);
    if (!m) continue;
    const attrs = m[2];
    const id = attrOf(attrs, "id");
    if (!id) continue; // an objective with no id cannot be addressed, so it is not one
    out.push({
      id,
      // THE NAME YOU CAN SCAN. `::arc` already carries a `title`, and an objective needs one for
      // the same reason: a list of seven whose only visible name is the first bold sentence of
      // their prose cannot be read down. Optional — an objective with no title still addresses.
      title: attrOf(attrs, "title"),
      owner: attrOf(attrs, "owner"),
      state: normalizeState(attrOf(attrs, "state")),
      // WHY IT IS BLOCKED. `blocked` is the one state that is WRITTEN rather than derived, on the
      // grounds that it is a statement about the world — and a statement with no content is not
      // one. Nothing required a reason, so an objective could read `blocked` and leave the next
      // reader with no way to find out what is holding it, which is exactly what happened the
      // first time this vocabulary met a real document.
      because: attrOf(attrs, "blocked"),
      needs: attrList(attrOf(attrs, "needs")),
      line: i + 1, // 1-indexed, the way setAttr counts
    });
  }
  return out;
}

/** The `::arc` block that makes a document self-describing, or null. */
export function parseArc(source) {
  const lines = unfenced(source).split("\n");
  const re = LEAF("arc");
  for (let i = 0; i < lines.length; i += 1) {
    const m = re.exec(lines[i]);
    if (!m) continue;
    const id = attrOf(m[2], "id");
    if (!id) continue;
    return { id, owner: attrOf(m[2], "owner"), title: attrOf(m[2], "title"), line: i + 1 };
  }
  return null;
}

// ── what `needs` points at ──────────────────────────────────────────────────────────────────────

/**
 * Resolve ONE address against the objectives of the document holding it.
 *
 * THE RULE THAT MATTERS, and it is the RFC's: an address that does not resolve must SAY so rather
 * than read as "no dependency". Silence here is the dangerous answer — a dependency that quietly
 * evaporates lets work start in the wrong order, and the one measured consequence of wrong order
 * in this system is a half-armed feature that reads as BROKEN rather than pending.
 *
 * Four honest outcomes, never three:
 *   { status: "met" }        the objective it names is done
 *   { status: "waiting" }    it exists and is not done yet
 *   { status: "elsewhere" }  it is in another project — this document cannot know, and says so
 *   { status: "unresolved" } nothing here answers to that address, or it is not an address at all
 */
export function resolveNeed(raw, { objectives = [], arc = null } = {}) {
  const addr = parseAddress(raw);
  if (!addr) return { status: "unresolved", address: String(raw || "").trim(), why: "not an address" };
  if (addr.project) return { status: "elsewhere", ...addr };
  // An address naming a different arc cannot be checked from inside this document either.
  if (arc && arc.id && addr.arc !== arc.id) return { status: "elsewhere", ...addr };
  const hit = objectives.find((o) => o.id === addr.objective);
  if (!hit) return { status: "unresolved", ...addr, why: "no objective here answers to it" };
  return { status: hit.state === "done" ? "met" : "waiting", ...addr, state: hit.state };
}

/** Every need of one objective, resolved. */
export const resolveNeeds = (objective, ctx) =>
  (objective && objective.needs ? objective.needs : []).map((n) => resolveNeed(n, ctx));

/**
 * CAN THIS BE STARTED? Only when every dependency is met. An `unresolved` or `elsewhere` need is
 * NOT treated as met — we cannot see it, and guessing in the permissive direction is how a
 * cross-repo pair gets pressed in the wrong order.
 */
export const isBlockedByNeeds = (objective, ctx) =>
  resolveNeeds(objective, ctx).some((r) => r.status !== "met");

/** What a document says about itself: how many objectives, and how many are done. */
export function arcProgress(source) {
  const objectives = parseObjectives(source);
  const done = objectives.filter((o) => o.state === "done").length;
  return { total: objectives.length, done, objectives, arc: parseArc(source) };
}

const objectives = {
  STATES,
  normalizeState,
  nextState,
  addressOf,
  parseAddress,
  parseObjectives,
  parseArc,
  resolveNeed,
  resolveNeeds,
  isBlockedByNeeds,
  arcProgress,
  progressOf,
  timelineOf,
};
export default objectives;

// ── RFC-072 §5 — WHAT A DOCUMENT CAN SAY ABOUT ITSELF ───────────────────────────────────────────
//
// `::progress` and `::timeline` are "a map over structured data" rather than prose parsing, which
// is exactly why the claims go on the DERIVATION and not on the render: the counting and the
// ordering are where this can be wrong, and the pixels are eyes-only on any day.

/**
 * HOW MANY ARE DONE, AND BY WHOM. Progress is objectives complete — there is no milestone to roll
 * up and no percentage of a half-finished objective, because an objective that is partly done is
 * two objectives nobody has split yet.
 */
export function progressOf(source) {
  const objectives = parseObjectives(source);
  const count = (s) => objectives.filter((o) => o.state === s).length;
  const owners = new Map();
  objectives.forEach((o) => {
    // An objective with no owner is not "unowned, therefore nobody's problem" — it is a real row
    // under a name that says it needs one, because the alternative is work that no listing shows.
    const key = o.owner || "unowned";
    const row = owners.get(key) || { owner: key, total: 0, done: 0 };
    row.total += 1;
    if (o.state === "done") row.done += 1;
    owners.set(key, row);
  });
  return {
    total: objectives.length,
    done: count("done"),
    doing: count("doing"),
    open: count("open"),
    blocked: count("blocked"),
    // Stable order: most work first, then alphabetical, so the list does not reshuffle on a press.
    byOwner: [...owners.values()].sort((a, b) => b.total - a.total || a.owner.localeCompare(b.owner)),
    objectives,
  };
}

/**
 * THE OBJECTIVES IN DEPENDENCY ORDER, so what is blocked on what is visible.
 *
 * Three things this has to survive, and each one is a claim:
 *
 *   A CYCLE. O1 needs O2 and O2 needs O1 is a thing a person will write, and a naive topological
 *   sort either loops forever or silently drops both. Dropping is the worst outcome available —
 *   an objective that vanishes from the timeline reads as "no such work". So anything left when
 *   the sort stalls is emitted in document order and flagged `cycle: true`, which is a visible
 *   problem rather than an absence.
 *
 *   A NEED IT CANNOT SEE. `elsewhere` and `unresolved` can never become "met" from inside this
 *   document, so waiting for them would park those objectives at the end forever. They do not
 *   hold up the ORDER — they ride on the objective as `blockedBy`, where a surface can say so.
 *
 *   NOTHING AT ALL. An empty document gives an empty timeline, not a throw.
 */
export function timelineOf(source) {
  const objectives = parseObjectives(source);
  const arc = parseArc(source);
  const ctx = { objectives, arc };
  const byId = new Map(objectives.map((o) => [o.id, o]));

  // Only a need that resolves INSIDE this document can order anything. Everything else is carried
  // as a flag rather than as an edge, because an edge to a node we do not have is not an edge.
  const edges = new Map();
  const flags = new Map();
  objectives.forEach((o) => {
    const resolved = resolveNeeds(o, ctx);
    edges.set(
      o.id,
      resolved.filter((r) => r.status === "met" || r.status === "waiting").map((r) => r.objective).filter((id) => byId.has(id))
    );
    flags.set(o.id, resolved);
  });

  const out = [];
  const placed = new Set();
  const sweep = () => {
    let moved = false;
    for (const o of objectives) {
      if (placed.has(o.id)) continue;
      if (edges.get(o.id).every((d) => placed.has(d))) {
        placed.add(o.id);
        out.push({ ...o, blockedBy: flags.get(o.id), cycle: false });
        moved = true;
      }
    }
    return moved;
  };
  // Repeated sweeps rather than recursion: the graph is a handful of nodes and a stack that can
  // overflow on a cycle is the failure this is supposed to be immune to.
  while (sweep());
  // Whatever is left is in a cycle. Emitted, never dropped.
  objectives.forEach((o) => {
    if (placed.has(o.id)) return;
    out.push({ ...o, blockedBy: flags.get(o.id), cycle: true });
  });
  return out;
}
