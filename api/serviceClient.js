// THE HUB'S HANDLE ON THE SHARED DOOR.
//
// The rule and the reasoning live in src/shared/serviceClient.js, because the window needs the same
// rebuild and a second copy of it would drift — the first version of this file argued the browser
// was safe ("it builds its own client per page load"), and the window stopped reloading.
//
// What stays here is the one node-only piece: `createClient` off the systemlynx package, which the
// hub's callers import from this path.
const { createClient } = require("systemlynx");
const { serviceClient, degradedService, missingFrom, declaredSurface } = require("../src/shared/serviceClient");

module.exports = { serviceClient, degradedService, missingFrom, declaredSurface, createClient };
