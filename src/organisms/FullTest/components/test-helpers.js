import { getType } from "../../../molecules/ValidationInput/validations";
export const isObjectLike = (value) => ["object", "array", "string"].indexOf(getType(value)) > -1;
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

export const isEqualArrays = (a, b) => {
  console.log(a, b, a.join(".") === b.join("."));
  return a.join(".") === b.join(".");
}; //specifically for string arrays

export const parseObject = (object, map) =>
  map.reduce(
    ([placeholder], namespace, i) => {
      return [(placeholder || {})[namespace], placeholder, namespace];
    },
    [object]
  );
