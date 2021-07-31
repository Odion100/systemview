import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";
import MethodDoc from "../MethodDocumentation/MethodDocumentation";
import { useRouteMatch, useParams, Route, Switch } from "react-router-dom";

const ModuleDocumentation = () => {
  const { module_name } = useParams();
  const { path, url } = useRouteMatch();

  console.log(module_name, path, url);
  return (
    <section className="module-documentation">
      <Title text={`Module Documetation:${module_name}`} />
    </section>
  );
};

export default ModuleDocumentation;
