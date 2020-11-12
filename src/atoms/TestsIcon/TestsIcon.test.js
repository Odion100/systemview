/* eslint-disable jest/valid-expect */
import React from "react";
import { expect } from "chai";
import { shallow } from "enzyme";

import TestsIcon from "./TestsIcon";

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";

Enzyme.configure({ adapter: new Adapter() });

describe("<TestsIcon/>", () => {
  it("renders test-saved.png if isSaved prop equals true", () => {
    const wrapper = shallow(<TestsIcon isSaved={true} />);
    expect(wrapper.find("img").props().src).to.equal("test-saved.png");
  });

  it("renders test-missing.png if isSaved prop equals false", () => {
    const wrapper = shallow(<TestsIcon isSaved={false} />);
    expect(wrapper.find("img").props().src).to.equal("test-missing.png");
  });

  it("should additional classname to the container div and image from the add_class prop", () => {
    const wrapper = shallow(<TestsIcon add_class="test" />);
    expect(expect(wrapper.find(".doc-icon").props().className).to.equal("doc-icon test"));
    expect(expect(wrapper.find(".doc-icon__img").props().className).to.equal("doc-icon__img test"));
  });
});
