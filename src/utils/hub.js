// THE HUB, REACHABLE FROM PLAIN MODULES. `SystemViewService` is handed to <App> at boot and lives in
// React context, which is right for components and useless to a utility module like `hostFiles` —
// and a utility is exactly where the file layer belongs. So the boot stores it here once.
//
// Why this exists at all: git used to come from the plugin, then briefly from the shell, and the
// shell cut its git verbs the same day the UI stopped asking the plugin. Both halves moved and the
// panel went silent for every project. Git is a LOCAL operation on a folder the hub already runs
// beside, so the hub is the one place that cannot be out of step with itself.
let hub = null;
export const setHub = (svc) => {
  hub = (svc && svc.SystemView) || null;
};
export const getHub = () => hub;
