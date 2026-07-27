// RFC-018 — the LIVE stage: an in-memory, per-project view description that the agent (or the user)
// drives in real time. Ephemeral by design — a persisted "saved view" is a separate thing (Views,
// Phase 3). It rehydrates on reconnect because the UI calls getStage() on mount and then subscribes
// to `stage-updated:<projectCode>`. The stage carries only TARGETS (locators) + inline prose, never
// file bytes — the UI fetches real bytes from each service's plugin at render time (UI vouches).
//
// A pane = { id, kind, target, highlight? }. kind ∈ markdown|file|source|diff|test|log|call|callout|
// checklist|link. target is whatever that kind needs to locate its content (a path, a namespace, a
// {module,method}, prose, …). layout ∈ single|grid|gallery|column|split.
module.exports = function Stage() {
  const stages = {}; // projectCode -> { layout, panes: [...] }
  let seq = 0;

  const blank = () => ({ layout: "single", panes: [] });
  const get = (projectCode) => (stages[projectCode] || (stages[projectCode] = blank()));
  const withId = (pane) => ({ id: `pane-${++seq}`, ...pane });

  this.get = get;

  // Replace the whole stage at once — the agent's primary verb ("assemble the relevant parts").
  // PINNED panes survive: the user pinned them to keep them across the agent's redraws (RFC-018 Phase 5).
  this.assemble = (projectCode, { panes = [], layout } = {}) => {
    const stage = get(projectCode);
    const pinned = stage.panes.filter((p) => p.pinned);
    stage.panes = [...pinned, ...panes.map(withId)];
    stage.layout = layout || (stage.panes.length > 1 ? "grid" : "single");
    return stage;
  };

  // Focus one exact thing (single layout).
  this.show = (projectCode, pane) => {
    const stage = get(projectCode);
    stage.panes = [withId(pane)];
    stage.layout = "single";
    return stage;
  };

  this.addPane = (projectCode, pane) => {
    const stage = get(projectCode);
    // New panes land at the TOP so you see what you just added (and aren't scrolled past it).
    stage.panes.unshift(withId(pane));
    if (stage.panes.length > 1 && stage.layout === "single") stage.layout = "grid";
    return stage;
  };

  this.removePane = (projectCode, paneId) => {
    const stage = get(projectCode);
    stage.panes = stage.panes.filter((p) => p.id !== paneId);
    return stage;
  };

  this.clear = (projectCode) => {
    stages[projectCode] = blank();
    return stages[projectCode];
  };

  this.setLayout = (projectCode, layout) => {
    const stage = get(projectCode);
    stage.layout = layout;
    return stage;
  };

  // Emphasize a region of a pane (a line range, a match) without losing the whole — same instinct as
  // RFC-011's log highlight. paneId omitted → apply to the only/last pane.
  this.highlight = (projectCode, paneId, highlight) => {
    const stage = get(projectCode);
    const pane = paneId
      ? stage.panes.find((p) => p.id === paneId)
      : stage.panes[stage.panes.length - 1];
    if (pane) pane.highlight = highlight;
    return stage;
  };

  // Phase 5 — pin a pane so it survives the agent's next assemble (an ephemeral pane doesn't). Pinning
  // also floats it to the TOP (you pinned it because it matters — keep it in view).
  this.pin = (projectCode, paneId, pinned) => {
    const stage = get(projectCode);
    const pane = stage.panes.find((p) => p.id === paneId);
    if (pane) {
      pane.pinned = !!pinned;
      if (pinned) {
        stage.panes = [pane, ...stage.panes.filter((p) => p.id !== paneId)];
      }
    }
    return stage;
  };

  // Per-pane WIDTH so panes mix in a row — "half" shares a row, "full" spans it. This is what lets a
  // window be laid out the way you want (two side by side, one full) instead of all-grid/all-single.
  this.setSpan = (projectCode, paneId, span) => {
    const stage = get(projectCode);
    const pane = stage.panes.find((p) => p.id === paneId);
    if (pane) pane.span = span; // "half" | "full"
    return stage;
  };

  // Reorder panes to match a given id order (drag-and-drop). Ids not present are appended (safety).
  this.reorder = (projectCode, ids) => {
    const stage = get(projectCode);
    const byId = new Map(stage.panes.map((p) => [p.id, p]));
    const next = (ids || []).map((id) => byId.get(id)).filter(Boolean);
    stage.panes.forEach((p) => { if (!next.includes(p)) next.push(p); });
    stage.panes = next;
    return stage;
  };

  // Phase 5 — the reverse channel (UI → agent). The user's current selection (a pane, a line range)
  // is stashed on the stage so the agent can read it ("why'd you write THAT?" already knows which that).
  this.setSelection = (projectCode, selection) => {
    const stage = get(projectCode);
    stage.selection = selection || null;
    return stage;
  };
  this.getSelection = (projectCode) => get(projectCode).selection || null;

  return this;
};
