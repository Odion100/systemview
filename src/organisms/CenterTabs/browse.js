// THE + DOOR'S BROWSE BRAIN — pure, because the popup itself has no suite that renders it. His
// direction (2026-10-16): *"you gotta be able to really navigate through files nicely"* — so the
// input stops being a blind line you must already know the answer to: the directory part lists, the
// basename fragment filters, and the keyboard walks.

// What the typed string MEANS: which folder to list, which fragment filters it, and through which
// door (machine = absolute/~, project = relative). No slash yet → the project root, filtered.
export function browseSplit(input) {
  const s = String(input || "");
  if (!s.trim()) return { dir: null, frag: "", machine: false }; // empty input is recents' moment
  const machine = s.startsWith("/") || s.startsWith("~");
  const cut = s.lastIndexOf("/");
  if (cut === -1) {
    // "~" alone addresses home itself; anything else is a fragment against the project root.
    if (s === "~") return { dir: "~", frag: "", machine: true };
    return { dir: ".", frag: s, machine: false };
  }
  let dir = s.slice(0, cut);
  const frag = s.slice(cut + 1);
  if (machine && dir === "") dir = "/"; // "/usr" split → dir "/" not ""
  if (!machine && dir === "") return { dir: ".", frag, machine: false }; // "./x" style oddity
  return { dir, frag, machine };
}

// Dirs before files, prefix matches before substring ones, short list — a browse, not a search.
export function browseMatch(entries, frag, cap = 12) {
  const q = String(frag || "").toLowerCase();
  const rank = (e) => {
    const n = String(e.name || "").toLowerCase();
    if (!q) return 0;
    if (n.startsWith(q)) return 0;
    if (n.includes(q)) return 1;
    return -1;
  };
  return (entries || [])
    .map((e) => ({ e, r: rank(e) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => (b.e.dir === a.e.dir ? a.r - b.r || String(a.e.name).localeCompare(String(b.e.name)) : b.e.dir ? 1 : -1))
    .slice(0, cap)
    .map((x) => x.e);
}

// Joining a picked name back onto the directory, keeping the address form the user typed.
export function browseJoin(dir, name) {
  if (dir == null || dir === ".") return String(name || "");
  if (dir === "/") return `/${name}`;
  return `${dir}/${name}`;
}
