/* eslint-disable jest/valid-expect */
import React from "react";

import { expect } from "chai";
import { shallow, render } from "enzyme";

import List from "./List";

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
Enzyme.configure({ adapter: new Adapter() });

describe("<List/>", () => {
  it("renders a div tag with class list", () => {
    const wrapper = shallow(<List />);
    expect(wrapper.find("div.list")).to.have.a.lengthOf(1);
  });
  it("renders a div tag children", () => {
    const wrapper = shallow(
      <List>
        <div className="test"></div>
      </List>
    );
    expect(wrapper.find("div.list > div.test")).to.have.a.lengthOf(1);
  });
});
