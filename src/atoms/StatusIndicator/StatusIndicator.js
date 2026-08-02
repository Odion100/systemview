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
        {name}
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
