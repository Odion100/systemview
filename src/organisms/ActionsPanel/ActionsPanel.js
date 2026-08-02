import React, { useContext, useEffect, useState } from "react";
import ServiceContext from "../../ServiceContext";
import { Client } from "../../systemClient";
import MultiTestSection from "../MultiTestSection/MultiTestSection";
import TestController from "../TestPanel/components/TestController.class";
import FullTestController from "../TestPanel/components/FullTestController";
import { initializeSavedTests } from "../SavedTests/transformTests";
import { TestAction } from "../Stage/TestStory";
import Title from "../../atoms/Title/Title";
import Count from "../../atoms/Count";
import { EditIcon, XButton } from "../../atoms/RunTestIcon";
import FoldContext from "../TestPanel/FoldContext";
import "./styles.scss";

// RFC-020 — the CREATION surface for named actions. A named action = ONE SECTION of a test — a name + an
// ordered list of steps. You build the steps with the SAME machinery a test section uses
// (MultiTestSection), name it, and Save → the service's plugin writes it to specs/actions/<name>.json.
// Saved actions render below as ActionCards — their own identity: a SECTION, displayed with the same
// step-card fidelity a saved test has, runnable on its own.
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
  // Same toolbar behaviors the Test tab's scratchpad has — expand/collapse all + clear results.
  const [fold, setFold] = useState({ signal: 0, open: true });
  const [allExpanded, setAllExpanded] = useState(true);
  const toggleFoldAll = () => {
    setFold((f) => ({ signal: f.signal + 1, open: !allExpanded }));
    setAllExpanded((e) => !e);
  };
  const clearResults = () => {
    steps.forEach((t) => t.clearResults());
    setSteps([...steps]);
  };

  // RFC-020 — the target-value machinery walks a sections object; while authoring an action its steps live
  // under `before` so within-action references (test.before[i].results) resolve.
  const FullTest = { before: steps };
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
      [{ Before: full.steps || [], namespace: full.namespace || namespace }],
      connectedServices
    );
    setSteps(ft.sections.before);
    setName(full.name);
    // Editing populates the builder — open it (and its steps) so you land on what you're editing, not a
    // collapsed section you have to expand first.
    setFold((f) => ({ signal: f.signal + 1, open: true }));
    setAllExpanded(true);
  };

  const remove = async (a) => {
    if (Plugin && Plugin.deleteAction) await Plugin.deleteAction(a.name);
    fetchActions();
  };

  return (
    // No inner `.container` — the parent (test-panel__body) IS the container. Nesting another one
    // double-padded everything, which is why the Actions tab sat indented vs the Test tab.
    <section className="actions-panel">
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
        {/* Fold-all + clear sit with the name/save controls — NOT a separate Run-all (the one section
            below has its own ▶ Run). */}
        <span className="actions-panel__tools">
          <button
            type="button"
            className="test-panel__icon-btn"
            title={allExpanded ? "Collapse steps" : "Expand steps"}
            onClick={toggleFoldAll}
          >
            {allExpanded ? "⊟" : "⊞"}
          </button>
          <button
            type="button"
            className="test-panel__icon-btn"
            title="Clear all results"
            onClick={clearResults}
          >
            Clear
          </button>
        </span>
      </div>
      {msg.message && (
        <div className={`actions-panel__msg actions-panel__msg--error-${msg.error}`}>{msg.message}</div>
      )}

      <FoldContext.Provider value={fold}>
        <div className="row test-panel__section">
          <MultiTestSection
            dynamic
            caption={name.trim() || "New action"}
            sectionTag="action"
            titleColor="#8e5aa8"
            TestSection={steps}
            TestController={StepsCtrl}
          />
        </div>
      </FoldContext.Provider>

      {saved.length > 0 && (
        <div className="actions-panel__saved">
          <div className="actions-panel__saved-title">
            Saved actions <Count count={saved.length} />
          </div>
          {saved.map((a) => (
            <ActionCard
              key={a.name}
              action={a}
              connectedServices={connectedServices}
              onEdit={() => load(a)}
              onDelete={() => remove(a)}
            />
          ))}
        </div>
      )}
      <div className="scroll-buffer" />
    </section>
  );
};

