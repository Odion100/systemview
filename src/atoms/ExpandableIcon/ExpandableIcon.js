import React from "react";
import "./styles.scss";

const ExpandButton = ({ isOpen }) => {
  return isOpen ? (
    <span className="expandable-icon">&#9660;</span>
  ) : (
    <span className="expandable-icon">&#x25BA;</span>
  );
};

export default ExpandButton;
