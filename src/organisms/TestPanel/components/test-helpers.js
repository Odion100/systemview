import { getType } from "../../../molecules/ValidationInput/validator";
export const isObjectLike = (value) =>
  ["object", "array", "string"].indexOf(getType(value)) > -1;
export const isValidName = (str) => /^(?![0-9])[a-zA-Z0-9$_]+$/.test(str); //_id
export const isNameAndArray = (str) => /^(?![0-9])[a-zA-Z0-9$_]+(\[\d\])+$/.test(str); //users[0]...
export const isTargetNamespace = (str) =>
  /^(?:before|main|after)Test\.Action\d\.(?:error|results)(?:\.(?![0-9])[a-zA-Z0-9$_]+(?:\[\d\])*)*$/.test(
    str
  );
export const targetReplacerRegex =
  /tv\((?:before|main|after)Test\.Action\d\.(?:error|results)(?:\.(?![0-9])[a-zA-Z0-9$_]+(?:\[\d\])*)*\)/g;

export const isTargetReplacer = (str) =>
  /tv\((?:before|main|after)Test\.Action\d\.(?:error|results)(?:\.(?![0-9])[a-zA-Z0-9$_]+(?:\[\d\])*)*\)/.test(
    str
  );

export const hasTargetReplacer = (str) => targetReplacerRegex.test(str);

export const isEqualArrays = (a, b) => a.join(".") === b.join("."); //specifically for arrays of strings

export const obj = function ObjectParser(obj) {
  const parser = this || {};
  parser.parse = (map) =>
    map.reduce(([placeholder], key) => [placeholder?.[key], placeholder, key], [obj]);

  parser.valueAt = (map) => parser.parse(map)[0];

  parser.valueAtNsp = (nsp) => parser.valueAt(nspToMap(nsp));

  parser.parseNsp = (nsp) => parser.parse(nspToMap(nsp));
  //using JSON to create a deep copy in order to lose refs to original
  parser.clone = () => JSON.parse(JSON.stringify(obj));

  parser.safeClone = (object = obj) =>
    Object.getOwnPropertyNames(object).reduce((sum, prop) => {
      const type = getType(object[prop]);
      if (type === "object") {
        sum[prop] = parser.safeClone(object[prop]);
      } else if (type === "array") {
        sum[prop] = object[prop].map(function cloneArray(item) {
          const type = getType(item);
          if (type === "object") {
            return parser.safeClone(item);
          } else if (type === "array") {
            return cloneArray(item);
          } else return item;
        });
      } else {
        sum[prop] = object[prop];
      }
      return sum;
    }, {});
  parser.isEmpty = () => Object.getOwnPropertyNames(obj).length === 0;

  //separate prop names from other prop names and indices (ie. 'test.results[0][0]'...)j;
  const nspToMap = (nsp) =>
    nsp
      .replace(/(?:\.|\[|\])/g, " ")
      .split(" ")
      .reduce((sum, str) => sum.concat(str.trim() || []), []);
  return parser;
};
window.obj = obj;
