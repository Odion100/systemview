import React from "react";
import "./styles.scss";

const TestCaption = ({ caption, useInput = false, onChange }) => {
  const className = "test-caption";
  const clickHandle = (e) => {
    typeof onChange === "function" && onChange(e.target.value);
  };
  return (
    <div className={`${className}`}>
      <span className={`${className}__title`}>{caption}</span>
      <span
        className={`${className}__description-input ${className}__description-input--visible-${useInput}`}
      >
        <input type="text" placeholder="describe the test..." onChange={clickHandle} />
      </span>
    </div>
  );
};

export default TestCaption;
