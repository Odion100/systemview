import React from "react";
import "./styles.scss";

const ExpandIcon = ({
  isOpen,
  className = "",
  onClick,
  color = "black",
  size: fontSize,
}) => {
  return isOpen ? (
    <span
      style={{ color, fontSize }}
      onClick={onClick}
      className={`expandable-icon ${className}`}
    >
      &#9660;
    </span>
  ) : (
    <span
      style={{ color, fontSize }}
      onClick={onClick}
      className={`expandable-icon ${className}`}
    >
      &#x25BA;
    </span>
  );
};

export default ExpandIcon;
