import React from "react";
import "./styles.scss";
import savedDocImg from "../../assets/saved-doc.png";
import missingDocImg from "../../assets/missing-doc.png";

const DocIcon = ({ isSaved }) => {
  return (
    <>
      <div className={`doc-icon`}>
        <img
          className={`doc-icon__img`}
          src={isSaved ? savedDocImg : missingDocImg}
          alt={isSaved ? "Saved Doc" : "Missing Doc"}
        />
      </div>
    </>
  );
};

export default DocIcon;
