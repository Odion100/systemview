import React from "react";
import AutoCompletBox from "../AutoCompleteBox/AutoCompleteBox";
import ReactJson from "react-json-view";
import { getType } from "../ValidationInput/validations";
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
  const cn = "target-selector";
  return (
    <div className={`${cn}`}>
      <AutoCompletBox
        classname={`${cn}__auto-complete ${classname}`}
        suggestions={controller.getTargetSuggestions(test_index)}
        onSubmit={submit}
        onChange={submit}
        value={target_value}
        placeholder={"beforeTest.Action1.results..."}
        requireSelection={false}
      />

      <div className="row">
        <TargetValue cn={cn} classname={"classname"} value={value} />
      </div>
    </div>
  );
};

const TargetValue = ({ classname, value, cn }) => {
  const data_type = getType(value);
  return (
    <div className={`${cn}__value`}>
      {data_type === "undefined" || data_type === "null" ? (
        <span className={`${cn}__form__${data_type}`}>{value + ""}</span>
      ) : data_type === "string" || data_type === "number" ? (
        <div className={`textbox`}></div>
      ) : data_type === "boolean" ? (
        <></>
      ) : data_type === "date" ? (
        <span></span>
      ) : data_type === "object" || data_type === "array" ? (
        <span className={`${cn}__form__${data_type}`}>
          <ReactJson
            src={value}
            name={false}
            displayObjectSize={false}
            displayDataTypes={false}
            collapsed={true}
          />{" "}
        </span>
      ) : data_type === "target" ? (
        true
      ) : (
        <span className={`${cn}__value__${data_type}`}>{value + ""}</span>
      )}
    </div>
  );
};

export default TargetSelector;
