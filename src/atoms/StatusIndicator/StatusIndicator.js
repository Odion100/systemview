import "./styles.scss";

export function SavedFile({ name }) {
  return (
    <span className="status-indicator saved-message">
      Saved Test 1<span className="clear-button btn">x</span>
    </span>
  );
}

export function ErrorStatus({ message }) {
  return <span className="status-indicator error-message">{message}</span>;
}
