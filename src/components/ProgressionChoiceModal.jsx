import React, { useEffect, useRef } from "react";
import { getAbilityDef } from "../data/abilities.js";
import { METAMAGIC_FEATURES, PROGRESSION_FEATURES } from "../data/progression-features.js";

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function choiceId(choice) {
  return choice?.id || choice?.choiceId || choice?.key || null;
}

function optionId(option) {
  return typeof option === "string" ? option : (option?.id || option?.optionId || option?.value || option?.key);
}

function optionDetails(choice, option) {
  const id = optionId(option);
  const record = typeof option === "string" ? { id } : { ...option };
  const catalog = choice?.type === "ability-choice"
    ? getAbilityDef(id)
    : choice?.type === "metamagic-choice"
      ? METAMAGIC_FEATURES[id]
      : null;
  return {
    ...record,
    name: record.name || record.label || catalog?.name || titleCase(id),
    description: record.description || catalog?.description || catalog?.desc || "",
  };
}

function optionCaption(choice, record, id) {
  if (record.track) return `${titleCase(record.track)} level`;
  if (choice?.type === "metamagic-choice") return "Metamagic choice";
  if (choice?.type === "ability-choice") {
    const ability = getAbilityDef(id);
    const spell = ability && (Number(ability.resolveCost) > 0 || !["martial", "social", "survival"].includes(ability.school));
    return spell ? "Spell choice" : "Ability choice";
  }
  if (record.kind) return titleCase(record.kind);
  return choice?.kind === "racial-branch" ? "Evolution branch" : "Specialization branch";
}

function grantLabel(grant) {
  if (!grant) return null;
  if (grant.name || grant.label) return grant.name || grant.label;
  if (grant.type === "ability") return getAbilityDef(grant.id)?.name || titleCase(grant.id);
  if (grant.type === "ability-choice") return `Choose ${grant.count || 1} abilities`;
  if (grant.type === "metamagic") return METAMAGIC_FEATURES[grant.id]?.name || titleCase(grant.id);
  return PROGRESSION_FEATURES[grant.id]?.name || titleCase(grant.id || grant.type);
}

function ChoiceGrant({ grant }) {
  const label = grantLabel(grant);
  if (!label) return null;
  const options = Array.isArray(grant.options) ? grant.options : [];
  return (
    <li data-grant-type={grant.type || "feature"}>
      <small>{titleCase(grant.type || "feature")}</small>
      <strong>{label}</strong>
      {grant.description && <span>{grant.description}</span>}
      {options.length > 0 && <span>{options.map((id) => (
        grant.type === "metamagic-choice"
          ? METAMAGIC_FEATURES[id]?.name || titleCase(id)
          : getAbilityDef(id)?.name || titleCase(id)
      )).join(" · ")}</span>}
    </li>
  );
}

/**
 * Required progression-choice gate. It deliberately has no close affordance:
 * a threshold choice must be resolved by selecting one authored option.
 * `onChoose` receives `(choiceId, optionId)`.
 */
