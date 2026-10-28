import laneCook from "./laneCook";

// THE LANE PANEL'S COOKING LINE. These are the cases the panel could not answer before: a subagent
// mid-tool reads as working, a finished run never does, and an idle lane adds no line at all.

describe("laneCook — a lane mid-turn says so", () => {
  it("a tool in flight is working, and names what is in flight", () => {
    const st = laneCook([{ kind: "tool.call", name: "Edit", ts: 1 }]);
    expect(st).toBeTruthy();
    expect(st.state).toBe("working");
    expect(st.doing).toBeTruthy();
  });
  it("thinking is working", () => {
    expect(laneCook([{ kind: "assistant.thinking", ts: 1 }]).state).toBe("working");
  });
  it("a lane blocked on a permission is WAITING, not idle", () => {
    // The difference between a lane that needs something and a lane that died.
    expect(laneCook([{ kind: "permission.request", ts: 1 }]).state).toBe("waiting");
  });
});

describe("laneCook — when there is no line to draw", () => {
  it("no events, or none yet routed to this lane", () => {
    expect(laneCook(null)).toBe(null);
    expect(laneCook([])).toBe(null);
    expect(laneCook(undefined)).toBe(null);
  });
  it("a turn that finished is not cooking", () => {
    expect(laneCook([{ kind: "tool.call", name: "Edit", ts: 1 }, { kind: "result", ts: 2 }])).toBe(null);
  });
  // A CLOSED RUN WINS OVER A STALE WORKING EVENT. A finished lane still reading "thinking" is the
  // original complaint inverted — a surface testifying instead of reading.
  it("a closed run beats any working event still on the stream", () => {
    const busy = [{ kind: "tool.call", name: "Edit", ts: 1 }];
    expect(laneCook(busy)).toBeTruthy();
    expect(laneCook(busy, true)).toBe(null);
  });
  it("and finished is checked before the events, so it holds with no log at all", () => {
    expect(laneCook([], true)).toBe(null);
  });
});
