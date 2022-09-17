import React from "react";
import "./styles.scss";

const Button = ({ children, submit }) => {
  return (
    <button className="button" onClick={submit}>
      {children}
    </button>
  );
};

export default Button;
