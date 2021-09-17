import React, { useState } from "react";
import Selector from "../../atoms/Selector/Selector";
import Toggle from "../../atoms/Toggle/Toggle";
import options from "./ValidationOptions";
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

export default ValidationInput;
