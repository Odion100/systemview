import { addVariant } from "../tileRegistry";
import TILES_A from "./a";
import TILES_B from "./b";
import TILES_C from "./c";

// THE INVENTORY, IN ONE PLACE. Importing this file is what puts the tiles on the surface; no tile
// registers itself from its own module, because then what exists would depend on what happened
// to be imported and "what can I put on a page" would stop being a question you can grep.
//
// THE THREE LANES EACH NAMED THEIR OWN VARIANTS and they did not agree on a format — "A — the
// masthead gauge", "B · the tide", "The shelves". That is normalised HERE rather than by going
// back and editing three lanes' files: the switch is asking *whose version of this*, so every
// label reads the same way and the kind's own name is already on the tile above it.
const SOURCE = [
  ["a", "A · one track", TILES_A],
  ["b", "B · the floor", TILES_B],
  ["c", "C · the shelves", TILES_C],
];

let done = false;

/**
 * Register every tile. Idempotent — `addVariant` overwrites by key, and a second call from a
 * second import must not double anything or throw.
 */
export function registerTiles() {
  if (done) return;
  done = true;
  for (const [variant, label, tiles] of SOURCE) {
    for (const t of tiles || []) {
      // The lane's own `variant` is trusted over the folder it came from only if they agree —
      // they always have, and a mismatch is a mistake worth failing loudly rather than filing a
      // tile under a page it did not come from.
      if (t.variant !== variant) throw new Error(`tile ${t.kind}/${t.variant} is in folder ${variant}`);
      addVariant(t.kind, variant, { label, Component: t.Component });
    }
  }
}

registerTiles();

export default registerTiles;
