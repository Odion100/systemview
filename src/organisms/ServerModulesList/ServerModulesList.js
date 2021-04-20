import React from "react";
import "./styles.scss";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import Link from "../../atoms/Link/Link";
import MissingDocIcon from "../../atoms/DocsIcon/DocsIcon";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";

const ServerModulesList = ({ project_code, service_id, server_modules, setRef }) => {
  return (
    <React.Fragment>
      {server_modules.map(({ name, methods }, i) => {
        return (
          <ExpandableList
            key={i}
            title={
              <React.Fragment>
                <Link
                  link="#"
                  text={name}
                  linkClick={() => setRef({ project_code, service_id, module_name: name })}
                />
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
                    link="#"
                    key={i}
                    text={`.${fn}(data, cb)`}
                    linkClick={() =>
                      setRef({ project_code, service_id, module_name: name, method_name: fn })
                    }
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
