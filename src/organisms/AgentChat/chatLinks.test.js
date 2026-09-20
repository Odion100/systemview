import { linkRefs, collectLinks, LINK_LIMIT } from "./chatLinks";

// The panel's whole promise is ONE list, newest first, where the thing you were just sent is the
// top row. Every test here is a sentence of that promise.

const say = (text, ts) => ({ kind: "say", text, ts });
const mine = (text, ts) => ({ kind: "mine", text, ts });
const said = (text, ts, extra = {}) => ({ id: `r${ts}`, kind: undefined, from: "agent", text, ts, ...extra });
const show = (label, ts, extra = {}) => ({
  id: `s${ts}`,
  kind: "command",
  cmd: "show",
  label,
  args: { report: label, text: `# ${label}` },
  ts,
  ...extra,
});

describe("linkRefs", () => {
  it("finds every reference form the chat draws, in reading order", () => {
    const refs = linkRefs(
      "see :file[src/a.js] and :report[Nav]{project=buAPI}, [the spec](/specs/x) plus https://ex.com/y",
    );
    expect(refs.map((r) => r.kind)).toEqual(["file", "report", "link", "link"]);
    expect(refs[0].label).toBe("src/a.js");
    expect(refs[1].attrs).toBe("project=buAPI");
    expect(refs[2].href).toBe("/specs/x");
    expect(refs[3].href).toBe("https://ex.com/y");
  });

  it("is a scanner, not a renderer — prose produces nothing", () => {
    expect(linkRefs("just words, and a colon: here")).toEqual([]);
    expect(linkRefs(null)).toEqual([]);
  });
});

describe("collectLinks", () => {
  // THE BUG. The collector read the room's records only, and the room stopped being the
  // conversation when the session took the panel over — so the links an agent had just put on his
  // screen were in the one place it never looked.
  it("lists links from the live session, not only the room", () => {
    const out = collectLinks({
      records: [said("old :file[src/old.js]", 1000)],
      rows: [say("new :file[src/new.js]", 2000)],
    });
    expect(out.map((e) => e.label)).toEqual(["src/new.js", "src/old.js"]);
  });

  it("puts the newest thing on top whichever surface it came from", () => {
    const out = collectLinks({
      records: [said("a :file[a.js]", 1000)],
      rows: [say("b :file[b.js]", 2000), say("c :file[c.js]", 4000)],
    });
    expect(out.map((e) => e.label)).toEqual(["c.js", "b.js", "a.js"]);
  });

  it("gives every link its own row, in reading order inside one message", () => {
    const out = collectLinks({ records: [], rows: [say(":file[a.js] then :file[b.js]", 10)] });
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.label)).toEqual(["a.js", "b.js"]);
  });

  it("keeps the newest mention of the same thing and drops the rest", () => {
    const out = collectLinks({
      records: [],
      rows: [say(":file[a.js]", 1000), say(":file[a.js]", 5000), say(":file[b.js]", 2000)],
    });
    expect(out.map((e) => [e.label, e.ts])).toEqual([
      ["a.js", 5000],
      ["b.js", 2000],
    ]);
  });

  it("treats the same path in two projects as two things", () => {
    const out = collectLinks({
      records: [],
      rows: [say(":file[a.js]{project=buAPI}", 1000), say(":file[a.js]{project=systemview}", 2000)],
    });
    expect(out).toHaveLength(2);
  });

  it("lists no report rows — the TV's own header is where a report is picked", () => {
    const out = collectLinks({ records: [show("Nav", 1000), show("Nav", 4000)], rows: [] });
    expect(out).toEqual([]);
  });

  it("caps the list, keeping the newest", () => {
    const rows = Array.from({ length: 40 }, (_, i) => say(`:file[f${i}.js]`, 1000 + i));
    const out = collectLinks({ records: [], rows });
    expect(out).toHaveLength(LINK_LIMIT);
    expect(out[0].label).toBe("f39.js");
    expect(collectLinks({ records: [], rows, limit: 5 })).toHaveLength(5);
  });

  it("skips what was taken off the list, and the machinery", () => {
    const out = collectLinks({
      records: [show("Gone", 1000, { hidden: true }), { kind: "system", text: ":file[x.js]", ts: 1100 }],
      rows: [
        { kind: "tool", text: ":file[tool.js]", ts: 1200 },
        { kind: "think", text: ":file[think.js]", ts: 1300 },
        mine(":file[his.js]", 1400),
      ],
    });
    expect(out.map((e) => e.label)).toEqual(["his.js"]);
  });

  it("filters on what the row actually shows", () => {
    const records = [];
    const rows = [say("about :file[src/CodebaseNav.js] and https://ex.com/nav", 2000)];
    expect(collectLinks({ records, rows, q: "nav" }).map((e) => e.label)).toEqual([
      "src/CodebaseNav.js",
      "ex.com/nav",
    ]);
    expect(collectLinks({ records, rows, q: "nothing here" })).toEqual([]);
  });

  it("survives an empty call", () => {
    expect(collectLinks()).toEqual([]);
  });
});
