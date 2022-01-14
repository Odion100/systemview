import React from "react";
import "./styles.scss";
import Selector from "../Selector/Selector";
const options = [
  "number",
  "date",
  "string",
  "array",
  "boolean",
  "object",
  "null",
  "undefined",
  "target",
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
