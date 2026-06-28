# RFC-003: CLI Output & Ergonomics Improvements

## Context

The CLI test runner is functional but rough at the edges. After running a long test suite you have to scroll up to find what failed. Results dump the full JSON response with no truncation, making non-verbose output noisy. There's no way to selectively skip tests, bail early, or run a single phase or action. The `open` command requires the full 4-segment namespace even though you have the manifest. And there's no way to quickly see what tests or services exist without actually running anything.

This RFC tightens all of that up.

---

## 1. Output: Per-phase display modes

**Current behavior:**
- **Non-verbose**: Main always shows full results; Before/Events/After hidden unless they fail
- **Verbose**: All phases show full results + args

**New behavior:**
- **Non-verbose**: All phases always show, but with different density:
  - **Main** — truncated multi-line JSON (same position as now, just capped)
  - **Before/Events/After** — one-line compact preview: `results: { token: "eyJ...", _id: "abc..." }` (single line, key values trimmed to fit)
- **Verbose**: unchanged — full results + args for all phases

**`truncate(value, maxItems = 3, maxStrLen = 100)` utility** — new `cli/utils/truncate.js`:
- Array → first `maxItems` items + `[...N more]`
- Object → first `maxItems` keys + `{...N more keys}`
- String → first `maxStrLen` chars + `...[N more chars]`
- Primitives → pass through
- Applied recursively one level deep

`logPhase` gets a `compact` param. When compact (Before/Events/After in non-verbose): stringify truncated result on one line, no pretty-print indent. When normal (Main non-verbose): truncated but pretty-printed. When verbose: raw full output.

---

## 2. Output: Failure summary at bottom

**Problem:** After 20 tests you have to scroll up to find which ones failed.

**Fix:** The summary block at the end mirrors the familiar per-service summary line format already in use — same log style, just aggregated. Two-part structure:

**Part 1 — familiar counts (always shown, mirrors existing output):**
```
  AuthService: 3 tests, 3 passed, 0 failed
  ✗ OrderService: 2 tests, 1 passed, 1 failed
```

**Part 2 — failure detail (only if totalFailed > 0), using same indentation style as test output:**
```
  FAILED:

  ✗ OrderService.Orders.create — "Create order"
      Main: typeError on results.status — expected 201, received 400
      Before: "Get auth token" — numEquals on results.token
```

