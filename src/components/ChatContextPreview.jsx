import React from "react";
import { formatTokenCount } from "./chatContextModel.js";

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
          <button
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
            <div className="chat-context-preview__detail" id={`chat-context-section-${section.id}`}>
              <span>{section.description}</span>
              <pre>{section.content || "No additional detail in this section."}</pre>
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
        <span><small>ON-DEMAND</small><strong>Narrator skills</strong></span>
        <b>{skills.length} skills · {formatTokenCount(deferredTokens)}</b>
      </summary>
      <p>{formatTokenCount(deferredTokens)} kept out of base context until the narrator loads a relevant skill.</p>
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
          <h2 id="chat-context-preview-title">Next turn context</h2>
          <p>{activeModel || "Default narrator"} · estimated before the next request</p>
        </div>
        <div className="chat-context-preview__total" aria-label={`${formatTokenCount(total)} estimated tokens`}>
          <strong>{formatTokenCount(total)}</strong>
          <span>base tokens</span>
        </div>
      </header>

      <div className="chat-context-preview__content">
        <div className="chat-context-preview__summary">
          <p>Always-sent context is grouped below. Detailed narrator doctrine stays deferred until requested.</p>
          <div className="chat-context-preview__bar" aria-label={`${formatTokenCount(total)} estimated context tokens`}>
            {sections.map((section) => <i key={section.id} style={{ width: `${section.percent}%`, backgroundColor: section.color }} />)}
          </div>
          <ContextLegend sections={sections} />
        </div>
        <ContextRows sections={sections} expanded={expanded} onToggle={setExpanded} />
        <DeferredSkills preview={preview} />
      </div>
    </section>
  );
}
