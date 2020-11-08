import React, { useState } from "react";
import "./styles.scss";
import List from "../../atoms/List/List";
import Text from "../../atoms/Text/Text";
import ExpandButton from "../../atoms/ExpandButton/ExpandButton";

const ExpandableList = ({ children, title }) => {
  const [isOpen, setState] = useState(false);

  const expandClick = () => {
    setState(!isOpen);
  };
  return (
    <div className="expandable-list">
      <div className="expandable-list__button">
        <ExpandButton _click={expandClick} />
        <Text text={title} />
      </div>

      <div className={`expandable-list__items expandable-list__items--${!isOpen ? "hidden" : ""}`}>
        <List>{children}</List>
      </div>
    </div>
  );
};

export default ExpandableList;
