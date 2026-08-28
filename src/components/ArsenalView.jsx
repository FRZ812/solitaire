import React, { useState } from "react";
import { AbilityIcon } from "./AbilityIcon.jsx";
import { DeckPage, DeckPageHeader } from "./DeckPage.jsx";
import { SectionHeader } from "./primitives.jsx";
import { tierColor, tierLabel, tierOrder } from "../data/tiers.js";
import { getAbilityDef, abilityStatLine, abilityReqLine, classifyLegacyAbilityGrant } from "../data/abilities.js";
import { PROFICIENCIES, proficiencyRating, proficiencyDef } from "../data/proficiencies.js";
import { knownBuffSpells } from "../data/buff-spells.js";
import { knownTravelSpells } from "../data/travel-spells.js";
import { condNames } from "../data/conditions.js";
import { ATTR_LABELS } from "../config.js";
import { abilityTaxonomy } from "../data/ability-taxonomy.js";
import { progressionNarrativeProjection } from "../engine/progression-abilities.js";
import {
  CHARACTER_ABILITY_TYPE_LABELS,
  describeCharacterAbilityEffect,
} from "../gameplay/combat/character-abilities.js";
import { getSkill, resolveCost, skillRarityAtRank } from "../gameplay/combat/skills.js";
import { resolveCombatAbilityArt } from "./combat/archetype-combat-ability-art.js";

const CORE = new Set(["basic-attack", "defend", "talk"]);

export function arsenalAbilityGroups(character, progressionProjection = progressionNarrativeProjection(character)) {
  const usesCombatProgression = character?.progressionModel === "archetype";
  const learned = usesCombatProgression ? [] : progressionProjection.abilities.map((ability) => (
    typeof ability === "string"
      ? { id: ability, tier: "common" }
      : { id: ability.id, tier: ability.tier || "common" }
  ));
  const abilities = [...new Map(
    [...(usesCombatProgression ? [] : [...CORE].map((id) => ({ id, tier: "common" }))), ...learned]
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
    performances: abilities.filter((ability) => (
      abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === "performance"
    )),
    fieldcraft: abilities.filter((ability) => (
      abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === "fieldcraft"
    )),
    subterfuge: abilities.filter((ability) => (
      abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === "subterfuge"
    )),
    oathcraft: abilities.filter((ability) => (
      abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === "oathcraft"
    )),
    primalcraft: abilities.filter((ability) => (
      abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === "primalcraft"
    )),
    pactcraft: abilities.filter((ability) => (
      abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === "pactcraft"
    )),
    devicecraft: abilities.filter((ability) => (
      abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === "devicecraft"
    )),
    techniques: abilities.filter((ability) => (
      !["magic", "performance", "fieldcraft", "subterfuge", "oathcraft", "primalcraft", "pactcraft", "devicecraft"].includes(abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId)
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

export function combatArsenalAbilityRows(entries = []) {
  return entries.flatMap((entry) => {
    const id = typeof entry === "string" ? entry : entry?.id;
    const rank = Number.isSafeInteger(entry?.rank) && entry.rank > 0 ? entry.rank : 1;
    const definition = getSkill(id);
    if (!definition?.abilityType) return [];
    const details = definition.effects.map((effect) => (
      describeCharacterAbilityEffect(effect, rank)
    ));
    return [{
      definition,
      description: details.join(" · "),
      rank,
      rarity: skillRarityAtRank(definition, rank),
      resolveCost: resolveCost(definition.id, rank),
      action: definition.consumesTurn ? "main" : "swift",
      cooldown: definition.cooldown,
    }];
  });
}

function CombatRosterAbilityCard({ ability }) {
  const [open, setOpen] = useState(false);
  const {
    definition, description, rank, rarity, resolveCost: cost, action, cooldown,
  } = ability;
  const label = CHARACTER_ABILITY_TYPE_LABELS[definition.abilityType] || "Combat ability";
  const timing = `${action === "main" ? "Main" : "Swift"} action`;
  const cooldownCopy = cooldown > 0 ? ` · ${cooldown}-turn cooldown` : "";
  return (
    <button
      type="button"
      className={`combat-arsenal-card${open ? " is-open" : ""}`}
      data-ability-type={definition.abilityType}
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
    >
      <img src={resolveCombatAbilityArt(definition)} alt="" />
      <span>
        <small>{label} · {rarity} · Rank {rank} · {cost} Resolve · {timing}{cooldownCopy}</small>
        <strong>{definition.name}</strong>
        {open ? <p>{description}</p> : null}
      </span>
      <em aria-hidden="true">{open ? "−" : "+"}</em>
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

// Dedicated deck page for combat techniques, learned magic, and proficiencies.
// Casting travel spells stays on the map because each one needs a destination.
export function ArsenalView({ state, onCastBuff }) {
  const character = state.character;
  const usesCombatProgression = character.progressionModel === "archetype";
  const progressionProjection = progressionNarrativeProjection(character);
  const combatRosterAbilities = usesCombatProgression
    ? combatArsenalAbilityRows(state.mechanics?.build?.skills || [])
    : [];
  const projectedCharacter = {
    ...character,
    abilities: usesCombatProgression
      ? (character.abilities || []).filter((entry) => (
          classifyLegacyAbilityGrant(typeof entry === "string" ? entry : entry?.id) === "world"
        ))
      : progressionProjection.abilities,
  };
  const { spells: combatSpells } = arsenalAbilityGroups(character, progressionProjection);

  const boons = knownBuffSpells(projectedCharacter);
  const travelSpells = knownTravelSpells(projectedCharacter);

  const activeConditions = new Set(condNames(character.conditions || []));
  const proficiencies = PROFICIENCIES
    .map((proficiency) => ({
      ...proficiency,
      xp: character.proficiencies?.[proficiency.id] || 0,
      rating: proficiencyRating(character, proficiency.id),
    }))
    .filter((proficiency) => proficiency.xp > 0)
    .sort((a, b) => b.rating - a.rating || b.xp - a.xp);

  return (
    <DeckPage className="arsenal-view">
      <DeckPageHeader
        icon="abilities"
        title="Skills"
        subtitle="archetype combat kit · world powers · proficiencies"
      />

      {combatRosterAbilities.length > 0 ? (
        <section className="combat-arsenal" aria-label="archetype combat kit">
          <SectionHeader>archetype combat kit · {combatRosterAbilities.length}</SectionHeader>
          <div className="combat-arsenal__list">
            {combatRosterAbilities.map((ability) => (
              <CombatRosterAbilityCard key={ability.definition.id} ability={ability} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader>World powers · {combatSpells.length + boons.length + travelSpells.length}</SectionHeader>
        {combatSpells.length + boons.length + travelSpells.length === 0 ? (
          <div className="arsenal-empty">No world powers learned yet. Rare teachers and discoveries can awaken them.</div>
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
        <SectionHeader>Proficiencies · {proficiencies.length}</SectionHeader>
        {proficiencies.length === 0 ? (
          <div className="arsenal-empty">Practice in the field to establish your first proficiency.</div>
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
    </DeckPage>
  );
}
