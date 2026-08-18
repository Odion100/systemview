import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import loadServiceWithHeaders from "../../utils/loadService";
import DocIcon from "../../atoms/DocsIcon/DocsIcon";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";
import HELP_TOPICS from "../../atoms/Help/helpTopics";
import { setHelpTopic } from "../../atoms/Help/helpStore";
import RowMenu from "../../atoms/RowMenu/RowMenu";
import { commentedPathSet } from "../../atoms/CodeView/codeComments";
import imageFileIcon from "../../assets/image-file.png";
import "./styles.scss";

// RFC-022 — the CODEBASE navigation (the "Codebase" nav tab). Designed fresh for files, NOT a copy of
// the service nav: monospace tree, chevrons, indent guides, a filter that flips to flat search results,
// git-changed dots. The ROOTS are connected codebases — one per project whose services share a cwd —
// each carrying its FILE SYSTEM (via the RFC-018 plugin file providers) and its PROJECT-DEFINED
// services (RFC-021 synthesized namespaces; empty on a fresh project — that's the bootstrap state).

const CLASSNAME = "codebase-nav";
// A private type, so only this tree answers a file drag (the test panel's section drag uses the
// same trick for the same reason).
const FILE_MIME = "application/x-systemview-file";

// FILE TYPE AT A GLANCE. A monospace tree of forty identical names is read one line at a time; a
// glyph in front of each is read by shape. Deliberately a small set — the point is telling KINDS
// apart (code / style / data / doc / image / config), not decorating every extension.
const FILE_ICONS = [
  [/\.(jsx?|mjs|cjs)$/i, "JS", "js"],
  [/\.tsx?$/i, "TS", "ts"],
  [/\.(json|jsonc)$/i, "{}", "data"],
  [/\.(s?css|less)$/i, "#", "style"],
  [/\.(md|markdown|txt)$/i, "¶", "doc"],
  // Images get the real icon Odion picked, not a glyph — `img` renders as an <img> below.
  [/\.(png|jpe?g|gif|svg|webp|ico|avif|bmp)$/i, imageFileIcon, "img"],
  [/\.(ya?ml|toml|ini|env|conf)$/i, "⚙", "config"],
  [/\.(sh|bash|zsh)$/i, "$", "shell"],
  [/\.(html?|xml)$/i, "<>", "markup"],
];
const iconFor = (name) => {
  for (const [re, glyph, kind] of FILE_ICONS) if (re.test(name)) return { glyph, kind };
  return { glyph: "·", kind: "other" };
};

// WHICH change, not just "changed". Everything used to be one amber dot, so a new file, a deleted
// one and something already staged all read the same. These are git's own letters — the ones anyone
// who has run `git status` already knows — so there's nothing new to learn.
const GIT_MARK = {
  modified: { mark: "M", title: "modified" },
  added: { mark: "A", title: "added" },
  deleted: { mark: "D", title: "deleted" },
  renamed: { mark: "R", title: "renamed" },
  untracked: { mark: "U", title: "untracked — not in git yet" },
};

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

// The version-control mark everyone already reads as "git": a branch splitting off a trunk. Drawn
// rather than borrowed so it inherits the row's colour and never arrives as a missing glyph.
const BranchIcon = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4.5 4.6v7" />
      <path d="M4.5 8.2h4a3 3 0 0 0 3-3v-.6" />
    </g>
    <g fill="currentColor">
      <circle cx="4.5" cy="3.2" r="1.7" />
      <circle cx="4.5" cy="12.8" r="1.7" />
      <circle cx="11.5" cy="3.2" r="1.7" />
    </g>
  </svg>
);

const fileIcon = (name) => {
  const { glyph, kind } = iconFor(name);
  return (
    <span className={`${CLASSNAME}__file-icon ${CLASSNAME}__file-icon--${kind}`} aria-hidden="true">
      {kind === "img" ? <img src={glyph} alt="" /> : glyph}
    </span>
  );
};

