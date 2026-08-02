const {
  isTargetValueFn,
  isTargetNamespace,
  targetValueFnRegex,
  obj,
  isEqualArrays,
  isFunction,
  hasRandomToken,
  strFn,
  resolveTargetValue,
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
    return this.targetValues.reduce(
      (arg, { source_map, target_namespace: nsp, source_index = 0 }) => {
        const [value, placeholder, key] = obj(arg).parse(source_map);
        // A targetValue only applies while the input still HOLDS its token text at its spot. A stale
        // reference (left behind by an earlier edit) must NEVER override a real value typed over it —
        // that was the long-standing "the reference clobbers my value" bug. Also guards the .trim()
        // crash when the input was replaced with a non-string.
        const holds =
          typeof value === "string" && value.indexOf(nsp, source_index) === source_index;
        if (!holds) return arg;

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
      },
      obj(this).clone()
    ).input;
  };

  this.parseTargetValues = (input, source_map) => {
    //extract one or more target replacer text from string (i.e. "tv(beforeTest.Action1.error)")
    Array.from(input.matchAll(targetValueFnRegex)).forEach((match) => {
      this.addTargetValue(match[0], source_map, match.index);
    });
    // hasRandomToken — an EMBEDDED random(n) ("user_random(6)@test.com") isn't a whole-string function,
    // so it needs its own detection to register for processing.
    if (isTargetNamespace(input) || isFunction(input) || hasRandomToken(input))
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
  // carry `.results` after running. A reference resolves to a value inside that structure (RFC-020). The
  // resolution itself lives in test-helpers so `validators` can reuse it for evaluation `tv()` references.
  const getTargetValue = (input) => resolveTargetValue(input, FullTest);
}

module.exports = { Argument, TargetValue, default: Argument };
