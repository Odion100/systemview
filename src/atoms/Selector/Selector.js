import React from "react";
import "./styles.scss";

const Selector = ({ options, selected_option }) => {
  return (
    <select className="method-data-form__data-type-selector">
      {options.map((option) => (
        <option selected={option === selected_option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
};

export default Selector;
