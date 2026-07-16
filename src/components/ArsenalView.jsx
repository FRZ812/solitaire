import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import { AbilityIcon } from "./AbilityIcon.jsx";
import { SectionHeader } from "./primitives.jsx";
import { tierColor, tierLabel, tierOrder } from "../data/tiers.js";
import { getAbilityDef, abilityStatLine, abilityReqLine } from "../data/abilities.js";
import { PROFICIENCIES, proficiencyRating, proficiencyDef } from "../data/proficiencies.js";
import { knownBuffSpells } from "../data/buff-spells.js";
import { knownTravelSpells } from "../data/travel-spells.js";
import { condNames } from "../data/conditions.js";
import { ATTR_LABELS } from "../config.js";
import { abilityTaxonomy } from "../data/ability-taxonomy.js";

const CORE = new Set(["basic-attack", "defend", "talk"]);

export function arsenalAbilityGroups(character) {
  const learned = (character?.abilities || []).map((ability) => (
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

  return {
    spells: abilities.filter((ability) => (
      abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === "magic"
    )),
    techniques: abilities.filter((ability) => (
      abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId !== "magic"
    )),
  };
}

function AbilityCard({ ability, definition, variant = "technique" }) {
  const [open, setOpen] = useState(false);
  const tone = tierColor(ability.tier);
  const stat = abilityStatLine(definition, ability.tier);
  const requirement = abilityReqLine(definition);
  const taxonomy = abilityTaxonomy(definition, ability.tier);

  return (
    <button
      type="button"
      className={`arsenal-card arsenal-card--${variant}${open ? " is-open" : ""}`}
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
      style={{ "--arsenal-tone": tone }}
    >
      <span className="arsenal-card__icon" data-tier={ability.tier} aria-hidden="true">
        <AbilityIcon ability={definition} tierId={ability.tier} size="small" decorative />
      </span>
      <span className="arsenal-card__body">
        <span className="arsenal-card__title">
          <strong>{definition.name}</strong>
          {ability.tier !== "common" && <em style={{ color: tone }}>{tierLabel(ability.tier)}</em>}
          <small>{taxonomy.label}</small>
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
  const iconTier = spell.tier || spell.minTier || "common";
  const taxonomy = abilityTaxonomy(spell, iconTier);
  return (
    <article className={`spell-card spell-card--${kind}${active ? " is-active" : ""}`}>
      <div className="spell-card__sigil" aria-hidden="true">
        <AbilityIcon ability={spell} tierId={iconTier} size="small" decorative />
      </div>
      <div className="spell-card__copy">
        <div className="spell-card__title">
          <strong>{spell.name}</strong>
          <span>{kind === "travel" ? "Travel" : active ? "Active boon" : "Boon"}</span>
        </div>
        <p>{spell.description || spell.desc}</p>
        <div className="spell-card__meta">
          <span>{taxonomy.label}</span>
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
  const [abilityFilter, setAbilityFilter] = useState("all");
  const { techniques, spells: combatSpells } = arsenalAbilityGroups(character);

  const boons = knownBuffSpells(character);
  const travelSpells = knownTravelSpells(character);
  const activeConditions = new Set(condNames(character.conditions || []));
  const proficiencies = PROFICIENCIES
    .map((proficiency) => ({
      ...proficiency,
      xp: character.proficiencies?.[proficiency.id] || 0,
      rating: proficiencyRating(character, proficiency.id),
    }))
    .filter((proficiency) => proficiency.xp > 0)
    .sort((a, b) => b.rating - a.rating || b.xp - a.xp);
  const abilityCategories = [
    ["all", "All"],
    ["martial", "Martial"],
    ["survival", "Survival"],
    ["social", "Social"],
    ["innate", "Innate"],
  ].map(([key, label]) => ({
    key,
    label,
    count: key === "all" ? techniques.length : techniques.filter((ability) => abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === key).length,
  })).filter((category) => category.key === "all" || category.count > 0);
  const visibleAbilities = abilityFilter === "all"
    ? techniques
    : techniques.filter((ability) => abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === abilityFilter);

  return (
    <div className="arsenal-view deck-view">
      <div className="arsenal-hero">
        <div className="arsenal-hero__icon" aria-hidden="true"><Icon name="abilities" size={28} /></div>
        <div>
          <h3>Abilities &amp; Spells</h3>
          <p>Techniques · magic · mastery</p>
        </div>
      </div>

      <section>
        <SectionHeader>Techniques &amp; core actions · {visibleAbilities.length}</SectionHeader>
        <div className="arsenal-filters" role="group" aria-label="Technique categories">
          {abilityCategories.map((category) => (
            <button type="button" key={category.key} aria-pressed={abilityFilter === category.key} onClick={() => setAbilityFilter(category.key)}>
              <span>{category.label}</span><strong>{category.count}</strong>
            </button>
          ))}
        </div>
        <div className="arsenal-list">
          {visibleAbilities.map((ability, index) => {
            const definition = getAbilityDef(ability.id);
            return <AbilityCard key={`${ability.id}-${index}`} ability={ability} definition={definition} />;
          })}
        </div>
      </section>

      <section>
        <SectionHeader>Spells · {combatSpells.length + boons.length + travelSpells.length}</SectionHeader>
        {combatSpells.length + boons.length + travelSpells.length === 0 ? (
          <div className="arsenal-empty">No spells learned yet. Grimoires and teachers can awaken new magic.</div>
        ) : (
          <div className="spell-list">
            {combatSpells.map((ability, index) => {
              const definition = getAbilityDef(ability.id);
              return <AbilityCard key={`${ability.id}-${index}`} ability={ability} definition={definition} variant="spell" />;
            })}
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
