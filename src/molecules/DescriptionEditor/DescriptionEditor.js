import React, { useState } from "react";
import "./styles.scss";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import Button from "../../atoms/Button/Button";
const DescriptionEditor = ({ text, editorSubmit }) => {
  const [editMode, setEditMode] = useState(false);
  const editClicked = () => setEditMode(true);
  const cancelClicked = () => setEditMode(false);
  text = text || "Click to add a description";

  return (
    <div className="description-editor">
      <div
        onClick={editClicked}
        className={`description-editor__text description-editor__text--${
          editMode ? "hidden" : "visible"
        }`}
      >
        <DescriptionBox text={text} />
      </div>
      <div
        className={`description-editor__form description-editor__form--${
          editMode ? "visible" : "hidden"
        }`}
      >
        <div className="row">
          <div className="container">
            <textarea
              className="description-editor__textbox"
              name="description-editor"
              id="description-editor"
              defaultValue={text}
            ></textarea>
          </div>
        </div>
        <div className="row">
          <div className="description-editor__button">
            <Button buttonSubmit={editorSubmit}>Save</Button>
            <Button buttonSubmit={cancelClicked}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DescriptionEditor;
