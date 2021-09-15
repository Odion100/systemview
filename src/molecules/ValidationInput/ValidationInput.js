import React, { useState } from "react";
import Selector from "../../atoms/Selector/Selector";
import "./styles.scss";

const string = [
  "Equals:",
  "Min Lenght:",
  "Max Length:",
  "Lenght Equals:",
  "Is Like:",
  "Is One Of:",
];
const array = ["Min Lenght:", "Max Length:", "Lenght Equals:", "Includes:"];
const number = ["Equals:", "Min:", "Max:", "Is One Of:"];
const date = number;
const boolean = ["Equals:"];

const ValidationInput = ({ type, default_selection }) => {
  const [selected_opt, setSelected] = useState(default_selection);
  const options = { array, number, date, boolean, string };

  return (
    <div className="validation-input">
      <Selector className="validation-input__selector" options={options[type]} />
      <input
        className="validation-input__input"
        type="text"
        name="validtion-input"
        autoComplete="off"
      />
    </div>
  );
};

export default ValidationInput;
