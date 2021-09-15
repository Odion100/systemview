import React, { useState, useEffect } from "react";
import "./styles.scss";
import Textbox from "../../atoms/Textbox/Textbox";
import Toggle from "../../atoms/Toggle/Toggle";
import DataTable from "../../atoms/DataTable/DataTable";
import Selector from "../../atoms/Selector/Selector";
import EditBox from "../EditBox/EditBox";
import ParserMatrix from "textparsermatrix";

const MethodDataForm = ({ data, submit }) => {
  const displayHeaders = [
    { name: "Property" },
    { name: "Type" },
    { name: "Description" },
    { name: "Default" },
    { name: "Required" },
  ];
  const formHeaders = [...displayHeaders, { name: "" }];
  const _options = [
    "String",
    "Date",
    "Object",
    "ObjectId",
    "Number",
    "Boolean",
    "Array(ObjectIds)",
    "Array(Objects)",
    "Array(Strings)",
    "Array(Numbers)",
    "Array(Boolean)",
    "Array(Misc)",
  ];
  const matrix = ParserMatrix([
    { name: "name" },
    { name: "data_type" },
    { name: "description" },
    { name: "default_value" },
    { name: "required" },
  ]);
  matrix.addJson(data || [], {
    beforeInsert: (rowData) => (rowData[4] = rowData[4] + ""),
  });

  const [dataTable, setTable] = useState(matrix.table);
  const [state, setState] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const addRow = () => {
    dataTable.push(["", "Object", "", "", "false"]);
    //not sure why this is working
    setState(!state);
  };
  const deleteRow = ([i]) => {
    console.log(i, this);
    dataTable.splice(i, 1);
    console.log(dataTable);
    setTable(dataTable);
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
  const formCanceled = () => {
    setFormSubmitted(false);
    setTable(matrix.table);
  };

  const formSubmit = (showForm) => {
    setFormSubmitted(true);
    matrix.table = dataTable;

    //validate and change data types
    for (let i = 0; i < matrix.table.length; i++) {
      const currentRow = matrix.table[i];
      if (
        !/^(?![0-9])[a-zA-Z0-9$_]+$/.test(currentRow[0]) ||
        !currentRow[1] ||
        !currentRow[2] ||
        !currentRow[3]
      )
        return alert("Please fix invalid or incomplete cells.");
      currentRow[4] = /true/i.test(currentRow[4]);
    }

    submit(matrix.toJson());
    showForm(false);
  };
  useEffect(() => setTable(matrix.table), [data]);
  return (
    <div style={{ width: "100%" }}>
      <EditBox
        mainObject={<DataTable table={dataTable} headers={displayHeaders} />}
        hiddenForm={
          <div>
            <DataTable
              tableClassName="data-table-form"
              headers={formHeaders}
              table={dataTable.map(([name, type, description, default_value, required], i) => {
                const _required = /true/i.test(required);
                return [
                  <Textbox
                    inputClassName={`data-table-form__input-validation--${
                      /^(?![0-9])[a-zA-Z0-9$_]+$/.test(name)
                        ? "complete"
                        : formSubmitted
                        ? "invalid"
                        : "incomplete"
                    }`}
                    text={name}
                    setValue={updateCell.bind(this, i, 0)}
                  />,
                  <Selector
                    options={_options}
                    selected_option={type}
                    onSelect={updateCell.bind(this, i, 1)}
                    className={`data-table-form__data-type-selector`}
                  />,
                  <textarea
                    value={description}
                    className={`data-table-form__description-text data-table-form__input-validation--${
                      description ? "complete" : formSubmitted ? "invalid" : "incomplete"
                    }`}
                    onChange={updateCell.bind(this, i, 2)}
                  />,
                  <Textbox
                    inputClassName={`data-table-form__input-validation--${
                      default_value ? "complete" : formSubmitted ? "invalid" : "incomplete"
                    }`}
                    text={default_value}
                    setValue={updateCell.bind(this, i, 3)}
                    disabled={_required}
                  />,
                  <Toggle isChecked={_required} setValue={updateCheckboxCell.bind(this, i, 4)} />,
                  <span
                    className="data-table-form__delete-button"
                    onClick={deleteRow.bind(this, [i])}
                  >
                    x
                  </span>,
                ];
              })}
            />
            <span className="data-table-form__add-button" href="#" onClick={addRow}>
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