Accumulated in `runAllTests` into a `failures[]` array (same pass as today's `sum.failed++`). Printed at the end of `runTests` before exit. JSON mode unaffected.

---

## 3. New flags

All new flags added to `cli/utils/cli.js` flag parser.

### `--skip <pattern>` (repeatable)
Excludes tests whose namespace matches the pattern. Counterpart to the existing positional namespace filter.

```bash
systemview test myAPI --skip deleteUser --skip admin
```

Parsed as an array (like `--header`). Applied in the same filter pass as the namespace include:
```js
list.filter(({ namespace: n }) => {
  const full = `${n.serviceId}.${n.moduleName}.${n.methodName}`;
  const matchesInclude = !namespace || full.includes(namespace);
  const matchesSkip = skipPatterns.some(p => full.includes(p));
  return matchesInclude && !matchesSkip;
})
```

### `--bail`
Stop after the first failed test suite. In `runAllTests`, check `hasFailed` after each iteration — if true, break and return immediately. Print the failure summary before exiting.

### `--dry-run`
Resolve which tests would run (apply all filters), print the list, exit 0 without executing. Output:

```
  Would run 4 tests:

  AuthService.Users.signIn — "Sign in flow"
  AuthService.Users.signOut — "Sign out flow"
  OrderService.Orders.create — "Create order"
  OrderService.Orders.list — "List orders"
```

Implemented in `runTests.js` before `runAllTests` is called.

### `--phase <before|main|events|after>` (comma-separated)
Run only the specified phase(s). Applied by zeroing out other phases before passing to `runFullTest`:

```js
if (phaseFilter) {
  const allowed = phaseFilter.split(",");
  if (!allowed.includes("before")) Before.length = 0;
  if (!allowed.includes("main"))   Main.length = 0;
  if (!allowed.includes("events")) Events.length = 0;
  if (!allowed.includes("after"))  After.length = 0;
}
```

No changes to `FullTestController` — the empty arrays just mean nothing runs for that phase. Target value references from skipped phases will be unresolved; user accepted that risk by opting in.

### `--index <n>`
Run only the action at index `n` within each phase (0-based). Slices each phase array:
```js
if (indexFilter !== undefined) {
  Before  = Before.slice(indexFilter, indexFilter + 1);
  Main    = Main.slice(indexFilter, indexFilter + 1);
  Events  = Events.slice(indexFilter, indexFilter + 1);
  After   = After.slice(indexFilter, indexFilter + 1);
}
```

Combining `--phase main --index 0` runs only `Main[0]`.

---

## 4. `list` command

### `systemview list`
Lists all projects from the API, with their connected services nested:

```
  myProject
    ├── AuthService     http://localhost:4100
    └── OrderService    http://localhost:4200

  otherProject
    └── ProfileService  http://localhost:4300
```

Calls `SystemView.getProjects()` (or derives from `/systemview/api`).

### `systemview list myProject`
Lists all saved tests for that project, grouped by service → module → method with test count:

```
  myProject
  └── AuthService
      └── Users
          ├── signIn       3 tests
          ├── signOut      1 test
          └── getProfile   2 tests
```

Fetches connected services, then calls `Plugin.getTests()` on each, groups by moduleName → methodName.

### `systemview list myProject signUp`
Same as above but filtered by partial namespace match (same `.includes()` logic as test runner).

Implemented in a new `cli/listTests.js` module, wired up in `cli/index.js` as `command === "list"`.

---

## 5. Unified namespace resolution

**The problem (and the fix) is universal, not `open`-specific.**

All commands that take a namespace argument (`test`, `open`, `list`) currently require you to type the full dotted path. Instead, the namespace arg should be a partial match applied against all connected services — the same way the existing test filter uses `.includes()`, but now resolved into proper full paths.

**New shared utility: `cli/utils/resolveNamespace.js`**

```js
resolveNamespace(partial, connectedServices)
// returns: [{ serviceId, moduleName, methodName }, ...]
// all entries in any service's specList where
// `${serviceId}.${moduleName}.${methodName}`.includes(partial)
```

- If multiple services have a `getPage` method → all are returned → all get acted on
- If none match → warn and fall back gracefully
- No match is not an error if the command can still run with the original string (e.g., `open` falls back to appending as-is)

**Applied in:**
- `runTests.js` — replaces the current inline `.includes()` filter. Already fuzzy; now uses the shared util so behavior is consistent.
- `openBrowser.js` — currently does a dumb string append. Now resolves via the util: if matches found, opens one browser tab per match (or just the first with a note if there are many). Fixes the broken 4-segment URL problem.
- `listTests.js` — filters the tree output using the same util.

The `open` command also currently builds the wrong URL (missing `serviceId` segment). Resolving from `specList` fixes this automatically since the full `{ serviceId, moduleName, methodName }` is returned.

---

## Files Changed

| File | Change |
|------|--------|
| `cli/utils/cli.js` | Add `--skip` (array), `--bail`, `--dry-run`, `--phase`, `--index` flag parsing |
| `cli/utils/truncate.js` | New — truncation utility |
| `cli/runTests.js` | Compact phase display, failure summary, bail, dry-run, phase/index filters, skip filter |
| `cli/listTests.js` | New — `list` command implementation |
| `cli/utils/resolveNamespace.js` | New — shared partial namespace → full match utility |
| `cli/openBrowser.js` | Use resolveNamespace; fix 4-segment URL construction |
| `cli/index.js` | Wire up `list` command; update help text |
| `test/service/specs/tests/*.json` | Update test data to exercise new flags and output |

No changes to `testing-utilities/` or any UI code.

---

## Verification

Use the local test service at `test/service/` — update its test JSON fixtures to include:
- A test with multiple Main actions (to verify compact display and per-phase output)
- A test designed to fail (to verify failure summary format)
- Enough tests to verify `--skip`, `--bail`, `--phase`, `--index`, `--dry-run`

```bash
# Start the test service, then:

# Compact phase display — all phases visible, Before/After on one line
systemview test testProject

# Truncation — test with large response, confirm trimmed
systemview test testProject Math.add

# Failure summary at bottom
systemview test testProject   # with one failing test in fixtures

# Dry-run
systemview test testProject --dry-run

# Skip
systemview test testProject --skip add --dry-run

# Bail
systemview test testProject --bail

# Phase filter
systemview test testProject --phase main

# Index filter
systemview test testProject --phase main --index 0

# List
systemview list
systemview list testProject
systemview list testProject add

# Fuzzy open
systemview open testProject add   # resolves to full URL
```
