import React from "react";
import "./styles.scss";

const ExpandButton = ({ _click }) => {
  return (
    <span onClick={_click} className="expandable-button">
      &#x25BA;
    </span>
  );
};

export default ExpandButton;
