import { parseSvCommand } from "./svCommand";

describe("recognising a SystemView command in a shell line", () => {
  it("reads the verb, the project and the subject through the PATH export we all prefix with", () => {
    // Leading environment setup is throat-clearing, not a command. Every agent shell here opens
    // with the PATH export because the sandbox forgets it between calls, and refusing the line for
    // that reason meant every real systemview action rendered as a plain bash row.
    expect(
      parseSvCommand('export PATH="/x/bin:$PATH"; node cli/index.js nav systemview-test /specs/x'),
    ).toMatchObject({ verb: "nav", project: "systemview-test", target: "/specs/x" });
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
    // Anything riding behind the act must be a read-only output filter, or the whole line stays
    // plain. A friendly "moved the window" row must never be the costume on a line that also
    // deletes something.
    expect(parseSvCommand("systemview nav x /y && rm -rf /")).toBeNull();
    expect(parseSvCommand("rm -rf / && systemview nav x /y")).toBeNull();
    expect(parseSvCommand('systemview say bob "hi" --as me; echo "exit: $?"')).toMatchObject({
      verb: "say",
      as: "me",
    });
  });
});

describe("RFC-051 — the renamed verb still renders as a message", () => {
  it("tell parses exactly like say did, and say still parses for old transcripts", () => {
    expect(parseSvCommand('systemview tell bob "hi" --as me')).toMatchObject({ verb: "tell", project: "bob", as: "me" });
    expect(parseSvCommand('systemview say bob "hi" --as me')).toMatchObject({ verb: "say", project: "bob", as: "me" });
    expect(parseSvCommand("systemview leave bob --as me")).toMatchObject({ verb: "leave", project: "bob" });
    expect(parseSvCommand("systemview kick bob intruder")).toMatchObject({ verb: "kick", project: "bob", target: "intruder" });
  });
});

describe("a room verb names its room — his spec: 'hashtag and project code'", () => {
  it("join/leave/kick carry the #tag; kick names who", () => {
    const { svRoomLine } = require("./svCommand");
    const p = (c) => svRoomLine(parseSvCommand(c));
    expect(p("systemview join buAPI --as systemview-test")).toBe("joined the room #buAPI");
    expect(p("systemview leave buAPI --as systemview-test")).toBe("left the room #buAPI");
    expect(p("systemview kick buAPI intruder")).toBe("cleared intruder from the room #buAPI");
  });
});
