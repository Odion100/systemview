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
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
    <path d="M9 6V4h6v2"/>
  </svg>
);

const ArrowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const SystemNav = ({ projectCode, serviceId, moduleName, methodName, onCollapse }) => {
  const [serviceStatus, setServiceStatus] = useState({});
  const [adding, setAdding] = useState(false);
  const [connectUrl, setConnectUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const { SystemViewService, setConnectedServices, connectedServices } =
    useContext(ServiceContext);
  const serviceData = connectedServices.find(
    (serviceData) =>
      serviceData.serviceId === serviceId && serviceData.projectCode === projectCode
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
      })
    );
    setServiceStatus((prev) => ({ ...prev, ...Object.fromEntries(results) }));
  };

  const fetchAllProjects = async () => {
    try {
      const projects = await SystemView.getProjects();
      const all = Object.entries(projects).flatMap(([pc, svcs]) =>
        svcs.map((svc) => ({ projectCode: pc, ...svc }))
      );
      // Mark credentialed origins UP FRONT (not lazily on first setHeaders) so the very first request
      // to a gated service — including a signIn whose Set-Cookie must be STORED — already carries
      // withCredentials. Otherwise an early non-credentialed request drops the Set-Cookie and the
      // session never persists. A service is credentialed when it declares a header profile OR
      // registered the cookie-only `credentials: true` flag (RFC-013).
      all.forEach((s) => {
        const url = (s.system && s.system.connectionData && s.system.connectionData.serviceUrl) || s.serviceUrl;
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
        prev.filter((s) => !(s.projectCode === pc && s.serviceId === svcId))
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
  useEffect(() => {
    if (connectedServices.length)
      SystemView.on(
        `spec-list-updated:${projectCode}`,
        function updateSpecList({ specList, serviceId }) {
          const serviceData = connectedServices.find(
            (serviceData) =>
              serviceData.serviceId === serviceId &&
              serviceData.projectCode === projectCode
          );
          if (serviceData) {
            serviceData.specList = specList;
            setConnectedServices([...connectedServices]);
          }
        }
      );
  }, [projectCode, connectedServices]);
  useEffect(() => {
    fetchAllProjects();
  }, []);
  useEffect(() => {
    if (projectCode) fetchProject(projectCode);
  }, []);
  useEffect(() => {
    if (Plugin) Plugin.on(`reconnect`, fetchProject);
  }, [Plugin, connectedServices]);
  return (
    <section className="system-nav">
      <div className="container">
        {onCollapse && (
          <div className="row system-nav__section">
            <div className="col-12">
              <span className="panel-title panel-title--nav" title="Collapse the navigator" onClick={onCollapse}>
                <span className="panel-title__arrow">‹</span>
                <Title text="Navigator" />
              </span>
            </div>
          </div>
        )}
        <div className="row system-nav__section">
          <div className="col-12">
            {adding ? (
              <div className="system-nav__connect-form">
                <input
                  className="system-nav__connect-input"
                  type="text"
                  autoFocus
                  placeholder="https://host/route"
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
                <button
                  className="system-nav__connect-cancel"
                  title="Cancel"
                  onClick={cancelConnect}
                  disabled={connecting}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                className="system-nav__connect-btn"
                onClick={() => setAdding(true)}
              >
                <span className="system-nav__connect-bullet">•</span>
                loadService(...)
                <span className="system-nav__connect-arrow">
                  <ArrowIcon />
                </span>
              </button>
            )}
          </div>
        </div>
        <div className="row system-nav__section">
          <div className="col-12 ">
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
          </div>
        </div>
      </div>
      <div className="scroll-buffer"></div>
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
            className={`system-nav__link system-nav__link--project system-nav__link--selected-${
              isSelectedProject && !selectedServiceId
            }`}
          >
            <Link link={`/specs/${pc}`} text={pc} />
            <button
              className="system-nav__delete-btn"
              title="Remove project"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteProject(pc); }}
            >
              <TrashIcon />
            </button>
          </span>
        }
      >
        {services.map(({ system, serviceId, specList }, i) => {
          const { serviceUrl } = system.connectionData;
          const isSaved = specList && specList.docs && specList.docs.includes(`${serviceId}.md`);
          const isSelected = isSelectedProject && selectedServiceId === serviceId;
          return (
            <ExpandableList
              open={isSelected}
              key={i}
              title={
                <span
                  className={`system-nav__link system-nav__link--selected-${
                    !selectedModuleName && isSelected
                  }`}
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
                      <span className={`system-nav__status-dot system-nav__status-dot--${serviceStatus[serviceUrl] || "unknown"}`} />
                    </span>
                  </span>
                  <span className="server-module__docs-icon">
                    <DocIcon isSaved={isSaved} />
                  </span>
                  <button
                    className="system-nav__delete-btn"
                    title="Remove service"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteService(pc, serviceId); }}
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
