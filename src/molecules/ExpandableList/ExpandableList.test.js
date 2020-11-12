/* eslint-disable jest/valid-expect */
import React from "react";
import { expect } from "chai";
import { shallow, render } from "enzyme";

import ExpandableList from "./ExpandableList";

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";

Enzyme.configure({ adapter: new Adapter() });

describe("<ExpandableList/>", () => {
  it("renders a div with classname expandable-list", () => {
    const wrapper = shallow(<ExpandableList />);
    expect(wrapper.find("div.expandable-list").props().className).to.equal("expandable-list");
  });

  it("use the title prop to pass a string to .expandable-list__button class", () => {
    const wrapper = render(<ExpandableList title="test" />);
    expect(wrapper.find("div.expandable-list__button").text()).to.contain("test");
  });

  it("use wrap nested elements in .expandable-list-items container", () => {
    const wrapper = render(
      <ExpandableList>
        <div className="test"></div>
        <div className="test"></div>
      </ExpandableList>
    );
    expect(wrapper.find("div.expandable-list__items test")).to.have.a.lengthOf(0);
  });
});
