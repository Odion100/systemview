import { useState, useEffect } from "react";
import "./styles.scss";

const AutoCompletBox = ({
  suggestions,
  value = "",
  className,
  onSubmit,
  disabled = false,
  placeholder,
}) => {
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [input, setInput] = useState(value);
  useEffect(() => setInput(value), [value]);
  const onChange = (e) => {
    const userInput = e.target.value;

    // Filter our suggestions that don't contain the user's input
    const unLinked = suggestions.filter(
      (suggestion) => suggestion.toLowerCase().indexOf(userInput.toLowerCase()) > -1
    );

    setInput(e.target.value);
    setFilteredSuggestions(unLinked);
    setActiveSuggestionIndex(0);
    setShowSuggestions(true);
  };
  const onClick = (e) => {
    const text = e.target.innerText.substr(0, e.target.innerText.length - 1);
    setFilteredSuggestions([]);
    setInput(text);
    setActiveSuggestionIndex(0);
    setShowSuggestions(false);
    if (typeof onSubmit === "function") onSubmit(text);
  };

  const SuggestionsListComponent = () => {
    return filteredSuggestions.length ? (
      <div className="auto-complete__suggestions">
        {filteredSuggestions.map((suggestion, index) => {
          let className;
          // Flag the active suggestion with a class

          className =
            index === activeSuggestionIndex
              ? "auto-complete__suggestion  auto-complete__suggestion--active"
              : "auto-complete__suggestion ";

          return (
            <span className={className} key={suggestion} onClick={onClick}>
              {suggestion}
            </span>
          );
        })}
      </div>
    ) : (
      <div className="auto-complete__suggestions">
        <div className="auto-complete__suggestion auto-complete__suggestion--empty">
          <em>no match</em>
        </div>
      </div>
    );
  };
  const onKeyDown = () => {};
  return (
    <div className="auto-complete">
      <input
        className={className + " auto-complete__input"}
        type="text"
        onChange={onChange}
        onKeyDown={onKeyDown}
        value={input}
        disabled={disabled}
        placeholder="service.module.method"
      />
      {showSuggestions && input && <SuggestionsListComponent />}
    </div>
  );
};

export default AutoCompletBox;
