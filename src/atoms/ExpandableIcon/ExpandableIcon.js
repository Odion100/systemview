import React from "react";
import "./styles.scss";

const ExpandIcon = ({ isOpen, classname = "", onClick }) => {
  return isOpen ? (
    <span onClick={onClick} className={`expandable-icon ${classname}`}>
      &#9660;
    </span>
  ) : (
    <span onClick={onClick} className={`expandable-icon ${classname}`}>
      &#x25BA;
    </span>
  );
};

export default ExpandIcon;