export function ProgressionChoiceModal({ choice, onChoose, busy = false }) {
  const dialogRef = useRef(null);
  const activeChoiceId = choiceId(choice);

  useEffect(() => {
    if (!activeChoiceId || typeof document === "undefined") return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const focusableElements = () => Array.from(dialog.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const focusFirst = () => (focusableElements()[0] || dialog).focus();
    focusFirst();

    const containKeyboardFocus = (event) => {
      if (event.key === "Escape") {
        // Progression gates are mandatory. Escape must not strand the player
        // behind a visually open modal while focus returns to the game.
        event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    const containProgrammaticFocus = (event) => {
      if (!dialog.contains(event.target)) focusFirst();
    };
    document.addEventListener("keydown", containKeyboardFocus);
    document.addEventListener("focusin", containProgrammaticFocus);
    return () => {
      document.removeEventListener("keydown", containKeyboardFocus);
      document.removeEventListener("focusin", containProgrammaticFocus);
      if (previousFocus?.isConnected && typeof previousFocus.focus === "function") previousFocus.focus();
    };
  }, [activeChoiceId]);

  if (!choice) return null;
  const id = choiceId(choice);
  const options = Array.isArray(choice.options) ? choice.options : [];
  const selectedOptions = new Set((choice.selectedOptions || []).map(optionId).filter(Boolean));
  const remainingCount = Number.isFinite(Number(choice.remainingCount)) ? Math.max(0, Number(choice.remainingCount)) : null;
  const breadcrumbs = choice.breadcrumbs || choice.ancestors || choice.path || [];
  const title = choice.title || choice.name || choice.label || "Choose your specialization";
  const description = choice.description || choice.prompt || "This threshold changes the abilities and later branches available to this character.";
  const allocation = choice.kind === "level-allocation";
  const racialBranch = choice.kind === "racial-branch";
  const track = choice.trackLabel || choice.professionName || (allocation ? "Character progression" : titleCase(choice.professionId || choice.raceId || choice.trackId));
  const threshold = choice.threshold ?? choice.level ?? choice.requiredLevel;
  const thresholdLabel = threshold == null
    ? null
    : allocation ? `Character level ${threshold}` : `${racialBranch ? "Racial" : "Profession"} level ${threshold}`;

  return (
    <div className="progression-choice-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="progression-choice-modal"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={`progression-choice-title-${id || "pending"}`}
        aria-describedby={`progression-choice-description-${id || "pending"}`}
      >
        <header>
          <small>{[track, thresholdLabel].filter(Boolean).join(" · ")}</small>
          <h2 id={`progression-choice-title-${id || "pending"}`}>{title}</h2>
          <p id={`progression-choice-description-${id || "pending"}`}>{description}</p>
        </header>

        {breadcrumbs.length > 0 && (
          <ol className="progression-choice-modal__breadcrumbs" aria-label="Specialization path">
            {breadcrumbs.map((entry, index) => (
              <li key={typeof entry === "string" ? entry : (entry.id || index)}>
                {typeof entry === "string" ? titleCase(entry) : (entry.name || entry.label || titleCase(entry.id))}
              </li>
            ))}
          </ol>
        )}

        <div className="progression-choice-modal__options">
          {options.map((option) => {
            const optionKey = optionId(option);
            const record = optionDetails(choice, option);
            const grants = record.grants || record.rewards || [];
            const selected = selectedOptions.has(optionKey);
            return (
              <button
                key={optionKey}
                type="button"
                className={selected ? "is-selected" : undefined}
                disabled={busy || !optionKey || selected}
                aria-pressed={selected || undefined}
                onClick={() => onChoose?.(id, optionKey)}
              >
                <span className="progression-choice-modal__option-copy">
                  <small>{optionCaption(choice, record, optionKey)}</small>
                  <strong>{record.name}</strong>
                  {record.description && <span>{record.description}</span>}
                </span>
                {grants.length > 0 && (
                  <ul className="progression-choice-modal__grants">
                    {grants.map((grant, index) => <ChoiceGrant key={`${grant.type || "grant"}-${grant.id || index}`} grant={grant} />)}
                  </ul>
                )}
                {selected ? <em>Selected</em> : record.nextChoices?.length > 0 && <em>Unlocks later branch choices</em>}
              </button>
            );
          })}
        </div>

        {options.length === 0 && <p className="progression-choice-modal__empty" role="alert">No authored options are available for this choice.</p>}
        <footer>{busy
          ? "Recording your choice…"
          : remainingCount != null
            ? `${remainingCount} ${remainingCount === 1 ? "selection" : "selections"} remaining. Each selected option becomes part of this progression.`
            : allocation
              ? "Invest this earned level in one racial or profession track to continue."
              : "Choose one path to continue. This decision is not made automatically."}</footer>
      </section>
    </div>
  );
}
