import React from "react";
import "./styles.scss";

const AddButton = ({ hiddenCaption, onClick }) => {
  return (
    <span className="add-btn" onClick={onClick}>
      +<span className="add-btn--hide-effect">{hiddenCaption}</span>
    </span>
  );
};

export default AddButton;
