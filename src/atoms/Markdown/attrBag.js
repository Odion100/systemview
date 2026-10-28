// THE ATTRIBUTE WRITER — the one function every press in a document walks through. A claim's mark,
// a member pin, an answer landing in an input, and now a lifecycle station: all of them end here.
//
// IT LIVED INSIDE `Markdown.js` AND WAS THEREFORE UNTESTABLE. That module imports react-markdown,
// which is ESM, so jest cannot mount it — which meant the single most consequential string
// operation in the vocabulary had no test at all, while both scars in the comments below are cases
// of it writing into the wrong place, each found by reading the document afterwards. Moved out
// whole, behaviour unchanged, so it can be held to the rules it already learned.

// Rewrite one attribute inside a directive's `{…}` on a given source line. Used by input blocks so
// an answer lands in the document rather than in some parallel store (RFC-025 §4.6).
// THE BAG IS TOKENIZED, NEVER REGEXED THROUGH (RFC-073, same fix as the platform's write.cjs): a
// naive `(^|\s)key=` scan matches inside a QUOTED VALUE — a claim whose note says "told= is the
// baseline" had the stamp written into the note's prose — so the inner bag is split into real
// pairs, quotes respected, and rebuilt.
function parseAttrBag(inner) {
  const pairs = [];
  const re = /([A-Za-z_][\w-]*)=("[^"]*"|'[^']*'|[^\s}]*)|(\S+)/g;
  let m;
  while ((m = re.exec(inner))) {
    if (m[1]) pairs.push({ key: m[1], val: m[2] });
    else pairs.push({ key: null, val: m[3] });
  }
  return pairs;
}
const attrBagToString = (pairs) => pairs.map((p) => (p.key ? `${p.key}=${p.val}` : p.val)).join(" ");

function setDirectiveAttr(source, line, key, value) {
  const lines = String(source).split("\n");
  const i = line - 1;
  if (i < 0 || i >= lines.length) return null;
  const row = lines[i];
  // THE ATTR BAG IS THE BRACES AT THE END OF THE LINE — never the first on it. A claim's label may
  // quote a block (`::claim[Write \`::rfc{id=…}\` …]{id=c8}`), and matching the first braces wrote
  // the answer INTO THE EXAMPLE: measured 2026-10-25, a told= stamp landed inside two claims'
  // inline code. A directive's own attributes always close the line.
  const braces = row.match(/\{([^}]*)\}\s*$/);
  // A null value REMOVES the attribute — un-answering a question has to leave the document looking
  // unanswered, not carrying `answer=` with nothing after it.
  if (value == null) {
    if (!braces) return null;
    const pairs = parseAttrBag(braces[1]);
    const kept = pairs.filter((p) => p.key !== key);
    if (kept.length === pairs.length) return null;
    const rebuilt = kept.length ? `{${attrBagToString(kept)}}` : "";
    const next2 = row.slice(0, braces.index) + rebuilt + row.slice(braces.index + braces[0].length).replace(/\s+$/, "");
    if (next2 === row) return null;
    lines[i] = next2;
    return lines.join("\n");
  }
  // AN EMPTY VALUE MUST STILL BE QUOTED. `thread{members=}` is not a directive at all — the
  // attribute parse fails and the whole block renders as plain text — so a deliberately empty
  // attribute (RFC-071: a thread narrowed to nobody) is written `members=""`, which parses back as
  // present-and-empty. That difference is the only way a document can say "nobody, on purpose".
  const encoded = value === "" || /[\s"']/.test(String(value)) ? JSON.stringify(String(value)) : String(value);
  let next;
  if (!braces) {
    next = `${row}{${key}=${encoded}}`;
  } else {
    const pairs = parseAttrBag(braces[1]);
    const hit = pairs.find((p) => p.key === key);
    if (hit) hit.val = encoded;
    else pairs.push({ key, val: encoded });
    next = row.slice(0, braces.index) + `{${attrBagToString(pairs)}}` + row.slice(braces.index + braces[0].length);
  }
  if (next === row) return null;
  lines[i] = next;
  return lines.join("\n");
}

export { parseAttrBag, attrBagToString, setDirectiveAttr };
