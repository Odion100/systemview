import React, { useState } from "react";
import moment from "moment";
import ReactJson from "react-json-view";
import JsonTextBox from "../../atoms/JsonTextBox/JsonTextBox";
import ExpandableIcon from "../../atoms/ExpandableIcon/ExpandableIcon";
import TypeSelector from "../../atoms/TypeSelector/TypeSelector";
import Toggle from "../../atoms/Toggle/Toggle";
import "./styles.scss";

const Args = ({ args, addArg, test_index, data_type }) => {
  const classname = "args";
  console.log(args);
  const add = () => addArg(test_index);

  return (
    <div className={`${classname}`}>
      {args.map((arg, i) => (
        <ArgData key={i} arg={arg} test_index={test_index} i={i} classname={classname} />
      ))}
      <span className={`${classname}__add-btn btn`} onClick={add}>
        +
      </span>
    </div>
  );
};
const ArgData = ({ classname, arg, test_index, i }) => {
  const changeType = (test_index, arg_index, e) => console.log(test_index, arg_index, e);
  const { value, name, data_type, target_value } = arg;
  const [isOpen, setOpen] = useState(false);
  const showData = () => {
    console.log(arg);
    setOpen(!isOpen);
  };
  return !isOpen ? (
    <div className={`${classname}__name-display`}>
      <ArgName classname={classname} name={name} isOpen={isOpen} showData={showData} />
    </div>
  ) : (
    <div className={`${classname}__data container`} key={i}>
      <div className={`row no-gutters justify-content-start`}>
        <div className={`col`}>
          <div className={`${classname}__from-container`}>
            <ArgName classname={classname} name={name} isOpen={isOpen} showData={showData} />
          </div>
        </div>
        <div className={`col`}>
          <div className={`${classname}__type`}>
            <TypeSelector
              default_type={data_type}
              onSelect={changeType.bind(this, test_index, i)}
            />
          </div>
        </div>
        <div className={`col`}>
          <ArgDataForm
            value={value}
            name={name}
            data_type={"string"}
            target_value={target_value}
            classname={classname}
          />
        </div>
      </div>
    </div>
  );
};
const ArgName = ({ name, classname, isOpen, showData }) => {
  return (
    <div className={`${classname}__name`}>
      <ExpandableIcon isOpen={isOpen} classname={`${classname}__expand-btn`} submit={showData} />{" "}
      <span className={`${classname}__name__text`}>{name + ""}</span>
    </div>
  );
};
const ArgDataForm = ({ value, name, data_type, target_value, classname }) => {
  const inputChanged = (e) => {
    // if (e.target.type === "number") onInputChanged(parseInt(e.target.value));
    // else if (e.target.type === "checkbox") onInputChanged(e.target.checked);
    // else onInputChanged(e.target.value);
  };
  return (
    <div className={`${classname}__form`}>
      {data_type === "undefined" || data_type === "null" ? (
        <span className={`${classname}__form__${data_type}`}>Select a valid type.</span>
      ) : data_type === "string" || data_type === "number" ? (
        <input
          className={`${classname}__form__input`}
          type={data_type}
          name="arg-input"
          autoComplete="off"
          value={value}
          onChange={inputChanged}
        />
      ) : data_type === "boolean" ? (
        <Toggle isChecked={value} onChange={inputChanged} />
      ) : data_type === "date" ? (
        <span className={`${classname}__form__${data_type}`}>{moment(value).format()}</span>
      ) : data_type === "object" || data_type === "array" ? (
        <span className={`${classname}__form__${data_type}`}>
          <ReactJson
            src={value}
            name={data_type}
            displayObjectSize={false}
            displayDataTypes={false}
            collapsed={true}
          />
        </span>
      ) : (
        <span className={`${classname}__value__${data_type}`}>{value + ""}</span>
      )}
    </div>
  );
};
const ArgValue = ({ value, data_type, classname }) => {
  return (
    <div className={`${classname}__value`}>
      {data_type === "undefined" || data_type === "null" ? (
        <span className={`${classname}__value__${data_type}`}>{value + ""}</span>
      ) : data_type === "number" || data_type === "boolean" || data_type === "string" ? (
        <span className={`${classname}__value__${data_type}`}>{value}</span>
      ) : data_type === "date" ? (
        <span className={`${classname}__value__${data_type}`}>{moment(value).format()}</span>
      ) : data_type === "object" || data_type === "array" ? (
        <span className={`${classname}__value__${data_type}`}>
          <ReactJson
            src={value}
            name={data_type}
            displayObjectSize={false}
            displayDataTypes={false}
            collapsed={true}
          />
        </span>
      ) : (
        <span className={`${classname}__value__${data_type}`}>{value + ""}</span>
      )}
    </div>
  );
};
export default Args;
