import React from "react";
import "./styles.scss";

const ExpandIcon = ({ isOpen, className = "", onClick }) => {
  return isOpen ? (
    <span onClick={onClick} className={`expandable-icon ${className}`}>
      &#9660;
    </span>
  ) : (
    <span onClick={onClick} className={`expandable-icon ${className}`}>
      &#x25BA;
    </span>
  );
};

export default ExpandIcon;
