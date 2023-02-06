import React, { useState } from "react";
import moment from "moment";
import ReactJson from "react-json-view";
import JsonTextBox from "../../atoms/JsonTextBox/JsonTextBox";
import ExpandableIcon from "../../atoms/ExpandableIcon/ExpandableIcon";
import TypeSelector from "../../atoms/TypeSelector/TypeSelector";
import TargetSelector from "../TargetSelector/TargetSelector";
import Toggle from "../../atoms/Toggle/Toggle";
import { getType, defaultValue } from "../ValidationInput/validator";
import "./styles.scss";
const className = "args";
const Args = ({ args, controller, testIndex, locked }) => {
  const add = () => controller.addArg(testIndex);

  return (
    <>
      {args.length > 0 ? (
        <div className={`${className}`}>
          {args.map((arg, i) => (
            <ArgData
              key={i}
              arg={arg}
              testIndex={testIndex}
              i={i}
              controller={controller}
              locked={locked}
            />
          ))}
        </div>
      ) : (
        ""
      )}
      {locked ? (
        ""
      ) : (
        <span className={`${className}__add-btn btn`} onClick={add}>
          +
        </span>
      )}
    </>
  );
};
const ArgData = ({ arg, testIndex, i, controller, locked }) => {
  const { name, input_type } = arg;
  const [isOpen, setOpen] = useState(true);
  const showData = () => {
    setOpen(!isOpen);
  };
  const inputTypeChanged = (e) => {
    arg.input_type = e.target.value;
    arg.input = defaultValue(arg.input_type);
    controller.checkTargetValues(testIndex, i, 0);
    if (arg.input_type === "target")
      controller.addTargetValue(testIndex, i, "", ["input"], 0);
    controller.editArg(testIndex, i, arg);
  };

  const deleteArg = () => {
    controller.deleteArg(testIndex, i);
  };

  const is12 =
    input_type === "object" ||
    input_type === "array" ||
    input_type === "string" ||
    input_type === "date" ||
    input_type === "target";
  return !isOpen ? (
    <div className={`${className}__name-display`}>
      <ArgName name={name} isOpen={isOpen} showData={showData} />
    </div>
  ) : (
    <div className={`${className}__data container`} key={i}>
      <div className={`row no-gutters justify-content-start align-items-center`}>
        <div className={`col`}>
          <div className={`${className}__from-container`}>
            <ArgName name={name} isOpen={isOpen} showData={showData} />
          </div>
        </div>
        <div className={`col`}>
          <div className={`${className}__type`}>
            <TypeSelector default_type={input_type} onSelect={inputTypeChanged} />
          </div>
        </div>
        <div className={`col${!is12 ? -0 : ""}`}></div>
        <div className={`col${is12 ? -12 : ""}`}>
          <ArgDataForm
            arg={arg}
            i={i}
            testIndex={testIndex}
            controller={controller}
            is12={is12}
          />
        </div>
      </div>
      {locked ? (
        ""
      ) : (
        <span
          className={`${className}__data__delete-btn btn delete-btn`}
          onClick={deleteArg}
        >
          x
        </span>
      )}
    </div>
  );
};
const ArgName = ({ name, isOpen, showData }) => {
  return (
    <div className={`${className}__name`}>
      <ExpandableIcon
        isOpen={isOpen}
        ClassName={`${className}__expand-btn`}
        onClick={showData}
      />{" "}
      <span className={`${className}__name__text`}>{name + ""}</span>
    </div>
  );
};
const ArgDataForm = ({ arg, testIndex, i, controller, is12 }) => {
  const { input, input_type, targetValues } = arg;
  const [jsonBoxVisible, setJsonBoxVisible] = useState(false);
  const showJsonTxb = () => setJsonBoxVisible(true);
  const hideJsonTxb = () => setJsonBoxVisible(false);
  const inputChanged = (e) => {
    if (e.target.type === "number") arg.input = parseInt(e.target.value);
    else if (e.target.type === "checkbox") arg.input = e.target.checked;
    else arg.input = e.target.value;
    controller.editArg(testIndex, i, arg);
  };
  const jsonTextboxSubmit = (new_object) => {
    arg.input = new_object;
    controller.editArg(testIndex, i, arg);
    controller.checkTargetValues(testIndex, i);
    hideJsonTxb();
  };
  const jsonObjectSubmit = ({ updated_src, namespace, name, new_value }) => {
    jsonTextboxSubmit(updated_src || {});
    const source_map = namespace;
    source_map.push(name);
    source_map.unshift("input");
    if (typeof new_value === "string")
      controller.parseTargetValues(testIndex, i, new_value, source_map);
    else controller.checkTargetValues(testIndex, i);
  };

  const adjustSize = (e) => {
    const new_lines = e.target.value.length / 38;
    const new_height = Math.min(33 + new_lines * 18, 320);
    e.target.style.height = `${new_height}px`;
  };

  const textboxChanged = (e) => {
    adjustSize(e);
    inputChanged(e);
    controller.parseTargetValues(testIndex, i, e.target.value, ["input"]);
  };
  return (
    <div className={`${className}__form ${is12 ? className + "__form--is12" : ""}`}>
      {input_type === "undefined" || input_type === "null" ? (
        <span className={`${className}__form__${input_type}`}>{input + ""}</span>
      ) : input_type === "string" ? (
        <div className={`textbox`}>
          <textarea
            className={`${className}__form__input ${className}__form__input--${input_type}`}
            value={input}
            onChange={textboxChanged}
            onFocus={adjustSize}
          />
          <ArgValue value={arg.value()} hide={!targetValues.length} />
        </div>
      ) : input_type === "number" ? (
        <div className={`textbox`}>
          <input
            className={`${className}__form__input ${className}__form__input--${input_type}`}
            type={input_type}
            name="arg-input"
            autoComplete="off"
            value={input}
            onChange={inputChanged}
          />
        </div>
      ) : input_type === "boolean" ? (
        <div className="row justify-content-around">
          <Toggle isChecked={input} onChange={inputChanged} round={true} />{" "}
          <span
            className={`${className}__form__value--boolean ${className}__form__value--boolean--${input}`}
          >
            {(input === true) + ""}
          </span>
        </div>
      ) : input_type === "date" ? (
        <input
          className={`${className}__form__input ${className}__form__input--${input_type}`}
          type={"datetime-local"}
          name="arg-input"
          autoComplete="off"
          value={input}
          onChange={inputChanged}
        />
      ) : input_type === "object" ? (
        <span className={`${className}__form__${input_type}`}>
          <div
            className={`${className}__json-txb ${className}__json-txb--show-${jsonBoxVisible}`}
          >
            <JsonTextBox
              onSubmit={jsonTextboxSubmit}
              onCancel={hideJsonTxb}
              obj={input}
            />
          </div>
          <ReactJson
            src={input}
            name={false}
            onAdd={jsonObjectSubmit}
            onEdit={jsonObjectSubmit}
            onDelete={jsonObjectSubmit}
            displayObjectSize={false}
            displayDataTypes={false}
            collapsed={true}
          />
          <ArgValue value={arg.value()} hide={!targetValues.length} />
          <span
            className={`${className}__add-json-btn btn ${className}__json-txb--show-${!jsonBoxVisible}`}
            onClick={showJsonTxb}
          >
            +JSON
          </span>
        </span>
      ) : input_type === "target" ? (
        ((value) => (
          <div className={`${className}__form__${input_type}`}>
            <TargetSelector
              controller={controller}
              target_namespace={targetValues[0].target_namespace}
              testIndex={testIndex}
              arg_index={i}
              target_index={0}
              className={`${className}__form__input ${className}__form__input--${input_type}`}
            />
            <ArgValue value={value} hide={!targetValues.length} />
          </div>
        ))(arg.value())
      ) : (
        <span className={`${className}__value`}>{input + ""}</span>
      )}
    </div>
  );
};

