import React from "react";
import "./styles.scss";
import ExpandIcon from "../../atoms/ExpandableIcon/ExpandableIcon";

const ExpandableSection = ({
  children,
  title,
  title_color,
  open,
  lock,
  toggleExpansion,
}) => {
  const style = { color: title_color || "black" };

  return (
    <div className="expandable-section">
      <div className="expandable-section__title" style={style}>
        <span
          className={`expandable-section__btn expandable-section__btn--hide-${lock}`}
          onClick={toggleExpansion}
        >
          <ExpandIcon isOpen={open} />
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
