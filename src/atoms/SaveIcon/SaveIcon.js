import React from "react";
import "./styles.scss";
import icon from "../../assets/icons-save-60.png";
const SaveIcon = ({ onClick }) => {
  return (
    <div className={`save-icon btn`}>
      <img src={icon} alt="Save" />
    </div>
  );
};

export default SaveIcon;
