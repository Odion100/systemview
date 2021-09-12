import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import "./styles.scss";
import TextBox from "../../atoms/Textbox/Textbox";
import Link from "../../atoms/Link/Link";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import ServerModulesList from "../../organisms/ServerModulesList/ServerModulesList";
import MissingDocIcon from "../../atoms/DocsIcon/DocsIcon";

const SystemNav = ({ project_code }) => {
  const { SystemLinkService, setServices } = useContext(ServiceContext);
  const { SystemLink } = SystemLinkService;
  const [servicesList, setServiceList] = useState([]);
  const history = useHistory();

  const fetchProject = async (project_code) => {
    try {
      const results = await SystemLink.getServices({ project_code });
      if (results.status === 200) {
        setServiceList(results.services);
        setServices(results.services);
      } else setServices([]);
    } catch (error) {
      console.error(error);
      setServices([]);
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
            <NavigationLinks servicesList={servicesList} project_code={project_code} />
          </div>
        </div>
      </div>
    </section>
  );
};

const NavigationLinks = ({ servicesList, project_code }) => {
  return servicesList.map(({ server_modules, system_modules, dependencies, service_id }, i) => {
    return (
      <ExpandableList
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
          project_code={project_code}
          service_id={service_id}
          server_modules={server_modules}
        />
      </ExpandableList>
    );
  });
};

export default SystemNav;
