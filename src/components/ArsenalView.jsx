import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import { SectionHeader } from "./primitives.jsx";
import { tierColor, tierLabel, tierOrder } from "../data/tiers.js";
import { getAbilityDef, abilityStatLine, abilityReqLine } from "../data/abilities.js";
import { PROFICIENCIES, ratingFromXp, proficiencyDef } from "../data/proficiencies.js";
import { knownBuffSpells } from "../data/buff-spells.js";
import { knownTravelSpells } from "../data/travel-spells.js";
import { condNames } from "../data/conditions.js";
import { ATTR_LABELS } from "../config.js";

const CORE = new Set(["basic-attack", "defend", "talk"]);

function AbilityCard({ ability, definition }) {
  const [open, setOpen] = useState(false);
  const tone = tierColor(ability.tier);
  const stat = abilityStatLine(definition, ability.tier);
  const requirement = abilityReqLine(definition);

  return (
    <button
      type="button"
      className={`arsenal-card${open ? " is-open" : ""}`}
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
      style={{ "--arsenal-tone": tone }}
    >
      <span className="arsenal-card__icon" aria-hidden="true">
        <Icon name={definition.icon || "swords"} size={16} color={tone} strokeWidth={1.8} />
      </span>
      <span className="arsenal-card__body">
        <span className="arsenal-card__title">
          <strong>{definition.name}</strong>
          {ability.tier !== "common" && <em style={{ color: tone }}>{tierLabel(ability.tier)}</em>}
          <small>{definition.school}</small>
        </span>
        {stat && <span className="arsenal-card__stat">{stat}</span>}
        {requirement && <span className="arsenal-card__requirement">{requirement}</span>}
        {open && definition.desc && <span className="arsenal-card__description">{definition.desc}</span>}
      </span>
      <span className="arsenal-card__chevron" aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
  );
}

function SpellCard({ spell, kind, active, affordable, onCast }) {
  const canCastHere = kind === "boon" && onCast;
  return (
    <article className={`spell-card spell-card--${kind}${active ? " is-active" : ""}`}>
      <div className="spell-card__sigil" aria-hidden="true">
        <Icon name={spell.icon || "sparkle"} size={18} strokeWidth={1.45} />
      </div>
      <div className="spell-card__copy">
        <div className="spell-card__title">
          <strong>{spell.name}</strong>
          <span>{kind === "travel" ? "Travel" : active ? "Active boon" : "Boon"}</span>
        </div>
        <p>{spell.description || spell.desc}</p>
        <div className="spell-card__meta">
          <span>{spell.school}</span>
          <span>{spell.resolveCost} resolve</span>
          {kind === "travel" && <span>Cast from map</span>}
        </div>
      </div>
      {canCastHere && (
        <button
          type="button"
          className="spell-card__cast"
          disabled={!affordable}
          onClick={() => onCast(spell.id)}
        >
          {active ? "Renew" : "Cast"}
        </button>
      )}
    </article>
  );
}

// Dedicated deck page for combat techniques, learned magic, and mastery.
// Casting travel spells stays on the map because each one needs a destination.
export function ArsenalView({ state, onCastBuff }) {
  const character = state.character;
  const learned = (character.abilities || []).map((ability) => (
    typeof ability === "string"
      ? { id: ability, tier: "common" }
      : { id: ability.id, tier: ability.tier || "common" }
  ));
  const abilities = [...new Map(
    [...[...CORE].map((id) => ({ id, tier: "common" })), ...learned]
      .map((ability) => [ability.id, ability]),
  ).values()]
    .filter((ability) => {
      const definition = getAbilityDef(ability.id);
      return definition && !definition.noncombat;
    })
    .sort((a, b) => tierOrder(b.tier) - tierOrder(a.tier));

  const boons = knownBuffSpells(character);
  const travelSpells = knownTravelSpells(character);
  const activeConditions = new Set(condNames(character.conditions || []));
  const proficiencies = PROFICIENCIES
    .map((proficiency) => ({
      ...proficiency,
      xp: character.proficiencies?.[proficiency.id] || 0,
      rating: ratingFromXp(character.proficiencies?.[proficiency.id] || 0),
    }))
    .filter((proficiency) => proficiency.xp > 0)
    .sort((a, b) => b.rating - a.rating || b.xp - a.xp);

  return (
    <div className="arsenal-view deck-view">
      <div className="arsenal-hero">
        <div className="arsenal-hero__icon" aria-hidden="true"><Icon name="sparkle" size={24} strokeWidth={1.4} /></div>
        <div>
          <h3>Abilities &amp; Spells</h3>
          <p>Techniques · magic · mastery</p>
        </div>
      </div>

      <section>
        <SectionHeader>Combat abilities · {abilities.length}</SectionHeader>
        <div className="arsenal-list">
          {abilities.map((ability, index) => {
            const definition = getAbilityDef(ability.id);
            return <AbilityCard key={`${ability.id}-${index}`} ability={ability} definition={definition} />;
          })}
        </div>
      </section>

      <section>
        <SectionHeader>Spells · {boons.length + travelSpells.length}</SectionHeader>
        {boons.length + travelSpells.length === 0 ? (
          <div className="arsenal-empty">No spells learned yet. Grimoires and teachers can awaken new magic.</div>
        ) : (
          <div className="spell-list">
            {boons.map((spell) => (
              <SpellCard
                key={spell.id}
                spell={spell}
                kind="boon"
                active={activeConditions.has(spell.applies.condition)}
                affordable={(character.resolve ?? 0) >= spell.resolveCost}
                onCast={onCastBuff}
              />
            ))}
            {travelSpells.map((spell) => <SpellCard key={spell.id} spell={spell} kind="travel" />)}
          </div>
        )}
      </section>

      <section>
        <SectionHeader>Mastery</SectionHeader>
        {proficiencies.length === 0 ? (
          <div className="arsenal-empty">Practice in the field to establish your first mastery.</div>
        ) : (
          <div className="mastery-grid">
            {proficiencies.map((proficiency) => (
              <div key={proficiency.id} className="mastery-card">
                <span>{proficiency.name}</span>
                <strong>{proficiency.rating}</strong>
                <small>feeds {ATTR_LABELS[proficiencyDef(proficiency.id)?.attr] || "growth"}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
