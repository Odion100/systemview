import React, { useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import ServiceContext from "../../ServiceContext";
import PaneView from "./PaneView";
import { useStageAdd } from "./StageAdd";
import "./styles.scss";

// RFC-018 — the Stories TAB. A namespace can hold MANY named stories (like a method holds many tests),
// so this is NOT a single live stage: it lists the stories filed at (or under) the CURRENT namespace as
// named chips, you pick one to edit (the chip shows the selected story with an ✕ to step off it), and
// you build it up with the namespace-aware selector. Everything persists per-story via the API's story
// methods and rebroadcasts on `stories-updated:<projectCode>` so every open tab stays in sync.

const nsKeyOf = (projectCode, serviceId, moduleName, methodName) =>
  [projectCode, serviceId, moduleName, methodName].filter(Boolean).join("/");

// Grid is the composition model; `gallery` is only a way to VIEW the same grid — so `single`/`column` are
// gone (grid at 1-up already reads as a column).
const LAYOUTS = ["grid", "gallery"];

const Stage = ({ projectCode, serviceId, moduleName, methodName, onStageChange }) => {
  const { SystemViewService, connectedServices } = useContext(ServiceContext);
  const { SystemView } = SystemViewService || {};
  const nsKey = nsKeyOf(projectCode, serviceId, moduleName, methodName);

  const [stories, setStories] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const [headerOpen, setHeaderOpen] = useState(true); // the whole chips+selector header collapses for space
  // Gallery has two views (like grid has presets): "single" (one at a time) and "rail" (a big focused pane
  // + a scrollable rail of the rest you click to swap in). The big pane's width is resizable. Both persist.
  const [galleryView, setGalleryView] = useState(() => (localStorage.getItem("sv.galleryView") === "rail" ? "rail" : "single"));
  const [focusWidth, setFocusWidth] = useState(() => {
    const v = parseFloat(localStorage.getItem("sv.focusWidth"));
    return v >= 25 && v <= 85 ? v : 68;
  });
  useEffect(() => { localStorage.setItem("sv.galleryView", galleryView); }, [galleryView]);
  useEffect(() => { localStorage.setItem("sv.focusWidth", String(focusWidth)); }, [focusWidth]);

  // Load + live-subscribe every story in the project (we filter to this namespace below).
  const loadStories = useCallback(async () => {
    if (!SystemView || !projectCode) { setStories([]); return; }
    try { setStories((await SystemView.listStories(projectCode)) || []); }
    catch { setStories([]); }
  }, [SystemView, projectCode]);
  useEffect(() => { loadStories(); }, [loadStories]);
  useEffect(() => {
    if (!SystemView || !projectCode) return undefined;
    let unsub;
    try {
      unsub = SystemView.on(`stories-updated:${projectCode}`, (list) =>
        setStories(Array.isArray(list) ? list : []),
      );
    } catch { /* socket not ready */ }
    return () => { if (typeof unsub === "function") unsub(); };
  }, [SystemView, projectCode]);

  // Stories filed AT or UNDER this namespace — click a project and you get everything beneath it; a
  // method shows just its own. This is how a namespaced story is actually findable.
  const nsStories = useMemo(
    () => stories.filter((s) => s.namespace === nsKey || (s.namespace || "").startsWith(nsKey + "/")),
    [stories, nsKey],
  );
  const selected = useMemo(() => nsStories.find((s) => s.id === selectedId) || null, [nsStories, selectedId]);

  // If you navigate away, drop a selection that no longer belongs to this namespace.
  useEffect(() => {
    if (selectedId && !nsStories.some((s) => s.id === selectedId)) setSelectedId(null);
  }, [nsStories, selectedId]);

  // Tell Documentation how many stories live here (tab badge + auto-focus on the empty→non-empty jump).
  useEffect(() => { if (onStageChange) onStageChange(nsStories.length); }, [nsStories.length, onStageChange]);

  const createStory = useCallback(async () => {
    const name = newName.trim();
    if (!name || !SystemView) return;
    try {
      const story = await SystemView.createStory(projectCode, { namespace: nsKey, name });
      setNewName(""); setNaming(false);
      if (story && story.id) setSelectedId(story.id);
    } catch { /* ignore */ }
  }, [newName, SystemView, projectCode, nsKey]);

  const deleteStory = useCallback(async (id) => {
    try { await SystemView.deleteStory(projectCode, id); } catch { /* ignore */ }
    if (selectedId === id) setSelectedId(null);
  }, [SystemView, projectCode, selectedId]);

  // --- editing the SELECTED story's panes (persist per-story, rebroadcast) ---
  const addPane = useCallback((pane) => {
    if (!selected) return;
    try { SystemView.addStoryPane(projectCode, selected.id, pane); } catch { /* ignore */ }
  }, [SystemView, projectCode, selected]);
  const removePane = useCallback((paneId) => {
    if (!selected) return;
    try { SystemView.removeStoryPane(projectCode, selected.id, paneId); } catch { /* ignore */ }
  }, [SystemView, projectCode, selected]);
  const setSpan = useCallback((paneId, span) => {
    if (!selected) return;
    try { SystemView.setStoryPaneSpan(projectCode, selected.id, paneId, span); } catch { /* ignore */ }
  }, [SystemView, projectCode, selected]);
  const setLayout = useCallback((layout) => {
    if (!selected) return;
    try { SystemView.setStoryLayout(projectCode, selected.id, layout); } catch { /* ignore */ }
  }, [SystemView, projectCode, selected]);
  // Arrange the grid into N panes per row: give every pane an even width (100/N %) and drop custom heights
  // for a clean uniform grid. One saveStory call, so no per-pane read-modify-write race.
  const gridColumns = useCallback((n) => {
    if (!selected) return;
    const w = 100 / n;
    const clean = (selected.panes || []).map((p) => ({ ...p, span: { w } }));
    try { SystemView.saveStory(projectCode, { ...selected, layout: "grid", panes: clean }); } catch { /* ignore */ }
  }, [SystemView, projectCode, selected]);

  const draggedId = useRef(null);
  // Where the dragged pane will LAND: { id, side }. Drives the drop indicator (before/after which pane) and
  // drop inserts there — so reordering works in BOTH directions.
  const [dropTarget, setDropTarget] = useState(null);
  const onDragStartPane = useCallback((id) => { draggedId.current = id; }, []);
  const onDragOverPane = useCallback((id, side) => {
    if (!draggedId.current || draggedId.current === id) { setDropTarget(null); return; }
    setDropTarget((prev) => (prev && prev.id === id && prev.side === side ? prev : { id, side }));
  }, []);
  const onDragEndPane = useCallback(() => { draggedId.current = null; setDropTarget(null); }, []);
  const onDropPane = useCallback((targetId, side) => {
    const dragged = draggedId.current;
    draggedId.current = null;
    setDropTarget(null);
    if (!dragged || dragged === targetId || !selected) return;
    const ids = (selected.panes || []).map((p) => p.id);
    const from = ids.indexOf(dragged);
    if (from < 0) return;
    ids.splice(from, 1);
    const to = ids.indexOf(targetId);
    if (to < 0) ids.push(dragged);
    else ids.splice(side === "after" ? to + 1 : to, 0, dragged);
    try { SystemView.reorderStoryPanes(projectCode, selected.id, ids); } catch { /* ignore */ }
  }, [selected, SystemView, projectCode]);

  // Drag the divider between the big focused pane and the rail to make the big pane as wide as you want.
  // Drags the DOM live, commits the % on release (persisted via the focusWidth effect above).
  const startFocusResize = (e) => {
    e.preventDefault();
    const railWrap = e.currentTarget.closest(".stage--rail");
    const focusEl = railWrap && railWrap.querySelector(".stage__focus");
    const total = (railWrap && railWrap.clientWidth) || 1;
    const startX = e.clientX;
    const startW = focusEl ? focusEl.offsetWidth : total * 0.68;
    let pct = focusWidth;
    const onMove = (ev) => {
      pct = Math.max(25, Math.min(85, ((startW + (ev.clientX - startX)) / total) * 100));
      if (focusEl) focusEl.style.flexBasis = `${pct}%`;
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setFocusWidth(pct);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  // A short label for a rail item — enough to tell the panes apart when picking.
  const railLabel = (p) => {
    const t = p.target || {};
    if (p.kind === "markdown") return "note";
    if (p.kind === "test") return t.methodName || t.moduleName || t.serviceId || "tests";
    return String(t.path || t.method || p.kind).split("/").pop();
  };

  // onResize persists the pane's { w, h } size through the same setStoryPaneSpan path (span holds it).
  const paneProps = { projectCode, connectedServices, onResize: setSpan, onDragStartPane, onDragOverPane, onDragEndPane, onDropPane };

  // The selector: `bar` (compact kinds control) goes IN the chips row; `drill` (the big columns) gets
  // its OWN block below — so opening it never reflows or moves the chips row.
  const { bar: addBar, drill: addDrill } = useStageAdd({
    projectCode,
    connectedServices,
    SystemView,
    current: { serviceId, moduleName, methodName },
    onAdd: addPane,
  });

  // A story chip shows its name; when deeper than this namespace it also shows the sub-path so you know
  // where it's filed. The selected chip carries the ✕ to step OFF it (that never deletes the story).
  const chipLabel = (s) => {
    if (s.namespace === nsKey) return s.name;
    const sub = (s.namespace || "").slice(nsKey.length + 1);
    return `${s.name}  ·  ${sub}`;
  };

  const panes = selected ? selected.panes || [] : [];
  const rawLayout = selected ? (selected.layout || "grid") : "grid";
  const layout = rawLayout === "gallery" ? "gallery" : "grid"; // legacy single/column → grid
  const fi = Math.min(focusIndex, Math.max(0, panes.length - 1));

  return (
    <div className="stage-wrap">
      {/* The whole header (chips + selector) collapses so the story view can take the full space. */}
      {!headerOpen ? (
        <button type="button" className="stage-stories__title-toggle" onClick={() => setHeaderOpen(true)}>
          ▸ Stories · {selected ? selected.name : nsKey}
        </button>
      ) : (
      <>
      {/* Named story chips — the badge you wanted back. Pick one to edit; ✕ steps off it. */}
      <div className="stage-stories">
        {/* Same title style + full click target as the collapsed state — click it to fold. */}
        <button type="button" className="stage-stories__title-toggle" title="Collapse — reclaim the space" onClick={() => setHeaderOpen(false)}>
          ▾ Stories · {selected ? selected.name : nsKey}
        </button>
        {nsStories.map((s) => (
          <span key={s.id} className={`stage-story-chip ${selectedId === s.id ? "is-sel" : ""}`}>
            <button type="button" className="stage-story-chip__name" onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}>
              {chipLabel(s)}
            </button>
            {selectedId === s.id && (
              <button type="button" className="stage-story-chip__x" title="Step off this story (doesn't delete it)" onClick={() => setSelectedId(null)}>×</button>
            )}
            <button type="button" className="stage-story-chip__del" title="Delete this story" onClick={() => deleteStory(s.id)}>🗑</button>
          </span>
        ))}
        {naming ? (
          <span className="stage-stories__new">
            <input
              className="stage-stories__new-input"
              autoFocus
              placeholder="name this story…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createStory(); if (e.key === "Escape") { setNaming(false); setNewName(""); } }}
            />
            <button type="button" className="stage-stories__new-btn" onClick={createStory} disabled={!newName.trim()}>Create</button>
            <button type="button" className="stage-stories__new-cancel" onClick={() => { setNaming(false); setNewName(""); }}>×</button>
          </span>
        ) : (
          <button type="button" className="stage-stories__add" onClick={() => setNaming(true)}>＋ New story</button>
        )}
        {/* Just the compact kinds bar wraps into this row — the big drill is a separate block below. */}
        {selected && SystemView && addBar}
      </div>

      {/* The drill lives in its OWN block, only when a kind is picked — it never touches the chips row. */}
      {selected && SystemView && addDrill}
      </>
      )}

      {!selected ? (
        <div className="stage stage--empty">
          <p>{nsStories.length ? "Pick a story above to open it." : "No stories filed here yet."}</p>
          <p className="stage__hint">
            A namespace can hold many named stories — like a method holds many tests. Create one with
            <strong> ＋ New story</strong>, then pull in a method's source, a test at any level, a diff,
            a file, or a note. An agent can drive them too
            (<code>systemview story &lt;project&gt; "name" --ns {nsKey}</code>).
          </p>
        </div>
      ) : (
        <>
          <div className="stage__toolbar">
            <span className="stage__editing">Editing: <strong>{selected.name}</strong></span>
            {panes.length > 1 && (
              <div className="stage__controls">
                <div className="stage__layouts">
                  {LAYOUTS.map((l) => (
                    <button key={l} type="button" className={`stage__layout-btn ${layout === l ? "stage__layout-btn--active" : ""}`} onClick={() => setLayout(l)}>{l}</button>
                  ))}
                </div>
                {layout === "grid" && (
                  <div className="stage__cols" title="Arrange the grid — panes per row">
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} type="button" className="stage__col-btn" title={`${n} per row`} onClick={() => gridColumns(n)}>
                        <span className="stage__col-icon">
                          {Array.from({ length: n }).map((_, i) => <i key={i} />)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {layout === "gallery" && (
                  <div className="stage__cols" title="Gallery view">
                    <button type="button" className={`stage__col-btn ${galleryView === "single" ? "stage__col-btn--active" : ""}`} title="One at a time" onClick={() => setGalleryView("single")}>
                      <span className="stage__col-icon"><i style={{ width: "11px" }} /></span>
                    </button>
                    <button type="button" className={`stage__col-btn ${galleryView === "rail" ? "stage__col-btn--active" : ""}`} title="Big pane + rail" onClick={() => setGalleryView("rail")}>
                      <span className="stage__col-icon"><i style={{ width: "8px" }} /><i style={{ width: "3px" }} /></span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {panes.length && layout === "gallery" && galleryView === "rail" ? (
            // Filmstrip: a big focused pane + a scrollable rail of the rest. Click a rail item to swap it
            // into the big view; drag the divider to widen the big pane. Rail items are just for picking.
            <div className="stage stage--rail">
              <div className="stage__focus" style={{ flexBasis: `${focusWidth}%` }}>
                <PaneView key={panes[fi].id} pane={panes[fi]} {...paneProps} onRemove={() => removePane(panes[fi].id)} />
              </div>
              <div className="stage__focus-resize" title="Drag to resize the big pane" onMouseDown={startFocusResize} />
              <div className="stage__rail">
                {panes.map((p, i) => (
                  <div
                    key={p.id}
                    className={`stage__rail-item ${i === fi ? "is-sel" : ""}`}
                    onClick={() => setFocusIndex(i)}
                    title={railLabel(p)}
                  >
                    <div className="stage__rail-head">
                      <span className="stage__rail-kind">{p.kind === "markdown" ? "note" : p.kind}</span>
                      <span className="stage__rail-name">{railLabel(p)}</span>
                      {i === fi && <span className="stage__rail-badge">shown</span>}
                    </div>
                    <div className="stage__rail-preview">
                      <PaneView pane={p} projectCode={projectCode} connectedServices={connectedServices} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : panes.length && layout === "gallery" ? (
            <div className="stage stage--gallery">
              <div className="stage__gallery-nav">
                <button type="button" onClick={() => setFocusIndex(Math.max(0, fi - 1))} disabled={fi === 0}>‹</button>
                <span>{fi + 1} / {panes.length}</span>
                <button type="button" onClick={() => setFocusIndex(Math.min(panes.length - 1, fi + 1))} disabled={fi >= panes.length - 1}>›</button>
              </div>
              <PaneView key={panes[fi].id} pane={panes[fi]} {...paneProps} onRemove={() => removePane(panes[fi].id)} />
            </div>
          ) : panes.length ? (
            <div className="stage stage--grid">
              {panes.map((pane) => (
                <PaneView key={pane.id} pane={pane} {...paneProps} layout="grid" dropSide={dropTarget && dropTarget.id === pane.id ? dropTarget.side : null} onRemove={() => removePane(pane.id)} />
              ))}
              <div className="stage__buffer" />
            </div>
          ) : (
            <div className="stage stage--empty">
              <p>“{selected.name}” is empty.</p>
              <p className="stage__hint">Use the selector above to add a source, test, diff, file, or note.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Stage;
