import React, { useState, useContext, useEffect, useCallback, useRef } from "react";
import { useHistory, useLocation } from "react-router-dom";
import "./styles.scss";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import { EditorThemeToggle, useEditorDark } from "../../atoms/CodeView/editorTheme";
import Markdown from "../../atoms/Markdown/Markdown";
import { InDocumentProvider, ShownProvider } from "../../atoms/Markdown/context";
import CodePane from "../CodePane/CodePane";
import {
  getTabs,
  subscribeTabs,
  openTab,
  focusTab,
  closeTab,
  fileKey,
  fileOpenPlan,
  fileBranch,
  paneOf,
  moveTabToPane,
  splitTab,
} from "../../pages/SystemView/tabsStore";
import ServiceContext from "../../ServiceContext";
import { Client } from "../../systemClient";
import InlineLogs from "../InlineLogs/InlineLogs";
import Reports from "../../pages/Reports/Reports";
import { backHelpTopic, setHelpTopic } from "../../atoms/Help/helpStore";
import HELP_TOPICS from "../../atoms/Help/helpTopics";
import { raiseError } from "../../atoms/Banner/bannerStore";
import ReportsTab from "../Reports/ReportsTab";
import Board from "../Board/Board";
import CenterTabs, { useOpenByPath } from "../CenterTabs/CenterTabs";
import PaneDivider from "../CenterTabs/PaneDivider";
import KeptScope from "../../atoms/KeptPane/KeptScope";
import { bodyDropPlan } from "../CenterTabs/paneDrag";
import { buildRoute, tabForUrl, floorTab, seedable } from "../../pages/SystemView/tabRoutes";
import HowWeWork from "../HowWeWork/HowWeWork";
import DashboardSwitch from "../DashboardSwitch/DashboardSwitch";

