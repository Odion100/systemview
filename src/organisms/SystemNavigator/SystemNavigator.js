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

  const fetchProject = async (pc = projectCode) => {
    try {
      const results = await SystemView.getServices(pc);
      setConnectedServices(results);
      return results;
    } catch (error) {
      console.error(error);
      setConnectedServices([]);
    }
  };

  const history = useHistory();
  const SearchInputSubmit = async (e) => {
    const project = await fetchProject(e.target.value);
    if (project.length) {
      if (project[0].projectCode) {
        history.push(`/${project[0].projectCode}`);
        setSearchTerm(project[0].projectCode);
      }
    } else setSearchTerm("");
  };
  const refreshHandler = async (e) => {
    try {
      const results = await SystemView.refreshConnection(searchTerm);
      setConnectedServices(results);
    } catch (error) {
      setConnectedServices([]);
    }
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
              projectCode={projectCode}
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
  projectCode,
  selectedServiceId,
  selectedModuleName,
  selectedMethodName,
}) => {
  return connectedServices.map(({ system, serviceId, specList }, i) => {
    const { serviceUrl } = system.connectionData;
    const isSaved = specList.docs.includes(`${serviceId}.md`);
    const isSelected = selectedServiceId === serviceId;
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
            <>
              <Link link={`/${projectCode}/${serviceId}`} text={serviceId} />
              <span>
                <a
                  className="system-nav__service-url"
                  href={serviceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {serviceUrl}
                </a>
              </span>
            </>
            <span className="server-module__docs-icon">
              <DocIcon isSaved={isSaved} />
            </span>
          </span>
        }
      >
        <ServerModulesList
          selectedModuleName={selectedModuleName}
          selectedMethodName={selectedMethodName}
          projectCode={projectCode}
          serviceId={serviceId}
          modules={system.connectionData.modules}
          specList={specList}
        />
      </ExpandableList>
    );
  });
};

export default SystemNav;
