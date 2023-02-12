import React from "react";
import "./styles.scss";
import CLEAR_ICON from "../../assets/clear.png";

const Button = ({ children, submit }) => {
  return (
    <button className="button" onClick={submit}>
      {children}
    </button>
  );
};

export function ClearButton({ onClick }) {
  return (
    <span className={`clear-button btn`} onClick={onClick}>
      <img src={CLEAR_ICON} alt="clear" />
    </span>
  );
}
export default Button;
