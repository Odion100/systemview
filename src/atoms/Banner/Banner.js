import React, { useState } from "react";
import { useBanners, dismiss } from "./bannerStore";
import "./styles.scss";

// Messages slide in from the LEFT edge, stacked bottom-up, over whatever you're doing. Deliberately
// not a modal: a failure shouldn't interrupt the run you're reading, it should be visible while you
// read it. Errors stay until you dismiss them; anything else fades on its own.
const ICON = { error: "✕", warn: "!", ok: "✓", info: "i" };

const BannerItem = ({ m }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`sv-banner sv-banner--${m.kind}`}>
      <span className="sv-banner__icon">{ICON[m.kind] || "i"}</span>
      <div className="sv-banner__body">
        <div className="sv-banner__text">
          {m.text}
          {m.count > 1 ? <span className="sv-banner__count">×{m.count}</span> : null}
        </div>
        {m.detail ? (
          <>
            <button type="button" className="sv-banner__more" onClick={() => setOpen((o) => !o)}>
              {open ? "less" : "details"}
            </button>
            {open ? <pre className="sv-banner__detail">{m.detail}</pre> : null}
          </>
        ) : null}
      </div>
      <button type="button" className="sv-banner__close" title="Dismiss" onClick={() => dismiss(m.id)}>
        ×
      </button>
    </div>
  );
};

const BannerStack = () => {
  const items = useBanners();
  if (!items.length) return null;
  return (
    <div className="sv-banner-stack">
      {items.map((m) => (
        <BannerItem key={m.id} m={m} />
      ))}
    </div>
  );
};

export default BannerStack;
