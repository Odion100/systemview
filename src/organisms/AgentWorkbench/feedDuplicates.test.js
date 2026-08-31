import { foldEvents } from "./feedRows";

const says = (rows) => rows.filter((r) => r.kind === "say").map((r) => r.text);

describe("a streamed answer must render ONCE", () => {
  it("stream then settle — the live shape autobot emits", () => {
    const rows = foldEvents([
      { kind: "assistant.text", delta: "Hel", done: false, ts: 1 },
      { kind: "assistant.text", delta: "lo", done: false, ts: 2 },
      { kind: "assistant.text", delta: "", done: true, text: "Hello", ts: 3 },
    ]);
    expect(says(rows)).toEqual(["Hello"]);
  });

  it("a tool call between the stream and the settle must not split it in two", () => {
    const rows = foldEvents([
      { kind: "assistant.text", delta: "Hel", done: false, ts: 1 },
      { kind: "assistant.text", delta: "lo", done: false, ts: 2 },
      { kind: "tool.call", id: "t1", name: "Bash", input: { command: "ls" }, ts: 3 },
      { kind: "assistant.text", delta: "", done: true, text: "Hello", ts: 4 },
    ]);
    expect(says(rows)).toEqual(["Hello"]);
  });

  it("history seeded AND the same message arriving live is still one message", () => {
    const rows = foldEvents([
      { kind: "assistant.text", done: true, delta: "", text: "Hello", ts: 10, replay: true },
      { kind: "assistant.text", done: true, delta: "", text: "Hello", ts: 10 },
    ]);
    expect(says(rows)).toEqual(["Hello"]);
  });
});

describe("an opened tool row knows what to embed", () => {
  it("carries the repo-relative path and, for a Read, the lines it looked at", () => {
    const cwd = "/Users/x/proj";
    const rows = foldEvents([
      { kind: "tool.call", id: "a", name: "Read", input: { file_path: `${cwd}/src/a.js`, offset: 40, limit: 20 }, cwd, ts: 1 },
      { kind: "tool.call", id: "b", name: "Edit", input: { file_path: `${cwd}/src/b.js`, old_string: "x", new_string: "y" }, cwd, ts: 2 },
      { kind: "tool.call", id: "c", name: "Read", input: { file_path: "/etc/hosts" }, cwd, ts: 3 },
    ]);
    const tools = rows.filter((r) => r.kind === "tool");
    expect(tools[0]).toMatchObject({ rel: "src/a.js", span: "40-59", wrote: false });
    expect(tools[1]).toMatchObject({ rel: "src/b.js", wrote: true });
    expect(tools[2].rel).toBeNull(); // outside the repo: button only, no embed
  });
});

describe("a bash row names its file too", () => {
  const cwd = "/Users/x/proj";
  const bash = (command, ts) => ({ kind: "tool.call", id: `b${ts}`, name: "Bash", input: { command }, cwd, ts });
  it("sed -n / awk NR / cat / grep resolve to a file and a line window", () => {
    const rows = foldEvents([
      bash("export PATH=x; cd /Users/x/proj; sed -n '40,60p' src/a.js", 1),
      bash("awk 'NR>=10 && NR<=30' src/b.js", 2),
      bash("cat src/c.js | head -5", 3),
      bash("grep -n foo src/d.js", 4),
      bash("git status --porcelain", 5),
      bash("python3 - <<'PY'\nprint(1)\nPY", 6),
    ]).filter((r) => r.kind === "tool");
    expect(rows[0]).toMatchObject({ rel: "src/a.js", span: "40-60", wrote: false });
    expect(rows[1]).toMatchObject({ rel: "src/b.js", span: "10-30" });
    expect(rows[2].rel).toBe("src/c.js");
    expect(rows[3].rel).toBe("src/d.js");
    expect(rows[4].rel).toBeNull();
    expect(rows[5].rel).toBeNull();
  });
  it("sed -i and redirects are writes, so the row embeds a diff", () => {
    const rows = foldEvents([bash("sed -i '' 's/a/b/' src/e.js", 1), bash("echo hi > src/f.js", 2)]).filter((r) => r.kind === "tool");
    expect(rows[0]).toMatchObject({ rel: "src/e.js", wrote: true });
    expect(rows[1]).toMatchObject({ rel: "src/f.js", wrote: true });
  });
});
