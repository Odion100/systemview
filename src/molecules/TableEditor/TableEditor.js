import React from "react";
import "./styles.scss";
import DataTable from "../../atoms/DataTable/DataTable";
import EditBox from "../../molecules/EditBox/EditBox";
import MethodDataForm from "../../molecules/MethodDataForm/MethodDataForm";
const TableEditor = ({ table, headers, editorSubmit }) => {
  return (
    <div className="table-editor">
      <EditBox
        mainObject={<DataTable table={table} headers={headers} />}
        hiddenForm={<MethodDataForm />}
      />
    </div>
  );
};

export default TableEditor;
