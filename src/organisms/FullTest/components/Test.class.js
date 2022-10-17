import { Client } from "systemlynx";
import moment from "moment";

export default function Test(namespace, args, title) {
  this.connection = {};
  this.title = title;
  this.args = args || [];
  this.namespace = namespace || {
    service_id: "",
    module_name: "",
    method_name: "",
  };
  this.clearResults = () => {
    this.results = null;
    this.response_type = "";
    this.test_start = null;
    this.test_end = null;
    this.evaluations = [];
    this.total_errors = 0;
    return this;
  };
  this.clearResults();

  this.runTest = async (cb) => {
    const { service_id, module_name, method_name } = this.namespace;
    const args = this.args.map((arg) => arg.value());

    console.log(
      `--------> [invoking]:${service_id}.${module_name}.${method_name}(${args})`,
      "args:",
      args
    );
    this.test_start = moment().toJSON();
    if (method_name === "on") {
      this.connection[service_id][module_name].on(args[0], (e) => {
        this.results = e;
        this.test_end = moment().toJSON();
        this.response_type = "event";
        typeof cb === "function" && cb();
      });
    } else {
      try {
        this.results = await this.connection[service_id][module_name][method_name].apply(
          {},
          args
        );
        this.test_end = moment().toJSON();
        this.response_type = "results";
      } catch (error) {
        this.test_end = moment().toJSON();
        this.results = error;
        this.response_type = "error";
      }
      console.log(
        `--------> [${this.response_type}]:${service_id}.${module_name}.${method_name}()`,
        `${this.response_type}:`,
        this.results
      );
    }
    return this;
  };

  this.getConnection = async (ConnectedProject) => {
    const { service_id } = this.namespace;

    if (ConnectedProject.length > 0) {
      const connData = ConnectedProject.find(
        (connData) => connData.service_id === service_id
      );
      if (!connData) {
        console.log("connection data not found");
        return this;
      }
      if (!Client.loadedServices[connData.url]) {
        try {
          const service = await Client.loadService(connData.url);
          this.connection[service_id] = service;
        } catch (error) {
          console.error(error);
        }
      } else {
        this.connection[service_id] = Client.loadedServices[connData.url];
      }
    }
    return this;
  };
}
