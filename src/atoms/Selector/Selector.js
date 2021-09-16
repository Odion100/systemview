import React from "react";
import "./styles.scss";

const Selector = ({
  options = [],
  values = [],
  selected_option,
  onSelect,
  className,
  controlledOption,
}) => {
  return (
    <select
      className={className}
      defaultValue={selected_option}
      onChange={onSelect}
      value={controlledOption}
    >
      {options.map((option, i) => (
        <option key={i} value={values[i]}>
          {option}
        </option>
      ))}
    </select>
  );
};

export default Selector;
