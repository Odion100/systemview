import React, { useState } from "react";
import "./styles.scss";
import DescriptionBox from "../../atoms/DescriptionBox";

const DescriptionEditor = ({ text }) => {
  const [editMode, setState] = useState(false);

  return (
    <div className="description-editor">
      <div
        className={`description-editor__text description-editor__text--${
          editMode ? "hidden" : "visible"
        }`}
      >
        <DescriptionBox text={text ? text : "Add Description"} />
      </div>
      <div
        className={`description-editor__form description-editor__form--${
          editMode ? "visible" : "hidden"
        }`}
      >
        <div className="row">
          <textarea
            className="description-editor__textbox"
            name="description-editor"
            id="description-editor"
            cols="30"
            rows="10"
          ></textarea>
        </div>
        <div className="row">
          <button className="description-editor__btn">Save</button>
        </div>
      </div>
    </div>
  );
};

export default DescriptionEditor;
