import React from "react";
import "./styles.scss";
import icon from "../../assets/icons-save-60.png";
export default function SaveIcon({ onClick }) {
  return <img className="save-icon" src={icon} alt="Save" />;
}
