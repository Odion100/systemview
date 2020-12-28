import React from "react";
import "./styles.scss";

const DescriptionBox = ({ text }) => {
  text = text || "Click to add a description";

  return (
    <div className="description-box">
      <textarea
        className="description-box__textbox"
        name="description-box"
        id="description-box"
        defaultValue={text}
      ></textarea>
    </div>
  );
};

export default DescriptionBox;
