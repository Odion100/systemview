import React from "react";
import AutoCompleteBox from "../AutoCompleteBox/AutoCompleteBox";
import "./styles.scss";

const TargetSelector = ({
  controller,
  target_namespace,
  testIndex,
  arg_index,
  className,
  target_index,
}) => {
  const submit = (value) => {
    controller.setTargetValue(testIndex, arg_index, target_index, value, ["input"], 0);
  };
  //gather suggestions
  //create a onchange fn to update target value as user types
  //submit fn should fill text box (already automatic) and then update target value
  return (
    <div className={`target-selector`}>
      <AutoCompleteBox
        className={`target-selector__auto-complete ${className}`}
        suggestions={controller.getTargetSuggestions(testIndex)}
        onSubmit={submit}
        onChange={submit}
        value={target_namespace}
        placeholder={"beforeTest.Action1.results..."}
        requireSelection={false}
      />
    </div>
  );
};

export default TargetSelector;
