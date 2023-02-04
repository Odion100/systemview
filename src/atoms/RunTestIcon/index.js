import React from "react";
import TEST_ICON from "../../assets/test-icon.svg";
import EDIT_ICON from "../../assets/edit.png";
import X_BUTTON from "../../assets/x.svg";
import "./styles.scss";

export default function RunTestIcon({ onClick }) {
  return (
    <img
      className="btn"
      onClick={onClick}
      style={{ width: "16px" }}
      src={TEST_ICON}
      alt={"Run Test"}
    />
  );
}

export function EditIcon() {
  return (
    <img className="btn" style={{ width: "16px" }} src={EDIT_ICON} alt={"Edit Test"} />
  );
}

export function XButton() {
  return (
    <img className="btn" style={{ width: "10px" }} src={X_BUTTON} alt={"Delete Test"} />
  );
}
