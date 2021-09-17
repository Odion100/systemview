import React, { useState } from "react";
import Selector from "../../atoms/Selector/Selector";
import Toggle from "../../atoms/Toggle/Toggle";
import "./styles.scss";

const string = {
  options: ["Equals:", "Min Lenght:", "Max Length:", "Lenght Equals:", "Is Like:", "Is One Of:"],
  values: ["equals", "minLenght", "maxLength", "lengthEquals", "isLike", "isOneOf"],
  inputs: ["text", "number", "number", "number", "text", "text"],
};
const number = {
  options: ["Equals:", "Min:", "Max:", "Is One Of:"],
  values: ["equals", "min", "max", "isOneOf"],
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
const boolean = { options: ["Equals:"], values: ["equals"], inputs: ["toggle"] };
const object = { options: [], values: [], inputs: [] };
const options = { array, number, date, boolean, string, object };

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

export default ValidationInput;
