// The animation layer's two halves, tested where they can actually be wrong: WHAT gets resolved,
// and whether a gesture leaves anything behind.
//
// The second one is the rule that matters most (his): "it should disappear on refresh". Pointing is
// a gesture, not a decision — a highlight must never persist, never edit a document, and never
// outlive the page. These tests are what stop that quietly regressing.

import { resolveTarget, REGION_NAMES } from "./spotlightTargets";
import { spotlight, clearSpotlight, animationMode, setAnimationMode } from "./spotlight";

// jsdom gives every element a zero-sized rect, which the spotlight correctly reads as "not on
// screen". Real geometry has to be faked to test the drawing at all.
const onScreen = (el, box = { left: 40, top: 60, width: 200, height: 30 }) => {
  el.getBoundingClientRect = () => ({
    ...box,
    right: box.left + box.width,
    bottom: box.top + box.height,
    x: box.left,
    y: box.top,
    toJSON: () => ({}),
  });
  return el;
};

const layer = () => document.getElementById("sv-spotlight");

beforeEach(() => {
  document.body.innerHTML = "";
  clearSpotlight();
  localStorage.clear();
});

describe("resolveTarget — semantic targets, never coordinates", () => {
  test("finds a region by its data-sv name", () => {
    document.body.innerHTML = `<div data-sv="scratchpad" id="sp"></div>`;
    expect(resolveTarget({ region: "scratchpad" })).toBe(document.getElementById("sp"));
  });

  test("a bare string is treated as a region first — what an agent is most likely to write", () => {
    document.body.innerHTML = `<div data-sv="nav" id="n"></div>`;
    expect(resolveTarget("nav")).toBe(document.getElementById("n"));
  });

  test("every advertised region name is real — the doc and the resolver can't drift", () => {
    expect(REGION_NAMES).toEqual(expect.arrayContaining(["nav", "center", "scratchpad", "tv", "chat"]));
  });

  test("a namespace matches loosely, and the MORE specific node wins", () => {
    document.body.innerHTML = `
      <div data-sv-ns="Other.Thing.add" id="wrong"></div>
      <div data-sv-ns="TestService.Math.add" id="right"></div>`;
    expect(resolveTarget({ namespace: "Math.add" })).toBe(document.getElementById("right"));
  });

  test("a bare method name still resolves — the CLI's fuzzy rule, same here", () => {
    document.body.innerHTML = `<div data-sv-ns="TestService.Math.add" id="a"></div>`;
    expect(resolveTarget({ namespace: "add" })).toBe(document.getElementById("a"));
  });

  test("a block resolves by its OWN id — the address nothing else can express", () => {
    document.body.innerHTML = `
      <div class="md-block" data-md-kind="leaf" data-md-name="question" id="q1"></div>
      <div class="md-block" data-md-kind="leaf" data-md-name="question" data-md-id="pick" id="q2"></div>`;
    expect(resolveTarget({ block: "pick" })).toBe(document.getElementById("q2"));
  });

  test("an unknown target resolves to nothing rather than guessing", () => {
    document.body.innerHTML = `<div data-sv="nav"></div>`;
    expect(resolveTarget({ region: "not-a-region" })).toBeNull();
    expect(resolveTarget({ block: "nope" })).toBeNull();
  });
});

describe("the setting is the human's", () => {
  test("defaults to subtle", () => {
    expect(animationMode("systemview-test")).toBe("subtle");
  });

  test("is per project — one project's choice never speaks for another", () => {
    setAnimationMode("a", "off");
    setAnimationMode("b", "full");
    expect(animationMode("a")).toBe("off");
    expect(animationMode("b")).toBe("full");
  });

  test("refuses a mode it doesn't know instead of storing nonsense", () => {
    setAnimationMode("a", "disco");
    expect(animationMode("a")).toBe("subtle");
  });
});

describe("spotlight — a gesture, not a decision", () => {
  test("draws on a visible target", () => {
    const el = onScreen(document.createElement("div"));
    document.body.appendChild(el);
    expect(spotlight({ target: el, mode: "subtle" })).toBe(true);
    expect(layer().querySelectorAll(".sv-spot__box").length).toBe(1);
  });

  test("mode 'off' draws nothing at all", () => {
    const el = onScreen(document.createElement("div"));
    document.body.appendChild(el);
    expect(spotlight({ target: el, mode: "off" })).toBe(false);
    expect(layer()).toBeNull();
  });

  test("an off-screen target gets NO gesture — better silent than a box around nowhere", () => {
    const el = onScreen(document.createElement("div"), { left: -900, top: -900, width: 10, height: 10 });
    document.body.appendChild(el);
    expect(spotlight({ target: el, mode: "full" })).toBe(false);
  });

  test("a zero-sized element is not a target", () => {
    const el = document.createElement("div"); // jsdom default: 0×0
    document.body.appendChild(el);
    expect(spotlight({ target: el, mode: "subtle" })).toBe(false);
  });

  test("'full' adds the line back to the bot, 'subtle' does not — the two modes are actually different", () => {
    const bot = onScreen(document.createElement("div"));
    bot.setAttribute("data-sv", "bot");
    document.body.appendChild(bot);
    const el = onScreen(document.createElement("div"));
    document.body.appendChild(el);
    spotlight({ target: el, mode: "full", from: '[data-sv="bot"]' });
    expect(layer().querySelectorAll(".sv-spot__line").length).toBe(1);
    spotlight({ target: el, mode: "subtle", from: '[data-sv="bot"]' });
    expect(layer().querySelectorAll(".sv-spot__line").length).toBe(0);
  });

  test("NEVER a caption over the target — what the agent says belongs in its dialogue box", () => {
    const el = onScreen(document.createElement("div"));
    document.body.appendChild(el);
    spotlight({ target: el, mode: "full" });
    expect(layer().querySelectorAll("text").length).toBe(0);
  });

  test("IT DISAPPEARS — clearing leaves nothing behind (his rule)", () => {
    const el = onScreen(document.createElement("div"));
    document.body.appendChild(el);
    spotlight({ target: el, mode: "full", label: "x" });
    expect(layer().childNodes.length).toBeGreaterThan(0);
    clearSpotlight();
    expect(layer().childNodes.length).toBe(0);
  });

  test("a refresh wipes a gesture in flight — pointing never outlives what it pointed at", () => {
    const el = onScreen(document.createElement("div"));
    document.body.appendChild(el);
    spotlight({ target: el, mode: "subtle" });
    expect(layer().childNodes.length).toBeGreaterThan(0);
    window.dispatchEvent(new CustomEvent("sv:refresh", { detail: { scope: "all" } }));
    expect(layer().childNodes.length).toBe(0);
  });

  test("the overlay never eats a click meant for the page underneath", () => {
    const el = onScreen(document.createElement("div"));
    document.body.appendChild(el);
    spotlight({ target: el, mode: "subtle" });
    expect(layer().style.pointerEvents).toBe("none");
  });

  test("pointing at one thing replaces the last gesture rather than stacking", () => {
    const a = onScreen(document.createElement("div"));
    const b = onScreen(document.createElement("div"), { left: 10, top: 10, width: 50, height: 20 });
    document.body.append(a, b);
    spotlight({ target: a, mode: "subtle" });
    spotlight({ target: b, mode: "subtle" });
    expect(layer().querySelectorAll(".sv-spot__box").length).toBe(1);
  });
});
