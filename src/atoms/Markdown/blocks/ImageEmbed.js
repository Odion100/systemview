import React, { useContext, useState } from "react";
import ServiceContext from "../../../ServiceContext";
import { useMarkdownScope } from "../context";

// RFC-025 — `::image[screenshots/run-4.png]{caption="the failing state" width=480}`
//           `::image[a.png | b.png | c.png]{caption="the gallery"}`  ← multiple = a GALLERY
//
// Repo images as a FIRST-CLASS block (approved via a TV verdict). The document carries locators;
// bytes come from the project's own plugin through the hub's /sv-raw route at render time. One
// path = a figure; several (split on `|` or `,`) = a flex gallery, every image click-to-zoom.
//
// Services DON'T all share a root (hosted repos differ) and some run plugins too old to serve
// bytes — each image tries the project's services IN ORDER until one answers.

// WHERE THE BYTES COME FROM. A project-relative path reads through the project's folder; an
// ABSOLUTE one reads through the machine pipe (RFC-069 `/sv-machine`), which has existed the whole
// time and which this block never used. That gap is why a screenshot filed outside every project —
// `~/.autobot/shots/…png`, exactly where the harness puts them — rendered as a broken image: the
// path was pasted into a project route that could never contain it.
export const srcFor = (p, projectCode) => {
  const raw = String(p || "").trim().replace(/^file:\/\//, "");
  if (/^[~/]/.test(raw)) return `/sv-machine?path=${encodeURIComponent(raw)}`;
  return `/sv-file/${encodeURIComponent(projectCode)}?path=${encodeURIComponent(raw)}`;
};

const OneImage = ({ relPath, projectCode, candidates, width, alt, onZoom }) => {
  const [idx, setIdx] = useState(0);
  const src = srcFor(relPath, projectCode);
  return (
    <img
      key={src}
      className="md-image__img"
      src={src}
      alt={alt || relPath}
      loading="lazy"
      style={width ? { maxWidth: Number(width) || width } : undefined}
      onError={() => setIdx((n) => n + 1)}
      onClick={() => onZoom(src)}
      title="Click to zoom"
    />
  );
};

const ImageEmbed = ({ label, attrs = {} }) => {
  const scope = useMarkdownScope();
  const { connectedServices = [] } = useContext(ServiceContext);
  const [zoomSrc, setZoomSrc] = useState(null);

  const paths = String(label || attrs.of || "")
    .split(/[|,]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const firstProject = connectedServices.length ? connectedServices[0].projectCode : null;
  const projectCode = attrs.project || scope.projectCode || firstProject;
  // A MACHINE PATH BELONGS TO NO PROJECT, so it must not be held to one. The connection check below
  // is about reading a project's folder; an absolute path reads through the machine pipe and is
  // none of that check's business — holding it to one turned every screenshot into "not connected".
  const machine = paths.every((p) => /^(~|\/|file:\/\/)/.test(p));
  const candidates = [
    ...connectedServices.filter(
      (s) => s.projectCode === projectCode && attrs.service && s.serviceId === attrs.service,
    ),
    ...connectedServices.filter(
      (s) => s.projectCode === projectCode && scope.serviceId && s.serviceId === scope.serviceId,
    ),
    ...connectedServices.filter((s) => s.projectCode === projectCode),
  ].filter((s, i, arr) => arr.findIndex((o) => o.serviceId === s.serviceId) === i);

  if (!paths.length) return <div className="md-embed md-embed--dead">::image — no path named</div>;
  if (!machine && !candidates.length)
    return (
      <div className="md-embed md-embed--dead">::image — {projectCode || "project"} not connected</div>
    );

  const gallery = paths.length > 1;
  return (
    <figure className={`md-image${gallery ? " md-image--gallery" : ""}`}>
      {/* NO HEAD. An image used to arrive wearing the embed chrome every other block wears — a
          kind badge reading "image", the path, and the project chip — above a picture that says
          all three by being a picture. His ruling, 2026-10-19, holding his phone's chat beside
          this one: *"it doesn't need to be wrapped in a bubble… it just needs to render like
          image."* A caption still renders, because that is something the picture does NOT say. */}
      <div className="md-image__row">
        {paths.map((p) => (
          <OneImage
            key={p}
            relPath={p}
            projectCode={projectCode}
            candidates={candidates}
            width={gallery ? undefined : attrs.width}
            alt={attrs.caption || p}
            onZoom={setZoomSrc}
          />
        ))}
      </div>
      {attrs.caption ? <figcaption className="md-image__caption">{attrs.caption}</figcaption> : null}
      {zoomSrc && (
        <div className="md-image__lightbox" onClick={() => setZoomSrc(null)}>
          <img src={zoomSrc} alt={attrs.caption || "zoom"} />
        </div>
      )}
    </figure>
  );
};

export default ImageEmbed;
