import React from "react";
import { Icon } from "./Icon.jsx";

// One shell for every page inside the character dossier. Keeping the outer
// rhythm and page heading here prevents individual tabs from growing their own
// padding, title card, or icon treatment.
export function DeckPage({ className = "", enabled = true, children, ...props }) {
  const shared = enabled ? "deck-page deck-view" : "";
  const classes = [shared, className].filter(Boolean).join(" ");
  return <div className={classes} {...props}>{children}</div>;
}

export function DeckPageHeader({ icon, title, subtitle }) {
  return (
    <header className="deck-page__header">
      <span className="deck-page__header-icon" aria-hidden="true">
        <Icon name={icon} size={28} />
      </span>
      <span className="deck-page__header-copy">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </span>
    </header>
  );
}
