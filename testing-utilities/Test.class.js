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
  logger,
  client,
  extraHeaders,
  FullTest,
}) {
  this.index = index;
  // Non-enumerable: `connection` holds live systemlynx service objects (huge + self-referential); keeping
  // it out of serialization/rendering prevents a hang if a Test is ever JSON-walked (mirrors the browser).
  Object.defineProperty(this, "connection", { value: {}, enumerable: false, writable: true });
  this.title = title;
  this.args = args || [];
  this.editMode = editMode;
  // RFC-020 — the section-array-of-arrays this step lives in, so `validate` can resolve `tv()` references
  // in evaluation values against sibling steps' results. Non-enumerable: FullTest holds Tests holding
  // FullTest (a cycle), and it must stay OUT of JSON.stringify / obj().clone().
  Object.defineProperty(this, "FullTest", { value: FullTest, enumerable: false });
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

  this.runTest = async () => {
    const { serviceId, moduleName, methodName } = this.namespace;
    const args = this.args.map((arg) => arg.value());

    this.test_start = moment().toJSON();
    // A MISSING METHOD USED TO BE REPORTED BY V8, AND V8 NAMES NOTHING. `await Module[methodName]`
    // on an absent method throws `Module[methodName] is not a function` — the source expression,
    // quoted back. Not the service, not the module, not the method, and no hint that the step
    // which failed might be a Before/After facilitator rather than the method under test.
    //
    // It cost another project's agent a day (buapi-7e, 2026-09-30): three successive wrong
    // theories — a stale client cache, a duplicate registration, the wrong deployed instance —
    // three methods declared blocked, and one facilitator deleted and rebuilt on other methods
    // for nothing. Every one of those guesses was an attempt to identify what the error refused
    // to say. So the runner says it, and lists what the module DOES publish, because the answer
    // is nearly always a typo or a method on a service that was never restarted.
    const Service = this.connection[serviceId];
    const Module = Service && Service[moduleName];
    const ns = [serviceId, moduleName, methodName].filter(Boolean).join(".");
    if (!Service)
      throw new Error(`${ns}: this run holds no connection for service "${serviceId}"`);
    if (!Module)
      throw new Error(
        `${ns}: service "${serviceId}" publishes no module "${moduleName}" — it has ` +
          `${Object.keys(Service).filter((k) => !k.startsWith("$") && typeof Service[k] === "object").join(", ") || "no modules at all"}`
      );
    if (methodName !== "on" && typeof Module[methodName] !== "function")
      throw new Error(
        `${ns}: "${moduleName}" publishes no method "${methodName}" — it has ` +
          `${Object.keys(Module).filter((k) => !k.startsWith("$") && typeof Module[k] === "function").join(", ") || "no methods at all"}. ` +
          `If the method exists in the source, the service registered with SystemView before it ` +
          `was added — restart the service. If this step is a Before/After facilitator, the ` +
          `missing method is the FACILITATOR, not the method under test.`
      );
    if (methodName === "on") {
      const eventTest = (e) => {
        this.results = e;
        this.test_end = moment().toJSON();
        this.response_type = "event";
        this.shouldValidate && this.validate();
        if (logger) logger.end(this);
        Module.$clearEvent(args[0], eventTest);
      };
      if (logger) logger.start(args);
      Module.on(args[0], eventTest);
    } else {
      try {
        if (logger) logger.start(args);
        this.results = await Module[methodName](...args);
        this.test_end = moment().toJSON();
        this.response_type = "results";
        this.shouldValidate && this.validate();
        if (logger) logger.end(this);
      } catch (error) {
        this.test_end = moment().toJSON();
        this.results = error;
        this.response_type = "error";
        this.shouldValidate && this.validate();
        if (logger) logger.end(this);
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

      this.connection[serviceId] = (client || Client).createService(connectionData);
      this.connection[serviceId].setHeaders({ Origin: `http://localhost:${3000}`, ...(extraHeaders || {}) });
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
