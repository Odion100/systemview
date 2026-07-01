module.exports = {
  concat(a, b) {
    const result = a + b;
    this.log("concat called", { a, b, result });
    return { result };
  },
  repeat(str, times) {
    if (times > 1000) {
      this.warn("repeat count is very large", { str, times });
    } else {
      this.log("repeat called", { str, times });
    }
    return { result: str.repeat(times) };
  },
  toUpperCase({ value }) {
    this.debug("toUpperCase called", { value });
    return { result: value.toUpperCase() };
  },
};
