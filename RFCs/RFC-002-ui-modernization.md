# RFC-002: UI Modernization — React 18, Code Cleanup, SCSS Architecture

## Context

SystemView's UI was built while learning React. The core concepts are sound (atomic design, SCSS co-location, custom test controllers) but the implementation has accumulated patterns that need cleaning before adding features: outdated dependencies, dead code, inconsistent SCSS organization, and UX rough edges throughout the main workflow areas.

This RFC has four phases in dependency order. Phases 1–3 are concrete; Phase 4 (UX improvements) requires running the cleaned-up UI first and will be planned in a follow-up session.

---

## Phase 1: React 18 + React Router v6

### Why now
React Router v6 has breaking API changes that touch App.js and SystemNavigator. Do this first so all subsequent cleanup is on the new stack.

### Changes

**`package.json`**
- `react` + `react-dom`: `17.0.2` → `18.x`
- `react-router-dom`: `5.2.0` → `6.x`

**`src/index.js`** — React 18 root API
```js
// Before:
import ReactDOM from "react-dom";
ReactDOM.render(<App SystemViewService={SystemViewService} />, document.getElementById("root"));

// After:
import { createRoot } from "react-dom/client";
createRoot(document.getElementById("root")).render(<App SystemViewService={SystemViewService} />);
```

**`src/App.js`** — Router v6 syntax
```js
// Before (v5 — array paths, no Routes wrapper):
import { BrowserRouter as Router, Route, Redirect } from "react-router-dom";
<Route path={["/:projectCode/:serviceId/:moduleName/:methodName", ...]}>
  <SystemView />
</Route>

// After (v6):
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
<Routes>
  <Route path="/*" element={<SystemView />} />
</Routes>
```
All paths land on the same page — wildcard route is correct. `useParams()` still works.

**`src/organisms/SystemNavigator/SystemNavigator.js`**
```js
// Before: useHistory + history.push()
// After:  useNavigate + navigate()
const navigate = useNavigate();
navigate(`/${project[0].projectCode}`);
```

No other files use `useHistory` or routing primitives directly.

---

## Phase 2: Code Cleanup

**Dead code**
- Delete `src/App.css` — unused CRA boilerplate, nothing imports it
- `src/pages/SystemView/SystemView.js` — remove commented-out `<span>SystemLynx</span>` block

**Inline styles → SCSS**
`SystemView.js` page header uses `style={{ fontSize, fontFamily, color, marginRight, textShadow }}` on the title span. Move to `src/pages/SystemView/styles.scss` as `.page-header__title`.

**Window globals**
`TestPanel/` sets `window.Tests`, `window.savedTestList`, `window.savedTests`, `window.Client` for debugging. Remove all assignments. React DevTools covers this need.

**Naming conflict in TestPanel.js**
Both `const FullTest = ({ serviceId, ... }) => {...}` (component) and `const FullTest = [Before, Main, Events, After]` (array) exist. Rename the array to `phases` or `testSections`.

---

## Phase 3: SCSS Architecture

**Create `src/sass/_tokens.scss`**
Extract shared values currently hardcoded across component SCSS files:
- Colors (`#6886ba` blue, text, backgrounds)
- Typography (font sizes, Malkor font-family)
- Spacing (common margins/padding)
- Shadows, border-radius

**Audit pass — 46 `styles.scss` files**
- Import `_tokens.scss` in any file using these values
- Replace hardcoded hex/px values with token variables
- Verify BEM naming consistency throughout

No visual changes in this phase — organizational only.

---

## Phase 4: TestPanel UX — Per-Phase Run + Drag-to-Reuse

### 4a: Per-phase run buttons

Currently `FullTestController.runFullTest()` always runs Before → Main → Events → After in sequence. Add independent run buttons to each phase so you can run Before alone, After alone, etc.

**`cli/…` — not applicable. All changes in `src/`.**

**`FullTestController.js`** — add `runSection(controller)` that runs a single `TestController` and updates only that section's state.

**`BeforeTest.js`, `AfterTest.js`, `EventsTest.js`, `MainTest.js`** — each gets a small run button (reuse `RunTestIcon` atom) that calls `runSection` for its own controller. Existing full-test "Run" button on `TestPanel` stays.

Edge case: if Main is run independently and has saved-evaluation refs that Before hasn't populated yet, pass empty/undefined for missing values rather than erroring — the user opted to run out of sequence intentionally.

### 4b: Drag actions from saved tests into the scratchpad

Goal: open a saved test, drag one of its Before/After actions into the current scratchpad to reuse it.

**Approach: HTML5 native drag-and-drop** (no new dependency).

**`SavedTests.js` / the saved test action rendering** — make each action item `draggable`. On `dragstart`, serialize the action (namespace + args) into `event.dataTransfer` as JSON.

**`MultiTestSection.js` / `TestContainer.js`** — make each section a drop target. On `drop`, deserialize the dragged action and call `TestController.addTest(namespace, args)` to insert a new pre-filled action at the bottom of that section.

**Autofill** — when a namespace is typed/selected for a new action in the scratchpad, check all loaded saved tests for any action with the same namespace and pre-populate the args from the most recent match. This removes the need to re-enter common args (e.g. `{ email, password }` for signIn) every time you add that call to a Before phase.

