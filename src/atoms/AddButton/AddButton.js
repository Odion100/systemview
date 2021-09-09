import React from "react";
import "./styles.scss";

const AddButton = ({ hiddenCaption, buttonSubmit }) => {
  return (
    <span className="add-btn" onClick={buttonSubmit}>
      +<span className="add-btn--hide-effect">{hiddenCaption}</span>
    </span>
  );
};

export default AddButton;
