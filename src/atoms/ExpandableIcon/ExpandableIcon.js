import React from "react";
import "./styles.scss";

const ExpandIcon = ({ isOpen, classname = "", submit }) => {
  return isOpen ? (
    <span onClick={submit} className={`expandable-icon ${classname}`}>
      &#9660;
    </span>
  ) : (
    <span onClick={submit} className={`expandable-icon ${classname}`}>
      &#x25BA;
    </span>
  );
};

export default ExpandIcon;