// RFC-020 — a saved action's card: its OWN identity. Not a test — ONE SECTION with steps. The header is
// the section (action tag + name + step count + Run/Edit/×); the steps are always on display below with
// the same per-step card a saved test uses (TestAction). Run executes just this section.
function ActionCard({ action, connectedServices, onEdit, onDelete }) {
  const [ft, setFt] = useState(null);
  const [ran, setRan] = useState(false);
  const [running, setRunning] = useState(false);
  // Collapsed by default and collapsing HIDES the steps outright (unlike a saved test's phase toggle,
  // which only shrinks them to previews) — many actions × many steps can't all sit expanded in this
  // tight panel. A FAILED run pops it open so the break is never hidden.
  const [open, setOpen] = useState(false);

  // The action IS a section: initialize it under its own name so its internal refs
  // (test.<name>[i].results) resolve, and run just that section.
  const build = React.useCallback(
    () =>
      initializeSavedTests(
        [
          {
            namespace: action.namespace,
            sections: { [action.name]: action.steps || [] },
            run: [action.name],
          },
        ],
        connectedServices
      )[0],
    [action, connectedServices]
  );

  useEffect(() => {
    setFt(build());
    setRan(false);
  }, [build]);

  const run = async () => {
    setRunning(true);
    const fresh = build();
    try {
      await new FullTestController({ FullTest: fresh, connectedServices }).runFullTest();
      setFt(fresh);
      setRan(true);
      if (fresh.sections[action.name].some((s) => (s.errors || []).length)) setOpen(true);
    } catch {}
    setRunning(false);
  };

  const steps = ft ? ft.sections[action.name] || [] : [];
  const failed = ran && steps.some((s) => (s.errors || []).length);

  return (
    <div
      className={`action-card ${
        running ? "action-card--running" : ran ? (failed ? "action-card--fail" : "action-card--pass") : ""
      }`}
    >
      <div className="action-card__head">
        <button type="button" className="action-card__fold" onClick={() => setOpen((o) => !o)}>
          <span className="action-card__caret">{open ? "▾" : "▸"}</span>
          <span className="action-card__name">{action.name}</span>
          <Count count={steps.length} />
        </button>
        {running ? (
          <span className="action-card__badge is-running">running…</span>
        ) : ran ? (
          <span className={`action-card__badge ${failed ? "is-fail" : "is-pass"}`}>
            {failed ? "failed" : "passed"}
          </span>
        ) : null}
        <span className="action-card__controls">
          <EditIcon onClick={onEdit} />
          <ActionDelete onConfirm={onDelete} />
          {ran && (
            <button
              type="button"
              className="action-card__clear"
              title="Clear run results"
              onClick={() => { setFt(build()); setRan(false); }}
              disabled={running}
            >
              Clear
            </button>
          )}
          <button type="button" className="action-card__run" onClick={run} disabled={running}>
            {running ? "…" : "▶ Run"}
          </button>
        </span>
      </div>
      {open && (
        <div className="action-card__steps">
          {steps.map((s, i) => (
            <TestAction key={i} action={s} ran={ran} phaseSig={0} phaseCollapsed={false} autoExpand={false} />
          ))}
        </div>
      )}
    </div>
  );
}

// Two-step confirm so a stray click never nukes a saved action.
function ActionDelete({ onConfirm }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return <XButton onClick={() => setConfirm(true)} />;
  return (
    <span className="action-card__confirm">
      delete?
      <span className="btn action-card__confirm-yes" onClick={() => { onConfirm(); setConfirm(false); }}>yes</span>
      <span className="btn action-card__confirm-no" onClick={() => setConfirm(false)}>no</span>
    </span>
  );
}

export default ActionsPanel;
