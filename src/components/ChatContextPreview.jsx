import React from "react";
import { formatTokenCount } from "./chatContextModel.js";

function ContextLegend({ sections }) {
  return (
    <div className="chat-context-preview__legend" aria-label="Sent-now context sections">
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
          <button
            id={`chat-context-row-${section.id}`}
            type="button"
            onClick={() => onToggle(expanded === section.id ? null : section.id)}
            aria-expanded={expanded === section.id}
            aria-controls={`chat-context-section-${section.id}`}
          >
            <span className="chat-context-preview__chevron" aria-hidden="true">›</span>
            <span className="chat-context-preview__tag" style={{ "--tag-color": section.color }}>{section.label}</span>
            <strong>{formatTokenCount(section.tokens)}</strong>
          </button>
          {expanded === section.id && (
            <div
              className="chat-context-preview__detail"
              id={`chat-context-section-${section.id}`}
              role="region"
              aria-labelledby={`chat-context-row-${section.id}`}
            >
              <span>{section.description}</span>
              <pre>{section.content || "No content is sent in this section for the next request."}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DeferredSkills({ preview }) {
  const skills = preview?.availableSkills || [];
  const deferredTokens = preview?.deferredTokens || 0;
  if (!skills.length && !deferredTokens) return null;

  return (
    <details className="chat-context-preview__skills">
      <summary>
        <span><small>Available on demand</small><strong>Narrator skill modules</strong></span>
        <b>{skills.length} {skills.length === 1 ? "module" : "modules"} · {formatTokenCount(deferredTokens)}</b>
      </summary>
      <p>
        {formatTokenCount(deferredTokens)} kept out of the initial request. Loading one means another provider round repeats
        the sent-now context; this is not an additive whole-turn estimate.
      </p>
      {skills.length > 0 && (
        <div className="chat-context-preview__skill-list">
          {skills.map((skill) => (
            <div key={skill.id}>
              <span><strong>{skill.label}</strong><small>{skill.trigger}</small></span>
              <b>{formatTokenCount(skill.tokens)}</b>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

export function ChatContextPreview({ preview, activeModel }) {
  const [expanded, setExpanded] = React.useState(null);
  const sections = preview?.sections || [];
  const total = preview?.total || 0;

  return (
    <section
      id="chat-context-inspector"
      className="chat-context-preview"
      role="region"
      aria-labelledby="chat-context-preview-title"
    >
      <header className="chat-context-preview__header">
        <div className="chat-context-preview__heading">
          <span>Narrator context</span>
          <h2 id="chat-context-preview-title">Sent with next request</h2>
          <p>{activeModel || "Default narrator"} · initial request estimate</p>
        </div>
        <div className="chat-context-preview__total" aria-label={`${formatTokenCount(total)} estimated tokens`}>
          <strong>{formatTokenCount(total)}</strong>
          <span>initial tokens</span>
        </div>
      </header>

      <div className="chat-context-preview__content">
        <div className="chat-context-preview__summary">
          <p>Only the initial provider request is counted below. Full narrator skill modules stay deferred until a tool call.</p>
          <div
            className="chat-context-preview__bar"
            role="img"
            aria-label={`${formatTokenCount(total)} estimated tokens sent with the next request`}
          >
            {sections.filter((section) => section.tokens > 0).map((section) => (
              <i key={section.id} style={{ flexGrow: section.tokens, backgroundColor: section.color }} />
            ))}
          </div>
          <ContextLegend sections={sections} />
        </div>
        <ContextRows sections={sections} expanded={expanded} onToggle={setExpanded} />
        <DeferredSkills preview={preview} />
      </div>
    </section>
  );
}
