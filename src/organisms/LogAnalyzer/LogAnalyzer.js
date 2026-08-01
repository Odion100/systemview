import React, { useState, useCallback, useRef, useEffect } from "react";
import moment from "moment";
import "./styles.scss";
import {
  Dashboard,
  LogRow,
  matchesVal,
  getAtPath,
  FIXED_PATHS,
  displayPath,
} from "./logKit";

// The Logs page's analyzer — filter/highlight field analyzer + frequency dashboard + JSON/table view —
// factored into a reusable block that runs over a PRE-SCOPED set of `entries` (the caller decides which
// logs to hand in; here we only analyze/filter/render them). Reuses the exact Dashboard / FieldAnalyzer /
// LogRow + match logic from the Logs page so the two never drift.
//
// `toolbarExtras` lets the caller drop its own controls (e.g. refresh / monitor) into the toolbar row.
// `compact` drops the wide columns (project / service / trace id / analyzed) for a narrow panel.
const FIXED_FILTER_ORDER = ["moduleMethod"];

const flashKeyOf = (e) => `${e.timestamp}-${e.traceId}-${e.moduleMethod}-${e.scope}`;

export default function LogAnalyzer({ entries = [], toolbarExtras = null, compact = false, follow = false }) {
  const [quickFilters, setQuickFilters] = useState({});
  const [analyzerSlots, setAnalyzerSlots] = useState([]);
  const [dateRangeFilters, setDateRangeFilters] = useState({});
  const [viewMode, setViewMode] = useState("table");
  const [expandedKey, setExpandedKey] = useState(null);

  // Only the rows scroll — the toolbar, dashboard and table header sit above this in fixed position. We
  // auto-follow to the bottom ONLY while `follow` is on AND the user is already parked at the bottom, so
  // scrolling up to read isn't yanked back down when the next poll lands (even if nothing new arrived).
  const bodyRef = useRef(null);
  const atBottomRef = useRef(true);
  const seenRef = useRef(null); // keys from the previous entries snapshot; null = first load (don't flash)
  const flashTimers = useRef([]);
  const [flashKeys, setFlashKeys] = useState(() => new Set());

  const onBodyScroll = () => {
    const el = bodyRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  // Jump to the bottom when monitoring is switched on, so it starts pinned to the newest entry.
  useEffect(() => {
    if (!follow) return;
    const el = bodyRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      atBottomRef.current = true;
    }
  }, [follow]);

  // Diff each entries snapshot: entries that weren't in the previous snapshot just arrived — flash them for
  // a couple seconds (fades via CSS), and if we're following + parked at the bottom, ride down to them.
  useEffect(() => {
    const currentKeys = entries.map(flashKeyOf);
    const seen = seenRef.current;
    seenRef.current = new Set(currentKeys);
    if (!seen) return; // first load — don't flash the whole initial batch
    const fresh = currentKeys.filter((k) => !seen.has(k));
    if (!fresh.length) return;
    setFlashKeys((prev) => {
      const n = new Set(prev);
      fresh.forEach((k) => n.add(k));
      return n;
    });
    const timer = setTimeout(() => {
      setFlashKeys((prev) => {
        const n = new Set(prev);
        fresh.forEach((k) => n.delete(k));
        return n;
      });
    }, 950); // just past the ~0.9s ping — keep it brief so rows blip in, never a lingering wash
    flashTimers.current.push(timer);
    if (follow && atBottomRef.current && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [entries, follow]);

  // Cancel any pending flash-clear timers if we unmount (namespace switch remounts this component).
  useEffect(() => () => flashTimers.current.forEach(clearTimeout), []);

  const dynamicColumns = compact
    ? []
    : analyzerSlots
        .map((s) => s.displayPath || s.path)
        .filter((p) => p && !FIXED_PATHS.has(p));

  const filteredFixedPaths = new Set(
    Object.keys(quickFilters).filter(
      (k) => FIXED_PATHS.has(k) && (quickFilters[k] || []).length > 0,
    ),
  );

  // Filter chain: fixed panels (moduleMethod, always OR) then FILTER-mode analyzers (& or ||). Highlight
  // analyzers are pulled out — they mark rows, never hide them.
  const orderedFilters = [
    ...FIXED_FILTER_ORDER.filter((p) => (quickFilters[p] || []).length > 0).map((p) => ({
      path: p,
      vals: quickFilters[p],
      mode: "and",
      slotId: p,
    })),
    ...analyzerSlots
      .filter((s) => s.path && s.mode !== "highlight" && (quickFilters[s.id] || []).length > 0)
      .map((s) => ({ path: s.path, vals: quickFilters[s.id], mode: s.conjunction, slotId: s.id })),
  ];

  const highlightSlots = analyzerSlots
    .filter((s) => s.path && s.mode === "highlight" && (quickFilters[s.id] || []).length > 0)
    .map((s) => ({ path: s.path, vals: quickFilters[s.id], slotId: s.id }));

  const highlightPathsFor = useCallback(
    (entry) => {
      const paths = new Set();
      highlightSlots.forEach(({ path, vals }) => {
        if (vals.some((v) => matchesVal(getAtPath(entry, path), v))) paths.add(path);
      });
      return paths;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(highlightSlots)],
  );

  // Group by precedence: & binds tighter, each || starts a new group.
  const filterGroups = (() => {
    const groups = [];
    let current = [];
    orderedFilters.forEach((f, i) => {
      if (i === 0 || f.mode !== "and") {
        if (current.length) groups.push(current);
        current = [f];
      } else current.push(f);
    });
    if (current.length) groups.push(current);
    return groups;
  })();

  const handleDateRange = (path, from, to) => {
    setDateRangeFilters((prev) => {
      const next = { ...prev };
      if (!from && !to) delete next[path];
      else next[path] = { from, to };
      return next;
    });
  };

  let displayEntries =
    filterGroups.length > 0
      ? entries.filter((e) =>
          filterGroups.some((group) =>
            group.every(({ path, vals }) => vals.some((v) => matchesVal(getAtPath(e, path), v))),
          ),
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

  const toggleFilter = (path, val) => {
    setQuickFilters((prev) => {
      const current = prev[path] || [];
      const next = { ...prev };
      if (current.includes(val)) {
        const remaining = current.filter((v) => v !== val);
        if (remaining.length === 0) delete next[path];
        else next[path] = remaining;
      } else next[path] = [...current, val];
      return next;
    });
  };
  const clearFieldFilter = (path) => {
    setQuickFilters((prev) => {
      const n = { ...prev };
      delete n[path];
      return n;
    });
  };
  const getContextEntries = (path) => {
    const groups = path
      ? filterGroups.map((g) => g.filter((f) => f.path !== path)).filter((g) => g.length > 0)
      : filterGroups;
    if (groups.length === 0) return entries;
    return entries.filter((e) =>
      groups.some((group) =>
        group.every(({ path: p, vals }) => vals.some((v) => matchesVal(getAtPath(e, p), v))),
      ),
    );
  };

  const labelVals = (vals) =>
    vals
      .map((v) =>
        v === "?+" ? "has value" : v === "?-" ? "null/missing" : v.startsWith("~") ? v.slice(1) : v,
      )
      .join(", ");

  const hasActiveFilters =
    orderedFilters.length > 0 || highlightSlots.length > 0 || activeDateRanges.length > 0;

  return (
    <div className="log-analyzer">
      <div className="logs-toolbar log-analyzer__toolbar">
        {/* Filter chips ride on ONE line in their own horizontally-scrollable lane, so a wall of filters
            never wraps into extra rows or squeezes the right-side controls. */}
        <div className="log-analyzer__filters">
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
                    onClick={() =>
                      setQuickFilters((prev) => {
                        const n = { ...prev };
                        delete n[slotId];
                        return n;
                      })
                    }
                  >
                    {path}: {labelVals(vals)} ×
                  </button>
                </React.Fragment>
              ))}
              {needsParens && <span className="logs-filter-paren">)</span>}
            </React.Fragment>
          );
        })}
        {highlightSlots.map(({ path, vals, slotId }) => (
          <button
            key={`hl-${slotId}`}
            className="logs-quick-filter logs-quick-filter--highlight"
            title="Highlight clause — click to remove"
            onClick={() =>
              setQuickFilters((prev) => {
                const n = { ...prev };
                delete n[slotId];
                return n;
              })
            }
          >
            ✦ {path}: {labelVals(vals)} ×
          </button>
        ))}
        {activeDateRanges.map(([path, { from, to }]) => (
          <button
            key={`dr-${path}`}
            className="logs-quick-filter"
            onClick={() => handleDateRange(path, "", "")}
          >
            {path}: {from ? moment(from).format("MMM D HH:mm") : "—"} →{" "}
            {to ? moment(to).format("MMM D HH:mm") : "—"} ×
          </button>
        ))}
        </div>
        <span className="logs-count">
          {displayEntries.length}
          {orderedFilters.length > 0 ? ` / ${entries.length}` : ""} entries
        </span>
        {/* Right-side controls keep their natural width (never compressed by the filter chips). */}
        <div className="log-analyzer__controls">
          {hasActiveFilters && (
            <button
              className="logs-reset-btn"
              onClick={() => {
                setQuickFilters({});
                setDateRangeFilters({});
              }}
            >
              Reset filters
            </button>
          )}
          <div className="logs-viewmode">
            <button
              className={`logs-viewmode__btn${viewMode === "table" ? " logs-viewmode__btn--on" : ""}`}
              onClick={() => setViewMode("table")}
            >
              Table
            </button>
            <button
              className={`logs-viewmode__btn${viewMode === "json" ? " logs-viewmode__btn--on" : ""}`}
              onClick={() => setViewMode("json")}
            >
              JSON
            </button>
          </div>
          {toolbarExtras}
        </div>
      </div>

      <Dashboard
        entries={entries}
        defaultCollapsed
        getContextEntries={getContextEntries}
        quickFilters={quickFilters}
        onToggleFilter={toggleFilter}
        onClearFilter={clearFieldFilter}
        onAnalyzerSlotsChange={setAnalyzerSlots}
        initialPaths={[]}
        dateRangeFilters={dateRangeFilters}
        onDateRange={handleDateRange}
      />

      {/* Only this region scrolls. The table header rides sticky at its top so it stays with the rows. */}
      <div className="log-analyzer__scroll" ref={bodyRef} onScroll={onBodyScroll}>
        <div className="logs-table-header">
          <div className="log-th log-th--time">Time</div>
          {!compact && (
            <div className={`log-th log-th--project${filteredFixedPaths.has("projectCode") ? " log-th--filtered" : ""}`}>
              Project
            </div>
          )}
          {!compact && (
            <div className={`log-th log-th--service${filteredFixedPaths.has("serviceId") ? " log-th--filtered" : ""}`}>
              Service
            </div>
          )}
          <div className={`log-th log-th--method${filteredFixedPaths.has("moduleMethod") ? " log-th--filtered" : ""}`}>
            Module.Method
          </div>
          <div className={`log-th log-th--level${filteredFixedPaths.has("level") ? " log-th--filtered" : ""}`}>
            Level
          </div>
          <div className={`log-th log-th--msg${filteredFixedPaths.has("scope") ? " log-th--filtered" : ""}`}>
            Scope
          </div>
          {!compact && <div className="log-th log-th--traceid">Trace ID</div>}
          {dynamicColumns.map((path) => (
            <div key={path} className="log-th log-th--dynamic">
              {displayPath(path)}
            </div>
          ))}
        </div>

        {displayEntries.length === 0 ? (
          <p className="logs-empty">
            {entries.length === 0 ? "No log entries for this scope." : "No entries match the current filter."}
          </p>
        ) : (
          <div className={`logs-table${viewMode === "json" ? " logs-table--json" : ""}`}>
            {displayEntries.map((entry, i) => {
              const key = `${i}-${entry.timestamp}-${entry.moduleMethod}`;
              return (
                <LogRow
                  key={i}
                  entry={entry}
                  isExpanded={viewMode === "json" || expandedKey === key}
                  jsonMode={viewMode === "json"}
                  onToggle={() => setExpandedKey((p) => (p === key ? null : key))}
                  dynamicColumns={dynamicColumns}
                  filteredFixedPaths={filteredFixedPaths}
                  highlightPaths={highlightPathsFor(entry)}
                  compact={compact}
                  isNew={flashKeys.has(flashKeyOf(entry))}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
