import React, { useContext, useEffect, useState } from "react";
import ServiceContext from "../../ServiceContext";
import { Client } from "../../systemClient";
import MultiTestSection from "../MultiTestSection/MultiTestSection";
import TestController from "../TestPanel/components/TestController.class";
import { initializeSavedTests } from "../SavedTests/transformTests";
import Title from "../../atoms/Title/Title";
import "./styles.scss";

// RFC-020 — the CREATION surface for named actions. A named action = a name + an ordered list of steps
// (the same shape as a test's Before/Main/After). You build the steps here with the SAME machinery a test
// uses (MultiTestSection), name it, and Save → the service's plugin writes it to specs/actions/<name>.json.
// Saved actions list below; click one to load it back into the builder, × to delete.
const ActionsPanel = ({ serviceId, moduleName, methodName }) => {
  const namespace = { serviceId, moduleName, methodName };
  const { connectedServices } = useContext(ServiceContext);
  const serviceData = connectedServices.find((s) => s.serviceId === serviceId);
  const { Plugin } = serviceData
    ? Client.createService(serviceData.system.connectionData)
    : {};

  const [steps, setSteps] = useState([]);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState([]);
  const [msg, setMsg] = useState({ error: false, message: "" });

  // Steps live in slot 0 of a 4-slot FullTest so the target-value machinery (which expects
  // [Before,Main,Events,After]) keeps working while authoring.
  const FullTest = [steps, [], [], []];
  const StepsCtrl = new TestController({
    TestSection: steps,
    setState: setSteps,
    section: 0,
    FullTest,
    connectedServices,
  });

  const fetchActions = async () => {
    if (!Plugin || !Plugin.getActions) return setSaved([]);
    try {
      setSaved((await Plugin.getActions(namespace)) || []);
    } catch {
      setSaved([]);
    }
  };
  useEffect(() => {
    fetchActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, moduleName, methodName, connectedServices]);

  // Serialize live Test instances to the on-disk step shape (mirrors FullTestController.saveTests).
  const serialize = (section) =>
    section.map((t) => {
      const { args, evaluations = [], namespace: ns, title } = t;
      return {
        args,
        namespace: ns,
        title,
        savedEvaluations: (evaluations || [])
          .filter((e) => e.save)
          .map(({ namespace, expected_type, validations, save, indexed }) => ({
            namespace,
            expected_type,
            validations,
            save,
            indexed,
          })),
      };
    });

  const flash = (m) => {
    setMsg(m);
    setTimeout(() => setMsg({ error: false, message: "" }), 4000);
  };

  const save = async () => {
    if (!name.trim()) return flash({ error: true, message: "Name the action first." });
    if (!Plugin || !Plugin.saveAction)
      return flash({ error: true, message: "This service can't save actions yet (update the plugin)." });
    if (!steps.length) return flash({ error: true, message: "Add at least one step." });
    try {
      const res = await Plugin.saveAction({ name: name.trim(), namespace, steps: serialize(steps) });
      if (res && res.error) return flash(res);
      flash({ error: false, message: `Saved “${name.trim()}”` });
      setName("");
      setSteps([]);
      fetchActions();
    } catch (e) {
      flash({ error: true, message: "Save failed." });
    }
  };

  const load = async (a) => {
    const full = (Plugin && Plugin.getAction && (await Plugin.getAction(a.name))) || a;
    const [ft] = initializeSavedTests(
      [{ Before: full.steps || [], Main: [], Events: [], After: [], namespace: full.namespace || namespace }],
      connectedServices
    );
    setSteps(ft.Before);
    setName(full.name);
  };

  const remove = async (a) => {
    if (Plugin && Plugin.deleteAction) await Plugin.deleteAction(a.name);
    fetchActions();
  };

  return (
    <section className="actions-panel">
      <div className="container">
        <div className="row actions-panel__head">
          <Title text="Named Actions" />
        </div>
        <div className="row actions-panel__namebar">
          <input
            className="actions-panel__name"
            placeholder="action name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className="actions-panel__save btn" onClick={save}>
            Save action
          </button>
        </div>
        {msg.message && (
          <div className={`actions-panel__msg actions-panel__msg--error-${msg.error}`}>{msg.message}</div>
        )}

        <div className="row test-panel__section">
          <MultiTestSection dynamic caption="Steps" TestSection={steps} TestController={StepsCtrl} />
        </div>

        <div className="actions-panel__saved">
          <div className="actions-panel__saved-title">
            Saved actions {saved.length ? `(${saved.length})` : ""}
          </div>
          {saved.length === 0 ? (
            <div className="actions-panel__empty">No saved actions here yet.</div>
          ) : (
            saved.map((a) => (
              <div key={a.name} className="actions-panel__item">
                <span
                  className="actions-panel__item-name"
                  title="Load into the builder"
                  onClick={() => load(a)}
                >
                  {a.name}
                </span>
                <span className="actions-panel__item-count">
                  {(a.steps || []).length} step{(a.steps || []).length === 1 ? "" : "s"}
                </span>
                <span className="actions-panel__item-del btn" title="Delete" onClick={() => remove(a)}>
                  ×
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="scroll-buffer" />
    </section>
  );
};

export default ActionsPanel;