// RFC-035 — YOU NAME IT ON THE ROW. `window.prompt` is the browser's own box: it wears the OS's
// chrome instead of this app's, it blocks the page, and it covers the very row it is asking about.
// So the name becomes an input WHERE IT ALREADY SITS — the icon stays, the indent stays, only the
// text turns editable. Enter commits, Escape cancels, and clicking away cancels too: nothing is
// written to disk unless you press Enter, which is the difference between losing a keystroke and
// silently renaming a file you looked away from.
//
// Used for all three: renaming a file in place, and naming a new file or a copy on a GHOST row —
// one that only exists while you're typing, sitting where the file will land.
const RowEdit = ({ name, icon, depth = 0, value, onCommit, onCancel, className = "" }) => {
  const [text, setText] = useState(value);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // THE STEM, NOT THE EXTENSION. Renaming `Foo.test.js` is about `Foo.test`; selecting the whole
    // thing would make you retype `.js` every time.
    const dot = value.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : value.length);
  }, [value]);
  return (
    <div
      className={`${CLASSNAME}__row ${CLASSNAME}__row--edit${className ? ` ${className}` : ""}`}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      {/* Whatever the row already wore in that first column — a file's type glyph, a service's
          status dot — so the edit sits in the row instead of replacing it. */}
      {icon !== undefined ? icon : fileIcon(name || text || "x")}
      <input
        ref={ref}
        className={`${CLASSNAME}__row-input`}
        value={text}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
        // The tree row underneath is a button and the nav has its own key handling — the edit owns
        // every keystroke while it is open.
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            const v = text.trim();
            if (v) onCommit(v);
            else onCancel();
          } else if (e.key === "Escape") onCancel();
        }}
        onBlur={onCancel}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

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
  renderNewIn,
  changedCounts,
  dirMenu,
  onDropFile,
  dropDir,
  setDropDir,
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
        className={`${CLASSNAME}__row ${CLASSNAME}__row--dir${dropDir === key ? ` ${CLASSNAME}__row--drop` : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => toggleDir(key)}
        onContextMenu={(e) => dirMenu && dirMenu(e, key, changedInside)}
        // A FOLDER IS THE ONLY DROP TARGET. Dropping onto a file would have to guess whether you
        // meant "into its folder" or "replace it", and one of those answers destroys something.
        onDragOver={(e) => {
          if (!onDropFile || ![...e.dataTransfer.types].includes(FILE_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = e.altKey ? "copy" : "move";
          if (dropDir !== key) setDropDir(key);
        }}
        onDragLeave={() => dropDir === key && setDropDir(null)}
        onDrop={(e) => {
          if (!onDropFile || ![...e.dataTransfer.types].includes(FILE_MIME)) return;
          e.preventDefault();
          setDropDir(null);
          try {
            onDropFile(JSON.parse(e.dataTransfer.getData(FILE_MIME)), key, e.altKey);
          } catch {}
        }}
      >
        <Chevron open={open} />
        <span className={`${CLASSNAME}__dir-name`}>{name}</span>
        {!open && changedInside > 0 && (
          <span
            className={`${CLASSNAME}__dir-badge`}
            title={`${changedInside} changed file${changedInside > 1 ? "s" : ""} inside`}
          >
            <span className={`${CLASSNAME}__dir-badge-git`} aria-hidden="true">
              ⑂
            </span>
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
              renderNewIn={renderNewIn}
              changedCounts={changedCounts}
              dirMenu={dirMenu}
              onDropFile={onDropFile}
              dropDir={dropDir}
              setDropDir={setDropDir}
            />
          ))}
          {node.files.map((f) => renderFile(f, depth + 1))}
          {/* A new file is named where it will live — last in its folder, indented with the rest. */}
          {renderNewIn && renderNewIn(key, depth + 1)}
        </div>
      )}
    </div>
  );
}

// The row context menu now lives in src/atoms/RowMenu — same markup, same `codebase-nav__menu…`
// classes, same two-step confirms — because a file embedded in a document gets the same right-click.

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
  // A failed op says so ON the card, in the same quiet red the codebase uses for a file op — an
  // alert() is the browser's box over the top of the thing it is talking about.
  const [opErr, setOpErr] = useState("");
  const runOp = async (op, payload) => {
    setOpErr("");
    const err = await onHostedOp(projectCode, op, payload);
    if (err) setOpErr(err);
  };
  // Naming a service or a module happens on its row too — same RowEdit as the files.
  // { kind: "service" | "module" | "newModule", name?, value }
  const [edit, setEdit] = useState(null);
  const commitEdit = (raw) => {
    const e = edit;
    setEdit(null);
    const to = (raw || "").trim();
    if (!e || !to) return;
    if (e.kind === "service") {
      if (to !== service.serviceId) runOp("renameService", { to });
    } else if (e.kind === "module") {
      if (to !== e.name) runOp("renameModule", { name: e.name, to });
    } else runOp("addModule", { name: to });
  };
  // Right-click on the service row: remove the connection (ANY service — the old delete button's
  // job) plus the hosted configuration set. Deletes two-step INSIDE the menu, never a dialog.
  const serviceMenu = (e) => {
    if (!openRowMenu) return;
    const items = [];
    if (canConfigure) {
      items.push({
        label: "Rename service…",
        action: () => setEdit({ kind: "service", value: service.serviceId }),
      });
      items.push({
        label: "Add module…",
        action: () => {
          setOpen(true); // you name it on a row inside the service, so the service has to be open
          setEdit({ kind: "newModule", value: "" });
        },
      });
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
      { label: "Rename module…", action: () => setEdit({ kind: "module", name, value: name }) },
      {
        label: "Delete module",
        danger: true,
        confirm: `Delete ${hosted}/methods/${name}.js? specs stay`,
        action: () => runOp("deleteModule", { name }),
      },
    ]);
  };
  const nameEdit = (kind, value, icon) => (
    <RowEdit
      key={`edit:${kind}:${value}`}
      icon={icon}
      value={value}
      className={`${CLASSNAME}__row--ns`}
      onCommit={commitEdit}
      onCancel={() => setEdit(null)}
    />
  );
  return (
    <div className={`${CLASSNAME}__dyn-service`}>
      {edit && edit.kind === "service" ? (
        nameEdit("service", edit.value, <span className={`${CLASSNAME}__service-dot`} />)
      ) : (
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
      )}
      {/* A hosted op that failed says so here, under the service it belongs to. */}
      {opErr && <div className={`${CLASSNAME}__op-error`}>{opErr}</div>}
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
            if (edit && edit.kind === "module" && edit.name === m.name)
              return <div key={m.name}>{nameEdit("module", edit.value, <Chevron open={false} />)}</div>;
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
          {/* A NEW module is named at the end of the list, where it will appear. */}
          {edit && edit.kind === "newModule" && nameEdit("newModule", edit.value, <Chevron open={false} />)}
          {!modules.length && !edit && (
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
  const [changed, setChanged] = useState(new Map()); // path → { status, staged, partial }
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [openDirs, setOpenDirs] = useState(new Set());
  const scrolledTo = useRef(null);
  // VERSION CONTROL is a LENS, not a filter. The changed count used to be a pill that hid every
  // unchanged file — which answered "what changed" and nothing else. Flipping the lens replaces the
  // tree with git's own three groups (staged / changes / untracked) and puts stage-unstage on each
  // row, because "what's staged" was the question the whole thing existed to answer.
  const [vcLens, setVcLens] = useState(
    () => localStorage.getItem("sv.cbNav.vcLens") === "true",
  );
  const [docsOnly, setDocsOnly] = useState(
    () => localStorage.getItem("sv.cbNav.docsOnly") === "true",
  );
  // RFC-034 — only the files someone has said something about. Same shape as the `.md` pill beside
  // it; the count rides on it, because "how many files have comments" is half of what you're asking
  // when you reach for this.
  const [commentsOnly, setCommentsOnly] = useState(
    () => localStorage.getItem("sv.cbNav.commentsOnly") === "true",
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
  // The services region folds the same way — OPEN by default (it's the project's primary content),
  // and the choice sticks per project.
  const [servicesOpen, setServicesOpen] = useState(
    localStorage.getItem(`sv.cbNav.services.${projectCode}`) !== "false",
  );
  const flipServices = () => {
    setServicesOpen(!servicesOpen);
    localStorage.setItem(
      `sv.cbNav.services.${projectCode}`,
      String(!servicesOpen),
    );
  };
  // Bulk fold on the head: one click closes EVERYTHING inside the card (every service, every
  // module, the code fold); click again re-opens the services. The card itself never collapses —
  // this empties it instead.
  const [bulk, setBulk] = useState(null); // { n, mode: "collapse" | "expand" }
  const foldAll = (e) => {
    e.stopPropagation(); // the head navigates — this control must not
    const mode = bulk && bulk.mode === "collapse" ? "expand" : "collapse";
    setBulk({ n: (bulk ? bulk.n : 0) + 1, mode });
    // "Minimize the project" means the SECTIONS go down too — services and code both — not just
    // what is inside them.
    setCodeOpen(mode === "expand" ? codeOpen : false);
    setServicesOpen(mode === "expand");
  };

  useEffect(() => {
    if (holdsOpenFile) setCodeOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdsOpenFile && openFile.path]);

  // Same rule the file reveal follows: a namespace reveal has to end up VISIBLE, so it opens the
  // services fold if it was closed.
  useEffect(() => {
    if (myRevealNs) setServicesOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRevealNs && myRevealNs.serviceId, myRevealNs && myRevealNs.methodName]);

  // A file reveal must actually END UP VISIBLE: open the code fold and unselect every active
  // filter — a filtered-out reveal reads as "nothing happened".
  useEffect(() => {
    if (!revealedPath) return;
    setCodeOpen(true);
    setFilter("");
    if (vcLens) {
      setVcLens(false);
      localStorage.setItem("sv.cbNav.vcLens", "false");
    }
    if (docsOnly) {
      setDocsOnly(false);
      localStorage.setItem("sv.cbNav.docsOnly", "false");
    }
    if (commentsOnly) {
      setCommentsOnly(false);
      localStorage.setItem("sv.cbNav.commentsOnly", "false");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedPath]);

  // RFC-029 refresh scope `nav` — re-walk the tree + changed set in place when the agent says so.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const on = (e) => {
      const s = ((e && e.detail) || {}).scope || "all";
      if (s === "all" || s === "nav") setRefreshTick((n) => n + 1);
    };
    window.addEventListener("sv:refresh", on);
    return () => window.removeEventListener("sv:refresh", on);
  }, []);

  // GIT MOVES WITHOUT US. Staging happens in a terminal, another editor, another window — so the
  // status is re-read on its own: whenever this tab regains focus, and on a slow tick while the
  // version-control lens is actually open. Status only, never the whole file list — it's one git
  // call, and the tree isn't what went stale.
  const reloadChanged = useRef(() => {});
  reloadChanged.current = async () => {
    if (!fileHost) return;
    try {
      const svc = loadServiceWithHeaders(
        fileHost.system.connectionData,
        fileHost.headers,
        fileHost.credentials,
      );
      if (!svc.Plugin.changedFiles) return;
      const ch = await svc.Plugin.changedFiles();
      if (ch && ch.files)
        setChanged(
          new Map(
            ch.files.map((f) => [f.path, f.status ? f : { ...f, status: "modified" }]),
          ),
        );
    } catch {}
  };
  useEffect(() => {
    const onFocus = () => {
      reloadChanged.current();
      // The branch and the ahead count go stale the same way the status does — a commit or a push
      // from a terminal has to show up here without being asked.
      loadGitState.current();
    };
    onFocus();
    window.addEventListener("focus", onFocus);
    // ONE SURFACE MOVING GIT MUST TELL THE OTHERS. Staging in the open file's stripes left this nav
    // showing the old state until something else forced a re-read — his report: "I had to unstage
    // and stage it just for it to kick in".
    window.addEventListener("sv:git", onFocus);
    const tick = vcLens ? setInterval(onFocus, 5000) : null;
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("sv:git", onFocus);
      if (tick) clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vcLens, fileHost && fileHost.serviceId]);

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
        setError("");
        try {
          const ch = svc.Plugin.changedFiles ? await svc.Plugin.changedFiles() : null;
          // A MAP now, not a set — the tree draws WHICH change, and a plugin too old to report a
          // status still lands here as plain "modified", so nothing regresses to blank.
          if (live && ch && ch.files)
            setChanged(new Map(ch.files.map((f) => [f.path, f.status ? f : { ...f, status: "modified" }])));
        } catch {}
      } catch (e) {
        if (live) setError("file access unavailable");
      }
    })();
    return () => {
      live = false;
    };
    // fileHost identity is a dep: on a refresh the card mounts before the services have
    // connected — the list must load when the host ARRIVES. refreshTick re-runs it on a
    // `sv:refresh` nav-scope command.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileHost && fileHost.serviceId, refreshTick]);

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

  // STAGE / UNSTAGE. Runs `git add` / `git restore --staged` inside the service's own repo and
  // redraws from the FRESH status it returns — no optimistic guessing about what git did.
  const [vcBusy, setVcBusy] = useState(null); // the path (or group key) currently in flight
  const [vcError, setVcError] = useState("");
  // RFC-035 — MOVING FILES AROUND. One helper for every verb: it names what failed rather than
  // failing quietly, and the tree re-walks itself afterwards so what you see is what is on disk.
  const [fileBusy, setFileBusy] = useState("");
  const fileOp = async (verb, args, sayWhat) => {
    if (!fileHost) return;
    setFileBusy(sayWhat);
    setVcError("");
    try {
      const svc = loadServiceWithHeaders(
        fileHost.system.connectionData,
        fileHost.headers,
        fileHost.credentials,
      );
      if (!svc.Plugin[verb])
        throw new Error(`this project's plugin has no ${verb} — npm i systemview-plugin@latest and restart`);
      await svc.Plugin[verb](args);
      setRefreshTick((n) => n + 1);
      window.dispatchEvent(new CustomEvent("sv:git"));
    } catch (err) {
      setVcError((err && err.message) || `${sayWhat} failed`);
    } finally {
      setFileBusy("");
    }
  };
  // DRAG A FILE ONTO A FOLDER. Same shape the test panel's section drag uses: a private MIME type
  // carrying JSON, so nothing else on the page thinks a file row is for it. ⌥ (alt) while you drop
  // COPIES instead of moving — Finder's gesture, because that is the one already in his hands.
  const [dropDir, setDropDir] = useState(null);
  const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
  // NAMING HAPPENS ON THE ROW (see RowEdit). One piece of state for all three, because only one row
  // can be under the cursor at a time:
  //   { kind: "rename",    path, value }        the file's own row turns into an input
  //   { kind: "duplicate", path, dir, value }   a ghost row under it, holding the copy's name
  //   { kind: "new",       dir,  value }        a ghost row inside the folder
  const [editing, setEditing] = useState(null);
  const commitEdit = (raw) => {
    const e = editing;
    setEditing(null);
    const name = (raw || "").trim();
    if (!e || !name) return;
    // A name with slashes in it is allowed everywhere — `writeFile`, `moveFile` and `copyFile` all
    // make the folders on the way, so typing a path is how you move something while renaming it.
    if (e.kind === "rename") {
      if (name === e.value) return;
      fileOp("moveFile", { from: e.path, to: joinPath(dirOf(e.path), name) }, `renaming ${e.value}`);
    } else if (e.kind === "duplicate")
      fileOp("copyFile", { from: e.path, to: joinPath(e.dir, name) }, `copying ${e.path.split("/").pop()}`);
    else fileOp("writeFile", { path: joinPath(e.dir, name), content: "" }, `creating ${name}`);
  };
  // The ghost row for a NEW file, drawn inside the folder it belongs to (dir "" is the root).
  const renderNewIn = (dirKey, depth) =>
    editing && editing.kind === "new" && editing.dir === dirKey
      ? rowEdit(depth, `${CLASSNAME}__row--file`)
      : null;
  const rowEdit = (depth, className) => (
    <RowEdit
      key={`edit:${editing.kind}:${editing.path || editing.dir}`}
      name={editing.value}
      depth={depth}
      value={editing.value}
      className={className}
      onCommit={commitEdit}
      onCancel={() => setEditing(null)}
    />
  );
  const onDropFile = (payload, dir, copy) => {
    if (!payload || !payload.path) return;
    // Only within one codebase: a cross-project move would be a copy plus a delete in two different
    // repos, which is not one gesture and should not pretend to be.
    if (payload.project && payload.project !== projectCode)
      return setVcError("that file belongs to another codebase");
    const name = payload.path.split("/").pop();
    if (dirOf(payload.path) === dir) return; // dropped where it already lives
    fileOp(
      copy ? "copyFile" : "moveFile",
      { from: payload.path, to: joinPath(dir, name) },
      `${copy ? "copying" : "moving"} ${name}`,
    );
  };
  const joinPath = (dir, name) => (dir ? `${dir}/${name}` : name);

  const stage = async (paths, unstage, busyKey) => {
    if (!fileHost) return;
    setVcBusy(busyKey || paths[0]);
    setVcError("");
    try {
      const svc = loadServiceWithHeaders(
        fileHost.system.connectionData,
        fileHost.headers,
        fileHost.credentials,
      );
      const res = await svc.Plugin.stageFiles({ paths, unstage });
      window.dispatchEvent(new CustomEvent("sv:git"));
      if (res && res.files)
        setChanged(
          new Map(
            res.files.map((f) => [f.path, f.status ? f : { ...f, status: "modified" }]),
          ),
        );
    } catch (e) {
      setVcError(
        (e && e.message) ||
          "staging unavailable — this project's plugin may predate it",
      );
    } finally {
      setVcBusy(null);
    }
  };

  // DISCARD — a tracked file goes back to HEAD, an untracked one is deleted. The plugin snapshots
  // each into the history ring first, so ⏱ can undo it; that is the only reason this is offered at
  // all rather than left to a terminal.
  const discard = async (paths) => {
    if (!fileHost) return;
    setVcBusy(paths[0]);
    setVcError("");
    try {
      const svc = loadServiceWithHeaders(
        fileHost.system.connectionData,
        fileHost.headers,
        fileHost.credentials,
      );
      if (!svc.Plugin.discardFiles)
        throw new Error("this project's plugin predates discard — restart the service");
      const res = await svc.Plugin.discardFiles({ paths });
      window.dispatchEvent(new CustomEvent("sv:git"));
      if (res && res.changed && res.changed.files)
        setChanged(
          new Map(
            res.changed.files.map((f) => [f.path, f.status ? f : { ...f, status: "modified" }]),
          ),
        );
      loadGitState.current();
    } catch (e) {
      setVcError((e && e.message) || "could not discard");
    } finally {
      setVcBusy(null);
    }
  };

  // RFC-033 — COMMIT / PUSH, in the place he already stages from. Two-step, his call: the first
  // click arms, the second runs. Nothing here is reachable except by that click.
  const [gitState, setGitState] = useState(null);
  // WHY there is no box, when there is no box. Drawing nothing until git answered meant the lens
  // could sit there with no sign the feature exists at all — "you don't even know the feature is
  // existing, you're wondering, like, hold on". loading | old | notrepo | error.
  const [gitProbe, setGitProbe] = useState("loading");
  const [message, setMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [armed, setArmed] = useState("");
  // changes | log — the same switch the ::commit block has, so the panel can show history too.
  const [vcTab, setVcTab] = useState("changes");
  // A message just arrived from a document's `::commit` block — the box glows briefly so the
  // hand-off is visible, then goes back to looking like the box it always was.
  const [took, setTook] = useState(false);
  const commitBoxRef = useRef(null);
  // git's own words from the last commit/push — including the sentence an aborting hook prints.
  const [gitOut, setGitOut] = useState("");
  const loadGitState = useRef(() => {});
  loadGitState.current = async () => {
    if (!fileHost) return;
    try {
      const svc = loadServiceWithHeaders(
        fileHost.system.connectionData,
        fileHost.headers,
        fileHost.credentials,
      );
      // An older plugin has neither — the box says so instead of drawing dead buttons.
      if (!svc.Plugin.gitState) {
        setGitState(null);
        return setGitProbe("old");
      }
      const s = await svc.Plugin.gitState();
      setGitState(s);
      setGitProbe(s && s.repo ? "ok" : "notrepo");
    } catch {
      setGitState(null);
      setGitProbe("error");
    }
  };
  const runGit = async (what) => {
    if (armed !== what) return setArmed(what);
    setArmed("");
    setVcBusy(what);
    setVcError("");
    try {
      const svc = loadServiceWithHeaders(
        fileHost.system.connectionData,
        fileHost.headers,
        fileHost.credentials,
      );
      if (what === "commit") {
        const res = await svc.Plugin.commit({ message: message.trim() });
        window.dispatchEvent(new CustomEvent("sv:git"));
        setMessage("");
        setGitState(res.state);
        setGitOut(res.output || `${res.sha} ${res.subject}`);
        if (res.changed && res.changed.files)
          setChanged(
            new Map(
              res.changed.files.map((f) => [f.path, f.status ? f : { ...f, status: "modified" }]),
            ),
          );
      } else {
        const res = await svc.Plugin.push();
        window.dispatchEvent(new CustomEvent("sv:git"));
        setGitState(res.state);
        setGitOut(res.pushed ? res.output : res.reason || "nothing to push");
        if (!res.pushed) setVcError(res.reason || "nothing to push");
      }
    } catch (e) {
      // git's own sentence, not ours — a hook that aborts explains itself.
      setVcError((e && e.message) || `${what} failed`);
      setGitOut((e && e.message) || `${what} failed`);
    } finally {
      setVcBusy(null);
    }
  };

  // THE `</>` BUTTON, ARRIVING. Opening the panel was not enough — it was usually open already, so
  // pressing it did nothing you could see. The card you pressed it from OPENS ITS FILES and scrolls
  // to itself; every other codebase folds away, so what you asked for is the thing in front of you.
  const cardRef = useRef(null);
  useEffect(() => {
    const onCodebase = (e) => {
      const target = ((e && e.detail) || {}).projectCode;
      if (target && target !== projectCode) {
        setServicesOpen(false);
        setCodeOpen(false);
        return;
      }
      setCodeOpen(true);
      setTimeout(() => {
        if (cardRef.current) cardRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 120);
    };
    window.addEventListener("sv:codebase", onCodebase);
    return () => window.removeEventListener("sv:codebase", onCodebase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode]);

  // HAND THE MESSAGE OVER FROM A DOCUMENT. A `::commit` block can pass its message here instead of
  // running the commit itself — "sometimes I want to switch to the nav and make my commit". It only
  // ever SETS UP the box: the lens opens, the message lands in it, and the two clicks are still his.
  // Everything it flips is something the box needs to be visible at all (the code fold, the lens,
  // and git state, which is only fetched while the lens is on).
  useEffect(() => {
    const onTake = (e) => {
      const d = (e && e.detail) || {};
      if (d.projectCode && d.projectCode !== projectCode) return;
      setCodeOpen(true);
      setVcLens(true);
      localStorage.setItem("sv.cbNav.vcLens", "true");
      setVcTab("changes");
      setArmed("");
      if (d.message != null) setMessage(d.message);
      setTyping(false);
      loadGitState.current();
      // THE HAND-OFF LANDS WHEN THE BOX DOES. The box only exists once git state comes back from the
      // plugin — a network round-trip — so a fixed 140ms timer was scrolling to something that
      // wasn't there yet, and the glow expired before it appeared: "I swear it just popped up out of
      // nowhere". Wait for the box instead, up to a couple of seconds, then scroll and glow.
      setTook(true);
      const started = Date.now();
      const land = () => {
        if (commitBoxRef.current) {
          commitBoxRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
          setTimeout(() => setTook(false), 1600);
          return;
        }
        if (Date.now() - started < 4000) return setTimeout(land, 80);
        setTook(false); // no box after four seconds: an old plugin with no gitState, not a slow one
      };
      setTimeout(land, 60);
    };
    window.addEventListener("sv:commitInNav", onTake);
    return () => window.removeEventListener("sv:commitInNav", onTake);
  }, [projectCode]);

  // Which files have comments — derived from the file list the tree ALREADY has, because a comment
  // sidecar is itself a file in `.systemview/`. No new plugin method and no extra call; the FIRST
  // thread on a file creates that sidecar, so the list has to be re-walked when one is written —
  // the same tick a `sv:refresh` uses.
  useEffect(() => {
    const bump = () => setRefreshTick((n) => n + 1);
    window.addEventListener("sv:comments", bump);
    return () => window.removeEventListener("sv:comments", bump);
  }, []);
  const commented = useMemo(() => commentedPathSet(files), [files]);

  const tree = useMemo(() => (files ? buildTree(files) : null), [files]);
  // Rollup: how many changed files live under each directory prefix (for the collapsed-dir badges).
  const changedCounts = useMemo(() => {
    const counts = {};
    changed.forEach((_v, p) => {
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

  // The file row menu — the same one the services already had, now over the codebase. Deliberately
  // basic: open it, move it in or out of the index, take its path. Nothing here deletes.
  const fileMenu = (e, f) => {
    if (!openRowMenu) return;
    const g = changed.get(f.path);
    const gone = g && g.status === "deleted";
    const name = f.path.split("/").pop();
    // A DELETED file has nothing to open — offering it only produces an ENOENT pane.
    const items = gone
      ? []
      : [
          {
            label: "Open",
            action: () =>
              onOpenFile({
                projectCode,
                serviceId: fileHost.serviceId,
                path: f.path,
                language: f.language,
              }),
          },
        ];
    // Staged AND edited since gets BOTH verbs — that file has something on either side.
    if (g && (!g.staged || g.partial))
      items.push({ label: "Stage", action: () => stage([f.path], false) });
    if (g && g.staged)
      items.push({ label: "Unstage", action: () => stage([f.path], true) });
    // THROWING WORK AWAY — two-step, and the only destructive pair in this menu. Every discarded
    // file is snapshotted into the history ring first, so ⏱ can bring it back.
    // ONE VERB PER STATE, named for what it actually does to THIS file. "Discard changes" on a file
    // you deleted is backwards — the change being discarded is the deletion, so the honest word is
    // restore. Same call underneath; only the label and the question change.
    // YOU CANNOT DISCARD WHAT YOU HAVE STAGED — you unstage it first. So discard/restore only
    // appear when there is an UNSTAGED difference to throw away, and they only ever touch the
    // working tree. A fully-staged file offers Unstage and nothing else; that is the real order of
    // operations, and it's what stops one click from destroying staged work.
    const unstagedPart = !!g && (!g.staged || g.partial);
    // NOT an untracked branch here: "Delete file" below deletes ANY file and snapshots it first, so
    // git's throw-away-the-new-file verb was the same words twice in one menu.
    // ...and an UNTRACKED file has no "changes" to discard either — throwing it away IS deleting it,
    // which the Delete item below says in the right words.
    if (gone && unstagedPart)
      items.push({
        label: "Restore file",
        // Bringing a file BACK isn't destruction — it still confirms, but it isn't red.
        confirm: `Bring back ${name}?`,
        action: () => discard([f.path]),
      });
    else if (g && unstagedPart && g.status !== "untracked")
      items.push({
        label: "Discard changes",
        danger: true,
        confirm: `Throw away the unstaged changes to ${name}? (kept in history)`,
        action: () => discard([f.path]),
      });
    // RFC-035 — what you can do TO the file, as opposed to what git can do with it.
    // Both of these name the file ON THE ROW — the menu closes and an input opens where the file
    // is, rather than a browser dialog over the top of it.
    items.push({
      label: "Rename…",
      action: () => setEditing({ kind: "rename", path: f.path, value: name }),
    });
    items.push({
      label: "Duplicate",
      action: () => {
        const dot = name.lastIndexOf(".");
        const suggested = dot > 0 ? `${name.slice(0, dot)}-copy${name.slice(dot)}` : `${name}-copy`;
        setEditing({ kind: "duplicate", path: f.path, dir: dirOf(f.path), value: suggested });
      },
    });
    // DELETE, for any file — not just an untracked one. `discardFiles` was git's verb for throwing
    // away a NEW file; this is the plain one, and the snapshot ring holds what it removed.
    if (!gone)
      items.push({
        label: "Delete file",
        danger: true,
        confirm: `Delete ${name}? (kept in history)`,
        action: () => fileOp("deleteFile", { path: f.path }, `deleting ${name}`),
      });
    items.push({
      label: "Copy path",
      action: () => navigator.clipboard && navigator.clipboard.writeText(f.path),
    });
    items.push({
      label: "Copy name",
      action: () =>
        navigator.clipboard &&
        navigator.clipboard.writeText(f.path.split("/").pop()),
    });
    // THE MENU SAYS WHAT STATE THE FILE IS IN. The row's letter is `M` for a staged file AND for a
    // staged one edited again since — same letter, different options — so "why does this M offer
    // discard?" was unanswerable from the screen. Now the menu's own header answers it.
    const state = !g
      ? ""
      : g.status === "untracked"
        ? " · untracked"
        : g.staged && g.partial
          ? " · staged, edited since"
          : g.staged
            ? " · staged"
            : " · not staged";
    openRowMenu(e, `${f.path}${state}`, items);
  };

  // Folders get their own menu — the same verbs read at folder scale. `git add <dir>` would work
  // directly, but the explicit path list is what keeps the ignore rules the tree already applies
  // (node_modules and friends) in force.
  const dirMenu = (e, key, changedInside) => {
    if (!openRowMenu) return;
    const inside = [...changed.keys()].filter((p) => p.startsWith(`${key}/`));
    const stagedInside = inside.filter((p) => changed.get(p).staged);
    const openInside = inside.filter((p) => !changed.get(p).staged || changed.get(p).partial);
    const items = [
      {
        label: openDirs.has(key) ? "Collapse" : "Expand",
        action: () => toggleDir(key),
      },
      // A NEW FILE lands here. writeFile creates any missing folder on the way, so a name with
      // slashes in it makes the folders too — which is also the only way to make an empty folder
      // worth having (git doesn't keep one).
      {
        label: "New file…",
        action: () => {
          // The folder has to be OPEN for you to type in it — the ghost row lives inside it.
          setOpenDirs((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
          setEditing({ kind: "new", dir: key, value: "" });
        },
      },
      {
        label: "Expand everything inside",
        action: () =>
          setOpenDirs((prev) => {
            const next = new Set(prev);
            next.add(key);
            // Every ancestor path of a file under this folder — that IS the set of subfolders.
            files.forEach((f) => {
              if (!f.path.startsWith(`${key}/`)) return;
              const parts = f.path.split("/");
              parts.pop();
              let k = "";
              parts.forEach((seg) => {
                k = k ? `${k}/${seg}` : seg;
                next.add(k);
              });
            });
            return next;
          }),
      },
      {
        label: "Collapse everything inside",
        action: () =>
          setOpenDirs((prev) => {
            const next = new Set(prev);
            [...next].forEach((k) => {
              if (k === key || k.startsWith(`${key}/`)) next.delete(k);
            });
            return next;
          }),
      },
    ];
    if (openInside.length)
      items.push({
        label: `Stage ${openInside.length} inside`,
        action: () => stage(openInside, false, key),
      });
    if (stagedInside.length)
      items.push({
        label: `Unstage ${stagedInside.length} inside`,
        action: () => stage(stagedInside, true, key),
      });
    items.push({
      label: "Copy path",
      action: () => navigator.clipboard && navigator.clipboard.writeText(key),
    });
    openRowMenu(
      e,
      `${key}${changedInside ? ` · ${changedInside} changed` : ""}`,
      items,
    );
  };

  const renderFile = (f, depth) => {
    // Renaming: this row IS the input. Duplicating: the row stays and the copy's name is typed on a
    // ghost row right under it, where the copy will appear.
    const editingHere = editing && editing.path === f.path;
    if (editingHere && editing.kind === "rename") return rowEdit(depth, `${CLASSNAME}__row--file`);
    const selected =
      openFile && openFile.projectCode === projectCode && openFile.path === f.path;
    // Pointed at from a document (RFC-025): expanded to and highlighted, but NOT open in the
    // centre. SELECTED beats REVEALED — being open outranks being pointed at.
    const isRevealed = !selected && !!revealedPath && revealedPath === f.path;
    const row = (
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
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "copyMove";
          e.dataTransfer.setData(FILE_MIME, JSON.stringify({ path: f.path, project: projectCode }));
        }}
        title={f.path}
        onClick={() =>
          onOpenFile({
            projectCode,
            serviceId: fileHost.serviceId,
            path: f.path,
            language: f.language,
          })
        }
        onContextMenu={(e) => fileMenu(e, f)}
      >
        {(() => {
          const { glyph, kind } = iconFor(f.name || f.path);
          return (
            <span className={`${CLASSNAME}__file-icon ${CLASSNAME}__file-icon--${kind}`} aria-hidden="true">
              {kind === "img" ? <img src={glyph} alt="" /> : glyph}
            </span>
          );
        })()}
        <span className={`${CLASSNAME}__file-name`}>{f.name || f.path}</span>
        {/* RFC-034 — this file has comments on it. "They'd be a good thing to know where they are":
            without a mark, a thread only exists for whoever remembers writing it. Free to compute —
            the sidecars are files in this same tree. */}
        {commented.has(f.path) && (
          <span className={`${CLASSNAME}__comment-mark`} title="This file has comments">
            💬
          </span>
        )}
        {(() => {
          const g = changed.get(f.path);
          if (!g) return null;
          const { mark, title } = GIT_MARK[g.status] || GIT_MARK.modified;
          return (
            <span
              className={`${CLASSNAME}__git-mark ${CLASSNAME}__git-mark--${g.status}${
                g.staged ? ` ${CLASSNAME}__git-mark--staged` : ""
              }`}
              title={`${title}${g.staged ? " · staged" : ""}${
                g.partial ? " · with unstaged edits on top" : ""
              }`}
            >
              {mark}
              {g.partial && <i className={`${CLASSNAME}__git-partial`} />}
            </span>
          );
        })()}
      </button>
    );
    if (!(editingHere && editing.kind === "duplicate")) return row;
    return (
      <React.Fragment key={`${f.path}:dup`}>
        {row}
        {rowEdit(depth, `${CLASSNAME}__row--file`)}
      </React.Fragment>
    );
  };

  // A version-control group: git's own heading, the count, one bulk action, then the rows. Each row
  // opens the file like any other row; the +/− on the right is the only thing that touches git.
  const renderVcGroup = (key, label, rows) => {
    if (!rows.length) return null;
    const unstage = key === "staged";
    const paths = rows.map((r) => r.path);
    // ONE STAGE-ALL FOR BOTH UNSTAGED GROUPS. Changed and untracked are worth SEEING apart — that's
    // the whole point of the split — but nobody stages one and not the other, and two buttons that
    // each say "stage all" while staging half is a lie about what they do (his call). The staged
    // group keeps its own unstage-all: that one really is about only those rows.
    const bothUnstaged = [...vcGroups.unstaged, ...vcGroups.untracked].map((r) => r.path);
    // It rides the FIRST unstaged group on screen, so it is there whether or not either half is empty.
    const showsAll = unstage || (key === "unstaged" ? true : !vcGroups.unstaged.length);
    const allPaths = unstage ? paths : bothUnstaged;
    return (
      <div className={`${CLASSNAME}__vc-group`} key={key}>
        <div className={`${CLASSNAME}__vc-head`}>
          <span className={`${CLASSNAME}__vc-head-label`}>{label}</span>
          <span className={`${CLASSNAME}__vc-head-n`}>{rows.length}</span>
          {showsAll && (
            <button
              type="button"
              className={`${CLASSNAME}__vc-all`}
              title={
                unstage
                  ? `Unstage all ${rows.length}`
                  : `Stage everything not staged — ${allPaths.length} file${allPaths.length === 1 ? "" : "s"}, changed and untracked`
              }
              disabled={vcBusy === key}
              onClick={() => stage(allPaths, unstage, key)}
            >
              {unstage ? "unstage all" : "stage all"}
            </button>
          )}
        </div>
        {rows.map((r) => {
          // Rename works from HERE too — the version-control lens is where he spends the time, and
          // a menu item that only worked in the tree would be a menu item that sometimes did nothing.
          if (editing && editing.kind === "rename" && editing.path === r.path)
            return <div key={`${key}:${r.path}`}>{rowEdit(0, `${CLASSNAME}__row--vc`)}</div>;
          const { glyph, kind } = iconFor(r.name);
          const { mark, title } = GIT_MARK[r.status] || GIT_MARK.modified;
          // A file that is staged AND edited since is legitimately in TWO groups, so the selection
          // has to know WHICH row you clicked — keyed on the path alone, both lit up at once.
          const side = key === "staged" ? "staged" : "unstaged";
          const selected =
            openFile &&
            openFile.projectCode === projectCode &&
            openFile.path === r.path &&
            (openFile.side || "unstaged") === side;
          const dir = r.path.includes("/") ? r.path.slice(0, r.path.lastIndexOf("/")) : "";
          return (
            <div
              key={`${key}:${r.path}`}
              className={`${CLASSNAME}__vc-row ${selected ? `${CLASSNAME}__row--selected` : ""}`}
              onContextMenu={(e) => fileMenu(e, r)}
            >
              <button
                type="button"
                // A deleted file has nothing to open — clicking it would only ever produce an
                // ENOENT pane. It still stages and unstages like anything else.
                className={`${CLASSNAME}__vc-open${r.status === "deleted" ? ` ${CLASSNAME}__vc-open--gone` : ""}`}
                disabled={r.status === "deleted"}
                title={r.status === "deleted" ? `${r.path} — deleted from disk` : r.path}
                onClick={() =>
                  onOpenFile({
                    projectCode,
                    serviceId: fileHost.serviceId,
                    path: r.path,
                    language: r.language,
                    // WHICH SIDE you asked for: from `staged` you want HEAD→index (what you would
                    // be committing), from `changes` you want index→working (what you haven't
                    // staged). Opening the same file from either row used to give the same view.
                    side,
                  })
                }
              >
                <span
                  className={`${CLASSNAME}__file-icon ${CLASSNAME}__file-icon--${kind}`}
                  aria-hidden="true"
                >
                  {kind === "img" ? <img src={glyph} alt="" /> : glyph}
                </span>
                <span className={`${CLASSNAME}__file-name`}>{r.name}</span>
                {/* THE 💬 SURVIVES THE LENS. It marks a commented file in the tree and vanished the
                    moment version control was on — the same file, the same fact, one of the two
                    views silently dropping it. Said twice before I heard it. */}
                {commented.has(r.path) && (
                  <span className={`${CLASSNAME}__comment-mark`} title="This file has comments">
                    💬
                  </span>
                )}
                {dir && <span className={`${CLASSNAME}__vc-dir`}>{dir}</span>}
                <span
                  className={`${CLASSNAME}__git-mark ${CLASSNAME}__git-mark--${r.status}${
                    unstage ? ` ${CLASSNAME}__git-mark--staged` : ""
                  }`}
                  title={title}
                >
                  {mark}
                </span>
              </button>
              <button
                type="button"
                className={`${CLASSNAME}__vc-act`}
                title={unstage ? `Unstage ${r.name}` : `Stage ${r.name}`}
                disabled={vcBusy === r.path}
                onClick={() => stage([r.path], unstage)}
              >
                {unstage ? "−" : "+"}
              </button>
            </div>
          );
        })}
      </div>
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
  const filterActive = !!query || docsOnly || commentsOnly;
  const filtered =
    files && filterActive
      ? files
          .filter(
            (f) =>
              matchText(f.path) &&
              (!docsOnly || /\.mdx?$/i.test(f.path)) &&
              (!commentsOnly || commented.has(f.path)),
          )
          .slice(0, 200)
      : null;

  // The three groups git itself uses. A file that is staged AND edited again since appears in
  // BOTH — that is the honest picture, and it's the state worth seeing twice.
  //
  // THE OTHER FILTERS NARROW THESE TOO. The lens is a VIEW, not a mode that swallows everything
  // else: picking `.md` or comments or typing in the box while version control is on used to do
  // nothing at all, so the two halves of the row looked like they belonged to different panels.
  const vcGroups = useMemo(() => {
    const keep = (path) =>
      matchText(path) && (!docsOnly || /\.mdx?$/i.test(path)) && (!commentsOnly || commented.has(path));
    const staged = [];
    const unstaged = [];
    const untracked = [];
    changed.forEach((g, p) => {
      if (!keep(p)) return;
      const row = { ...g, path: p, name: p.split("/").pop() };
      if (g.status === "untracked") untracked.push(row);
      else {
        if (g.staged) staged.push(row);
        if (!g.staged || g.partial) unstaged.push(row);
      }
    });
    const byName = (a, b) => a.path.localeCompare(b.path);
    return {
      staged: staged.sort(byName),
      unstaged: unstaged.sort(byName),
      untracked: untracked.sort(byName),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changed, query, docsOnly, commentsOnly, commented]);

  return (
    <div
      ref={cardRef}
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
            <button
              type="button"
              className={`${CLASSNAME}__code-fold`}
              title={servicesOpen ? "Collapse the services" : "Expand the services"}
              onClick={flipServices}
            >
              <Chevron open={servicesOpen} />
              <span className={`${CLASSNAME}__code-fold-label`}>services</span>
              <span className={`${CLASSNAME}__lynx-tag`}>SystemLynx</span>
            </button>
            {!servicesOpen ? null : [...services, ...dynamicServices].length ? (
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
            {/* GIT SURVIVES THE FOLD. Everything about committing — the lens, the groups, the box —
                lives inside this fold, so with it closed the panel said nothing at all: no changes,
                no branch, no hint that a commit happens here ("why wouldn't it show something
                indicating, rather than you don't even know the feature is existing"). The same
                badge a collapsed FOLDER already wears, doing the same job one level up: press it
                and the fold opens straight into version control. */}
            {!codeOpen && changed.size > 0 && (
              <span
                className={`${CLASSNAME}__code-git`}
                role="button"
                tabIndex={0}
                title={`${changed.size} changed file${changed.size === 1 ? "" : "s"}${
                  gitState && gitState.branch ? ` on ${gitState.branch}` : ""
                } — open version control`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCodeOpen(true);
                  setVcLens(true);
                  localStorage.setItem("sv.cbNav.vcLens", "true");
                }}
              >
                <BranchIcon />
                {gitState && gitState.branch && (
                  <span className={`${CLASSNAME}__code-git-branch`}>{gitState.branch}</span>
                )}
                {changed.size}
              </span>
            )}
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
                {/* VERSION CONTROL — the branch icon IS the control, with the count riding on it.
                    Click to swap the tree for git's groups; click again to come back. */}
                {/* A CONTROL THAT IS ON MUST STAY ON SCREEN. Gated on `changed.size` alone, committing
                    everything removed the only way OUT of the lens — the tree was replaced by three
                    empty groups with nothing left to click. His words: "there's no way to get out of
                    it… there's nothing to unfilter". True of any toggle whose visibility depends on
                    the content it filters. */}
                {(changed.size > 0 || vcLens) && (
                  <button
                    type="button"
                    className={`${CLASSNAME}__filter-pill ${CLASSNAME}__filter-pill--vc ${vcLens ? `${CLASSNAME}__filter-pill--vc-on` : ""}`}
                    title={
                      vcLens
                        ? "Back to the file tree"
                        : `Version control — ${changed.size} file${changed.size > 1 ? "s" : ""} changed vs git HEAD, staged and unstaged`
                    }
                    onClick={flipToggle("sv.cbNav.vcLens", vcLens, setVcLens)}
                  >
                    <BranchIcon />
                    <span className={`${CLASSNAME}__filter-pill-n`}>{changed.size}</span>
                  </button>
                )}
                {/* Only files that have comments on them — the same icon they wear in the tree, and
                    the count of them. Drawn only when there ARE any: a 0 pill is a dead control. */}
                {/* Same rule — and I had just rebuilt the same trap here: delete the last comment
                    while filtered to comments and the pill would vanish with the filter still on. */}
                {(commented.size > 0 || commentsOnly) && (
                  <button
                    type="button"
                    className={`${CLASSNAME}__filter-pill ${CLASSNAME}__filter-pill--comments ${
                      commentsOnly ? `${CLASSNAME}__filter-pill--on` : ""
                    }`}
                    title={
                      commentsOnly
                        ? "Back to every file"
                        : `Only the ${commented.size} file${commented.size > 1 ? "s" : ""} with comments`
                    }
                    onClick={flipToggle("sv.cbNav.commentsOnly", commentsOnly, setCommentsOnly)}
                  >
                    💬
                    <span className={`${CLASSNAME}__filter-pill-n`}>{commented.size}</span>
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
              </div>
              {truncated && (
                <div className={`${CLASSNAME}__truncated`}>
                  ⚠ big repo — the file list is capped; the alphabetical tail is cut off
                </div>
              )}
              {vcError && <div className={`${CLASSNAME}__vc-error`}>{vcError}</div>}
              {/* THE LENS ALWAYS SAYS WHERE THE COMMIT GOES. It used to draw nothing at all until
                  git answered, so the panel could sit there with no sign the feature existed — you
                  can't wait for something you don't know is coming. Now the box's place is always
                  taken: reading git…, or the reason there will never be one. */}
              {vcLens && !(gitState && gitState.repo) && (
                <div
                  ref={commitBoxRef}
                  className={`${CLASSNAME}__commit ${CLASSNAME}__commit--waiting${took ? ` ${CLASSNAME}__commit--took` : ""}`}
                >
                  <span className={`${CLASSNAME}__commit-wait`}>
                    {gitProbe === "loading"
                      ? "reading git…"
                      : gitProbe === "old"
                        ? "commits need systemview-plugin@2.18.0 or newer — update and restart"
                        : gitProbe === "notrepo"
                          ? "not a git repo — nothing to commit to"
                          : "git isn't answering — the box comes back when it does"}
                  </span>
                </div>
              )}
              {vcLens && gitState && gitState.repo && (
                <div
                  ref={commitBoxRef}
                  className={`${CLASSNAME}__commit${took ? ` ${CLASSNAME}__commit--took` : ""}`}
                >
                  <div className={`${CLASSNAME}__commit-head`}>
                    <span className={`${CLASSNAME}__commit-branch`}>{gitState.branch}</span>
                    {gitState.ahead > 0 && (
                      <span className={`${CLASSNAME}__commit-ahead`}>↑{gitState.ahead}</span>
                    )}
                    {gitState.behind > 0 && (
                      <span className={`${CLASSNAME}__commit-behind`}>↓{gitState.behind}</span>
                    )}
                    {/* Same switch the block has — commit, flip to the log to watch it, come back. */}
                    <span className={`${CLASSNAME}__commit-tabs`}>
                      <button
                        type="button"
                        className={`${CLASSNAME}__commit-tab${vcTab === "changes" ? ` ${CLASSNAME}__commit-tab--on` : ""}`}
                        onClick={() => setVcTab("changes")}
                      >
                        {gitState.stagedCount} staged
                      </button>
                      <button
                        type="button"
                        className={`${CLASSNAME}__commit-tab${vcTab === "log" ? ` ${CLASSNAME}__commit-tab--on` : ""}`}
                        onClick={() => setVcTab("log")}
                      >
                        log
                      </button>
                    </span>
                  </div>
                  {/* Reads as TEXT until you click into it — his note: it shouldn't announce
                      itself as a form field before you touch it. */}
                  {/* The button rides WITH the message — no separate row underneath — and a long
                      message wraps rather than running off the side. */}
                  <div className={`${CLASSNAME}__commit-row`}>
                    {typing ? (
                      <textarea
                        className={`${CLASSNAME}__commit-msg`}
                        placeholder="commit message"
                        value={message}
                        rows={Math.min(5, Math.max(1, Math.ceil(message.length / 34)))}
                        autoFocus
                        onChange={(e) => setMessage(e.target.value)}
                        onBlur={() => setTyping(false)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setArmed("");
                            setTyping(false);
                          }
                        }}
                      />
                    ) : (
                      <div
                        className={`${CLASSNAME}__commit-msg${message ? "" : ` ${CLASSNAME}__commit-msg--empty`}`}
                        role="button"
                        title="Click to write the commit message"
                        onClick={() => setTyping(true)}
                      >
                        {message || "commit message"}
                      </div>
                    )}
                    <span className={`${CLASSNAME}__commit-acts`}>
                      <button
                        type="button"
                        className={`${CLASSNAME}__commit-btn${armed === "commit" ? ` ${CLASSNAME}__commit-btn--armed` : ""}`}
                        disabled={!gitState.stagedCount || !message.trim() || vcBusy === "commit"}
                        title={
                          !gitState.stagedCount
                            ? "Nothing is staged"
                            : !message.trim()
                              ? "A commit needs a message"
                              : "Commits what is staged — click twice"
                        }
                        onClick={() => runGit("commit")}
                      >
                        {vcBusy === "commit"
                          ? "…"
                          : armed === "commit"
                            ? "confirm"
                            : "Commit"}
                      </button>
                      {gitState.ahead > 0 && (
                        <button
                          type="button"
                          className={`${CLASSNAME}__commit-btn${armed === "push" ? ` ${CLASSNAME}__commit-btn--armed` : ""}`}
                          disabled={vcBusy === "push"}
                          title={`${gitState.branch} → ${gitState.upstream || "its upstream"}`}
                          onClick={() => runGit("push")}
                        >
                          {vcBusy === "push"
                            ? "…"
                            : armed === "push"
                              ? "confirm"
                              : `Push ↑${gitState.ahead}`}
                        </button>
                      )}
                      {armed && (
                        <button
                          type="button"
                          className={`${CLASSNAME}__commit-cancel`}
                          onClick={() => setArmed("")}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  </div>
                  {/* What git actually said — the "3 files changed" line, or why a hook stopped it. */}
                  {gitOut && <pre className={`${CLASSNAME}__commit-out`}>{gitOut}</pre>}
                </div>
              )}
              {/* The log, in the panel: same switch, same history the block shows. */}
              {vcLens && vcTab === "log" && gitState && gitState.repo && (
                <div className={`${CLASSNAME}__tree`}>
                  {/* THE LOG SAYS WHAT IS NOT PUSHED. A history where a committed line and a pushed
                      one look identical is a history you have to check somewhere else. The plugin
                      marks each commit (`upstream..HEAD`, git's own answer); on an older plugin the
                      top `ahead` rows are the unpushed ones, which is the same answer for a linear
                      history and is the most we can honestly say without it. */}
                  {gitState.log && gitState.log.length ? (
                    (() => {
                      const knows = gitState.log.some((c) => typeof c.pushed === "boolean");
                      const isUnpushed = (c, i) =>
                        knows ? !c.pushed : !gitState.upstream || i < (gitState.ahead || 0);
                      const n = gitState.log.filter(isUnpushed).length;
                      return (
                        <>
                          {n > 0 && (
                            <div className={`${CLASSNAME}__logmark`}>
                              ↑ {n} not pushed
                              {!gitState.upstream && " — this branch tracks nothing"}
                            </div>
                          )}
                          {gitState.log.map((c, i) => (
                            <div
                              key={c.sha}
                              className={`${CLASSNAME}__logrow${isUnpushed(c, i) ? ` ${CLASSNAME}__logrow--unpushed` : ""}`}
                              title={`${c.subject} — ${c.who}${isUnpushed(c, i) ? " · not pushed" : ""}`}
                            >
                              <code className={`${CLASSNAME}__logsha`}>{c.sha}</code>
                              <span className={`${CLASSNAME}__logsubj`}>{c.subject}</span>
                              <span className={`${CLASSNAME}__logwhen`}>{c.when}</span>
                            </div>
                          ))}
                        </>
                      );
                    })()
                  ) : (
                    <div className={`${CLASSNAME}__empty`}>no commits yet</div>
                  )}
                </div>
              )}
              {vcLens ? (
                <div className={`${CLASSNAME}__tree`} hidden={vcTab === "log"}>
                  {/* SAY IT when there's nothing left, instead of drawing three empty headings that
                      read as a broken panel — this is what you see right after committing. */}
                  {changed.size === 0 ? (
                    <div className={`${CLASSNAME}__empty`}>
                      nothing to commit — the branch is clean
                    </div>
                  ) : (
                    !vcGroups.staged.length &&
                    !vcGroups.unstaged.length &&
                    !vcGroups.untracked.length && (
                      <div className={`${CLASSNAME}__empty`}>
                        {changed.size} changed file{changed.size === 1 ? "" : "s"} — none match the filter
                      </div>
                    )
                  )}
                  {renderVcGroup("staged", "staged", vcGroups.staged)}
                  {renderVcGroup("unstaged", "changes", vcGroups.unstaged)}
                  {renderVcGroup("untracked", "untracked", vcGroups.untracked)}
                </div>
              ) : (
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
                          renderNewIn={renderNewIn}
                          changedCounts={changedCounts}
                          dirMenu={dirMenu}
                          onDropFile={onDropFile}
                          dropDir={dropDir}
                          setDropDir={setDropDir}
                        />
                      ))}
                    {tree.files.map((f) => renderFile(f, 0))}
                    {renderNewIn("", 0)}
                  </>
                )}
                {filtered && !filtered.length && (
                  <div className={`${CLASSNAME}__empty`}>no match</div>
                )}
              </div>
              )}
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
