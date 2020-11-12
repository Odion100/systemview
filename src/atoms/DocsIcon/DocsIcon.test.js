/* eslint-disable jest/valid-expect */
import React from "react";
import { expect } from "chai";
import { shallow } from "enzyme";

import DocsIcon from "./DocsIcon";

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";

Enzyme.configure({ adapter: new Adapter() });

describe("<DocsIcon/>", () => {
  it("renders saved-doc.png if isSaved prop equals true", () => {
    const wrapper = shallow(<DocsIcon isSaved={true} />);
    expect(wrapper.find("img").props().src).to.equal("saved-doc.png");
  });

  it("renders missing-doc.png if isSaved prop equals false", () => {
    const wrapper = shallow(<DocsIcon isSaved={false} />);
    expect(wrapper.find("img").props().src).to.equal("missing-doc.png");
  });

  it("should additional classname to the container div and image from the add_class prop", () => {
    const wrapper = shallow(<DocsIcon add_class="test" />);
    expect(expect(wrapper.find(".doc-icon").props().className).to.equal("doc-icon test"));
    expect(expect(wrapper.find(".doc-icon__img").props().className).to.equal("doc-icon__img test"));
  });
});
