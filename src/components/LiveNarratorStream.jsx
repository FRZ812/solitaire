import React from "react";
import { LiveThinking } from "./primitives.jsx";

function Cursor() {
  return <span aria-hidden="true" style={{ display: "inline-block", marginLeft: 2, color: "var(--scene-highlight, #d7a76f)", animation: "pulse 1s ease-in-out infinite" }}>▍</span>;
}

export function LiveNarratorStream({ thinking, narration, dialogues = [] }) {
  const hasAnswer = !!narration || dialogues.length > 0;
  return (
    <section aria-label="Narrator response streaming" aria-busy="true">
      <LiveThinking thinking={thinking} />
      {narration && (
        <article className="beat beat--narration fade-in">
          <div className="beat__speaker">Narrator · live</div>
          <div className="beat__prose">{narration}{dialogues.length === 0 && <Cursor />}</div>
        </article>
      )}
      {dialogues.map((dialogue, index) => (
        <article className="beat beat--dialogue fade-in" key={`live-dialogue-${index}`}>
          <div className="beat-portrait" aria-hidden="true"><span>{(dialogue.name || "?").trim().charAt(0).toUpperCase()}</span></div>
          <div className="beat-dialogue__copy">
            <div className="beat__speaker">{dialogue.name || "Speaking"} · live</div>
            <div className="beat-dialogue__line">“{dialogue.line}{index === dialogues.length - 1 && <Cursor />}”</div>
          </div>
        </article>
      ))}
      {!thinking && !hasAnswer && <div className="beat__aside">The narrator is listening…</div>}
    </section>
  );
}
