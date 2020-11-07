import React from "react";
import "./styles.scss";

const Text = ({ text }) => {
  console.log(text);
  return <span className="text">{text}</span>;
};

export default Text;
