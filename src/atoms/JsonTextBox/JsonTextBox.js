import React, { useState } from "react";
import "./styles.scss";

const JsonTextBox = ({ obj, onSubmit }) => {
  const prettyJson = JSON.stringify(obj, undefined, 2);
  const [isJson, setIsJson] = useState(!!obj);
  const [json, setJson] = useState(obj);

  const checkJsonString = (e) => {
    const str = e.target.value;
    try {
      JSON.parse(str);
    } catch (e) {
      setIsJson(false);
      return false;
    }
    setIsJson(true);
    setJson(JSON.parse(str));
    return true;
  };
  const submit = () => {
    if (isJson && typeof onSubmit === "function") onSubmit(json);
  };

  return (
    <div className="json-text-box">
      <textarea
        className={`json-text-box__textbox json-text-box__textbox--is-json-${isJson}`}
        name="json-text-box"
        id="json-text-box"
        defaultValue={prettyJson}
        onChange={checkJsonString}
      ></textarea>
      <span
        onClick={submit}
        className={`json-text-box__is-json-msg json-text-box__is-json-msg--${isJson}`}
      >
        {isJson ? "save" : "insert json"}
      </span>
    </div>
  );
};

export default JsonTextBox;
