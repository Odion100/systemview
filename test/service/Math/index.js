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
  getItems({ count = 10 } = {}) {
    return {
      total: count,
      items: Array.from({ length: count }, (_, i) => ({ id: i + 1, value: i * 2, label: `item-${i + 1}` })),
      meta: { page: 1, pageSize: count, hasMore: false, generatedAt: new Date().toISOString() },
    };
  },
};
