import { validateResults } from "../../../molecules/ValidationInput/validator";
import { Client } from "systemlynx";
import moment from "moment";

export default function Test({
  namespace,
  args,
  title,
  validate = false,
  savedValidations = [],
}) {
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
    this.savedValidations = savedValidations; //will be populated by saved tests
    this.total_errors = 0;
    this.validateResults = validate || !!savedValidations.length;
    return this;
  };
  this.clearResults();

  this.validate = () => {
    const { results, response_type } = this;
    const { evaluations, total_errors } = validateResults(results, response_type, []);
    this.evaluations = evaluations;
    this.total_errors = total_errors;
    return this;
  };
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
        this.validateResults && this.validate();
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
        this.validateResults && this.validate();
      } catch (error) {
        this.test_end = moment().toJSON();
        this.results = error;
        this.response_type = "error";
        this.validateResults && this.validate();
      }
      console.log(
        `--------> [${this.response_type}]:${serviceId}.${moduleName}.${methodName}()`,
        `${this.response_type}:`,
        this.results
      );
    }
    return this;
  };

  this.getConnection = (connectedServices) => {
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
