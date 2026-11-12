import React, { useState, useCallback, useEffect, useRef } from "react";
import RowMenu from "../../atoms/RowMenu/RowMenu";
import { openAddress } from "../../atoms/Markdown/openRef";
import {
  getTabs,
  openTab,
  closeTab,
  moveTab,
  closeRight,
  closeOthers,
  closeAll,
  countRight,
  paneOf,
  paneCount,
  focusPane,
  splitTab,
  moveTabToPane,
} from "../../pages/SystemView/tabsStore";
import { dropPlan } from "./paneDrag";
import { iconForTab, TAB_ICONS } from "../../utils/fileIcons";
import { labelOfTab, tabPc } from "../../pages/SystemView/tabRoutes";
import "../WallPanel/styles.scss";
import { hostFiles, machineFiles } from "../../utils/hostFiles";
import { browseSplit, browseMatch, browseJoin } from "./browse";

// THE CENTER TAB STRIP — the one component, extracted from Documentation after
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
//   pane             — WHICH SIDE THIS STRIP IS. Defaults to 0, which is what every host that has
//                      never heard of the split means: the only pane there is. A split host mounts
//                      one of these per pane and tells each one its index, and that index is what
//                      makes a drop ACROSS the divider a different verb from a reorder (dropPlan)
//                      and the bulk-close verbs scope to the side they were pressed on.
export default function CenterTabs({ tabsPc, tabs = [], isActive, onOpen, afterClose, extraMenuItems, plus, onCollapse, pane = 0 }) {
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
  // WHERE IT WILL LAND, SHOWN WHILE YOU DRAG. His ask, 2026-11-11: *"tabs can be rearranged, but
  // it doesn't show you a line where you're dropping it."*
  //
  // The strip already took the drop correctly — a tab dropped ON another takes that one's place,
  // and past the end goes last — but it took it blind: nothing on screen said which of those two
  // was about to happen, so the only way to find out was to let go and look. A caret at the seam
  // is the whole of the feedback, and it needs no new rule: it draws exactly where the existing
  // drop would put it.
  //
  // `null` = no drag over this strip · a KEY = the caret sits left of that tab · `"end"` = past
  // the last one.
  const [caret, setCaret] = useState(null);
  useEffect(() => {
    // The drag ends however it ends — dropped on a tab, dropped past them, dropped in another
    // pane, dropped outside the window, cancelled with Escape. One listener, one clearing, rather
    // than a clear at each handler that happens to know about it.
    const off = () => setCaret(null);
    // CAPTURE, ON BOTH, AND NEITHER IS OPTIONAL.
    //
    // His repro, 2026-11-11, and it is the whole diagnosis: *"drop it across, it doesn't go away.
    // Pick it up, drop it where it is, it goes away."*
    //
    //   `dragend` FIRES ON THE SOURCE ELEMENT — and a cross-pane move DESTROYS that element. The
    //   tab is removed from one pane and re-created in the other, so the node that would have
    //   fired it is gone before it can. Dropped where it started, the node survives and the event
    //   arrives, which is exactly the asymmetry he saw.
    //
    //   `drop` BUBBLES, and the strip's own handler calls `stopPropagation()` on purpose — the
    //   pane body is a drop target too and would otherwise take the same drop twice. A listener
    //   on `window` in the bubble phase is downstream of that and never runs.
    //
    // Capture runs window → target, before any handler can stop it, and a drop anywhere in the
    // window ends the drag whatever element survives it. Between the two, the only ending left
    // uncovered is one that fires neither event, and there is no such ending.
    window.addEventListener("dragend", off, true);
    window.addEventListener("drop", off, true);
    return () => {
      window.removeEventListener("dragend", off, true);
      window.removeEventListener("drop", off, true);
    };
  }, []);

  const openTabMenu = useCallback(
    (e, t, label) => {
      e.preventDefault();
      e.stopPropagation();
      const rightCount = countRight(tabsPc, t.key);
      // THE COUNTS ARE THIS TAB'S OWN SIDE'S. `panes[0]` by hand was right while there was only
      // ever one pane and silently wrong the moment there were two: a "Close all 3" pressed on the
      // right-hand strip would have counted the LEFT one's tabs, which is the most alarming thing
      // a confirm dialog could get wrong. `paneOf` answers which side actually holds it.
      const at = paneOf(tabsPc, t.key);
      const mine = getTabs(tabsPc).panes[at === -1 ? pane : at] || { tabs: [] };
      const total = (mine.tabs || []).length;
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
      // THE SPLIT, AND THE WAY BACK ACROSS — his *"you can split into two and you can drag
      // documents across"*. The drag is the fast way; this row is the one that works without
      // aiming, and it is where the verb gets a NAME, which a drag never has.
      //
      // Two labels for one store verb, because what it does depends on what is standing: with one
      // pane it opens a side (and cannot, when this is the only tab — there would be nothing left
      // behind, so the row is hidden rather than offered dead); with a split standing it carries
      // the document to the other side.
      const panes = paneCount(tabsPc);
      if (panes > 1) items.push({ label: "Move to the other side", action: () => splitTab(tabsPc, t.key) });
      else if (total > 1) items.push({ label: "Split — give it its own side", action: () => splitTab(tabsPc, t.key) });
      for (const it of (extraMenuItems && extraMenuItems(t)) || []) items.push(it);
      setTabMenu({ x: e.clientX, y: e.clientY, title: label, items });
    },
    [tabsPc, pane, closeStripTab, afterBulkClose, extraMenuItems]
  );

  // A TAB THAT ARRIVES BESIDE YOU HAS TO ANNOUNCE ITSELF. Following a reference no longer moves
  // you, which is the point — and the cost of nothing moving is that nothing tells you anything
  // happened. His catch: *"when a new tab comes up it has to do some type of animation so I
  // could see some sort of a flash."*
  //
  // ONLY TABS THAT ARRIVE AFTER THE FIRST RENDER. The strip is restored from the store on mount,
  // so flashing what is simply already open would make every page load a light show.
  const seen = useRef(null);
  const [fresh, setFresh] = useState(() => new Set());
  useEffect(() => {
    const keys = tabs.map((t) => t.key);
    if (seen.current === null) {
      seen.current = new Set(keys);
      return undefined;
    }
    const born = keys.filter((k) => !seen.current.has(k));
    seen.current = new Set(keys);
    if (!born.length) return undefined;
    setFresh((f) => new Set([...f, ...born]));
    // Cleared on a timer rather than on `animationend`: a tab opened while the window is in a
    // background tab never animates at all, and the class would stay on it forever.
    const t = setTimeout(() => setFresh((f) => new Set([...f].filter((k) => !born.includes(k)))), 1400);
    return () => clearTimeout(t);
  }, [tabs]);

  // A DROP IS TWO DIFFERENT VERBS AND THE DIFFERENCE IS SILENT. `moveTab` finds a tab by key
  // wherever it lives, so treating a cross-pane drop as a reorder shuffles the document inside the
  // side he dragged it OUT of — nothing crosses, and nothing says so. `dropPlan` names which it is
  // from where the tab came and where it landed; both handlers below read it rather than deciding.
  const drop = useCallback(
    (key, onKey) => {
      const plan = dropPlan({ from: paneOf(tabsPc, key), to: pane, key, onKey });
      if (!plan) return;
      if (plan.verb === "reorder") moveTab(tabsPc, key, plan.before);
      else moveTabToPane(tabsPc, key, plan.to, plan.before);
    },
    [tabsPc, pane]
  );

  return (
    <>
      <div
        className="doc-tabs"
        // CLICKING A SIDE MAKES IT THE SIDE YOU ARE WORKING ON, even when the click lands on the
        // strip's empty tail rather than on a tab. Without this, opening a document after clicking
        // the right-hand strip would land it on the left, which reads as the window ignoring where
        // his hand is. A click on a TAB already does this through focusTab; this is the rest of the
        // strip. mousedown rather than click, so the focus is already right when a drag starts.
        onMouseDown={() => focusPane(tabsPc, pane)}
      >
        <div
          className={`doc-tabs__scroll${caret === "end" ? " doc-tabs__scroll--caret-end" : ""}`}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("text/sv-tab")) return;
            e.preventDefault();
            // The tabs stop propagation on their own dragover, so reaching here means the pointer
            // is in the strip but not over a tab — which is the "past the end" drop this row takes.
            setCaret("end");
          }}
          onDragLeave={(e) => {
            // `relatedTarget` is where the pointer went; still inside this strip means it never
            // left, and clearing then would flicker the caret off a dozen times crossing one row.
            if (e.currentTarget.contains(e.relatedTarget)) return;
            setCaret(null);
          }}
          onDrop={(e) => {
            const key = e.dataTransfer.getData("text/sv-tab");
            setCaret(null);
            if (!key) return;
            e.preventDefault();
            // STOPPED HERE. The pane's BODY is a drop target too, and a drop that bubbles out of
            // the strip would be handled twice — once as "land it on this side" and again as the
            // body's own verb. The strip's answer is the specific one, so it is the last one.
            e.stopPropagation();
            drop(key, null); // past the tabs = last on THIS side
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
                className={`doc-tab doc-tab--kind-${t.kind} ${active ? "doc-tab--active" : ""}${fresh.has(t.key) ? " doc-tab--fresh" : ""}${
                  caret === t.key ? " doc-tab--caret" : ""
                }`}
                // DRAG TO REORDER — the tab is the handle, dropping on a tab puts you where IT
                // sat, dropping past the row's end sends you last. The store owns the order.
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/sv-tab", t.key);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes("text/sv-tab")) return;
                  e.preventDefault();
                  // The row behind would otherwise claim "end" for every move across the strip.
                  e.stopPropagation();
                  setCaret(t.key);
                }}
                onDrop={(e) => {
                  const key = e.dataTransfer.getData("text/sv-tab");
                  setCaret(null);
                  if (!key || key === t.key) return;
                  e.preventDefault();
                  e.stopPropagation(); // or the ROW's drop fires next and sends it to the end
                  drop(key, t.key); // lands where THIS tab sits, on this side, wherever it came from
                }}
                onContextMenu={(e) => openTabMenu(e, t, label)}
              >
                <button
                  className="doc-tab__face"
                  // A STABLE ADDRESS FOR EVERY TAB (his ruling, 2026-10-29: "this is our
                  // application — assign a stable attribute wherever it makes sense"). A saved
                  // command navigates by pressing `[data-tab-kind="how"]` — no text matching, no
                  // position guessing, idempotent whether or not the tab is already active.
                  data-tab-kind={t.kind}
                  data-tab={t.key}
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
                  {/* WHICH PROJECT THIS DOCUMENT IS FROM — ALWAYS, or never.
                      It was shown only on a FOREIGN tab, and his: *"it goes away when you go into
                      the tab, which is weird… either it's showing all the time or it's not."* He is
                      right, and the cause is that clicking a foreign tab NAVIGATES to its project,
                      so by the time you are looking at it it is not foreign any more. A label that
                      disappears when you select the thing it labels is worse than no label.
                      `tabPc` answers "" for the dashboard and how-we-work, which belong to no
                      project — so those two carry nothing rather than wearing whichever project
                      happened to be in the URL when they were opened. */}
                  {tabPc(t, "") ? <span className="doc-tab__pc">{tabPc(t, "")}</span> : null}
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
        </div>
        {/* THE TWO DOORS ONTO CENTRE TABS — HELP AND THE DASHBOARD — OUTSIDE THE SCROLLER.
            Both open a centre tab, so they belong on the centre tab strip; the only other way in
            would be closing every document or typing a URL. *"I'm not going to close all my
            documents to have the tab strip empty to get to it."*

            THEY ARE REAL SIBLINGS OF THE SCROLL AREA, NOT ITEMS INSIDE IT. A door that lives among
            the tabs can only fake standing still — `position: sticky` pins it to the scrollport
            edge, and a pin releases at its own scroll offset, so two doors stuck to the same edge
            slide against each other as the tabs move and a third (the +) paints straight through
            them. Measured on his window: the + and the help door both ended at x=1672, one on top
            of the other, while the dashboard sat 26px left of its own DOM order. Out here there is
            nothing to pin: the group is the strip's tail, fixed beside the chat, and the tabs
            scroll underneath where they belong.

            SAME OFFER-FIRST CONTRACT ON BOTH. A page that hosts the kind itself claims the event
            (the Agents page does); silence means this strip's own host has to open it. Opening
            without the offer would navigate him off a page that could have shown it. */}
        <div className="doc-tabs__doors">
          <button
            type="button"
            className="doc-tabs__how help-icon"
            title="How we work — the flow, every kind's lifecycle, and where to start"
            onClick={() => {
              const d = { kind: "how", projectCode: tabsPc };
              window.dispatchEvent(new CustomEvent("sv:openCenterKind", { detail: d }));
              if (d.handled) return;
              const t = { key: `how:${tabsPc}`, kind: "how" };
              openTab(tabsPc, t);
              if (onOpen) onOpen(t);
            }}
          >
            {/* THE APP'S OWN HELP ICON, not a glyph invented for this one door. `.help-icon` is
                the ringed ? that already sits beside the scratchpad, saved tests and the nav's
                help section — so there is ONE thing in this window that means "explain this to
                me", and this is it at door size. The COMPONENT is not reused: `<Help topic=...>`
                opens a help topic in the middle panel through `?help=`, and this opens a centre
                tab. Same question, different door — so it shares the costume, not the wire. */}
            ?
          </button>
          <button
            type="button"
            className="doc-tabs__how doc-tabs__dash"
            title="Dashboard — every arc, RFC, gap and report across every project, and what is waiting on you"
            onClick={() => {
              const d = { kind: "dash", projectCode: tabsPc };
              window.dispatchEvent(new CustomEvent("sv:openCenterKind", { detail: d }));
              if (d.handled) return;
              const t = { key: "dash", kind: "dash" };
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

// THE OPEN-BY-PATH DOOR'S BRAIN, shared the same way: the path goes through
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
