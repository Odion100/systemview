import React, { useMemo, useState } from "react";
import { useParams, useHistory, useLocation } from "react-router-dom";
import PageHeader from "../../organisms/PageHeader/PageHeader";
import AgentNav from "../../organisms/AgentNav/AgentNav";
import AgentProfile from "../../organisms/AgentProfile/AgentProfile";
import ContextManager from "../../organisms/ContextManager/ContextManager";
import DocPanel from "../../organisms/DocPanel/DocPanel";
import AgentChat from "../../organisms/AgentChat/AgentChat";
import { saveDoc, saveSkill, saveDef } from "../../utils/hostAgents";
import "./styles.scss";

// RFC-055 — ONE PAGE, THREE PANELS (his design): the navigator on the left (the same one Specs
// has), the agent profile + context store in the middle, and the RIGHT panel is where documents
// open for editing — click a doc or a skill in the profile and it lands there on the code
// view/markdown machinery. Same expandable-panel rhythm as Specs.
//
// THE URL REMEMBERS WHERE HE IS (his call: "I'm tired of refreshing and not being where I am").
// ?agent=<id>&doc=doc:<key>|skill:<where>:<name>&scope=<scope> — selection, the open document,
// and the knowledge filter all round-trip through the query string, so a refresh lands exactly
// where he left. Same URL-backed discipline Specs already runs on.
const Context = () => {
  const { projectCode } = useParams();
  const history = useHistory();
  const location = useLocation();

  // Read once at mount — these seed the restore; live state owns itself afterwards.
  const seed = useMemo(() => {
    const p = new URLSearchParams(location.search);
    const rawDoc = p.get("doc");
    let doc = null;
    if (rawDoc) {
      const [kind, a, b] = rawDoc.split(":");
      doc = kind === "skill" ? { kind: "skill", where: a, name: b } : kind === "def" ? { kind: "def" } : { kind: "doc", key: a };
    }
    return { agent: p.get("agent"), doc, scope: p.get("scope") };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [agentId, setAgentId] = useState(seed.agent);
  const [doc, setDoc] = useState(null); // the doc open on the right: {kind, agentId, key|name, where, label, text, orig}
  const [focus, setFocus] = useState(() => (seed.scope ? { scope: seed.scope, n: 1 } : null));
  const [saving, setSaving] = useState(false);

  // One writer for the query string — replace, not push, so back still leaves the page cleanly.
  const setUrl = (mut) => {
    const p = new URLSearchParams(window.location.search);
    mut(p);
    const s = p.toString();
    history.replace(`${window.location.pathname}${s ? `?${s}` : ""}`);
  };

  const saveOpenDoc = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      let res;
      if (doc.kind === "def") {
        // THE RAW DEFINITION FILE — parsed and handed back whole (saveDef normalizes). A JSON
        // typo throws before anything is written; the panel stays dirty so nothing is lost.
        const rec = JSON.parse(doc.text);
        res = await saveDef({ id: rec.id, name: rec.name, ...(rec.def || {}), projectCode: rec.projectCode, cwd: rec.cwd, permissionMode: rec.permissionMode, def: undefined });
        window.dispatchEvent(new CustomEvent("sv:botHub")); // the profile re-reads on this signal
      } else if (doc.kind === "skill") {
        res = await saveSkill(doc.agentId, doc.name, doc.where, doc.text);
      } else {
        res = await saveDoc(doc.agentId, doc.key, doc.text);
      }
      if (res && res.ok === false) throw new Error(res.error || "save failed");
      setDoc((cur) => (cur ? { ...cur, orig: cur.text } : cur));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="system-viewer" data-sv="page">
      <PageHeader projectCode={projectCode} current="context" />
      <div className="row">
        <AgentNav projectCode={projectCode} />
        <div className="center-panel ctx-center">
          <div className="ctx-page">
            <AgentProfile
              projectCode={projectCode}
              urlAgent={seed.agent}
              urlDoc={seed.doc}
              onSelect={(id) => {
                setAgentId(id);
                if (!id) setDoc(null); // unselecting the agent closes its doc too
                setUrl((p) => {
                  if (id) p.set("agent", id);
                  else {
                    p.delete("agent");
                    p.delete("doc");
                  }
                });
              }}
              onOpenDoc={(next) => {
                // SAME CHIP TOGGLES (his call): clicking the doc that's already open closes the
                // panel — no trip to the corner ✕.
                const same =
                  doc &&
                  doc.kind === next.kind &&
                  doc.agentId === next.agentId &&
                  (next.kind === "skill"
                    ? doc.name === next.name && doc.where === next.where
                    : next.kind === "def"
                    ? true
                    : doc.key === next.key);
                if (same) {
                  setDoc(null);
                  setUrl((p) => p.delete("doc"));
                  return;
                }
                setDoc(next);
                setUrl((p) =>
                  p.set("doc", next.kind === "skill" ? `skill:${next.where}:${next.name}` : next.kind === "def" ? "def:file" : `doc:${next.key}`)
                );
              }}
              onFilterScope={(scope) => {
                setFocus((f) => ({ scope, n: (f ? f.n : 0) + 1 }));
                setUrl((p) => p.set("scope", scope));
              }}
            />
            {/* SEPARATE SECTION, close but distinguished (his call): a rule and its own label —
                this store searches universally, across every scope, not just the selected agent. */}
            <div className="ctx-store">
              <div className="ctx-store__head">
                Context store
                <span className="ctx-store__note">searches all scopes — not tied to the selected agent</span>
              </div>
              <ContextManager projectCode={projectCode} agentId={agentId} focus={focus} />
            </div>
          </div>
        </div>
        {doc && (
          <DocPanel
            key={`${doc.kind}:${doc.key || doc.name || "file"}`}
            doc={doc}
            saving={saving}
            onChange={(text) => setDoc((cur) => (cur ? { ...cur, text } : cur))}
            onSave={saveOpenDoc}
            onClose={() => {
              setDoc(null);
              setUrl((p) => p.delete("doc"));
            }}
          />
        )}
      </div>
      <AgentChat />
    </section>
  );
};

export default Context;
