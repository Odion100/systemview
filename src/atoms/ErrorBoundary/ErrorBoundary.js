import React from "react";
import "./styles.scss";

// A PANEL THAT THROWS SHOULD GO GREY, NOT TAKE THE WINDOW.
//
// His card, found by use twice in one evening (2026-10-19): a tooltip read `c.status.by` on a card
// that had no account, and the whole window went — the chat, the tabs, the navigator, everything.
// React unmounts the ENTIRE tree on an uncaught render error unless something above it catches, and
// this app had zero boundaries: no `componentDidCatch`, no `getDerivedStateFromError`, anywhere.
//
// WHY A CLASS. There is no hook for this — `getDerivedStateFromError` and `componentDidCatch` are
// class-only, and that is still true in React 18. This is the one component in the app that has to
// be one, which is also why it is tiny: it holds no behaviour worth testing except the catch.
//
// WHAT IT DELIBERATELY DOES NOT DO: it does not retry on its own, and it does not swallow. The
// error is re-thrown into the console (`console.error`) exactly as React would, so a crash is still
// diagnosable from the devtools — the boundary changes who DIES, not who hears about it.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null, n: 0 };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    // The surface says WHAT failed; the console keeps the stack. A log that omits is a log that
    // lies, so the component stack rides along.
    try {
      // eslint-disable-next-line no-console
      console.error(`[${this.props.label || "panel"}] crashed and was contained:`, err, info && info.componentStack);
    } catch {}
    if (typeof this.props.onError === "function") {
      try {
        this.props.onError(err, info);
      } catch {}
    }
  }

  // RETRY IS A REMOUNT, not a re-render: the child's state is what crashed it, so handing the same
  // instance back its old state crashes it again. Bumping the key throws the subtree away.
  retry = () => this.setState((s) => ({ err: null, n: s.n + 1 }));

  render() {
    const { err } = this.state;
    const { label = "This panel", children, quiet = false } = this.props;
    if (!err) return <React.Fragment key={this.state.n}>{children}</React.Fragment>;
    // QUIET is for things drawn inside somebody else's layout — a markdown block in a paragraph
    // gets one small line, not a panel-sized notice shouting in the middle of a document.
    if (quiet)
      return (
        <span className="sv-boundary sv-boundary--quiet" title={String((err && err.message) || err)}>
          {label} could not be drawn — <button type="button" className="sv-boundary__retry" onClick={this.retry}>try again</button>
        </span>
      );
    return (
      <div className="sv-boundary" role="alert">
        <div className="sv-boundary__head">{label} stopped</div>
        {/* The MESSAGE, not a reassurance. "Something went wrong" tells him nothing he did not
            already know from the grey box. */}
        <div className="sv-boundary__why">{String((err && err.message) || err)}</div>
        <div className="sv-boundary__foot">
          <button type="button" className="sv-boundary__retry" onClick={this.retry}>
            try again
          </button>
          <span className="sv-boundary__note">the rest of the window kept running</span>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
