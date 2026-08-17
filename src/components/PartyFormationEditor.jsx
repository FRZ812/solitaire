import React, { useEffect, useId, useMemo, useState } from "react";
import "./party-formation.css";

export const PARTY_FORMATION_SIZE = 9;

const ROW_LABELS = Object.freeze(["Front", "Middle", "Rear"]);
const WANDERER = Object.freeze({ id: "wanderer", name: "You" });

function normalizedMembers(members) {
  const byId = new Map([[WANDERER.id, WANDERER]]);
  for (const member of members || []) {
    if (!member || typeof member.id !== "string" || !member.id.trim()) continue;
    const id = member.id.trim();
    byId.set(id, { ...member, id, name: member.name || (id === WANDERER.id ? "You" : id) });
  }
  return [...byId.values()];
}

export function normalizePartyFormation(formation, members) {
  const memberIds = new Set(normalizedMembers(members).map((member) => member.id));
  const assigned = new Set();
  const supplied = Array.isArray(formation) ? formation : [];
  return Array.from({ length: PARTY_FORMATION_SIZE }, (_, index) => {
    const id = typeof supplied[index] === "string" ? supplied[index] : null;
    if (!id || !memberIds.has(id) || assigned.has(id)) return null;
    assigned.add(id);
    return id;
  });
}

function initials(name) {
  const words = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join("") || "?").toUpperCase();
}

function cellLabel({ rowLabel, column, member, selectedName }) {
  const position = `${rowLabel} row, position ${column + 1}`;
  if (member) {
    return selectedName && selectedName !== member.name
      ? `${position}, occupied by ${member.name}. Place ${selectedName} here and swap them.`
      : `${position}, occupied by ${member.name}. Select ${member.name}.`;
  }
  return selectedName
    ? `${position}, empty. Place ${selectedName} here.`
    : `${position}, empty. Select a company member first.`;
}

/**
 * Controlled campaign formation editor. IDs are durable party/codex IDs; encounter actor
 * IDs are intentionally outside this component's contract.
 */
export function PartyFormationEditor({ members = [], formation = [], onChange = null }) {
  const helpId = useId();
  const [selectedId, setSelectedId] = useState(null);
  const roster = useMemo(() => normalizedMembers(members), [members]);
  const cells = useMemo(() => normalizePartyFormation(formation, roster), [formation, roster]);
  const membersById = useMemo(
    () => Object.fromEntries(roster.map((member) => [member.id, member])),
    [roster],
  );
  const selectedMember = selectedId ? membersById[selectedId] : null;
  const assigned = new Set(cells.filter(Boolean));

  useEffect(() => {
    if (selectedId && !membersById[selectedId]) setSelectedId(null);
  }, [membersById, selectedId]);

  function chooseMember(id) {
    setSelectedId((current) => current === id ? null : id);
  }

  function chooseCell(index) {
    const occupantId = cells[index];
    if (!selectedId) {
      if (occupantId) setSelectedId(occupantId);
      return;
    }

    const sourceIndex = cells.indexOf(selectedId);
    if (sourceIndex === index) {
      setSelectedId(null);
      return;
    }

    const next = [...cells];
    next[index] = selectedId;
    if (sourceIndex >= 0) next[sourceIndex] = occupantId || null;
    onChange?.(next);
    setSelectedId(null);
  }

  return (
    <section className="party-formation-editor" aria-labelledby={`${helpId}-title`}>
      <header className="party-formation-editor__heading">
        <span>
          <small>Battle order</small>
          <strong id={`${helpId}-title`}>Formation</strong>
        </span>
        <b>{assigned.size} / {PARTY_FORMATION_SIZE} fielded</b>
      </header>

      <p id={helpId} className="party-formation-editor__help">
        Select a companion, then choose their place. Occupied places swap; changes apply to future fights.
      </p>

      <div className="party-formation-editor__board" aria-describedby={helpId}>
        {ROW_LABELS.map((rowLabel, row) => (
          <div key={rowLabel} className="party-formation-editor__row" role="group" aria-label={`${rowLabel} row`}>
            <span className="party-formation-editor__row-label" aria-hidden="true">{rowLabel}</span>
            {Array.from({ length: 3 }, (_, column) => {
              const index = (row * 3) + column;
              const memberId = cells[index];
              const member = memberId ? membersById[memberId] : null;
              const selected = Boolean(memberId && memberId === selectedId);
              return (
                <button
                  key={index}
                  type="button"
                  className={`party-formation-editor__cell${member ? " is-occupied" : " is-empty"}${selected ? " is-selected" : ""}`}
                  data-cell-index={index}
                  data-member-id={memberId || undefined}
                  aria-label={cellLabel({
                    rowLabel,
                    column,
                    member,
                    selectedName: selectedMember?.name,
                  })}
                  aria-pressed={selected}
                  disabled={!member && !selectedMember}
                  onClick={() => chooseCell(index)}
                >
                  {member ? (
                    <>
                      <span className="party-formation-editor__avatar" aria-hidden="true">
                        {initials(member.name)}
                      </span>
                      <span className="party-formation-editor__member-name">{member.name}</span>
                    </>
                  ) : (
                    <span className="party-formation-editor__vacancy" aria-hidden="true">+</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="party-formation-editor__roster" aria-label="Company members">
        {roster.map((member) => {
          const selected = member.id === selectedId;
          const fielded = assigned.has(member.id);
          return (
            <button
              key={member.id}
              type="button"
              className={`party-formation-editor__chip${selected ? " is-selected" : ""}${fielded ? " is-fielded" : " is-reserve"}`}
              aria-pressed={selected}
              aria-label={`${member.name}, ${fielded ? "fielded" : "in reserve"}${selected ? ", selected" : ". Select for placement"}`}
              onClick={() => chooseMember(member.id)}
            >
              <span aria-hidden="true">{initials(member.name)}</span>
              <strong>{member.name}</strong>
              <small>{fielded ? "Fielded" : "Reserve"}</small>
            </button>
          );
        })}
      </div>

      <p className="party-formation-editor__selection" aria-live="polite">
        {selectedMember ? `${selectedMember.name} selected. Choose a formation position.` : "No one selected."}
      </p>
    </section>
  );
}

export default PartyFormationEditor;
