import React, { useState } from "react";
import RunTestIcon, { DeleteButton, EditIcon, XButton } from "../../atoms/RunTestIcon";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import "./styles.scss";

const SavedTests = ({ savedTests = [] }) => {
  const [open, setOpen] = useState(false);

  const toggleExpansion = () => {
    setOpen((state) => !state);
  };
  return (
    <section className="test-saved-section">
      <ExpandableSection
        toggleExpansion={toggleExpansion}
        open={open}
        title={
          <span>
            <TestCaption
              caption={
                <span>
                  {"Saved"}{" "}
                  {savedTests.length > 0 && (
                    <span className={"multi-test-section__count"}>
                      {savedTests.length}
                    </span>
                  )}
                </span>
              }
            />
          </span>
        }
        title_color="#0d8065"
      >
        {savedTests.length ? (
          <div className="test-saved-section__test-container">
            {savedTests.map(({ title }, i) => (
              <div key={i} className="test-saved-section__test-row">
                <span className="test-saved-section__test-index ">Test {i + 1}:</span>
                <span className="test-saved-section__test-title">{title}</span>
                <span className="test-saved-section__buttons">
                  <RunTestIcon />
                  <EditIcon />
                  <XButton />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="test-saved-section__test-data">
            <span>no saved tests</span>
          </div>
        )}
      </ExpandableSection>
    </section>
  );
};

export default SavedTests;
