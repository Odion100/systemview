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
  ];
  const formHeaders = [...headers, { name: "" }];
  const matrix = ParserMatrix([
    { name: "name" },
    { name: "data_type" },
    { name: "description" },
    { name: "default_value" },
    { name: "required" },
  ]);
  matrix.addJson(data, { beforeInsert: (rowData) => (rowData[4] = rowData[4] + "") });

  const [dataTable, setTable] = useState(matrix.table);
  const [state, setState] = useState(false);

  const addRow = () => {
    dataTable.push(["", "Object", "", "", "false"]);
    //not sure why this is working
    setState(!state);
  };
  const deleteRow = ([i]) => {
    console.log(i, this);
    dataTable.splice(i, 1);
    setState(!state);
  };
  const updateCell = (row, col, e) => {
    dataTable[row][col] = e.target.value;
    setTable(dataTable);
    setState(!state);
  };
  const updateCheckboxCell = (row, col, event) => {
    dataTable[row][col] = event.target.checked + "";
    dataTable[row][col - 1] = event.target.checked ? "n/a" : "";
    console.log(dataTable);
    setTable(dataTable);
    setState(!state);
  };
  const formCanceled = () => setTable(matrix.table);

  const formSubmit = () => {
    matrix.table = dataTable;
    // matrix.table.forEach((row, i)=>{
    //   row[4]
    // })
    // console.log(matrix.table);
    const test = matrix.toJson();
    return console.log(test);
    submit(matrix.toJson());
  };

  return (
    <div style={{ width: "100%" }}>
      <EditBox
        mainObject={<DataTable table={dataTable} headers={headers} />}
        hiddenForm={
          <div>
            <DataTable
              tableClassName="method-data-form"
              headers={formHeaders}
              table={dataTable.map(([name, type, description, default_value, required], i) => {
                const _required = /true/i.test(required);
                console.log(default_value);
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
                    onChange={updateCell.bind(this, i, 2)}
                  />,
                  <Textbox
                    text={default_value}
                    setValue={updateCell.bind(this, i, 3)}
                    disabled={_required}
                  />,
                  <Toggle isChecked={_required} setValue={updateCheckboxCell.bind(this, i, 4)} />,
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
        formSubmit={formSubmit}
        onCancel={formCanceled}
      />
    </div>
  );
};

export default MethodDataForm;
