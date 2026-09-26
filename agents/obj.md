# OBJ — Odion's ObjectParser (the path language for objects)

This document is for **any agent in any of these projects**: before you write code that
walks, reads, or points into a nested object by path — stop. That library exists, it is
small, it is Odion's standard, and he copies it between projects deliberately. Use a copy
that is already in your repo, or copy it whole from the source of truth. **Never rewrite
it, never reach for lodash.get.**

## Where it lives

| Project | Path | Form |
|---|---|---|
| **buAPI** (source of truth) | `common/utils/obj.js` | CJS, `module.exports = ObjectParser` |
| systemview | `src/organisms/TestPanel/components/test-helpers.js` (exported as `obj`) | ESM export |
| BUStudio | `app/src/lib/obj.js` | ESM, default export + named `mapNamespace` |

Copies are verbatim by convention. If you need it in a new project, copy from buAPI and
note the provenance in a header comment.

## The namespace syntax

One string addresses any property: dots for keys, brackets for indices — split on
`. [ ]`, empty segments dropped:

```
components[0].texts[1].textAlign
team1.points
plays[3].player.name
```

This is the **same path language** used by BUStudio's game bindings (a scoreboard text's
`bind: "team1.points"` is an OBJ namespace into the Basketball game document) and by the
proof gallery's `highlight` arrays. One vocabulary everywhere is the point.

## The API

```js
const OBJ = require("common/utils/obj"); // or import OBJ from "../lib/obj"
const parser = OBJ(someObject);

parser.get("a.b[2].c");        // the value, or undefined — never throws on missing paths
parser.set("a.b[2].c", 5);     // writes through (parent must exist)
parser.parse("a.b[2].c");      // [value, parent, lastKey] — when you need the container
parser.getAll("plays[*].player.name"); // "*" fans out over arrays → flat array of hits
parser.clone();                // JSON deep clone
parser.isEmpty();              // no own properties
parser.switchPropNames({ old: "new" }); // shallow key rename (buAPI copy)
```

Behavior worth knowing:
- `get` on a missing path returns `undefined` quietly (optional-chaining semantics) — it
  is safe to probe speculative paths.
- `set` does NOT create intermediate containers — the parent must exist or it throws.
- `getAll`'s `*` only fans out over **arrays**; a `*` against an object yields nothing.
- `parse`'s `[value, parent, key]` triple is the tool for delete/replace operations.

## When to reach for it

- Reading a user-supplied or document-supplied path (binds, highlights, config pointers).
- Pointing AT a property — UIs that highlight/report a specific field of a document
  (BUStudio's proof gallery lights spec lines whose path matches a test's `highlight`).
- Bulk extraction across arrays (`getAll` with `*`).
- Any place you were about to write `path.split(".").reduce(...)` by hand.
