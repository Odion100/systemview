import {
  isTargetReplacer,
  isTargetNamespace,
  targetReplacerRegex,
  obj,
  isEqualArrays,
} from "./test-helpers";

export function TargetValue(target_namespace, source_map, source_index) {
  this.target_namespace = target_namespace;
  this.source_map = source_map || [];
  this.source_index = source_index || 0;
}
export default function Argument(
  name,
  FullTest,
  input_type = "undefined",
  input,
  targetValues = []
) {
  this.name = name;
  this.input = input;
  this.input_type = input_type;
  this.data_type = "";
  this.targetValues = targetValues;

  this.value = () => {
    return this.targetValues.reduce((arg, { source_map, target_namespace: nsp }) => {
      const [value, placeholder, key] = obj(arg).parse(source_map);

      if (isTargetReplacer(nsp)) {
        placeholder[key] = value
          .trim()
          .replace(nsp, getTargetValue(nsp.substring(3, nsp.length - 1)));
      } else if (isTargetNamespace(nsp)) {
        placeholder[key] = getTargetValue(nsp);
      }

      return arg;
      //creating a deep copy in order to lose refs to original
    }, obj(this).clone()).input;
  };

  this.parseTargetValues = (input, source_map) => {
    //extract one or more target replacer text from string (i.e. "tv(beforeTest.Action1.error)")
    Array.from(input.matchAll(targetReplacerRegex)).forEach((match) => {
      this.addTargetValue(match[0], source_map, match.index);
    });
    if (isTargetNamespace(input)) this.addTargetValue(input, source_map, 0);
    return this;
  };

  this.checkTargetNamespaces = () => {
    // check target namespaces against current input for deletion
    //keep if the target value string still exist on this.input...
    this.targetValues = this.targetValues.filter(
      ({ target_namespace, source_map, source_index }) => {
        const value = obj(this).valueAt(source_map);
        return (
          typeof value === "string" &&
          value.indexOf(target_namespace, source_index) === source_index
        );
      }
    );
    return this;
  };

  this.addTargetValue = (target_namespace, source_map, source_index) => {
    //check to see if target value already exists first
    this.targetValues.findIndex(
      (tv) =>
        tv.target_namespace === target_namespace &&
        isEqualArrays(tv.source_map, source_map || []) &&
        tv.source_index === source_index
    ) === -1 &&
      this.targetValues.push(new TargetValue(target_namespace, source_map, source_index));
    return this;
  };

  const getTargetValue = (input) => {
    const [test, action] = input.split(".");
    const nsp = input
      .replace(test, { beforeTest: 0, mainTest: 1, Events: 2, afterTest: 3 }[test])
      .replace(action, parseInt(action.replace("Action", "")) - 1)
      .replace("error", "results");
    return obj(FullTest).valueAtNsp(nsp);
  };
}
