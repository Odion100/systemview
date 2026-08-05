import React, { useState, useEffect, useMemo } from "react";
import ReactJson from "react-json-view";
import moment from "moment";
import { useAppDark, jsonTheme } from "../../atoms/appTheme";
import "./logKit.scss";

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
  return (
    v != null &&
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(v) &&
    !isNaN(new Date(v).getTime())
  );
}

function getKeyPaths(entries) {
  const paths = new Set();
  entries.forEach((e) => {
    Object.keys(e).forEach((k) => {
      paths.add(k);
    });
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

export function matchesVal(entryVal, filterVal) {
  if (filterVal === "?+") return entryVal != null;
  if (filterVal === "?-") return entryVal == null;
  if (entryVal == null) return false;
  if (typeof filterVal === "string" && filterVal.startsWith("~")) {
    try {
      return new RegExp(filterVal.slice(1), "i").test(String(entryVal));
    } catch {
      return false;
    }
  }
  const cmp =
    typeof filterVal === "string" && filterVal.match(/^(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (cmp) {
    const n = parseFloat(String(entryVal));
    const num = parseFloat(cmp[2]);
    if (isNaN(n)) return false;
    if (cmp[1] === ">") return n > num;
    if (cmp[1] === "<") return n < num;
    if (cmp[1] === ">=") return n >= num;
    if (cmp[1] === "<=") return n <= num;
  }
  return String(entryVal) === filterVal;
}

export function getAtPath(obj, path) {
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
  mode,
  onModeChange,
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
    const resolved =
      fullPath && !valuesAreDates && (!valuesAreObjects || hasPresenceFilter)
        ? fullPath
        : null;
    onPathChange && onPathChange({ resolved, display: fullPath || null });
  }, [fullPath, valuesAreObjects, valuesAreDates, quickFilters, slotId]);

  const childInfo = useMemo(() => {
    if (!valuesAreObjects) return {};
    return getChildInfo(entries, fullPath ? fullPath.split(".") : []);
  }, [entries, fullPath, valuesAreObjects]);

  const presenceCounts = useMemo(() => {
    if (!fullPath) return null;
    let has = 0,
      missing = 0;
    entries.forEach((e) => {
      getAtPath(e, fullPath) != null ? has++ : missing++;
    });
    return { has, missing };
  }, [entries, fullPath]);

  const allFreqs = !valuesAreObjects && fullPath ? countByPath(entries, fullPath) : [];
  const freqs = search
    ? allFreqs.filter(([val]) => {
        if (matchesVal(val, search)) return true;
        try {
          return new RegExp(search, "i").test(val);
        } catch {
          return val.includes(search);
        }
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
    setCustomValues((prev) => (prev.includes(val) ? prev : [...prev, val]));
    onRowClick(fullPath, val);
    setSearch("");
  }

  const hasDrill = field && drillSegments.length > 0;

  return (
    <div
      className={`dash-panel${hasDrill ? " dash-panel--wide" : ""}${mode === "highlight" ? " dash-panel--highlight" : ""}`}
    >
      <div className="dash-panel__header">
        <button
          className={`field-analyzer__mode${mode === "highlight" ? " field-analyzer__mode--highlight" : ""}`}
          title={
            mode === "highlight"
              ? "Highlight — mark matches, keep every row (click to switch to Filter)"
              : "Filter — hide non-matching rows (click to switch to Highlight)"
          }
          onClick={() =>
            onModeChange && onModeChange(mode === "highlight" ? "filter" : "highlight")
          }
        >
          {mode === "highlight" ? "✦ mark" : "▽ hide"}
        </button>
        {mode !== "highlight" && (
          <button
            className={`field-analyzer__conj${conjunction === "or" ? " field-analyzer__conj--or" : ""}`}
            title={
              conjunction === "and"
                ? "& AND — intersect with other filters"
                : "|| OR — union with other filters"
            }
            onClick={() =>
              onConjunctionChange &&
              onConjunctionChange(conjunction === "and" ? "or" : "and")
            }
          >
            {conjunction === "and" ? "&" : "||"}
          </button>
        )}
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
                    value={
                      (dateRangeFilters &&
                        dateRangeFilters[fullPath] &&
                        dateRangeFilters[fullPath].from) ||
                      ""
                    }
                    onChange={(e) =>
                      onDateRange &&
                      onDateRange(
                        fullPath,
                        e.target.value,
                        (dateRangeFilters &&
                          dateRangeFilters[fullPath] &&
                          dateRangeFilters[fullPath].to) ||
                          "",
                      )
                    }
                  />
                </td>
              </tr>
              <tr className="dash-panel__row dash-panel__row--date">
                <td className="dash-panel__val dash-panel__val--date-label">to</td>
                <td className="dash-panel__val--date-input">
                  <input
                    type="datetime-local"
                    value={
                      (dateRangeFilters &&
                        dateRangeFilters[fullPath] &&
                        dateRangeFilters[fullPath].to) ||
                      ""
                    }
                    onChange={(e) =>
                      onDateRange &&
                      onDateRange(
                        fullPath,
                        (dateRangeFilters &&
                          dateRangeFilters[fullPath] &&
                          dateRangeFilters[fullPath].from) ||
                          "",
                        e.target.value,
                      )
                    }
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
                      <td className="dash-panel__val dash-panel__val--presence">
                        has value
                      </td>
                      <td className="dash-panel__count">×{presenceCounts.has}</td>
                    </tr>
                    <tr
                      className={`dash-panel__row dash-panel__row--presence${activeVals.includes("?-") ? " dash-panel__row--active" : ""}`}
                      onClick={() => onRowClick(fullPath, "?-")}
                    >
                      <td className="dash-panel__val dash-panel__val--presence">
                        null / missing
                      </td>
                      <td className="dash-panel__count">×{presenceCounts.missing}</td>
                    </tr>
                    <tr className="dash-panel__row--divider">
                      <td colSpan={2} />
                    </tr>
                  </>
                )}
                {Object.entries(childInfo).map(([key, { isObject }]) => (
                  <tr
                    key={key}
                    className="dash-panel__row"
                    onClick={() => drillInto(key)}
                  >
                    <td className="dash-panel__val">
                      {/^\d+$/.test(key) ? `[${key}]` : key}
                    </td>
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
                  <tr className="dash-panel__row--divider">
                    <td colSpan={2} />
                  </tr>
                  <tr
                    className={`dash-panel__row dash-panel__row--presence${activeVals.includes("?+") ? " dash-panel__row--active" : ""}`}
                    onClick={() => onRowClick(fullPath, "?+")}
                  >
                    <td className="dash-panel__val dash-panel__val--presence">
                      has value
                    </td>
                    <td className="dash-panel__count">×{presenceCounts.has}</td>
                  </tr>
                  <tr
                    className={`dash-panel__row dash-panel__row--presence${activeVals.includes("?-") ? " dash-panel__row--active" : ""}`}
                    onClick={() => onRowClick(fullPath, "?-")}
                  >
                    <td className="dash-panel__val dash-panel__val--presence">
                      null / missing
                    </td>
                    <td className="dash-panel__count">×{presenceCounts.missing}</td>
                  </tr>
                  <tr className="dash-panel__row--divider">
                    <td colSpan={2} />
                  </tr>
                </>
              )}
              {customValues.map((v) => (
                <tr
                  key={v}
                  className={`dash-panel__row dash-panel__row--custom${activeVals.includes(v) ? " dash-panel__row--active" : ""}`}
                  onClick={() => onRowClick(fullPath, v)}
                >
                  <td className="dash-panel__val">
                    {v.startsWith("~") ? `/${v.slice(1)}/` : v}
                  </td>
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

export function Dashboard({
  entries,
  getContextEntries,
  quickFilters,
  onToggleFilter,
  onClearFilter,
  onAnalyzerSlotsChange,
  dateRangeFilters,
  onDateRange,
  initialPaths,
  defaultCollapsed,
}) {
  const [analyzers, setAnalyzers] = useState(() => {
    const pre = (initialPaths || []).map((p) => ({
      id: `url-${p}`,
      resolvedPath: p,
      displayPath: p,
      conjunction: "and",
      mode: "filter",
    }));
    return [
      ...pre,
      { id: Date.now(), resolvedPath: null, conjunction: "and", mode: "highlight" },
    ];
  });
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed);
  const traceEntries = entries.filter((e) => e.level === "trace");
  const keyPaths = getKeyPaths(entries);

  const lastResolved = analyzers[analyzers.length - 1]?.resolvedPath;
  const activeCount = analyzers.filter((a) => a.resolvedPath).length;

  useEffect(() => {
    if (initialPaths && initialPaths.length) reportState(analyzers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reportState(next) {
    onAnalyzerSlotsChange(
      next
        .map((x) => ({
          id: x.id,
          path: x.resolvedPath,
          displayPath: x.displayPath,
          conjunction: x.conjunction,
          mode: x.mode,
        }))
        .filter((x) => x.path || x.displayPath),
    );
  }

  function addAnalyzer() {
    setAnalyzers((a) => [
      ...a,
      { id: Date.now(), resolvedPath: null, conjunction: "and", mode: "highlight" },
    ]);
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
      const next = a.map((x) =>
        x.id === id ? { ...x, resolvedPath: resolved, displayPath: display } : x,
      );
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

  function updateMode(id, mode) {
    setAnalyzers((a) => {
      const next = a.map((x) => (x.id === id ? { ...x, mode } : x));
      reportState(next);
      return next;
    });
  }

  return (
    <div className={`dashboard${collapsed ? " dashboard--collapsed" : ""}`}>
      <button
        className="dashboard__collapse"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "Expand analyzer" : "Collapse analyzer — reclaim table height"}
      >
        <span className="dashboard__collapse-chevron">{collapsed ? "▸" : "▾"}</span>
        Analyzer
        {collapsed && activeCount > 0 && (
          <span className="dashboard__collapse-count">{activeCount} active</span>
        )}
      </button>
      {!collapsed && (
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
              entries={
                a.conjunction === "and" ? getContextEntries(a.resolvedPath) : entries
              }
              keyPaths={keyPaths}
              onRemove={() => removeAnalyzer(a.id)}
              onPathChange={(path) => updateResolvedPath(a.id, path)}
              quickFilters={quickFilters}
              onRowClick={(path, val) => onToggleFilter(a.id, val)}
              dateRangeFilters={dateRangeFilters}
              onDateRange={onDateRange}
              conjunction={a.conjunction}
              onConjunctionChange={(c) => updateConjunction(a.id, c)}
              mode={a.mode || "highlight"}
              onModeChange={(m) => updateMode(a.id, m)}
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
      )}
    </div>
  );
}

export const FIXED_PATHS = new Set([
  "timestamp",
  "projectCode",
  "serviceId",
  "moduleMethod",
  "level",
  "scope",
  "traceId",
]);

export function displayPath(path) {
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

export function LogRow({
  entry,
  isExpanded,
  onToggle,
  dynamicColumns,
  filteredFixedPaths,
  highlightPaths,
  compact,
  isNew,
  jsonMode,
}) {
  const [appDark] = useAppDark();
  const level = entry.level || "info";
  const isTrace = level === "trace";
  const scopeVal = entry.scope || "";
  const msg = typeof scopeVal === "string" ? scopeVal : JSON.stringify(scopeVal) || "";
  const shortTraceId = entry.traceId || "—";
  const isHighlighted = highlightPaths && highlightPaths.size > 0;
  const hl = (path) =>
    highlightPaths && highlightPaths.has(path) ? " log-cell--highlight" : "";

  return (
    <>
      <div
        className={`log-row${isTrace ? " log-row--dim" : ""} log-row--clickable${isExpanded && !jsonMode ? " log-row--active" : ""}${isNew ? " log-row--new" : ""}${isHighlighted ? " log-row--highlight" : ""}`}
        onClick={onToggle}
      >
        <div className={`log-cell log-cell--time${hl("timestamp")}`}>
          {formatTime(entry.timestamp)}
        </div>
        {!compact && (
          <div
            className={`log-cell log-cell--project${filteredFixedPaths?.has("projectCode") ? " log-cell--filtered" : ""}${hl("projectCode")}`}
          >
            {entry.projectCode || "—"}
          </div>
        )}
        {!compact && (
          <div
            className={`log-cell log-cell--service${filteredFixedPaths?.has("serviceId") ? " log-cell--filtered" : ""}${hl("serviceId")}`}
          >
            {entry.serviceId || "—"}
          </div>
        )}
        <div
          className={`log-cell log-cell--method${filteredFixedPaths?.has("moduleMethod") ? " log-cell--filtered" : ""}${hl("moduleMethod")}`}
        >
          {entry.moduleMethod || "—"}
        </div>
        <div className={`log-cell log-cell--level${hl("level")}`}>
          <span className={`log-level log-level--${LEVEL_CLASS[level] || "info"}`}>
            {level}
          </span>
        </div>
        <div className={`log-cell log-cell--msg${hl("scope")}`}>
          {msg}
          {entry.duration != null && (
            <span className="log-duration"> {entry.duration}ms</span>
          )}
        </div>
        {!compact && (
          <div
            className={`log-cell log-cell--traceid${hl("traceId")}`}
            title={entry.traceId || ""}
          >
            {shortTraceId}
          </div>
        )}
        {!compact &&
          dynamicColumns &&
          dynamicColumns.map((path) => (
            <div
              key={path}
              className={`log-cell log-cell--dynamic${hl(path)}`}
              title={path}
            >
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
                theme={jsonTheme(appDark)}
                displayObjectSize={false}
                displayDataTypes={false}
                collapsed={1}
                collapseStringsAfterLength={80}
                style={{
                  fontSize: "12px",
                  fontFamily: "monospace",
                  background: "transparent",
                }}
                enableClipboard={(copy) => {
                  try {
                    navigator.clipboard.writeText(
                      typeof copy.src === "string"
                        ? copy.src
                        : JSON.stringify(copy.src, null, 2),
                    );
                  } catch {}
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

