import React from "react";
import "./styles.scss";

const TestCaption = ({ caption, useInput = false }) => {
  const classname = "test-caption";
  return (
    <div className={`${classname}`}>
      <span className={`${classname}__title`}>{caption}</span>
      <span
        className={`${classname}__description-input ${classname}__description-input--visible-${useInput}`}
      >
        <input type="text" />
      </span>
    </div>
  );
};

export default TestCaption;
