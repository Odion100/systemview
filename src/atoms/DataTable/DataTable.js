import React from "react";
import "./styles.scss";

const DataTable = ({ headers, table, tableClassName }) => {
  return (
    <table className={`data-table ${tableClassName}`}>
      <thead>
        <tr>
          {headers.map(({ name }, i) => (
            <th key={i}>{name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.map((data, i) => (
          <tr key={i}>
            {data.map((value, i) => (
              <td key={i}>{value}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default DataTable;
