import React, { useState } from "react";
import Count from "../../atoms/Count";
import ExpandableSection from "../ExpandableSection/ExpandableSection";
import TestCaption from "../TestCaption/TestCaption";
import CHECK from "../../assets/check.svg";
import ERROR from "../../assets/error.svg";
import "./styles.scss";
import ExpandIcon from "../../atoms/ExpandableIcon/ExpandableIcon";

const CLASS_NAME = "test-summary";
export default function TestSummary({ tests = [] }) {
  const [open, setOpen] = useState(false);

  const toggleExpansion = () => {
    setOpen((state) => !state);
  };

  return (
    <ExpandableSection
      toggleExpansion={toggleExpansion}
      open={open}
      title={
        <span>
          <TestCaption
            caption={
              <span>
                {"Before Test"}:
                <Count count={4} stat="actions" />
                <Count count={41} stat="validations" />
                <Count count={4} stat="errors" type={"error"} />
              </span>
            }
          />
        </span>
      }
      title_color="#0d8065"
    >
      <Action title={"Create a new user"} />
      <Action title={"Create another user"} />
      <Action title={"Create create invite from first user to the second user"} />
    </ExpandableSection>
  );
}
function Action({ title, errors = [] }) {
  const [open, setOpen] = useState(false);

  const toggleExpansion = () => {
    setOpen((state) => !state);
  };

  return (
    <div className={`${CLASS_NAME}__actions row justify-content-between`}>
      <span className={`${CLASS_NAME}__action-text`}>
        <ExpandIcon onClick={toggleExpansion} isOpen={open} /> {title}
      </span>
      {errors.length ? (
        <img src={ERROR} alt="check" style={{ width: "18px" }} />
      ) : (
        <img src={CHECK} alt="check" style={{ width: "18px" }} />
      )}
    </div>
  );
}
