import React, { useState } from "react";
import "./styles.scss";

const ObjectEditor = ({ obj = {} }) => {
  const [state, setState] = useState(obj);
  return (
    <div className="object-editor">
      <span className="object-editor__brackets">&#123;</span>
      <span>...</span>

      <span className="object-editor__brackets">&#125;</span>
    </div>
  );
};

export default ObjectEditor;
