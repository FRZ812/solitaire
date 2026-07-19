import React, { useEffect, useMemo, useState } from "react";
import { MEMORY_BANK_LIMIT } from "../config.js";
import { MEMORY_CAP } from "../engine/relationships.js";
import { mergeMemoryBank, normalizeMemoryBank } from "../engine/memory.js";
import {
  NARRATOR_INSTRUCTION_LIMIT,
  NARRATOR_MEMORY_MODES,
  normalizeNarratorSettings,
} from "../engine/narrator-settings.js";
import {
  ATLAS_QUALITY_MODES,
  STORY_FONT_SCALES,
  getAtlasQuality,
  getStoryFontScale,
  setAtlasQuality,
  setStoryFontScale,
} from "../engine/preferences.js";
import { DeckPage, DeckPageHeader } from "./DeckPage.jsx";
import { Icon } from "./Icon.jsx";
import "./settings.css";

const SECTIONS = [
  { id: "narrator", label: "Instructions", icon: "book" },
  { id: "memory", label: "Memory", icon: "codex" },
  { id: "general", label: "General", icon: "settings" },
];

const STEERING_PRESETS = [
  ["Concise", "Keep most story beats focused and concise while preserving atmosphere and consequence."],
  ["Dialogue", "Favor characterful dialogue and let NPC voices carry more of each scene."],
  ["Slow burn", "Use patient pacing. Let tension, relationships, and discoveries develop over several turns."],
  ["Cinematic", "Favor vivid sensory staging, strong visual composition, and decisive scene endings."],
];

export function SettingsView({
  state,
  user,
  onUpdateNarratorSettings = () => {},
  onUpdateMemories = () => {},
  onUpdateCharacterMemories = () => {},
  onReset,
  onBackToCampaigns,
  onSignOut,
  onLinkEmail,
}) {
  const [section, setSection] = useState("narrator");
  const settings = normalizeNarratorSettings(state.narratorSettings);

  return (
    <DeckPage className="settings-view">
      <DeckPageHeader icon="settings" title="Settings" subtitle="Narrator · memory · campaign" />
      <nav className="settings-nav" aria-label="Settings sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? "is-active" : ""}
            aria-pressed={section === item.id}
            onClick={() => setSection(item.id)}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </button>
        ))}
      </nav>

      {section === "narrator" && (
        <NarratorInstructions
          settings={settings}
          onSave={onUpdateNarratorSettings}
        />
      )}
      {section === "memory" && (
        <MemoryManagement
          state={state}
          settings={settings}
          onUpdateNarratorSettings={onUpdateNarratorSettings}
          onUpdateMemories={onUpdateMemories}
          onUpdateCharacterMemories={onUpdateCharacterMemories}
        />
      )}
      {section === "general" && (
        <GeneralSettings
          user={user}
          onReset={onReset}
          onBackToCampaigns={onBackToCampaigns}
          onSignOut={onSignOut}
          onLinkEmail={onLinkEmail}
        />
      )}
    </DeckPage>
  );
}

function NarratorInstructions({ settings, onSave }) {
  const [draft, setDraft] = useState(settings.instructions);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(settings.instructions), [settings.instructions]);

  function addPreset(text) {
    setDraft((current) => current.includes(text) ? current : [current.trim(), text].filter(Boolean).join("\n"));
    setSaved(false);
  }

  function save() {
    onSave({ ...settings, instructions: draft });
    setSaved(true);
  }

  return (
    <section className="settings-card settings-instructions">
      <div className="settings-card__heading">
        <div><small>Narration steering</small><h4>Direct the storyteller</h4></div>
        <span>Campaign scoped</span>
      </div>
      <p className="settings-help">
        Persistent creative direction is included with every narrator turn. It can steer voice, pacing, focus, and recurring behavior without changing hard game state.
      </p>
      <div className="settings-presets" aria-label="Narrator instruction presets">
        {STEERING_PRESETS.map(([label, text]) => (
          <button key={label} type="button" onClick={() => addPreset(text)}>+ {label}</button>
        ))}
      </div>
      <label className="settings-field">
        <span>Persistent instructions</span>
        <textarea
          value={draft}
          maxLength={NARRATOR_INSTRUCTION_LIMIT}
          onChange={(event) => { setDraft(event.target.value); setSaved(false); }}
          placeholder="Example: Keep the political intrigue grounded. Give companions room to disagree, and avoid resolving mysteries too quickly."
        />
      </label>
      <div className="settings-editor-footer">
        <small>{draft.length.toLocaleString()} / {NARRATOR_INSTRUCTION_LIMIT.toLocaleString()}</small>
        <button type="button" className="settings-secondary" onClick={() => { setDraft(""); setSaved(false); }}>Clear</button>
        <button type="button" className="settings-primary" onClick={save} disabled={draft.trim() === settings.instructions}>
          {saved ? "Saved" : "Save instructions"}
        </button>
      </div>
    </section>
  );
}

