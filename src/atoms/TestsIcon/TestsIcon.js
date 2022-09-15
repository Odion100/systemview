import React from "react";
import "./styles.scss";
import testMissingImg from "../../assets/test-missing.png";
import testSavedImg from "../../assets/test-saved.png";
const TestsIcon = ({ isSaved }) => {
  return (
    <div className={`doc-icon`}>
      <img
        className={`doc-icon__img`}
        src={isSaved ? testSavedImg : testMissingImg}
        alt="missing tests"
      />
    </div>
  );
};

export default TestsIcon;
