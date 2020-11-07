import React from "react";
import "./styles.scss";

const SidePanel = () => {
  return (
    <section className="side-panel">
      <div className="container">
        <div className="row">
          <div className="col">
            <input type="text" className="side-panel__searchbar" />
          </div>
        </div>
        <div className="row">
          <div className="col"></div>
        </div>
      </div>
    </section>
  );
};

export default SidePanel;
