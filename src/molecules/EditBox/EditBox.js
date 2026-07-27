import React, { useState } from "react";
import "./styles.scss";

const EditBox = ({ formSubmit, mainObject, hiddenForm, onCancel, open = false }) => {
  const [editMode, setEditMode] = useState(open);
  const editBoxClicked = () => setEditMode(true);
  const cancelClicked = () => {
    if (typeof onCancel === "function") onCancel();
    setEditMode(false);
  };
  const saveClicked = () => formSubmit(setEditMode);

  return (
    <div className={`edit-box edit-box--${editMode ? "edit" : "read"}`}>
      <div
        onClick={editBoxClicked}
        className={`edit-box__main edit-box__main--${editMode ? "hidden" : "visible"}`}
      >
        {mainObject}
      </div>
      <div className={`edit-box__form edit-box__form--${editMode ? "visible" : "hidden"}`}>
        {/* Save/Close are plain words pinned at the top of the editor, OUTSIDE its scroll — not
            buttons stuck at the bottom of a tall scrolling box (RFC-018 editor feedback). */}
        <div className="edit-box__actions">
          <span className="edit-box__link edit-box__link--save" onClick={saveClicked}>Save</span>
          <span className="edit-box__link" onClick={cancelClicked}>Close</span>
        </div>
        {hiddenForm}
      </div>
    </div>
  );
};

export default EditBox;