function MemoryManagement({ state, settings, onUpdateNarratorSettings, onUpdateMemories, onUpdateCharacterMemories }) {
  const globalMemories = normalizeMemoryBank(state.memories);
  const characters = useMemo(() => Object.values(state.world?.codex?.characters || {})
    .filter((character) => character?.id && character.kind !== "player")
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id))), [state.world?.codex?.characters]);
  const charactersWithMemories = characters.filter((character) => character.memories?.length);
  const [newGlobal, setNewGlobal] = useState("");
  const [characterId, setCharacterId] = useState(characters[0]?.id || "");
  const [newRelationshipMemory, setNewRelationshipMemory] = useState("");

  function addGlobal() {
    const next = mergeMemoryBank(globalMemories, [newGlobal]);
    if (JSON.stringify(next) === JSON.stringify(globalMemories)) return;
    onUpdateMemories(next);
    setNewGlobal("");
  }

  function addRelationshipMemory() {
    const character = characters.find((candidate) => candidate.id === characterId);
    if (!character) return;
    const next = mergeMemoryBank(character.memories, [newRelationshipMemory], MEMORY_CAP);
    if (JSON.stringify(next) === JSON.stringify(character.memories || [])) return;
    onUpdateCharacterMemories(character.id, next);
    setNewRelationshipMemory("");
  }

  return (
    <div className="settings-stack">
      <section className="settings-card">
        <div className="settings-card__heading">
          <div><small>Automatic capture</small><h4>Memory tool policy</h4></div>
          <span>{settings.memoryMode}</span>
        </div>
        <div className="memory-mode-grid">
          {NARRATOR_MEMORY_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={settings.memoryMode === mode.id ? "is-active" : ""}
              aria-pressed={settings.memoryMode === mode.id}
              onClick={() => onUpdateNarratorSettings({ ...settings, memoryMode: mode.id })}
            >
              <strong>{mode.label}</strong>
              <span>{mode.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__heading">
          <div><small>World & plot</small><h4>Durable memory bank</h4></div>
          <span>{globalMemories.length} / {MEMORY_BANK_LIMIT}</span>
        </div>
        <p className="settings-help">Authoritative long-term facts available on every turn. Edit wording, remove stale canon, or add a fact yourself.</p>
        <div className="memory-list">
          {globalMemories.length ? globalMemories.map((memory, index) => (
            <MemoryRow
              key={`${index}-${memory}`}
              memory={memory}
              onSave={(text) => onUpdateMemories(globalMemories.map((item, itemIndex) => itemIndex === index ? text : item))}
              onDelete={() => onUpdateMemories(globalMemories.filter((_, itemIndex) => itemIndex !== index))}
            />
          )) : <EmptyMemory text="No durable memories have been recorded yet." />}
        </div>
        <MemoryComposer
          value={newGlobal}
          onChange={setNewGlobal}
          onAdd={addGlobal}
          placeholder="Add an authoritative world or plot fact…"
        />
      </section>

      <section className="settings-card">
        <div className="settings-card__heading">
          <div><small>People</small><h4>Relationship memories</h4></div>
          <span>{charactersWithMemories.reduce((sum, character) => sum + character.memories.length, 0)} recorded</span>
        </div>
        <p className="settings-help">What individual characters remember about their shared history with the player.</p>
        <div className="relationship-memory-list">
          {charactersWithMemories.length ? charactersWithMemories.map((character) => (
            <details key={character.id}>
              <summary><strong>{character.name || character.id}</strong><span>{character.memories.length}</span></summary>
              <div className="memory-list">
                {character.memories.map((memory, index) => (
                  <MemoryRow
                    key={`${character.id}-${index}-${memory}`}
                    memory={memory}
                    onSave={(text) => onUpdateCharacterMemories(character.id, character.memories.map((item, itemIndex) => itemIndex === index ? text : item))}
                    onDelete={() => onUpdateCharacterMemories(character.id, character.memories.filter((_, itemIndex) => itemIndex !== index))}
                  />
                ))}
              </div>
            </details>
          )) : <EmptyMemory text="No character has recorded a shared memory yet." />}
        </div>
        {characters.length > 0 && (
          <div className="relationship-memory-add">
            <select value={characterId} onChange={(event) => setCharacterId(event.target.value)} aria-label="Character for new relationship memory">
              {characters.map((character) => <option key={character.id} value={character.id}>{character.name || character.id}</option>)}
            </select>
            <MemoryComposer
              value={newRelationshipMemory}
              onChange={setNewRelationshipMemory}
              onAdd={addRelationshipMemory}
              placeholder="Add something this character remembers…"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function MemoryRow({ memory, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory);
  return (
    <div className={`memory-row${editing ? " is-editing" : ""}`}>
      {editing ? (
        <textarea value={draft} maxLength={600} onChange={(event) => setDraft(event.target.value)} aria-label="Edit memory" />
      ) : <p>{memory}</p>}
      <div>
        {editing ? (
          <>
            <button type="button" onClick={() => { setDraft(memory); setEditing(false); }}>Cancel</button>
            <button type="button" className="is-save" disabled={!draft.trim()} onClick={() => { onSave(draft); setEditing(false); }}>Save</button>
          </>
        ) : <button type="button" onClick={() => setEditing(true)}>Edit</button>}
        <button type="button" className="is-delete" onClick={onDelete}>Remove</button>
      </div>
    </div>
  );
}

function MemoryComposer({ value, onChange, onAdd, placeholder }) {
  return (
    <div className="memory-composer">
      <textarea value={value} maxLength={600} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <button type="button" className="settings-primary" disabled={!value.trim()} onClick={onAdd}>Add memory</button>
    </div>
  );
}

function EmptyMemory({ text }) {
  return <div className="memory-empty"><Icon name="book" size={18} /><span>{text}</span></div>;
}

function GeneralSettings({ user, onReset, onBackToCampaigns, onSignOut, onLinkEmail }) {
  const [fontScale, setFontScale] = useState(getStoryFontScale());
  const [atlasQuality, setAtlasQualityState] = useState(getAtlasQuality());
  const [email, setEmail] = useState("");
  const [linkStatus, setLinkStatus] = useState("");
  const currentIndex = Math.max(0, STORY_FONT_SCALES.findIndex((scale) => scale.id === fontScale));
  const current = STORY_FONT_SCALES[currentIndex];
  const currentQuality = ATLAS_QUALITY_MODES.find((mode) => mode.id === atlasQuality)
    || ATLAS_QUALITY_MODES[0];

  function chooseScale(index) {
    const scale = STORY_FONT_SCALES[Math.max(0, Math.min(STORY_FONT_SCALES.length - 1, index))];
    setStoryFontScale(scale.id);
    setFontScale(scale.id);
  }

  function chooseAtlasQuality(id) {
    setAtlasQuality(id);
    setAtlasQualityState(id);
  }

  async function linkGuest(event) {
    event.preventDefault();
    if (!email.trim() || !onLinkEmail) return;
    setLinkStatus("Sending…");
    try {
      await onLinkEmail(email.trim());
      setLinkStatus("Check your email for the confirmation link.");
    } catch (error) {
      setLinkStatus(error?.message || "Could not send the link.");
    }
  }

  return (
    <div className="settings-stack">
      <section className="settings-card">
        <div className="settings-card__heading"><div><small>Reading</small><h4>Story text size</h4></div><span>{current.label}</span></div>
        <div className="font-scale-control">
          <button type="button" onClick={() => chooseScale(currentIndex - 1)} disabled={currentIndex === 0} aria-label="Decrease story text size"><Icon name="zoomOut" size={18} /></button>
          <div aria-live="polite"><strong>{current.label}</strong><span>Preview the story at this scale</span></div>
          <button type="button" onClick={() => chooseScale(currentIndex + 1)} disabled={currentIndex === STORY_FONT_SCALES.length - 1} aria-label="Increase story text size"><Icon name="zoomIn" size={18} /></button>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card__heading">
          <div><small>World atlas</small><h4>Map detail</h4></div>
          <span>{currentQuality.label}</span>
        </div>
        <p className="settings-help">
          Rendering quality for the 3D world atlas. Auto matches this device; a forced mode applies immediately, even to an open map.
        </p>
        <div className="memory-mode-grid" aria-label="Map detail modes">
          {ATLAS_QUALITY_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={atlasQuality === mode.id ? "is-active" : ""}
              aria-pressed={atlasQuality === mode.id}
              onClick={() => chooseAtlasQuality(mode.id)}
            >
              <strong>{mode.label}</strong>
              <span>{mode.description}</span>
            </button>
          ))}
        </div>
      </section>

      {user?.is_anonymous && onLinkEmail && (
        <section className="settings-card">
          <div className="settings-card__heading"><div><small>Guest account</small><h4>Keep this campaign</h4></div></div>
          <p className="settings-help">Link an email so this campaign can be resumed on another device.</p>
          <form className="guest-link-form" onSubmit={linkGuest}>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            <button className="settings-primary" type="submit" disabled={!email.trim()}>Link email</button>
          </form>
          {linkStatus && <p className="settings-status" role="status">{linkStatus}</p>}
        </section>
      )}

      <section className="settings-card settings-campaign-actions">
        <div className="settings-card__heading"><div><small>Campaign</small><h4>Journey controls</h4></div></div>
        {onBackToCampaigns && <button type="button" onClick={onBackToCampaigns}><Icon name="arrowLeft" size={15} />Back to campaigns</button>}
        {onReset && <button type="button" className="is-danger" onClick={onReset}><Icon name="reset" size={15} />Reset campaign</button>}
        {onSignOut && <button type="button" onClick={onSignOut}>Sign out</button>}
      </section>
    </div>
  );
}
