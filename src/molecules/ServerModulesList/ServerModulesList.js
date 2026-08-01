import React from "react";
import "./styles.scss";
import ExpandableList from "../ExpandableList/ExpandableList";
import MyLink from "../../atoms/Link/Link";
import DocIcon from "../../atoms/DocsIcon/DocsIcon";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";

const ServerModulesList = ({
  projectCode,
  serviceId,
  selectedServiceId,
  modules,
  selectedModuleName,
  selectedMethodName,
  specList,
}) => {
  const className = "server-module";
  // A module/method is only "selected" when it belongs to the selected SERVICE — otherwise a module
  // (e.g. Auth) or method (e.g. getSession) that several services share would all light up at once.
  const serviceSelected = selectedServiceId === serviceId;

  return (
    <React.Fragment>
      {modules.map(({ name, methods }, i) => {
        const isSelected = serviceSelected && selectedModuleName === name;
        const isSaved = specList.docs.includes(`${name}.md`);
        return (
          <ExpandableList
            open={serviceSelected && selectedModuleName === name}
            key={i}
            title={
              <span
                className={`system-nav__link system-nav__link--active-${
                  isSelected
                } system-nav__link--selected-${
                  !selectedMethodName && isSelected
                } ${(name === "Plugin" || name === "SystemView") && className + "__name--plugin"}`}
              >
                <MyLink link={`/specs/${projectCode}/${serviceId}/${name}`} text={name} />
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
                    link={`/specs/${projectCode}/${serviceId}/${name}/${fn}`}
                    text={
                      <span>
                        <span className={`${className}__methods__paren`}>.</span>
                        {fn}
                        <span className={`${className}__methods__paren`}>(…)</span>
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
