import React from "react";
import AutoCompleteBox from "../AutoCompleteBox/AutoCompleteBox";
import "./styles.scss";

const TargetSelector = ({
  controller,
  target_namespace,
  test_index,
  arg_index,
  className,
  target_index,
}) => {
  const submit = (value) => {
    controller.setTargetValue(test_index, arg_index, target_index, value, ["input"], 0);
  };
  //gather suggestions
  //create a onchange fn to update target value as user types
  //submit fn should fill text box (already automatic) and then update target value
  return (
    <div className={`target-selector`}>
      <AutoCompleteBox
        className={`target-selector__auto-complete ${className}`}
        suggestions={controller.getTargetSuggestions(test_index)}
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
