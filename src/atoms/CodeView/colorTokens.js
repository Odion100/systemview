// EVERY COLOUR IN A FILE, FOUND AND WRITTEN BACK IN ITS OWN NOTATION.
//
// His ask, ranked above everything else in the same breath: *"I need all colors in the code files to
// be like a color selector. I want to be able to see the colors and pick them. Whether it's in a CSS
// file, whether it's in a JSX file, wherever."*
//
// So this is deliberately NOT a CSS parser. A colour in this codebase appears in a `.scss` variable,
// a styled template literal, a JSX inline style, a chart's palette array, a comment someone left —
// and a parser that only understands declarations would find the first and miss the rest. The unit is
// the LITERAL, wherever it sits.
//
// THE WRITE-BACK RULE IS THE WHOLE DESIGN: a colour is replaced in the notation it was written in.
// `#fff` stays three digits, `rgb(…)` stays `rgb(…)`, a named colour becomes hex only when it has to.
// A picker that rewrote every colour to `#rrggbb` would churn the diff of every file it touched and
// quietly destroy the author's intent — `rgba()` written for a theme that composes alpha, a short hex
// kept short because the file is full of them. The picker is a lens, not a formatter.

// ---------------------------------------------------------------------------------------------
// WHAT COUNTS AS A COLOUR
//
// Four notations, and the order in the alternation matters: 8-digit hex must be tried before 6, and 6
// before 3, or `#aabbccdd` matches as `#aabbcc` plus stray text. The `(?![0-9a-f])` tail is what
// actually enforces it — without it `#aabbcc` inside `#aabbccdd` wins on a shorter match.
//
// NAMED COLOURS ARE DELIBERATELY NARROW. The full CSS list is 148 names, and most of them
// (`tomato`, `linen`, `thistle`) appear in English prose far more often than in code — decorating the
// word "tomato" in a comment is noise that teaches you to ignore the swatches. This is the set that
// actually appears as a colour in this codebase, plus the handful nobody writes by accident.
const NAMED = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff",
  yellow: "#ffff00", orange: "#ffa500", purple: "#800080", gray: "#808080", grey: "#808080",
  silver: "#c0c0c0", maroon: "#800000", olive: "#808000", lime: "#00ff00", aqua: "#00ffff",
  cyan: "#00ffff", teal: "#008080", navy: "#000080", fuchsia: "#ff00ff", magenta: "#ff00ff",
  crimson: "#dc143c", indigo: "#4b0082", violet: "#ee82ee", gold: "#ffd700", pink: "#ffc0cb",
  brown: "#a52a2a", beige: "#f5f5dc", ivory: "#fffff0", khaki: "#f0e68c", salmon: "#fa8072",
  coral: "#ff7f50", turquoise: "#40e0d0", lavender: "#e6e6fa", plum: "#dda0dd",
  darkred: "#8b0000", darkgreen: "#006400", darkblue: "#00008b", darkgray: "#a9a9a9",
  darkgrey: "#a9a9a9", lightgray: "#d3d3d3", lightgrey: "#d3d3d3", lightblue: "#add8e6",
  lightgreen: "#90ee90", dodgerblue: "#1e90ff", steelblue: "#4682b4", tomato: "#ff6347",
  transparent: "#00000000",
};

const NAMES = Object.keys(NAMED).sort((a, b) => b.length - a.length); // longest first: darkgray before gray

