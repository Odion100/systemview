import React, { useState } from "react";
import Count from "../../atoms/Count";
import RunTestIcon, { EditIcon, XButton } from "../../atoms/RunTestIcon";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import TestSummary from "../../molecules/TestSummary";
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
                  {"Saved"} {savedTests.length > 0 && <Count count={savedTests.length} />}
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
              <TestDisplay key={i} title={title} index={i} />
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

function TestDisplay({ title, index }) {
  return (
    <>
      <div className="test-saved-section__test-row">
        <span className="test-saved-section__test-index ">Test {index + 1}:</span>
        <span className="test-saved-section__test-title">{title}</span>
        <span className="test-saved-section__buttons">
          <RunTestIcon />
          <EditIcon />
          <XButton />
        </span>
      </div>
      <TestSummary />
    </>
  );
}
export default SavedTests;
