import React from "react";
import "./styles.scss";

const DescriptionBox = ({ text }) => {
  return (
    <div className="description-text">
      <p className="description-text__text">{text}</p>
    </div>
  );
};

export default DescriptionBox;
