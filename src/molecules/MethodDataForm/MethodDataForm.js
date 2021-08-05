import React, { useState } from "react";
import "./styles.scss";
import Textbox from "../../atoms/Textbox/Textbox";
import Toggle from "../../atoms/Toggle/Toggle";
import DataTable from "../../atoms/DataTable/DataTable";
import Selector from "../../atoms/Selector/Selector";


const MethodDataForm = ({ data, headers }) => {
  
  const addRow = () => {
    data.push([]);
    const newTable = generateTable();
    setTable(newTable);
  };
  const deleteRow = () => {};
  const generateTable = () => {
    const newTable = data.map((row) => TableRow(row));

    newTable.push([
      <span className="method-data-form__add-button" href="#" onClick={addRow}>
        +
      </span>,
    ]);
    return newTable;
  };

  const [s, setTable] = useState(generateTable());
  let dataTable = generateTable()
  return (
    <DataTable
      tableClassName="method-data-form"
      table={dataTable}
      headers={headers}
    />
  );
};
const TableRow = ([property, type, description, default_value, required]) => {
  return [
    <Textbox value={property} />,
    <Selector
      options={["Object", "String", "Number", "Array", "ObjectId"]}
      selected_option={type}
    />,
    <textarea defaultValue={description} className="method-data-form__description-text" />,
    <Textbox value={required ? "n/a" : default_value} />,
    <Toggle isChecked={required} />,
    <span className="method-data-form__delete-button">x</span>,
  ];
};


export default MethodDataForm;

/*
- insert data into table and form
- adding and deleting rows
- saving and compiling the form data
- added data types options to type selector
- disable Default textbox display n/a in the input when required is true
  */
