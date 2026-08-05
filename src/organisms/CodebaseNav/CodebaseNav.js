import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import loadServiceWithHeaders from "../../utils/loadService";
import DocIcon from "../../atoms/DocsIcon/DocsIcon";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";
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

// A project-defined (dynamic) service — a MINI SystemLynx tree living under its codebase. Fully
// navigable like the SystemLynx section: service/module/method all select + route, the current
// namespace highlights, and navigating hands the center back to docs/tests (closes any open file).
function DynamicService({ service, projectCode, history, selection, onNavigate }) {
  const isSelectedService =
    selection.serviceId === service.serviceId && selection.projectCode === projectCode;
  const [open, setOpen] = useState(isSelectedService);
  const modules = ((service.system || {}).connectionData || {}).modules || [];
  const go = (path) => {
    onNavigate(); // close the open code file — namespace navigation shows the namespace center
    history.push(path);
  };
  return (
    <div className={`${CLASSNAME}__dyn-service`}>
      <button
        type="button"
        className={`${CLASSNAME}__service ${isSelectedService && !selection.moduleName ? `${CLASSNAME}__service--selected` : ""}`}
        title="Open this project-defined service (SystemLynx namespace surface)"
        onClick={() => {
          setOpen(true);
          go(`/specs/${projectCode}/${service.serviceId}`);
        }}
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
        <span className={`${CLASSNAME}__service-dot`} />
        {service.serviceId}
      </button>
      {open && (
        <div className={`${CLASSNAME}__dyn-modules`}>
          {modules.map((m) => {
            const isSelectedModule = isSelectedService && selection.moduleName === m.name;
            const specList = service.specList || { tests: [], docs: [] };
            return (
              <div key={m.name}>
                <button
                  type="button"
                  className={`${CLASSNAME}__dyn-module ${isSelectedModule && !selection.methodName ? `${CLASSNAME}__dyn-module--selected` : ""}`}
                  onClick={() =>
                    go(`/specs/${projectCode}/${service.serviceId}/${m.name}`)
                  }
                >
                  {m.name}
                  <span className={`${CLASSNAME}__dyn-icons`}>
                    <DocIcon isSaved={(specList.docs || []).includes(`${m.name}.md`)} />
                  </span>
                </button>
                {(m.methods || []).map((fn) => (
                  <button
                    key={fn.fn}
                    type="button"
                    className={`${CLASSNAME}__dyn-method ${isSelectedModule && selection.methodName === fn.fn ? `${CLASSNAME}__dyn-method--selected` : ""}`}
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
                ))}
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

// One connected codebase: header, filter, file tree, and its project-defined services.
function Codebase({ entry, isCurrent, openFile, onOpenFile, selection, onNavigate }) {
  const { projectCode, fileHost, dynamicServices } = entry;
  const history = useHistory();
  // The codebase HOLDING the open file starts (and stays) expanded — coming back to this tab with a
  // file open must land you on its selection, not a collapsed card.
  const holdsOpenFile = !!(openFile && openFile.projectCode === projectCode);
  const [open, setOpen] = useState(isCurrent || holdsOpenFile);
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

  useEffect(() => {
    if (holdsOpenFile) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdsOpenFile && openFile.path]);

  // (Re)load the file list on EVERY expand — a fresh tree + fresh changed-dots each time the codebase
  // opens, so edits/commits made since the last look actually show. Previous list stays while loading.
  useEffect(() => {
    if (!open || !fileHost) return;
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
    // fileHost identity is a dep: on a refresh the card can mount OPEN before the services have
    // connected — the list must load when the host ARRIVES, not only on the next expand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileHost && fileHost.serviceId]);

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
    return (
      <button
        key={f.path}
        type="button"
        // Scroll the selected row into view ONCE per open file — arriving with a file open lands
        // right on it, without re-scrolling on every unrelated render.
        ref={
          selected
            ? (el) => {
                if (el && scrolledTo.current !== f.path) {
                  scrolledTo.current = f.path;
                  el.scrollIntoView({ block: "center" });
                }
              }
            : undefined
        }
        className={`${CLASSNAME}__row ${CLASSNAME}__row--file ${selected ? `${CLASSNAME}__row--selected` : ""}`}
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
      <button
        type="button"
        className={`${CLASSNAME}__cb-head`}
        onClick={() => setOpen(!open)}
      >
        <Chevron open={open} />
        <span className={`${CLASSNAME}__cb-badge`}>codebase</span>
        <span className={`${CLASSNAME}__cb-name`}>{projectCode}</span>
        {files && (
          <span className={`${CLASSNAME}__cb-count`}>
            {files.length}
            {truncated ? "+" : ""}
          </span>
        )}
      </button>
      {open && (
        <div className={`${CLASSNAME}__cb-body`}>
          {/* Project-defined services (RFC-021) — synthesized namespaces owned by this codebase.
              Expandable IN PLACE: service → modules → methods, so you SEE the map immediately;
              clicking a method points the page (and the scratchpad) at that namespace. */}
          <div className={`${CLASSNAME}__services`}>
            <div className={`${CLASSNAME}__section-label`}>
              project-testing services
              <span className={`${CLASSNAME}__lynx-tag`}>SystemLynx</span>
            </div>
            {dynamicServices.length ? (
              dynamicServices.map((s) => (
                <DynamicService
                  key={s.serviceId}
                  service={s}
                  projectCode={projectCode}
                  history={history}
                  selection={selection}
                  onNavigate={onNavigate}
                />
              ))
            ) : (
              <div className={`${CLASSNAME}__empty`}>
                none yet — an agent can define them (docs/namespaces-for-agents.md)
              </div>
            )}
          </div>

          {!fileHost && (
            <div className={`${CLASSNAME}__empty`}>no live service with file access</div>
          )}
          {error && <div className={`${CLASSNAME}__empty`}>{error}</div>}
          {fileHost && !files && !error && (
            <div className={`${CLASSNAME}__empty`}>loading files…</div>
          )}

          {files && (
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
      )}
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
  theme = "light",
}) => {
  const selection = { projectCode, serviceId, moduleName, methodName };
  const onNavigate = () => onOpenFile(null); // namespace navigation closes the open code file
  // A codebase = a project. Its file host = the first LIVE (non-dynamic) service exposing the plugin
  // file providers (siblings share a cwd, so one host serves the whole project's tree). Its
  // project-defined services = the RFC-021 dynamic entries registered under the project.
  const codebases = useMemo(() => {
    const byProject = {};
    connectedServices.forEach((s) => {
      if (!byProject[s.projectCode])
        byProject[s.projectCode] = {
          projectCode: s.projectCode,
          fileHost: null,
          dynamicServices: [],
        };
      const cb = byProject[s.projectCode];
      if (s.dynamic) cb.dynamicServices.push(s);
      else if (
        !cb.fileHost &&
        (((s.system || {}).connectionData || {}).modules || []).some(
          (m) => m.name === "Plugin",
        )
      )
        cb.fileHost = s;
    });
    return Object.values(byProject);
  }, [connectedServices]);

  if (!codebases.length)
    return <div className={`${CLASSNAME}__empty`}>No connected codebases.</div>;

  return (
    <div className={`${CLASSNAME} ${theme === "dark" ? `${CLASSNAME}--dark` : ""}`}>
      {codebases.map((cb) => (
        <Codebase
          key={cb.projectCode}
          entry={cb}
          isCurrent={cb.projectCode === projectCode}
          openFile={openFile}
          onOpenFile={onOpenFile}
          selection={selection}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
};

export default CodebaseNav;
