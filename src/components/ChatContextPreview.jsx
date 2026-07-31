import React from "react";
import { Icon } from "./Icon.jsx";
import { formatTokenCount } from "./chatContextModel.js";
import { useModalFocus } from "./exploration/modalFocus.js";

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
          <button type="button" onClick={() => onToggle(expanded === section.id ? null : section.id)} aria-expanded={expanded === section.id}>
            <span className="chat-context-preview__chevron" aria-hidden="true">›</span>
            <span className="chat-context-preview__tag" style={{ "--tag-color": section.color }}>{section.label}</span>
            <strong>{formatTokenCount(section.tokens)}</strong>
          </button>
          {expanded === section.id && (
            <div className="chat-context-preview__detail">
              <span>{section.description}</span>
              <pre>{section.content || "No additional detail in this section."}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ChatContextPreview({ preview, activeModel, onClose }) {
  const [expanded, setExpanded] = React.useState(null);
  const dialogRef = useModalFocus(onClose);
  const sections = preview?.sections || [];
  const total = preview?.total || 0;

  return (
    <div className="chat-context-preview-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="chat-context-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-context-preview-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="chat-context-preview__header">
          <div className="chat-context-preview__heading">
            <span>Narrator context</span>
            <h2 id="chat-context-preview-title">What the narrator sees</h2>
            <p>{activeModel || "Default narrator"} · {formatTokenCount(total)} estimated tokens</p>
          </div>
          <div className="chat-context-preview__total" aria-label={`${formatTokenCount(total)} estimated tokens`}>
            <strong>{formatTokenCount(total)}</strong>
            <span>estimated tokens</span>
          </div>
          <button
            type="button"
            className="chat-context-preview__close"
            onClick={onClose}
            aria-label="Close context preview"
            data-modal-autofocus
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="chat-context-preview__content">
          <div className="chat-context-preview__summary">
            <p>Everything assembled for the next narrator turn, grouped by source.</p>
            <div className="chat-context-preview__bar" aria-label={`${formatTokenCount(total)} estimated context tokens`}>
              {sections.map((section) => <i key={section.id} style={{ width: `${section.percent}%`, backgroundColor: section.color }} />)}
            </div>
            <ContextLegend sections={sections} />
          </div>
          <ContextRows sections={sections} expanded={expanded} onToggle={setExpanded} />
        </div>
      </section>
    </div>
  );
}
