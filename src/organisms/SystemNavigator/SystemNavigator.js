import React, { useEffect, useContext, useState } from "react";
import { useHistory } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import TextBox from "../../atoms/Textbox/Textbox";
import Link from "../../atoms/Link/Link";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import ServerModulesList from "../../molecules/ServerModulesList/ServerModulesList";
import DocIcon from "../../atoms/DocsIcon/DocsIcon";
import refreshIcon from "../../assets/refresh.png";
import "./styles.scss";
import { Client } from "systemlynx-client";

const SystemNav = ({ projectCode, serviceId, moduleName, methodName }) => {
  const [searchTerm, setSearchTerm] = useState(projectCode);
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
    return [...others, ...incoming];
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

  const history = useHistory();
  const SearchInputSubmit = async (e) => {
    const pc = e.target.value;
    const results = await fetchProject(pc);
    if (results && results.length) {
      history.push(`/${results[0].projectCode}`);
      setSearchTerm(results[0].projectCode);
    } else {
      setSearchTerm("");
    }
  };
  const refreshHandler = async () => {
    try {
      const results = await SystemView.refreshConnection(searchTerm);
      setConnectedServices((prev) => mergeServices(prev, results, searchTerm));
    } catch (error) {}
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
    if (projectCode) fetchProject(projectCode);
  }, []);
  useEffect(() => {
    if (Plugin) Plugin.on(`reconnect`, fetchProject);
  }, [Plugin, connectedServices]);
  return (
    <section className="system-nav">
      <div className="container">
        <div className="row system-nav__section">
          <div className="col-12" style={{ display: "flex" }}>
            <TextBox
              defaultText={projectCode}
              placeholderText="projectCode"
              TextboxSubmit={SearchInputSubmit}
            />
            <img
              className={`btn`}
              src={refreshIcon}
              alt={"Refresh"}
              style={{ width: "24px", height: "24px", margin: "2px" }}
              onClick={refreshHandler}
            />
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
            className={`system-nav__link system-nav__link--selected-${
              isSelectedProject && !selectedServiceId
            }`}
          >
            <Link link={`/${pc}`} text={pc} />
          </span>
        }
      >
        {services.map(({ system, serviceId, specList }, i) => {
          const { serviceUrl } = system.connectionData;
          const isSaved = specList.docs.includes(`${serviceId}.md`);
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
                  <span>
                    <Link link={`/${pc}/${serviceId}`} text={serviceId} />
                    <a
                      className="system-nav__service-url"
                      href={serviceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {serviceUrl}
                    </a>
                  </span>
                  <span className="server-module__docs-icon">
                    <DocIcon isSaved={isSaved} />
                  </span>
                </span>
              }
            >
              <ServerModulesList
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
