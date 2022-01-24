import React from "react";
import "./styles.scss";
import Selector from "../Selector/Selector";
const options = [
  "string",
  "number",
  "date",
  "boolean",
  "object",
  "undefined",
  "null",
  "target",
  "complex",
];

const TypeSelector = ({ default_type, onSelect, xClassname = "" }) => {
  const classname = "type-selector";
  return (
    <Selector
      className={`${classname} ${xClassname}`}
      options={options}
      selected_option={default_type}
      onSelect={onSelect}
    />
  );
};

export default TypeSelector;
