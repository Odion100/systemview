import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom";
import ReactJson from "react-json-view";
import moment from "moment";
import { Client } from "systemlynx-client";
import ServiceContext from "../../ServiceContext";
import LOGO from "../../assets/sysly.png";
import "./styles.scss";


const LEVEL_CLASS = {
  trace: "dim",
  log: "log",
  info: "info",
  warn: "warn",
  error: "error",
  debug: "debug",
};

function formatTime(ts) {
  return moment(ts).format("MMM D, YYYY HH:mm:ss");
}

function isDateString(v) {
  return v != null && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(new Date(v).getTime());
}

function getKeyPaths(entries) {
  const paths = new Set();
  entries.forEach((e) => {
    Object.keys(e).forEach((k) => { paths.add(k); });
  });
  return [...paths].sort();
}

function getChildInfo(entries, pathSegments) {
  const info = {};
  entries.forEach((e) => {
    let cur = e;
    for (const seg of pathSegments) {
      if (cur == null || typeof cur !== "object") {
        cur = undefined;
        break;
      }
      cur = cur[seg];
    }
    if (cur == null || typeof cur !== "object") return;
    Object.keys(cur).forEach((k) => {
      if (!info[k]) info[k] = { isObject: false, isPrimitive: false };
      const v = cur[k];
      if (v !== null && v !== undefined) {
        if (typeof v === "object") info[k].isObject = true;
        else info[k].isPrimitive = true;
      }
    });
  });
  return info;
}

