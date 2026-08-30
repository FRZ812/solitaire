import React from "react";

export function LiveNarratorStream({ active = false }) {
  return (
    <section className={`live-narrator-status${active ? " is-active" : ""}`} aria-label="Narrator response pending validation" aria-busy="true">
      <span className="live-narrator-status__pulse" aria-hidden="true"><i /><i /><i /></span>
      <div className="live-narrator-status__copy">
        <strong>{active ? "Narrator is composing the scene…" : "Opening narrator stream…"}</strong>
        <span>{active
          ? "The scene will appear after it passes the turn rules."
          : "Waiting for the selected provider to respond."}</span>
      </div>
    </section>
  );
}
