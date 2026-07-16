import React from "react";
import { LiveThinking } from "./primitives.jsx";

function Cursor() {
  return <span aria-hidden="true" style={{ display: "inline-block", marginLeft: 2, color: "var(--scene-highlight, #d7a76f)", animation: "pulse 1s ease-in-out infinite" }}>▍</span>;
}

export function LiveNarratorStream({ thinking, story = [] }) {
  const hasAnswer = story.length > 0;
  return (
    <section aria-label="Narrator response streaming" aria-busy="true">
      <LiveThinking thinking={thinking} />
      {story.map((item, index) => item.type === "beat" ? (
        <article className="beat beat--narration fade-in" key={`live-story-${index}`}>
          <div className="beat__speaker">Narrator · live</div>
          <div className="beat__prose">{item.text}{index === story.length - 1 && <Cursor />}</div>
        </article>
      ) : (
        <article className="beat beat--dialogue fade-in" key={`live-story-${index}`}>
          <div className="beat-portrait" aria-hidden="true"><span>{(item.name || "?").trim().charAt(0).toUpperCase()}</span></div>
          <div className="beat-dialogue__copy">
            <div className="beat__speaker">{item.name || "Speaking"} · live</div>
            <div className="beat-dialogue__line">“{item.line}{index === story.length - 1 && <Cursor />}”</div>
          </div>
        </article>
      ))}
      {!thinking && !hasAnswer && <div className="beat__aside">The narrator is listening…</div>}
    </section>
  );
}
