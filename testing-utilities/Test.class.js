const { validateResults } = require("./validators");
const { Client } = require("systemlynx");
const moment = require("moment");
const { getArrayNamespaces, getLastArrayNamespace, obj } = require("./test-helpers");

module.exports = function Test({
  namespace,
  args,
  title,
  shouldValidate = false,
  savedEvaluations = [],
  index,
  editMode = true,
}) {
  this.index = index;
  this.connection = {};
  this.title = title;
  this.args = args || [];
  this.editMode = editMode;
  this.shouldValidate = shouldValidate || !!savedEvaluations.length;
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
    this.savedEvaluations = obj(savedEvaluations).clone();
    this.errors = [];
    return this;
  };

  this.clearResults();

  this.getErrors = () => {
    this.errors = this.evaluations
      .filter(({ save }) => save)
      .reduce(
        (sum, { errors, namespace }) =>
          sum.concat(errors.map((e) => ({ ...e, namespace }))),
        []
      );
    return this.errors;
  };

  this.validate = validateResults.bind(this);

  this.runTest = async (_logger) => {
    const logger = _logger || new TestLogger(this);
    const { serviceId, moduleName, methodName } = this.namespace;
    const args = this.args.map((arg) => arg.value());

    this.test_start = moment().toJSON();
    const Module = this.connection[serviceId][moduleName];
    if (methodName === "on") {
      const eventTest = (e) => {
        this.results = e;
        this.test_end = moment().toJSON();
        this.response_type = "event";
        this.shouldValidate && this.validate();
        logger.end(this);
        Module.$clearEvent(args[0], "eventTest");
      };
      logger.start(args);
      Module.on(args[0], eventTest);
    } else {
      try {
        logger.start(args);
        this.results = await Module[methodName](...args);
        this.test_end = moment().toJSON();
        this.response_type = "results";
        this.shouldValidate && this.validate();
        logger.end(this);
      } catch (error) {
        this.test_end = moment().toJSON();
        this.results = error;
        this.response_type = "error";
        this.shouldValidate && this.validate();
        logger.end(this);
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

  this.addEvaluation = (evaluation) => {
    const savedEval = this.savedEvaluations.find(
      ({ namespace }) => namespace === evaluation.namespace
    );
    if (savedEval) Object.assign(savedEval, evaluation);
    else this.savedEvaluations.push(evaluation);
  };
  this.removeEvaluation = (namespace) => {
    const index = this.savedEvaluations.findIndex((e) => e.namespace === namespace);
    if (index > -1) return this.savedEvaluations.splice(index, 1)[0];
    else return {};
  };

  this.addSavedIndices = (arrayNamespace, newArrayNamespace) => {
    //break namespace into multiple array namespaces
    const nspList = getArrayNamespaces(arrayNamespace);
    this.evaluations.forEach((e) => {
      if (nspList.includes(getLastArrayNamespace(e.namespace))) {
        e.namespace = e.namespace.replace(arrayNamespace, newArrayNamespace);
        e.indexed = true;
        e.expected_type = undefined;
        this.addEvaluation(e);
      }
    });
  };
  this.removeSavedIndices = (namespace) => {
    this.savedEvaluations = this.savedEvaluations.filter(
      (e) => !e.namespace.includes(namespace) //|| !e.indexed
    );
  };
};

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
