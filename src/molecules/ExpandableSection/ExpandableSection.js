import React from "react";
import "./styles.scss";
import ExpandIcon from "../../atoms/ExpandableIcon/ExpandableIcon";

const ExpandableSection = ({
  children,
  title,
  color = "#2aa198",
  open,
  lock,
  toggleExpansion,
}) => {
  return (
    <div className="expandable-section">
      <div className="expandable-section__title">
        <span
          className={`expandable-section__btn expandable-section__btn--hide-${lock}`}
          onClick={toggleExpansion}
        >
          <ExpandIcon color={color} isOpen={open} />
        </span>
        {title}
      </div>

      <div
        className={`expandable-section__items expandable-section__items--${
          !open ? "hidden" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export default ExpandableSection;
