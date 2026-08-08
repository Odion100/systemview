import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import loadServiceWithHeaders from "../../utils/loadService";
import DocIcon from "../../atoms/DocsIcon/DocsIcon";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";
import HELP_TOPICS from "../../atoms/Help/helpTopics";
import { setHelpTopic } from "../../atoms/Help/helpStore";
import "./styles.scss";

// RFC-022 — the CODEBASE navigation (the "Codebase" nav tab). Designed fresh for files, NOT a copy of
// the service nav: monospace tree, chevrons, indent guides, a filter that flips to flat search results,
// git-changed dots. The ROOTS are connected codebases — one per project whose services share a cwd —
// each carrying its FILE SYSTEM (via the RFC-018 plugin file providers) and its PROJECT-DEFINED
// services (RFC-021 synthesized namespaces; empty on a fresh project — that's the bootstrap state).

const CLASSNAME = "codebase-nav";

// Build a nested tree from the flat path list listFiles returns: { dirs: {name: node}, files: [{name, path, language}] }
function buildTree(files) {
  const rootNode = { dirs: {}, files: [] };
  files.forEach((f) => {
    const parts = f.path.split("/");
    const name = parts.pop();
    let node = rootNode;
    for (const seg of parts) {
      if (!node.dirs[seg]) node.dirs[seg] = { dirs: {}, files: [] };
      node = node.dirs[seg];
    }
    node.files.push({ name, path: f.path, language: f.language });
  });
  return rootNode;
}

const Chevron = ({ open }) => (
  <span className={`${CLASSNAME}__chevron`}>{open ? "▾" : "▸"}</span>
);

// Namespace pushes CARRY the current `?tab=` (same contract as the SystemLynx Link atom) — browsing
// namespaces while on Reports/Logs/Stories must not snap you back to Documentation. Everything else
// in the search (help, file params) is deliberately dropped: navigating retires those.
const withTab = (path) => {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab ? { pathname: path, search: `?tab=${tab}` } : path;
};

function DirNode({
  name,
  node,
  depth,
  prefix,
  openDirs,
  toggleDir,
  renderFile,
  changedCounts,
}) {
  const key = `${prefix}${name}`;
  const open = openDirs.has(key);
  const dirNames = Object.keys(node.dirs).sort();
  // Collapsed folders wear the count of changed files inside — the amber signal survives collapse.
  const changedInside = (changedCounts && changedCounts[key]) || 0;
  return (
    <div className={`${CLASSNAME}__dir`}>
      <button
        type="button"
        className={`${CLASSNAME}__row ${CLASSNAME}__row--dir`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => toggleDir(key)}
      >
        <Chevron open={open} />
        <span className={`${CLASSNAME}__dir-name`}>{name}</span>
        {!open && changedInside > 0 && (
          <span
            className={`${CLASSNAME}__dir-badge`}
            title={`${changedInside} changed file${changedInside > 1 ? "s" : ""} inside`}
          >
            {changedInside}
          </span>
        )}
      </button>
      {open && (
        <div className={`${CLASSNAME}__children`}>
          {dirNames.map((d) => (
            <DirNode
              key={d}
              name={d}
              node={node.dirs[d]}
              depth={depth + 1}
              prefix={`${key}/`}
              openDirs={openDirs}
              toggleDir={toggleDir}
              renderFile={renderFile}
              changedCounts={changedCounts}
            />
          ))}
          {node.files.map((f) => renderFile(f, depth + 1))}
        </div>
      )}
    </div>
  );
}

// RFC-027 — the row context menu: right-click is where connections get removed (any service, any
// project — the old tree tab's delete buttons live here now) and where a HOSTED service is
// configured (rename/add/delete modules, delete the project). Destructive items are TWO-STEP: the
// item arms into an inline confirm — no browser dialogs. One menu instance at the nav root.
function RowMenu({ menu, onClose }) {
  const [armed, setArmed] = useState(null);
  useEffect(() => setArmed(null), [menu]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, onClose]);
  if (!menu) return null;
  return (
    <>
      <div
        className={`${CLASSNAME}__menu-overlay`}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div className={`${CLASSNAME}__menu`} style={{ top: menu.y, left: menu.x }}>
        <div className={`${CLASSNAME}__menu-head`}>{menu.title}</div>
        {menu.items.map((it, i) =>
          it.confirm && armed === i ? (
            <div key={i} className={`${CLASSNAME}__menu-confirm`}>
              <span className={`${CLASSNAME}__menu-confirm-text`}>{it.confirm}</span>
              <span
                className={`${CLASSNAME}__menu-yes`}
                role="button"
                onClick={() => {
                  onClose();
                  it.action();
                }}
              >
                ✓
              </span>
              <span
                className={`${CLASSNAME}__menu-no`}
                role="button"
                onClick={() => setArmed(null)}
              >
                ✕
              </span>
            </div>
          ) : (
            <button
              key={i}
              type="button"
              className={`${CLASSNAME}__menu-item${it.danger ? ` ${CLASSNAME}__menu-item--danger` : ""}`}
              onClick={() => {
                if (it.confirm) setArmed(i);
                else {
                  onClose();
                  it.action();
                }
              }}
            >
              {it.label}
            </button>
          ),
        )}
      </div>
    </>
  );
}

