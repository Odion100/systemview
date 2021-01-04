import React from "react";
import "./styles.scss";
import Textbox from "../../atoms/Textbox/Textbox";
import Toggle from "../../atoms/Toggle/Toggle";
import DataTable from "../../atoms/DataTable/DataTable";

const MethodDataForm = ({ table, headers, editorSubmit }) => {
  /*
- insert data into table and form
- adding and deleting rows
- saving and compiling the form data
- added data types options to type selector
- disable Default textbox display n/a in the input when required is true
  */
  return (
    <DataTable
      tableClassName="method-data-form"
      table={[
        [
          <Textbox />,
          <select className="method-data-form__data-type-selector">
            <option></option>
            <option>Object</option>
          </select>,
          <textarea className="method-data-form__description-text" />,
          <Textbox />,
          <Toggle />,
          <span className="method-data-form__delete-button">x</span>,
        ],
        [
          <span className="method-data-form__add-button" href="#">
            +
          </span>,
        ],
      ]}
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
