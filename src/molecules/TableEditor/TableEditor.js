import React from "react";
import "./styles.scss";
import DataTable from "../../atoms/DataTable/DataTable";
import EditBox from "../../molecules/EditBox/EditBox";

const TableEditor = ({ table, headers, editorSubmit }) => {
  return (
    <div className="table-editor">
      <EditBox
        mainObject={<DataTable table={table} headers={headers} />}
        hiddenForm={
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
        }
      />
    </div>
  );
};

export default TableEditor;
