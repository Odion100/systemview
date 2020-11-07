import React from "react";
import "./styles.scss";
import TextBox from "../../atoms/Textbox/Textbox";
import List from "../../atoms/List/List";
import ExpandableList from "../../molecules/ExpandableList/ExpandableList";
import TextWith2Links from "../../molecules/TextWith2Links/TextWith2Links";

const SystemNav = ({ services, SearchInputSubmit, getDocumentation }) => {
  return (
    <section className="system-nav">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <TextBox placeholderText="project_code" TextboxSubmit={SearchInputSubmit} />
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <List></List>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SystemNav;
