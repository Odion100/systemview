import React, { useContext, useEffect, useState } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import TestContainer from "../TestContainer/TestContainer";
import Argument from "../TestPanel/components/Argument.class";
import FoldContext from "../TestPanel/FoldContext";

import "./styles.scss";
import Count from "../../atoms/Count";

const DRAG_MIME = "application/x-sv-step";
// EVENT steps are their own species (event_name arg + `.on` listener) — they rearrange within Events
// only, and normal steps can't drop in. A separate MIME enforces it at dragover time, so the drop
// indicators never light up across the boundary.
const EVENTS_DRAG_MIME = "application/x-sv-step-events";
const stepMime = (sectionKey) => (sectionKey === "events" ? EVENTS_DRAG_MIME : DRAG_MIME);

// RFC-023 — the shell around ONE step: the drag grip (move within/across editable sections), the
// duplicate (⧉), and the drop target (top half = before this step, bottom half = after). Sections
// that pass no onStepMove (shared-action steps, the Actions tab) render the bare step — sealed.
export function StepShell({ sectionKey, index, onStepMove, onStepDuplicate, onDelete, children }) {
  const [over, setOver] = useState(null); // "before" | "after" while a step hovers
  const canDrop = !!onStepMove;
  const mime = stepMime(sectionKey);
  const isEvents = sectionKey === "events";
  const sideAt = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY > r.top + r.height / 2 ? "after" : "before";
  };
  return (
    <div
      className={`step-shell${over ? ` step-shell--over-${over}` : ""}`}
      onDragOver={
        canDrop
          ? (e) => {
              if (![...e.dataTransfer.types].includes(mime)) return;
              e.preventDefault();
              setOver(sideAt(e));
            }
          : undefined
      }
      onDragLeave={canDrop ? () => setOver(null) : undefined}
      onDrop={
        canDrop
          ? (e) => {
              e.preventDefault();
              setOver(null);
              let d;
              try {
                d = JSON.parse(e.dataTransfer.getData(mime));
              } catch {
                return;
              }
              if (!d || d.key == null) return;
              onStepMove(d.key, d.index, sectionKey, index + (sideAt(e) === "after" ? 1 : 0));
            }
          : undefined
      }
    >
      {(canDrop || onDelete) && (
        // The step's quiet tool row, tucked INTO the card's top-right corner (white, corner-rounded
        // to nest the card's radius). Order: × · ⧉ · ⠿ — the grip rides the very corner. Sections
        // without drag (the Actions tab's step builder) still get the × here.
        <span className="step-shell__tools">
          {onDelete && (
            <span
              className="step-shell__del"
              title="Delete this step"
              onClick={() => onDelete(sectionKey, index)}
            >
              ×
            </span>
          )}
          {canDrop && onStepDuplicate && (
            <span
              className="step-shell__dup"
              title="Duplicate this step (lands right below)"
              onClick={() => onStepDuplicate(sectionKey, index)}
            >
              ⧉
            </span>
          )}
          {canDrop && (
            <span
              className={`step-shell__grip${isEvents ? " step-shell__grip--events" : ""}`}
              title={
                isEvents
                  ? "Drag to reorder this listener within Events"
                  : "Drag to move this step — within this section or into another"
              }
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData(mime, JSON.stringify({ key: sectionKey, index }));
              }}
            >
              ⠿
            </span>
          )}
        </span>
      )}
      {children}
    </div>
  );
}

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
  tagColor, // RFC-023 — default sections wear the indigo family; actions keep their plum default
  sectionKey, // RFC-023 — this section's key in the sections object (enables step drag/duplicate)
  onStepMove,
  onStepDuplicate,
  sectionDragKey, // RFC-023 — set = this SECTION is draggable (rearranges the run order; Main never is)
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
  const canDrop = !!(onStepMove && sectionKey);
  return (
    <section
      className={`${className}${!open ? ` ${className}--closed` : ""}`}
      // A COLLAPSED section is still a drop target — dropping on the block appends to its end.
      onDragOver={
        canDrop && !open
          ? (e) => {
              if ([...e.dataTransfer.types].includes(stepMime(sectionKey))) e.preventDefault();
            }
          : undefined
      }
      onDrop={
        canDrop && !open
          ? (e) => {
              e.preventDefault();
              try {
                const d = JSON.parse(e.dataTransfer.getData(stepMime(sectionKey)));
                if (d && d.key != null) onStepMove(d.key, d.index, sectionKey, TestSection.length);
              } catch {
                /* not a step drag */
              }
            }
          : undefined
      }
    >
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
                  {sectionTag && (
                    <span
                      className={`${className}__tag`}
                      style={tagColor ? { background: tagColor } : undefined}
                    >
                      {sectionTag}
                    </span>
                  )}
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
              {sectionDragKey && (
                <span
                  className={`${className}__sec-grip`}
                  title="Drag to rearrange this section"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData(
                      "application/x-sv-section",
                      JSON.stringify({ key: sectionDragKey }),
                    );
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  ⠿
                </span>
              )}
            </span>
          </>
        }
        title_color={titleColor || "#0d8065"}
      >
        <div
          className={`${className}__test-data${TestSection.length === 0 ? ` ${className}__test-data--empty` : ""}`}
        >
          {TestSection.length > 0 ? (
            TestSection.map((test, i) => (
              <StepShell
                key={i}
                sectionKey={sectionKey}
                index={i}
                onStepMove={canDrop ? onStepMove : undefined}
                onStepDuplicate={canDrop ? onStepDuplicate : undefined}
                onDelete={() => TestController.deleteTest(i)}
              >
                <TestContainer
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
              </StepShell>
            ))
          ) : canDrop ? (
            // Empty + droppable: the placeholder itself takes the drop (lands as the first step).
            <span
              className={`${className}__empty-drop`}
              onDragOver={(e) => {
                if ([...e.dataTransfer.types].includes(stepMime(sectionKey))) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                try {
                  const d = JSON.parse(e.dataTransfer.getData(stepMime(sectionKey)));
                  if (d && d.key != null) onStepMove(d.key, d.index, sectionKey, 0);
                } catch {
                  /* not a step drag */
                }
              }}
            >
              no actions — drag a step here
            </span>
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
