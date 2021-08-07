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
  const deleteRow = () => {};

  return (
    <div style={{ width: "100%" }}>
      <EditBox
        mainObject={<DataTable table={dataTable} headers={headers} />}
        hiddenForm={
          <div>
            <DataTable
              tableClassName="method-data-form"
              headers={headers}
              table={dataTable.map(([name, type, description, default_value, required]) => {
                const _required = /true/i.test(required);
                return [
                  <Textbox text={name} />,
                  <Selector
                    options={["Object", "String", "Number", "Array", "ObjectId"]}
                    selected_option={type}
                  />,
                  <textarea
                    defaultValue={description}
                    className="method-data-form__description-text"
                  />,
                  <Textbox text={_required ? "n/a" : default_value} />,
                  <Toggle isChecked={_required} />,
                  <span className="method-data-form__delete-button">x</span>,
                ];
              })}
            />
            <span className="method-data-form__add-button" href="#" onClick={addRow}>
              +Prop
            </span>
          </div>
        }
      />
    </div>
  );
};

export default MethodDataForm;

/*
- insert data into table and form
- adding and deleting rows
- saving and compiling the form data
- added data types options to type selector
- disable Default textbox display n/a in the input when required is true
  */
