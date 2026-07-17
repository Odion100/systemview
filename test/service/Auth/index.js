// Factory, not a singleton: the plugin does `Object.assign(mod, makeLogger(name))` per App on
// ready, so a module object shared across two Apps would have its logger clobbered by the second.
// Both the plain and gated services register their OWN Auth instance (each with its own cookie/
// header slots) via makeAuth().
module.exports = function makeAuth() {
  const state = { _lastCookie: "", _lastHeaders: {} };
  return {
    _state: state,
    signIn({ email, password }) {
      if (!email || !password) {
        this.warn("sign in failed — missing credentials", { email, hasPassword: !!password });
        return { success: false };
      }
      this.log("sign in succeeded", { email });
      return { success: true };
    },
    // Reports the Cookie the SERVICE received on this request (captured by the .before hook that
    // wires this instance). Used both for same-origin session persistence and the cross-service
    // cookie test — the value is whatever actually rode to THIS origin.
    getSession() {
      this.debug("getSession called", { cookie: state._lastCookie });
      return { cookie: state._lastCookie };
    },
    // Echoes the request headers back — lets a saved test assert that a manifest-declared header
    // (e.g. an @file token) actually reached the service. `hasOrigin` is a BOOLEAN on purpose: the
    // Origin value is a URL, and the test evaluator's getType() mis-types URL strings as "date", so a
    // string assertion on it fails ([[feedback_moment_date_parsing]]). Assert the boolean instead.
    echo() {
      const h = state._lastHeaders || {};
      return { headers: h, hasOrigin: !!h.origin };
    },
    divideByZero() {
      return null.value;
    },
    throwError() {
      throw new Error("test error");
    },
  };
};
