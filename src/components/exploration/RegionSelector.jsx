import React, { useMemo } from "react";
import { biomeVisual } from "../../data/visual-assets.js";
import { Icon } from "../Icon.jsx";
import { useModalFocus } from "./modalFocus.js";
import { buildRegionSelectorModel } from "./regionSelectorModel.js";

const REALM_SIGILS = Object.freeze({
  central: "♜",
  north: "✦",
  east: "◇",
  south: "☼",
  west: "❧",
});

export function RegionSelector({ state, inspectedCoord, onSelect, onClose }) {
  const model = useMemo(
    () => buildRegionSelectorModel(state, { selectedCoord: inspectedCoord }),
    [state, inspectedCoord?.x, inspectedCoord?.y],
  );
  const dialogRef = useModalFocus(onClose);

  return (
    <div className="region-selector-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section ref={dialogRef} tabIndex={-1} className="region-selector" role="dialog" aria-modal="true" aria-label="World region selector">
        <header className="region-selector__header">
          <div>
            <span className="rpg-kicker">Avarra</span>
            <h2>Choose a region</h2>
            <p>Inspect another chart without moving the party. Ground travel remains continuous on the hex map.</p>
          </div>
          <button type="button" className="rpg-square-button" onClick={onClose} aria-label="Close region selector">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="region-selector__world" aria-label="Regions of Avarra">
          <div className="region-selector__routes" aria-hidden="true"><i /><i /><i /><i /></div>
          {model.entries.map((entry) => {
            const visual = biomeVisual(entry.biomeId);
            const status = entry.current
              ? "Current region"
              : entry.known
                ? `${entry.chartedHexes} mapped ${entry.chartedHexes === 1 ? "hex" : "hexes"}`
                : "Uncharted";
            return (
              <button
                type="button"
                key={entry.id}
                data-region-id={entry.id}
                data-direction={entry.direction}
                className={`region-selector__card${entry.current ? " is-current" : ""}${entry.selected ? " is-selected" : ""}${entry.known ? " is-known" : " is-unknown"}`}
                style={{
                  "--region-art": `url(${visual.image})`,
                  "--region-accent": visual.accent,
                  "--region-primary": visual.primary,
                  "--region-deep": visual.deep,
                }}
                aria-current={entry.current ? "location" : undefined}
                aria-label={`Inspect ${entry.shortName} hex map`}
                onClick={() => onSelect?.(entry)}
              >
                <span className="region-selector__image" aria-hidden="true" />
                <span className="region-selector__shade" aria-hidden="true" />
                <span className="region-selector__sigil" aria-hidden="true">{REALM_SIGILS[entry.id] || "✦"}</span>
                <span className="region-selector__copy">
                  <small>{status}</small>
                  <strong>{entry.name}</strong>
                  <em>{entry.biomeName}</em>
                  <span>{entry.description}</span>
                  {entry.known && (
                    <b>{entry.capitalName}{entry.factionName ? ` · ${entry.factionName}` : ""}</b>
                  )}
                  <i>Inspect {entry.shortName} hex map <span aria-hidden="true">→</span></i>
                </span>
              </button>
            );
          })}
        </div>

        <footer className="region-selector__footer">
          <span><i className="is-current" /> Party region</span>
          <span><i className="is-known" /> Mapped knowledge</span>
          <span><i className="is-unknown" /> Uncharted</span>
          <small>Region selection changes the map camera only—it never fast-travels the party.</small>
        </footer>
      </section>
    </div>
  );
}
