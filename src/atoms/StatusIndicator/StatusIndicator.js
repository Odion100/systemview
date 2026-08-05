import "./styles.scss";

// neutral = a NEW (unsaved) test: shows the namespace it's going to save under, quiet gray, no ×.
// onNameClick = the label is the SAVE-TARGET picker — click it to change where the test saves.
export function CurrentTest({ name, suffix, onClick, neutral, onNameClick }) {
  return (
    <span
      className={`status-indicator saved-message${neutral ? " status-indicator--neutral" : ""}`}
    >
      <span
        className={`status-indicator__title${onNameClick ? " status-indicator__title--clickable" : ""}`}
        onClick={onNameClick}
        title={onNameClick ? "Change the namespace this test saves under" : undefined}
      >
        {/* Same depiction as the center breadcrumb: grey segments, lighter dots, the LAST level (the
            one you're on) highlighted blue, and a full namespace ends as a call — method(…). */}
        {(() => {
          const parts = String(name).split(".");
          const isNs = parts.length > 1; // the "set namespace" placeholder gets no highlight
          return (
            <>
              {parts.map((part, i) => (
                <span key={i} className="status-indicator__seg">
                  {i > 0 && <span className="status-indicator__dot">.</span>}
                  <span
                    className={`status-indicator__seg-name${
                      isNs && i === parts.length - 1
                        ? " status-indicator__seg-name--active"
                        : ""
                    }`}
                  >
                    {part}
                  </span>
                </span>
              ))}
              {parts.length >= 3 && (
                <span className="status-indicator__paren">(…)</span>
              )}
            </>
          );
        })()}
      </span>
      {/* The saved slot (#N) never ellipses away — the namespace clips, the slot stays. */}
      {suffix && <span className="status-indicator__suffix">{suffix}</span>}
      {onClick && (
        <span onClick={onClick} className="status-indicator__clear-button btn">
          ×
        </span>
      )}
    </span>
  );
}

export function ErrorStatus({ message }) {
  return <span className="status-indicator">{message}</span>;
}
