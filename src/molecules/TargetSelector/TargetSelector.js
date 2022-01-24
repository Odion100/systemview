import React from "react";
import AutoCompletBox from "../AutoCompleteBox/AutoCompleteBox";
import "./styles.scss";

const TargetSelector = ({
  controller,
  value,
  target_value,
  test_index,
  arg_index,
  target_index,
  classname,
}) => {
  const submit = (value) => {
    controller.setTargetValue(test_index, arg_index, target_index, value);
  };

  //gather suggestions
  //create a onchange fn to update target value as user types
  //submit fn should fill text box (already automatic) and then update tartet value
  const className = "target-selector";
  return (
    <div className={`${className}`}>
      <AutoCompletBox
        classname={`${className}__auto-complete ${classname}`}
        suggestions={controller.getTargetSuggestions(test_index)}
        onSubmit={submit}
        onChange={submit}
        value={target_value}
        placeholder={"beforeTest.Action1.results..."}
        requireSelection={false}
      />
    </div>
  );
};

export default TargetSelector;
