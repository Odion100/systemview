/* eslint-disable jest/valid-expect */
import React from "react";

import { expect } from "chai";
import { shallow, render } from "enzyme";

import Link from "./Link";

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
Enzyme.configure({ adapter: new Adapter() });

describe("<Link/>", () => {
  it("renders a tag with class link", () => {
    const wrapper = shallow(<Link />);
    expect(wrapper.find("a.link")).to.have.a.lengthOf(1);
  });

  it("renders text with the link when text prop is used", () => {
    const wrapper = render(<Link text="test" />);
    expect(wrapper.text()).to.equal("test");
  });

  it("should additional classname to the container <a> tag when add_class prop", () => {
    const wrapper = shallow(<Link add_class="test" />);
    expect(expect(wrapper.find("a.link").props().className).to.equal("link test"));
  });

  it("should use link prop to add href", () => {
    const wrapper = shallow(<Link link="/test" />);
    expect(expect(wrapper.find("a.link").props().href).to.equal("/test"));
  });
});
