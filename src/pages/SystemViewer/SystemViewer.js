import React from "react";
import "./styles.scss";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";

const SystemViewer = ({ SystemView }) => {
  return (
    <section className="system-viewer">
      <div className="row">
        <div className="col-4">
          <SystemNavigator />
        </div>
        <div className="col-8"></div>
      </div>
    </section>
  );
};

export default SystemViewer;
