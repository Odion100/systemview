module.exports = {
  add({ a, b }) {
    return { sum: a + b };
  },
  subtract({ a, b }) {
    return { difference: a - b };
  },
  multiply({ a, b }) {
    return { product: a * b };
  },
};
