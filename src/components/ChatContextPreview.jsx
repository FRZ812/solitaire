import React from "react";
import { Icon } from "./Icon.jsx";
import { formatTokenCount } from "./chatContextModel.js";

const TABS = [
  ["preview", "Context Preview"],
  ["files", "Pinned/Partial Files"],
  ["instructions", "Instructions"],
  ["settings", "Settings"],
];

function ContextLegend({ sections }) {
  return (
    <div className="chat-context-preview__legend" aria-label="Context sections">
      {sections.map((section) => (
        <span key={section.id}>
          <i style={{ backgroundColor: section.color }} />
          {section.label} <b>{section.percent}%</b>
        </span>
      ))}
    </div>
  );
}

function ContextRows({ sections, expanded, onToggle }) {
  return (
    <div className="chat-context-preview__rows">
      {sections.map((section) => (
        <div className={`chat-context-preview__row${expanded === section.id ? " is-expanded" : ""}`} key={section.id}>
          <button type="button" onClick={() => onToggle(section.id)} aria-expanded={expanded === section.id}>
            <span className="chat-context-preview__chevron" aria-hidden="true">›</span>
            <span className="chat-context-preview__tag" style={{ "--tag-color": section.color }}>{section.label}</span>
            <strong>{formatTokenCount(section.tokens)}</strong>
          </button>
          {expanded === section.id && (
            <div className="chat-context-preview__detail">
              <span>{section.description}</span>
              <pre>{section.content || "No content in this section."}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ChatContextPreview({ preview, state, activeModel, onClose }) {
  const [tab, setTab] = React.useState("preview");
  const [expanded, setExpanded] = React.useState(null);
  const sections = preview?.sections || [];
  const total = preview?.total || 0;
  const instructions = [
    state?.narratorSettings?.instructions,
    ...(Array.isArray(state?.memories) ? state.memories : []),
  ].filter(Boolean);

  return (
    <div className="chat-context-preview-backdrop" role="presentation" onClick={onClose}>
      <section
        className="chat-context-preview"
        role="dialog"
        aria-modal="true"
        aria-label="Context preview"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="chat-context-preview__handle" aria-hidden="true" />
        <header className="chat-context-preview__header">
          <div className="chat-context-preview__tabs" role="tablist" aria-label="Context details">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? "is-active" : ""}
                onClick={() => { setTab(id); setExpanded(null); }}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="chat-context-preview__close" onClick={onClose} aria-label="Close context preview">
            <Icon name="x" size={17} />
          </button>
        </header>

        {tab === "preview" && (
          <div className="chat-context-preview__content">
            <div className="chat-context-preview__summary">
              <div className="chat-context-preview__bar" aria-label={`${formatTokenCount(total)} estimated context tokens`}>
                {sections.map((section) => <i key={section.id} style={{ width: `${section.percent}%`, backgroundColor: section.color }} />)}
              </div>
              <ContextLegend sections={sections} />
              <p>This is the context assembled for the narrator on each turn. {formatTokenCount(total)} estimated tokens across {sections.length} sections.</p>
            </div>
            <ContextRows sections={sections} expanded={expanded} onToggle={setExpanded} />
          </div>
        )}

        {tab === "files" && (
          <div className="chat-context-preview__empty">
            <Icon name="book" size={25} />
            <strong>No files pinned</strong>
            <span>This campaign currently uses authored world data and live state instead of attached files.</span>
          </div>
        )}

        {tab === "instructions" && (
          <div className="chat-context-preview__text-panel">
            <div className="chat-context-preview__text-panel-head"><strong>Campaign instructions</strong><span>{instructions.length} entries</span></div>
            {instructions.length ? instructions.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>) : <p>No extra campaign instructions are set.</p>}
          </div>
        )}

        {tab === "settings" && (
          <div className="chat-context-preview__settings">
            <div><span>Active narrator</span><strong>{activeModel || "Default narrator"}</strong></div>
            <div><span>Context mode</span><strong>Live campaign state</strong></div>
            <div><span>Conversation turns</span><strong>{state?.beats?.length || 0}</strong></div>
          </div>
        )}
      </section>
    </div>
  );
}
