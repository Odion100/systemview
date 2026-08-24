import { parseSvCommand } from "./svCommand";

describe("recognising a SystemView command in a shell line", () => {
  it("reads the verb, the project and the subject through the PATH export we all prefix with", () => {
    expect(
      parseSvCommand('export PATH="/x/bin:$PATH"; node cli/index.js nav systemview-test /specs/x'),
    ).toBeNull(); // after a `;` is a different command — deliberately not dressed up
    expect(parseSvCommand("node cli/index.js nav systemview-test /specs/x")).toMatchObject({
      verb: "nav",
      project: "systemview-test",
      target: "/specs/x",
    });
  });

  it("keeps a quoted title whole, because the title is the whole point of a show", () => {
    expect(parseSvCommand('systemview show autobot --text "The next iteration"')).toMatchObject({
      verb: "show",
      project: "autobot",
      target: "The next iteration",
    });
  });

  it("is not fooled by a shell command that merely mentions the word", () => {
    expect(parseSvCommand("grep systemview cli/index.js")).toBeNull();
    expect(parseSvCommand("systemview totallynotaverb x")).toBeNull();
    expect(parseSvCommand("yarn build")).toBeNull();
  });

  it("never dresses up what comes after a separator", () => {
    expect(parseSvCommand("systemview nav x /y && rm -rf /")).toMatchObject({ verb: "nav" });
    expect(parseSvCommand("rm -rf / && systemview nav x /y")).toBeNull();
  });
});
