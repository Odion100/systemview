import React, { useState, useEffect } from "react";
import "./styles.scss";

const JsonTextBox = ({ obj, onSubmit, onCancel }) => {
  const [prettyJson, setPrettyJson] = useState(JSON.stringify(obj, undefined, 2));
  const [isJson, setIsJson] = useState(true);
  const [json, setJson] = useState(obj);

  const checkJsonString = (e) => {
    const str = e.target.value;
    setPrettyJson(str);
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
    setJson(obj);
    setPrettyJson(JSON.stringify(obj, undefined, 2));
    if (typeof onCancel === "function") onCancel();
  };
  useEffect(() => {
    setPrettyJson(JSON.stringify(obj, undefined, 2));
    setIsJson(!!obj);
    setJson(obj);
  }, [obj]);
  return (
    <div className="json-text-box">
      <div className="json-text-box__background-overlay"></div>
      <textarea
        className={`json-text-box__textbox json-text-box__textbox--is-json-${isJson}`}
        name="json-text-box"
        id="json-text-box"
        value={prettyJson}
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
