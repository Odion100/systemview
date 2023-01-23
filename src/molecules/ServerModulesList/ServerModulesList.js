import React from "react";
import "./styles.scss";
import ExpandableList from "../ExpandableList/ExpandableList";
import MyLink from "../../atoms/Link/Link";
import MissingDocIcon from "../../atoms/DocsIcon/DocsIcon";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";

const ServerModulesList = ({
  projectCode,
  serviceId,
  modules,
  moduleName,
  methodName,
}) => {
  const className = "server-module";
  console.log("modules---->", modules);
  return (
    <React.Fragment>
      {modules.map(({ name, methods }, i) => {
        const isSelected = moduleName === name;
        return (
          <ExpandableList
            open={moduleName === name}
            key={i}
            title={
              <React.Fragment>
                <MyLink link={`/${projectCode}/${serviceId}/${name}`} text={name} />
                <div className={`${className}__docs-icon`}>
                  <MissingDocIcon isSaved={parseInt(Math.random() * 1000) % 2} />
                </div>
              </React.Fragment>
            }
          >
            {methods.map(({ fn }, i) => {
              return (
                <div
                  key={i}
                  className={`${className}__methods ${className}__methods--selected-${
                    fn === methodName && isSelected
                  }`}
                >
                  <MyLink
                    key={i}
                    link={`/${projectCode}/${serviceId}/${name}/${fn}`}
                    text={`.${fn}(data, cb)`}
                  />
                  <div className={`${className}__docs-icon`}>
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
