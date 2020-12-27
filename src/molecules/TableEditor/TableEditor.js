import React, { useState } from "react";
import "./styles.scss";
import DataTable from "../../atoms/DataTable/DataTable";
import Button from "../../atoms/Button/Button";

const TableEditor = ({ table, headers, editorSubmit }) => {
  const [editMode, setEditMode] = useState(false);
  const editClicked = () => setEditMode(true);
  const cancelClicked = () => setEditMode(false);

  return (
    <div className="table-editor">
      <div
        onClick={editClicked}
        className={`table-editor__text table-editor__text--${editMode ? "hidden" : "visible"}`}
      >
        <DataTable table={table} headers={headers} />
      </div>
      <div className={`table-editor__form table-editor__form--${editMode ? "visible" : "hidden"}`}>
        <div class="row">
          <div class="property-form container">
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
        </div>
        <div className="row">
          <div className="description-editor__button">
            <Button buttonSubmit={editorSubmit}>Save</Button>
            <Button buttonSubmit={cancelClicked}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableEditor;
