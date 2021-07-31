import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";
import ServiceDoc from "../ServiceDocumentation/ServiceDocumentation";
import { useRouteMatch, useParams, Route, Switch } from "react-router-dom";

const ProjectDocumentation = ({ project }) => {
  const { project_code } = useParams();
  const { path, url } = useRouteMatch();

  console.log(project_code, path, url);
  return (
    <section className="project-documentation">
      <Switch>
        <Route exact path={path}>
          <Title text={`Project Documentation:${project_code}`} />
        </Route>
        <Route path={`${path}/:service_id`}>
          <ServiceDoc />
        </Route>
      </Switch>
    </section>
  );
};

export default ProjectDocumentation;
