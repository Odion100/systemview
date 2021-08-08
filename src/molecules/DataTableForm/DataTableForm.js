import React, { useState, useEffect } from "react";
import "./styles.scss";
import Textbox from "../../atoms/Textbox/Textbox";
import Toggle from "../../atoms/Toggle/Toggle";
import DataTable from "../../atoms/DataTable/DataTable";
import Selector from "../../atoms/Selector/Selector";
import EditBox from "../EditBox/EditBox";
import ParserMatrix from "textparsermatrix";

const MethodDataForm = ({ data, submit }) => {
  const headers = [
    { name: "Property" },
    { name: "Type" },
    { name: "Description" },
    { name: "Default" },
    { name: "required" },
    { name: "" },
  ];
  const matrix = ParserMatrix([
    { name: "name" },
    { name: "data_type" },
    { name: "description" },
    { name: "default_value" },
    { name: "required" },
  ]);
  matrix.addJson(data, { beforeInsert: (rowData) => (rowData[4] = rowData[4] + "") });

  const [dataTable, setTable] = useState(matrix.table);
  const [editMode, setEditMode] = useState(false);

  const addRow = () => {
    dataTable.push(["", "", "", "", ""]);
    //not sure why this is working
    setEditMode(!editMode);
  };
  const deleteRow = ([i]) => {
    console.log(i, this);
    dataTable.splice(i, 1);
    setEditMode(!editMode);
  };

  const updateCell = (row, col, value) => {
    dataTable[row][col] = value;
    setTable(dataTable);
    console.log(dataTable);
  };
  const _updateCell = (row, col, event) => {
    dataTable[row][col] = event.target.value;
    console.log(dataTable);
    setTable(dataTable);
  };
  const formCanceled = () => setTable(matrix.table);

  return (
    <div style={{ width: "100%" }}>
      <EditBox
        mainObject={<DataTable table={dataTable} headers={headers} />}
        hiddenForm={
          <div>
            <DataTable
              tableClassName="method-data-form"
              headers={headers}
              table={dataTable.map(([name, type, description, default_value, required], i) => {
                const _required = /true/i.test(required);
                return [
                  <Textbox text={name} setValue={updateCell.bind(this, i, 0)} />,
                  <Selector
                    options={["Object", "String", "Number", "Array", "ObjectId"]}
                    selected_option={type}
                    setValue={updateCell.bind(this, i, 1)}
                  />,
                  <textarea
                    defaultValue={description}
                    className="method-data-form__description-text"
                    onChange={_updateCell.bind(this, i, 2)}
                  />,
                  <Textbox
                    text={_required ? "n/a" : default_value}
                    setValue={updateCell.bind(this, i, 3)}
                  />,
                  <Toggle isChecked={_required} setValue={updateCell.bind(this, i, 4)} />,
                  <span
                    className="method-data-form__delete-button"
                    onClick={deleteRow.bind(this, [i])}
                  >
                    x
                  </span>,
                ];
              })}
            />
            <span className="method-data-form__add-button" href="#" onClick={addRow}>
              +Prop
            </span>
          </div>
        }
        onCancel={formCanceled}
      />
    </div>
  );
};

export default MethodDataForm;
