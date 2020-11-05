import React from "react";
import "./styles.scss";

const SystemViewer = ({ SystemView }) => {
  console.log(SystemView);
  return (
    <section className="system-viewer">
      <div className="row">
        <div className="col-4"></div>
        <div className="col-8"></div>
      </div>
    </section>
  );
};

export default SystemViewer;
