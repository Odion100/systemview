import React, { useState } from "react";
import Selector from "../../atoms/Selector/Selector";
import "./styles.scss";

const string = {
  option: ["Equals:", "Min Lenght:", "Max Length:", "Lenght Equals:", "Is Like:", "Is One Of:"],
  values: ["equals", "minLenght", "maxLength", "lengthEquals", "isLike", "isOneOf"],
};
const number = {
  options: ["Equals:", "Min:", "Max:", "Is One Of:"],
  values: ["equals", "min", "max", "isOneOf"],
};
const array = {
  options: ["Min Lenght:", "Max Length:", "Lenght Equals:", "Includes:"],
  values: ["minLength", "maxLength", "lengthEquals", "includes"],
};
const date = number;
const boolean = { options: ["Equals:"], values: ["equals"] };
const options = { array, number, date, boolean, string };

const ValidationInput = ({ type, name, value, className = "", onSelect, onInputChanged }) => {
  const select = (e) => onSelect(e.target.value);
  const inputChanged = (e) => onInputChanged(e.target.value);
  return (
    <div className={`validation-input ${className}`}>
      <Selector
        className="validation-input__selector"
        options={options[type].options}
        values={options[type].values}
        controlledOption={name}
        onSelect={select}
      />
      <input
        className="validation-input__input"
        type="text"
        name="validtion-input"
        autoComplete="off"
        value={value}
        onChange={inputChanged}
      />
    </div>
  );
};

export default ValidationInput;