// `\b` is wrong for the hex case — `#` is already a non-word char, so `\b#fff` never matches. The
// guard that matters is the one AFTER: a hex colour must not be followed by another hex digit.
export const COLOR_RE = new RegExp(
  [
    "#[0-9a-fA-F]{8}(?![0-9a-fA-F])",
    "#[0-9a-fA-F]{6}(?![0-9a-fA-F])",
    "#[0-9a-fA-F]{4}(?![0-9a-fA-F])",
    "#[0-9a-fA-F]{3}(?![0-9a-fA-F])",
    // rgb/rgba and hsl/hsla, both the comma form and the CSS4 space form, with an optional
    // `/ alpha`. Deliberately permissive about whitespace, because real files are.
    "rgba?\\(\\s*[-\\d.%]+(?:\\s*[, ]\\s*[-\\d.%]+){2}(?:\\s*[,/]\\s*[\\d.%]+)?\\s*\\)",
    "hsla?\\(\\s*[-\\d.]+(?:deg|rad|turn|grad)?(?:\\s*[, ]\\s*[-\\d.%]+){2}(?:\\s*[,/]\\s*[\\d.%]+)?\\s*\\)",
    // A named colour needs word boundaries on BOTH sides or `red` matches inside `borderRadius`.
    `\\b(?:${NAMES.join("|")})\\b`,
  ].join("|"),
  "g",
);

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const hex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");

// A number that may be a percentage. `50%` of 255 is 127.5 — rounded once, at the end.
const num = (raw, scale) => {
  const t = String(raw).trim();
  if (t.endsWith("%")) return (parseFloat(t) / 100) * scale;
  return parseFloat(t);
};

const hslToRgb = (h, s, l) => {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = clamp(s, 0, 1);
  const ll = clamp(l, 0, 1);
  if (ss === 0) return [ll * 255, ll * 255, ll * 255];
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const chan = (t0) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [chan(hh + 1 / 3) * 255, chan(hh) * 255, chan(hh - 1 / 3) * 255];
};

// Split the inside of a functional notation. Handles `1,2,3`, `1 2 3`, and `1 2 3 / 0.5`.
const parts = (inner) =>
  inner
    .replace("/", " ")
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------------------------
// PARSE — a colour literal to { hex, alpha, kind }, or null.
//
// `hex` is always `#rrggbb` because that is the one form `<input type="color">` accepts. `alpha` is
// kept SEPARATELY rather than folded into the hex, because a native colour input cannot show or edit
// alpha — so an rgba() must come back with its original alpha intact or the picker silently makes
// everything opaque. That was the first thing this got wrong.
export const parseColor = (raw) => {
  if (!raw) return null;
  const t = String(raw).trim();
  const lower = t.toLowerCase();

  if (Object.prototype.hasOwnProperty.call(NAMED, lower)) {
    const h = NAMED[lower];
    return h.length === 9
      ? { hex: `#${h.slice(1, 7)}`, alpha: parseInt(h.slice(7), 16) / 255, kind: "named", name: lower }
      : { hex: h, alpha: 1, kind: "named", name: lower };
  }

  if (t[0] === "#") {
    const d = t.slice(1);
    const x = (i, n) => d.slice(i, i + n);
    if (d.length === 3) return { hex: `#${d[0]}${d[0]}${d[1]}${d[1]}${d[2]}${d[2]}`.toLowerCase(), alpha: 1, kind: "hex3" };
    if (d.length === 4)
      return {
        hex: `#${d[0]}${d[0]}${d[1]}${d[1]}${d[2]}${d[2]}`.toLowerCase(),
        alpha: parseInt(`${d[3]}${d[3]}`, 16) / 255,
        kind: "hex4",
      };
    if (d.length === 6) return { hex: `#${d}`.toLowerCase(), alpha: 1, kind: "hex6" };
    if (d.length === 8) return { hex: `#${x(0, 6)}`.toLowerCase(), alpha: parseInt(x(6, 2), 16) / 255, kind: "hex8" };
    return null;
  }

  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/i.exec(t);
  if (!fn) return null;
  const name = fn[1].toLowerCase();
  const p = parts(fn[2]);
  if (p.length < 3) return null;
  const alpha = p.length > 3 ? clamp(num(p[3], 1), 0, 1) : 1;

  if (name.startsWith("rgb")) {
    const [r, g, b] = [num(p[0], 255), num(p[1], 255), num(p[2], 255)];
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { hex: `#${hex2(r)}${hex2(g)}${hex2(b)}`, alpha, kind: name };
  }
  // hsl: the hue may carry a unit, and only deg/none are meaningful at this precision
  const h = parseFloat(p[0]);
  const sv = num(p[1], 1) / (String(p[1]).includes("%") ? 1 : 1);
  const lv = num(p[2], 1) / (String(p[2]).includes("%") ? 1 : 1);
  if ([h, sv, lv].some((n) => Number.isNaN(n))) return null;
  const [r, g, b] = hslToRgb(h, String(p[1]).includes("%") ? sv : sv, String(p[2]).includes("%") ? lv : lv);
  return { hex: `#${hex2(r)}${hex2(g)}${hex2(b)}`, alpha, kind: name };
};

