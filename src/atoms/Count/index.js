import "./styles.scss";
const CLASS_NAME = "count";

export default function Count({ count, stat, type }) {
  return (
    <span className={`${CLASS_NAME} ${CLASS_NAME}__${type}`}>
      {count} {stat && <span className={`${CLASS_NAME}__stat`}>{stat}</span>}
    </span>
  );
}
