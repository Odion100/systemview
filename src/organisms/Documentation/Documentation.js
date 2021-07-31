import React, { useState, useContext, useEffect } from "react";
import { useRouteMatch, useParams, Route, Switch } from "react-router-dom";
import Title from "../../atoms/Title/Title";
import "./styles.scss";

import ProjectDoc from "../ProjectDocumentaton/ProjectDocumentation";

const Documentation = () => {
  return (
    <section className="documentation">
      <Switch>
        <Route exact path={"/"}>
          <Title text={`Default Documentation`} />
        </Route>
        <Route path={"/:project_code"}>
          <ProjectDoc />
        </Route>
      </Switch>
    </section>
  );
};

export default Documentation;
