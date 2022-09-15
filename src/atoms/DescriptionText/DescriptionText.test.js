/* eslint-disable jest/valid-expect */
import React from "react";
import { expect } from "chai";
import { shallow, render } from "enzyme";
import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import DescriptionText from "./DescriptionText";

Enzyme.configure({ adapter: new Adapter() });

describe("<DescriptionText/>", () => {
  it("renders a p tag wrapped in a dive with class name description-text__text", () => {
    const wrapper = shallow(<DescriptionText />);
    expect(wrapper.find("div.description-text")).to.have.a.lengthOf(1);
    expect(wrapper.find("p.description-text__text")).to.have.a.lengthOf(1);
  });

  it("use the tableClassName prop to add additional class name to table", () => {
    const wrapper = shallow(<DescriptionText text={"test"} />);
    expect(wrapper.find("p.description-text__text")).to.have.a.lengthOf(1);
  });
});
