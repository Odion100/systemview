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
  // Two OBJECT arguments — so the Stories test view can show multi-arg / multi-object rendering.
  combine({ a, label: aLabel }, { b, label: bLabel }) {
    const sum = a + b;
    this.log("combine called", { a, b, sum });
    return { sum, inputs: { a: { value: a, label: aLabel }, b: { value: b, label: bLabel } } };
  },
  // Primitive positional args (string, number, boolean, array) — so the Stories test view can prove it
  // renders ANY argument type, not just objects, exactly like the scratchpad's Args display does.
  describe(name, count, active, scores) {
    const average = scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : 0;
    this.log("describe called", { name, count, active, scores });
    return { summary: `${name} x${count}`, active, average, scoreCount: scores.length };
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
