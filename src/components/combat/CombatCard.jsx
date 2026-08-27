import React from "react";
import { getAbilityDef } from "../../data/abilities.js";
import { abilityTaxonomy } from "../../data/ability-taxonomy.js";
import { tierColor, tierLabel } from "../../data/tiers.js";
import { AbilityIcon } from "../AbilityIcon.jsx";

export function CombatCard({ card, playable, onPlay, effectiveResolveCost = card?.resolveCost || 0 }) {
  if (!card) return null;
  const tier = card.tier || "common";
  const statLine = (card.statLine || "")
    .replace(/\s*·?\s*\b\d+ resolve\b/gi, "")
    .trim();
  const ability = getAbilityDef(card.abilityId);
  const taxonomy = abilityTaxonomy(ability, tier);
  const rules = [
    card.block ? `${card.block} Block` : "",
    card.draw ? `Draw ${card.draw}` : "",
    card.retain ? "Retain" : "",
    card.ethereal ? "Ethereal" : "",
  ].filter(Boolean);
  const categoryLine = card.magicSchoolLabel || taxonomy.magicSchool?.label
    ? `${card.magicSchoolLabel || taxonomy.magicSchool.label} · ${card.type || "skill"}`
    : `${card.categoryLabel || taxonomy.category.label} · ${card.type || "skill"}`;
  const domId = String(card.uid || card.abilityId).replace(/[^a-zA-Z0-9_-]/g, "-");
  const nameId = `combat-card-${domId}-name`;
  const summaryId = `combat-card-${domId}-summary`;
  const spokenSummary = [
    `${card.energyCost} energy`, categoryLine, tierLabel(tier), statLine,
    card.requirementLine, card.description, ...rules,
    effectiveResolveCost > 0 ? `${effectiveResolveCost} resolve` : "",
    card.exhaust ? "Exhaust after use" : "Discard after use",
  ].filter(Boolean).map((part) => String(part).replace(/[.\s]+$/, "")).join(". ");
  const activate = () => { if (playable && onPlay) onPlay(); };
  return (
    <button
      type="button"
      className={`combat-card combat-card--${card.type || "skill"}${playable ? " is-playable" : ""}`}
      style={{ "--card-tier": tierColor(tier) }}
      aria-disabled={!playable}
      onClick={activate}
      aria-labelledby={nameId}
      aria-describedby={summaryId}
      title={playable ? `Play ${card.name}` : `${card.name} cannot be played with the current target or resources`}
    >
      <span id={summaryId} className="combat-sr-only">{spokenSummary}</span>
      <span className="combat-card__cost">{card.energyCost}</span>
      <span className="combat-card__tier">{tierLabel(tier)}</span>
      <span className="combat-card__art" aria-hidden="true">
        <AbilityIcon ability={ability} tierId={tier} size="hero" decorative />
      </span>
      <span className="combat-card__body">
        <strong id={nameId} className="combat-card__name">{card.name}</strong>
        <span className="combat-card__type">{categoryLine}</span>
        {statLine ? <span className="combat-card__stats">{statLine}</span> : null}
        {card.requirementLine ? <span className="combat-card__requirements">{card.requirementLine}</span> : null}
        <span className="combat-card__text">{card.description}</span>
        {rules.length > 0 && (
          <span className="combat-card__rules">
            {rules.map((rule) => <span key={rule}>{rule}</span>)}
          </span>
        )}
        <span className="combat-card__footer">
          {[effectiveResolveCost > 0 ? `${effectiveResolveCost} resolve` : "", card.exhaust ? "Exhaust" : "Discard"].filter(Boolean).join(" · ")}
        </span>
      </span>
    </button>
  );
}
