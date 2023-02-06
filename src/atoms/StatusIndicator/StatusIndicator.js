import "./styles.scss";

export function CurrentTest({ name, onClick }) {
  return (
    <span className="status-indicator saved-message">
      <span className="status-indicator__title">{name}</span>
      <span onClick={onClick} className="status-indicator__clear-button btn">
        ×
      </span>
    </span>
  );
}

export function ErrorStatus({ message }) {
  return <span className="status-indicator">{message}</span>;
}
