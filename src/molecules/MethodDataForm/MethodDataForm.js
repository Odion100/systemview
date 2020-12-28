import React from "react";
import "./styles.scss";

const MethodDataForm = ({ table, headers, editorSubmit }) => {
  return (
    <div class="method-data-form container">
      <div class="row">
        <div class="col-2">
          <span>Name</span>
          <input type="text" name="name" />
        </div>
        <div class="col-2">
          <span>Data Type</span>
          <input type="text" name="name" />
        </div>
        <div class="col-2">
          <span>Description</span>
          <input type="text" name="name" />
        </div>
        <div class="col-2">
          <span>Default</span>
          <input type="text" name="name" />
        </div>
        <div class="col-2">
          <span>required</span>
          <input type="text" name="name" />
        </div>
      </div>
    </div>
  );
};

export default MethodDataForm;
