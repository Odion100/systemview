import React from "react";
import "./styles.scss";

const Textbox = ({
  placeholderText,
  TextboxSubmit,
  text,
  setValue,
  disabled = false,
  defaultText,
  inputClassName,
}) => {
  const enterClicked = (e) => {
    if (e.key === "Enter" && typeof TextboxSubmit === "function") TextboxSubmit(e);
  };

  return (
    <div className={`textbox`}>
      <input
        type="text"
        value={text}
        defaultValue={defaultText}
        placeholder={placeholderText}
        onKeyDown={enterClicked}
        onChange={setValue}
        disabled={disabled}
        className={inputClassName}
      />
    </div>
  );
};

export default Textbox;
