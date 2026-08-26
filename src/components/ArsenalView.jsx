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
} from "../gameplay/tow/character-abilities.js";
import { getSkill, resolveCost, skillRarityAtRank } from "../gameplay/tow/skills.js";
import { combatPolicyClausesForSkill } from "../gameplay/tow/combat-policy.js";
import { resolveTowAbilityArt } from "./combat/tow-combat-ability-art.js";

const CORE = new Set(["basic-attack", "defend", "talk"]);

export function arsenalAbilityGroups(character, progressionProjection = progressionNarrativeProjection(character)) {
  const usesTowProgression = character?.progressionModel === "tow-archetype";
  const learned = usesTowProgression ? [] : progressionProjection.abilities.map((ability) => (
    typeof ability === "string"
      ? { id: ability, tier: "common" }
      : { id: ability.id, tier: ability.tier || "common" }
  ));
  const abilities = [...new Map(
    [...(usesTowProgression ? [] : [...CORE].map((id) => ({ id, tier: "common" }))), ...learned]
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

export function towArsenalAbilityRows(entries = []) {
  return entries.flatMap((entry) => {
    const id = typeof entry === "string" ? entry : entry?.id;
    const rank = Number.isSafeInteger(entry?.rank) && entry.rank > 0 ? entry.rank : 1;
    const definition = getSkill(id);
    if (!definition?.abilityType) return [];
    const details = definition.effects.map((effect) => (
      describeCharacterAbilityEffect(effect, rank)
    ));
    details.push(...combatPolicyClausesForSkill(definition));
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

function TowRosterAbilityCard({ ability }) {
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
      className={`tow-arsenal-card${open ? " is-open" : ""}`}
      data-ability-type={definition.abilityType}
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
    >
      <img src={resolveTowAbilityArt(definition)} alt="" />
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
  const usesTowProgression = character.progressionModel === "tow-archetype";
  const [abilityFilter, setAbilityFilter] = useState("all");
  const progressionProjection = progressionNarrativeProjection(character);
  const towRosterAbilities = usesTowProgression
    ? towArsenalAbilityRows(state.mechanics?.build?.skills || [])
    : [];
  const projectedCharacter = {
    ...character,
    abilities: usesTowProgression
      ? (character.abilities || []).filter((entry) => (
          classifyLegacyAbilityGrant(typeof entry === "string" ? entry : entry?.id) === "world"
        ))
      : progressionProjection.abilities,
  };
  const { techniques, performances, fieldcraft, subterfuge, oathcraft, primalcraft, pactcraft, devicecraft, spells: combatSpells } = arsenalAbilityGroups(character, progressionProjection);
  const trainedAbilities = [...techniques, ...performances, ...fieldcraft, ...subterfuge, ...oathcraft, ...primalcraft, ...pactcraft, ...devicecraft]
    .sort((a, b) => tierOrder(b.tier) - tierOrder(a.tier));

  const boons = knownBuffSpells(projectedCharacter);
  const travelSpells = knownTravelSpells(projectedCharacter);
  const metamagicProfiles = usesTowProgression ? [] : progressionProjection.metamagicProfiles;
  const progressionCapabilities = usesTowProgression
    ? []
    : progressionProjection.progressionCapabilities || progressionProjection.branchCapabilities;
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
    ["performance", "Performance"],
    ["fieldcraft", "Fieldcraft"],
    ["subterfuge", "Subterfuge"],
    ["oathcraft", "Oathcraft"],
    ["primalcraft", "Primal Arts"],
    ["pactcraft", "Pact Arts"],
    ["devicecraft", "Devices"],
    ["innate", "Innate"],
  ].map(([key, label]) => ({
    key,
    label,
    count: key === "all" ? trainedAbilities.length : trainedAbilities.filter((ability) => abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === key).length,
  })).filter((category) => category.key === "all" || category.count > 0);
  const visibleAbilities = abilityFilter === "all"
    ? trainedAbilities
    : trainedAbilities.filter((ability) => abilityTaxonomy(getAbilityDef(ability.id), ability.tier).categoryId === abilityFilter);

  return (
    <DeckPage className="arsenal-view">
      <DeckPageHeader
        icon="abilities"
        title="Skills"
        subtitle={usesTowProgression
          ? "Tower combat kit · world powers · proficiencies"
          : "Techniques · performances · fieldcraft · subterfuge · oathcraft · primal arts · pact arts · devices · spells · proficiencies"}
      />

      {towRosterAbilities.length > 0 ? (
        <section className="tow-arsenal" aria-label="Tower combat kit">
          <SectionHeader>Tower combat kit · {towRosterAbilities.length}</SectionHeader>
          <div className="tow-arsenal__list">
            {towRosterAbilities.map((ability) => (
              <TowRosterAbilityCard key={ability.definition.id} ability={ability} />
            ))}
          </div>
        </section>
      ) : null}

      {!usesTowProgression && <section>
        <SectionHeader>Techniques, performances, fieldcraft, subterfuge, oathcraft, primal arts, pact arts, devices &amp; core actions · {visibleAbilities.length}</SectionHeader>
        <div className="arsenal-filters" role="group" aria-label="Skill categories">
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
      </section>}

      {(metamagicProfiles.length > 0 || progressionCapabilities.length > 0) && (
        <section aria-label="Earned progression capabilities">
          <SectionHeader>Progression capabilities · {metamagicProfiles.length + progressionCapabilities.length}</SectionHeader>
          <div className="progression-capability-list">
            {metamagicProfiles.map((profile) => (
              <article className="progression-capability-card" key={`metamagic-${profile.abilityId}`}>
                <header>
                  <strong>{profile.abilityName}</strong>
                  <span>{profile.primarySignature ? "Primary signature" : "Spell profile"}</span>
                </header>
                <ul>
                  {profile.features.map((feature) => (
                    <li key={feature.id}>
                      <strong>{feature.name}</strong>
                      <p>{feature.description}</p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
            {progressionCapabilities.map((feature) => (
              <article className="progression-capability-card" key={`${feature.type}-${feature.id}`}>
                <header>
                  <strong>{feature.name}</strong>
                  <span>{feature.scope === "general" ? `General ${feature.type}` : feature.type === "passive" ? "Branch passive" : "Branch capability"}</span>
                </header>
                {feature.description && <p>{feature.description}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader>{usesTowProgression ? "World powers" : "Spells"} · {combatSpells.length + boons.length + travelSpells.length}</SectionHeader>
        {combatSpells.length + boons.length + travelSpells.length === 0 ? (
          <div className="arsenal-empty">{usesTowProgression
            ? "No world powers learned yet. Rare teachers and discoveries can awaken them."
            : "No spells learned yet. Grimoires and teachers can awaken new magic."}</div>
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
