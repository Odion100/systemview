// The folder's door, so a mount can `import DashboardA from "../../organisms/DashboardA"`. The
// component takes no required props by contract — the tab switcher that hosts the three lanes'
// dashboards decides nothing about this one beyond where it hangs.
export { default } from "./DashboardA";
export { default as dashboard } from "./dashboardA.data";
