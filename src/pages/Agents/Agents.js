import React from "react";
import { useParams } from "react-router-dom";
import PageHeader from "../../organisms/PageHeader/PageHeader";
import AgentProfile from "../../organisms/AgentProfile/AgentProfile";
import AgentChat from "../../organisms/AgentChat/AgentChat";

// RFC-055 — the agent-management page. A top-level view beside Specs, Context and Stats: open an
// agent, see and change everything feeding it (the always-loaded doc, tools, skills, MCPs, the
// knowledge), so agents get configured right from one place.
const Agents = () => {
  const { projectCode } = useParams();
  return (
    <section className="system-viewer" data-sv="page">
      <PageHeader projectCode={projectCode} current="agents" />
      <AgentProfile projectCode={projectCode} />
      <AgentChat />
    </section>
  );
};

export default Agents;
