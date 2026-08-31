import { probeEmbedFor } from "./Feed";
import { parseSteps } from "../../atoms/Markdown/blocks/runSteps";
import { parseSvCommand } from "./svCommand";
import { foldEvents } from "./feedRows";

describe("a probe row opens as an already-ran run block", () => {
  const row = {
    sv: parseSvCommand(`systemview probe TestService.Math.add '{"a":2,"b":3}'`),
    output: "{\n  \"sum\": 5\n}",
  };
  it("writes the namespace, the args and the printed result as the step's = line", () => {
    const md = probeEmbedFor(row);
    expect(md).toBe(':::run{title="probe TestService.Math.add"}\n- TestService.Math.add {"a":2,"b":3}\n  = {"sum":5}\n:::');
  });
  it("and the run grammar reads that = line back as the step's recorded result", () => {
    const src = probeEmbedFor(row).split("\n").slice(1, -1).join("\n");
    const steps = parseSteps(src);
    expect(steps).toHaveLength(1);
    expect(steps[0].ns).toBe("TestService.Math.add");
    expect(steps[0].hasResult).toBe(true);
    expect(steps[0].result).toEqual({ sum: 5 });
  });
  it("spreads a JSON array into the call form — positional arguments, not one array", () => {
    const r = { sv: parseSvCommand(`systemview probe TestService.Math.combine '[{"a":10},{"b":32}]'`), output: "{\"sum\":42}" };
    expect(probeEmbedFor(r)).toBe(':::run{title="probe TestService.Math.combine"}\n- TestService.Math.combine({"a":10}, {"b":32})\n  = {"sum":42}\n:::');
  });
  it("reads the answer past the CLI's own log lines", () => {
    const r = { sv: parseSvCommand("systemview probe TestService.Math.add '{\"a\":2,\"b\":3}'"), output: "  ℹ  systemview-test:TestService.Math.add([{\"a\":2,\"b\":3}])\n  ✔  result:\n{\"sum\":5}" };
    expect(probeEmbedFor(r)).toContain('= {"sum":5}');
  });
  it("is not a probe embed for anything else", () => {
    expect(probeEmbedFor({ sv: parseSvCommand("systemview test buAPI Users") })).toBeNull();
  });
});


describe("a tool row takes its output from the host's `detail`", () => {
  it("so a probe row carries what the CLI printed", () => {
    const rows = foldEvents([
      { kind: "tool.call", id: "t1", name: "Bash", input: { command: `systemview probe TestService.Math.divide '{"a":84,"b":2}'` }, ts: 1 },
      { kind: "tool.result", id: "t1", ok: true, detail: "{\n  \"quotient\": 42\n}", ts: 2 },
    ]);
    const row = rows.find((r) => r.kind === "tool");
    expect(row.output).toContain("quotient");
    expect(probeEmbedFor(row)).toContain('= {"quotient":42}');
  });
});
