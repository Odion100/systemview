import React from "react";
import "./styles.scss";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import EditBox from "../../molecules/EditBox/EditBox";

const DescriptionEditor = ({ text, editorSubmit }) => {
  text = text || "Click to add a description";

  return (
    <div className="description-editor">
      <EditBox
        mainObject={<DescriptionBox text={text} />}
        hiddenForm={
          <textarea
            className="description-editor__textbox"
            name="description-editor"
            id="description-editor"
            defaultValue={text}
          ></textarea>
        }
        formSubmit={editorSubmit}
      />
    </div>
  );
};

export default DescriptionEditor;