// ---------------------------------------------------------------------------------------------
// FORMAT — the picked colour, back in the notation it replaced.
//
// This is the half that keeps the picker from being a reformatter. `kind` comes from the literal that
// was clicked, so the shape survives the edit even though the value does not.
export const formatColor = (hex, { kind = "hex6", alpha = 1, name = "" } = {}) => {
  const h = String(hex || "").trim().toLowerCase();
  const m = /^#([0-9a-f]{6})$/.exec(h);
  if (!m) return h;
  const d = m[1];
  const r = parseInt(d.slice(0, 2), 16);
  const g = parseInt(d.slice(2, 4), 16);
  const b = parseInt(d.slice(4, 6), 16);
  const a = clamp(alpha, 0, 1);
  // Alpha as CSS writes it: trimmed, never `0.500`.
  const astr = String(Math.round(a * 1000) / 1000);

  // A SHORT HEX STAYS SHORT ONLY IF IT CAN. `#abc` is exactly `#aabbcc`; a picked colour that does
  // not have that symmetry has to widen, and silently rounding it to the nearest 3-digit colour
  // would hand him a different colour than the one he chose.
  const canShorten = d[0] === d[1] && d[2] === d[3] && d[4] === d[5];

  switch (kind) {
    case "hex3":
      return canShorten ? `#${d[0]}${d[2]}${d[4]}` : `#${d}`;
    case "hex4":
      return canShorten && a === 1 ? `#${d[0]}${d[2]}${d[4]}` : a === 1 ? `#${d}` : `#${d}${hex2(a * 255)}`;
    case "hex8":
      return `#${d}${hex2(a * 255)}`;
    case "rgb":
      return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${astr})`;
    case "rgba":
      return `rgba(${r}, ${g}, ${b}, ${astr})`;
    case "hsl":
    case "hsla": {
      const [hh, ss, ll] = rgbToHsl(r, g, b);
      const body = `${hh}, ${ss}%, ${ll}%`;
      return kind === "hsla" || a !== 1 ? `hsla(${body}, ${astr})` : `hsl(${body})`;
    }
    // A NAMED COLOUR CANNOT SURVIVE AN EDIT, and that is honest rather than lossy: there is no name
    // for most colours, so picking a new one has to produce hex. It keeps its name only if he picked
    // the same colour back, which is the no-op case worth not churning.
    case "named":
      return name && NAMED[name] && NAMED[name].slice(0, 7) === `#${d}` && a === 1 ? name : `#${d}`;
    default:
      return a === 1 ? `#${d}` : `#${d}${hex2(a * 255)}`;
  }
};

const rgbToHsl = (r, g, b) => {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

// ---------------------------------------------------------------------------------------------
// FIND THEM ALL — used by the tests and by anything that wants a count without a CodeMirror view.
export const findColors = (text) => {
  const out = [];
  const re = new RegExp(COLOR_RE.source, "g");
  let m;
  while ((m = re.exec(String(text || "")))) {
    const parsed = parseColor(m[0]);
    if (parsed) out.push({ from: m.index, to: m.index + m[0].length, raw: m[0], ...parsed });
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
};

export default { COLOR_RE, parseColor, formatColor, findColors };
