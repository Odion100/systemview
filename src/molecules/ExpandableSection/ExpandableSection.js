import React, { useState } from "react";
import "./styles.scss";
import ExpandIcon from "../../atoms/ExpandableIcon/ExpandableIcon";

const ExpandableSection = ({ children, title, title_color, open, lock }) => {
  const [isOpen, setState] = useState(open);

  const expandClick = () => {
    setState(!isOpen);
  };
  const style = {
    color: title_color || "black",
  };

  return (
    <div className="expandable-section">
      <div className="expandable-section__title" style={style}>
        <span
          className={`expandable-section__btn expandable-section__btn--hide-${lock}`}
          onClick={expandClick}
        >
          <ExpandIcon isOpen={isOpen} />
        </span>
        {title}
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
