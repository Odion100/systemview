// The modules the PLUGIN mounts into every connected service — ours, not the project's. They have
// to stay out of the namespace tree, Surface Coverage and the document menus, or every service
// sprouts methods its author never wrote and the coverage numbers count our plumbing as their
// untested surface.
//
// This list used to be three hardcoded `name === "Plugin" || name === "SystemView"` pairs in three
// files. Adding `SystemViewChat` to the plugin would have quietly surfaced it in all three — caught
// before shipping, but only by looking. One list, one place: adding a module to the plugin means
// adding its name HERE in the same change.
export const SYSTEM_MODULES = ["Plugin", "SystemView", "SystemViewChat"];

export const isSystemModule = (name) => SYSTEM_MODULES.includes(name);
