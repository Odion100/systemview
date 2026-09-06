import { foldState } from "./feedRows";

// The worklist is the harness's, not ours — so the fold has to be liberal about the shape and
// strict about one thing: the whole list arrives every time, and a late subscriber renders from a
// single event.
const ev = (kind, rest = {}) => ({ kind, ts: 1, ...rest });

describe("an agent's worklist folds off the session stream", () => {
  it("is null until a harness sends one — an empty checklist would read as a bug", () => {
    expect(foldState([ev("session.started", { model: "claude-opus-5" })]).todo).toBe(null);
  });

  it("reads the {text,state} shape", () => {
    const s = foldState([
      ev("todo.updated", { items: [{ id: "a", text: "fold the event", state: "active" }, { id: "b", text: "render it", state: "pending" }] }),
    ]);
    expect(s.todo).toEqual([
      { id: "a", text: "fold the event", state: "active" },
      { id: "b", text: "render it", state: "pending" },
    ]);
  });

  it("reads Claude Code's own {content,status} shape without translation upstream", () => {
    const s = foldState([
      ev("todo.updated", { items: [{ content: "ship it", status: "in_progress" }, { content: "done thing", status: "completed" }] }),
    ]);
    expect(s.todo.map((t) => t.state)).toEqual(["active", "done"]);
    expect(s.todo[0].text).toBe("ship it");
  });

  it("takes the WHOLE list from the newest event — never merges deltas", () => {
    const s = foldState([
      ev("todo.updated", { items: [{ text: "one" }, { text: "two" }, { text: "three" }] }),
      ev("todo.updated", { items: [{ text: "one", state: "done" }] }),
    ]);
    expect(s.todo).toEqual([{ id: "0", text: "one", state: "done" }]);
  });

  it("survives a shape nobody agreed on: `todos`, bare strings, missing states", () => {
    const s = foldState([ev("todos", { todos: ["write it", { title: "check it" }] })]);
    expect(s.todo).toEqual([
      { id: "0", text: "write it", state: "pending" },
      { id: "1", text: "check it", state: "pending" },
    ]);
  });

  it("drops empty rows rather than drawing blank lines", () => {
    const s = foldState([ev("todo.updated", { items: [{ text: "  " }, { text: "real" }] })]);
    expect(s.todo).toEqual([{ id: "1", text: "real", state: "pending" }]);
  });
});

describe("a worklist arrives as a TOOL CALL too — terminal sessions have the tool, not the event", () => {
  const ev = (kind, rest = {}) => ({ kind, ts: 1, ...rest });
  it("folds mcp__worklist__set's input.items exactly like the event", () => {
    const s = foldState([
      ev("tool.call", { tool: "mcp__worklist__set", input: { items: [{ id: "1", text: "fix it", state: "active" }, { id: "2", text: "ship it", state: "pending" }] } }),
    ]);
    expect(s.todo).toEqual([
      { id: "1", text: "fix it", state: "active" },
      { id: "2", text: "ship it", state: "pending" },
    ]);
  });
  it("the newest call wins over an older event, and vice versa — one list, latest writer", () => {
    const s = foldState([
      ev("todo.updated", { items: [{ text: "old", state: "done" }] }),
      ev("tool.call", { tool: "mcp__worklist__set", input: { items: [{ text: "new", state: "active" }] } }),
    ]);
    expect(s.todo).toEqual([{ id: "0", text: "new", state: "active" }]);
  });
  it("a tool call that isn't the worklist changes nothing", () => {
    const s = foldState([ev("tool.call", { tool: "Bash", input: { command: "ls", items: [1] } })]);
    expect(s.todo).toBe(null);
  });
});
