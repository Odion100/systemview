import { resolveTarget, REGION_NAMES } from "../../../spotlightTargets";

// `:ui[scratchpad]` — a reference to a REGION of the window, the same weight as `:ns[…]` and
// `:file[…]`. It exists for his teaching case: "this is this panel, this is the story, this is the
// scratch pad" has to be sayable **on the fly**, without a built-in tour and without a new command.
// Naming the regions turns that into an ordinary sentence with references in it.
//
// Clicking points at it. Nothing navigates, nothing is written anywhere, and the highlight dies on
// its own — pointing is a gesture, not a decision (his rule).
// `{ label, attrs }` — the same signature every other reference block uses, so the chat's scanner
// and the markdown renderer can hand all of them identical props.
const UiLink = ({ label = "", attrs = {} }) => {
  const region = String(attrs.region || label || "").trim().toLowerCase();
  const known = REGION_NAMES.includes(region);

  // A REVEAL, not a performance. Clicking scrolls the region into view and nothing else — his
  // rule that links and animation are different things. When an AGENT names this region in a
  // message, the message's arrival is what animates it (see AgentChat), not this click.
  const reveal = () => {
    const el = resolveTarget({ region });
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <button
      type="button"
      className={`md-chip md-chip--ui${known ? "" : " md-chip--unknown"}`}
      title={known ? `Show the ${region}` : `Unknown region "${region}"`}
      onClick={reveal}
    >
      <span className="md-chip__kind">ui</span>
      {label || region}
    </button>
  );
};

export default UiLink;
