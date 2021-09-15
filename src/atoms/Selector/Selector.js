import React from "react";
import "./styles.scss";

const Selector = ({ options = [], selected_option, onSelect, className }) => {
  return (
    <select className={className} defaultValue={selected_option} onChange={onSelect}>
      {options.map((option, i) => (
        <option key={i}>{option}</option>
      ))}
    </select>
  );
};

export default Selector;
