import React from "react";
import "./styles.scss";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import Link from "../../atoms/Link/Link";
import MissingDocIcon from "../../atoms/DocsIcon/DocsIcon";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";

const ServerModulesList = ({ project_code, service_id, server_modules, module_name }) => {
  return (
    <React.Fragment>
      {server_modules.map(({ name, methods }, i) => {
        return (
          <ExpandableList
            open={module_name === name}
            key={i}
            title={
              <React.Fragment>
                <Link link={`/${project_code}/${service_id}/${name}`} text={name} />
                <div className="server-module__docs-icon">
                  <MissingDocIcon isSaved={parseInt(Math.random() * 1000) % 2} />
                </div>
              </React.Fragment>
            }
          >
            {methods.map(({ fn }, i) => {
              return (
                <div key={i} className="server-module__methods">
                  <Link
                    key={i}
                    link={`/${project_code}/${service_id}/${name}/${fn}`}
                    text={`.${fn}(data, cb)`}
                  />
                  <div className="server-module__docs-icon">
                    <MissingDocIcon isSaved={parseInt(Math.random() * 1000) % 2} />
                    <TestsIcon isSaved={parseInt(Math.random() * 1000) % 2} />
                  </div>
                </div>
              );
            })}
          </ExpandableList>
        );
      })}
    </React.Fragment>
  );
};

export default ServerModulesList;
