import React, { useState, useEffect } from "react";
import "./styles.scss";
import Button from "../../atoms/Button/Button";

const EditBox = ({
  formSubmit,
  mainObject,
  hiddenForm,
  onCancel,
  open = false,
  stateChange,
}) => {
  const [editMode, setEditMode] = useState(open);
  const editBoxClicked = () => setEditMode(true);
  const cancelClicked = () => {
    if (typeof onCancel === "function") onCancel();
    setEditMode(false);
  };

  const saveClicked = () => {
    formSubmit(setEditMode);
    //setEditMode(false);
  };
  // useEffect(() => {
  //   setEditMode(false);
  // }, [stateChange]);
  return (
    <div className={`edit-box edit-box--${editMode ? "edit" : "read"}`}>
      <div
        onClick={editBoxClicked}
        className={`edit-box__main edit-box__main--${editMode ? "hidden" : "visible"}`}
      >
        {mainObject}
      </div>
      <div
        className={`edit-box__form edit-box__form--${editMode ? "visible" : "hidden"}`}
      >
        <div className="row">{hiddenForm}</div>

        <div className="edit-box__button">
          <Button submit={saveClicked}>Save</Button>
          <Button submit={cancelClicked}>Close</Button>
        </div>
      </div>
    </div>
  );
};

export default EditBox;
