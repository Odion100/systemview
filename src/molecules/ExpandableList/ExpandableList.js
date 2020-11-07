import React from "react";
import "./styles.scss";
import List from "../../atoms/List/List";
import Text from "../../atoms/Text/Text";

const ExpandableList = ({ children, title }) => {
  console.log(title);
  return (
    <div className="expandable-list">
      <Text text={title} />
      <List>{children}</List>
    </div>
  );
};

export default ExpandableList;
