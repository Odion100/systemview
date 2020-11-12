/* eslint-disable jest/valid-expect */
import React from "react";
import { expect } from "chai";
import { shallow, render } from "enzyme";

import ServerModulesList from "./ServerModulesList";

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";

Enzyme.configure({ adapter: new Adapter() });

const mockModule = (fn, name) => {
  return { methods: [{ fn }], name };
};
describe("<ServerModulesList/>", () => {
  it("renders a div with classname expandable-list", () => {
    const wrapper = render(
      <ServerModulesList server_modules={[mockModule("test_fn", "test_name")]} />
    );

    expect(wrapper.find("div.expandable-list__button .link").text()).to.equal("test_name");
    expect(wrapper.find("div.server-module__methods .link").text()).to.equal(".test_fn(data, cb)");
  });
});
