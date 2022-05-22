import React from "react";
import "./styles.scss";

const Toggle = ({ round, isChecked, onChange }) => {
  return (
    <label className={`switch ${round ? "round" : ""}`}>
      <input type="checkbox" checked={isChecked} onChange={onChange} />
      <span className={`slider ${round ? "round" : ""}`}></span>
    </label>
  );
};

export default Toggle;
