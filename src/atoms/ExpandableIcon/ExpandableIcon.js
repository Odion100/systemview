import React from "react";
import "./styles.scss";

const ExpandIcon = ({
  isOpen,
  className = "",
  onClick,
  color = "#97a0b8",
  size: fontSize = "10px",
}) => {
  return (
    <span
      style={{ color, fontSize }}
      onClick={onClick}
      className={`expandable-icon ${className}`}
    >
      {isOpen ? "▾" : "▸"}
    </span>
  );
};

export default ExpandIcon;
