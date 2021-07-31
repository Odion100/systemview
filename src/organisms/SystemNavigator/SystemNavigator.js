import React, { useState, useEffect, useContext } from "react";
import ServiceContext from "../../ServiceContext";
import "./styles.scss";
import TextBox from "../../atoms/Textbox/Textbox";
import Link from "../../atoms/Link/Link";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import ServerModulesList from "../../organisms/ServerModulesList/ServerModulesList";
import MissingDocIcon from "../../atoms/DocsIcon/DocsIcon";

const SystemNav = ({ project_code, setRef }) => {
  const { SystemLink } = useContext(ServiceContext).SystemLinkService;
  const [servicesList, setServiceList] = useState([]);

  const fetchServiceList = async (project_code) => {
    console.log(project_code);
    try {
      const results = await SystemLink.getServices({ project_code });
      if (results.status === 200) setServiceList(results.services);
      console.log(results);
    } catch (error) {
      console.error(error);
    }
  };
  const SearchInputSubmit = (e) => fetchServiceList(e.target.value);

  useEffect(() => {
    if (project_code) fetchServiceList(project_code);
  }, []);

  return (
    <section className="system-nav">
      <div className="container">
        <div className="row system-nav__section">
          <div className="col-12">
            <TextBox
              placeholderText="project_code"
              TextboxSubmit={SearchInputSubmit}
              text={project_code}
            />
          </div>
        </div>
        <div className="row system-nav__section">
          <div className="col-12 ">
            {servicesList.map(({ server_modules, system_modules, dependencies, service_id }, i) => {
              return (
                <ExpandableList
                  key={i}
                  title={
                    <React.Fragment>
                      <Link
                        link="#"
                        text={service_id}
                        linkClick={() => setRef({ project_code, service_id })}
                      />
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
                    setRef={setRef}
                  />
                </ExpandableList>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SystemNav;
