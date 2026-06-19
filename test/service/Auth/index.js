const Auth = {
  _lastCookie: "",
  signIn({ email, password }) {
    return { success: !!(email && password) };
  },
  getSession() {
    return { cookie: Auth._lastCookie };
  },
};

module.exports = Auth;
