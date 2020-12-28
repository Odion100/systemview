import React from "react";
import "./styles.scss";
import DescriptionText from "../../atoms/DescriptionText/DescriptionText";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import EditBox from "../../molecules/EditBox/EditBox";

const DescriptionEditor = ({ text, editorSubmit }) => {
  text = text || "Click to add a description";

  return (
    <div className="description-editor">
      <EditBox
        mainObject={<DescriptionText text={text} />}
        hiddenForm={<DescriptionBox text={text} />}
        formSubmit={editorSubmit}
      />
    </div>
  );
};

export default DescriptionEditor;
