class TruncationMarker {
  constructor(message) {
    this.message = message;
  }
  toJSON() {
    return this.message;
  }
}

function truncate(value, maxItems = 3, maxStrLen = 100) {
  if (Array.isArray(value)) {
    const slice = value.slice(0, maxItems).map((item) => truncate(item, maxItems, maxStrLen));
    if (value.length > maxItems) slice.push(new TruncationMarker(`...${value.length - maxItems} more`));
    return slice;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value);
    const result = {};
    keys.slice(0, maxItems).forEach((k) => {
      result[k] = truncate(value[k], maxItems, maxStrLen);
    });
    if (keys.length > maxItems) result.__more__ = new TruncationMarker(`...${keys.length - maxItems} more`);
    return result;
  }
  if (typeof value === "string" && value.length > maxStrLen) {
    return value.slice(0, maxStrLen) + `...[${value.length - maxStrLen} more chars]`;
  }
  return value;
}

module.exports = { truncate, TruncationMarker };
