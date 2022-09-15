/* eslint-disable jest/valid-expect */
import React from "react";
import { expect } from "chai";
import { shallow, render } from "enzyme";
import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import Text from "./Text";

Enzyme.configure({ adapter: new Adapter() });

describe("<Text/>", () => {
  it("renders a span tag with class text", () => {
    const wrapper = shallow(<Text />);
    expect(wrapper.find("span.text")).to.have.a.lengthOf(1);
  });

  it("use the text prop to render a span with innerText", () => {
    const wrapper = render(<Text text="test" />);
    expect(wrapper.text()).to.equal("test");
  });
});
