import { validateResults } from "../../../molecules/ValidationInput/validator";
import { Client } from "systemlynx";
import moment from "moment";

function TestLogger(test) {
  this.start = (args) => {
    const { serviceId, moduleName, methodName } = test.namespace;

    console.log(
      `[${moment(this.test_start).format(
        "L LTS"
      )}]> [invoking]:${serviceId}.${moduleName}.${methodName}()`
    );
    console.log.apply({}, ["args:"].concat(args));
  };
  this.end = () => {
    const { serviceId, moduleName, methodName } = test.namespace;
    const { results, response_type } = test;
    console.log(
      `[${moment(this.test_end).format(
        "L LTS"
      )}]> [${response_type}]:${serviceId}.${moduleName}.${methodName}()`,
      `${response_type}:`,
      results
    );
  };
}
export default function Test({
  namespace,
  args,
  title,
  shouldValidate = false,
  savedEvaluations = [],
  index,
}) {
  const logger = new TestLogger(this);
  this.index = index;
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
    this.savedEvaluations = savedEvaluations; //will be populated by saved tests
    this.errors = [];
    this.shouldValidate = shouldValidate || !!savedEvaluations.length;
    return this;
  };
  this.clearResults();

  this.validate = () => {
    const { results, response_type } = this;
    const { evaluations, errors } = validateResults(
      results,
      response_type,
      savedEvaluations
    );
    this.evaluations = evaluations;
    this.errors = errors;
    return this;
  };
  this.runTest = async (cb) => {
    const { serviceId, moduleName, methodName } = this.namespace;
    const args = this.args.map((arg) => arg.value());

    this.test_start = moment().toJSON();
    if (methodName === "on") {
      logger.start(args);
      this.connection[serviceId][moduleName].on(args[0], (e) => {
        this.results = e;
        this.test_end = moment().toJSON();
        this.response_type = "event";
        this.shouldValidate && this.validate();
        logger.end();
        typeof cb === "function" && cb();
      });
    } else {
      try {
        logger.start(args);
        this.results = await this.connection[serviceId][moduleName][methodName].apply(
          {},
          args
        );
        this.test_end = moment().toJSON();
        this.response_type = "results";
        this.shouldValidate && this.validate();
        logger.end();
      } catch (error) {
        this.test_end = moment().toJSON();
        this.results = error;
        this.response_type = "error";
        this.shouldValidate && this.validate();
        logger.end();
      }
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
        console.warn("connection data not found");
        return this;
      }
      const { connectionData } = service.system;

      this.connection[serviceId] = Client.createService(connectionData);
    }
    return this;
  };
}
