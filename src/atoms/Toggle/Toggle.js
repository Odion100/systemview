import React from "react";
import "./styles.scss";

const Title = ({ round }) => {
  return (
    <label className={`switch ${round ? "round" : ""}`}>
      <input type="checkbox" />
      <span className="slider"></span>
    </label>
  );
};

export default Title;
