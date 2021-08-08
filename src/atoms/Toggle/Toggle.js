import React from "react";
import "./styles.scss";

const Toggle = ({ round, isChecked, setValue }) => {
  return (
    <label className={`switch ${round ? "round" : ""}`}>
      <input
        type="checkbox"
        defaultChecked={isChecked}
        onChange={
          setValue
            ? (e) => {
                setValue(e.target.checked);
              }
            : null
        }
      />
      <span className="slider"></span>
    </label>
  );
};

export default Toggle;
