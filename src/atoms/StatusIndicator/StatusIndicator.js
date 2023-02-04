import "./styles.scss";

export function SavedFile({ name }) {
  return (
    <span className="status-indicator saved-message">
      <span className="status-indicator__title">Saved Test 1</span>
      <span className="status-indicator__clear-button btn">×</span>
    </span>
  );
}

export function ErrorStatus({ message }) {
  return <span className="status-indicator">{message}</span>;
}
