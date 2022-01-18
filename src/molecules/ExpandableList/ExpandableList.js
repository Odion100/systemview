import React, { useState } from "react";
import "./styles.scss";
import List from "../../atoms/List/List";
import ExpandIcon from "../../atoms/ExpandableIcon/ExpandableIcon";

const ExpandableList = ({ children, title, open = false }) => {
  const [isOpen, setState] = useState(open);

  const expandClick = () => {
    setState(!isOpen);
  };
  return (
    <div className="expandable-list">
      <div className="expandable-list__button" onClick={expandClick}>
        <ExpandIcon isOpen={isOpen} />
        {title}
      </div>

      <div className={`expandable-list__items expandable-list__items--${!isOpen ? "hidden" : ""}`}>
        <List>{children}</List>
      </div>
    </div>
  );
};

export default ExpandableList;
