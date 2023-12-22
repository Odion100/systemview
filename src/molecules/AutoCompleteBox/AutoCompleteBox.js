import { useState, useEffect, useRef } from "react";
import "./styles.scss";

const AutoCompleteBox = ({
  suggestions,
  value = "",
  className,
  onSubmit,
  onChange,
  onBlur,
  disabled = false,
  placeholder,
  filterSuggestion = true,
  requireSelection = true,
}) => {
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [input, setInput] = useState(value);
  const inputRef = useRef(null);

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
      (!requireSelection &&
        unLinked.length <= 1 &&
        userInput.length > (unLinked[0] || "").length)
    )
      setShowSuggestions(false);
    else setShowSuggestions(true);
    if (typeof onChange === "function") onChange(e.target.value);
  };
  const completeSuggestion = (text) => {
    if (typeof onSubmit === "function") onSubmit(text);
    setFilteredSuggestions([]);
    setInput(text);
    setActiveSuggestionIndex(0);
    setShowSuggestions(false);
  };
  const onClick = (e) => {
    const text = e.target.innerText.substr(0, e.target.innerText.length);
    completeSuggestion(text);
  };
  const blur = (e) => {
    typeof onBlur === "function" && onBlur(e.target.value);
  };

  const onKeyDown = (event) => {
    if (event.keyCode === 13) {
      inputRef.current.blur();
      completeSuggestion(filteredSuggestions[activeSuggestionIndex]);
    }

    // Check if the Up arrow key is pressed
    if (event.keyCode === 40) {
      if (activeSuggestionIndex < filteredSuggestions.length - 1)
        setActiveSuggestionIndex(activeSuggestionIndex + 1);
    }

    // Check if the Down arrow key is pressed
    if (event.keyCode === 38) {
      if (activeSuggestionIndex) setActiveSuggestionIndex(activeSuggestionIndex - 1);
    }
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

  return (
    <div className="auto-complete">
      <input
        className={className + " auto-complete__input"}
        type="text"
        onChange={change}
        onKeyDown={onKeyDown}
        onBlur={blur}
        value={input}
        disabled={disabled}
        placeholder={placeholder}
        ref={inputRef}
      />
      {showSuggestions && input && <SuggestionsListComponent />}
    </div>
  );
};

export default AutoCompleteBox;
