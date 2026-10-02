// SKILL SOURCES — the grouping the skills section renders, as a pure function.
//
// A skill's name told you nothing about where it came from or whether it can actually fire. The
// harness answers two doors now: `skills(agentId)` (each skill carrying `source`, `writable`,
// `discoverable`, `sourceNote`) and `skillSources(agentId)` (the source itself — its pattern, what
// the pattern resolved to, and whether it resolved at all). This file turns the two lists into the
// rows the section draws, and it is the only place the three truths are kept apart:
//
//   ABSENT     — `unresolved`: the pattern matched nothing on disk RIGHT NOW. The shipped source is
//                keyed to the CLI version and a content hash, so it genuinely disappears across an
//                upgrade. Saying "0 skills" about that is a lie about a folder that isn't there;
//                stating the absence is the whole reason the row exists, so the row never hides.
//   INERT      — `discoverable: false`: the files are on disk and readable, and the Skill tool will
//                never find them. Visible-but-inert is the failure this field exists to catch, so a
//                row that can't fire has to say so rather than look armed.
//   READ-ONLY  — `writable: false`: you can read every line and learn what's in the kit; the write
//                is refused. Separate from both of the above — a read-only source is perfectly
//                healthy.
//
// An old harness answers neither door richly: no sources at all, skills with no `source`. That case
// returns ONE row with `name: null`, which the section renders as the flat list it has always been.
const asList = (v) => (Array.isArray(v) ? v : []);

// `writable`/`discoverable` default to TRUE when absent: an old harness says nothing about either,
// and a chip that silently went read-only because a field was missing would be the same dishonesty
// in the other direction.
const yes = (v) => v !== false;

const row = (src, skills) => {
  const unresolved = src.unresolved === true;
  const discoverable = yes(src.discoverable);
  return {
    name: src.name || null,
    pattern: src.pattern || "",
    note: src.note || "",
    dirs: asList(src.dirs),
    writable: yes(src.writable),
    discoverable,
    unresolved,
    // The count we show is what we actually drew — not what the source claimed. `claimed` keeps the
    // source's own number when the two disagree, so a disagreement is visible instead of silent.
    count: skills.length,
    claimed: typeof src.count === "number" && src.count !== skills.length ? src.count : null,
    skills,
    // One word for the row's state, worst first, for the class modifier. The flags above stay
    // readable on their own — a source can be both absent and inert, and the header says both.
    status: unresolved ? "absent" : !discoverable ? "inert" : "ok",
  };
};

// The rows, in the order the host returned the sources. Sources the host named come first (even the
// empty ones — an absent source is a statement); anything a skill claims as its source that the host
// did not name follows, synthesized off the skill itself so nothing is dropped on the floor.
export const groupSkillsBySource = (skills, sources) => {
  const all = asList(skills);
  const named = asList(sources);
  const taken = new Set();
  const rows = named.map((src) => {
    const mine = all.filter((s) => s.source && s.source === src.name);
    mine.forEach((s) => taken.add(s));
    return row(src, mine);
  });

  // Leftovers: a skill whose `source` no source row claims, grouped by the name it gives. Each
  // group's flags come off its own skills (they carry `writable`/`discoverable`/`sourceNote` too).
  const rest = all.filter((s) => !taken.has(s));
  const loose = [];
  for (const s of rest) {
    if (!s.source) continue;
    let hit = loose.find((g) => g.name === s.source);
    if (!hit) {
      hit = { name: s.source, note: s.sourceNote, writable: s.writable, discoverable: s.discoverable, skills: [] };
      loose.push(hit);
    }
    hit.skills.push(s);
  }
  loose.forEach((g) => rows.push(row(g, g.skills)));

  // Skills claiming no source at all. With no named sources either, this is the old harness: one
  // unheaded row, which renders as the flat list that was always there.
  const orphans = rest.filter((s) => !s.source);
  if (orphans.length || !rows.length) rows.push(row({ name: null }, orphans));
  return rows;
};

// What the header says about the count — ABSENCE is a sentence, not a zero.
export const sourceCountLabel = (r) =>
  r.unresolved ? "not on disk right now" : `${r.count} ${r.count === 1 ? "skill" : "skills"}`;

// The doc payload a skill opens as. One builder, three callers (the chip, the URL restore, and the
// skill just created) — they drifted into three copies of this object once already, and `readOnly`
// is exactly the field a fourth copy would forget.
export const skillDoc = (agentId, s) => ({
  kind: "skill",
  agentId,
  name: s.name,
  where: s.where,
  label: s.name,
  text: s.text,
  orig: s.text,
  // The backend refuses the write too, but offering an edit that will be refused is dishonest, so
  // the panel is told here and shows no save control at all.
  readOnly: s.writable === false,
});
