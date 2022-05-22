import React from "react";
import "./styles.scss";
import Selector from "../Selector/Selector";
const options = ["string", "number", "date", "boolean", "object", "undefined", "null", "target"];

const TypeSelector = ({ default_type, onSelect, className = "" }) => {
  const class_name = "type-selector";
  return (
    <Selector
      className={`${class_name} ${className}`}
      options={options}
      selected_option={default_type}
      onSelect={onSelect}
    />
  );
};

export default TypeSelector;
