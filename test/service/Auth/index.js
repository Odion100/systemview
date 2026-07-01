const Auth = {
  _lastCookie: "",
  signIn({ email, password }) {
    if (!email || !password) {
      this.warn("sign in failed — missing credentials", { email, hasPassword: !!password });
      throw { message: "Unauthorized", status: 401 };
    }
    this.log("sign in succeeded", { email });
    return { success: true };
  },
  getSession() {
    this.debug("getSession called", { cookie: Auth._lastCookie });
    return { cookie: Auth._lastCookie };
  },
};

module.exports = Auth;
