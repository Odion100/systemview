import React from "react";
import "./styles.scss";
import Title from "../../atoms/Title/Title";
import ModuleDocumentation from "../ModuleDocumentation/ModuleDocumentation";
import { useRouteMatch, useParams, Route, Switch } from "react-router-dom";

const ServiceDocumentation = () => {
  const { service_id } = useParams();
  const { path, url } = useRouteMatch();

  console.log(service_id, path, url);

  return (
    <section className="service-documentation">
      <Switch>
        <Route exact path={path}>
          <Title text={`Service Documentation:${service_id}`} />
        </Route>
        <Route path={`${path}/:module_name`}>
          <ModuleDocumentation />
        </Route>
      </Switch>
    </section>
  );
};

export default ServiceDocumentation;
