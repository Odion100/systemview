module.exports = {
  add({ a, b }) {
    const sum = a + b;
    this.log("add called", { a, b, sum });
    return { sum };
  },
  subtract({ a, b }) {
    const difference = a - b;
    this.log("subtract called", { a, b, difference });
    return { difference };
  },
  multiply({ a, b }) {
    const product = a * b;
    if (Math.abs(product) > 1e9) this.warn("result exceeds 1e9", { a, b, product });
    else this.log("multiply called", { a, b, product });
    return { product };
  },
  divide({ a, b }) {
    if (b === 0) {
      this.error("division by zero", { a, b });
      throw { message: "Cannot divide by zero", status: 400 };
    }
    const quotient = a / b;
    this.log("divide called", { a, b, quotient });
    return { quotient };
  },
  getItems({ count = 10 } = {}) {
    if (count > 100) this.warn("large item count requested", { count });
    else this.debug("getItems called", { count });
    return {
      total: count,
      items: Array.from({ length: count }, (_, i) => ({ id: i + 1, value: i * 2, label: `item-${i + 1}` })),
      meta: { page: 1, pageSize: count, hasMore: false, generatedAt: new Date().toISOString() },
    };
  },
};
