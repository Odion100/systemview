import React, { useState } from "react";
import "./styles.scss";
import Button from "../../atoms/Button/Button";

const DescriptionEditor = ({ formSubmit, mainObject, hiddenForm }) => {
  const [editMode, setEditMode] = useState(false);
  const editBoxClicked = () => setEditMode(true);
  const cancelClicked = () => setEditMode(false);

  return (
    <div className="edit-box">
      <div
        onClick={editBoxClicked}
        className={`edit-box__main edit-box__main--${editMode ? "hidden" : "visible"}`}
      >
        {mainObject}
      </div>
      <div className={`edit-box__form edit-box__form--${editMode ? "visible" : "hidden"}`}>
        <div className="row">
          <div className="container">{hiddenForm}</div>
        </div>
        <div className="row">
          <div className="edit-box__button">
            <Button buttonSubmit={formSubmit}>Save</Button>
            <Button buttonSubmit={cancelClicked}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DescriptionEditor;
