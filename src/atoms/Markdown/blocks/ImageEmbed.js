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

const OneImage = ({ relPath, projectCode, candidates, width, alt, onZoom }) => {
  const [idx, setIdx] = useState(0);
  // ONE PROJECT, ONE FOLDER, ONE ROUTE. This used to walk the project's SERVICES in order, hoping
  // one had a plugin new enough to serve bytes — so an image in a project with no services, or with
  // services down, rendered as a dead box. The hub reads the folder directly; there is nothing to
  // try in order any more.
  const src = `/sv-file/${encodeURIComponent(projectCode)}?path=${encodeURIComponent(relPath)}`;
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
  if (!candidates.length)
    return (
      <div className="md-embed md-embed--dead">::image — {projectCode || "project"} not connected</div>
    );

  const gallery = paths.length > 1;
  return (
    <figure className={`md-image${gallery ? " md-image--gallery" : ""}`}>
      <div className="md-embed__head">
        <span className="md-embed__kind">{gallery ? `gallery · ${paths.length}` : "image"}</span>
        <span className="md-embed__title">{gallery ? paths[0].replace(/[^/]*$/, "…") : paths[0]}</span>
        <span className="md-embed__scope">{projectCode}</span>
      </div>
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
