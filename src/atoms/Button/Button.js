import React from "react";
import "./styles.scss";

const Button = ({ link, children, buttonSubmit }) => {
  return (
    <a href={`${link ? link : "#"}`} className="button" onClick={buttonSubmit}>
      {children}
    </a>
  );
};

export default Button;
