import React from "react";
import "./styles.scss";

const DataTable = ({ headers, table }) => {
  return (
    <table className="data-table">
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
