import React, { useState } from "react";
import "./styles.scss";

const JsonTextBox = ({ obj, onSubmit, onCancel }) => {
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
  const cancel = () => {
    setIsJson(false);
    setJson(undefined);
    if (typeof onCancel === "function") onCancel();
  };

  return (
    <div className="json-text-box">
      <div className="json-text-box__background-overlay"></div>
      <textarea
        className={`json-text-box__textbox json-text-box__textbox--is-json-${isJson}`}
        name="json-text-box"
        id="json-text-box"
        defaultValue={prettyJson}
        onChange={checkJsonString}
      ></textarea>
      <div className="json-text-box__btn-container">
        <span
          onClick={submit}
          className={`json-text-box__btn json-text-box__btn--is-json-${isJson}`}
        >
          {isJson ? "save" : "json"}
        </span>
        <span onClick={cancel} className={`json-text-box__btn json-text-box__btn--cancel`}>
          x
        </span>
      </div>
    </div>
  );
};

export default JsonTextBox;
