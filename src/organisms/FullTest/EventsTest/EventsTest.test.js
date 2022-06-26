/* eslint-disable jest/valid-expect */
import React from "react";
import { expect } from "chai";
import { shallow } from "enzyme";

import EventsTest from "./EventsTest";
import Test from "./components/Test.class";

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";

Enzyme.configure({ adapter: new Adapter() });

describe("<EventsTest/>", () => {
  it("renders a multi-test-section", () => {
    const wrapper = shallow(<EventsTest isSaved={true} />);
    expect(wrapper.find("img").props().src).to.equal("saved-doc.png");
  });
});
