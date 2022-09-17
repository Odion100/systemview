/* eslint-disable jest/valid-expect */
import React from "react";
import ReactDom from "react-dom";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import renderer from "react-test-renderer";
import DataTable from "./DataTable";

afterEach(cleanup);

describe("<DataTable/>", () => {
  it("renders without crashing", () => {
    const div = document.createElement("div");
    ReactDom.render(<DataTable />, div);
  });

  it("renders an table element with text and class button", () => {
    const { getByRole } = render(<DataTable />);
    expect(getByRole("table")).toHaveClass("data-table");
  });

  it("renders content correctly", () => {
    const headers = [{ name: "column 1" }, { name: "column 2" }];
    const data = [
      ["r1c1", "r1c2"],
      ["r2c1", "r2c2"],
    ];
    const { getByRole, getAllByRole } = render(
      <DataTable tableClassName={"test"} headers={headers} table={data} />
    );

    expect(getByRole("table")).toHaveClass("data-table");
    expect(getByRole("table")).toHaveClass("test");
    expect(getAllByRole("columnheader")).toHaveLength(headers.length);
    expect(getAllByRole("columnheader")[0]).toHaveTextContent(headers[0].name);
    expect(getAllByRole("columnheader")[1]).toHaveTextContent(headers[1].name);
    expect(getAllByRole("cell")).toHaveLength(data.length * headers.length);
    expect(getAllByRole("cell")[0]).toHaveTextContent(data[0][0]);
    expect(getAllByRole("cell")[1]).toHaveTextContent(data[0][1]);
    expect(getAllByRole("cell")[2]).toHaveTextContent(data[1][0]);
    expect(getAllByRole("cell")[3]).toHaveTextContent(data[1][1]);
  });

  it("should match snapshot", () => {
    const headers = [{ name: "column 1" }, { name: "column 2" }];
    const data = [
      ["r1c1", "r1c2"],
      ["r2c1", "r2c2"],
    ];
    const tree = renderer
      .create(<DataTable tableClassName={"test"} headers={headers} table={data} />)
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
