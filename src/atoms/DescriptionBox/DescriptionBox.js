import React from "react";
import CodeEditor from "../CodeView/CodeEditor";
import "./styles.scss";

// RFC-018 Phase 4 — the doc editor is now real CodeMirror (markdown), not a bare textarea. Same
// `text`/`setValue` contract, so every existing caller (EditBox in Documentation) is unchanged — you
// just get syntax highlighting, soft-wrap, and undo/redo where you used to get a plain box.
const DescriptionBox = ({ text, setValue }) => {
  return (
    <div className="description-box">
      <CodeEditor value={text || ""} language="markdown" onChange={setValue || undefined} dark />
    </div>
  );
};

export default DescriptionBox;
