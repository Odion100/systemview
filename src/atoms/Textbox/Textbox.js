import React from "react";
import "./styles.scss";

const Textbox = ({ placeholderText, TextboxSubmit, text, setValue }) => {
  return (
    <div className="textbox">
      <input
        type="text"
        defaultValue={text}
        placeholder={placeholderText}
        onKeyDown={(e) => {
          if (e.key === "Enter") TextboxSubmit(e);
        }}
        onChange={setValue}
      />
    </div>
  );
};

export default Textbox;
