module.exports = {
  concat(a, b) {
    return { result: a + b };
  },
  repeat(str, times) {
    return { result: str.repeat(times) };
  },
  toUpperCase({ value }) {
    return { result: value.toUpperCase() };
  },
};
