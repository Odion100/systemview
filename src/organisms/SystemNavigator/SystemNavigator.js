import React, { useState, useContext } from "react";
import ServiceContext from "../../ServiceContext";
import "./styles.scss";
import TextBox from "../../atoms/Textbox/Textbox";
import Link from "../../atoms/Link/Link";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import ServerModulesList from "../../organisms/ServerModulesList/ServerModulesList";
import MissingDocIcon from "../../atoms/DocsIcon/DocsIcon";

const SystemNav = () => {
  const SystemViewAPI = useContext(ServiceContext);
  const [servicesList, setServices] = useState([]);

  const SearchInputSubmit = async (e) => {
    const { SystemView } = SystemViewAPI;

    try {
      const results = await SystemView.getServices({ project_code: e.target.value });
      if (results.length > 0) setServices(results.services);
    } catch (error) {
      console.log(error);
    }
  };
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
            {servicesList.map(({ server_modules, system_modules, dependencies, service_id }, i) => {
              return (
                <ExpandableList
                  key={i}
                  title={
                    <React.Fragment>
                      <Link link="#" text={service_id} />
                      <div className="server-module__docs-icon">
                        <MissingDocIcon isSaved={parseInt(Math.random() * 1000) % 2} />
                      </div>
                    </React.Fragment>
                  }
                >
                  <ServerModulesList server_modules={server_modules} />
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
