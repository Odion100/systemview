const Headers = {
  _lastOrigin: "",
  _lastHeaders: {},
  getOrigin() {
    return { received: !!Headers._lastOrigin };
  },
  // echoes the request headers back — lets a saved test assert that a manifest header
  // (e.g. an @file token) actually reached the service.
  echo() {
    return { headers: Headers._lastHeaders };
  },
};

module.exports = Headers;
