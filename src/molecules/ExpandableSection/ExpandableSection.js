import React, { useState } from "react";
import "./styles.scss";
import ExpandIcon from "../../atoms/ExpandableIcon/ExpandableIcon";

const ExpandableSection = ({ children, title, title_color }) => {
  const [isOpen, setState] = useState(false);

  const expandClick = () => {
    setState(!isOpen);
  };
  const style = {
    "--title-color": title_color || "black",
  };
  console.log(style);
  return (
    <div className="expandable-section" style={style}>
      <div className="expandable-section__button">
        <span onClick={expandClick}>
          <ExpandIcon isOpen={isOpen} />
        </span>
        <span>{title}</span>
      </div>

      <div
        className={`expandable-section__items expandable-section__items--${
          !isOpen ? "hidden" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export default ExpandableSection;
