import { parseCommand, summarize, isRunnable } from "./cmdSource";

// THE BUILD INCANTATION — the reason this block exists. If it does not survive the parser byte for
// byte, the document is no longer carrying the command it claims to.
const BUILD =
  "BUILD_PATH=build.next NODE_OPTIONS=--max-old-space-size=4096 ./node_modules/.bin/react-scripts build && rm -rf build && mv build.next build";

describe("parseCommand", () => {
  it("keeps the command verbatim", () => {
    expect(parseCommand(BUILD)).toBe(BUILD);
  });

  it("keeps a multi-line body as separate lines", () => {
    expect(parseCommand("cd api\nyarn install\nyarn start")).toBe("cd api\nyarn install\nyarn start");
  });

  it("trims blank lines around the body without touching the inside", () => {
    expect(parseCommand("\n\nfirst\n\nsecond\n\n")).toBe("first\n\nsecond");
  });

  it("unwraps a fenced body, info string and all", () => {
    expect(parseCommand("```bash\n" + BUILD + "\n```")).toBe(BUILD);
    expect(parseCommand("~~~\nyarn test\n~~~")).toBe("yarn test");
  });

  it("leaves a lone backtick line alone rather than eating the command", () => {
    expect(parseCommand("echo `date`")).toBe("echo `date`");
  });

  it("preserves indentation inside the body", () => {
    expect(parseCommand("for f in *; do\n  echo $f\ndone")).toBe("for f in *; do\n  echo $f\ndone");
  });
});

describe("summarize", () => {
  it("shortens a long incantation for the heading", () => {
    const short = summarize(BUILD);
    expect(short.length).toBeLessThanOrEqual(60);
    expect(short.endsWith("…")).toBe(true);
    expect(short.startsWith("BUILD_PATH=build.next")).toBe(true);
  });

  it("skips comment lines to find the first real one", () => {
    expect(summarize("# rebuild the bundle\nyarn build")).toBe("yarn build");
  });
});

describe("isRunnable", () => {
  it("is false for an empty or comment-only block", () => {
    expect(isRunnable(parseCommand(""))).toBe(false);
    expect(isRunnable(parseCommand("\n  \n"))).toBe(false);
    expect(isRunnable(parseCommand("# nothing to do here"))).toBe(false);
  });

  it("is true once there is a command", () => {
    expect(isRunnable(parseCommand("# why\nyarn test"))).toBe(true);
  });
});
