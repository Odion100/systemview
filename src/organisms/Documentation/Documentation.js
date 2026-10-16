import React, { useState, useContext, useEffect, useCallback, useRef } from "react";
import { useHistory, useLocation } from "react-router-dom";
import "./styles.scss";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import { EditorThemeToggle, useEditorDark } from "../../atoms/CodeView/editorTheme";
import Markdown from "../../atoms/Markdown/Markdown";
import CodePane from "../CodePane/CodePane";
import { getTabs, subscribeTabs, openTab, focusTab, closeTab, fileKey } from "../../pages/SystemView/tabsStore";
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
import { buildRoute } from "../../pages/SystemView/tabRoutes";

// Shown in the center when NOTHING is selected in the nav — SystemView's own help, so the Specs area is
// useful on arrival instead of blank.
// The document you land on when NOTHING is selected — the HELP HUB. It is written in the
// interactive vocabulary it documents (RFC-025): the tabs are `::::tabs`, the feature status is a
// read-only checklist (no write target — this is a code constant, and the block says so), and every
// `:help[…]` chip opens that topic in this same panel.
const SYSTEMVIEW_HELP = `# SystemView

A documentation + testing surface for your **SystemLynx** services — and, increasingly, any codebase.
This page is the **hub**: what each panel does, and what the app can currently do. Pick a topic chip
to go deeper, or select something on the left to start working.

:help[navigator] :help[scratchpad] :help[actions] :help[chat] :help[markdown] :help[events]

## The three panels

| Panel | What it's for |
|---|---|
| **Navigator** (left) | Two lenses: **SystemLynx** (projects → services → modules → methods) and **Codebases** (your files). |
| **Center** | **Documentation** · **Logs** · **Stage** (reports) for whatever is selected — or a file, in the Codebases lens. |
| **Scratch Pad** (right) | Build, run and save tests; the **Actions** tab holds reusable shared setups. |

## What's here — by area

::::tabs

:::tab{label="Documents"}
Docs are markdown files that live in your repo (\`specs/docs/\`, and \`<projectCode>.md\` at the root for
a project-level doc). Since RFC-025 they are **interactive** — same renderer everywhere, so a block
works in a doc, a story pane, an agent note, a help topic and the codebase preview alike.

- [x] \`:ns[Math.add]\` — namespace chips that navigate, resolved against the live connection tree
- [x] \`:file[path#L40-70]\` — open a file in the codebase surface at a line range
- [x] \`:help[markdown]\` — open a help topic (the chips at the top of this page)
- [x] \`:::callout{type=info|warn|danger|success}\` and \`:::details{summary=…}\`
- [x] \`::::tabs\` / \`:::tab{label=…}\` and \`::::columns\` / \`:::col\`
- [x] \`::chart{report=throughput|errors|latency}\` — live Stats inside prose
- [x] \`::test[Math.chainUse]\` — a saved test, runnable in place
- [x] \`::topology\` / \`::load\` — the rest of the Stats page, inline
- [x] \`::logs[Math.chainUse]{limit=50}\` — the Logs viewer, scoped by the block
- [x] \`::file[path#L20-46]\` / \`::diff[path]\` — a story's file and diff panes, in prose
- [x] task lists that **write back to the document** when the surface can save
- [x] \`:::run\` — steps written on the fly; \`::run[name]\` replays a saved action
- [x] \`::question\` — inputs whose answers persist into the document
- [x] \`::::carousel\` / \`:::slide\`
- [x] \`:::thread{id=…}\` — a reply thread on whatever it wraps
- [x] \`:::approval{ask=…}\` — approve/reject, written into the document
- [ ] \`::cmd\`, \`::mermaid\`, media and external embeds

**Live, right here** — these are the real blocks, not a list of them:

:ns[Math.chainUse] :file[src/atoms/Markdown/registry.js] :help[markdown]

:::callout{type=success}
A callout, inside a tab, inside the hub. Every surface, same vocabulary.
:::

:::thread{id=hub-threads}
And this block has a **thread** — the 💬 in its corner is the same one a story pane carries. Leave a
reply and it saves beside the connected project, so it's here when you come back.

::chart{report=throughput range=1h height=70}
:::

Full vocabulary, all of it runnable: :help[markdown]
:::

:::tab{label="Tests"}
A test is an **ordered list of named sections** — Before / Main / Events / After, plus any shared
**actions** you drop in.

- Build them in the Scratch Pad; **Run** any step, section, or the whole thing; **Save** writes
  \`specs/tests/<Module>.<method>.json\` next to your code.
- **Shared actions** (Actions tab) insert as sections and store as \`{use}\` references — edit the
  action once and every test that uses it follows.
- **Reference earlier output** anywhere in an argument or an expected value:
  \`tv(test.before[0].results.sum)\`. \`random(6)\` makes a value unique per run.
- Run everything from the terminal too: \`systemview test <project>\`.

:help[scratchpad] · :help[actions] · :help[events]
:::

:::tab{label="Stage"}
The **Stage** tab holds **reports** — full markdown documents in \`.systemview/\`, scoped to a
namespace: write-ups, plans, reviews, findings. Every interactive block works in them (embedded
files, diffs, runnable tests), so a report answers "what changed, and how do I know it works?"
live. :help[markdown]
:::

:::tab{label="Stats"}
Services running the plugin report bounded rollups of every call. The **Stats** page turns them into
reports: state of the system, load & scaling, reliability, surface coverage, change, **topology**
(who calls whom, from real cross-service traces) and **module coupling** (the in-process map).

A time-range control windows the numbers, and charts have a hover crosshair. The same charts embed
into any document with \`::chart\`.
:::

:::tab{label="Codebase"}
The **Codebases** lens opens your files directly — edit-first, with a rendered Preview for markdown,
a git **Diff** toggle for anything that differs from HEAD, and ⌘S to save.

Opening a file is now a real **history entry**, so the browser back button returns you to where you
were, and a file view can be linked to directly.
:::

::::

## Tips

- Click a **selected** nav item again to **deselect** and come back to this page.
- Small **?** icons around the UI open the matching topic right here.
- The checklists above are read-only — this page is a built-in, not a file on disk. In a real
  document, ticking a box **edits the document**.

_Select something on the left to dive in._`;

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

  // RFC-054 — THE OPEN SET. The strip renders from the store; the URL names the ACTIVE tab (his
  // rule: "the URL routing includes what TYPE someone is in the center"). Existing params keep
  // their meaning by becoming open-or-focus operations — his dedupe rule, one entry point.
  const tabsPc = projectCode || "@none";
  const [tabsState, setTabsState] = useState(() => getTabs(tabsPc));
  useEffect(() => {
    setTabsState(getTabs(tabsPc));
    return subscribeTabs(tabsPc, setTabsState);
  }, [tabsPc]);
  const pane = tabsState.panes[0];
  // URL → store. A file in the URL opens/focuses its tab; otherwise the tab param names the kind.
  useEffect(() => {
    if (codeFile && codeFile.path) {
      openTab(tabsPc, { key: fileKey(codeFile), kind: "file", file: codeFile });
      return;
    }
    if (urlTab === "logs")
      // LOGS ACCUMULATE PER SCOPE — his correction: "logs here and logs there" are two different
      // things you're watching, and one tab silently switching between them is the old model
      // wearing the new clothes. The key IS the place; the tab remembers it.
      openTab(tabsPc, {
        key: `logs:${sService || ""}.${sModule || ""}.${sMethod || ""}`,
        kind: "logs",
        logs: { serviceId: sService, moduleName: sModule, methodName: sMethod },
      });
    else if (urlTab === "links" || urlTab === "cmds")
      // THE CHAT'S OWN SURFACES AS DOCUMENTS (his ruling, 2026-10-14: nothing pops beside a docked
      // chat). These tabs render a SLOT; the docked AgentChat portals the real panel into it —
      // one component, no second implementation, the same trick the nav dock itself uses.
      openTab(tabsPc, { key: `${urlTab}:${tabsPc}`, kind: urlTab });
    else if (urlTab === "board")
      // THE BOARD IS ONE TAB PER PROJECT, like stats — it is a view OF the project's one board
      // file, so a second tab would be the same board twice. His ruling, 2026-10-14: *"I don't
      // want the board to show up on the side with the chat — I want it to pop up like a
      // document."* The docked chat's 📋 routes here.
      openTab(tabsPc, { key: `board:${tabsPc}`, kind: "board" });
    else if (urlTab === "stats")
      // STATS IS ONE TAB PER PROJECT, unlike logs. Logs key per service/module/method because
      // "logs here and logs there" are two different things you are watching; stats is a view OF a
      // system, and the service filter lives inside it — so a second tab would be the same tab with
      // a different dropdown position.
      openTab(tabsPc, { key: `stats:${tabsPc}`, kind: "stats" });
    else if (urlTab === "reports")
      // STAGE IS JUST REPORTS (his correction, mid-build): a report OPEN gets its OWN tab, keyed by
      // its path — multiple reports showing at once, exactly like files. The bare Stage (no rdoc)
      // is the PICKER, one tab, labeled Stage.
      if (reportPath) {
        // A REPORT TAB IS ALWAYS A DOCUMENT. There is NO picker tab — his ruling, loudly: nothing
        // opens until an actual report is selected, and selection lives in the NAV's reports fold.
        // (closeTab("report") clears any cached picker tab from the hours this shape existed.)
        closeTab(tabsPc, "report");
        openTab(tabsPc, { key: `report:${reportPath}`, kind: "report", report: { path: reportPath } });
      } else {
        // Bare tab=reports (old links, old cache) opens nothing — same rule as docs below.
        closeTab(tabsPc, "report");
        if (sService)
          openTab(tabsPc, {
            key: `doc:${sService}.${sModule || ""}.${sMethod || ""}`,
            kind: "doc",
            doc: { serviceId: sService, moduleName: sModule, methodName: sMethod },
          });
      }
    // DOC TABS ACCUMULATE PER NAMESPACE — his rule from day one ("everything is a document, even a
    // namespace; they all show"), finally honored after two half-versions: reports accumulate,
    // logs accumulate, and now docs do too. A link inside a page OPENS A TAB instead of navigating
    // the page you're reading — the single follow-along doc tab was what made an :ns link feel
    // like theft. Project level or nothing = no tab; the landing is BACKGROUND.
    else if (sService)
      openTab(tabsPc, {
        key: `doc:${sService}.${sModule || ""}.${sMethod || ""}`,
        kind: "doc",
        doc: { serviceId: sService, moduleName: sModule, methodName: sMethod },
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsPc, urlTab, reportPath, sService, sModule, sMethod, codeFile && codeFile.path, codeFile && codeFile.projectCode, codeFile && String(codeFile.lines), codeFile && codeFile.side]);
  // store → URL, on a strip click: the active tab writes the params that MEAN it — which is exactly
  // what keeps every deep link, chip and agent command working unchanged.
  // THE MAP LIVES IN tabRoutes.buildRoute NOW (RFC-069 slice 4) — the Agents page routes the
  // same tabs, and a second copy of this map is exactly the drift the extraction exists to kill.
  const routeTo = useCallback((t) => {
    history.push(buildRoute(t, tabsPc, window.location.search));
  }, [history, tabsPc]);
  const clickTab = useCallback((t) => {
    focusTab(tabsPc, t.key);
    routeTo(t);
  }, [tabsPc, routeTo]);
  // WHAT A TAB BEING ACTIVE MEANS ON THIS PAGE — the URL's answer, never the store's alone, so
  // back/forward keep working. Handed to CenterTabs; the Agents page answers from its own state.
  const isTabActive = useCallback((t) =>
    t.kind === "file"
      ? !!(fileLens && codeFile && fileKey(codeFile) === t.key)
      : !fileLens &&
        ((t.kind === "doc" && (tab === "docs" || (tab === "reports" && !reportPath)) && t.key === `doc:${sService || ""}.${sModule || ""}.${sMethod || ""}`) ||
          (t.kind === "stats" && tab === "stats") ||
          (t.kind === "board" && tab === "board") ||
          ((t.kind === "links" || t.kind === "cmds") && tab === t.kind) ||
          (t.kind === "logs" && tab === "logs" && t.key === `logs:${sService || ""}.${sModule || ""}.${sMethod || ""}`) ||
          (t.kind === "report" && tab === "reports" && (t.report ? t.report.path === reportPath : !reportPath))),
    [fileLens, codeFile, tab, reportPath, sService, sModule, sMethod]);
  // Closing what you're LOOKING AT routes to the neighbor; closing a background tab moves nothing.
  // Bulk closes land the same way — CenterTabs already did the store half.
  const afterClose = useCallback((nextKey) => {
    const next = getTabs(tabsPc).panes[0].tabs.find((x) => x.key === nextKey);
    if (next) return routeTo(next);
    // NOTHING LEFT OPEN lands on the project's own page.
    const q = new URLSearchParams(window.location.search);
    ["file", "fproj", "fsvc", "flang", "flines", "fside", "fnav", "ftab", "fmachine", "help", "rdoc"].forEach((k) => q.delete(k));
    q.set("tab", "docs");
    history.push({ pathname: `/specs/${projectCode}`, search: `?${q.toString()}` });
  }, [tabsPc, routeTo, history, projectCode]);
  // RFC-069 §4.4 — the open-by-path door, shared from CenterTabs (one brain, every host).
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
  const activeFileTab = fileLens && codeFile ? pane.tabs.find((x) => x.key === fileKey(codeFile)) : null;

  const openReport = useCallback((path) => {
    const p = new URLSearchParams(window.location.search);
    if (path) p.set("rdoc", path);
    else p.delete("rdoc");
    history.replace({ search: p.toString() });
  }, [history]);


  // Which service's plugin serves this doc. BUG THIS FIXES: at project level we used to take the
  // FIRST service in the project — but a project can contain services with NO plugin (a codebase
  // entry, or a service that registers without the SystemView module, e.g. SystemViewCore). Picking
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

  return (
    <section className="documentation">
      <div className="documentation-view">
        {/* Tabs ALWAYS show — SystemView mode doesn't switch the page, it just shows a different document.
            The selected namespace rides at the END of this same row (no separate title row → more vertical
            space for the document / stories / logs below). */}
        {/* THE ONE STRIP (RFC-069 slice 4) — extracted whole into CenterTabs after the lookalike
            lesson; the Agents view mounts the same component over the same store. This page hands
            it meaning: the URL answers "active", clicks route, closes move the URL. */}
        <CenterTabs
          tabsPc={tabsPc}
          tabs={pane.tabs}
          isActive={isTabActive}
          onOpen={clickTab}
          afterClose={afterClose}
          extraMenuItems={extraMenuItems}
          plus={plusDoor}
          onCollapse={onCollapse}
        />
        {/* THE NAMESPACE IS THE DOC TAB'S, PER-TAB — his second correction on this line: it was
            still painted at the COMPONENT level, so it sat over logs, over files, over an empty
            view after a delete ("it shows the namespace at the top — that doesn't make any sense").
            A namespace is a fact about the namespace DOCUMENT: it renders only on that tab, and
            only when something is actually selected — an empty state has no address to announce. */}
        {/* An open HELP topic takes the content spot — whatever tab was showing waits behind it. */}
        {helpOpen && (
          <div className="documentation-view__data-table">
            <HelpPane topicKey={helpTopic} />
          </div>
        )}
        {/* RFC-022 — the Code center: edit-first file pane fed by the Codebase nav's selection. */}
        {!helpOpen && fileLens && tab === "docs" && (
          <div className="documentation-view__data-table">
            {/* The pane's × closes the TAB — the strip picks the neighbor you land on. (The old
                ftab-restore dance is the strip's job now.) */}
            <CodePane
              file={(activeFileTab && activeFileTab.file) || codeFile}
              onClose={() => {
                // same act the strip's × performs: store-close, then move the URL if it was active
                const key = fileKey(codeFile);
                const nextKey = closeTab(tabsPc, key);
                afterClose(nextKey, null);
              }}
            />
          </div>
        )}
        {!helpOpen && !fileLens && (tab === "docs" || (tab === "reports" && !reportPath)) && (
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
              // THE BACKGROUND IS SYSTEMVIEW'S OWN DOCUMENTATION — his rule for the empty strip:
              // "stop defaulting to the namespace document." Keyed off the STRIP BEING EMPTY, not
              // off scope — his catch: a lingering scope slipped a namespace body under a
              // "SystemView" label, which is worse than either alone. Strip empty = the manual,
              // whole; anything else = the tab's own document.
              readOnly={pane.tabs.length === 0 || !sService}
              label={pane.tabs.length === 0 || !sService ? "SystemView" : sMethod ? `${sService}.${sModule}.${sMethod}` : sModule ? `${sService}.${sModule}` : sService}
              helpText={pane.tabs.length === 0 || !sService ? SYSTEMVIEW_HELP : null}
            />
          </div>
        )}
        {/* REPORTS — one document with the whole panel. The picker shows only until you choose;
            then the document owns the space and an ✕ brings the list back (RFC-025). */}
        {/* With a file open, Logs and Report run at the PROJECT level — same rule as Stories. */}
        {!helpOpen && tab === "reports" && reportPath && (
          <ReportsTab
            key={fileLens ? codeFile.projectCode : `${sProject}.${sService}.${sModule}.${sMethod}`}
            projectCode={fileLens ? codeFile.projectCode : sProject}
            serviceId={fileLens ? undefined : sService}
            moduleName={fileLens ? undefined : sModule}
            methodName={fileLens ? undefined : sMethod}
            openName={reportPath}
            onOpen={openReport}
          />
        )}
        {!helpOpen && (tab === "links" || tab === "cmds") && (
          <div id={`sv-dock-slot-${tabsPc}-${tab}`} className="doc-dockslot">
            {/* the docked AgentChat portals the live panel in here; an empty slot means the chat
                for this project is not docked in the side panel right now */}
          </div>
        )}
        {!helpOpen && tab === "board" && (
          <div className="doc-board">
            <Board projectCode={tabsPc} chrome="pane" />
          </div>
        )}
        {!helpOpen && tab === "stats" && (
          <Reports
            projectCode={fileLens ? codeFile.projectCode : sProject}
            serviceId={fileLens ? undefined : sService}
            embedded
          />
        )}
        {!helpOpen && tab === "logs" && (
          <InlineLogs
            projectCode={fileLens ? codeFile.projectCode : sProject}
            serviceId={fileLens ? undefined : sService}
            moduleName={fileLens ? undefined : sModule}
            methodName={fileLens ? undefined : sMethod}
          />
        )}
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
const DocDescription = ({ doc, setDocument, Plugin, label, crumb = null, readOnly, helpText, scope = null }) => {
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

  const shown = helpText != null ? helpText : text;
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
          ) : shown ? (
            <Markdown
              dark={editorDark}
              children={shown}
              scope={scope}
              // The hub is a built-in rather than a file, so it has no namespace to key off — but a
              // thread in it should still be a real thread, not a dead demo. Give it a fixed key; the
              // sidecar lands in whichever connected project hosts the plugin, the same fallback the
              // embeds on this page already use.
              commentKey={
                helpText != null
                  ? "app:hub"
                  : `doc-${(scope && scope.projectCode) || ""}-${[doc.namespace && doc.namespace.serviceId, doc.namespace && doc.namespace.moduleName, doc.namespace && doc.namespace.methodName].filter(Boolean).join(".") || "project"}`
              }
              // RFC-025 §4.6 — the document IS the store. A checklist toggle is a narrower edit down
              // the same saveDoc path the editor uses. Help text is a code registry → read-only.
              onSourceChange={
                Plugin && helpText == null && !readOnly
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
