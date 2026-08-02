import React, { useContext, useEffect, useState } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import TestContainer from "../TestContainer/TestContainer";
import Argument from "../TestPanel/components/Argument.class";
import FoldContext from "../TestPanel/FoldContext";

import "./styles.scss";
import Count from "../../atoms/Count";

const MultiTestSection = ({
  caption,
  TestController,
  TestSection,
  dynamic,
  namespace,
  arg = {},
  staticArguments,
  onRemove, // RFC-020 — named-action sections are removable from the test (built-ins pass nothing)
  titleColor, // RFC-020 — named sections carry their own color identity
  sectionTag, // RFC-020 — small "action" tag before the caption for a named section
}) => {
  const className = "multi-test-section";
  const [open, setOpen] = useState(false);

  // When a run reaches this section (any step flips to running), auto-expand it so you can watch the
  // steps go — the section shouldn't stay collapsed while it's actively running underneath.
  useEffect(() => {
    if (TestSection.some((t) => t.running)) setOpen(true);
  }, [TestSection]);

  // Expand-all / collapse-all from the scratchpad's top toolbar.
  const fold = useContext(FoldContext);
  useEffect(() => {
    if (fold.signal) setOpen(fold.open);
  }, [fold.signal]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpansion = () => {
    setOpen((state) => !state);
  };

  const addTest = () => {
    TestController.addTest(
      namespace,
      arg.name && [new Argument(arg.name, arg.FullTest, arg.input_type)]
    );
    TestSection.length === 1 && setOpen(true);
  };
  return (
    <section className={className}>
      <ExpandableSection
        toggleExpansion={toggleExpansion}
        open={open}
        title={
          <>
            <TestCaption
              caption={
                // The label itself toggles the section — not just the caret (the run/add buttons sit in
                // their own actions group, so they're unaffected).
                <span
                  className={`${className}__caption-toggle`}
                  onClick={toggleExpansion}
                >
                  {sectionTag && <span className={`${className}__tag`}>{sectionTag}</span>}
                  {caption}{" "}
                  {TestSection.length > 0 && <Count count={TestSection.length} />}
                  {/* Remove (×) lives WITH the title (badge · name · count) — so the run/+ group below
                      lines up flush with the other sections instead of being pushed in by an × there. */}
                  {onRemove && (
                    <span
                      className={`${className}__remove-btn btn`}
                      title="Remove this section from the test"
                      onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    >
                      ×
                    </span>
                  )}
                </span>
              }
            />
            <span className={`${className}__actions`}>
              {TestSection.length > 0 && (
                <button
                  type="button"
                  className={`${className}__run-btn`}
                  title={`Run ${caption} only`}
                  onClick={(e) => { e.stopPropagation(); TestController.runAllTest(); }}
                >
                  ▶ Run
                </button>
              )}
              <AddButton onClick={addTest} className={className} />
            </span>
          </>
        }
        title_color={titleColor || "#0d8065"}
      >
        <div className={`${className}__test-data`}>
          {TestSection.length > 0 ? (
            TestSection.map((test, i) => (
              <TestContainer
                key={i}
                TestController={TestController}
                test={test}
                testIndex={i}
                title={`${i + 1}:`}
                title_color={"#4b53b3"}
                dynamic={dynamic}
                open={true}
                staticArguments={staticArguments}
                multiTest
              />
            ))
          ) : (
            <span>no actions</span>
          )}
        </div>
      </ExpandableSection>
    </section>
  );
};

const AddButton = ({ onClick, className }) => {
  return (
    <span className={`${className}__add-btn btn`} onClick={onClick}>
      +
    </span>
  );
};
export default MultiTestSection;
