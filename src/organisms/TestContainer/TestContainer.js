import React, { useContext, useEffect, useRef, useState } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import ScratchPad from "../ScratchPad/ScratchPad";
import FoldContext from "../TestPanel/FoldContext";

import "./styles.scss";

// A scratchpad step's live status, derived the SAME way the saved-test cards do: `running` while its
// runner is mid-flight, else pass/fail once it has run (fail = it produced validation errors). Not run
// yet ⇒ null (no accent). Keeps the scratchpad's indicators consistent with the Saved-tests look.
const stepStatus = (test) => {
  if (test.running) return "running";
  if (test.test_end == null) return null;
  const errs = typeof test.getErrors === "function" ? test.getErrors() : test.errors || [];
  return errs.length ? "fail" : "pass";
};

const TestContainer = ({
  open: _open,
  title,
  children,
  dynamic,
  TestController,
  test,
  testIndex,
  title_color,
  staticArguments,
  multiTest,
}) => {
  const className = "test-container";
  // Expand-all / collapse-all from the scratchpad's top toolbar (and edit-load collapses everything).
  // Initialize from the fold signal so an edit-loaded test mounts already-collapsed (no expand flash).
  const fold = useContext(FoldContext);
  const [open, setOpen] = useState(fold.signal ? fold.open : _open);
  const nodeRef = useRef(null);
  const wasRunning = useRef(false);

  useEffect(() => {
    if (fold.signal) setOpen(fold.open);
  }, [fold.signal]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = stepStatus(test);
  const running = status === "running";
  const ns = test.namespace || {};
  const hasArgs = (test.args || []).length > 0;

  // A run NEVER changes your expand state — you keep whatever you had open/closed. It only SCROLLS to
  // follow the running step (during a run-all the view walks down the section). Edge-triggered so it
  // doesn't fire between runs.
  useEffect(() => {
    const started = running && !wasRunning.current;
    wasRunning.current = running;
    if (!started) return;
    if (nodeRef.current) nodeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [running]);

  const toggleExpansion = () => {
    setOpen((state) => !state);
  };
  // Clicking anywhere on a COLLAPSED step expands it. It does NOT collapse the same way — collapsing is
  // the caret only, so clicks while you're editing an expanded step never fold it shut.
  const expandOnClick = !open ? () => setOpen(true) : undefined;
  const updateTitle = (text) => {
    TestController.updateTitle(testIndex, text);
  };
  useEffect(() => {}, [test.title]);
  return (
    <section
      ref={nodeRef}
      className={`${className} ${status ? `${className}--${status}` : ""}`}
    >
      <ExpandableSection
        toggleExpansion={toggleExpansion}
        open={open}
        title_color={title_color || "#0d8065"}
        title={
          <div className={`${className}__title-wrap`} onClick={expandOnClick}>
            <div className={`${className}__title-row`}>
              {/* Step deletion moved to the corner tool row (× · ⧉ · ⠿ — RFC-023); the old input
                  end-cap × is retired. */}
              <span className={`${className}__caption-wrap`}>
                <TestCaption
                  onChange={updateTitle}
                  caption={<b>{title}</b>}
                  useInput={true}
                  title={test.title || ""}
                />
              </span>
              {/* Status badge mirrors the saved-test card: spinner while running, PASS/FAIL once run. */}
              {running ? (
                <span className={`${className}__badge is-running`}>
                  <span className={`${className}__spinner`} />running
                </span>
              ) : status ? (
                <span className={`${className}__badge is-${status}`}>
                  {status === "fail" ? "failed" : "passed"}
                </span>
              ) : null}
            </div>
            {/* Collapsed: still show the method being called (under the title) so you can see what the
                step IS without expanding it — same idea as a collapsed saved test / story action. */}
            {!open && (ns.methodName || ns.moduleName) && (
              <code className={`${className}__call`}>
                {ns.serviceId ? `${ns.serviceId}.` : ""}
                {ns.moduleName}.<b>{ns.methodName}</b>({hasArgs ? "…" : ""})
              </code>
            )}
          </div>
        }
      >
        <ScratchPad
          TestController={TestController}
          test={test}
          testIndex={testIndex}
          dynamic={dynamic}
          staticArguments={staticArguments}
        />
        {children}
      </ExpandableSection>
    </section>
  );
};

export default TestContainer;
