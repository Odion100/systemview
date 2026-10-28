import React, { useState, useCallback, useEffect, useRef } from "react";
import RowMenu from "../../atoms/RowMenu/RowMenu";
import { openAddress } from "../../atoms/Markdown/openRef";
import { getTabs, openTab, closeTab, moveTab, closeRight, closeOthers, closeAll, countRight } from "../../pages/SystemView/tabsStore";
import { iconForTab, TAB_ICONS } from "../../utils/fileIcons";
import { labelOfTab } from "../../pages/SystemView/tabRoutes";
import "../WallPanel/styles.scss";
import { hostFiles, machineFiles } from "../../utils/hostFiles";
import { browseSplit, browseMatch, browseJoin } from "./browse";

// THE CENTER TAB STRIP — the one component, extracted from Documentation (RFC-069 slice 4) after
// his correction landed twice in one day: *"that's not the same component… it needs to actually be
// the same component everywhere, meaning the same state."* The first attempt was a lookalike strip
// wearing these classes; a lookalike is a second implementation, and a second implementation is
// two copies drifting. This IS the strip now: Documentation mounts it for the Code page, the
// Agents view mounts it over the same tabsStore, and neither can drift from the other by
// construction.
//
// IT OWNS THE STORE VERBS AND THE MENU; THE HOST OWNS MEANING. Close, reorder, close-right/others/
// all, the right-click menu, the empty-strip floor tab, the active-tab scroll — identical
// everywhere, so they live here. What differs per host is MEANING: which tab is active (the Code
// page answers from the URL, the Agents view from local state), what a click does (route vs focus),
// and what happens after a close empties the view — so those arrive as functions.
//
// Props:
//   tabsPc           — the store key (the project)
//   tabs             — pane.tabs, the host's subscribed copy
//   isActive(t)      — the host's one truth about focus
//   onOpen(t)        — a tab face was clicked
//   afterClose(nextKey, closedTab) — the store already closed it; move the view if it was active
//   extraMenuItems(t)— host-specific menu rows (the Code page adds reveal/copy-path for files)
//   plus             — optional: the open-by-path door {open, path, err, recents, setOpen, setPath, submit}
//   onCollapse       — optional: push this whole area off to its edge tab. Renders the ONE
//                      wall-collapse button (WallPanel/styles.scss), OUTSIDE the scroll row so it
//                      can never cover the + (his rule: the + rides the last tab, never hidden).
export default function CenterTabs({ tabsPc, tabs = [], isActive, onOpen, afterClose, extraMenuItems, plus, onCollapse }) {
  const [tabMenu, setTabMenu] = useState(null);

  const closeStripTab = useCallback(
    (t) => {
      const wasActive = isActive(t);
      const nextKey = closeTab(tabsPc, t.key);
      if (wasActive && afterClose) afterClose(nextKey, t);
    },
    [tabsPc, isActive, afterClose]
  );
  const afterBulkClose = useCallback(
    (nextKey) => {
      if (afterClose) afterClose(nextKey, null);
    },
    [afterClose]
  );
  const openTabMenu = useCallback(
    (e, t, label) => {
      e.preventDefault();
      e.stopPropagation();
      const rightCount = countRight(tabsPc, t.key);
      const total = getTabs(tabsPc).panes[0].tabs.length;
      const items = [{ label: "Close", action: () => closeStripTab(t) }];
      // A verb that would do nothing is HIDDEN, not greyed: a menu of dead items teaches you to
      // stop reading it.
      if (rightCount)
        items.push({ label: `Close ${rightCount} to the right`, action: () => afterBulkClose(closeRight(tabsPc, t.key)) });
      if (total > 1) items.push({ label: "Close others", action: () => afterBulkClose(closeOthers(tabsPc, t.key)) });
      items.push({
        label: `Close all ${total}`,
        action: () => afterBulkClose(closeAll(tabsPc)),
        // Two-step: the one verb here you cannot undo by clicking the tree again.
        confirm: total > 2 ? `Close all ${total}?` : undefined,
      });
      for (const it of (extraMenuItems && extraMenuItems(t)) || []) items.push(it);
      setTabMenu({ x: e.clientX, y: e.clientY, title: label, items });
    },
    [tabsPc, closeStripTab, afterBulkClose, extraMenuItems]
  );

  return (
    <>
      <div className="doc-tabs">
        <div
          className="doc-tabs__scroll"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("text/sv-tab")) e.preventDefault();
          }}
          onDrop={(e) => {
            const key = e.dataTransfer.getData("text/sv-tab");
            if (!key) return;
            e.preventDefault();
            moveTab(tabsPc, key, null); // past the tabs = last
          }}
        >
          {/* THE FLOOR SHOWS AS A TAB — with nothing open, the strip isn't empty chrome over a
              mystery document; it names what you're looking at. Synthetic — not in the store,
              nothing to close: it IS the nothing-open state. */}
          {tabs.length === 0 && (
            <span className="doc-tab doc-tab--kind-sv doc-tab--active">
              <span className="doc-tab__face doc-tab__face--still">
                <span className="doc-tab__icon doc-tab__icon--sv" aria-hidden="true">
                  {TAB_ICONS.sv.glyph}
                </span>
                SystemView
              </span>
            </span>
          )}
          {tabs.map((t) => {
            const active = !!isActive(t);
            const label = labelOfTab(t, tabsPc);
            return (
              <span
                key={t.key}
                // THE TAB YOU'RE ON IS ALWAYS IN VIEW — scrollIntoView(nearest) is a no-op when
                // already visible, so this costs nothing except when it's needed.
                ref={active ? (el) => { if (el) try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch {} } : null}
                className={`doc-tab doc-tab--kind-${t.kind} ${active ? "doc-tab--active" : ""}`}
                // DRAG TO REORDER — the tab is the handle, dropping on a tab puts you where IT
                // sat, dropping past the row's end sends you last. The store owns the order.
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/sv-tab", t.key);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("text/sv-tab")) e.preventDefault();
                }}
                onDrop={(e) => {
                  const key = e.dataTransfer.getData("text/sv-tab");
                  if (!key || key === t.key) return;
                  e.preventDefault();
                  e.stopPropagation(); // or the ROW's drop fires next and sends it to the end
                  moveTab(tabsPc, key, t.key);
                }}
                onContextMenu={(e) => openTabMenu(e, t, label)}
              >
                <button
                  className="doc-tab__face"
                  title={
                    t.kind === "file" && t.file
                      ? `${t.file.machine ? "machine" : t.file.projectCode || ""}: ${t.file.path}`
                      : t.kind === "agentdoc" && t.adoc
                      ? `${t.adoc.agentId || ""}: ${t.adoc.label || ""}`
                      : undefined
                  }
                  onClick={() => onOpen && onOpen(t)}
                >
                  {(() => {
                    const { glyph, kind } = iconForTab(t);
                    return (
                      <span className={`doc-tab__icon doc-tab__icon--${kind}`} aria-hidden="true">
                        {kind === "img" ? <img src={glyph} alt="" /> : glyph}
                      </span>
                    );
                  })()}
                  {label}
                </button>
                <button
                  className="doc-tab__close"
                  title="Close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeStripTab(t);
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
          {plus && (
            <button
              type="button"
              className="doc-tabs__plus"
              title="Open a file by path — any path on this machine (~ works)"
              onClick={() => plus.setOpen(!plus.open)}
            >
              +
            </button>
          )}
          {/* HOW THIS WORKS — 🧭, IN THE STRIP, because the page it opens IS a tab. It began as the
              empty-strip floor, so the only way to read it was to close every document: *"I'm not
              going to close all my documents to have the tab strip empty to get to it."* My first
              door put it above the chat, which is the wrong surface — a button that opens a centre
              tab belongs on the centre tab strip, beside the one other door that opens one.
              PROVISIONAL, and he said so: *"just put something there for now and we'll figure out
              what to actually put there."* */}
          <button
            type="button"
            className="doc-tabs__how"
            title="How this works — the flow, every kind's lifecycle, and where to start"
            onClick={() => {
              // OFFER FIRST, THEN OPEN IT HERE. A page that hosts the kind itself claims the event
              // (the Agents page does); silence means this strip's own host has to open it, which
              // is the Code page. Opening without the offer would navigate him off a page that
              // could have shown it — the complaint that produced the offer/handled contract.
              const d = { kind: "how", projectCode: tabsPc };
              window.dispatchEvent(new CustomEvent("sv:openCenterKind", { detail: d }));
              if (d.handled) return;
              const t = { key: `how:${tabsPc}`, kind: "how" };
              openTab(tabsPc, t);
              if (onOpen) onOpen(t);
            }}
          >
            {"\u{1F9ED}"}
          </button>
        </div>
        {onCollapse && (
          <button type="button" className="wall-collapse" title="Push off to the edge — tabs keep standing" onClick={onCollapse}>
            ›
          </button>
        )}
        {plus && plus.open && (
          <div className="doc-tabs__plus-pop">
            <input
              autoFocus
              onBlur={() => plus.setOpen(false)} // a click anywhere else dismisses (his catch: it only closed on refresh); popup buttons keep focus via mousedown-preventDefault
              className="doc-tabs__plus-input"
              placeholder="/any/path/on/this/machine  ·  ~/works  ·  or a repo-relative path"
              value={plus.path}
              onChange={(e) => plus.setPath(e.target.value)}
              onKeyDown={(e) => {
                const n = (plus.found || []).length;
                if (e.key === "ArrowDown" && n) { e.preventDefault(); plus.setSel((plus.sel + 1) % n); return; }
                if (e.key === "ArrowUp" && n) { e.preventDefault(); plus.setSel((plus.sel - 1 + n) % n); return; }
                if (e.key === "Tab" && n) {
                  // Complete, never open: a directory descends, a file's name lands in the input.
                  e.preventDefault();
                  const f = plus.found[Math.min(plus.sel, n - 1)];
                  if (f.dir) plus.pick(f);
                  else plus.setPath(browseJoin(browseSplit(plus.path).dir, f.name));
                  return;
                }
                if (e.key === "Enter") {
                  if (n) plus.pick(plus.found[Math.min(plus.sel, n - 1)]);
                  else plus.submit(plus.path);
                  return;
                }
                if (e.key === "Escape") plus.setOpen(false);
              }}
            />
            {plus.err && <div className="doc-tabs__plus-err">{plus.err}</div>}
            {/* THE LISTING — what the typed directory holds, fragment-filtered, dirs first. A click
                behaves like Enter on that row: descend a folder, open a file. */}
            {plus.found && plus.found.length > 0 && (
              <div className="doc-tabs__plus-found">
                {plus.found.map((f, i) => (
                  <button
                    key={f.name}
                    type="button"
                    className={`doc-tabs__plus-entry${i === plus.sel ? " doc-tabs__plus-entry--sel" : ""}${f.dir ? " doc-tabs__plus-entry--dir" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => plus.setSel(i)}
                    onClick={() => plus.pick(f)}
                  >
                    {f.dir ? `${f.name}/` : f.name}
                  </button>
                ))}
              </div>
            )}
            {(!plus.found || !plus.found.length) && plus.recents && plus.recents.length > 0 && (
              <div className="doc-tabs__plus-recents">
                {plus.recents.map((rp) => (
                  <button key={rp} type="button" className="doc-tabs__plus-recent" title={rp} onMouseDown={(e) => e.preventDefault()} onClick={() => plus.submit(rp)}>
                    {rp}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* One menu instance for the strip — same atom and classes the nav rows use. */}
      <RowMenu menu={tabMenu} onClose={() => setTabMenu(null)} />
    </>
  );
}

// THE OPEN-BY-PATH DOOR'S BRAIN, shared the same way (RFC-069 §4.4): the path goes through
// /sv-resolve like every chip, a known root wins over the machine form, recents are addresses.
export function useOpenByPath(tabsPc) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const [err, setErr] = useState("");
  // THE BROWSE HALF (his direction: "navigate through files nicely"). The typed string's directory
  // part lists — project paths through the lazy tree's own shallow door, absolute/~ through the
  // machine door — and the basename fragment filters. A stale answer must never land on a newer
  // input, so each listing carries its ticket.
  const [found, setFound] = useState([]); // matched entries for the CURRENT input
  const [sel, setSel] = useState(0);
  const ticket = useRef(0);
  useEffect(() => {
    if (!open) return;
    const { dir, frag, machine } = browseSplit(path);
    if (dir == null) { setFound([]); setSel(0); return; } // empty input: recents' moment
    const t = ++ticket.current;
    (async () => {
      try {
        let entries;
        if (machine) entries = await machineFiles().listDir({ path: dir });
        else {
          const res = await hostFiles(tabsPc).listFiles({ dir, shallow: true });
          entries = ((res && res.entries) || []).map((e) => ({ name: e.name, dir: !!e.dir }));
        }
        if (ticket.current !== t) return;
        setFound(browseMatch(entries, frag));
        setSel(0);
      } catch {
        if (ticket.current === t) { setFound([]); setSel(0); }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, open, tabsPc]);
  // A pick: a directory descends (and relists, via the effect); a file opens.
  const pick = useCallback((entry) => {
    const { dir } = browseSplit(path);
    const joined = browseJoin(dir, entry.name);
    if (entry.dir) setPath(`${joined}/`);
    else submitRef.current(joined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  const submitRef = useRef(null);
  const recents = (() => {
    try { return JSON.parse(localStorage.getItem("sv.openByPath.recents") || "[]"); } catch { return []; }
  })();
  const submit = useCallback(
    async (raw) => {
      const typed = String(raw || "").trim();
      if (!typed) return;
      setErr("");
      try {
        const res = await fetch(`/sv-resolve?path=${encodeURIComponent(typed)}&project=${encodeURIComponent(tabsPc)}`);
        const r = await res.json();
        if (!r.ok || !r.resolved) return setErr(r.reason || r.error || "nothing at that path");
        try {
          const next = [typed, ...recents.filter((x) => x !== typed)].slice(0, 8);
          localStorage.setItem("sv.openByPath.recents", JSON.stringify(next));
        } catch {}
        setOpen(false);
        setPath("");
        openAddress({ machine: r.machine, projectCode: r.projectCode, path: r.path }); // one opener — no hand-built detail
      } catch (e) {
        setErr(String((e && e.message) || e));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabsPc, recents]
  );
  submitRef.current = submit;
  return { open, setOpen, path, setPath, err, recents, submit, found, sel, setSel, pick };
}
