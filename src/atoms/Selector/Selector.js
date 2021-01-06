import React from "react";
import "./styles.scss";

const Selector = ({ options, selected_option }) => {
  return (
    <select className="method-data-form__data-type-selector" defaultValue={selected_option}>
      {options.map((option, i) => (
        <option key={i}>{option}</option>
      ))}
    </select>
  );
};

export default Selector;