// One of the project's services — real OR project-defined — as a MINI SystemLynx tree living under
// its codebase (RFC-026: this card is the whole nav, so real services render here too, same rows).
// Fully navigable like the SystemLynx section: service/module/method all select + route, the current
// namespace highlights, and navigating hands the center back to docs/tests (closes any open file).
// Modules expand INDIVIDUALLY — a service with many modules must not dump every method on open.
function ServiceNode({ service, projectCode, history, selection, onNavigate, revealNs, serviceStatus = {}, bulk = null, onOpenFile = null, onHostedOp = null, onDeleteService = null, openRowMenu = null }) {
  const isSelectedService =
    selection.serviceId === service.serviceId && selection.projectCode === projectCode;
  // Pointed at from a document (`:ns[…]` reveal) — expand down to the target, mark it, select nothing.
  const isRevealedService = !!revealNs && revealNs.serviceId === service.serviceId;
  const [open, setOpen] = useState(isSelectedService);
  const [openMods, setOpenMods] = useState(() => new Set());
  useEffect(() => {
    if (isRevealedService) setOpen(true);
  }, [isRevealedService]);
  // The card head's bulk fold: collapse closes this service AND its modules; expand reopens the
  // service (modules stay closed — the point is the map, not every method).
  useEffect(() => {
    if (!bulk) return;
    if (bulk.mode === "collapse") {
      setOpen(false);
      setOpenMods(new Set());
    } else setOpen(true);
  }, [bulk]);
  const modules = ((service.system || {}).connectionData || {}).modules || [];
  const svcUrl = ((service.system || {}).connectionData || {}).serviceUrl || "";
  const go = (path) => {
    onNavigate(); // close the open code file — namespace navigation shows the namespace center
    history.push(withTab(path));
  };
  const toggleMod = (name) =>
    setOpenMods((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  // Bring the pointed-at (or newly selected) row into view — a reveal that lands off-screen reads
  // as "nothing happened". Once per target, and only when the row isn't already visible.
  const scrolledKey = useRef(null);
  const scrollTo = (key) => (el) => {
    if (!el || scrolledKey.current === key) return;
    scrolledKey.current = key;
    const sc = el.closest(".system-nav__body");
    if (!sc) return;
    const r = el.getBoundingClientRect();
    const b = sc.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) el.scrollIntoView({ block: "center" });
  };
  // SELECTED beats REVEALED on any row wearing both — being somewhere outranks being pointed at.
  const svcSelected = isSelectedService && !selection.moduleName;
  const svcRevealed = isRevealedService && !revealNs.moduleName && !svcSelected;
  // RFC-027 — a CLI-HOSTED service: same rows as any service (plum dot is the only visual
  // difference), plus the configuration hand — rename the service, add/delete/rename modules —
  // each a file op on the committed folder the hub re-hosts from.
  const hosted = service.hosted || null;
  const canConfigure = !!hosted && !!onHostedOp;
  const runOp = async (op, payload) => {
    const err = await onHostedOp(projectCode, op, payload);
    if (err) window.alert(err);
  };
  const addModule = () => {
    const name = window.prompt("New module name (a namespace for tests):");
    if (name && name.trim()) runOp("addModule", { name: name.trim() });
  };
  const renameService = () => {
    const to = window.prompt("Rename service:", service.serviceId);
    if (to && to.trim() && to.trim() !== service.serviceId)
      runOp("renameService", { to: to.trim() });
  };
  const renameModule = (name) => {
    const to = window.prompt(`Rename module ${name}:`, name);
    if (to && to.trim() && to.trim() !== name) runOp("renameModule", { name, to: to.trim() });
  };
  // Right-click on the service row: remove the connection (ANY service — the old delete button's
  // job) plus the hosted configuration set. Deletes two-step INSIDE the menu, never a dialog.
  const serviceMenu = (e) => {
    if (!openRowMenu) return;
    const items = [];
    if (canConfigure) {
      items.push({ label: "Rename service…", action: renameService });
      items.push({ label: "Add module…", action: addModule });
    }
    // ONE remove option per kind: a connected service gets "Remove connection"; a project made on
    // the fly gets DELETE (the folder and all) — no keep-folder middle ground in the menu
    // (`systemview disconnect` still exists on the CLI for that).
    if (onDeleteService && !hosted)
      items.push({
        label: "Remove connection",
        danger: true,
        confirm: `Remove ${service.serviceId}?`,
        action: () => onDeleteService(projectCode, service.serviceId),
      });
    if (canConfigure)
      items.push({
        label: `Delete project (removes ${hosted}/)`,
        danger: true,
        confirm: `Delete ${hosted}/ — folder, methods, specs?`,
        action: () => runOp("deleteProject", {}),
      });
    if (items.length) openRowMenu(e, `${projectCode} › ${service.serviceId}`, items);
  };
  const moduleMenu = (e, name) => {
    if (!openRowMenu || !canConfigure) return;
    openRowMenu(e, `${service.serviceId} › ${name}`, [
      { label: "Rename module…", action: () => renameModule(name) },
      {
        label: "Delete module",
        danger: true,
        confirm: `Delete ${hosted}/methods/${name}.js? specs stay`,
        action: () => runOp("deleteModule", { name }),
      },
    ]);
  };
  return (
    <div className={`${CLASSNAME}__dyn-service`}>
      <button
        type="button"
        ref={
          svcRevealed
            ? scrollTo(`r:${service.serviceId}`)
            : svcSelected
            ? scrollTo(`s:${service.serviceId}`)
            : undefined
        }
        className={`${CLASSNAME}__service ${svcSelected ? `${CLASSNAME}__service--selected` : ""}${svcRevealed ? ` ${CLASSNAME}__row--revealed` : ""}`}
        title={`Open ${service.serviceId} (SystemLynx namespace surface) — right-click for options`}
        onClick={() => {
          setOpen(true);
          go(`/specs/${projectCode}/${service.serviceId}`);
        }}
        onContextMenu={serviceMenu}
      >
        <span
          className={`${CLASSNAME}__dyn-caret`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <Chevron open={open} />
        </span>
        {/* Real services wear their LIVE/DOWN probe status (same colors as the SystemLynx tab);
            project-defined ones keep the plum — a project:// identifier can't be probed. A HOSTED
            service (RFC-027) wears plum too: it's live, but the plum says "the CLI runs this". */}
        <span
          className={`${CLASSNAME}__service-dot${hosted || service.dynamic ? "" : ` ${CLASSNAME}__service-dot--${serviceStatus[svcUrl] || "unknown"}`}`}
          title={
            hosted
              ? `CLI-hosted from ${hosted}/ — ${serviceStatus[svcUrl] || "live"}`
              : service.dynamic
              ? "project-defined"
              : `service ${serviceStatus[svcUrl] || "unknown"}`
          }
        />
        {service.serviceId}
        {/* A span with its own click, not an <a> — the row is a <button> and nesting anchors in
            buttons is invalid. project:// identifiers aren't addresses, so they stay inert. */}
        <span
          className={`${CLASSNAME}__svc-url${/^https?:\/\//.test(svcUrl) ? ` ${CLASSNAME}__svc-url--live` : ""}`}
          title={/^https?:\/\//.test(svcUrl) ? `${svcUrl} — open in a new tab` : svcUrl || undefined}
          onClick={(e) => {
            if (!/^https?:\/\//.test(svcUrl)) return;
            e.stopPropagation();
            window.open(svcUrl, "_blank", "noopener");
          }}
        >
          {svcUrl}
        </span>
        <span className={`${CLASSNAME}__dyn-icons`}>
          <DocIcon
            isSaved={(((service.specList || {}).docs) || []).includes(`${service.serviceId}.md`)}
          />
        </span>
      </button>
      {/* RFC-027 §4 — WHERE the hosted service lives, in the same quiet register as the service
          URL: the config is one click away, the folder paths are simply stated. Never a hunt. */}
      {hosted && open && (
        <button
          type="button"
          className={`${CLASSNAME}__hosted-paths`}
          title={`Open ${hosted}/service.json`}
          onClick={() =>
            onOpenFile &&
            onOpenFile({
              projectCode,
              serviceId: service.serviceId,
              path: `${hosted}/service.json`,
              language: "json",
            })
          }
        >
          ⚙ {hosted}/service.json <span className={`${CLASSNAME}__hosted-dirs`}>· methods/ · specs/</span>
        </button>
      )}
      {open && (
        <div className={`${CLASSNAME}__dyn-modules`}>
          {modules.map((m) => {
            const isSelectedModule = isSelectedService && selection.moduleName === m.name;
            const isRevealedModule = isRevealedService && revealNs.moduleName === m.name;
            // Selection and reveal force a module open — arriving anywhere inside it must show it.
            const modOpen = openMods.has(m.name) || isSelectedModule || isRevealedModule;
            const specList = service.specList || { tests: [], docs: [] };
            const modSelected = isSelectedModule && !selection.methodName;
            const modRevealed = isRevealedModule && !revealNs.methodName && !modSelected;
            // The plugin's OWN modules (SystemView logs, Plugin providers) ride every service —
            // they're SystemView's infrastructure, not the service's surface, and they read as such.
            const isSvModule = ["Plugin", "SystemView"].includes(m.name);
            return (
              <div key={m.name}>
                <button
                  type="button"
                  ref={
                    modRevealed
                      ? scrollTo(`r:${service.serviceId}.${m.name}`)
                      : modSelected
                      ? scrollTo(`s:${service.serviceId}.${m.name}`)
                      : undefined
                  }
                  className={`${CLASSNAME}__dyn-module ${modSelected ? `${CLASSNAME}__dyn-module--selected` : ""}${modRevealed ? ` ${CLASSNAME}__row--revealed` : ""}${isSvModule ? ` ${CLASSNAME}__dyn-module--sv` : ""}`}
                  onClick={() => {
                    if (!modOpen) toggleMod(m.name);
                    go(`/specs/${projectCode}/${service.serviceId}/${m.name}`);
                  }}
                  onContextMenu={!isSvModule ? (e) => moduleMenu(e, m.name) : undefined}
                >
                  <span
                    className={`${CLASSNAME}__dyn-caret`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMod(m.name);
                    }}
                  >
                    <Chevron open={modOpen} />
                  </span>
                  {m.name}
                  {isSvModule && <span className={`${CLASSNAME}__sv-tag`}>systemview</span>}
                  <span className={`${CLASSNAME}__dyn-icons`}>
                    <DocIcon isSaved={(specList.docs || []).includes(`${m.name}.md`)} />
                  </span>
                </button>
                {modOpen &&
                  (m.methods || []).map((fn) => {
                    const fnSelected = isSelectedModule && selection.methodName === fn.fn;
                    const fnRevealed =
                      isRevealedModule && revealNs.methodName === fn.fn && !fnSelected;
                    return (
                    <button
                      key={fn.fn}
                      type="button"
                      ref={
                        fnRevealed
                          ? scrollTo(`r:${service.serviceId}.${m.name}.${fn.fn}`)
                          : fnSelected
                          ? scrollTo(`s:${service.serviceId}.${m.name}.${fn.fn}`)
                          : undefined
                      }
                      className={`${CLASSNAME}__dyn-method ${fnSelected ? `${CLASSNAME}__dyn-method--selected` : ""}${fnRevealed ? ` ${CLASSNAME}__row--revealed` : ""}`}
                      title={`${service.serviceId}.${m.name}.${fn.fn} — docs, tests, and the scratchpad`}
                      onClick={() =>
                        go(`/specs/${projectCode}/${service.serviceId}/${m.name}/${fn.fn}`)
                      }
                    >
                      {fn.fn}
                      <span className={`${CLASSNAME}__dyn-paren`}>()</span>
                      {/* Same saved-doc / saved-test indicators the SystemLynx tab wears — this IS a
                        mini SystemLynx tree, just owned by the codebase. */}
                      <span className={`${CLASSNAME}__dyn-icons`}>
                        <DocIcon
                          isSaved={(specList.docs || []).includes(`${m.name}.${fn.fn}.md`)}
                        />
                        <TestsIcon
                          isSaved={(specList.tests || []).includes(
                            `${m.name}.${fn.fn}.json`,
                          )}
                        />
                      </span>
                    </button>
                    );
                  })}
              </div>
            );
          })}
          {!modules.length && (
            <div className={`${CLASSNAME}__empty`}>no modules defined</div>
          )}
        </div>
      )}
    </div>
  );
}

// One connected codebase: header, ALL the project's services (real + project-defined), and the file
// tree behind its own fold.
function Codebase({ entry, isCurrent, openFile, onOpenFile, selection, onNavigate, revealFile = null, revealNs = null, serviceStatus = {}, onHostedOp = null, onDeleteService = null, onDeleteProject = null, openRowMenu = null }) {
  const { projectCode, fileHost, services, dynamicServices } = entry;
  const history = useHistory();
  // Reveals scoped to THIS card. A file reveal always names its host project; a namespace reveal
  // matches on projectCode.
  const myRevealNs = revealNs && revealNs.projectCode === projectCode ? revealNs : null;
  const revealedPath =
    revealFile && (!revealFile.projectCode || revealFile.projectCode === projectCode)
      ? revealFile.path
      : null;
  // RFC-026 — the card itself never collapses: it's the project's whole nav, and its header
  // NAVIGATES (project-level docs/tests) instead of toggling.
  const holdsOpenFile = !!(openFile && openFile.projectCode === projectCode);
  const [files, setFiles] = useState(null); // null = not loaded; [] = loaded empty
  const [changed, setChanged] = useState(new Set());
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [openDirs, setOpenDirs] = useState(new Set());
  const scrolledTo = useRef(null);
  // Filter toggles — Δ (changed vs HEAD), .md (docs), tracked (git-tracked only). They COMPOSE with
  // the text query, persist like the rest of the nav state, and are shared across codebases.
  const [gitAware, setGitAware] = useState(false);
  const [changedOnly, setChangedOnly] = useState(
    () => localStorage.getItem("sv.cbNav.changedOnly") === "true",
  );
  const [docsOnly, setDocsOnly] = useState(
    () => localStorage.getItem("sv.cbNav.docsOnly") === "true",
  );
  const [trackedOnly, setTrackedOnly] = useState(
    () => localStorage.getItem("sv.cbNav.trackedOnly") === "true",
  );
  const flipToggle = (key, value, set) => () => {
    set(!value);
    localStorage.setItem(key, String(!value));
  };
  // RFC-026 — the file region (filter + tree) folds behind its own `code` row. COLLAPSED by
  // default: selection drives it — it opens itself when a file in this project is opened or
  // revealed, and expands down to that file.
  const [codeOpen, setCodeOpen] = useState(holdsOpenFile);
  const flipCode = () => setCodeOpen(!codeOpen);
  // Bulk fold on the head: one click closes EVERYTHING inside the card (every service, every
  // module, the code fold); click again re-opens the services. The card itself never collapses —
  // this empties it instead.
  const [bulk, setBulk] = useState(null); // { n, mode: "collapse" | "expand" }
  const foldAll = (e) => {
    e.stopPropagation(); // the head navigates — this control must not
    const mode = bulk && bulk.mode === "collapse" ? "expand" : "collapse";
    setBulk({ n: (bulk ? bulk.n : 0) + 1, mode });
    setCodeOpen(mode === "expand" ? codeOpen : false);
  };

  useEffect(() => {
    if (holdsOpenFile) setCodeOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdsOpenFile && openFile.path]);

  // A file reveal must actually END UP VISIBLE: open the code fold and unselect every active
  // filter — a filtered-out reveal reads as "nothing happened".
  useEffect(() => {
    if (!revealedPath) return;
    setCodeOpen(true);
    setFilter("");
    if (changedOnly) {
      setChangedOnly(false);
      localStorage.setItem("sv.cbNav.changedOnly", "false");
    }
    if (docsOnly) {
      setDocsOnly(false);
      localStorage.setItem("sv.cbNav.docsOnly", "false");
    }
    if (trackedOnly) {
      setTrackedOnly(false);
      localStorage.setItem("sv.cbNav.trackedOnly", "false");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedPath]);

  // Load the file list as soon as the host is live (the card is always open now) — the count and
  // the head doc indicator need it even while the code fold is closed.
  useEffect(() => {
    if (!fileHost) return;
    let live = true;
    (async () => {
      try {
        const svc = loadServiceWithHeaders(
          fileHost.system.connectionData,
          fileHost.headers,
          fileHost.credentials,
        );
        const res = await svc.Plugin.listFiles({});
        if (!live) return;
        setFiles(res.files || []);
        setTruncated(!!res.truncated);
        setGitAware(!!res.gitAware); // older plugins don't stamp tracked-ness — hide that toggle
        setError("");
        try {
          const ch = svc.Plugin.changedFiles ? await svc.Plugin.changedFiles() : null;
          if (live && ch && ch.files) setChanged(new Set(ch.files.map((f) => f.path)));
        } catch {}
      } catch (e) {
        if (live) setError("file access unavailable");
      }
    })();
    return () => {
      live = false;
    };
    // fileHost identity is a dep: on a refresh the card mounts before the services have
    // connected — the list must load when the host ARRIVES.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileHost && fileHost.serviceId]);

  // Auto-expand the folder path DOWN TO the open file (and scroll its row into view once) — the tree
  // shows the selection whenever you arrive with a file already open.
  useEffect(() => {
    if (!files || !holdsOpenFile) return;
    const parts = openFile.path.split("/");
    parts.pop();
    if (parts.length)
      setOpenDirs((prev) => {
        const next = new Set(prev);
        let key = "";
        parts.forEach((seg) => {
          key = key ? `${key}/${seg}` : seg;
          next.add(key);
        });
        return next;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, holdsOpenFile ? openFile.path : null]);

  // Same expansion for a REVEALED file — the tree must open down to the row being pointed at.
  useEffect(() => {
    if (!files || !revealedPath) return;
    const parts = revealedPath.split("/");
    parts.pop();
    if (parts.length)
      setOpenDirs((prev) => {
        const next = new Set(prev);
        let key = "";
        parts.forEach((seg) => {
          key = key ? `${key}/${seg}` : seg;
          next.add(key);
        });
        return next;
      });
  }, [files, revealedPath]);

  const tree = useMemo(() => (files ? buildTree(files) : null), [files]);
  // Rollup: how many changed files live under each directory prefix (for the collapsed-dir badges).
  const changedCounts = useMemo(() => {
    const counts = {};
    changed.forEach((p) => {
      const parts = p.split("/");
      parts.pop();
      let key = "";
      parts.forEach((seg) => {
        key = key ? `${key}/${seg}` : seg;
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    return counts;
  }, [changed]);
  const toggleDir = (key) =>
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderFile = (f, depth) => {
    const selected =
      openFile && openFile.projectCode === projectCode && openFile.path === f.path;
    // Pointed at from a document (RFC-025): expanded to and highlighted, but NOT open in the
    // centre. SELECTED beats REVEALED — being open outranks being pointed at.
    const isRevealed = !selected && !!revealedPath && revealedPath === f.path;
    return (
      <button
        key={f.path}
        type="button"
        // Scroll the selected (or revealed) row into view ONCE per file — arriving lands right on
        // it, without re-scrolling on every unrelated render.
        ref={
          selected || isRevealed
            ? (el) => {
                if (el && scrolledTo.current !== f.path) {
                  scrolledTo.current = f.path;
                  el.scrollIntoView({ block: "center" });
                }
              }
            : undefined
        }
        className={`${CLASSNAME}__row ${CLASSNAME}__row--file ${selected ? `${CLASSNAME}__row--selected` : ""}${isRevealed ? ` ${CLASSNAME}__row--revealed` : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        title={f.path}
        onClick={() =>
          onOpenFile({
            projectCode,
            serviceId: fileHost.serviceId,
            path: f.path,
            language: f.language,
          })
        }
      >
        <span className={`${CLASSNAME}__file-name`}>{f.name || f.path}</span>
        {changed.has(f.path) && (
          <span className={`${CLASSNAME}__changed-dot`} title="changed vs git HEAD" />
        )}
      </button>
    );
  };

  // Filtering flips the tree into a flat result list — faster to scan than expanding branches.
  // The text query and the toggles COMPOSE (each narrows the same list). A `*.ext` query matches
  // by extension instead of substring.
  const query = filter.trim().toLowerCase();
  const matchText = (p) =>
    !query ||
    (query.startsWith("*.")
      ? p.toLowerCase().endsWith(query.slice(1))
      : p.toLowerCase().includes(query));
  const filterActive = !!query || changedOnly || docsOnly || trackedOnly;
  const filtered =
    files && filterActive
      ? files
          .filter(
            (f) =>
              matchText(f.path) &&
              (!changedOnly || changed.has(f.path)) &&
              (!docsOnly || /\.mdx?$/i.test(f.path)) &&
              (!trackedOnly || f.tracked !== false),
          )
          .slice(0, 200)
      : null;

  return (
    <div
      className={`${CLASSNAME}__codebase ${isCurrent ? `${CLASSNAME}__codebase--current` : ""}`}
    >
      {/* The header NAVIGATES — project-level docs/tests — it does not toggle (RFC-026: the card
          is the project's whole nav and stays open; the `code` fold below owns collapsing). */}
      <button
        type="button"
        className={`${CLASSNAME}__cb-head`}
        title={`Open ${projectCode} — project documentation and tests — right-click for options`}
        onClick={() => {
          onNavigate();
          history.push(withTab(`/specs/${projectCode}`));
        }}
        onContextMenu={(e) => {
          if (!openRowMenu || !onDeleteProject) return;
          // Whole-project removal — every connection goes; a HOSTED member is unhosted too, but
          // its committed folder stays (the user's data; init re-registers it).
          const hostedFolders = [...services, ...dynamicServices]
            .filter((s) => s.hosted)
            .map((s) => s.hosted);
          openRowMenu(e, projectCode, [
            {
              label: "Remove project",
              danger: true,
              confirm: hostedFolders.length
                ? `Remove ${projectCode}? ${[...new Set(hostedFolders)].join(", ")}/ stays`
                : `Remove ${projectCode} and all its connections?`,
              action: () => onDeleteProject(projectCode),
            },
          ]);
        }}
      >
        <span className={`${CLASSNAME}__cb-badge`}>codebase</span>
        <span className={`${CLASSNAME}__cb-name`}>{projectCode}</span>
        {/* Project doc = `<projectCode>.md` at the repo root — only knowable once the file list is
            loaded, so the indicator renders only then. */}
        {files && (
          <span className={`${CLASSNAME}__dyn-icons`}>
            <DocIcon isSaved={files.some((f) => f.path === `${projectCode}.md`)} />
          </span>
        )}
        {files && (
          <span className={`${CLASSNAME}__cb-count`}>
            {files.length}
            {truncated ? "+" : ""}
          </span>
        )}
        <span
          className={`${CLASSNAME}__cb-fold`}
          role="button"
          title={
            bulk && bulk.mode === "collapse"
              ? "Expand the services"
              : "Collapse everything in this project"
          }
          onClick={foldAll}
        >
          {bulk && bulk.mode === "collapse" ? "▸" : "▾"}
        </span>
      </button>
      <div className={`${CLASSNAME}__cb-body`}>
          {/* ALL of the project's services (RFC-026) — real ones first, then project-defined
              (RFC-021 synthesized namespaces). Expandable IN PLACE: service → modules → methods;
              clicking a method points the page (and the scratchpad) at that namespace. */}
          <div className={`${CLASSNAME}__services`}>
            <div className={`${CLASSNAME}__section-label`}>
              project services
              <span className={`${CLASSNAME}__lynx-tag`}>SystemLynx</span>
            </div>
            {[...services, ...dynamicServices].length ? (
              [...services, ...dynamicServices].map((s) => (
                <ServiceNode
                  key={s.serviceId}
                  service={s}
                  projectCode={projectCode}
                  history={history}
                  selection={selection}
                  onNavigate={onNavigate}
                  revealNs={myRevealNs}
                  serviceStatus={serviceStatus}
                  bulk={bulk}
                  onOpenFile={onOpenFile}
                  onHostedOp={onHostedOp}
                  onDeleteService={onDeleteService}
                  openRowMenu={openRowMenu}
                />
              ))
            ) : (
              <div className={`${CLASSNAME}__empty`}>
                none yet — an agent can define them (agents/namespaces.md)
              </div>
            )}
          </div>

          {/* RFC-026 — the whole file region sits behind one `code` fold: root indentation, quiet,
              same section-label voice as `project services` above it. */}
          <button
            type="button"
            className={`${CLASSNAME}__code-fold`}
            title={codeOpen ? "Collapse the file tree" : "Expand the file tree"}
            onClick={flipCode}
          >
            <Chevron open={codeOpen} />
            <span className={`${CLASSNAME}__code-fold-label`}>code</span>
          </button>
          {codeOpen && !fileHost && (
            <div className={`${CLASSNAME}__empty`}>no live service with file access</div>
          )}
          {codeOpen && error && <div className={`${CLASSNAME}__empty`}>{error}</div>}
          {codeOpen && fileHost && !files && !error && (
            <div className={`${CLASSNAME}__empty`}>loading files…</div>
          )}

          {codeOpen && files && (
            <>
              {/* Filter row: text query (substring, or `*.ext`) + composing toggles. The clear ×
                  rides INSIDE the input's right end — one click exits the filter. */}
              <div className={`${CLASSNAME}__filter-row`}>
                <span className={`${CLASSNAME}__filter-wrap`}>
                  <input
                    type="text"
                    className={`${CLASSNAME}__filter`}
                    placeholder="filter files…"
                    title={'Substring match, or "*.js" for an extension'}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  {filter && (
                    <span
                      className={`${CLASSNAME}__filter-clear`}
                      title="Clear the filter"
                      onClick={() => setFilter("")}
                    >
                      ×
                    </span>
                  )}
                </span>
                {/* The changed-files pill IS the count, in the same amber the dots wear — click it
                    to see only those files (active = the amber as a full background). */}
                {changed.size > 0 && (
                  <button
                    type="button"
                    className={`${CLASSNAME}__filter-pill ${CLASSNAME}__filter-pill--changed ${changedOnly ? `${CLASSNAME}__filter-pill--changed-on` : ""}`}
                    title={`${changed.size} file${changed.size > 1 ? "s" : ""} changed vs git HEAD — show only those`}
                    onClick={flipToggle(
                      "sv.cbNav.changedOnly",
                      changedOnly,
                      setChangedOnly,
                    )}
                  >
                    {changed.size}
                  </button>
                )}
                <button
                  type="button"
                  className={`${CLASSNAME}__filter-pill ${docsOnly ? `${CLASSNAME}__filter-pill--on` : ""}`}
                  title="Only markdown docs"
                  onClick={flipToggle("sv.cbNav.docsOnly", docsOnly, setDocsOnly)}
                >
                  .md
                </button>
                {gitAware && (
                  <button
                    type="button"
                    className={`${CLASSNAME}__filter-pill ${trackedOnly ? `${CLASSNAME}__filter-pill--on` : ""}`}
                    title="Only git-tracked files"
                    onClick={flipToggle(
                      "sv.cbNav.trackedOnly",
                      trackedOnly,
                      setTrackedOnly,
                    )}
                  >
                    tracked
                  </button>
                )}
              </div>
              <div className={`${CLASSNAME}__tree`}>
                {filtered ? (
                  filtered.map((f) =>
                    renderFile({ name: f.path, path: f.path, language: f.language }, 0),
                  )
                ) : (
                  <>
                    {Object.keys(tree.dirs)
                      .sort()
                      .map((d) => (
                        <DirNode
                          key={d}
                          name={d}
                          node={tree.dirs[d]}
                          depth={0}
                          prefix=""
                          openDirs={openDirs}
                          toggleDir={toggleDir}
                          renderFile={renderFile}
                          changedCounts={changedCounts}
                        />
                      ))}
                    {tree.files.map((f) => renderFile(f, 0))}
                  </>
                )}
                {filtered && !filtered.length && (
                  <div className={`${CLASSNAME}__empty`}>no match</div>
                )}
              </div>
            </>
          )}
        </div>
    </div>
  );
}

const CodebaseNav = ({
  connectedServices,
  projectCode,
  serviceId,
  moduleName,
  methodName,
  openFile,
  onOpenFile,
  // RFC-025/026 — a pointer from a document (`:file[…]` or `:ns[…]`): expanded to and highlighted,
  // but not opened/selected.
  reveal = null,
  // live/down per serviceUrl — probed by SystemNavigator, shared by both lenses.
  serviceStatus = {},
  theme = "light",
  // RFC-027 — configuration hand for HOSTED services (rename service, add/delete/rename modules).
  // (pc, op, payload) → null on success, an error message on failure.
  onHostedOp = null,
  // Right-click removals — the old tree tab's delete buttons live in the row menu now.
  onDeleteService = null,
  onDeleteProject = null,
}) => {
  // ONE context menu for the whole nav: { x, y, title, items } or null.
  const [menu, setMenu] = useState(null);
  const openRowMenu = (e, title, items) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, title, items });
  };
  const selection = { projectCode, serviceId, moduleName, methodName };
  const onNavigate = () => onOpenFile(null); // namespace navigation closes the open code file
  const revealFile = reveal && reveal.kind === "file" ? reveal : null;
  const revealNs = reveal && reveal.kind === "namespace" ? reveal : null;
  // A codebase = a project. Its file host = the first LIVE (non-dynamic) service exposing the plugin
  // file providers (siblings share a cwd, so one host serves the whole project's tree). It carries
  // ALL the project's services (RFC-026) plus the RFC-021 project-defined (dynamic) entries.
  const codebases = useMemo(() => {
    const byProject = {};
    connectedServices.forEach((s) => {
      if (!byProject[s.projectCode])
        byProject[s.projectCode] = {
          projectCode: s.projectCode,
          fileHost: null,
          services: [],
          dynamicServices: [],
        };
      const cb = byProject[s.projectCode];
      if (s.dynamic) cb.dynamicServices.push(s);
      else {
        cb.services.push(s);
        if (
          !cb.fileHost &&
          (((s.system || {}).connectionData || {}).modules || []).some(
            (m) => m.name === "Plugin",
          )
        )
          cb.fileHost = s;
      }
    });
    return Object.values(byProject);
  }, [connectedServices]);

  return (
    <div className={`${CLASSNAME} ${theme === "dark" ? `${CLASSNAME}--dark` : ""}`}>
      {codebases.length ? (
        codebases.map((cb) => (
          <Codebase
            key={cb.projectCode}
            entry={cb}
            isCurrent={cb.projectCode === projectCode}
            openFile={openFile}
            onOpenFile={onOpenFile}
            selection={selection}
            onNavigate={onNavigate}
            revealFile={revealFile}
            revealNs={revealNs}
            serviceStatus={serviceStatus}
            onHostedOp={onHostedOp}
            onDeleteService={onDeleteService}
            onDeleteProject={onDeleteProject}
            openRowMenu={openRowMenu}
          />
        ))
      ) : (
        <div className={`${CLASSNAME}__empty`}>No connected codebases.</div>
      )}
      <HelpSection revealedTopic={reveal && reveal.kind === "help" ? reveal.topic : null} />
      <RowMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
};

// RFC-026 — help topics live IN the nav, always at the bottom under every codebase: pick one like
// you pick anything else, the open topic highlights, and because the topic is just `?help=` in the
// URL, back and navigation behave — no modal state to get stuck inside. A `:help[…]` chip clicked
// in a document REVEALS its row here (same contract as `:ns`/`:file`), scrolled into view.
function HelpSection({ revealedTopic = null }) {
  const location = useLocation();
  const active = new URLSearchParams(location.search).get("help");
  const scrolledTo = useRef(null);
  return (
    <div className={`${CLASSNAME}__help`}>
      <div className={`${CLASSNAME}__section-label`}>help</div>
      {Object.entries(HELP_TOPICS).map(([key, t]) => {
        const isRevealed = revealedTopic === key && active !== key;
        return (
          <button
            key={key}
            type="button"
            ref={
              isRevealed
                ? (el) => {
                    if (el && scrolledTo.current !== key) {
                      scrolledTo.current = key;
                      el.scrollIntoView({ block: "center" });
                    }
                  }
                : undefined
            }
            className={`${CLASSNAME}__help-row${active === key ? ` ${CLASSNAME}__help-row--selected` : ""}${isRevealed ? ` ${CLASSNAME}__row--revealed` : ""}`}
            title={`Open the "${t.title}" help topic`}
            onClick={() => setHelpTopic(key)}
          >
            {t.title}
          </button>
        );
      })}
    </div>
  );
}

export default CodebaseNav;
