import { Client } from "systemlynx";
import moment from "moment";

export default function Test(namespace, args, title) {
  this.connection = {};
  this.title = title;
  this.args = args || [];
  this.namespace = namespace || {
    serviceId: "",
    moduleName: "",
    methodName: "",
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
    const { serviceId, moduleName, methodName } = this.namespace;
    const args = this.args.map((arg) => arg.value());

    console.log(
      `--------> [invoking]:${serviceId}.${moduleName}.${methodName}(${args})`,
      "args:",
      args
    );
    this.test_start = moment().toJSON();
    if (methodName === "on") {
      this.connection[serviceId][moduleName].on(args[0], (e) => {
        this.results = e;
        this.test_end = moment().toJSON();
        this.response_type = "event";
        typeof cb === "function" && cb();
      });
    } else {
      try {
        this.results = await this.connection[serviceId][moduleName][methodName].apply(
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
        `--------> [${this.response_type}]:${serviceId}.${moduleName}.${methodName}()`,
        `${this.response_type}:`,
        this.results
      );
    }
    return this;
  };

  this.getConnection = async (connectedServices) => {
    const { serviceId } = this.namespace;

    if (connectedServices.length > 0) {
      const service = connectedServices.find(
        (service) => service.serviceId === serviceId
      );
      if (!service) {
        console.log("connection data not found");
        return this;
      }
      const { connectionData } = service.system;

      this.connection[serviceId] = Client.createService(connectionData);
    }
    return this;
  };
}
