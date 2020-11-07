import React from "react";
import "./styles.scss";
import TextBox from "../../atoms/Textbox/Textbox";
import List from "../../atoms/List/List";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import TextWith2Links from "../../molecules/TextWith2Links/TextWith2Links";

const SystemNav = (services) => {
  return (
    <section className="system-nav">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <input
              className="system-nav__searchbar"
              type="text"
              placeholder="Search project_code and hit enter."
            />
          </div>
        </div>
        <div className="row">
          <div className="col-12"></div>
        </div>
      </div>
    </section>
  );
};

export default SystemNav;
