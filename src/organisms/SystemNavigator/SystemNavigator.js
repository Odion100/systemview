import React, { useEffect, useContext, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import "./styles.scss";
import { Client, markCredentialed } from "../../systemClient";
import {
  hostProjects,
  HOST_MARK,
  removeHostProject,
  isHostProject,
  canPickThenName,
  pickFolderOnly,
  putHostProject,
  renameHostProject,
  migrateConnectedProjects,
  hostFileProviders,
  hostProjectEntry,
} from "../../utils/hostProject";
import { listHusks, addHusk, removeHusk, reconcileHusks, huskEntry } from "../../utils/husks";
import CodebaseNav from "../CodebaseNav/CodebaseNav";
import { useDockOrder, orderProjects, isNavDocked } from "../AgentChat/navDock";
import { liveSessions } from "../../utils/hostAgents";
import { useAppDark } from "../../atoms/appTheme";

const ArrowIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const SystemNav = ({
  projectCode,
  serviceId,
  moduleName,
  methodName,
  onCollapse,
  openFile,
  onOpenFile = () => {},
  // RFC-025 — a pointer from a document: expand to it and highlight it, but never select it.
  reveal = null,
}) => {
  const [serviceStatus, setServiceStatus] = useState({});
  const [pickErr, setPickErr] = useState("");
  // ＋ NAMES A PROJECT. That is all it does.
  //
  // Three flows died here before this one — a text box before the picker, a text box after it, and
  // an in-place rename on a card that had already been registered. All three were the same mistake:
  // treating "add a project" as "add a folder". His model is the one that works, because a project
  // is a NAME and everything else attaches to it:
  //
  //   > *"that plus button, it just lets you name a project, right? … name the project right there
  //   > at the top, input pops up, boom, project pops up right under."*
  //
  // Nothing is registered anywhere when you name one — it is a husk until a folder or a service
  // attaches. Abandon the input and it never existed.
  // Double-clicking a project's name edits it in place (see CodebaseNav) — this holds which one.
  const [renaming, setRenaming] = useState(null);
  // RFC-055 — AGENTS IS A TAB IN THIS STRIP, beside Projects (his call: "we already have a
  // navigation tab" — not a second nav, not a second pill row over this one). One navigator,
  // two tabs; the whole thing travels to every page.
  // RFC-062 — TWO VIEWS, one panel. "list" is every project stacked (what always existed);
  // "tabs" is one tab per agent — icon + name — and the whole panel becomes that agent's world.
  // The Projects/Agents pills are gone: the tab strip IS the agents, and the agent's chat lives
  // as a section inside its tab, so a second place to look at agents was a second nav.
  const [view, setView] = useState(() => localStorage.getItem("sv.navView") || "tabs");
  const pickView = (v) => {
    setView(v);
    localStorage.setItem("sv.navView", v);
    window.dispatchEvent(new CustomEvent("sv:navView"));
  };
  const [tabPc, setTabPc] = useState(() => localStorage.getItem("sv.navTabPc") || "");
  const pickTab = (pc) => {
    setTabPc(pc);
    localStorage.setItem("sv.navTabPc", pc);
    window.dispatchEvent(new CustomEvent("sv:navView"));
  };
  // Live dots on the tabs — polled at the same cadence the agent cards used, only while the
  // strip is actually showing.
  const [livePcs, setLivePcs] = useState(() => new Set());
  useEffect(() => {
    if (view !== "tabs") return undefined;
    let dead = false;
    const poll = async () => {
      const l = await liveSessions();
      if (!dead) setLivePcs(new Set((l || []).map((x) => x.projectCode || x.project).filter(Boolean)));
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => { dead = true; clearInterval(t); };
  }, [view]);
  const dockOrderList = useDockOrder();
  // THE TAB WEARS THE AGENT ONLY WHILE IT'S HOME (his indicator): pulled out, the face leaves the
  // tab and only the project name remains — you can see at a glance which agents are out floating.
  const [, forceDock] = useState(0);
  useEffect(() => {
    const on = () => forceDock((n) => n + 1);
    window.addEventListener("sv:navDock", on);
    return () => window.removeEventListener("sv:navDock", on);
  }, []);
  // THE SELECTED TAB IS VISIBLE, ALWAYS. The strip scrolls sideways, so a switch (a click, a
  // bot's </>, a commit hand-off) can land on a tab that's off the edge — selected but invisible
  // reads as "nothing happened". The active tab pulls itself into view on every change.
  const activeTabRef = useRef(null);
  useEffect(() => {
    if (activeTabRef.current) {
      try { activeTabRef.current.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" }); } catch {}
    }
  });
  useEffect(() => {
    // ONE DOOR for every "show project X in the nav" event — the bot's </>, a ::commit block's
    // hand-off, a :file/:ns chip's reveal. In tabs view the card only exists on its tab, so the
    // switch IS the first step of all of them; the card's own listeners take it from there.
    // A new event of this family only has to carry detail.projectCode to get this for free.
    const toTab = (e) => {
      const pc = ((e && e.detail) || {}).projectCode;
      if (!pc) return;
      if ((localStorage.getItem("sv.navView") || "tabs") === "tabs") pickTab(pc);
    };
    const EVENTS = ["sv:codebase", "sv:commitInNav", "sv:revealInNav"];
    EVENTS.forEach((n) => window.addEventListener(n, toTab));
    return () => EVENTS.forEach((n) => window.removeEventListener(n, toTab));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const nameRef = useRef(null);
  const [husks, setHusks] = useState(() => listHusks());
  useEffect(() => {
    if (!naming || !nameRef.current) return;
    nameRef.current.focus();
  }, [naming]);

  const createProject = () => {
    const code = String(newName || "").trim();
    if (!code) return;
    if (connectedServices.some((s) => s.projectCode === code) || husks.some((h) => h.projectCode === code)) {
      setPickErr(`"${code}" is already a project`);
      return;
    }
    setPickErr("");
    addHusk(code);
    setHusks(listHusks());
    setNewName("");
    setNaming(false);
  };

  // ATTACHING A FOLDER to a project that already has a name. This is the "pick a folder" button in
  // an empty `code` slot — the folder is the attachment, the project already exists.
  const attachFolder = async (pc) => {
    if (!canPickThenName()) return;
    setPickErr("");
    try {
      const picked = await pickFolderOnly();
      if (!picked) return; // cancelled — not an error
      const res = await putHostProject(pc, picked.dir);
      if (res && res.error) {
        setPickErr(res.error);
        return;
      }
      removeHusk(pc);
      setHusks(listHusks());
      await fetchAllProjects();
    } catch (e) {
      setPickErr((e && e.message) || "could not attach that folder");
    }
  };

  // Codebase nav dark ⇄ light — follows the ONE app toggle in the page header (its own pill retired).
  const [appDark] = useAppDark();
  const cbTheme = appDark ? "dark" : "light";
  const { SystemViewService, setConnectedServices, connectedServices } =
    useContext(ServiceContext);
  const serviceData = connectedServices.find(
    (serviceData) =>
      serviceData.serviceId === serviceId && serviceData.projectCode === projectCode,
  );
  const { Plugin } = serviceData
    ? Client.createService(serviceData.system.connectionData)
    : {};
  const { SystemView } = SystemViewService;

  const mergeServices = (existing, incoming, pc) => {
    const others = existing.filter((s) => s.projectCode !== pc);
    // A FOLDER IS NOT SOMETHING THE HUB CAN RE-FETCH. `getServices(pc)` asks the hub what SystemLynx
    // services a project has; for a folder the honest answer is none — and merging that answer in
    // dropped the folder itself out of the list. Clicking into a folder made the whole project
    // vanish from the navigator. Its stand-in entry is held by the browser, not the hub, so it is
    // kept across a refetch rather than replaced by an answer to a different question.
    const keptFolders = existing.filter(
      (s) =>
        s.projectCode === pc &&
        s.system &&
        s.system.connectionData &&
        s.system.connectionData[HOST_MARK],
    );
    return [...incoming, ...keptFolders, ...others]; // newly connected/updated project floats to the top
  };

  const fetchProject = async (pc = projectCode) => {
    try {
      const results = await SystemView.getServices(pc);
      setConnectedServices((prev) => mergeServices(prev, results, pc));
      return results;
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  const probeServices = async (services) => {
    const results = await Promise.all(
      services.map(async ({ system }) => {
        const url = system.connectionData.serviceUrl;
        try {
          const res = await Promise.race([
            fetch(url),
            new Promise((_, rej) => setTimeout(() => rej(), 3000)),
          ]);
          return [url, res.ok ? "live" : "down"];
        } catch {
          return [url, "down"];
        }
      }),
    );
    setServiceStatus((prev) => ({ ...prev, ...Object.fromEntries(results) }));
  };

  const fetchAllProjects = async () => {
    try {
      const projects = await SystemView.getProjects();
      const all = Object.entries(projects).flatMap(([pc, svcs]) =>
        svcs.map((svc) => ({ projectCode: pc, ...svc })),
      );
      // Mark credentialed origins UP FRONT (not lazily on first setHeaders) so the very first request
      // to a gated service — including a signIn whose Set-Cookie must be STORED — already carries
      // withCredentials. Otherwise an early non-credentialed request drops the Set-Cookie and the
      // session never persists. A service is credentialed when it declares a header profile OR
      // registered the cookie-only `credentials: true` flag (RFC-013).
      all.forEach((s) => {
        const url =
          (s.system && s.system.connectionData && s.system.connectionData.serviceUrl) ||
          s.serviceUrl;
        if (url && ((s.headers && Object.keys(s.headers).length) || s.credentials))
          markCredentialed(url);
      });
      // THE FOLDERS TOO. A project added with + has no service and never will unless he starts one,
      // but it is still a project and belongs in this list — that is the whole point of adding it.
      // `hostProjects` skips anything already connected, because a code means one folder.
      // THE TRANSITION ITSELF, and it runs before the folders are merged in. Every project that
      // arrived the old way — a SystemLynx connection the shell had never heard of — is registered
      // with the host under the code it already has, using the `root` its own connection record has
      // always carried. Same code, same card, same services; the difference is that the project now
      // EXISTS as a directory the shell knows, so files, the terminal and agent sessions resolve
      // from the project rather than from whichever plugin answered first.
      //
      // Silent and idempotent on purpose: `put` is a no-op for a folder already registered under
      // that code, so this reconciles on every load instead of being a one-time script he has to
      // remember to run. Failures are collected rather than thrown — one project refusing to
      // register must not take the navigator down with it.
      const moved = await migrateConnectedProjects(all);
      if (moved.failed.length) {
        setPickErr(
          `${moved.failed.length} project${moved.failed.length === 1 ? "" : "s"} could not be registered with the shell: ` +
            moved.failed.map((f) => `${f.code} (${f.error})`).join(", "),
        );
      }
      const folders = await hostProjects(all);
      // AND THE FOLDER BEHIND A CONNECTED PROJECT. `hostProjects` hides it so one directory draws
      // one card — right for cards, wrong for files: a project with services was reading its own
      // source back over HTTP through the plugin. These entries are file providers, not cards
      // (`pickHost` takes them first, the services grouping ignores them), so the codebase reads
      // from disk while the plugin keeps doing documentation and tests.
      const providers = await hostFileProviders(all);
      // …and the folders the HUB knows, which is all of them. A card takes its root from whichever
      // entry carries one, so a project whose services are down — or that never had services — was
      // drawn without a folder and therefore without a file tree, git bar or commit box. The
      // registry knew where it lived the whole time; nothing was asking.
      let hubRoots = {};
      try {
        hubRoots = (await SystemViewService.SystemView.projectRoots()) || {};
      } catch {
        hubRoots = {};
      }
      // SHAPED LIKE EVERY OTHER ENTRY, not a bare pair. The card grouping reads `system.connectionData`
      // off each row; handing it `{ projectCode, root }` threw during render and took the panel to a
      // blank white page — the same lesson as the tvEdit crash: one malformed row is not one missing
      // card, it is the whole surface gone.
      // NO CONDITION ON THIS. It skipped any project that already had a root SOMEWHERE in the list —
      // and "somewhere" included dead service entries the card grouping never reads, so the projects
      // whose services are down (exactly the ones that need this) were the ones it skipped. The card
      // merges by project code, so an extra folder row is not an extra card; it is just the folder
      // finally being on the card. Cheap, unconditional, and it cannot single anyone out.
      const fromHub = Object.entries(hubRoots)
        .filter(([code, root]) => code && root)
        .map(([projectCode, root]) => ({ ...hostProjectEntry(projectCode, root), fileProvider: true }));
      const both = [...all, ...folders, ...providers, ...fromHub];
      // A husk that has grown a folder or a service is a real project now — drop it rather than
      // drawing a second, empty card beside the thing it became.
      setHusks(reconcileHusks(both.map((s) => s.projectCode)));
      if (both.length) {
        setConnectedServices(both);
        // Only real services get probed — a folder has no URL to be up or down.
        if (all.length) probeServices(all);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // RENAME. The identity every other surface uses is the project code, so this is not cosmetic —
  // the shell migrates its saved conversations with it so his chats follow the project rather than
  // orphaning under a name that no longer exists. It reports one honest caveat of its own: a
  // session live in memory at rename time keeps the old code until it is reopened.
  const handleRenameProject = async (pc, next) => {
    setPickErr("");
    const res = await renameHostProject(pc, next);
    if (res && res.error) {
      setPickErr(res.error);
      return;
    }
    // The nav is keyed by project code, so everything holding the old one has to re-read.
    await fetchAllProjects();
    if (projectCode === pc) history.push(`/specs/${next}`);
    setRenaming(null);
  };

  const handleDeleteService = async (pc, svcId) => {
    try {
      await SystemView.deleteService(pc, svcId);
      setConnectedServices((prev) =>
        prev.filter((s) => !(s.projectCode === pc && s.serviceId === svcId)),
      );
    } catch (error) {
      console.error(error);
    }
  };

  // RFC-027 — a hosted service's configuration hand: rename the service, add/delete/rename modules.
  // The hub does the file op on the committed folder, re-hosts, and answers with the updated
  // registration; a full refetch keeps every row honest (a rename changes the serviceId itself).
  const handleHostedOp = async (pc, op, payload = {}) => {
    try {
      await SystemView.hostedOp({ projectCode: pc, op, ...payload });
      await fetchAllProjects();
      return null;
    } catch (error) {
      console.error(error);
      return (error && error.message) || String(error);
    }
  };

  const handleDeleteProject = async (pc, hostBacked = false) => {
    // A HUSK IS ONLY A NAME. It is registered nowhere — not with the hub, not with the host — so
    // both removal paths below report success at a thing that was never there and the row stays
    // (his catch: *"the test project that I brought in that I never chose the folder for — I can't
    // remove it"*). Removing a name means forgetting the name.
    if (husks.some((h) => h.projectCode === pc)) {
      removeHusk(pc);
      setHusks(listHusks());
      return;
    }
    try {
      // A FOLDER IS FORGOTTEN, NOT DELETED. Two different removals wearing one trash icon: a
      // SystemLynx project is deregistered from the hub, a folder is dropped from the host's own
      // list. Sending a folder to `deleteProject` did nothing at all, which is exactly what he saw.
      // Nothing on disk is touched either way — this forgets a folder, it does not delete it.
      if (hostBacked) {
        const ok = await removeHostProject(pc);
        if (!ok) return;
      } else await SystemView.deleteProject(pc);
      setConnectedServices((prev) => prev.filter((s) => s.projectCode !== pc));
    } catch (error) {
      console.error(error);
    }
  };

  const history = useHistory();
  // ONE live listener, cleaned up on re-register. The old version had no cleanup and depended on the
  // connectedServices ARRAY IDENTITY — and its handler setConnectedServices'd a new array, so every event
  // re-ran the effect and stacked ANOTHER listener. Each socket event then fired N handlers, each forcing
  // a full synchronous re-render (React 17 doesn't batch outside its own events) and adding a listener —
  // compounding until any spec save (saveTest/saveDoc/saveAction all push a spec-list update) froze the
  // page. Functional setState reads current state, so the effect only re-keys on the project.
  useEffect(() => {
    if (!connectedServices.length) return;
    const updateSpecList = ({ specList, serviceId }) => {
      setConnectedServices((prev) => {
        const serviceData = prev.find(
          (s) => s.serviceId === serviceId && s.projectCode === projectCode,
        );
        if (!serviceData) return prev;
        // NO-OP GUARD. Every saveDoc/saveTest/saveAction pushes a spec-list update, but most saves
        // don't change the FILE LIST at all — re-saving an existing doc (or ticking a checkbox in
        // one) sends the identical list. Replacing the array anyway hands every ServiceContext
        // consumer a new identity, so the whole app re-renders and the Saved-tests panel visibly
        // reloads just because a checkbox moved. Only publish when the list actually changed.
        const same = JSON.stringify(serviceData.specList) === JSON.stringify(specList);
        if (same) return prev;
        serviceData.specList = specList;
        return [...prev];
      });
    };
    const unsub = SystemView.on(`spec-list-updated:${projectCode}`, updateSpecList);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, connectedServices.length]);
  useEffect(() => {
    fetchAllProjects();
  }, []);
  useEffect(() => {
    if (projectCode) fetchProject(projectCode);
  }, []);
  // Same listener-stacking hazard as the spec-list effect above: Plugin is CACHED per serviceUrl, so
  // re-running this without cleanup piled listeners onto the same dispatcher (one more per
  // connectedServices change), and every service restart fired them all. One listener, cleaned up.
  useEffect(() => {
    if (!Plugin) return;
    const onReconnect = () => fetchProject();
    const unsub = Plugin.on(`reconnect`, onReconnect);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Plugin, projectCode]);
  // The tabs are the projects in the dock's order — same order the cards and the rail keep.
  const tabPcs = orderProjects(
    dockOrderList,
    [...new Set([...husks.map((h) => h.projectCode), ...connectedServices.map((c) => c.projectCode)])],
  );
  const activeTabPc = tabPcs.includes(tabPc) ? tabPc : tabPcs[0] || "";
  // DOCKED STAYS DOCKED ACROSS THE VIEW SWITCH (his correction — the bug was eviction, not
  // docking: tabs view unmounted every card slot, "slot gone" means float, so flipping the view
  // spilled every docked agent onto the screen at once). In tabs view a docked agent's home IS
  // its tab: the active one lands in the chat pane, the rest render nowhere until their tab is
  // picked. Floating agents are untouched — nobody is forced home. The resolved tab is written
  // back so a bot never compares against a tab that isn't on screen.
  useEffect(() => {
    if (view !== "tabs") return;
    try { localStorage.setItem("sv.navTabPc", activeTabPc); } catch {}
    window.dispatchEvent(new CustomEvent("sv:navView"));
  }, [view, activeTabPc]);
  return (
    <section className={`system-nav${view === "tabs" ? " system-nav--tabs" : ""}`}>
        {/* Title + tabs are a FIXED header region — they don't scroll. The service tree below is the ONLY
            scroll area (the .container is the scroll body, so bootstrap row gutters are absorbed and there
            is no horizontal scroll / edge clipping). */}
        <div className="system-nav__header">
          {/* RFC-062 — ONE BAR. The full-width "‹ Navigator" title row and the Projects/Agents
              pills were mostly chrome — his call: "we have a lot of area at the top that we're not
              using." Everything the header still owes fits in one row: the view toggle, the strip
              (or the + in list view), and a small collapse chevron where the title row used to be. */}
          <div className="system-nav__bar">
                <div className="system-nav__views" role="tablist">
                  <button
                    type="button"
                    className={`system-nav__viewbtn${view === "list" ? " system-nav__viewbtn--active" : ""}`}
                    title="List view — every project"
                    onClick={() => pickView("list")}
                  >
                    ☰
                  </button>
                  <button
                    type="button"
                    className={`system-nav__viewbtn${view === "tabs" ? " system-nav__viewbtn--active" : ""}`}
                    title="Tabs view — one agent per tab"
                    onClick={() => pickView("tabs")}
                  >
                    ▥
                  </button>
                </div>
                {view === "tabs" ? (
                  <div className="system-nav__agenttabs">
                    {tabPcs.map((pc) => (
                      <button
                        key={pc}
                        type="button"
                        ref={pc === activeTabPc ? activeTabRef : undefined}
                        className={`system-nav__agenttab${pc === activeTabPc ? " system-nav__agenttab--active" : ""}`}
                        title={`${pc} — click to open, drag to pull the agent out`}
                        onClick={(e) => {
                          if (e.currentTarget.dataset.pulled === "1") return;
                          pickTab(pc);
                        }}
                        onPointerDown={(e) => {
                          // DRAG THE TAB = PULL THE AGENT OUT (his ask: no need to enter the tab
                          // first). Past a small threshold the bot undocks and lands under the
                          // pointer; the click that would have switched tabs is swallowed.
                          const btn = e.currentTarget;
                          btn.dataset.pulled = "";
                          const sx = e.clientX, sy = e.clientY;
                          const move = (ev) => {
                            if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 10) return;
                            btn.dataset.pulled = "1";
                            window.dispatchEvent(new CustomEvent("sv:pullOut", {
                              detail: { projectCode: pc, x: ev.clientX - 23, y: ev.clientY - 23, grab: true },
                            }));
                            up();
                          };
                          const up = () => {
                            window.removeEventListener("pointermove", move);
                            window.removeEventListener("pointerup", up);
                            setTimeout(() => { btn.dataset.pulled = ""; }, 100);
                          };
                          window.addEventListener("pointermove", move);
                          window.addEventListener("pointerup", up);
                        }}
                      >
                        {isNavDocked(pc) && <span className="system-nav__agenttab-face">🤖</span>}
                        <span className="system-nav__agenttab-name">{pc}</span>
                        {livePcs.has(pc) && <span className="system-nav__agenttab-dot" title="a session is live" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`system-nav__tab-add ${naming ? "system-nav__tab-add--open" : ""}`}
                      title={naming ? "Cancel" : "New project — name it"}
                      onClick={() => {
                        setPickErr("");
                        if (naming) {
                          setNaming(false);
                          setNewName("");
                          return;
                        }
                        setNaming(true);
                      }}
                    >
                      {naming ? "✕" : "+"}
                    </button>
                    <span className="system-nav__bar-space" />
                  </>
                )}
                {onCollapse && (
                  <button
                    type="button"
                    className="system-nav__collapse"
                    title="Collapse the navigator"
                    onClick={onCollapse}
                  >
                    ‹
                  </button>
                )}
          </div>
          {/* RFC-062 — the + doesn't fit the strip (tabs view), but naming a project must not
              require leaving it. One skinny row, sticky with the header, that is only the +
              — and the input when pressed. */}
          {view === "tabs" && (
            <div className="system-nav__addrow">
              <button
                type="button"
                className={`system-nav__tab-add ${naming ? "system-nav__tab-add--open" : ""}`}
                title={naming ? "Cancel" : "New project — name it"}
                onClick={() => {
                  setPickErr("");
                  if (naming) {
                    setNaming(false);
                    setNewName("");
                    return;
                  }
                  setNaming(true);
                }}
              >
                {naming ? "✕" : "+"}
              </button>
              {naming && (
                <div className="system-nav__newproject">
                  <input
                    ref={nameRef}
                    className="system-nav__newproject-input"
                    type="text"
                    placeholder="name the project"
                    spellCheck={false}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createProject();
                      if (e.key === "Escape") {
                        setNaming(false);
                        setNewName("");
                        setPickErr("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="system-nav__newproject-go"
                    title={newName.trim() ? `Create ${newName.trim()}` : "Give it a name"}
                    onClick={createProject}
                    disabled={!newName.trim()}
                  >
                    <ArrowIcon />
                  </button>
                </div>
              )}
              {pickErr && <span className="system-nav__connect-error">{pickErr}</span>}
            </div>
          )}
        </div>
        {view === "tabs" && activeTabPc && (
          <AgentTabBody
            key={activeTabPc}
            pc={activeTabPc}
            services={[...husks.map((h) => huskEntry(h.projectCode)), ...connectedServices].filter(
              (s) => s.projectCode === activeTabPc,
            )}
            navProps={{
              serviceId,
              moduleName,
              methodName,
              openFile,
              onOpenFile,
              reveal,
              serviceStatus,
              theme: cbTheme,
              onHostedOp: handleHostedOp,
              onDeleteService: handleDeleteService,
              onDeleteProject: handleDeleteProject,
              onRenameProject: handleRenameProject,
              renaming,
              onRenamingChange: setRenaming,
              onAttachFolder: attachFolder,
            }}
          />
        )}
        {view === "tabs" && !activeTabPc && (
          <div className="container system-nav__body">
            <div className="system-nav__connect-error">No projects yet — name one in list view.</div>
          </div>
        )}
        {view === "list" && <div className="container system-nav__body">
          <div className="row system-nav__section">
            <div className="col-12 ">
              {pickErr && <div className="system-nav__connect-error">{pickErr}</div>}
              {/* NAMING A PROJECT, AT THE TOP, IN ITS OWN FIELD. Deliberately NOT the loadService
                  input below — his correction: *"not that same input that was doing services, not
                  the same button that was attached to it."* Those are different acts and reusing
                  one control for both is what made adding a project feel like connecting a service.
                  Escape abandons it and nothing was ever created. */}
              {naming && (
                <div className={`system-nav__newproject`}>
                  <input
                    ref={nameRef}
                    className="system-nav__newproject-input"
                    type="text"
                    placeholder="name the project"
                    spellCheck={false}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createProject();
                      if (e.key === "Escape") {
                        setNaming(false);
                        setNewName("");
                        setPickErr("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="system-nav__newproject-go"
                    title={newName.trim() ? `Create ${newName.trim()}` : "Give it a name"}
                    onClick={createProject}
                    disabled={!newName.trim()}
                  >
                    <ArrowIcon />
                  </button>
                </div>
              )}
              <CodebaseNav
                connectedServices={[...husks.map((h) => huskEntry(h.projectCode)), ...connectedServices]}
                projectCode={projectCode}
                serviceId={serviceId}
                moduleName={moduleName}
                methodName={methodName}
                openFile={openFile}
                onOpenFile={onOpenFile}
                reveal={reveal}
                serviceStatus={serviceStatus}
                theme={cbTheme}
                onHostedOp={handleHostedOp}
                onDeleteService={handleDeleteService}
                onDeleteProject={handleDeleteProject}
                onRenameProject={handleRenameProject}
                renaming={renaming}
                onRenamingChange={setRenaming}
                onAttachFolder={attachFolder}
              />
            </div>
          </div>
          <div className="scroll-buffer"></div>
        </div>}
    </section>
  );
};

// RFC-062 — ONE AGENT'S WORLD: the same codebase card list view renders, one project, spanning
// the panel. The agent docks into the card's own slot exactly as it does everywhere else — the
// first cut built the chat a second home in a separate pane, which is why docking broke and the
// chat vanished: the card was already the home. The only thing tabs view changes is ROOM — the
// docked chat's height cap is lifted here (see AgentChat), so the conversation can take the panel.
function AgentTabBody({ pc, services, navProps }) {
  return (
    <div className="system-nav__tabbody">
      <div className="container system-nav__body">
        <div className="row system-nav__section">
          <div className="col-12">
            <CodebaseNav
              connectedServices={services}
              projectCode={pc}
              allowDock={true}
              showHelp={false}
              {...navProps}
            />
          </div>
        </div>
        <div className="scroll-buffer"></div>
      </div>
    </div>
  );
}

export default SystemNav;
