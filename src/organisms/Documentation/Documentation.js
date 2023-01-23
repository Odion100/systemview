import MethodDocumentation from "../MethodDocumentation/MethodDocumentation";
import Title from "../../atoms/Title/Title";
import "./styles.scss";

const Documentation = ({ serviceId, moduleName, methodName }) => {
  return (
    <section className="documentation">
      {methodName && moduleName && serviceId ? (
        <MethodDocumentation
          methodName={methodName}
          moduleName={moduleName}
          serviceId={serviceId}
        />
      ) : moduleName && serviceId ? (
        <MethodDocumentation moduleName={moduleName} serviceId={serviceId} />
      ) : serviceId ? (
        <MethodDocumentation serviceId={serviceId} />
      ) : (
        <Title text={`Default Documentation`} />
      )}
    </section>
  );
};

export default Documentation;
