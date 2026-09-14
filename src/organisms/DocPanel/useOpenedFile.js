import { useEffect } from "react";

// A FILE CLICKED ANYWHERE OPENS IN THE SIDE PANEL — on every page, not just the one it was built
// for. His call, twice: *"that side panel should be able to show up on the stats page or the agent
// page… I choose that over navigating."* Walking the window over to the Code page to read one file
// throws away the page you were reading.
//
// THIS HOOK CARRIES THE EVENT AND NOTHING ELSE. It used to read the file, sniff images, and guess a
// language — a second, worse implementation of what `CodePane` already does, and the guess is what
// made every code document render as markdown. Reading, images, diffs, staging and save belong to
// CodePane; this just says WHICH file, on WHICH project.
export default function useOpenedFile(projectCode, onOpen) {
  useEffect(() => {
    const handler = (e) => {
      const d = (e && e.detail) || {};
      if (!d.path) return;
      const pc = d.projectCode || projectCode;
      if (!pc) return;
      onOpen({ kind: "file", projectCode: pc, serviceId: d.serviceId || null, path: d.path, label: d.path, language: d.language || null, lines: d.lines || null });
    };
    window.addEventListener("sv:openFileInNav", handler);
    return () => window.removeEventListener("sv:openFileInNav", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode]);
}
