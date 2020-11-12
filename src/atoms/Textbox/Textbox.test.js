/* eslint-disable jest/valid-expect */
import React from "react";

import { expect } from "chai";
import { shallow, render } from "enzyme";

import Textbox from "./Textbox";

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
Enzyme.configure({ adapter: new Adapter() });

describe("<Textbox/>", () => {
  it("renders a div with class textbox and a nested input", () => {
    const wrapper = shallow(<Textbox />);
    expect(wrapper.find("div.textbox > input")).to.have.a.lengthOf(1);
  });

  it("should user the placeholderText prop to apply input placeholder attribute", () => {
    const wrapper = shallow(<Textbox placeholderText="textbox test" />);
    expect(wrapper.find("div.textbox > input").props().placeholder).to.equal("textbox test");
  });
});
