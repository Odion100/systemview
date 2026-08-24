// WHO IS SPEAKING, IN COLOUR. His rule, from the room: *"everyone who's a visitor has the same
// color, so them cooking both is not as helpful."* Every visiting identity gets its own hue, derived
// from its name so it is the SAME colour everywhere it appears — bubbles, name tags, cooking lines,
// roster chips, system pills — with no table to keep in sync.
//
// Lifted out of AgentChat so the session feed can use it too: a peer agent's message arrives in a
// direct chat now, not only in a room, and it must be the same agent wearing the same colour in both
// places. Feed cannot import from AgentChat (AgentChat imports Feed), and a second copy of the hash
// would be two sources of truth for one fact.
export const visColor = (pc) => {
  let h = 0;
  for (const c of String(pc || "")) h = (h * 31 + c.charCodeAt(0)) % 360;
  if (Math.abs(h - 122) < 30) h = (h + 60) % 360; // keep clear of the cooking green
  return `hsl(${h}, 55%, 52%)`;
};

export const visStyle = (pc) => (pc ? { "--vis": visColor(pc) } : undefined);
