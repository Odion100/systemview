import React from "react";
import "./styles.scss";
import Selector from "../Selector/Selector";
const options = [
  "string",
  "number",
  "date",
  "boolean",
  "object",
  "array",
  "undefined",
  "null",
  "target",
];

const TypeSelector = ({ default_type = "object", onSelect, className = "" }) => {
  const class_name = "type-selector";
  return (
    <Selector
      className={`${class_name} ${className}`}
      options={options}
      onSelect={onSelect}
      controlledOption={default_type}
    />
  );
};

export default TypeSelector;