function matchesVal(entryVal, filterVal) {
  if (filterVal === "?+") return entryVal != null;
  if (filterVal === "?-") return entryVal == null;
  if (entryVal == null) return false;
  if (typeof filterVal === "string" && filterVal.startsWith("~")) {
    try { return new RegExp(filterVal.slice(1), "i").test(String(entryVal)); } catch { return false; }
  }
  const cmp = typeof filterVal === "string" && filterVal.match(/^(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (cmp) {
    const n = parseFloat(String(entryVal));
    const num = parseFloat(cmp[2]);
    if (isNaN(n)) return false;
    if (cmp[1] === ">")  return n > num;
    if (cmp[1] === "<")  return n < num;
    if (cmp[1] === ">=") return n >= num;
    if (cmp[1] === "<=") return n <= num;
  }
  return String(entryVal) === filterVal;
}

function getAtPath(obj, path) {
  return path.split(".").reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);
}

function countByPath(entries, path) {
  const counts = {};
  entries.forEach((e) => {
    const val = getAtPath(e, path);
    if (val == null) return;
    const key = typeof val === "object" ? JSON.stringify(val) : String(val);
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
}

function FreqPanel({ title, path, rows, onRemove, onRowClick, quickFilters }) {
  return (
    <div className="dash-panel">
      <div className="dash-panel__header">
        <span>{title}</span>
        {onRemove && (
          <button className="dash-panel__remove" onClick={onRemove}>
            ×
          </button>
        )}
      </div>
      <div className="dash-panel__body">
        {rows.length === 0 ? (
          <p className="dash-panel__empty">—</p>
        ) : (
          <table className="dash-panel__table">
            <tbody>
              {rows.map(([val, count]) => (
                <tr
                  key={val}
                  className={`dash-panel__row${(quickFilters[path] || []).includes(val) ? " dash-panel__row--active" : ""}`}
                  onClick={() => onRowClick && onRowClick(path, val)}
                >
                  <td className="dash-panel__val">{val}</td>
                  <td className="dash-panel__count">×{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FieldAnalyzer({
  entries,
  keyPaths,
  onRemove,
  onRowClick,
  quickFilters,
  onPathChange,
  dateRangeFilters,
  onDateRange,
  conjunction,
  onConjunctionChange,
  slotId,
  initialField,
}) {
  const [field, setField] = useState(initialField || "");
  const [drillSegments, setDrillSegments] = useState([]);
  const [search, setSearch] = useState("");
  const [customValues, setCustomValues] = useState([]);

  const fullPath = field
    ? drillSegments.length > 0
      ? `${field}.${drillSegments.join(".")}`
      : field
    : "";
  const valuesAreObjects = useMemo(() => {
    if (!fullPath) return false;
    return entries.some((e) => {
      const v = getAtPath(e, fullPath);
      return v !== null && v !== undefined && typeof v === "object";
    });
  }, [entries, fullPath]);

  const valuesAreDates = useMemo(() => {
    if (!fullPath || valuesAreObjects) return false;
    return entries.some((e) => isDateString(getAtPath(e, fullPath)));
  }, [entries, fullPath, valuesAreObjects]);

  const activeVals = quickFilters[slotId] || [];

  useEffect(() => {
    const hasPresenceFilter = activeVals.some((v) => v === "?+" || v === "?-");
    const resolved = fullPath && !valuesAreDates && (!valuesAreObjects || hasPresenceFilter) ? fullPath : null;
    onPathChange && onPathChange({ resolved, display: fullPath || null });
  }, [fullPath, valuesAreObjects, valuesAreDates, quickFilters, slotId]);

  const childInfo = useMemo(() => {
    if (!valuesAreObjects) return {};
    return getChildInfo(entries, fullPath ? fullPath.split(".") : []);
  }, [entries, fullPath, valuesAreObjects]);

  const presenceCounts = useMemo(() => {
    if (!fullPath) return null;
    let has = 0, missing = 0;
    entries.forEach((e) => { getAtPath(e, fullPath) != null ? has++ : missing++; });
    return { has, missing };
  }, [entries, fullPath]);

  const allFreqs = !valuesAreObjects && fullPath ? countByPath(entries, fullPath) : [];
  const freqs = search
    ? allFreqs.filter(([val]) => {
        if (matchesVal(val, search)) return true;
        try { return new RegExp(search, "i").test(val); } catch { return val.includes(search); }
      })
    : allFreqs;

  function handleFieldChange(newField) {
    if (fullPath && onDateRange) onDateRange(fullPath, "", "");
    setField(newField);
    setDrillSegments([]);
    setSearch("");
    setCustomValues([]);
  }

  function drillInto(key) {
    setDrillSegments((prev) => [...prev, key]);
    setSearch("");
  }

  function jumpToDrill(index) {
    setDrillSegments((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
    setSearch("");
  }

  function applySearch() {
    if (!search || !fullPath) return;
    const isComparison = /^(>=|<=|>|<)/.test(search);
    const val = isComparison ? search : `~${search}`;
    setCustomValues((prev) => prev.includes(val) ? prev : [...prev, val]);
    onRowClick(fullPath, val);
    setSearch("");
  }

  const hasDrill = field && drillSegments.length > 0;

  return (
    <div className={`dash-panel${hasDrill ? " dash-panel--wide" : ""}`}>
      <div className="dash-panel__header">
        <button
          className={`field-analyzer__conj${conjunction === "or" ? " field-analyzer__conj--or" : ""}`}
          title={conjunction === "and" ? "& AND — intersect with other filters" : "|| OR — union with other filters"}
          onClick={() => onConjunctionChange && onConjunctionChange(conjunction === "and" ? "or" : "and")}
        >
          {conjunction === "and" ? "&" : "||"}
        </button>
        {hasDrill ? (
          <div className="field-analyzer__crumbs">
            <span className="field-analyzer__crumb" onClick={() => jumpToDrill(-1)}>
              {field}
            </span>
            {drillSegments.map((seg, i) => (
              <span
                key={i}
                className="field-analyzer__crumb"
                onClick={() => jumpToDrill(i)}
              >
                &nbsp;›&nbsp;{/^\d+$/.test(seg) ? `[${seg}]` : seg}
              </span>
            ))}
          </div>
        ) : (
          <select
            className="dash-panel__field-select"
            value={field}
            onChange={(e) => handleFieldChange(e.target.value)}
          >
            <option value="">— analyze field —</option>
            {keyPaths.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        <button className="dash-panel__remove" onClick={onRemove}>
          ×
        </button>
      </div>
      <div className="dash-panel__body">
        {!field ? null : valuesAreDates ? (
          <table className="dash-panel__table">
            <tbody>
              <tr className="dash-panel__row dash-panel__row--date">
                <td className="dash-panel__val dash-panel__val--date-label">from</td>
                <td className="dash-panel__val--date-input">
                  <input
                    type="datetime-local"
                    value={(dateRangeFilters && dateRangeFilters[fullPath] && dateRangeFilters[fullPath].from) || ""}
                    onChange={(e) => onDateRange && onDateRange(fullPath, e.target.value, (dateRangeFilters && dateRangeFilters[fullPath] && dateRangeFilters[fullPath].to) || "")}
                  />
                </td>
              </tr>
              <tr className="dash-panel__row dash-panel__row--date">
                <td className="dash-panel__val dash-panel__val--date-label">to</td>
                <td className="dash-panel__val--date-input">
                  <input
                    type="datetime-local"
                    value={(dateRangeFilters && dateRangeFilters[fullPath] && dateRangeFilters[fullPath].to) || ""}
                    onChange={(e) => onDateRange && onDateRange(fullPath, (dateRangeFilters && dateRangeFilters[fullPath] && dateRangeFilters[fullPath].from) || "", e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        ) : valuesAreObjects ? (
          Object.keys(childInfo).length === 0 ? (
            <p className="dash-panel__empty">no sub-fields</p>
          ) : (
            <table className="dash-panel__table">
              <tbody>
                {presenceCounts && (
                  <>
                    <tr
                      className={`dash-panel__row dash-panel__row--presence${activeVals.includes("?+") ? " dash-panel__row--active" : ""}`}
                      onClick={() => onRowClick(fullPath, "?+")}
                    >
                      <td className="dash-panel__val dash-panel__val--presence">has value</td>
                      <td className="dash-panel__count">×{presenceCounts.has}</td>
                    </tr>
                    <tr
                      className={`dash-panel__row dash-panel__row--presence${activeVals.includes("?-") ? " dash-panel__row--active" : ""}`}
                      onClick={() => onRowClick(fullPath, "?-")}
                    >
                      <td className="dash-panel__val dash-panel__val--presence">null / missing</td>
                      <td className="dash-panel__count">×{presenceCounts.missing}</td>
                    </tr>
                    <tr className="dash-panel__row--divider"><td colSpan={2} /></tr>
                  </>
                )}
                {Object.entries(childInfo).map(([key, { isObject }]) => (
                  <tr
                    key={key}
                    className="dash-panel__row"
                    onClick={() => drillInto(key)}
                  >
                    <td className="dash-panel__val">{/^\d+$/.test(key) ? `[${key}]` : key}</td>
                    <td className="dash-panel__count">
                      {isObject ? <span className="field-analyzer__drill">▶</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <table className="dash-panel__table">
            <tbody>
              <tr className="dash-panel__row dash-panel__row--search">
                <td className="dash-panel__val">
                  <input
                    className="field-analyzer__search"
                    placeholder="regex filter…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applySearch()}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td
                  className="dash-panel__count field-analyzer__apply"
                  onClick={applySearch}
                >
                  {search ? "→" : ""}
                </td>
              </tr>
              {presenceCounts && (
                <>
                  <tr className="dash-panel__row--divider"><td colSpan={2} /></tr>
                  <tr
                    className={`dash-panel__row dash-panel__row--presence${activeVals.includes("?+") ? " dash-panel__row--active" : ""}`}
                    onClick={() => onRowClick(fullPath, "?+")}
                  >
                    <td className="dash-panel__val dash-panel__val--presence">has value</td>
                    <td className="dash-panel__count">×{presenceCounts.has}</td>
                  </tr>
                  <tr
                    className={`dash-panel__row dash-panel__row--presence${activeVals.includes("?-") ? " dash-panel__row--active" : ""}`}
                    onClick={() => onRowClick(fullPath, "?-")}
                  >
                    <td className="dash-panel__val dash-panel__val--presence">null / missing</td>
                    <td className="dash-panel__count">×{presenceCounts.missing}</td>
                  </tr>
                  <tr className="dash-panel__row--divider"><td colSpan={2} /></tr>
                </>
              )}
              {customValues.map((v) => (
                <tr
                  key={v}
                  className={`dash-panel__row dash-panel__row--custom${activeVals.includes(v) ? " dash-panel__row--active" : ""}`}
                  onClick={() => onRowClick(fullPath, v)}
                >
                  <td className="dash-panel__val">{v.startsWith("~") ? `/${v.slice(1)}/` : v}</td>
                  <td className="dash-panel__count">×</td>
                </tr>
              ))}
              {freqs.length === 0 ? (
                <tr>
                  <td colSpan={2} className="dash-panel__empty">
                    no matches
                  </td>
                </tr>
              ) : (
                freqs.map(([val, count]) => (
                  <tr
                    key={val}
                    className={`dash-panel__row ${activeVals.includes(val) ? "dash-panel__row--active" : ""}`}
                    onClick={() => onRowClick(fullPath, val)}
                  >
                    <td className="dash-panel__val">{val}</td>
                    <td className="dash-panel__count">×{count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Dashboard({
  entries,
  getContextEntries,
  quickFilters,
  onToggleFilter,
  onClearFilter,
  onAnalyzerSlotsChange,
  dateRangeFilters,
  onDateRange,
  initialPaths,
}) {
  const [analyzers, setAnalyzers] = useState(() => {
    const pre = (initialPaths || []).map((p) => ({ id: `url-${p}`, resolvedPath: p, displayPath: p, conjunction: "and" }));
    return [...pre, { id: Date.now(), resolvedPath: null, conjunction: "and" }];
  });
  const traceEntries = entries.filter((e) => e.level === "trace");
  const keyPaths = getKeyPaths(entries);

  const lastResolved = analyzers[analyzers.length - 1]?.resolvedPath;

  useEffect(() => {
    if (initialPaths && initialPaths.length) reportState(analyzers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reportState(next) {
    onAnalyzerSlotsChange(next.map((x) => ({
      id: x.id,
      path: x.resolvedPath,
      displayPath: x.displayPath,
      conjunction: x.conjunction,
    })).filter((x) => x.path || x.displayPath));
  }

  function addAnalyzer() {
    setAnalyzers((a) => [...a, { id: Date.now(), resolvedPath: null, conjunction: "and" }]);
  }

  function removeAnalyzer(id) {
    setAnalyzers((a) => {
      onClearFilter(id);
      const next = a.filter((x) => x.id !== id);
      reportState(next);
      return next;
    });
  }

  function updateResolvedPath(id, { resolved, display }) {
    setAnalyzers((a) => {
      const prev = a.find((x) => x.id === id);
      if (prev?.resolvedPath && prev.resolvedPath !== resolved) {
        onClearFilter(id);
      }
      const next = a.map((x) => (x.id === id ? { ...x, resolvedPath: resolved, displayPath: display } : x));
      reportState(next);
      return next;
    });
  }

  function updateConjunction(id, conjunction) {
    setAnalyzers((a) => {
      const next = a.map((x) => (x.id === id ? { ...x, conjunction } : x));
      reportState(next);
      return next;
    });
  }

  return (
    <div className="dashboard">
      <div className="dashboard__panels">
        {traceEntries.length > 0 && (
          <FreqPanel
            title="Call counts"
            path="moduleMethod"
            rows={countByPath(traceEntries, "moduleMethod")}
            quickFilters={quickFilters}
            onRowClick={onToggleFilter}
          />
        )}
        {analyzers.map((a) => (
          <FieldAnalyzer
            key={a.id}
            entries={a.conjunction === "and" ? getContextEntries(a.resolvedPath) : entries}
            keyPaths={keyPaths}
            onRemove={() => removeAnalyzer(a.id)}
            onPathChange={(path) => updateResolvedPath(a.id, path)}
            quickFilters={quickFilters}
            onRowClick={(path, val) => onToggleFilter(a.id, val)}
            dateRangeFilters={dateRangeFilters}
            onDateRange={onDateRange}
            conjunction={a.conjunction}
            onConjunctionChange={(c) => updateConjunction(a.id, c)}
            slotId={a.id}
            initialField={a.displayPath || a.resolvedPath || ""}
          />
        ))}
        {(analyzers.length === 0 || lastResolved) && (
          <button className="dashboard__add" onClick={addAnalyzer}>
            + Analyze field
          </button>
        )}
      </div>
    </div>
  );
}

const FIXED_PATHS = new Set([
  "timestamp",
  "projectCode",
  "serviceId",
  "moduleMethod",
  "level",
  "scope",
  "traceId",
]);

function displayPath(path) {
  return path
    .split(".")
    .map((seg, i) => {
      if (/^\d+$/.test(seg)) return `[${seg}]`;
      return i === 0 ? seg : `.${seg}`;
    })
    .join("");
}

function cellValue(entry, path) {
  const v = getAtPath(entry, path);
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return Array.isArray(v) ? `[${v.length}]` : "{…}";
  return String(v);
}

export function LogRow({ entry, isExpanded, onToggle, dynamicColumns, filteredFixedPaths, compact, isNew }) {
  const level = entry.level || "info";
  const isTrace = level === "trace";
  const msg = isTrace
    ? entry.duration != null ? `${entry.duration}ms` : ""
    : typeof entry.scope === "string" ? entry.scope : JSON.stringify(entry.scope) || "";
  const shortTraceId = entry.traceId || "—";

  return (
    <>
      <div
        className={`log-row${isTrace ? " log-row--dim" : ""} log-row--clickable${isExpanded ? " log-row--active" : ""}${isNew ? " log-row--new" : ""}`}
        onClick={onToggle}
      >
        <div className="log-cell log-cell--time">{formatTime(entry.timestamp)}</div>
        {!compact && <div className={`log-cell log-cell--project${filteredFixedPaths?.has("projectCode") ? " log-cell--filtered" : ""}`}>{entry.projectCode || "—"}</div>}
        {!compact && <div className={`log-cell log-cell--service${filteredFixedPaths?.has("serviceId") ? " log-cell--filtered" : ""}`}>{entry.serviceId || "—"}</div>}
        <div className={`log-cell log-cell--method${filteredFixedPaths?.has("moduleMethod") ? " log-cell--filtered" : ""}`}>{entry.moduleMethod || "—"}</div>
        <div className="log-cell log-cell--level">
          <span className={`log-level log-level--${LEVEL_CLASS[level] || "info"}`}>
            {level}
          </span>
        </div>
        <div className="log-cell log-cell--msg">
          {msg}
          {!isTrace && entry.duration != null && (
            <span className="log-duration"> {entry.duration}ms</span>
          )}
        </div>
        {!compact && <div className="log-cell log-cell--traceid" title={entry.traceId || ""}>{shortTraceId}</div>}
        {!compact && dynamicColumns &&
          dynamicColumns.map((path) => (
            <div key={path} className="log-cell log-cell--dynamic" title={path}>
              {cellValue(entry, path)}
            </div>
          ))}
      </div>
      {isExpanded && (
        <div className="log-row log-row--expanded" onClick={onToggle}>
          <div className="log-cell--detail" onClick={(e) => e.stopPropagation()}>
            <div className="log-data">
              <ReactJson
                src={entry}
                name={false}
                displayObjectSize={false}
                displayDataTypes={false}
                collapsed={1}
                theme="monokai"
                style={{ fontSize: "12px", fontFamily: "monospace", background: "transparent" }}
                enableClipboard={(copy) => { try { navigator.clipboard.writeText(typeof copy.src === "string" ? copy.src : JSON.stringify(copy.src, null, 2)); } catch {} }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Logs() {
  const { SystemViewService } = useContext(ServiceContext);
  const location = useLocation();
  const history = useHistory();

  const initParams = new URLSearchParams(location.search);
  const [entries, setEntries] = useState([]);
  const [connectedProjects, setConnectedProjects] = useState({});
  const [filterProject, setFilterProject] = useState(initParams.get("project") || "");
  const [filterService, setFilterService] = useState(initParams.get("service") || "");
  const [filterMethod, setFilterMethod] = useState(initParams.get("method") || "");
  const [filterLevel, setFilterLevel] = useState(initParams.get("level") || "");
  const _initTraceId = initParams.get("traceId") || "";
  const initAnalyzerPaths = [
    ...initParams.getAll("has"),
    ...initParams.getAll("missing"),
    ...(_initTraceId ? ["traceId"] : []),
  ];
  const [quickFilters, setQuickFilters] = useState(() => {
    const init = {};
    initParams.getAll("has").forEach((p) => { init[`url-${p}`] = ["?+"]; });
    initParams.getAll("missing").forEach((p) => { init[`url-${p}`] = ["?-"]; });
    if (_initTraceId) init["url-traceId"] = [_initTraceId];
    return init;
  });
  const [dateRangeFilters, setDateRangeFilters] = useState({});
  const [analyzerSlots, setAnalyzerSlots] = useState(() =>
    initAnalyzerPaths.map((p) => ({ id: `url-${p}`, path: p, displayPath: p, conjunction: "and" }))
  );
  const [expandedKey, setExpandedKey] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [newEntryKeys, setNewEntryKeys] = useState(new Set());
  const monitorUnsubs = useRef([]);
  const bodyRef = useRef(null);

  useEffect(() => {
    SystemViewService.SystemView.getProjects()
      .then((result) => {
        if (result && typeof result === "object") setConnectedProjects(result);
      })
      .catch(() => {});
  }, [SystemViewService]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterProject) params.set("project", filterProject);
    if (filterService) params.set("service", filterService);
    if (filterMethod) params.set("method", filterMethod);
    if (filterLevel) params.set("level", filterLevel);
    analyzerSlots.forEach((slot) => {
      const vals = quickFilters[slot.id] || [];
      if (slot.path && vals.includes("?+")) params.append("has", slot.path);
      else if (slot.path && vals.includes("?-")) params.append("missing", slot.path);
      else if (slot.path === "traceId" && vals.length > 0) params.set("traceId", vals[0]);
    });
    const qs = params.toString();
    window.history.replaceState(null, "", "/logs" + (qs ? "?" + qs : ""));
  }, [filterProject, filterService, filterMethod, filterLevel, analyzerSlots, quickFilters]);

  const loadLogs = useCallback(async () => {
    const allServices = Object.entries(connectedProjects).flatMap(([pc, services]) =>
      services.map((s) => ({ projectCode: pc, ...s }))
    );
    const targets = allServices.filter((s) =>
      (!filterProject || s.projectCode === filterProject) &&
      (!filterService || s.serviceId === filterService)
    );
    if (allServices.length > 0 && targets.length === 0) return;
    const all = [];
    for (const t of targets) {
      try {
        const { SystemView } = Client.createService(t.connectionData);
        const entries = await SystemView.getLog({ limit: 200 });
        if (Array.isArray(entries)) all.push(...entries);
      } catch {}
    }
    let result = filterMethod ? all.filter((e) => (e.moduleMethod && e.moduleMethod.includes(filterMethod)) || (e.method && e.method === filterMethod)) : all;
    result = result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-200);
    setEntries(result);
  }, [connectedProjects, filterProject, filterService, filterMethod]);

  useEffect(() => {
    if (isMonitoring) return;
    loadLogs();
  }, [loadLogs, isMonitoring]);

  // Monitor: subscribe to live log events per service; re-runs when filters or monitoring state changes
  useEffect(() => {
    if (!isMonitoring) return;
    monitorUnsubs.current.forEach((u) => u());
    monitorUnsubs.current = [];

    const allServices = Object.entries(connectedProjects).flatMap(([pc, svcs]) =>
      svcs.map((s) => ({ projectCode: pc, ...s }))
    );
    const targets = allServices.filter((s) =>
      (!filterProject || s.projectCode === filterProject) &&
      (!filterService || s.serviceId === filterService)
    );

    // Load current snapshot first so monitor starts with full context
    loadLogs();

    targets.forEach((t) => {
      try {
        const { SystemView } = Client.createService(t.connectionData);
        const unsub = SystemView.on("log", (entry) => {
          if (filterMethod && !((entry.moduleMethod && entry.moduleMethod.includes(filterMethod)) || (entry.method && entry.method === filterMethod))) return;
          const eKey = `${entry.timestamp}-${entry.traceId}-${entry.moduleMethod}`;
          setEntries((prev) => {
            if (prev.some((e) => e.timestamp === entry.timestamp && e.traceId === entry.traceId && e.moduleMethod === entry.moduleMethod)) return prev;
            return [...prev, entry];
          });
          setNewEntryKeys((prev) => new Set([...prev, eKey]));
          setTimeout(() => setNewEntryKeys((prev) => { const n = new Set(prev); n.delete(eKey); return n; }), 400);
        });
        monitorUnsubs.current.push(unsub);
      } catch {}
    });

    return () => {
      monitorUnsubs.current.forEach((u) => u());
      monitorUnsubs.current = [];
    };
  }, [isMonitoring, connectedProjects, filterProject, filterService, filterMethod, loadLogs]);

  useEffect(() => {
    if (!isMonitoring) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, isMonitoring]);


  const projects =
    Object.keys(connectedProjects).length > 0
      ? Object.keys(connectedProjects)
      : [...new Set(entries.map((e) => e.projectCode).filter(Boolean))];
  const services =
    Object.keys(connectedProjects).length > 0
      ? filterProject && connectedProjects[filterProject]
        ? connectedProjects[filterProject].map((s) => s.serviceId)
        : Object.values(connectedProjects)
            .flat()
            .map((s) => s.serviceId)
      : [...new Set(entries.map((e) => e.serviceId).filter(Boolean))];
  const methods = useMemo(() => {
    const projectServices = filterProject && connectedProjects[filterProject]
      ? connectedProjects[filterProject]
      : Object.values(connectedProjects).flat();
    const targetServices = filterService
      ? projectServices.filter((s) => s.serviceId === filterService)
      : projectServices;
    const moduleNames = new Set();
    const methodNames = new Set();
    targetServices.forEach(({ connectionData }) => {
      (connectionData.modules || []).forEach(({ name, methods: fns }) => {
        if (name === "Plugin" || name === "SystemView") return;
        moduleNames.add(name);
        (fns || []).forEach(({ fn }) => methodNames.add(`${name}.${fn}`));
      });
    });
    const result = [];
    moduleNames.forEach((mod) => {
      result.push({ label: mod, value: mod, isModule: true });
      methodNames.forEach((m) => {
        if (m.startsWith(mod + ".")) result.push({ label: `  ${m}`, value: m, isModule: false });
      });
    });
    return result;
  }, [connectedProjects, filterProject, filterService]);

  const dynamicColumns = analyzerSlots.map((s) => s.displayPath || s.path).filter((p) => p && !FIXED_PATHS.has(p));
  const filteredFixedPaths = useMemo(
    () => new Set(Object.keys(quickFilters).filter((k) => FIXED_PATHS.has(k) && (quickFilters[k] || []).length > 0)),
    [quickFilters]
  );

  // Build ordered filter chain: fixed panels (always OR) then analyzers (& or ||)
  const FIXED_FILTER_ORDER = ["moduleMethod"];
  const orderedFilters = [
    ...FIXED_FILTER_ORDER
      .filter((p) => (quickFilters[p] || []).length > 0)
      .map((p) => ({ path: p, vals: quickFilters[p], mode: "and", slotId: p })),
    ...analyzerSlots
      .filter((s) => s.path && (quickFilters[s.id] || []).length > 0)
      .map((s) => ({ path: s.path, vals: quickFilters[s.id], mode: s.conjunction, slotId: s.id })),
  ];

  // Group by precedence: & binds tighter, each || starts a new group
  const filterGroups = (() => {
    const groups = [];
    let current = [];
    orderedFilters.forEach((f, i) => {
      if (i === 0 || f.mode !== "and") {
        if (current.length) groups.push(current);
        current = [f];
      } else {
        current.push(f);
      }
    });
    if (current.length) groups.push(current);
    return groups;
  })();

  function handleDateRange(path, from, to) {
    setDateRangeFilters((prev) => {
      const next = { ...prev };
      if (!from && !to) delete next[path];
      else next[path] = { from, to };
      return next;
    });
  }

  let displayEntries =
    filterGroups.length > 0
      ? entries.filter((e) =>
          filterGroups.some((group) =>
            group.every(({ path, vals }) => vals.some((v) => matchesVal(getAtPath(e, path), v)))
          )
        )
      : entries;

  const activeDateRanges = Object.entries(dateRangeFilters);
  if (activeDateRanges.length > 0) {
    displayEntries = displayEntries.filter((e) =>
      activeDateRanges.every(([path, { from, to }]) => {
        const ts = new Date(getAtPath(e, path)).getTime();
        if (isNaN(ts)) return true;
        if (from && ts < new Date(from).getTime()) return false;
        if (to && ts > new Date(to).getTime()) return false;
        return true;
      }),
    );
  }
  if (filterLevel) {
    displayEntries = displayEntries.filter((e) => e.level === filterLevel);
  }

  function toggleFilter(path, val) {
    setQuickFilters((prev) => {
      const current = prev[path] || [];
      const next = { ...prev };
      if (current.includes(val)) {
        const remaining = current.filter((v) => v !== val);
        if (remaining.length === 0) delete next[path];
        else next[path] = remaining;
      } else {
        next[path] = [...current, val];
      }
      return next;
    });
  }

  function clearFieldFilter(path) {
    setQuickFilters((prev) => {
      const n = { ...prev };
      delete n[path];
      return n;
    });
  }

  async function handleClear() {
    if (!window.confirm("Clear all logs?")) return;
    try {
      const allServices = Object.values(connectedProjects).flat();
      await Promise.all(
        allServices.map(async (s) => {
          try {
            const { SystemView } = Client.createService(s.connectionData);
            await SystemView.clearLog();
          } catch {}
        })
      );
      setEntries([]);
      setExpandedKey(null);
      setQuickFilters({});
    } catch {}
  }

  function toggleRow(key) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  return (
    <section className="logs-page">
      <div className="page-header">
        <button className="logs-back" onClick={() => window.history.length > 1 ? history.goBack() : history.push("/specs")}>
          ← back
        </button>
        <span className="logs-title">SystemView</span>
        <img src={LOGO} alt="logo" />
        <span className="logs-heading">Logs</span>
      </div>

      <div className="logs-sticky-area">
        <div className="logs-toolbar">
          <select
            value={filterProject}
            onChange={(e) => {
              setFilterProject(e.target.value);
              setFilterService("");
              setFilterMethod("");
              setQuickFilters({});
            }}
          >
            <option value="">all projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={filterService}
            onChange={(e) => {
              setFilterService(e.target.value);
              setFilterMethod("");
              setQuickFilters({});
            }}
          >
            <option value="">all services</option>
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filterMethod}
            onChange={(e) => {
              setFilterMethod(e.target.value);
              setQuickFilters({});
            }}
            disabled={!methods.length}
          >
            <option value="">all methods</option>
            {methods.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {filterGroups.map((group, gi) => {
            const needsParens = filterGroups.length > 1 && group.length > 1;
            return (
              <React.Fragment key={gi}>
                {gi > 0 && <span className="logs-filter-op">||</span>}
                {needsParens && <span className="logs-filter-paren">(</span>}
                {group.map(({ path, vals, slotId, mode }, fi) => (
                  <React.Fragment key={slotId}>
                    {fi > 0 && <span className="logs-filter-op">&</span>}
                    <button
                      className={`logs-quick-filter${mode === "or" ? " logs-quick-filter--or" : ""}`}
                      onClick={() => setQuickFilters((prev) => { const n = { ...prev }; delete n[slotId]; return n; })}
                    >
                      {path}: {vals.map((v) => v === "?+" ? "has value" : v === "?-" ? "null/missing" : v.startsWith("~") ? v.slice(1) : v).join(", ")} ×
                    </button>
                  </React.Fragment>
                ))}
                {needsParens && <span className="logs-filter-paren">)</span>}
              </React.Fragment>
            );
          })}
          {activeDateRanges.map(([path, { from, to }]) => (
            <button
              key={`dr-${path}`}
              className="logs-quick-filter"
              onClick={() => handleDateRange(path, "", "")}
            >
              {path}: {from ? moment(from).format("MMM D HH:mm") : "—"} → {to ? moment(to).format("MMM D HH:mm") : "—"} ×
            </button>
          ))}
          {filterMethod && !methods.some((m) => m.value === filterMethod) && (
            <button className="logs-quick-filter" onClick={() => setFilterMethod("")}>
              method: {filterMethod} ×
            </button>
          )}
          {filterLevel && (
            <button className="logs-quick-filter" onClick={() => setFilterLevel("")}>
              level: {filterLevel} ×
            </button>
          )}
          <span className="logs-count">
            {displayEntries.length}
            {orderedFilters.length > 0 ? ` / ${entries.length}` : ""} entries
          </span>
          <span style={{flex: 1}} />
          <button
            className="logs-reset-btn"
            onClick={() => {
              setFilterProject("");
              setFilterService("");
              setFilterMethod("");
              setFilterLevel("");
              setQuickFilters({});
              setDateRangeFilters({});
            }}
          >
            Reset filters
          </button>
          <button
            className={`logs-monitor-btn${isMonitoring ? " logs-monitor-btn--on" : ""}`}
            onClick={() => setIsMonitoring((m) => !m)}
          >
            {isMonitoring ? "● Monitor" : "○ Monitor"}
          </button>
          <button className="logs-clear-btn" onClick={handleClear}>
            Clear
          </button>
        </div>
        <Dashboard
          entries={entries}
          getContextEntries={(path) => {
            const groups = path
              ? filterGroups.map((g) => g.filter((f) => f.path !== path)).filter((g) => g.length > 0)
              : filterGroups;
            if (groups.length === 0) return entries;
            return entries.filter((e) =>
              groups.some((group) =>
                group.every(({ path: p, vals }) => vals.some((v) => matchesVal(getAtPath(e, p), v)))
              )
            );
          }}
          quickFilters={quickFilters}
          onToggleFilter={toggleFilter}
          onClearFilter={clearFieldFilter}
          onAnalyzerSlotsChange={setAnalyzerSlots}
          initialPaths={initAnalyzerPaths}
          dateRangeFilters={dateRangeFilters}
          onDateRange={handleDateRange}
        />
        <div className="logs-table-header">
            <div className="log-th log-th--time">Time</div>
            <div className={`log-th log-th--project${filteredFixedPaths.has("projectCode") ? " log-th--filtered" : ""}`}>Project</div>
            <div className={`log-th log-th--service${filteredFixedPaths.has("serviceId") ? " log-th--filtered" : ""}`}>Service</div>
            <div className={`log-th log-th--method${filteredFixedPaths.has("moduleMethod") ? " log-th--filtered" : ""}`}>Module.Method</div>
            <div className={`log-th log-th--level${filteredFixedPaths.has("level") ? " log-th--filtered" : ""}`}>Level</div>
            <div className={`log-th log-th--msg${filteredFixedPaths.has("scope") ? " log-th--filtered" : ""}`}>Scope</div>
            <div className="log-th log-th--traceid">Trace ID</div>
            {dynamicColumns.map((path) => (
              <div key={path} className="log-th log-th--dynamic">
                {displayPath(path)}
              </div>
            ))}
          </div>
      </div>

      <div className="logs-body" ref={bodyRef}>
        {displayEntries.length === 0 ? (
          <p className="logs-empty">
            {entries.length === 0
              ? "No log entries."
              : "No entries match the current filter."}
          </p>
        ) : (
          <div className="logs-table">
            {displayEntries.map((entry, i) => {
              const key = `${i}-${entry.timestamp}-${entry.moduleMethod}`;
              const eKey = `${entry.timestamp}-${entry.traceId}-${entry.moduleMethod}`;
              return (
                <LogRow
                  key={i}
                  entry={entry}
                  isExpanded={expandedKey === key}
                  onToggle={() => toggleRow(key)}
                  dynamicColumns={dynamicColumns}
                  filteredFixedPaths={filteredFixedPaths}
                  isNew={newEntryKeys.has(eKey)}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
