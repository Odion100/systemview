import React from "react";
import EDIT_ICON from "../../assets/edit.png";
import X_BUTTON from "../../assets/x.svg";
import "./styles.scss";

// The run affordance is a play button in the run-test button color (no label), not the old test-icon img.
export default function RunTestIcon({ onClick }) {
  return (
    <span
      className="run-play-btn"
      onClick={onClick}
      role="button"
      aria-label="Run Test"
    >
      ▶
    </span>
  );
}

export function EditIcon({ onClick }) {
  return (
    <img
      className="btn"
      style={{ width: "16px" }}
      src={EDIT_ICON}
      alt={"Edit Test"}
      onClick={onClick}
    />
  );
}

export function XButton({ onClick }) {
  return (
    <img
      className="btn"
      style={{ width: "10px" }}
      src={X_BUTTON}
      alt={"Delete Test"}
      onClick={onClick}
    />
  );
}
