const Headers = {
  _lastOrigin: "",
  getOrigin() {
    return { received: !!Headers._lastOrigin };
  },
};

module.exports = Headers;
