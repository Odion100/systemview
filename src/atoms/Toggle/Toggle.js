import React from "react";
import "./styles.scss";

const Toggle = ({ round, isChecked }) => {
  return (
    <label className={`switch ${round ? "round" : ""}`}>
      <input type="checkbox" defaultChecked={isChecked} />
      <span className="slider"></span>
    </label>
  );
};

export default Toggle;
