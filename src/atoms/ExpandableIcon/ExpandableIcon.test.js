/* eslint-disable jest/valid-expect */
import React from "react";

import { expect } from "chai";
import { shallow } from "enzyme";

import ExpandableIcon from "./ExpandableIcon";

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
Enzyme.configure({ adapter: new Adapter() });

describe("<ExpandableIcon/>", () => {
  it("renders element with class expandable-list", () => {
    const wrapper = shallow(<ExpandableIcon />);
    expect(wrapper.find(".expandable-icon")).to.have.a.lengthOf(1);
  });
});
