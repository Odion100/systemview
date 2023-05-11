import React from "react";
import "./styles.scss";

const Title = ({ text, style }) => {
  return (
    <span style={style} className="title">
      {text}
    </span>
  );
};

export default Title;
