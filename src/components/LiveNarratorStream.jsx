import React from "react";

export function LiveNarratorStream({ active = false }) {
  return (
    <section aria-label="Narrator response pending validation" aria-busy="true">
      <div className="beat__aside">
        {active
          ? "The narrator is reasoning through the scene…"
          : "Connecting to the narrator…"}
      </div>
    </section>
  );
}
