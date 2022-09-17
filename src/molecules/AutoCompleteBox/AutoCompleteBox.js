import { useState, useEffect } from "react";
import "./styles.scss";

const AutoCompleteBox = ({
  suggestions,
  value = "",
  className,
  onSubmit,
  onChange,
  disabled = false,
  placeholder,
  filterSuggestion = true,
  requireSelection = true,
}) => {
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [input, setInput] = useState(value);
  useEffect(() => setInput(value), [value]);
  const change = (e) => {
    const userInput = e.target.value;

    // Filter our suggestions that don't contain the user's input
    const unLinked = filterSuggestion
      ? suggestions.filter(
          (suggestion) => suggestion.toLowerCase().indexOf(userInput.toLowerCase()) > -1
        )
      : suggestions;

    setInput(e.target.value);
    setFilteredSuggestions(unLinked);
    setActiveSuggestionIndex(0);

    if (
      (!requireSelection && unLinked.indexOf(userInput) > -1) ||
      (!requireSelection && unLinked.length <= 1 && userInput.length > (unLinked[0] || "").length)
    )
      setShowSuggestions(false);
    else setShowSuggestions(true);
    if (typeof onChange === "function") onChange(e.target.value);
  };
  const onClick = (e) => {
    const text = e.target.innerText.substr(0, e.target.innerText.length);
    if (typeof onSubmit === "function") onSubmit(text);
    setFilteredSuggestions([]);
    setInput(text);
    setActiveSuggestionIndex(0);
    setShowSuggestions(false);
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
        onChange={change}
        onKeyDown={onKeyDown}
        value={input}
        disabled={disabled}
        placeholder={placeholder}
      />
      {showSuggestions && input && <SuggestionsListComponent />}
    </div>
  );
};

export default AutoCompleteBox;
