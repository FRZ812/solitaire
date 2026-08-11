import React from "react";

export function LiveNarratorStream() {
  return (
    <section aria-label="Narrator response pending validation" aria-busy="true">
      <div className="beat__aside">The narrator is composing a validated response…</div>
    </section>
  );
}
