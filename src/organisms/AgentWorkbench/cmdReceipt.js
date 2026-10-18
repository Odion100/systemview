// THE CMD RECEIPT VOCABULARY — one module owns both halves: what the chat SAYS when a :::cmd run
// ends (formatReceipt, AgentChat's tellRun) and how the feed READS the tone back off the line
// (receiptTone, the cmd row's border). Split across those two files these words would drift —
// and Feed cannot import AgentChat (AgentChat imports Feed) — so the vocabulary lives here, the
// same lift visitorColor took and for the same reason.
export function formatReceipt({ title, exit, ms, started, cancelled, error }) {
  const s = Math.round((ms || 0) / 1000);
  const dur = s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  const name = title ? `"${title}"` : "the command";
  if (cancelled) return `stopped ${name} after ${dur}`;
  if (!started) return `${name} didn't run — ${error || "the shell never opened"}`;
  return `ran ${name} — exit ${exit == null ? "?" : exit} · ${dur}`;
}

// ok | fail | mute — the block's own three faces (exit 0 is the only green, a non-zero exit is
// red, and stopped / didn't-run is neither).
export function receiptTone(text) {
  const t = String(text || "");
  if (/— exit 0 · /.test(t)) return "ok";
  if (/— exit \S+ · /.test(t)) return "fail";
  return "mute";
}
