import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import TextBox from "../../atoms/Textbox/Textbox";
import Link from "../../atoms/Link/Link";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import ServerModulesList from "../../molecules/ServerModulesList/ServerModulesList";
import MissingDocIcon from "../../atoms/DocsIcon/DocsIcon";
import "./styles.scss";

const SystemNav = ({ project_code, service_id, module_name, method_name }) => {
  const { SystemLinkService, setConnectedProject } = useContext(ServiceContext);
  const { SystemLink } = SystemLinkService;
  const [servicesList, setServiceList] = useState([]);
  const history = useHistory();

  const fetchProject = async (project_code) => {
    try {
      console.log(project_code);
      const results = await SystemLink.getServices({ project_code });
      console.log(results);
      setServiceList(results);
      setConnectedProject(results);
    } catch (error) {
      console.error(error);
      setConnectedProject([]);
    }
  };

  const SearchInputSubmit = (e) => {
    fetchProject(e.target.value);
    history.push(`/${e.target.value}`);
  };

  useEffect(() => {
    if (project_code) fetchProject(project_code);
  }, []);

  return (
    <section className="system-nav">
      <div className="container">
        <div className="row system-nav__section">
          <div className="col-12">
            <TextBox
              defaultText={project_code}
              placeholderText="project_code"
              TextboxSubmit={SearchInputSubmit}
            />
          </div>
        </div>
        <div className="row system-nav__section">
          <div className="col-12 ">
            <NavigationLinks
              servicesList={servicesList}
              project_code={project_code}
              _service_id={service_id}
              _module_name={module_name}
              _method_name={method_name}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

const NavigationLinks = ({
  servicesList,
  project_code,
  _service_id,
  _module_name,
  _method_name,
}) => {
  return servicesList.map(
    ({ server_modules, system_modules, dependencies, service_id }, i) => {
      return (
        <ExpandableList
          open={_service_id === service_id}
          key={i}
          title={
            <React.Fragment>
              <Link link={`/${project_code}/${service_id}`} text={service_id} />
              <div className="server-module__docs-icon">
                <MissingDocIcon isSaved={parseInt(Math.random() * 1000) % 2} />
              </div>
            </React.Fragment>
          }
        >
          <ServerModulesList
            module_name={_module_name}
            project_code={project_code}
            service_id={service_id}
            server_modules={server_modules}
            method_name={_method_name}
          />
        </ExpandableList>
      );
    }
  );
};

export default SystemNav;
