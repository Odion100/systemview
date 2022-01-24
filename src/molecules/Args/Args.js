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

const Args = ({ args, controller, test_index, data_type }) => {
  const classname = "args";
  const add = () => controller.addArg(test_index);

  return (
    <>
      {args.length > 0 ? (
        <div className={`${classname}`}>
          {args.map((arg, i) => (
            <ArgData
              key={i}
              arg={arg}
              test_index={test_index}
              i={i}
              classname={classname}
              controller={controller}
            />
          ))}
        </div>
      ) : (
        ""
      )}
      <span className={`${classname}__add-btn btn`} onClick={add}>
        +
      </span>
    </>
  );
};
const ArgData = ({ classname, arg, test_index, i, controller }) => {
  const { value, name, data_type, target_values } = arg;
  const [isOpen, setOpen] = useState(true);
  const showData = () => {
    console.log(arg);
    setOpen(!isOpen);
  };
  const changeType = (e) => {
    console.log(test_index, e.target.value);
    arg.data_type = e.target.value;
    switch (arg.data_type) {
      case "string":
        arg.value = "";
        break;
      case "number":
        arg.value = 0;
        break;
      case "date":
        arg.value = moment().toJSON();
        break;
      case "boolean":
        arg.value = false;
        break;
      case "array":
        arg.value = [];
        break;
      case "object":
        arg.value = {};
        break;
      case "undefined":
        arg.value = undefined;
        break;
      case "null":
        arg.value = null;
        break;
      case "target":
        if (target_values.length === 0) controller.addTargetValue(test_index, i, "");
        arg.value = "";

        break;

      default:
        break;
    }
    if (target_values.length > 0 && e.target.value !== "target")
      controller.deleteTargetValue(test_index, i, 0);
    controller.editArg(test_index, i, arg);
  };
  const deleteArg = () => {
    controller.deleteArg(test_index, i);
  };
  const is12 =
    data_type === "object" ||
    data_type === "array" ||
    data_type === "string" ||
    data_type === "date" ||
    data_type === "target";
  return !isOpen ? (
    <div className={`${classname}__name-display`}>
      <ArgName classname={classname} name={name} isOpen={isOpen} showData={showData} />
    </div>
  ) : (
    <div className={`${classname}__data container`} key={i}>
      <div className={`row no-gutters justify-content-start align-items-center`}>
        <div className={`col`}>
          <div className={`${classname}__from-container`}>
            <ArgName classname={classname} name={name} isOpen={isOpen} showData={showData} />
          </div>
        </div>
        <div className={`col`}>
          <div className={`${classname}__type`}>
            <TypeSelector default_type={data_type} onSelect={changeType} />
          </div>
        </div>
        <div className={`col${!is12 ? -0 : ""}`}></div>
        <div className={`col${is12 ? -12 : ""}`}>
          <ArgDataForm
            arg={arg}
            i={i}
            test_index={test_index}
            controller={controller}
            classname={classname}
            is12={is12}
          />
        </div>
      </div>

      <span className={`${classname}__data__delete-btn btn delete-btn`} onClick={deleteArg}>
        x
      </span>
    </div>
  );
};
const ArgName = ({ name, classname, isOpen, showData }) => {
  return (
    <div className={`${classname}__name`}>
      <ExpandableIcon isOpen={isOpen} classname={`${classname}__expand-btn`} onClick={showData} />{" "}
      <span className={`${classname}__name__text`}>{name + ""}</span>
    </div>
  );
};
const ArgDataForm = ({ arg, classname, test_index, i, controller, is12 }) => {
  const { value, name, data_type, target_values } = arg;
  const [jsonBoxVisible, setJsonBoxVisible] = useState(false);
  console.log(arg);
  const showJsonTxb = () => setJsonBoxVisible(true);
  const hideJsonTxb = () => setJsonBoxVisible(false);
  const inputChanged = (e) => {
    if (e.target.type === "number") arg.value = parseInt(e.target.value);
    else if (e.target.type === "checkbox") arg.value = e.target.checked;
    else arg.value = e.target.value;
    controller.editArg(test_index, i, arg);
  };
  const jsonTextboxSubmit = (new_object) => {
    console.log(new_object);
    arg.value = new_object;
    controller.editArg(test_index, i, arg);
    hideJsonTxb();
  };
  const jsonObjectSubmit = (e) => {
    jsonTextboxSubmit(e.updated_src || {});
    console.log("------------jjjjjjjsssssoooonnnn", e);
  };
  const textboxChanged = (e) => {
    adjustSize(e);
    inputChanged(e);
  };
  const adjustSize = (e) => {
    e.target.style.height = "inherit";
    e.target.style.height = `${e.target.scrollHeight - 15}px`;
  };
  return (
    <div className={`${classname}__form ${is12 ? classname + "__form--is12" : ""}`}>
      {data_type === "undefined" || data_type === "null" ? (
        <span className={`${classname}__form__${data_type}`}>{value + ""}</span>
      ) : data_type === "string" ? (
        <div className={`textbox`}>
          <textarea
            className={`${classname}__form__input ${classname}__form__input--${data_type}`}
            value={value}
            onChange={textboxChanged}
            onFocus={adjustSize}
          />
        </div>
      ) : data_type === "number" ? (
        <div className={`textbox`}>
          <input
            className={`${classname}__form__input ${classname}__form__input--${data_type}`}
            type={data_type}
            name="arg-input"
            autoComplete="off"
            value={value}
            onChange={inputChanged}
          />
        </div>
      ) : data_type === "boolean" ? (
        <>
          <Toggle isChecked={value} onChange={inputChanged} round={true} />{" "}
          <span
            className={`${classname}__form__value--boolean ${classname}__form__value--boolean--${value}`}
          >
            {(value === true) + ""}
          </span>
        </>
      ) : data_type === "date" ? (
        // <span className={`${classname}__form__${data_type}`}>{moment(value).format()}</span>
        <input
          className={`${classname}__form__input ${classname}__form__input--${data_type}`}
          type={"datetime-local"}
          name="arg-input"
          autoComplete="off"
          value={value}
          onChange={inputChanged}
        />
      ) : data_type === "object" ? (
        <span className={`${classname}__form__${data_type}`}>
          <div className={`${classname}__json-txb ${classname}__json-txb--show-${jsonBoxVisible}`}>
            <JsonTextBox onSubmit={jsonTextboxSubmit} onCancel={hideJsonTxb} obj={value} />
          </div>
          <ReactJson
            src={value}
            name={false}
            onAdd={jsonObjectSubmit}
            onEdit={jsonObjectSubmit}
            onDelete={jsonObjectSubmit}
            displayObjectSize={false}
            displayDataTypes={false}
            collapsed={true}
          />{" "}
          <span
            className={`${classname}__add-json-btn btn ${classname}__json-txb--show-${!jsonBoxVisible}`}
            onClick={showJsonTxb}
          >
            +JSON
          </span>
        </span>
      ) : data_type === "target" ? (
        <div className={`${classname}__form__${data_type}`}>
          <TargetSelector
            controller={controller}
            value={value}
            target_values={target_values[0]}
            test_index={test_index}
            arg_index={i}
            classname={`${classname}__form__input ${classname}__form__input--${data_type}`}
          />
          <ArgValue value={value} classname={`${classname}`} />
        </div>
      ) : (
        <span className={`${classname}__value`}>{value + ""}</span>
      )}
    </div>
  );
};

const ArgValue = ({ classname, value }) => {
  const data_type = getType(value);
  return (
    <div className={`${classname}__value`}>
      {data_type === "undefined" || data_type === "null" ? (
        <span className={`${classname}__value__${data_type}`}>{value + ""}</span>
      ) : data_type === "string" ? (
        <span className={`${classname}__value__${data_type}`}>{value + ""}</span>
      ) : data_type === "number" ? (
        <span className={`${classname}__value__${data_type}`}>{value + ""}</span>
      ) : data_type === "boolean" ? (
        <span
          className={`${classname}__value__${data_type} ${classname}__value__${data_type}--${
            value + ""
          }`}
        >
          {(value === true) + ""}
        </span>
      ) : data_type === "date" ? (
        <span className={`${classname}__value__${data_type}`}>{moment(value).format() + ""}</span>
      ) : data_type === "object" || data_type === "array" ? (
        <span className={`${classname}__value__${data_type}`}>
          <ReactJson
            src={value}
            name={false}
            displayObjectSize={false}
            displayDataTypes={false}
            collapsed={true}
          />{" "}
        </span>
      ) : (
        <span className={`${classname}__value__${data_type}`}>{value + ""}</span>
      )}
    </div>
  );
};

export default Args;
