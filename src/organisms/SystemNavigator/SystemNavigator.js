import React, { useEffect, useContext, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import Title from "../../atoms/Title/Title";
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
} from "../../utils/hostProject";
import { listHusks, addHusk, removeHusk, reconcileHusks, huskEntry } from "../../utils/husks";
import CodebaseNav from "../CodebaseNav/CodebaseNav";
import { useAppDark } from "../../atoms/appTheme";
import Help from "../../atoms/Help/Help";

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
      const both = [...all, ...folders];
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
  return (
    <section className="system-nav">
        {/* Title + tabs are a FIXED header region — they don't scroll. The service tree below is the ONLY
            scroll area (the .container is the scroll body, so bootstrap row gutters are absorbed and there
            is no horizontal scroll / edge clipping). */}
        <div className="system-nav__header">
          {onCollapse && (
            <div className="row system-nav__section">
              <div className="col-12">
                <span
                  className="panel-title panel-title--nav"
                  title="Collapse the navigator"
                  onClick={onCollapse}
                >
                  <span className="panel-title__arrow">‹</span>
                  <Title text="Navigator" />
                  <Help topic="navigator" />
                </span>
              </div>
            </div>
          )}
          {/* RFC-026 — ONE nav. The unified card (services + files + help) took over everything the
              old SystemLynx tree did, so the tab strip is just the name and the connect button.
              "Projects" — that's what the cards are; SystemLynx stays as the tag on the services
              section inside each card. */}
          <div className="row system-nav__section">
            <div className="col-12">
              <div className="system-nav__tabs">
                <button type="button" className="system-nav__tab system-nav__tab--active">
                  Projects
                </button>
                <button
                  type="button"
                  className={`system-nav__tab-add ${naming ? "system-nav__tab-add--open" : ""}`}
                  title={naming ? "Cancel" : "New project — name it"}
                  onClick={() => {
                    // ＋ NAMES A PROJECT — that is all it does. His model, verbatim: *"that plus
                    // button, it just lets you name a project… name the project right there at the
                    // top, input pops up, boom, project pops up right under."* The folder, the
                    // services, the agent — all attachments, added later from the husk itself.
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
              </div>
            </div>
          </div>
        </div>
        <div className="container system-nav__body">
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
        </div>
    </section>
  );
};

export default SystemNav;
