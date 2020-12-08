import React from "react";
import "./styles.scss";

const DescriptionBox = ({ text }) => {
  return (
    <div className="description-box">
      <p className="description-box__text">{text}</p>
    </div>
  );
};

export default DescriptionBox;
