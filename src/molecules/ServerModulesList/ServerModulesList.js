import React from "react";
import "./styles.scss";
import ExpandableList from "../ExpandableList/ExpandableList";
import MyLink from "../../atoms/Link/Link";
import DocIcon from "../../atoms/DocsIcon/DocsIcon";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";

const ServerModulesList = ({
  projectCode,
  serviceId,
  modules,
  selectedModuleName,
  selectedMethodName,
  specList,
}) => {
  const className = "server-module";

  return (
    <React.Fragment>
      {modules.map(({ name, methods }, i) => {
        const isSelected = selectedModuleName === name;
        const isSaved = specList.docs.includes(`${name}.md`);
        return (
          <ExpandableList
            open={selectedModuleName === name}
            key={i}
            title={
              <span
                className={`system-nav__link system-nav__link--selected-${
                  !selectedMethodName && isSelected
                } ${name === "Plugin" && className + "__name--plugin"}`}
              >
                <MyLink link={`/${projectCode}/${serviceId}/${name}`} text={name} />
                <span className={`${className}__docs-icon`}>
                  <DocIcon isSaved={isSaved} />
                </span>
              </span>
            }
          >
            {methods.map(({ fn }, i) => {
              const isSavedDoc = !!specList.docs.includes(`${name}.${fn}.md`);
              const isSavedTest = !!specList.tests.includes(`${name}.${fn}.json`);
              return (
                <div
                  key={i}
                  className={`${className}__methods system-nav__link--selected-${
                    fn === selectedMethodName && isSelected
                  }`}
                >
                  <MyLink
                    key={i}
                    link={`/${projectCode}/${serviceId}/${name}/${fn}`}
                    text={
                      <span>
                        {`.${fn}(`}
                        <span style={{ fontWeight: "bold" }}>...</span>
                        {")"}
                      </span>
                    }
                  />
                  <div className={`${className}__docs-icon`}>
                    <DocIcon isSaved={isSavedDoc} />
                    <TestsIcon isSaved={isSavedTest} />
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
