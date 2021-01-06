import React from "react";
import "./styles.scss";
import Textbox from "../../atoms/Textbox/Textbox";
import Toggle from "../../atoms/Toggle/Toggle";
import DataTable from "../../atoms/DataTable/DataTable";
import Selector from "../../atoms/Selector/Selector";

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

const MethodDataTable = (data) => {
  const table = data.map((row) => TableRow(row));
  table.push([
    <span className="method-data-form__add-button" href="#">
      +
    </span>,
  ]);
  return table;
};
const MethodDataForm = ({ table, headers, editorSubmit }) => {
  return (
    <DataTable
      tableClassName="method-data-form"
      table={MethodDataTable(table)}
      headers={[
        { name: "Property" },
        { name: "Type" },
        { name: "Description" },
        { name: "Defalut" },
        { name: "required" },
        { name: "" },
      ]}
    />
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
