// Shared number formatting for the extracted chart components (and the Stats page they came from).
export const fmtInt = (n) => (n == null ? "—" : Math.round(n).toLocaleString());
export const fmtMs = (n) => (n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);
export const fmtPct = (n) => (n == null ? "—" : `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`);
