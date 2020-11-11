import React from "react";
import "./styles.scss";
import savedDoc from "../../assets/saved-doc.png";
import missingDoc from "../../assets/missing-doc.png";

const MissingDocIcon = ({ add_class, isSaved }) => {
  console.log(isSaved);
  return (
    <React.Fragment>
      <div className={`missing-doc-icon ${add_class}`}>
        <img
          className={`missing-doc-icon__img ${add_class}`}
          src={isSaved ? savedDoc : missingDoc}
          alt="missing docs"
        />
      </div>
    </React.Fragment>
  );
};

export default MissingDocIcon;
