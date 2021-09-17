import React, { useState, useEffect } from "react";
import Selector from "../../atoms/Selector/Selector";
import Toggle from "../../atoms/Toggle/Toggle";
import "./styles.scss";

const ValidationInput = ({ type, name, value, className = "", onSelect, onInputChanged }) => {
  const [inputType, setType] = useState(options[type].inputs[0]);
  const select = (e) => {
    const validation_type = e.target.value;
    const i = options[type].values.findIndex((v) => v === validation_type);
    setType(options[type].inputs[i]);

    onSelect(e.target.value);
  };
  const inputChanged = (e) => {
    if (e.target.type === "number") onInputChanged(parseInt(e.target.value));
    else if (e.target.type === "checkbox") onInputChanged(e.target.checked);
    else onInputChanged(e.target.value);
  };

  return (
    <div className={`validation-input ${className}`}>
      <Selector
        className="validation-input__selector"
        options={options[type].options}
        values={options[type].values}
        controlledOption={name}
        onSelect={select}
      />
      {type !== "boolean" ? (
        <input
          className="validation-input__input"
          type={inputType}
          name="validtion-input"
          autoComplete="off"
          value={value}
          onChange={inputChanged}
        />
      ) : (
        <Toggle isChecked={value} onChange={inputChanged} />
      )}
    </div>
  );
};

const string = {
  options: ["Equals:", "Min Lenght:", "Max Length:", "Lenght Equals:", "Is Like:", "Is One Of:"],
  values: ["strEquals", "minLength", "maxLength", "lengthEquals", "isLike", "isOneOf"],
  inputs: ["text", "number", "number", "number", "text", "text"],
};
const number = {
  options: ["Equals:", "Min:", "Max:", "Is One Of:"],
  values: ["numEquals", "min", "max", "isOneOf"],
  inputs: ["number", "number", "number", "text"],
};
const array = {
  options: ["Min Lenght:", "Max Length:", "Lenght Equals:", "Includes:"],
  values: ["minLength", "maxLength", "lengthEquals", "includes"],
  inputs: ["number", "number", "number", "text"],
};
const date = {
  options: ["Equals:", "Min:", "Max:"],
  values: ["dateEquals", "minDate", "maxDate"],
  inputs: ["datetime-local", "datetime-local", "datetime-local"],
};
const boolean = { options: ["Equals:"], values: ["boolEquals"], inputs: ["toggle"] };
const object = { options: [], values: [], inputs: [] };
const mixed = {
  options: [
    //string
    "Equals (str):",
    "Min Lenght (str):",
    "Max Length (str):",
    "Lenght Equals (str):",
    "Is Like:",
    "Is One Of (str):",
    //number
    "Equals (num):",
    "Min:",
    "Max:",
    "Is One Of (num):",
    //array
    "Min Lenght (arr):",
    "Max Length (arr):",
    "Lenght Equals (arr):",
    "Includes:",
    //date
    "Date Equals:",
    "Min Date:",
    "Max Date:",
    //boolean
    "Equals (bool)",
  ],
  values: [
    //string
    "strEquals",
    "minLength",
    "maxLength",
    "lengthEquals",
    "isLike",
    "isOneOf",
    //number
    "numEquals",
    "min",
    "max",
    "isOneOf",
    //array
    "minLength",
    "maxLength",
    "lengthEquals",
    "includes",
    //date
    "dateEquals",
    "minDate",
    "maxDate",
    //boolean
    "boolEquals",
  ],
  inputs: [
    //string
    "text",
    "number",
    "number",
    "number",
    //number
    "text",
    "text",
    "number",
    "number",
    "number",
    "text",
    //array
    "number",
    "number",
    "number",
    "text",
    //date
    "datetime-local",
    "datetime-local",
    "datetime-local",
    "toggle",
  ],
};
const options = { array, number, date, boolean, string, object, mixed };

export default ValidationInput;
