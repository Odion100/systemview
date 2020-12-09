import React from "react";
import "./styles.scss";

const Button = ({ link, children, buttonSubmit }) => {
  return (
    <a href={`${link ? link : "#"}`} className="btn" onClick={buttonSubmit}>
      {children}
    </a>
  );
};

export default Button;