export default function Documentation({
  projectCode,
  serviceId,
  moduleName,
  methodName,
  // The file open from the Codebase nav. RFC-026: the center is driven by WHAT IS OPEN, never by
  // which nav lens is showing — an open file means CODE (edit-first CodePane) whichever tab the nav
  // is on, and flipping the nav's SystemLynx/Codebases tabs changes nothing in the middle.
  codeFile = null,
  onCloseFile = () => {},
  // Push the whole center off to its Documents wall tab (the page owns the state) — the strip
  // renders the one wall-collapse button when this is given.
  onCollapse = null,
}) {
  const { connectedServices } = useContext(ServiceContext);
  const fileLens = !!codeFile;

  // Middle-panel scope — what the docs / logs / stories target. It DEFAULTS to the nav selection, but the
  // breadcrumb below can retarget it up or down INDEPENDENTLY of the nav: you can read logs (or stories, or
  // docs) at the project level while the nav tree + scratchpad stay pinned to a single method. Navigating
  // in the nav resets this to follow the nav again.
  const [scope, setScope] = useState({ projectCode, serviceId, moduleName, methodName });
  useEffect(() => {
    setScope({ projectCode, serviceId, moduleName, methodName });
  }, [projectCode, serviceId, moduleName, methodName]);
  const { projectCode: sProject, serviceId: sService, moduleName: sModule, methodName: sMethod } = scope;
  // The terminal level of the current middle scope — the breadcrumb highlights this segment blue, the rest
  // grey. Clicking a segment truncates the scope to that level.
  const scopeLevel = sMethod ? "method" : sModule ? "module" : sService ? "service" : "project";
  const nothingSelected = !sProject && !sService && !sModule && !sMethod;

  // The active tab persists in the URL (?tab=window) so it survives navigation, refresh, and can be
  // deep-linked. selectTab writes it; a back/forward that changes the URL syncs back into state.
  const history = useHistory();
  const location = useLocation();
  // "window" was the retired Stories tab — old URLs land on Stage (its replacement).
  const rawTab = new URLSearchParams(location.search).get("tab") || "docs";
  const urlTab = rawTab === "window" ? "reports" : rawTab;
  const [tab, setTab] = useState(urlTab);
  // A ? icon anywhere in the app (or the nav's help section) sets a help topic; while one is open it
  // takes the middle panel's content spot. It lives in the URL (`?help=`, owned by SystemView.js) —
  // that's the whole cure for "help locks you in": browser back pops it, and any navigation that
  // rewrites the search drops it. Picking a tab dismisses it — an explicit "show me that instead".
  const helpTopic = new URLSearchParams(location.search).get("help");
  const helpOpen = !!helpTopic;
  // Navigations that DON'T rewrite the URL search still exist (the breadcrumb retargets scope in
  // state only) — those clear help explicitly. Skip the mount run, or a deep-linked `?help=` would
  // close itself on arrival.
  const scopeKey = `${sProject}|${sService}|${sModule}|${sMethod}`;
  const prevScopeKey = useRef(scopeKey);
  useEffect(() => {
    if (prevScopeKey.current === scopeKey) return;
    prevScopeKey.current = scopeKey;
    setHelpTopic(null);
  }, [scopeKey]);
  // (selectTab is gone — the strip's clickTab/routeTo replaced the fixed kind buttons, RFC-054.)
  useEffect(() => { setTab(urlTab); }, [urlTab]);

  // Which document the Reports tab is reading rides the URL (?rdoc=…), so it survives a refresh and
  // can be linked — the same rule an open file follows.
  const reportPath = new URLSearchParams(location.search).get("rdoc") || null;
  // THE URL'S OWN ANSWER TO "IS A FILE OPEN", read here rather than inferred from the `codeFile`
  // prop. They are the same fact a render apart: the URL changes first, SystemView's effect copies
  // it into `codeFile`, and REACT RUNS THIS CHILD'S EFFECTS BEFORE THAT PARENT EFFECT — so there is
  // always one render where the prop still names the document you just navigated away from.
  const urlFile = new URLSearchParams(location.search).get("file") || null;

  // THE OPEN SET. The strip renders from the store; the URL names the ACTIVE tab (his
  // rule: "the URL routing includes what TYPE someone is in the center"). Existing params keep
  // their meaning by becoming open-or-focus operations — his dedupe rule, one entry point.
  const tabsPc = projectCode || "@none";
  const [tabsState, setTabsState] = useState(() => getTabs(tabsPc));
  useEffect(() => {
    setTabsState(getTabs(tabsPc));
    return subscribeTabs(tabsPc, setTabsState);
  }, [tabsPc]);
  // THE PANE THE URL IS TALKING ABOUT — the FOCUSED one, and that is the whole translation from
  // one pane to several. Everything on this page that reads the URL (the floor, which tab is
  // active, where a close lands) is a statement about the side he is working on; `panes[0]` said
  // "the left one" at every site written before the split existed, which is right exactly until
  // there are two. Unsplit, focus is 0 and this is the same object it always was.
  const pane = tabsState.panes[tabsState.focus] || tabsState.panes[0];
  // THE FLOOR IS THE HOW TAB — one name, three readers. With nothing loaded in the center (no
  // file, no namespace scope, or nothing open at all) this page shows How-we-work; it used to show
  // it as a bare RENDER, which opened no tab and selected nothing. After a shell restart that left
  // the URL in exactly this state the page was on screen with no tab of its own and every restored
  // tab unselected — nothing to close, nothing to click back to (his report, 2026-10-29: *"it's
  // showing, but the tab isn't selected, and this tab isn't showing"*). So the condition is named
  // once here and answered identically by all three: the effect below OPENS the tab, isTabActive
  // reads it as the selected one, and the render draws the page. If the page is up, its tab is up.
  const onFloor =
    !helpOpen && !fileLens && (pane.tabs.length === 0 || !sService) && (tab === "docs" || (tab === "reports" && !reportPath));
  // URL → store. A file in the URL opens/focuses its tab; otherwise the tab param names the kind.
  // `lastFileKey` is the last file this effect opened a tab for — the one fact that tells a genuine
  // navigation apart from a stale URL left behind by a close (see fileOpenPlan).
  const lastFileKey = useRef(null);
  // WHICH PROJECT HAS ALREADY HAD ITS FLOOR SEEDED. One per project, so an empty strip gets
  // How-we-work once rather than every time a render happens to find it empty.
  const seeded = useRef(null);
  useEffect(() => {
    // WHICH BRANCH WE ARE IN IS THE URL'S CALL, AND ONLY THE URL'S.
    //
    // His bug, 2026-11-11: *"you got two panes open, you bring one back into the other pane — it
    // doesn't want to let go of that tab."* One press on the Dashboard tab produced EIGHT events —
    // the click wrote `active=dash`, the route pushed `?tab=dash`, and then this effect fired on
    // the changed `tab` param while `codeFile` still held the file, re-opened it, and the
    // focus-routing effect below pushed the file's URL back. He could not leave the document.
    //
    // The prop is a COPY of the URL that arrives a render late, so it can say "a file is open"
    // after the URL has stopped saying so. It is still the right source for the file's DETAIL —
    // the line range, the side, the language — which the URL carries in pieces. So: the URL
    // decides the branch, the prop supplies the detail, and when they disagree we WAIT rather than
    // acting on either one alone. Waiting is safe because the prop catching up is itself a render.
    const branch = fileBranch(urlFile, codeFile && codeFile.path);
    if (branch === "wait") return;
    if (branch === "file") {
      const key = fileKey(codeFile);
      const open = getTabs(tabsPc);
      const pane0 = open.panes[open.focus] || open.panes[0];
      // PRESENT ANYWHERE, ANCHORED ON THIS SIDE. A file already open on the OTHER side is not a
      // tab to re-create — openTab focuses it where it lives (one document, one side) — so
      // presence is asked of every pane while the `beside` anchor is this side's active tab.
      const present = open.panes.some((pn) => pn.tabs.some((t) => t.key === key));
      // AN EXPLICIT CLOSE STAYS CLOSED (his bug: *"sometimes you close the document and it just
      // pops up at the end of the tabs"*). The URL is the slower writer: a close removes the tab
      // from the store, but this effect re-runs on its OTHER deps (scope, the floor, a report) and
      // would read a `?file=` a close left behind and re-open the tab — at the END, since it is no
      // longer in the set. A file GONE from the set that is the SAME one we last opened was closed
      // on purpose: don't resurrect it — clear the stale address so the view agrees with the strip.
      if (fileOpenPlan(present, key, lastFileKey.current) === "skip") {
        lastFileKey.current = null;
        onCloseFile();
        return;
      }
      lastFileKey.current = key;
      // NAVIGATING TO A FILE PUTS IT RIGHT OF WHERE YOU ARE — new or already open, it moves to sit
      // immediately after the tab you are leaving (his rule, files specifically). The anchor is read
      // fresh from the store so it is the tab you are leaving, not a render-old copy.
      openTab(tabsPc, { key, kind: "file", file: codeFile }, { beside: pane0.active, move: true });
      return;
    }
    lastFileKey.current = null;
    // BARE tab=reports CARRIES A LEGACY CLEAR — there was a picker tab for a few hours and some
    // caches still hold it. His ruling: nothing opens until an actual report is selected.
    if (urlTab === "reports") closeTab(tabsPc, "report");

    // THE ONE TAB THIS URL WANTS — planned by `tabForUrl`, which reads the URL and the scope and
    // NOTHING FROM THE STORE. That purity is the fix, not a tidy-up: see below.
    const want = tabForUrl({ urlTab, sService, sModule, sMethod, reportPath, projectCode: tabsPc });
    if (want) {
      openTab(tabsPc, want);
      return;
    }

    // THE FLOOR, AND THE BUG THAT LIVED HERE.
    //
    // His report, 2026-11-10: *"restart, land on how-we-work because everything else is loading.
    // And then if you close a tab, or you open another document, a bunch of other tabs open."*
    //
    // `onFloor` used to be in this effect's dependency array, and it is computed from
    // `pane.tabs.length === 0` — a value THIS EFFECT CHANGES by calling `openTab`. So one close ran
    // two opens: the strip emptied → onFloor true → `how:` opened → the strip had one tab →
    // onFloor false → the effect fired again and opened `doc:`. Every further transition added
    // another. An effect whose trigger depends on what it writes.
    //
    // Two halves to the fix, and the first is the one that matters:
    //
    //   1. `onFloor` IS OUT OF THE DEPS. Every dependency left is URL- or scope-derived, so this
    //      effect now fires on real navigation and on nothing else. No guard ref is needed — and
    //      deliberately none is used: a `lastOpened` guard would also block a legitimate re-open
    //      and leave no way to get the tab back, which is the trap the FILE branch above has to
    //      work around with `onCloseFile`.
    //   2. THE EMPTINESS IS READ IMPERATIVELY, HERE, at the moment the decision is made — never
    //      subscribed to. A write cannot re-trigger a read that was never a dependency.
    //
    // And ONE-SHOT PER PROJECT, because of the other half of his report. `tabsPc` is
    // `projectCode || "@none"`, so before the project resolves on a cold start the floor was seeded
    // into `@none` — a real cached store with its own localStorage key that no surface will ever
    // show again. That is the "cache somehow" he suspected: there genuinely is one, and it was
    // invisible. `seedable` refuses it.
    if (!seedable(tabsPc) || seeded.current === tabsPc) return;
    const open = getTabs(tabsPc);
    if (open.panes.every((pn) => pn.tabs.length === 0)) {
      seeded.current = tabsPc;
      openTab(tabsPc, floorTab(tabsPc));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsPc, urlTab, urlFile, reportPath, sService, sModule, sMethod, codeFile && codeFile.path, codeFile && codeFile.projectCode, codeFile && String(codeFile.lines), codeFile && codeFile.side]);
  // store → URL, on a strip click: the active tab writes the params that MEAN it — which is exactly
  // what keeps every deep link, chip and agent command working unchanged.
  // THE MAP LIVES IN tabRoutes.buildRoute NOW — the Agents page routes the
  // same tabs, and a second copy of this map is exactly the drift the extraction exists to kill.
  //
  // A ROUTE THAT CHANGES NOTHING IS NOT PUSHED. Several callers can ask for the same destination in
  // one interaction — the click routes, and the focus-routing effect below re-checks the same pane
  // a render later — and `history.push` has no opinion about that: it stacks an identical entry
  // every time, so the back button needs two presses to undo one click. Comparing before pushing is
  // the whole guard; it changes nothing about where a route GOES.
  const routeTo = useCallback((t) => {
    const next = buildRoute(t, tabsPc, window.location.search);
    const at = `${window.location.pathname}${window.location.search}`;
    if (`${next.pathname}${next.search}` === at) return;
    history.push(next);
  }, [history, tabsPc]);
  const clickTab = useCallback((t) => {
    focusTab(tabsPc, t.key);
    routeTo(t);
  }, [tabsPc, routeTo]);
  // WHAT A TAB BEING ACTIVE MEANS ON THIS PAGE — the URL's answer, never the store's alone, so
  // back/forward keep working. Handed to CenterTabs; the Agents page answers from its own state.
  // ON THE FLOOR, THE HOW TAB IS THE SELECTED ONE AND NOTHING ELSE IS — stated here rather than
  // folded into the list below, because the floor's whole defect was a page showing with no tab
  // wearing the selection.
  const isTabActive = useCallback((t) =>
    t.kind === "file"
      ? !!(fileLens && codeFile && fileKey(codeFile) === t.key)
      : onFloor
      ? t.kind === "how"
      : !fileLens &&
        ((t.kind === "doc" && (tab === "docs" || (tab === "reports" && !reportPath)) && t.key === `doc:${sService || ""}.${sModule || ""}.${sMethod || ""}`) ||
          (t.kind === "stats" && tab === "stats") ||
          (t.kind === "how" && tab === "how") ||
          (t.kind === "dash" && tab === "dash") ||
          (t.kind === "board" && tab === "board") ||
          ((t.kind === "links" || t.kind === "cmds") && tab === t.kind) ||
          (t.kind === "logs" && tab === "logs" && t.key === `logs:${sService || ""}.${sModule || ""}.${sMethod || ""}`) ||
          (t.kind === "report" && tab === "reports" && (t.report ? t.report.path === reportPath : !reportPath))),
    [fileLens, codeFile, onFloor, tab, reportPath, sService, sModule, sMethod]);
  // WHEN THE SIDE CHANGES, THE URL FOLLOWS IT.
  //
  // The URL names the document being looked at, and with a split standing that can only mean the
  // FOCUSED side's active tab. Several verbs move focus without touching the URL — the menu's
  // "give it its own side", a document dropped on the other pane, a press on the other strip — and
  // after any of them the URL would still be describing the pane he just left. The visible symptom
  // is worse than the inconsistency: the focused pane renders nothing at all, because the document
  // the URL names is not in it. Measured in a real browser, 2026-11-10: dropping a tab into the
  // dark section split it out correctly and the new side came up blank.
  //
  // ONLY WHILE SPLIT. With one pane the URL is already the single truth and this would be a second
  // writer arguing with it.
  const routedFocus = useRef(null);
  useEffect(() => {
    if ((tabsState.panes || []).length < 2) {
      routedFocus.current = null;
      return;
    }
    const pn = tabsState.panes[tabsState.focus];
    if (!pn || !pn.active) return;
    // Stamped, so this routes ONCE per (side, document) rather than on every render that still
    // disagrees — a route is a history entry, and one per render is a back button nobody can use.
    const stamp = `${tabsState.focus}:${pn.active}`;
    if (routedFocus.current === stamp) return;
    const t = (pn.tabs || []).find((x) => x.key === pn.active);
    if (!t) return;
    routedFocus.current = stamp;
    if (!isTabActive(t)) routeTo(t);
  }, [tabsState, isTabActive, routeTo]);

  // Closing what you're LOOKING AT routes to the neighbor; closing a background tab moves nothing.
  // Bulk closes land the same way — CenterTabs already did the store half.
  const afterClose = useCallback((nextKey) => {
    // ACROSS EVERY PANE. closeTab answers with the focused pane's new active tab, and after the
    // last tab on a side closes that pane is gone and focus has moved to the survivor — so looking
    // the key up in `panes[0]` would find nothing and send him to the project page instead of to
    // the document he is left looking at.
    const next = (getTabs(tabsPc).panes || []).flatMap((pn) => pn.tabs || []).find((x) => x.key === nextKey);
    if (next) return routeTo(next);
    // NOTHING LEFT OPEN lands on the project's own page.
    const q = new URLSearchParams(window.location.search);
    ["file", "fproj", "fsvc", "flang", "flines", "fside", "fnav", "ftab", "fmachine", "help", "rdoc"].forEach((k) => q.delete(k));
    q.set("tab", "docs");
    history.push({ pathname: `/specs/${projectCode}`, search: `?${q.toString()}` });
  }, [tabsPc, routeTo, history, projectCode]);
  // the open-by-path door, shared from CenterTabs (one brain, every host).
  const plusDoor = useOpenByPath(tabsPc);
  // The Code page's own menu rows — a file reveals in the codebase and copies its path.
  const extraMenuItems = useCallback((t) => {
    if (t.kind !== "file" || !t.file) return [];
    return [
      {
        label: "Reveal in codebase",
        action: () =>
          window.dispatchEvent(
            new CustomEvent("sv:openFileInNav", { detail: { projectCode: t.file.projectCode || projectCode, path: t.file.path, machine: t.file.machine } })
          ),
      },
      { label: "Copy path", action: () => navigator.clipboard && navigator.clipboard.writeText(t.file.path) },
    ];
  }, [projectCode]);

  // WHAT THE CENTER SHOWS = what the URL says is active (never the store alone, so back/forward
  // keep working): a file when one is in the URL, else the kind the tab param names.
  //
  // There used to be an `activeFileTab` here, read so the one shared code pane could be handed the
  // active tab's file. Every open file has its own pane now, and each reads its OWN tab, so there
  // is nothing left for a single "which one is active" lookup to feed — the visibility test does
  // that job where the panes are rendered.

  const openReport = useCallback((path) => {
    const p = new URLSearchParams(window.location.search);
    if (path) p.set("rdoc", path);
    else p.delete("rdoc");
    history.replace({ search: p.toString() });
  }, [history]);


  // Which service's plugin serves this doc. BUG THIS FIXES: at project level we used to take the
  // FIRST service in the project — but a project can contain services with NO plugin (a codebase
  // entry, or a service that registers without the SystemView module, e.g. Test). Picking
  // one of those left `Plugin` undefined, so getDoc never ran and the project doc rendered as "No
  // documentation yet" — the doc looked DELETED purely because of connection order.
  const hasPlugin = (s) =>
    ((s.system && s.system.connectionData && s.system.connectionData.modules) || []).some(
      (m) => m.name === "Plugin"
    );
  const service =
    connectedServices.find(
      (s) => s.serviceId === sService && s.projectCode === sProject
    ) ||
    // Project level (no service selected): ANY plugin-bearing service of the project will do — the
    // project doc lives at the project root, so every plugin reads the same {projectCode}.md.
    (!sService
      ? connectedServices.find((s) => s.projectCode === sProject && hasPlugin(s)) ||
        connectedServices.find((s) => s.projectCode === sProject)
      : undefined);
  const { Plugin } = service ? Client.createService(service.system.connectionData) : {};

  const [doc, setDocument] = useState({
    documentation: "",
    namespace: { serviceId: sService, moduleName: sModule, methodName: sMethod },
  });

  const fetchDocument = async (Plugin) => {
    setDocument({ documentation: "", namespace: { serviceId: sService, moduleName: sModule, methodName: sMethod } });
    try {
      if (Plugin) {
        const results = await Plugin.getDoc({ serviceId: sService, moduleName: sModule, methodName: sMethod });
        setDocument(results);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDocument(Plugin);
    // Tab is NOT reset on navigation — it persists via the URL so you stay where you were.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sMethod, sModule, sService, Plugin]);

  // RFC-029 refresh scope `docs` — the agent edited the file on disk; re-read it in place, no
  // page reload (the sv:refresh event is fanned out by the chat command executor).
  useEffect(() => {
    const on = (e) => {
      const s = ((e && e.detail) || {}).scope || "all";
      if (s === "all" || s === "docs") fetchDocument(Plugin);
    };
    window.addEventListener("sv:refresh", on);
    return () => window.removeEventListener("sv:refresh", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Plugin, sMethod, sModule, sService]);

  useEffect(() => {
    // if (Plugin) Plugin.on(`reconnect`, fetchDocument.bind({}, Plugin));
  }, [Plugin]);

  // ONE PANE'S WORTH OF CONTENT — every panel this page can show, for the pane `pn` at index `i`.
  //
  // It is a function and not a component on purpose: a component would be a new element type, and
  // a new element type under the panes row means React unmounts and remounts the whole subtree the
  // first time the split appears — throwing away exactly the scroll positions and in-flight state
  // that the kept panels exist to preserve. As a function it is inlined into the column, so a
  // document's DOM node survives everything except being carried to the other side.
  //
  // WHICH SIDE THE URL IS TALKING ABOUT. The URL names ONE active document, so with a split
  // standing it can only be speaking for the FOCUSED side; the other side answers from the store —
  // the tab its own pane says is active. Unsplit, every pane IS the focused pane, so each of these
  // collapses to the URL's answer and nothing about today's behaviour moves.
  const panelsFor = (pn, i) => {
    const focus = tabsState.focus;
    const activeOf = (p) => (p.tabs || []).find((t) => t.key === p.active) || null;
    const holdsKey = (p, key) => (p.tabs || []).some((t) => t.key === key);
    const holdsKind = (p, kind) => (p.tabs || []).some((t) => t.kind === kind);
    const showsKey = (p, at, key, urlSays) => (at === focus ? !!urlSays : p.active === key);
    // AN OPEN HELP TOPIC TAKES ITS OWN SIDE'S CONTENT SPOT, not the window's. It is opened from a
    // document, so the side that document is on is the side it belongs over — and the other pane
    // keeping its document is the whole reason to have two.
    const hidden = helpOpen && i === focus;
    return (
      <>
        {/* THE NAMESPACE IS THE DOC TAB'S, PER-TAB — his second correction on this line: it was
            still painted at the COMPONENT level, so it sat over logs, over files, over an empty
            view after a delete ("it shows the namespace at the top — that doesn't make any sense").
            A namespace is a fact about the namespace DOCUMENT: it renders only on that tab, and
            only when something is actually selected — an empty state has no address to announce. */}
        {/* An open HELP topic takes the content spot — whatever tab was showing waits behind it. */}
        {hidden && (
          <div className="documentation-view__data-table">
            <HelpPane topicKey={helpTopic} />
          </div>
        )}
        {/* RFC-022 — the Code center: edit-first file pane fed by the Codebase nav's selection.
            ONE PANE PER OPEN FILE TAB, and this is where his ask actually lives: *"saving where you
            are in the document."* A TAB IS A TAB — every document he opens is a file tab, so one
            shared pane serving all of them meant switching files rebuilt the pane and the scroll
            position went with it. Now each open file keeps its own pane and all but the active one
            are hidden, so leaving a document and coming back lands where he was.

            THE GATE IS NOT `fileLens && tab === "docs"` ANY MORE, and that is deliberate: as a
            gate it unmounted every file pane the moment he looked at the dashboard, which is
            exactly the case this is meant to survive. It moved into the visibility test, so the
            panes live as long as their TABS do.

            EACH PANE KEEPS ITS OWN `documentation-view__data-table`, because `styles.scss:621` is
            `> .documentation-view__data-table > .code-pane` — a direct-child chain. Nesting the
            panes under one shared wrapper would break it the same way wrapping the dashboard did.

            Each pane reads its OWN tab's file rather than the active one, so a hidden pane cannot
            be handed somebody else's address. */}
        {!hidden &&
          (pn.tabs || [])
            .filter((t) => t.kind === "file" && t.file)
            .map((t) => {
              const showing = showsKey(pn, i, t.key, fileLens && tab === "docs" && codeFile && fileKey(codeFile) === t.key);
              return (
                <div key={t.key} className={`documentation-view__data-table${showing ? "" : " doc-kept-away"}`}>
                  {/* THE SIDE PANEL BELONGS TO THE DOCUMENT HE PICKED, and this is where that gets
                      said. Showing is not enough: with a split standing, BOTH panes are showing a
                      document and only one of them is the selection. `DocProofs` reads this and
                      loads that document's specs; everything else inside the markdown ignores it. */}
                  <ShownProvider value={showing && i === focus}>
                    {/* The pane's × closes ITS OWN tab — the strip picks the neighbor you land on. */}
                    <CodePane
                      file={t.file}
                      onClose={() => {
                        const nextKey = closeTab(tabsPc, t.key);
                        afterClose(nextKey, null);
                      }}
                    />
                  </ShownProvider>
                </div>
              );
            })}
        {/* NOTHING LOADED — HOW WE WORK takes the floor. The empty strip used to show SystemView's
            own documentation, which answered "what are these panels" for somebody who already knew
            why they would want them ("it's kind of bullshit" — his read, 2026-10-27). What belongs
            on the surface you land on is the FLOW: a goal becoming an arc becoming plans becoming
            claims, every kind's lifecycle, and the doors to start one.
            AND THE FLOOR COVERS AN UNRESOLVED SCOPE TOO (his ruling, 2026-10-28: "stop going to
            that SystemView page… the how page is built in, so it won't have that problem of things
            not loaded yet"): the manual ships inside the bundle, needs no hub, no plugin and no
            fetch — so when a restored tab's scope has not landed, or never lands because the
            document failed to load, the floor is this page rather than a dead doc pane labelled
            "SystemView". The moment the scope resolves, the real document replaces it.
            The condition is `onFloor`, defined once above — the effect opens the tab off the same
            boolean that draws this, so the page can never be up without its tab. */}
        {onFloor && i === focus && (
          <div className="documentation-view__data-table">
            <HowWeWork />
          </div>
        )}
        {!hidden &&
          holdsKind(pn, "doc") &&
          !!sService &&
          (i === focus
            ? !fileLens && pane.tabs.length > 0 && (tab === "docs" || (tab === "reports" && !reportPath))
            : (activeOf(pn) || {}).kind === "doc") && (
          <div className="documentation-view__data-table">
            {/* The doc IS a file panel — a framed pane with a header/badge. When nothing is selected it
                shows SystemView's own help; otherwise the per-namespace doc (getDoc/saveDoc). The doc's
                Edit/Save/Close live IN this header, exactly like the Code pane's — the rendered document
                below is for reading, never click-to-edit. */}
            <DocDescription
              key={`${sService}.${sModule}.${sMethod}`}
              crumb={sService ? (<>
          {/* The scope breadcrumb. Each segment is CLICKABLE: it retargets the middle panel (docs/logs/
              stories) to that level WITHOUT moving the nav or scratchpad. The segment matching the current
              middle scope is highlighted blue; the rest (project included) are grey. Segments come from the
              nav path (its depth is the deepest you can drill), so you can move freely up and down it. */}
          {fileLens && (
            <span className="doc-tabs__ns" title="The codebase this file belongs to">
              <span className="doc-tabs__ns-seg doc-tabs__ns-seg--active">
                {codeFile.projectCode}
              </span>
              <span className="doc-tabs__ns-paren"> codebase</span>
            </span>
          )}
          {!fileLens && (
          <span className="doc-tabs__ns" title="Scope for docs / logs / stories — click a level to retarget it">
            {projectCode && (
              <>
                <span
                  className={`doc-tabs__ns-seg${scopeLevel === "project" ? " doc-tabs__ns-seg--active" : ""}`}
                  onClick={() => setScope({ projectCode })}
                >
                  {projectCode}
                </span>
                {serviceId && <span className="doc-tabs__ns-sep">»</span>}
              </>
            )}
            {serviceId && (
              <span
                className={`doc-tabs__ns-seg${scopeLevel === "service" ? " doc-tabs__ns-seg--active" : ""}`}
                onClick={() => setScope({ projectCode, serviceId })}
              >
                {serviceId}
              </span>
            )}
            {moduleName && (
              <>
                <span className="doc-tabs__ns-dot">.</span>
                <span
                  className={`doc-tabs__ns-seg${scopeLevel === "module" ? " doc-tabs__ns-seg--active" : ""}`}
                  onClick={() => setScope({ projectCode, serviceId, moduleName })}
                >
                  {moduleName}
                </span>
              </>
            )}
            {methodName && (
              <>
                <span className="doc-tabs__ns-dot">.</span>
                <span
                  className={`doc-tabs__ns-seg${scopeLevel === "method" ? " doc-tabs__ns-seg--active" : ""}`}
                  onClick={() => setScope({ projectCode, serviceId, moduleName, methodName })}
                >
                  {methodName}
                </span>
                <span className="doc-tabs__ns-paren">(…)</span>
              </>
            )}
          </span>
          )}
              </>) : null}
              doc={doc}
              setDocument={setDocument}
              Plugin={Plugin}
              scope={{ projectCode: sProject, serviceId: sService, moduleName: sModule, methodName: sMethod }}
              // THIS BRANCH ONLY RENDERS WITH TABS OPEN AND A RESOLVED SERVICE — everything short
              // of that is the how-we-work floor above, so what shows here is always the open
              // tab's own document, never a default and never a half-loaded pane.
              label={sMethod ? `${sService}.${sModule}.${sMethod}` : sModule ? `${sService}.${sModule}` : sService}
            />
          </div>
        )}
        {/* REPORTS — ONE PANEL PER OPEN DOCUMENT, not one panel per tab KIND.
            His ask, narrowed by him: *"not working for documents… meaning, saving where you are in
            the document."* That is scroll position, and the only way a scroll offset survives is
            for the panel never to be torn down — so every open report tab gets its own instance and
            all but the active one are hidden.

            THE `key` CHANGED ON PURPOSE. It used to be the SCOPE, which meant navigating the tree
            rebuilt an open document — the remount this whole change exists to stop. The key is the
            TAB now, because a document's identity is its path and nothing about where you are
            standing in the service tree makes it a different document.

            A WRAPPER IS SAFE HERE and was not safe for the dashboard: nothing targets
            `.reports-tab` with a direct-child selector (checked, not assumed, after
            `> .documentation-view__data-table` cost him a scrollable dashboard). It still has to
            PASS THE SPACE THROUGH, which is what that rule was doing — `.doc-kept-doc` does it
            explicitly.

            With a file open, Logs and Report run at the PROJECT level — same rule as Stories. */}
        {!hidden &&
          (pn.tabs || [])
            .filter((t) => t.kind === "report" && t.report && t.report.path)
            .map((t) => {
              const showing = showsKey(pn, i, t.key, tab === "reports" && reportPath === t.report.path);
              return (
                <div key={t.key} className={`doc-kept-doc${showing ? "" : " doc-kept-away"}`}>
                  {/* A HIDDEN DOCUMENT IS NOT TOLD WHERE HE IS STANDING. These panels used to be
                      handed the LIVE scope, so walking the service tree re-fired the listing
                      effects of every document open behind the one he was looking at — wasted
                      work, bounded only by how many he has open. A document's identity is its
                      path; the tree position is not a fact about it. KeptScope holds the last
                      scope this panel was SHOWN with and generates no element, which is the half
                      of KeptPane the centre can use (`display: contents` breaks the height
                      chain). */}
                  <ShownProvider value={showing && i === focus}>
                    <KeptScope
                      showing={showing}
                      scope={{
                        projectCode: fileLens ? codeFile.projectCode : sProject,
                        serviceId: fileLens ? undefined : sService,
                        moduleName: fileLens ? undefined : sModule,
                        methodName: fileLens ? undefined : sMethod,
                      }}
                    >
                      {(sc) => (
                        <ReportsTab
                          projectCode={sc.projectCode}
                          serviceId={sc.serviceId}
                          moduleName={sc.moduleName}
                          methodName={sc.methodName}
                          openName={t.report.path}
                          onOpen={openReport}
                        />
                      )}
                    </KeptScope>
                  </ShownProvider>
                </div>
              );
            })}
        {!hidden && i === focus && (tab === "links" || tab === "cmds") && (
          <div id={`sv-dock-slot-${tabsPc}-${tab}`} className="doc-dockslot">
            {/* the docked AgentChat portals the live panel in here; an empty slot means the chat
                for this project is not docked in the side panel right now */}
          </div>
        )}
        {/* OPENED DELIBERATELY, not fallen into. Same page as the floor below — one component,
            so the two can never drift into two answers about how the system works. */}
        {/* KEPT, NOT REBUILT — his ask: *"keep state as you go across tabs without... coming to
            the page."* Leaving a tab used to UNMOUNT the panel, so the scroll position, an open
            editor and anything mid-flight were rebuilt on return.
            Released when the TAB IS CLOSED — the open set is the lifetime, because "keep
            everything forever" feeds the card about the window getting heavier the longer it is
            open.
            AND THE HIDE IS ON THE PANEL'S OWN ELEMENT, adding no DOM level. The first build
            wrapped these in `KeptPane`, whose `display: contents` is layout-neutral by design —
            but `display: contents` changes BOX GENERATION, never SELECTOR MATCHING, and
            `styles.scss:621` is `> .documentation-view__data-table` giving it `min-height: 0`.
            One element in between and that rule stopped matching, so the panel lost the one
            property that lets a flex child scroll instead of stretching. He found it in a minute:
            *"suddenly the dashboard cannot be scrolled, or is stretching too long."* */}
        {!hidden && holdsKey(pn, `dash:${tabsPc}`) && (
          <div className={`documentation-view__data-table${showsKey(pn, i, `dash:${tabsPc}`, tab === "dash") ? "" : " doc-kept-away"}`}>
            <DashboardSwitch projectCode={tabsPc} />
          </div>
        )}
        {!hidden && holdsKey(pn, `how:${tabsPc}`) && (
          <div className={`documentation-view__data-table${showsKey(pn, i, `how:${tabsPc}`, tab === "how") ? "" : " doc-kept-away"}`}>
            <HowWeWork />
          </div>
        )}
        {!hidden && holdsKey(pn, `board:${tabsPc}`) && (
          <div className={`doc-board${showsKey(pn, i, `board:${tabsPc}`, tab === "board") ? "" : " doc-kept-away"}`}>
            <Board projectCode={tabsPc} chrome="pane" />
          </div>
        )}
        {/* STATS IS KEPT NOW, like every other centre document — `Reports` takes a className, so
            the hide goes on its OWN root element and no DOM level is added. It was the last panel
            still rebuilt on leaving, and the reason was only ever that one missing prop. */}
        {!hidden && holdsKey(pn, `stats:${tabsPc}`) && (
          <Reports
            projectCode={fileLens ? codeFile.projectCode : sProject}
            serviceId={fileLens ? undefined : sService}
            embedded
            className={showsKey(pn, i, `stats:${tabsPc}`, tab === "stats") ? "" : "doc-kept-away"}
          />
        )}
        {!hidden && i === focus && tab === "logs" && (
          <InlineLogs
            projectCode={fileLens ? codeFile.projectCode : sProject}
            serviceId={fileLens ? undefined : sService}
            moduleName={fileLens ? undefined : sModule}
            methodName={fileLens ? undefined : sMethod}
          />
        )}
      </>
    );
  };

  // THE ROW THE DIVIDER MEASURES AGAINST — a fraction is only meaningful against the thing it is a
  // fraction of, and that is this element's box, read fresh on every pointer move.
  const panesRow = useRef(null);
  const panes = tabsState.panes || [];
  const sizes = tabsState.sizes || [];

  // THE DARK SECTION IS A TARGET TOO — his *"a tab should be able to be dragged out and hover and
  // then placed back in any tab. Any dark section."* A 30px strip is the fiddly way to aim a
  // dragged document; the document area is the obvious one, and "hover" is the half that makes a
  // drag feel like placing rather than guessing — so the pane it would land in says so while the
  // tab is over it.
  //
  // dragenter/dragleave FIRE FOR EVERY CHILD the pointer crosses, so a naive leave-handler blinks
  // the outline off a dozen times crossing one document. `relatedTarget` is where the pointer went:
  // still inside this pane means it never left.
  const [dropPane, setDropPane] = useState(null);
  const bodyDrop = useCallback(
    (e, i) => {
      const key = e.dataTransfer.getData("text/sv-tab");
      setDropPane(null);
      if (!key) return;
      e.preventDefault();
      const plan = bodyDropPlan({ from: paneOf(tabsPc, key), to: i, key, panes: getTabs(tabsPc).panes.length });
      if (!plan) return;
      if (plan.verb === "cross") moveTabToPane(tabsPc, key, plan.to);
      else splitTab(tabsPc, key);
    },
    [tabsPc]
  );

  return (
    <section className="documentation">
      <div className="documentation-view">
        {/* THE PANES ROW — a column per pane, a divider between each pair. His ask, said twice:
            *"you can split into two and you can drag documents across and resize between them.
            Close all the tabs on one side and it goes back to regular."*

            ALWAYS RENDERED, EVEN WITH ONE PANE, and that is the one structural decision here. A row
            that only appeared when split would mean collapsing the split RE-PARENTS every open
            document — and re-parenting remounts, which throws away the scroll positions the kept
            panels exist to hold, at the exact moment he closes the last tab on one side. One shape
            always: React reconciles the columns by position, the surviving side is never touched,
            and the only remount left is the one he asked for by carrying a document across.

            THE COLUMNS GROW, THEY DO NOT BASIS. `flex: <size> 1 0` shares the space left after the
            divider in proportion to the stored fractions; percentage widths plus a 6px divider add
            up to more than the row and the last column loses the difference.

            COLLAPSING IS THE STORE'S JOB, not this render's — `normalize` prunes a pane whose last
            tab closed, so there is no condition here that says when to go back to one. */}
        <div className="documentation-view__panes" ref={panesRow}>
          {panes.map((pn, i) => (
            <React.Fragment key={`pane-${i}`}>
              {i > 0 && <PaneDivider tabsPc={tabsPc} index={i - 1} rowRef={panesRow} />}
              <div
                className={`documentation-view__pane${panes.length > 1 && i === tabsState.focus ? " documentation-view__pane--focus" : ""}${
                  dropPane === i ? " documentation-view__pane--drop" : ""
                }`}
                // A STABLE ADDRESS PER SIDE, the same rule the tabs follow: a check or a saved
                // command finds `[data-pane="1"]` rather than counting divs.
                data-pane={i}
                style={{ flex: `${sizes[i] || 1 / panes.length} 1 0px` }}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes("text/sv-tab")) return;
                  e.preventDefault();
                  if (dropPane !== i) setDropPane(i);
                }}
                onDragLeave={(e) => {
                  // Only when the pointer actually left this pane — not on every child boundary.
                  if (e.currentTarget.contains(e.relatedTarget)) return;
                  setDropPane((cur) => (cur === i ? null : cur));
                }}
                onDrop={(e) => bodyDrop(e, i)}
              >
                {/* THE SAME STRIP, ONE PER SIDE — it is told which side it is, and that index is
                    what makes a drop from the other pane a crossing rather than a reorder. */}
                <CenterTabs
                  tabsPc={tabsPc}
                  tabs={pn.tabs}
                  pane={i}
                  isActive={isTabActive}
                  onOpen={clickTab}
                  afterClose={afterClose}
                  extraMenuItems={extraMenuItems}
                  plus={plusDoor}
                  onCollapse={onCollapse}
                />
                {panelsFor(pn, i)}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}


// A help topic shown in the doc pane's clothes: same header band + md-view read box, its own
// "help" badge tint, Close returns to whatever tab was showing. Read-only by design — help content
// lives in src/atoms/Help/helpTopics.js, not in the repo's specs/docs.
const HelpPane = ({ topicKey, depth = 1 }) => {
  const [editorDark] = useEditorDark("docs");
  const t = HELP_TOPICS[topicKey] || {
    title: topicKey,
    body: "_No help written for this topic yet — add it in `src/atoms/Help/helpTopics.js`._",
  };
  return (
    <div className="doc-pane">
      <div className={`doc-pane__header ${!editorDark ? "doc-pane__header--light" : ""}`}>
        <span className="doc-pane__kind doc-pane__kind--help">help</span>
        <span className="doc-pane__label">{t.title}</span>
        <span className="doc-pane__actions">
          <EditorThemeToggle scope="docs" />
          {/* Help topics link to each other, so the panel needs a way BACK to where you were — not
              only a way out. Back pops one topic; from the first one it returns to the document. */}
          <button
            type="button"
            className="doc-pane__btn"
            onClick={backHelpTopic}
            title={depth > 1 ? "Back to the previous topic" : "Back to the document"}
          >
            ‹ Back
          </button>
          <button type="button" className="doc-pane__btn" onClick={() => setHelpTopic(null)}>
            Close
          </button>
        </span>
      </div>
      <div className="doc-pane__body">
        <div className={`md-view md-view--${editorDark ? "dark" : "light"}`}>
          {/* A help topic is a code constant, so it can't write a CHECKLIST back — but a thread is a
              sidecar, not the document, so replies on a help topic save fine. Key it by topic. */}
          <Markdown dark={editorDark} children={t.body} commentKey={`app:help-${topicKey}`} />
        </div>
      </div>
    </div>
  );
};

// The doc pane, whole: header (badge + namespace label + the Edit/Save/Close controls) and the body
// (rendered document, or the dark editor while editing). Same shape as the Code pane — the header
// owns the mode, the document below is for reading.
const DocDescription = ({ doc, setDocument, Plugin, label, crumb = null, readOnly, scope = null }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(doc.documentation);
  const [editorDark] = useEditorDark("docs");

  // Stale-tab guard: `base` = the doc as loaded; a conflict answer means another tab/agent saved
  // meanwhile — the save is held, and a deliberate second Save overwrites (the previous version
  // is in the snapshot ring either way).
  const conflictRef = useRef(false);
  const saveDocument = async () => {
    if (!Plugin) return;
    try {
      const results = await Plugin.saveDoc(
        conflictRef.current
          ? { ...doc, documentation: text }
          : { ...doc, documentation: text, base: doc.documentation },
      );
      if (results && results.conflict) {
        conflictRef.current = true;
        raiseError(
          "Save held — this document changed elsewhere",
          "Another tab or an agent saved it after you loaded it, so your save was held instead of wiping theirs. Save again to overwrite with yours — every version is kept in history.",
        );
        return;
      }
      conflictRef.current = false;
      setDocument(results);
      setEditing(false);
    } catch (error) {
      console.error(error);
      raiseError("Couldn't save the document", error && (error.message || String(error)));
    }
  };
  const cancel = () => {
    setText(doc.documentation);
    setEditing(false);
  };

  useEffect(() => {
    setText(doc.documentation);
    setEditing(false);
  }, [doc]);

  return (
    <div className="doc-pane">
      <div className={`doc-pane__header ${!editorDark ? "doc-pane__header--light" : ""}`}>
        <span className="doc-pane__kind">doc</span>
        {/* THE NAMESPACE LIVES IN THE HEADER — his cut, after the separate crumb row kept costing
            a blank band above every namespace doc: the header bar already names the document, so
            the clickable segments ARE the name. Falls back to the plain label anywhere no crumb
            is handed in (help pane, project landing). */}
        {crumb ? <span className="doc-pane__label doc-pane__label--crumb">{crumb}</span> : <span className="doc-pane__label">{label}</span>}
        <span className="doc-pane__actions">
          {/* The document follows the DOCS theme even in READ mode — the toggle rides the ONE
              corner cluster, right beside Edit (a second auto-margined span floated it to center). */}
          <EditorThemeToggle scope="docs" />
          {!readOnly &&
            (!editing ? (
              <button type="button" className="doc-pane__btn" onClick={() => setEditing(true)}>
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="doc-pane__btn doc-pane__btn--save"
                  onClick={saveDocument}
                >
                  Save
                </button>
                <button type="button" className="doc-pane__btn" onClick={cancel}>
                  Close
                </button>
              </>
            ))}
        </span>
      </div>
      <div className="doc-pane__body">
        <div className={`md-view md-view--${editorDark ? "dark" : "light"}`}>
          {editing ? (
            <div className="edit-box edit-box--edit">
              <DescriptionBox text={text || ""} setValue={setText} dark={editorDark} />
            </div>
          ) : text ? (
            // IN A DOCUMENT — so a reference inside it opens the next document BESIDE this one
            // rather than throwing you off the page you are reading. The same blocks in the chat
            // carry no such context and open normally.
            <InDocumentProvider>
            <Markdown
              dark={editorDark}
              children={text}
              scope={scope}
              commentKey={`doc-${(scope && scope.projectCode) || ""}-${[doc.namespace && doc.namespace.serviceId, doc.namespace && doc.namespace.moduleName, doc.namespace && doc.namespace.methodName].filter(Boolean).join(".") || "project"}`}
              // the document IS the store. A checklist toggle is a narrower edit down
              // the same saveDoc path the editor uses.
              onSourceChange={
                Plugin && !readOnly
                  ? async (next) => {
                      // Optimistic: the toggle is already reflected locally, so don't round-trip
                      // the result back into `doc` — that would re-render the document (and every
                      // embed in it) a second time for a save that changed nothing else.
                      setText(next);
                      try {
                        await Plugin.saveDoc({ ...doc, documentation: next });
                      } catch (e) {
                        console.error(e);
                      }
                    }
                  : null
              }
            />
            </InDocumentProvider>
          ) : (
            <div className="doc-empty">
              <span className="doc-empty__icon">✎</span>
              No documentation yet — hit Edit to write it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
