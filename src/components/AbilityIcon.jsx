import React from "react";
import schoolAtlas from "../assets/generated/spell-schools/school-atlas-v2.png";
import categoryAtlas from "../assets/generated/icon-atlases/ability-categories-atlas-v1.png";
import { abilityTaxonomy } from "../data/ability-taxonomy.js";
import "./ability-icon.css";

const SCHOOL_POSITIONS = Object.freeze({
  abjuration: "0% 0%",
  conjuration: "50% 0%",
  divination: "100% 0%",
  enchantment: "0% 50%",
  evocation: "100% 50%",
  illusion: "0% 100%",
  necromancy: "50% 100%",
  transmutation: "100% 100%",
});

const CATEGORY_POSITIONS = Object.freeze({
  martial: "0% 0%",
  survival: "50% 0%",
  social: "100% 0%",
  innate: "0% 50%",
  magic: "50% 50%",
});

export function AbilityIcon({
  ability,
  tierId = "common",
  size = "medium",
  className = "",
  decorative = false,
}) {
  const taxonomy = abilityTaxonomy(ability, tierId);
  const school = taxonomy.magicSchool;
  const label = school
    ? `${school.label} magic · ${taxonomy.tier.label}`
    : `${taxonomy.category.label} ability`;
  const style = {
    "--ability-tier": taxonomy.tier.color,
    "--ability-school-position": SCHOOL_POSITIONS[taxonomy.magicSchoolId] || "50% 50%",
    "--ability-school-atlas": `url(${schoolAtlas})`,
    "--ability-category-position": CATEGORY_POSITIONS[taxonomy.categoryId] || "0% 0%",
    "--ability-category-atlas": `url(${categoryAtlas})`,
  };

  return (
    <span
      className={`ability-icon ability-icon--${size} ability-icon--${taxonomy.categoryId}${school ? " is-school" : " is-category"}${className ? ` ${className}` : ""}`}
      style={style}
      title={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? "true" : undefined}
      data-icon-key={taxonomy.iconKey}
      data-school={taxonomy.magicSchoolId || undefined}
      data-tier={taxonomy.tierId}
    >
      {school ? (
        <span className="ability-icon__school" aria-hidden="true" />
      ) : (
        <span className="ability-icon__category" aria-hidden="true" />
      )}
    </span>
  );
}
