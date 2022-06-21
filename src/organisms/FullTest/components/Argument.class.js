import {
  isObjectLike,
  isTargetReplacer,
  isTargetNamespace,
  isValidName,
  isNameAndArray,
  targetReplacerRegex,
  parseObject,
  isEqualArrays,
} from "./test-helpers";

export function TargetValue(target_namespace, source_map, source_index) {
  this.target_namespace = target_namespace;
  this.source_map = source_map || [];
  this.source_index = source_index || 0;
}
export default function Argument(name, Tests) {
  this.name = name;
  this.input = undefined;
  this.input_type = "undefined";
  this.data_type = "";
  this.targetValues = [];

  this.value = () => {
    return this.targetValues.reduce((data, { source_map, target_namespace }) => {
      const [value, placeholder, nsp] = parseObject(data, source_map);

      if (isTargetReplacer(target_namespace) && typeof value === "string") {
        placeholder[nsp] = value
          .trim()
          .replace(`${target_namespace}`, getTargetValue(target_namespace, Tests));
      } else if (isTargetNamespace(target_namespace)) {
        placeholder[nsp] = getTargetValue(target_namespace, Tests);
      }
      return data;
      //using JSON to create a deep copy in order to lose refs to original
    }, JSON.parse(JSON.stringify(this))).input;
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
    // check if target namespaces against current input for deletion
    this.targetValues = this.targetValues.filter(
      ({ target_namespace, source_map, source_index }) => {
        const [value] = parseObject(this, source_map);
        //if the target value still exist at namespace on this.input

        return value ? value.indexOf(target_namespace, source_index) === source_index : false;
      }
    );
    return this;
  };

  this.addTargetValue = (target_namespace, source_map, source_index) => {
    //check to see if target value already exists first
    const i = this.targetValues.findIndex(
      (tv) =>
        tv.target_namespace === target_namespace &&
        isEqualArrays(tv.source_map, source_map || []) &&
        tv.source_index === source_index
    );
    if (i === -1)
      this.targetValues.push(new TargetValue(target_namespace, source_map, source_index));

    return this;
  };
}

const getTargetValue = (input, tests) => {
  if (isTargetReplacer(input)) {
    input = input.substring(3, input.length - 1);
  }
  if (!isTargetNamespace(input)) return undefined;

  const map = input.split(".");
  const i = ["beforeTest", "mainTest", "afterTest"].indexOf(map[0]);
  const targetTest = tests[i];
  const t_index = i === 1 ? 0 : parseInt(map[1].replace("Action", "")) - 1;
  if (!targetTest[t_index]) return undefined;
  if (map[i === 1 ? 1 : 2] !== targetTest[t_index].response_type) return undefined;

  let current_value = targetTest[t_index].results;

  for (let a = i === 1 ? 2 : 3; a < map.length; a++) {
    if (isValidName(map[a])) {
      //parse value as object
      if (!isObjectLike(current_value)) return undefined;
      current_value = current_value[map[a]];
    } else if (isNameAndArray(map[a])) {
      //separate prop name from indices (ie. 'results[0][0]'...)
      const sub_map = map[a].split("[");
      //parse first sub-map as prop name of object
      if (!isObjectLike(current_value)) return undefined;
      current_value = current_value[sub_map[0]];
      for (let x = 1; x < sub_map.length; x++) {
        //parse remaining sub-map as indices
        if (!isObjectLike(current_value)) return undefined;
        current_value = current_value[parseInt(sub_map[x].replace("]", ""))];
      }
    } else return undefined;
  }
  return current_value;
};
