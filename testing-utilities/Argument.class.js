const {
  isTargetValueFn,
  isTargetNamespace,
  targetValueFnRegex,
  obj,
  isEqualArrays,
  isFunction,
  strFn,
} = require("./test-helpers");

function TargetValue(target_namespace, source_map = [], source_index = 0) {
  this.target_namespace = target_namespace;
  this.source_map = source_map;
  this.source_index = source_index;
}
function Argument(name, FullTest, input_type = "undefined", input, targetValues = []) {
  this.name = name;
  this.input = input;
  this.input_type = input_type;
  this.data_type = "";
  this.targetValues = targetValues;

  this.value = () => {
    return this.targetValues.reduce((arg, { source_map, target_namespace: nsp }) => {
      const [value, placeholder, key] = obj(arg).parse(source_map);

      if (isTargetValueFn(nsp)) {
        placeholder[key] = value
          .trim()
          .replace(nsp, getTargetValue(nsp.substring(3, nsp.length - 1)));
      } else if (isTargetNamespace(nsp)) {
        placeholder[key] = getTargetValue(nsp);
      } else {
        placeholder[key] = strFn(nsp);
      }

      return arg;
      //creating a deep copy in order to lose refs to original
    }, obj(this).clone()).input;
  };

  this.parseTargetValues = (input, source_map) => {
    //extract one or more target replacer text from string (i.e. "tv(beforeTest.Action1.error)")
    Array.from(input.matchAll(targetValueFnRegex)).forEach((match) => {
      this.addTargetValue(match[0], source_map, match.index);
    });
    if (isTargetNamespace(input) || isFunction(input))
      this.addTargetValue(input, source_map, 0);

    return this;
  };

  this.checkTargetNamespaces = () => {
    // check target namespaces against current input for deletion
    //keep if the target value string still exist on this.input...
    this.targetValues = this.targetValues.filter(
      ({ target_namespace, source_map, source_index }) => {
        const value = obj(this).get(source_map);
        return (
          typeof value === "string" &&
          value.indexOf(target_namespace, source_index) === source_index
        );
      }
    );
    return this;
  };

  this.addTargetValue = (target_namespace, source_map = [], source_index) => {
    //check to see if target value already exists first
    this.targetValues.findIndex(
      (tv) =>
        tv.target_namespace === target_namespace &&
        isEqualArrays(tv.source_map, source_map) &&
        tv.source_index === source_index
    ) === -1 &&
      this.targetValues.push(new TargetValue(target_namespace, source_map, source_index));
    return this;
  };

  // FullTest is [Before, Main, Events, After] — a section per slot, each an array of Test steps that each
  // carry `.results` after running. A reference resolves to a value inside that structure (RFC-020).
  const SECTION_INDEX = { before: 0, main: 1, events: 2, after: 3 };
  const getTargetValue = (input) => {
    // Legacy positional — beforeTest.Action1.error → "0.0.results" (kept EXACTLY as before).
    if (/^(?:before|main|after)Test\.Action\d+/.test(input)) {
      const [test, action] = input.split(".");
      const nsp = input
        .replace(test, { beforeTest: 0, mainTest: 1, Events: 2, afterTest: 3 }[test])
        .replace(action, parseInt(action.replace("Action", "")) - 1)
        .replace("error", "results");
      return obj(FullTest).get(nsp);
    }

    // Natural path — [test.]<section>[<i> | .name].results[.field…]. We translate the section name to its
    // slot index and a NAMED step to its index (by actionName/name/title), then let obj() walk the real
    // structure. This is the forward form: a reference is a path, not a positional label that shifts when a
    // named action is spliced in.
    const parts = input
      .replace(/^test\./, "")
      .replace(/\[(\d+)\]/g, ".$1") // before[0] → before.0
      .split(".")
      .filter(Boolean);
    const [sectionName, stepRef, ...tail] = parts;
    const sectionIndex = SECTION_INDEX[sectionName];
    if (sectionIndex === undefined) return obj(FullTest).get(input); // unrecognized → raw walk (defensive)

    const section = FullTest[sectionIndex] || [];
    let stepIndex = stepRef;
    if (stepRef !== undefined && !/^\d+$/.test(stepRef)) {
      const found = section.findIndex(
        (t) => t && (t.actionName === stepRef || t.name === stepRef || t.title === stepRef)
      );
      stepIndex = found === -1 ? stepRef : found; // fall back to the raw key if no named step matches
    }
    const path = [sectionIndex, stepIndex, ...tail.map((p) => (p === "error" ? "results" : p))]
      .filter((p) => p !== undefined)
      .join(".");
    return obj(FullTest).get(path);
  };
}

module.exports = { Argument, TargetValue, default: Argument };
