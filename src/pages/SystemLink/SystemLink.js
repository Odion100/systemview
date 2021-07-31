import React, { useState } from "react";
import "./styles.scss";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";

const SystemLink = () => {
  return (
    <section className="system-viewer">
      <div className="row">
        <div className="col-4">
          <SystemNavigator />
        </div>
        <div className="col-6">
          <Documentation />
        </div>
        <div className="col-2"></div>
      </div>
    </section>
  );
};

export default SystemLink;
