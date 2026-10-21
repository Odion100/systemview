import { reportScope } from "./reportScope";

describe("reportScope — the report pane's document identity", () => {
  const host = { serviceId: "sv" };
  const doc = { path: "meetings/2026-10-19-goals-in-parallel.md", name: "goals" };

  // THE FIELD THAT WENT MISSING. Everything else here was always passed.
  it("carries the document's path, which is what makes the send door work", () => {
    expect(reportScope({ projectCode: "systemview-test", host, moduleName: null, methodName: null, doc }).docPath).toBe(
      "meetings/2026-10-19-goals-in-parallel.md"
    );
  });

  it("carries the rest of what the renderer needs", () => {
    const s = reportScope({ projectCode: "systemview-test", host, moduleName: "Locations", methodName: "save", doc });
    expect(s.projectCode).toBe("systemview-test");
    expect(s.serviceId).toBe("sv");
    expect(s.moduleName).toBe("Locations");
    expect(s.methodName).toBe("save");
  });

  // AN EMPTY PATH IS THE HONEST ANSWER. A guessed one would send somebody an update about a file
  // that is not there, which is worse than a refusal.
  it("is empty rather than invented when there is no document", () => {
    expect(reportScope({ projectCode: "x", host }).docPath).toBe("");
    expect(reportScope({ projectCode: "x", host, doc: {} }).docPath).toBe("");
    expect(reportScope().docPath).toBe("");
  });

  it("survives being called with nothing rather than throwing inside a render", () => {
    expect(reportScope()).toEqual({ projectCode: "", serviceId: null, moduleName: null, methodName: null, docPath: "" });
  });
});
