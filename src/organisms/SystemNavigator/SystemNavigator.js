import React from "react";
import "./styles.scss";
import TextBox from "../../atoms/Textbox/Textbox";
import List from "../../atoms/List/List";
import Link from "../../atoms/Link/Link";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import TextWith2Links from "../../molecules/TextWith2Links/TextWith2Links";
import Text from "../../atoms/Text/Text";
import ServerModulesList from "../../organisms/ServerModulesList/ServerModulesList";
import MissingDocIcon from "../../atoms/MissingDocIcon/MissingDocIcon";

const SystemNav = ({ SearchInputSubmit, servicesList }) => {
  console.log(servicesList);
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
                    <React.Fragment className="system-navobject-title">
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