Visual feedback: `dragover` adds a highlight class to the drop target section; `dragleave`/`drop` removes it.

**`src/sass/_tokens.scss`** — add a `$color-drop-target` token for the highlight border/background.

### Other TestPanel improvements (same phase)

- **Reorder actions within Before/After** — drag handle on existing TestContainer items to reorder within the same section (same HTML5 approach, `TestController` gets a `reorder(from, to)` method)
- **Section-level clear results** — small "clear" button per phase that calls `TestController.clearResults()` without clearing args
- **NavigationLinks in SystemNavigator** — when no project is loaded, show a placeholder instead of empty space; improve the expand/collapse feel (currently slightly laggy due to re-renders from `useEffect` on every `connectedServices` change — memoize the NavigationLinks component)

### 4c: Visual redesign

Along with the SCSS token pass in Phase 3, update the visual design to look more polished:
- Refine color palette — the `#6886ba` blue is the brand color, build a coherent scheme around it (backgrounds, borders, hover states)
- Tighten spacing and typography — consistent padding, clear visual hierarchy between sections
- Component-level polish: buttons, inputs, expandable sections, status indicators
- TestPanel and SavedTests specifically — these are the most-used surfaces and currently the least polished

This is iterative — make a pass, run the UI, refine.

### Phase 4 deferred (needs UI review session)
- Documentation panel improvements
- Layout/responsiveness
- Broader SystemNavigator UX

---

## Phase 5: Seamless Plugin ↔ SystemView Connection

The plugin already uses SystemLynx WebSockets and `Plugin.on('reconnect', ...)` is wired in SystemNavigator, but the connection state isn't visible and the UX around drops/reconnects is rough.

### Connection status indicator
- Each service in the SystemNavigator nav tree gets a small status dot (green = connected, red = dropped/unreachable)
- `refreshConnections()` already pings each service — drive the dot from its response
- On reconnect (existing `Plugin.on('reconnect', ...)` handler), auto-refresh the service data and flip the dot green without requiring a manual refresh click

### Auto-reconnect UX
- If a service drops mid-session, show the status change immediately rather than silently failing on the next call
- When reconnected, surface a brief "Reconnected" toast/indicator so the user knows things are back
- No polling — rely on the existing SystemLynx reconnect event; don't add timers

### Implementation
- Add connection state to `connectedServices` array entries (a `connected: boolean` field updated by refresh/reconnect events)
- `StatusIndicator` atom already exists — wire it into `NavigationLinks` per service
- `ServiceContext` or local state in SystemNavigator holds the live connection status

---

## Phase 6: Log Viewer

Plugin already exposes `Plugin.getLog({ limit })` which returns NDJSON log entries written by `install.log(...args)`. Surface this in the UI.

### Log panel
- New `LogViewer` organism, accessible per-service (e.g. a tab or expandable section in the right panel alongside TestPanel/Docs, or a route like `/:projectCode/:serviceId/logs`)
- Calls `Plugin.getLog({ limit: 100 })` on mount and on manual refresh
- Displays entries as a clean list — timestamp + any fields present in the entry

### Field analytics (agnostic)
- Parse all log entries and derive the field schema dynamically (no hardcoded field names)
- For each field found across entries, compute value frequency: `{ fieldName: { value: count, ... } }`
- Display as a summary above the log list — e.g. `level: { error: 12, info: 45 }`, `module: { Users: 30, Auth: 5 }`
- Clicking a value filters the log list to entries where that field equals that value
- Fields with all-unique values (IDs, timestamps) are excluded from the summary — only fields with repeated values are shown

### Implementation
- `Plugin.getLog({ limit })` exists in `systemview-plugin/SystemViewModule.js` — no backend changes needed
- New `src/organisms/LogViewer/LogViewer.js` + `styles.scss`
- New `src/molecules/LogSummary/LogSummary.js` — the field analytics component
- Field deduplication logic: `entries.reduce((acc, entry) => { Object.entries(entry).forEach(([k, v]) => ...) }, {})`

---

## Files

| File | Phase | Change |
|------|-------|--------|
| `package.json` | 1 | react 18, react-router-dom 6 |
| `src/index.js` | 1 | `createRoot` |
| `src/App.js` | 1 | `<Routes>/<Route path="/*">` |
| `src/organisms/SystemNavigator/SystemNavigator.js` | 1 | `useNavigate` |
| `src/App.css` | 2 | Delete |
| `src/pages/SystemView/SystemView.js` | 2 | Remove commented JSX, move inline styles |
| `src/pages/SystemView/styles.scss` | 2 | Add `.page-header__title` |
| `src/organisms/TestPanel/TestPanel.js` | 2 | Rename `FullTest` array, remove window globals |
| `src/sass/_tokens.scss` | 3 | New — design tokens |
| 46 component `styles.scss` files | 3 | Import tokens, replace hardcoded values |

---

## Verification

1. `yarn start` — app loads, no console errors
2. Navigate to a project → services tree expands
3. Select a method → Documentation and TestPanel update
4. Run a test → results render correctly
5. Check for duplicate API calls (React 18 StrictMode double-invokes effects in dev)
6. `yarn test` — existing suite passes