export function Argument({ value }) {
  const data_type = getType(value);
  return (
    <>
      {data_type === "undefined" || data_type === "null" ? (
        <span className={`${className}__value__${data_type}`}>{value + ""}</span>
      ) : data_type === "string" ? (
        <span className={`${className}__value__${data_type}`}>
          <span className={`${className}__quote`}>"</span>
          {value}
          <span className={`${className}__quote`}>"</span>
        </span>
      ) : data_type === "number" ? (
        <span className={`${className}__value__${data_type}`}>{value + ""}</span>
      ) : data_type === "boolean" ? (
        <span
          className={`${className}__value__${data_type} ${className}__value__${data_type}--${
            value + ""
          }`}
        >
          {(value === true) + ""}
        </span>
      ) : data_type === "date" ? (
        <span className={`${className}__value__${data_type}`}>
          {moment(value).format() + ""}
        </span>
      ) : data_type === "object" || data_type === "array" ? (
        <span className={`${className}__value__${data_type}`}>
          <ReactJson
            src={value}
            name={false}
            displayObjectSize={false}
            displayDataTypes={false}
            collapsed={true}
          />
        </span>
      ) : (
        <span className={`${className}__value__${data_type}`}>{value + ""}</span>
      )}
    </>
  );
}
const ArgValue = (props) => {
  return (
    <div className={`${className}__value ${props.hide && className + "__value--hide"}`}>
      <Argument {...props} />
    </div>
  );
};

export default Args;
