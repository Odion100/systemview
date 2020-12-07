/* eslint-disable jest/valid-expect */
import React from "react";
import { expect } from "chai";
import { render } from "enzyme";

import SystemNavigator from "./SystemNavigator";

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-react-16";

Enzyme.configure({ adapter: new Adapter() });

const mockService = (fn, name, service_id) => {
  return {
    service_id,
    system_modules: [{ methods: [{ fn }], name }],
  };
};
describe("<SystemNavigator/>", () => {
  it("renders a div with classname expandable-list", () => {
    const wrapper = render(
      <SystemNavigator servicesList={[mockService("test_fn", "test_name", "test_service_id")]} />
    );

    expect(wrapper.find("div.expandable-list__button .link").text()).to.equal("test_name");
    expect(wrapper.find("div.server-module__methods .link").text()).to.equal(".test_fn(data, cb)");
  });
});
