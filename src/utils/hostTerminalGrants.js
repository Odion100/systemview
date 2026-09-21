import { getHub } from "./hub";

// WHO MAY TYPE IN A TERMINAL — the window's side of the grant.
//
// The toggle is pressed here but it is NOT held here: the hub writes
// `~/.autobot/terminal-grants.json` and consults it on every keystroke an agent sends. That split is
// the whole point. The hub's module surface is reachable by every agent in every room, so a gate
// living in React state or localStorage would be a gate an agent never has to pass — it would look
// like a control and protect nothing.
//
// What the window owns is the DECISION and the DISPLAY: he picks, and the terminal says whose
// keyboard it is. Absence is denial everywhere — no hub, no answer, no entry, all mean nobody.
const hub = () => {
  const h = getHub();
  return h && typeof h.terminalGrants === "function" ? h : null;
};

export const canGrantTerminals = () => !!hub();

export async function terminalGrants() {
  const h = hub();
  if (!h) return {};
  try {
    const r = await h.terminalGrants("");
    return (r && r.grants) || {};
  } catch {
    return {};
  }
}

// One verb for grant, regrant and kick-out: "who may type here" has one answer at a time, and a
// separate revoke would be a second way to say the same thing. Pass no agent to take it back.
export async function setTerminalGrant({ session, agent, by } = {}) {
  const h = hub();
  if (!h) return { ok: false, error: "the hub is not connected" };
  try {
    return await h.setTerminalGrant("", { session, agent: agent || "", by: by || "", on: !!agent });
  } catch (e) {
    return { ok: false, error: (e && e.message) || "could not write the grant" };
  }
}
