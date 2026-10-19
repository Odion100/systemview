// A STANDING TAB BRINGS ITS DOCUMENT BACK.
//
// The tab store persists ADDRESSES, never text — deliberately, because text belongs to its door.
// But a door-backed document (a skill, a job, an agent's prompt, a help page) therefore came back
// from a refresh as a tab with nothing in it: the pane could only say "reopen it from the profile",
// which is honest and still leaves him doing by hand what the address already describes (his card:
// *"a tab that survives refresh must bring its document back or honestly say why not"*).
//
// So this re-reads one from its own door. It is the ADDRESS → DOCUMENT resolver and nothing else:
// no React, no store, no fetching strategy — which is what makes it testable against a fake door
// bag, and what keeps the page's effect down to three lines.
//
// Returns the document (the same shape the profile builds when you click it), or null — and null is
// a real answer with three different causes, all of which the pane renders as its honest line:
// an older harness with no such door, a document that has since been deleted, and a tab stored
// before addresses carried enough to find it again.
export async function rehydrateDoc(adoc, doors = {}) {
  if (!adoc || !adoc.kind) return null;
  const { kind, agentId = "", name = "", where = "", key = "", jobId = "" } = adoc;
  const list = async (fn, ...args) => {
    if (typeof fn !== "function") return null;
    try {
      return await fn(...args);
    } catch {
      return null; // a door that throws is a door that cannot answer — same as absent
    }
  };

  if (kind === "def") {
    const rec = await list(doors.getDef, agentId);
    if (!rec) return null;
    // the def's PROMPT is the document here — the same one the profile opens as kind "def"
    return { kind: "def", agentId, label: adoc.label || "definition", text: rec.prompt || "", orig: rec.prompt || "" };
  }

  if (kind === "skill") {
    const all = await list(doors.listSkills, agentId);
    const hit = (all || []).find((s) => s && s.name === name && (!where || s.where === where));
    return hit && doors.skillDoc ? doors.skillDoc(agentId, hit) : null;
  }

  if (kind === "doc") {
    const all = await list(doors.listDocs, agentId);
    const hit = (all || []).find((d) => d && d.key === key);
    if (!hit) return null;
    return { kind: "doc", agentId, key: hit.key, label: hit.label, where: hit.where, text: hit.text, orig: hit.text };
  }

  if (kind === "help") {
    const all = await list(doors.listHelp);
    const hit = (all || []).find((h) => h && h.key === key);
    if (!hit) return null;
    return { kind: "help", key: hit.key, label: hit.label, where: hit.where, text: hit.text, orig: hit.text };
  }

  if (kind === "job") {
    const j = await list(doors.getJob, jobId);
    if (!j) return null;
    return {
      kind: "job",
      jobId: j.id,
      label: j.name && j.name !== j.id ? `${j.name} (${j.id})` : j.id,
      text: j.doc || "",
      orig: j.doc || "",
    };
  }

  return null;
}

export default rehydrateDoc;
