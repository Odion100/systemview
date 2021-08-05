import React, { useState } from "react";
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

  const addRow = () => {};
  const deleteRow = () => {};

  //const [s, setTable] = useState();
  //let dataTable = generateTable()
  //debugger;
  return (
    <div style={{ width: "100%" }}>
      <EditBox
        mainObject={<DataTable table={matrix.table} headers={headers} />}
        hiddenForm={
          <div>
            <DataTable
              tableClassName="method-data-form"
              headers={headers}
              table={matrix.table.map(([property, type, description, default_value, required]) => {
                return [
                  <Textbox value={property} />,
                  <Selector
                    options={["Object", "String", "Number", "Array", "ObjectId"]}
                    selected_option={type}
                  />,
                  <textarea
                    defaultValue={description}
                    className="method-data-form__description-text"
                  />,
                  <Textbox value={required ? "n/a" : default_value} />,
                  <Toggle isChecked={required} />,
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
