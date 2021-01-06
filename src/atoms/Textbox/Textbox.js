import React from "react";
import "./styles.scss";

const Textbox = ({ placeholderText, TextboxSubmit, value }) => {
  return (
    <div className="textbox">
      <input
        type="text"
        defaultValue={value}
        placeholder={placeholderText}
        onKeyDown={(e) => {
          if (e.key === "Enter") TextboxSubmit(e);
        }}
      />
    </div>
  );
};

export default Textbox;
