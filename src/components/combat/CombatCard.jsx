import React from "react";
import { tierColor, tierLabel } from "../../data/tiers.js";

export function CombatCard({ card, playable, onPlay, effectiveResolveCost = card?.resolveCost || 0 }) {
  if (!card) return null;
  const tier = card.tier || "common";
  const statLine = (card.statLine || "").replace(/\b\d+ resolve\b/gi, `${effectiveResolveCost} resolve`);
  return (
    <button
      type="button"
      className={`combat-card combat-card--${card.type || "skill"}${playable ? " is-playable" : ""}`}
      style={{ "--card-tier": tierColor(tier) }}
      disabled={!playable}
      onClick={onPlay}
      aria-label={`${card.name}, ${card.energyCost} energy`}
    >
      <span className="combat-card__cost">{card.energyCost}</span>
      <span className="combat-card__tier">{tierLabel(tier)}</span>
      <span className="combat-card__art" aria-hidden="true" />
      <span className="combat-card__body">
        <strong className="combat-card__name">{card.name}</strong>
        <span className="combat-card__type">{card.type}</span>
        {statLine ? <span className="combat-card__stats">{statLine}</span> : null}
        {card.requirementLine ? <span className="combat-card__requirements">{card.requirementLine}</span> : null}
        <span className="combat-card__text">{card.description}</span>
        <span className="combat-card__footer">
          {[effectiveResolveCost > 0 ? `${effectiveResolveCost} resolve` : "", card.exhaust ? "Exhaust" : "Discard"].filter(Boolean).join(" · ")}
        </span>
      </span>
    </button>
  );
}
