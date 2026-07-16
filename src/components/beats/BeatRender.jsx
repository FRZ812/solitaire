import React from "react";
import { Icon } from "../Icon.jsx";

function Thinking({ text }) {
  if (!text) return null;
  return (
    <details className="beat-thinking fade-in">
      <summary>Behind the veil</summary>
      <div>{text}</div>
    </details>
  );
}

// Narration history remains editable through hold/right-click. The visible
// ellipsis duplicated that gesture and crowded every bubble.
function Pressable({ onMenu, children }) {
  const timer = React.useRef(null);
  const start = () => { timer.current = setTimeout(() => { timer.current = null; onMenu?.(); }, 480); };
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  if (!onMenu) return children;
  return (
    <div className="beat-pressable" onTouchStart={start} onTouchEnd={cancel} onTouchMove={cancel} onContextMenu={(event) => { event.preventDefault(); onMenu(); }}>
      {children}
    </div>
  );
}

function SystemCard({ tone = "neutral", kicker, icon, children }) {
  const iconColor = tone === "danger" ? "#f3ada0" : tone === "success" ? "#a8d6b2" : "var(--scene-highlight, #e6b98c)";
  return (
    <div className={`beat-system beat-system--${tone} fade-in`}>
      {kicker && <div className="beat-system__kicker">{icon && <Icon name={icon} size={12} color={iconColor} strokeWidth={2} />}{kicker}</div>}
      {children}
    </div>
  );
}

function ChipList({ children }) {
  return <div className="beat-chips">{children}</div>;
}

export function BeatRender({ beat, onMenu }) {
  switch (beat.type) {
    case "narration":
      return (
        <Pressable onMenu={onMenu}>
          <article className="beat beat--narration fade-in">
            <Thinking text={beat.thinking} />
            {beat.timeStamp && <div className="beat__time">{beat.timeStamp}</div>}
            <div className="beat__prose">{beat.content}</div>
            {beat.truncated && <div className="beat__aside">— the narrator was cut short despite a retry. Long-press to rewrite.</div>}
          </article>
        </Pressable>
      );

    case "player":
      return (
        <Pressable onMenu={onMenu}>
          <div className="beat beat--player fade-in"><div className="beat__speaker">Your move</div><div>{beat.content}</div></div>
        </Pressable>
      );

    case "timestamp":
      return <div className="beat-divider fade-in"><span>{beat.content}</span></div>;

    case "roll":
      return (
        <SystemCard kicker={`${beat.label} · ${beat.formula}${beat.dc ? ` vs DC ${beat.dc}` : ""}`}>
          <div className="beat-roll"><div className="beat-roll__outcome">{beat.outcome}</div><div className="beat-roll__value">{beat.value}</div></div>
        </SystemCard>
      );

    case "encounter":
      return <SystemCard tone="danger" kicker={`Encounter · ${beat.encounterType}`} icon="alert"><div className="beat-system__prose">{beat.note}</div></SystemCard>;

    case "dialogue":
      return (
        <Pressable onMenu={onMenu}>
          <>
            <Thinking text={beat.thinking} />
            <article className="beat beat--dialogue fade-in">
              <div className="beat-portrait" aria-hidden="true"><span>{(beat.name || "?").trim().charAt(0).toUpperCase()}</span></div>
              <div className="beat-dialogue__copy">
                <div className="beat__speaker">{beat.name}</div>
                <div className="beat-dialogue__line">“{beat.line}”</div>
                {beat.truncated && <div className="beat__aside">— the narrator was cut short despite a retry. Long-press to rewrite.</div>}
              </div>
            </article>
          </>
        </Pressable>
      );

    case "travel_card":
      return <SystemCard kicker="Trail marked"><div className="beat-system__prose">{beat.from} <span className="beat-arrow">→</span> {beat.to} <small>· {beat.mins} min</small></div></SystemCard>;

    case "discovery":
      return (
        <SystemCard tone="success" kicker="Recorded" icon="sparkle"><ChipList>{beat.items.map((item, index) => <span key={index}><small>{item.kind.replace(/s$/, "")}</small>{item.name}</span>)}</ChipList></SystemCard>
      );

    case "growth":
      return <SystemCard kicker="Growth" icon="arrowUp"><div className="beat-system__line">{beat.text}</div></SystemCard>;

    case "inventory_delta":
      return <SystemCard kicker="Inventory"><ChipList>{beat.lines.map((line, index) => <span key={index}>{line}</span>)}</ChipList></SystemCard>;

    case "upkeep":
      return <SystemCard tone="success" kicker="On the road"><ChipList>{beat.lines.map((line, index) => <span key={index}>{line}</span>)}</ChipList></SystemCard>;

    case "spoilage":
      return <SystemCard kicker="Spoiled"><ChipList>{beat.lines.map((line, index) => <span className="is-spoiled" key={index}>{line}</span>)}</ChipList></SystemCard>;

    case "passage":
      return <SystemCard kicker="Passing"><div className="beat-system__obituary">{beat.lines.map((line, index) => <div key={index}>{line}</div>)}</div></SystemCard>;

    case "need_alert":
      return <div className="beat-need fade-in">{beat.text || (beat.lines && beat.lines.join(" · "))}</div>;

    case "vitals_delta": {
      const labels = { vitality: "Vitality", resolve: "Resolve", hunger: "Hunger", thirst: "Thirst", sleep: "Sleep" };
      return (
        <SystemCard kicker="Vitals"><ChipList>{beat.chips.map((chip, index) => <span className={chip.delta > 0 ? "is-positive" : "is-negative"} key={index}>{labels[chip.stat] || chip.stat} {chip.delta > 0 ? "+" : ""}{chip.delta}</span>)}</ChipList></SystemCard>
      );
    }

    case "condition_change":
      return (
        <SystemCard kicker="Conditions"><ChipList>{beat.entries.map((entry, index) => {
          const mark = entry.dir === "gain" ? "+ " : entry.dir === "expire" ? "⌛ " : "− ";
          return <span key={index} className={`is-${entry.polarity || "neutral"} ${entry.dir !== "gain" ? "is-faded" : ""}`}>{mark}{entry.name}</span>;
        })}</ChipList></SystemCard>
      );

    default:
      return null;
  }
}
