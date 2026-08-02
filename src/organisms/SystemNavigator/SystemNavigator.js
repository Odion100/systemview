import React, { useEffect, useContext, useState } from "react";
import { useHistory } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import Link from "../../atoms/Link/Link";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import ServerModulesList from "../../molecules/ServerModulesList/ServerModulesList";
import DocIcon from "../../atoms/DocsIcon/DocsIcon";
import Title from "../../atoms/Title/Title";
import "./styles.scss";
import { Client, markCredentialed } from "../../systemClient";

const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
    <path d="M9 6V4h6v2" />
  </svg>
);

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

const SystemNav = ({ projectCode, serviceId, moduleName, methodName, onCollapse }) => {
  const [serviceStatus, setServiceStatus] = useState({});
  const [adding, setAdding] = useState(false);
  const [connectUrl, setConnectUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  // The nav is tabbed like the scratchpad: your connected SERVICES, a SYSTEMLYNX view, and the FILE-SYSTEM
  // (RFC-022 codebase surface). Persisted so it sticks across refresh.
  const [navTab, setNavTab] = useState(
    () => localStorage.getItem("sv.navTab") || "systemlynx",
  );
  useEffect(() => {
    localStorage.setItem("sv.navTab", navTab);
  }, [navTab]);
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
    return [...incoming, ...others]; // newly connected/updated project floats to the top
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
      if (all.length) {
        setConnectedServices(all);
        probeServices(all);
      }
    } catch (error) {
      console.error(error);
    }
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

  const handleDeleteProject = async (pc) => {
    try {
      await SystemView.deleteProject(pc);
      setConnectedServices((prev) => prev.filter((s) => s.projectCode !== pc));
    } catch (error) {
      console.error(error);
    }
  };

  const history = useHistory();
  // Everything typed here is treated as a URL. Add a scheme if the user didn't, so we don't reject
  // otherwise-valid hosts. connect → getServices(url) pulls the whole project manifest (api/).
  const normalizeUrl = (v) => {
    const t = (v || "").trim();
    if (!t) return "";
    return /^https?:\/\//i.test(t) ? t : `http://${t}`;
  };
  const handleConnect = async () => {
    const target = normalizeUrl(connectUrl);
    if (!target || connecting) return;
    setConnecting(true);
    try {
      const results = await SystemView.connectUrl(target);
      if (results && results.length) {
        const pc = results[0].projectCode;
        setConnectedServices((prev) => mergeServices(prev, results, pc));
        probeServices(results);
        history.push(`/specs/${pc}`);
        setConnectUrl("");
        setAdding(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setConnecting(false);
    }
  };
  const cancelConnect = () => {
    setConnectUrl("");
    setAdding(false);
  };
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
                </span>
              </div>
            </div>
          )}
          {/* Tabs sit right under the header — parallel to the scratchpad's Test/Actions tabs. */}
          <div className="row system-nav__section">
            <div className="col-12">
              <div className="system-nav__tabs">
                <button
                  type="button"
                  className={`system-nav__tab ${navTab === "systemlynx" ? "system-nav__tab--active" : ""}`}
                  onClick={() => setNavTab("systemlynx")}
                >
                  SystemLynx
                </button>
                <button
                  type="button"
                  className={`system-nav__tab ${navTab === "files" ? "system-nav__tab--active" : ""}`}
                  onClick={() => setNavTab("files")}
                >
                  Codebase
                </button>
                {navTab === "systemlynx" && (
                  <button
                    type="button"
                    className={`system-nav__tab-add ${adding ? "system-nav__tab-add--open" : ""}`}
                    title={adding ? "Cancel" : "loadService — connect a service"}
                    onClick={() => (adding ? cancelConnect() : setAdding(true))}
                  >
                    {adding ? "✕" : "+"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="container system-nav__body">
          <div className="row system-nav__section">
            <div className="col-12 ">
              {navTab === "systemlynx" && (
                <>
                  {/* loadService input only appears when you click ＋ — otherwise the projects sit right
                    under the tabs. Cancel is the ＋ toggle (now ✕), so there's no ugly extra button. */}
                  {adding && (
                    <div className="system-nav__connect">
                      <div className="system-nav__connect-form">
                        <input
                          className="system-nav__connect-input"
                          type="text"
                          autoFocus
                          placeholder="loadService — https://host/route"
                          value={connectUrl}
                          onChange={(e) => setConnectUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleConnect();
                            if (e.key === "Escape") cancelConnect();
                          }}
                          disabled={connecting}
                        />
                        <button
                          className="system-nav__connect-arrow system-nav__connect-submit"
                          title="Connect"
                          onClick={handleConnect}
                          disabled={connecting || !connectUrl.trim()}
                        >
                          {connecting ? "…" : <ArrowIcon />}
                        </button>
                      </div>
                    </div>
                  )}
                  <NavigationLinks
                    connectedServices={connectedServices}
                    selectedProjectCode={projectCode}
                    selectedServiceId={serviceId}
                    selectedModuleName={moduleName}
                    selectedMethodName={methodName}
                    onDeleteService={handleDeleteService}
                    onDeleteProject={handleDeleteProject}
                    serviceStatus={serviceStatus}
                  />
                </>
              )}
              {navTab === "files" && (
                <div className="system-nav__placeholder">
                  File system — coming soon (RFC-022 codebase surface).
                </div>
              )}
            </div>
          </div>
          <div className="scroll-buffer"></div>
        </div>
    </section>
  );
};

const NavigationLinks = ({
  connectedServices,
  selectedProjectCode,
  selectedServiceId,
  selectedModuleName,
  selectedMethodName,
  onDeleteService,
  onDeleteProject,
  serviceStatus,
}) => {
  const projects = connectedServices.reduce((acc, service) => {
    const pc = service.projectCode;
    if (!acc[pc]) acc[pc] = [];
    acc[pc].push(service);
    return acc;
  }, {});

  return Object.entries(projects).map(([pc, services], pi) => {
    const isSelectedProject = pc === selectedProjectCode;
    return (
      <ExpandableList
        open={isSelectedProject}
        key={pc}
        title={
          <span
            className={`system-nav__link system-nav__link--project system-nav__link--active-${
              isSelectedProject
            } system-nav__link--selected-${isSelectedProject && !selectedServiceId}`}
          >
            <Link link={`/specs/${pc}`} text={pc} />
            <button
              className="system-nav__delete-btn"
              title="Remove project"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteProject(pc);
              }}
            >
              <TrashIcon />
            </button>
          </span>
        }
      >
        {services.map(({ system, serviceId, specList }, i) => {
          const { serviceUrl } = system.connectionData;
          const isSaved =
            specList && specList.docs && specList.docs.includes(`${serviceId}.md`);
          const isSelected = isSelectedProject && selectedServiceId === serviceId;
          return (
            <ExpandableList
              open={isSelected}
              key={i}
              title={
                <span
                  className={`system-nav__link system-nav__link--active-${
                    isSelected
                  } system-nav__link--selected-${!selectedModuleName && isSelected}`}
                >
                  <span className="system-nav__service-info">
                    <Link link={`/specs/${pc}/${serviceId}`} text={serviceId} />
                    <span className="system-nav__url-row">
                      <a
                        className="system-nav__service-url"
                        href={serviceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {serviceUrl}
                      </a>
                      <span
                        className={`system-nav__status-dot system-nav__status-dot--${serviceStatus[serviceUrl] || "unknown"}`}
                      />
                    </span>
                  </span>
                  <span className="server-module__docs-icon">
                    <DocIcon isSaved={isSaved} />
                  </span>
                  <button
                    className="system-nav__delete-btn"
                    title="Remove service"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteService(pc, serviceId);
                    }}
                  >
                    <TrashIcon />
                  </button>
                </span>
              }
            >
              <ServerModulesList
                selectedServiceId={selectedServiceId}
                selectedModuleName={selectedModuleName}
                selectedMethodName={selectedMethodName}
                projectCode={pc}
                serviceId={serviceId}
                modules={system.connectionData.modules}
                specList={specList}
              />
            </ExpandableList>
          );
        })}
      </ExpandableList>
    );
  });
};

export default SystemNav;
