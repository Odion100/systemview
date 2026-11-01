// WHICH METER THE USAGE BAR'S FILL TRACKS.
//
// The default is "whichever is highest", because that is the one about to bite. The exception is
// the one that makes the bar keep working: **at 100, the highest UNDER 100 wins.**
//
// A maxed meter pins the fill full and holds it there for hours. A bar that cannot move says
// nothing about the meters that still can — and "how close is the next one" is the only thing left
// worth showing once one is spent. His call, and it costs nothing: a meter at 100 has already said
// what it has to say in the text beside the bar, in its own colour. The fill's job is the thing
// that is still changing.
//
// Everything at 100 falls back to the plain highest, which is 100 and correct: the bar is full
// because nothing is left that is not.

const highestOf = (bars) => bars.reduce((a, b) => (b.pct > a.pct ? b : a), bars[0]);

/**
 * `bars` is `[{label, pct}]`; `pick` is his explicit choice ("session" | "week" | "fable") or
 * anything else for the default. An explicit pick is honoured even at 100 — he asked for THAT
 * meter, and silently showing him a different one would be the surface overruling him.
 */
export function fillBar(bars, pick) {
  const list = Array.isArray(bars) ? bars.filter(Boolean) : [];
  if (!list.length) return null;
  const re = { session: /^session/i, week: /all models/i, fable: /fable/i }[pick];
  const chosen = re && list.find((b) => re.test(b.label));
  if (chosen) return chosen;
  const under = list.filter((b) => Number(b.pct) < 100);
  return under.length ? highestOf(under) : highestOf(list);
}
