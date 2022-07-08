import { Client } from "sht-tasks";
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

  this.runTest = async () => {
    try {
      const { service_id, module_name, method_name } = this.namespace;
      const args = this.args.map((arg) => arg.value());
      this.test_start = moment().toJSON();
      this.results = await this.connection[service_id][module_name][method_name].apply({}, args);
      this.test_end = moment().toJSON();
      this.response_type = "results";
    } catch (error) {
      this.test_end = moment().toJSON();
      this.results = error;
      this.response_type = "error";
    }
    return this;
  };

  this.getConnection = async (ConnectedProject) => {
    const { service_id } = this.namespace;

    if (ConnectedProject.length > 0) {
      const connData = ConnectedProject.find((connData) => connData.service_id === service_id);
      if (!connData) return console.log("connection data not found");
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
