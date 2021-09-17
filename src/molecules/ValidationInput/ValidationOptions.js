const string = {
  options: ["Equals:", "Min Lenght:", "Max Length:", "Lenght Equals:", "Is Like:", "Is One Of:"],
  values: ["strEquals", "minLength", "maxLength", "lengthEquals", "isLike", "isOneOf"],
  inputs: ["text", "number", "number", "number", "text", "text"],
};
const number = {
  options: ["Equals:", "Min:", "Max:", "Is One Of:"],
  values: ["numEquals", "min", "max", "isOneOf"],
  inputs: ["number", "number", "number", "text"],
};
const array = {
  options: ["Min Lenght:", "Max Length:", "Lenght Equals:", "Includes:"],
  values: ["minLength", "maxLength", "lengthEquals", "includes"],
  inputs: ["number", "number", "number", "text"],
};
const date = {
  options: ["Equals:", "Min:", "Max:"],
  values: ["dateEquals", "minDate", "maxDate"],
  inputs: ["datetime-local", "datetime-local", "datetime-local"],
};
const boolean = { options: ["Equals:"], values: ["boolEquals"], inputs: ["checkbox"] };
const object = { options: [], values: [], inputs: [] };
const mixed = {
  options: [
    //string
    "Equals (str):",
    "Min Lenght (str):",
    "Max Length (str):",
    "Lenght Equals (str):",
    "Is Like:",
    "Is One Of (str):",
    //number
    "Equals (num):",
    "Min (num):",
    "Max (num):",
    "Is One Of (num):",
    //array
    "Min Lenght (arr):",
    "Max Length (arr):",
    "Lenght Equals (arr):",
    "Includes:",
    //date
    "Date Equals:",
    "Min Date:",
    "Max Date:",
    //boolean
    "Equals (bool)",
  ],
  values: [
    //string
    "strEquals",
    "minLength",
    "maxLength",
    "lengthEquals",
    "isLike",
    "isOneOf",
    //number
    "numEquals",
    "min",
    "max",
    "isOneOf",
    //array
    "minLength",
    "maxLength",
    "lengthEquals",
    "includes",
    //date
    "dateEquals",
    "minDate",
    "maxDate",
    //boolean
    "boolEquals",
  ],
  inputs: [
    //string
    "text",
    "number",
    "number",
    "number",
    //number
    "text",
    "text",
    "number",
    "number",
    "number",
    "text",
    //array
    "number",
    "number",
    "number",
    "text",
    //date
    "datetime-local",
    "datetime-local",
    "datetime-local",
    "checkbox",
  ],
};
const options = { array, number, date, boolean, string, object, mixed };
export default options;
