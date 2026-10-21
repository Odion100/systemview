import { fenceLangOf } from "./chatFence";

describe("a fence says what it is", () => {
  it("reads the language the author wrote", () => {
    expect(fenceLangOf("```md")).toBe("md");
    expect(fenceLangOf("```javascript")).toBe("javascript");
  });

  it("tolerates the space people actually type", () => {
    expect(fenceLangOf("``` bash")).toBe("bash");
  });

  it("reads an indented fence, which is how one inside a list arrives", () => {
    expect(fenceLangOf("   ```json")).toBe("json");
  });

  // The function's own contract. NOTE: the chat renderer only OPENS backtick fences today, so
  // this branch is unreachable from it until that changes — it is here so the rule is whole, not
  // because a tilde fence currently renders.
  it("handles the tilde form, since markdown allows it", () => {
    expect(fenceLangOf("~~~python")).toBe("python");
  });

  it("keeps the characters real language names use", () => {
    expect(fenceLangOf("```objective-c")).toBe("objective-c");
    expect(fenceLangOf("```c++")).toBe("c++");
  });

  // NO GUESSING. The tag exists to be trusted; an invented language is worse than no tag.
  it("answers empty for a bare fence rather than inventing one", () => {
    expect(fenceLangOf("```")).toBe("");
    expect(fenceLangOf("```   ")).toBe("");
  });

  it("is not fooled by a line that merely mentions backticks", () => {
    expect(fenceLangOf("see the ```md fence above")).toBe("");
  });

  it("survives nothing at all", () => {
    expect(fenceLangOf(undefined)).toBe("");
    expect(fenceLangOf("")).toBe("");
  });
});
