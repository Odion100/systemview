import React, { useState, useEffect, useContext } from "react";
import { useHistory, useParams, useRouteMatch, Route } from "react-router-dom";
import ServiceContext from "../../ServiceContext";
import "./styles.scss";
import TextBox from "../../atoms/Textbox/Textbox";
import Link from "../../atoms/Link/Link";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import ServerModulesList from "../../organisms/ServerModulesList/ServerModulesList";
import MissingDocIcon from "../../atoms/DocsIcon/DocsIcon";

const SystemNav = () => {
  const { SystemLink } = useContext(ServiceContext).SystemLinkService;
  const [servicesList, setServiceList] = useState([]);
  const history = useHistory();

  const { project_code } = useParams();
  const { path, url } = useRouteMatch();

  console.log(project_code, path, url);

  const fetchProject = async (project_code) => {
    console.log(project_code);
    try {
      const results = await SystemLink.getServices({ project_code });
      if (results.status === 200) {
        setServiceList(results.services);
        setDocument({ project_code });
      }
      console.log(results);
    } catch (error) {
      console.error(error);
    }
  };

  const setDocument = ({ project_code, service_id, module_name, method_name }) => {
    if (method_name && module_name && service_id && project_code)
      history.push(`/${project_code}/${service_id}/${module_name}/${method_name}`);
    else if (module_name && service_id && project_code)
      history.push(`/${project_code}/${service_id}/${module_name}`);
    else if (service_id && project_code) history.push(`/${project_code}/${service_id}`);
    else if (project_code) history.push(`/${project_code}`);
    else history.push("/");
  };
  const SearchInputSubmit = (e) => fetchProject(e.target.value);

  useEffect(() => {
    if (project_code) fetchProject(project_code);
  }, []);

  return (
    <section className="system-nav">
      <div className="container">
        <div className="row system-nav__section">
          <div className="col-12">
            <TextBox placeholderText="project_code" TextboxSubmit={SearchInputSubmit} />
          </div>
        </div>
        <div className="row system-nav__section">
          <div className="col-12 ">
            <Route path={"/:project_code"}>
              <SystemNavList servicesList={servicesList} />
            </Route>
          </div>
        </div>
      </div>
    </section>
  );
};

const SystemNavList = ({ servicesList }) => {
  const { project_code } = useParams();
  const { path, url } = useRouteMatch();

  console.log(project_code, path, url);

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
