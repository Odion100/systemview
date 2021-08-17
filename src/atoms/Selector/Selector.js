import React from "react";
import "./styles.scss";

const Selector = ({ options, selected_option, setValue, className }) => {
  return (
    <select className={className} value={selected_option} onChange={setValue}>
      {options.map((option, i) => (
        <option key={i}>{option}</option>
      ))}
    </select>
  );
};

export default Selector;
