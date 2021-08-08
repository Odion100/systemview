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
        onChange={
          setValue
            ? (e) => {
                console.log(e.target.value);
                setValue(e.target.value);
              }
            : null
        }
      />
    </div>
  );
};

export default Textbox;
