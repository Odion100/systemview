import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import TextBox from "../../atoms/Textbox/Textbox";
import Link from "../../atoms/Link/Link";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import ServerModulesList from "../../molecules/ServerModulesList/ServerModulesList";
import MissingDocIcon from "../../atoms/DocsIcon/DocsIcon";
import "./styles.scss";

const SystemNav = ({ projectCode, serviceId, moduleName, methodName }) => {
  const { SystemViewService, setConnectedServices, connectedServices } =
    useContext(ServiceContext);
  const { SystemView } = SystemViewService;
  const history = useHistory();

  const fetchProject = async (projectCode) => {
    try {
      const results = await SystemView.getServices(projectCode);
      setConnectedServices(results);
    } catch (error) {
      console.error(error);
      setConnectedServices([]);
    }
  };

  const SearchInputSubmit = (e) => {
    fetchProject(e.target.value);
    history.push(`/${e.target.value}`);
  };

  useEffect(() => {
    if (projectCode) fetchProject(projectCode);
  }, []);
  useEffect(() => {
    SystemView.on(
      `service-updated:${serviceId}`,
      async function updateServices(updatedService) {
        const i = connectedServices.findIndex(
          (service) =>
            service.projectCode === updatedService.projectCode &&
            service.serviceId === updatedService.serviceId
        );
        connectedServices[i] = updatedService;
        setConnectedServices(connectedServices);
      }
    );
  }, [SystemView, connectedServices]);
  return (
    <section className="system-nav">
      <div className="container">
        <div className="row system-nav__section">
          <div className="col-12">
            <TextBox
              defaultText={projectCode}
              placeholderText="projectCode"
              TextboxSubmit={SearchInputSubmit}
            />
          </div>
        </div>
        <div className="row system-nav__section">
          <div className="col-12 ">
            <NavigationLinks
              servicesList={connectedServices}
              projectCode={projectCode}
              _serviceId={serviceId}
              _moduleName={moduleName}
              _methodName={methodName}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

const NavigationLinks = ({
  servicesList,
  projectCode,
  _serviceId,
  _moduleName,
  _methodName,
}) => {
  return servicesList.map(({ system, serviceId }, i) => {
    return (
      <ExpandableList
        open={_serviceId === serviceId}
        key={i}
        title={
          <React.Fragment>
            <Link link={`/${projectCode}/${serviceId}`} text={serviceId} />
            <div className="server-module__docs-icon">
              <MissingDocIcon isSaved={parseInt(Math.random() * 1000) % 2} />
            </div>
          </React.Fragment>
        }
      >
        <ServerModulesList
          moduleName={_moduleName}
          projectCode={projectCode}
          serviceId={serviceId}
          modules={system.connectionData.modules}
          methodName={_methodName}
        />
      </ExpandableList>
    );
  });
};

export default SystemNav;
