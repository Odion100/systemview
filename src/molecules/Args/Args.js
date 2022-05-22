import React, { useState } from "react";
import moment from "moment";
import ReactJson from "react-json-view";
import JsonTextBox from "../../atoms/JsonTextBox/JsonTextBox";
import ExpandableIcon from "../../atoms/ExpandableIcon/ExpandableIcon";
import TypeSelector from "../../atoms/TypeSelector/TypeSelector";
import TargetSelector from "../TargetSelector/TargetSelector";
import Toggle from "../../atoms/Toggle/Toggle";
import { getType } from "../ValidationInput/validations";
import "./styles.scss";

const Args = ({ args, controller, test_index, input_type }) => {
  const className = "args";
  const add = () => controller.addArg(test_index);

  return (
    <>
      {args.length > 0 ? (
        <div className={`${className}`}>
          {args.map((arg, i) => (
            <ArgData
              key={i}
              arg={arg}
              test_index={test_index}
              i={i}
              className={className}
              controller={controller}
            />
          ))}
        </div>
      ) : (
        ""
      )}
      <span className={`${className}__add-btn btn`} onClick={add}>
        +
      </span>
    </>
  );
};
const ArgData = ({ className, arg, test_index, i, controller }) => {
  const { name, input_type, targetValues } = arg;
  const [isOpen, setOpen] = useState(true);
  const showData = () => {
    console.log(arg);
    setOpen(!isOpen);
  };
  const changeType = (e) => {
    console.log(test_index, e.target.value);
    arg.input_type = e.target.value;
    switch (arg.input_type) {
      case "string":
        arg.input = "";
        break;
      case "number":
        arg.input = 0;
        break;
      case "date":
        arg.input = moment().toJSON();
        break;
      case "boolean":
        arg.input = false;
        break;
      case "array":
        arg.input = [];
        break;
      case "object":
        arg.input = {};
        break;
      case "undefined":
        arg.input = undefined;
        break;
      case "null":
        arg.input = null;
        break;
      case "target":
        if (targetValues.length === 0) controller.addTargetValue(test_index, i, "");
        arg.input = "";

        break;

      default:
        break;
    }
    if (targetValues.length > 0 && e.target.value !== "target")
      controller.deleteTargetValue(test_index, i, 0);
    controller.editArg(test_index, i, arg);
  };
  const deleteArg = () => {
    controller.deleteArg(test_index, i);
  };
  const is12 =
    input_type === "object" ||
    input_type === "array" ||
    input_type === "string" ||
    input_type === "date" ||
    input_type === "target";
  return !isOpen ? (
    <div className={`${className}__name-display`}>
      <ArgName className={className} name={name} isOpen={isOpen} showData={showData} />
    </div>
  ) : (
    <div className={`${className}__data container`} key={i}>
      <div className={`row no-gutters justify-content-start align-items-center`}>
        <div className={`col`}>
          <div className={`${className}__from-container`}>
            <ArgName className={className} name={name} isOpen={isOpen} showData={showData} />
          </div>
        </div>
        <div className={`col`}>
          <div className={`${className}__type`}>
            <TypeSelector default_type={input_type} onSelect={changeType} />
          </div>
        </div>
        <div className={`col${!is12 ? -0 : ""}`}></div>
        <div className={`col${is12 ? -12 : ""}`}>
          <ArgDataForm
            arg={arg}
            i={i}
            test_index={test_index}
            controller={controller}
            className={className}
            is12={is12}
          />
        </div>
      </div>

      <span className={`${className}__data__delete-btn btn delete-btn`} onClick={deleteArg}>
        x
      </span>
    </div>
  );
};
const ArgName = ({ name, className, isOpen, showData }) => {
  return (
    <div className={`${className}__name`}>
      <ExpandableIcon isOpen={isOpen} ClassName={`${className}__expand-btn`} onClick={showData} />{" "}
      <span className={`${className}__name__text`}>{name + ""}</span>
    </div>
  );
};
const ArgDataForm = ({ arg, className, test_index, i, controller, is12 }) => {
  const { input, value, input_type, targetValues } = arg;
  const [jsonBoxVisible, setJsonBoxVisible] = useState(false);
  console.log(arg);
  const showJsonTxb = () => setJsonBoxVisible(true);
  const hideJsonTxb = () => setJsonBoxVisible(false);
  const inputChanged = (e) => {
    if (e.target.type === "number") arg.input = parseInt(e.target.value);
    else if (e.target.type === "checkbox") arg.input = e.target.checked;
    else arg.input = e.target.value;
    controller.editArg(test_index, i, arg);
  };
  const jsonTextboxSubmit = (new_object) => {
    console.log(new_object);
    arg.input = new_object;
    controller.editArg(test_index, i, arg);
    hideJsonTxb();
  };
  const jsonObjectSubmit = ({ updated_src, namespace, name, new_value }) => {
    jsonTextboxSubmit(updated_src || {});
    const source_map = namespace;
    source_map.push(name);
    source_map.upshift("value");
    controller.parseTargetValues(test_index, i, new_value, source_map);
    controller.checkTargetValues(test_index, i, new_value, source_map);
  };

  const adjustSize = (e) => {
    e.target.style.height = "inherit";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const textboxChanged = (e) => {
    adjustSize(e);
    inputChanged(e);
    controller.checkTargetValues(test_index, i, e.target.value, ["value"]);
    controller.parseTargetValues(test_index, i, e.target.value, ["value"]);
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
          <ArgValue value={value} className={`${className}`} />
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
        <>
          <Toggle isChecked={input} onChange={inputChanged} round={true} />{" "}
          <span
            className={`${className}__form__value--boolean ${className}__form__value--boolean--${input}`}
          >
            {(input === true) + ""}
          </span>
        </>
      ) : input_type === "date" ? (
        // <span className={`${className}__form__${input_type}`}>{moment(value).format()}</span>
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
          <div className={`${className}__json-txb ${className}__json-txb--show-${jsonBoxVisible}`}>
            <JsonTextBox onSubmit={jsonTextboxSubmit} onCancel={hideJsonTxb} obj={input} />
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
          <ArgValue value={value} className={`${className}`} />
          <span
            className={`${className}__add-json-btn btn ${className}__json-txb--show-${!jsonBoxVisible}`}
            onClick={showJsonTxb}
          >
            +JSON
          </span>
        </span>
      ) : input_type === "target" ? (
        <div className={`${className}__form__${input_type}`}>
          <TargetSelector
            controller={controller}
            target_namespace={targetValues[0].target_namespace}
            test_index={test_index}
            arg_index={i}
            target_index={0}
            className={`${className}__form__input ${className}__form__input--${input_type}`}
          />
          <ArgValue value={value} className={`${className}`} />
        </div>
      ) : (
        <span className={`${className}__value`}>{input + ""}</span>
      )}
    </div>
  );
};

const ArgValue = ({ className, value }) => {
  const data_type = getType(value);
  return (
    <div className={`${className}__value`}>
      {data_type === "undefined" || data_type === "null" ? (
        <span className={`${className}__value__${data_type}`}>{value + ""}</span>
      ) : data_type === "string" ? (
        <span className={`${className}__value__${data_type}`}>{value + ""}</span>
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
        <span className={`${className}__value__${data_type}`}>{moment(value).format() + ""}</span>
      ) : data_type === "object" || data_type === "array" ? (
        <span className={`${className}__value__${data_type}`}>
          <ReactJson
            src={value}
            name={false}
            displayObjectSize={false}
            displayDataTypes={false}
            collapsed={true}
          />{" "}
        </span>
      ) : (
        <span className={`${className}__value__${data_type}`}>{value + ""}</span>
      )}
    </div>
  );
};

export default Args;
