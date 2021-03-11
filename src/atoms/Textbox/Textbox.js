import React from "react";
import "./styles.scss";

const Textbox = ({ placeholderText, TextboxSubmit, value, setValue }) => {
  return (
    <div className="textbox">
      <input
        type="text"
        defaultValue={value}
        placeholder={placeholderText}
        onKeyDown={(e) => {
          if (e.key === "Enter") TextboxSubmit(e);
        }}
        onChange={
          setValue
            ? (e) => {
                setValue(e.target.value);
              }
            : null
        }
      />
    </div>
  );
};

export default Textbox;
