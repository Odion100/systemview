import React from "react";
import "./styles.scss";
import testMissingIcon from "../../assets/test-missing.png";
import testSavedIcion from "../../assets/test-saved.png";
const TestsIcon = ({ add_class, isSaved }) => {
  return (
    <div className={`doc-icon ${add_class}`}>
      <img
        className={`doc-icon__img ${add_class}`}
        src={isSaved ? testSavedIcion : testMissingIcon}
        alt="missing tests"
      />
    </div>
  );
};

export default TestsIcon;
