# Math.add

Adds two numbers and returns the sum. A tiny example method used to exercise SystemView itself.

## Signature

```js
Math.add({ a, b }) // → { sum }
```

## Arguments

| name | type   | notes            |
|------|--------|------------------|
| `a`  | number | first addend     |
| `b`  | number | second addend    |

## Example

```js
const { sum } = await TestService.Math.add({ a: 2, b: 3 });
// sum === 5
```

> Try it live: open the **Window** tab, add a **Source** pane for `Math.add`, or a **Test** pane to
> run the saved example and see it pass. This very doc is editable — click in, and it opens in the
> CodeMirror editor.
