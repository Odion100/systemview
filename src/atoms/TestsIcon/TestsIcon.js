import React from "react";
import "./styles.scss";
import testMissingIcon from "../../assets/test-missing.png";
import testSavedIcion from "../../assets/test-saved.png";
const TestsIcon = ({ add_class, isSaved }) => {
  console.log(isSaved);
  return (
    <React.Fragment>
      <div className={`missing-doc-icon ${add_class}`}>
        <img
          className={`missing-doc-icon__img ${add_class}`}
          src={isSaved ? testMissingIcon : testSavedIcion}
          alt="missing docs"
        />
      </div>
    </React.Fragment>
  );
};

export default TestsIcon;
