import React from "react";
import "./styles.scss";

const DescriptionBox = ({ value, setValue }) => {
  return (
    <div className="description-box">
      <textarea
        className="description-box__textbox"
        name="description-box"
        id="description-box"
        defaultValue={value}
        onChange={
          setValue
            ? (e) => {
                setValue(e.target.value);
              }
            : null
        }
      ></textarea>
    </div>
  );
};

export default DescriptionBox;
