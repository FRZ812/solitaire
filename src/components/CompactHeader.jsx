import React from "react";
import { Icon } from "./Icon.jsx";
import { TERRAINS } from "../data/terrains.js";
import { getTile, currentLocationName } from "../engine/world.js";
import { getBiome } from "../data/biomes.js";
import { sceneBiomeId } from "../data/visual-assets.js";
import { formatTime, getCalendarDate } from "../engine/time.js";

function AnalogClock({ time }) {
  const hour = Number(time?.hour) || 0;
  const minute = Number(time?.minute) || 0;
  const formatted = formatTime({ hour, minute });
  const hourAngle = ((hour % 12) * 30) + (minute * 0.5);
  const minuteAngle = minute * 6;

  return (
    <time className="compact-header__clock" dateTime={formatted} aria-label={`World time ${formatted}`} title={formatted}>
      <span className="compact-header__clock-face" aria-hidden="true">
        <i className="compact-header__clock-hand compact-header__clock-hand--hour" style={{ "--clock-angle": `${hourAngle}deg` }} />
        <i className="compact-header__clock-hand compact-header__clock-hand--minute" style={{ "--clock-angle": `${minuteAngle}deg` }} />
        <b />
      </span>
    </time>
  );
}

function OverflowMarquee({ children }) {
  const viewportRef = React.useRef(null);
  const textRef = React.useRef(null);
  const [marquee, setMarquee] = React.useState({ active: false, duration: 24 });

  React.useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled || !viewportRef.current || !textRef.current) return;
      const textWidth = textRef.current.scrollWidth;
      const active = textWidth > viewportRef.current.clientWidth + 1;
      const duration = Math.max(22, Math.ceil(textWidth / 11));
      setMarquee((current) => current.active === active && current.duration === duration
        ? current
        : { active, duration });
    };

    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (observer) {
      observer.observe(viewportRef.current);
      observer.observe(textRef.current);
    } else {
      window.addEventListener("resize", measure);
    }
    document.fonts?.ready?.then(measure);

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children]);

  return (
    <div
      ref={viewportRef}
      className={`compact-header__title${marquee.active ? " is-marquee" : ""}`}
      title={String(children)}
      style={{ "--marquee-duration": `${marquee.duration}s` }}
    >
      <span className="compact-header__title-track">
        <span ref={textRef} className="compact-header__title-text">{children}</span>
        {marquee.active && <span className="compact-header__title-copy" aria-hidden="true">{children}</span>}
      </span>
    </div>
  );
}

export function CompactHeader({ state, onMap, onOpenDeck }) {
  const partyCount = (state.party || []).length;
  const cur = state.world.currentTile;
  const t = getTile(state, cur.x, cur.y);
  const sceneTitle = currentLocationName(state);
  const terrainLabel = TERRAINS[t.terrain]?.label || "Wilderness";
  const biome = getBiome(cur.x, cur.y, state.world.seed);
  const biomeLabel = sceneBiomeId(biome.id, t) === "whitemarch" ? "Whitemarch" : biome.name;
  const date = getCalendarDate(state.time);
  // Compact 3-letter month abbreviation for the header chip. The map view
  // shows the full date + year — this stays tight so the scene title has room.
  const monthAbbr = date.monthName.slice(0, 3);

  return (
    <header className="compact-header">
      <div className="compact-header__date" title={`${date.dayOfMonth} ${date.monthName}, ${date.year}`}>
        <span><b>{date.dayOfMonth}</b> {monthAbbr}</span>
        <AnalogClock time={state.time} />
      </div>

      <div className="compact-header__scene">
        <OverflowMarquee>{sceneTitle}</OverflowMarquee>
        <div className="compact-header__place">
          <span>{terrainLabel}</span><i aria-hidden="true" /><span>{biomeLabel}</span>
        </div>
      </div>

      <nav className="compact-header__actions" aria-label="World and dossier">
        <button className="compact-header__action" onClick={onMap} aria-label="World atlas"><Icon name="atlas" size={22} /></button>
        <button className="compact-header__action" onClick={onOpenDeck} aria-label="Character, company, abilities, inventory, and codex">
          <Icon name="character" size={21} />
          {partyCount > 0 && (
            <span className="compact-header__party-count">{partyCount}</span>
          )}
        </button>
      </nav>
    </header>
  );
}
