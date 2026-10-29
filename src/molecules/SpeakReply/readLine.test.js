import { installReadLine } from "./readLine";
import { _reset, view } from "./speechQueue";

// THE READ LINE — sv:read speaks what the page says NOW, through the one queue, with the
// followers firing from the item starting. What these pin: the live read (text resolved at start
// time, never enqueue time), the honest skip (a gone element advances the line instead of
// speaking a ghost), and the follow switches (each follower declinable per batch).

// PLAIN FUNCTIONS, NO jest.fn — CRA sets `resetMocks: true`, which strips every jest.fn
// implementation before each test, so a factory built on jest.fn silently stops capturing (and a
// listener exception is swallowed by jsdom's dispatch, so it fails as empty arrays, not errors).
jest.mock("../../utils/voice", () => {
  const calls = [];
  return {
    __calls: calls,
    speak: (text, opts) => {
      calls.push({ text, opts });
      return { stop: () => {} };
    },
  };
});
jest.mock("../../utils/voicePref", () => ({
  readVoicePref: () => null,
  readVoiceSettings: () => ({ speed: 1 }),
}));

const { __calls: spoken } = require("../../utils/voice");

let uninstall;
beforeEach(() => {
  _reset();
  spoken.length = 0;
  document.body.innerHTML = "";
  Element.prototype.scrollIntoView = jest.fn();
  uninstall = installReadLine();
});
afterEach(() => uninstall && uninstall());

const read = (detail) => window.dispatchEvent(new CustomEvent("sv:read", { detail }));

describe("the read line", () => {
  it("a text item speaks through the queue", () => {
    read({ items: [{ text: "hello there" }] });
    expect(spoken.map((s) => s.text)).toEqual(["hello there"]);
  });

  it("a selector item speaks what the element says AT START TIME — the live read", () => {
    document.body.innerHTML = `<p id="a">first words</p>`;
    read({ items: [{ text: "opening" }, { selector: "#a" }] });
    // the selector item is lined up behind the text item; edit the page before its turn
    document.getElementById("a").textContent = "edited words";
    spoken[0].opts.onend(); // the first item finishes; the line advances
    expect(spoken.map((s) => s.text)).toEqual(["opening", "edited words"]);
  });

  it("an element gone by its turn is skipped and the line moves on", () => {
    document.body.innerHTML = `<p id="b">still here</p>`;
    read({ items: [{ selector: "#gone" }, { selector: "#b" }] });
    expect(spoken.map((s) => s.text)).toEqual(["still here"]);
  });

  it("the followers fire when the item starts: scroll and the bot's errand", () => {
    document.body.innerHTML = `<p id="c">read me</p>`;
    const points = [];
    const onPoint = (e) => points.push(e.detail);
    window.addEventListener("sv:agentPoint", onPoint);
    read({ projectCode: "pc", items: [{ selector: "#c", say: null }] });
    window.removeEventListener("sv:agentPoint", onPoint);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    // force: a read's errand is a direct instruction — it walks even with ambient animation off
    expect(points).toEqual([{ projectCode: "pc", target: { selector: "#c" }, say: null, force: true }]);
  });

  it("each follower declines separately", () => {
    document.body.innerHTML = `<p id="d">quiet read</p>`;
    const points = [];
    const onPoint = (e) => points.push(e.detail);
    window.addEventListener("sv:agentPoint", onPoint);
    read({ items: [{ selector: "#d" }], follow: { scroll: false, avatar: false } });
    window.removeEventListener("sv:agentPoint", onPoint);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(points).toEqual([]);
    expect(spoken.map((s) => s.text)).toEqual(["quiet read"]);
  });

  it("the shell's stat door exists while installed: view and clear", () => {
    expect(typeof window.__svReadLine.view).toBe("function");
    expect(typeof window.__svReadLine.clear).toBe("function");
    read({ items: [{ text: "one" }, { text: "two" }] });
    expect(window.__svReadLine.view().waiting.length).toBe(1);
    window.__svReadLine.clear();
    expect(view().playing).toBeNull();
  });
});
