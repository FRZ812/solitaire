import React from "react";
import { Icon } from "./Icon.jsx";
import { colors, radius } from "./tokens.js";

// Bottom action sheet for a long-pressed narration/dialogue bubble. Switches
// between the action menu, the rewrite (AI re-roll with a steer) editor, and the
// manual edit editor. Rewrite/Rewind need a recorded turn; Edit always works.
export function BeatActionSheet({
  mode, kind = "narrative", canRewrite, canRewind, loading,
  rewriteText, editText, onRewriteText, onEditText,
  onChooseRewrite, onChooseEdit, onRewind, onDelete,
  onSubmitRewrite, onSubmitEdit, onClose,
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 50,
        background: "rgba(6, 9, 9, 0.6)",
        backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}
    >
      <div
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: "0 8px calc(env(safe-area-inset-bottom, 0px) + 8px)",
          padding: "14px 14px 16px",
          background: "rgba(18, 24, 24, 0.96)",
          border: "1px solid rgba(215, 167, 111, 0.28)",
          borderRadius: 20,
          boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
        }}
      >
        {mode === "menu" && (
          <Menu
            kind={kind}
            canRewrite={canRewrite}
            canRewind={canRewind}
            onChooseRewrite={onChooseRewrite}
            onChooseEdit={onChooseEdit}
            onRewind={onRewind}
            onDelete={onDelete}
            onClose={onClose}
          />
        )}
        {mode === "rewrite" && (
          <Editor
            heading="Rewrite — steer the story"
            accent="#a884d3"
            value={rewriteText}
            onChange={onRewriteText}
            onSubmit={onSubmitRewrite}
            onCancel={onClose}
            loading={loading}
            placeholder="What should change? e.g. 'the innkeeper recognizes me', 'she refuses and calls the guards', 'make this turn turn grim'"
            submitLabel={loading ? "Rewriting…" : "Rewrite"}
          />
        )}
        {mode === "edit" && (
          <Editor
            heading="Edit this moment"
            accent={colors.gold}
            value={editText}
            onChange={onEditText}
            onSubmit={onSubmitEdit}
            onCancel={onClose}
            loading={false}
            placeholder="Edit the text…"
            submitLabel="Save"
          />
        )}
      </div>
    </div>
  );
}

function Menu({ kind, canRewrite, canRewind, onChooseRewrite, onChooseEdit, onRewind, onDelete, onClose }) {
  const isPlayer = kind === "player";
  return (
    <>
      <div style={{
        fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase",
        fontWeight: 800, color: "rgba(215,167,111,0.7)", marginBottom: "10px", textAlign: "center",
      }}>{isPlayer ? "Your message" : "This moment"}</div>
      {!isPlayer && (
        <Row icon="reset" label="Rewrite" sub="Re-roll with a steer" accent="#c9b3e8"
          disabled={!canRewrite} onClick={onChooseRewrite} />
      )}
      <Row icon="book" label="Edit" sub={isPlayer ? "Fix your words (story stays)" : "Change the text yourself"} accent={colors.parchment}
        onClick={onChooseEdit} />
      {!isPlayer && (
        <Row icon="x" label="Delete this bubble" sub="Remove just this line; keep the rest" accent="#d8a36f"
          onClick={onDelete} />
      )}
      <Row icon="arrowLeft" label="Rewind to here" sub="Keep this, drop everything after" accent="#fca5a5"
        disabled={!canRewind} onClick={onRewind} />
      {!isPlayer && !canRewrite && (
        <div style={{ fontSize: "10px", color: "rgba(215,167,111,0.5)", textAlign: "center", margin: "8px 4px 2px", lineHeight: 1.4 }}>
          Only recorded moments can be rewritten. You can still edit, delete, or rewind.
        </div>
      )}
      {!canRewind && (
        <div style={{ fontSize: "10px", color: "rgba(215,167,111,0.5)", textAlign: "center", margin: "8px 4px 2px", lineHeight: 1.4 }}>
          Nothing comes after this yet — nothing to rewind.
        </div>
      )}
      <button onClick={onClose} style={{
        width: "100%", marginTop: "10px", padding: "11px", borderRadius: 12,
        background: "transparent", color: "rgba(215,167,111,0.75)",
        border: "1px solid rgba(215,167,111,0.2)", fontSize: "13px", fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
      }}>Cancel</button>
    </>
  );
}

function Row({ icon, label, sub, accent, disabled, onClick }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: "100%", marginBottom: "8px", padding: "12px 14px",
        display: "flex", alignItems: "center", gap: "13px",
        background: "rgba(20, 29, 29, 0.6)",
        border: "1px solid rgba(215, 167, 111, 0.18)",
        borderRadius: 13, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1, fontFamily: "inherit", textAlign: "left",
      }}
    >
      <Icon name={icon} size={17} color={accent} strokeWidth={2} />
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: "14px", fontWeight: 700, color: colors.parchment }}>{label}</span>
        <span style={{ display: "block", fontSize: "11px", color: "rgba(215,167,111,0.6)", marginTop: "1px" }}>{sub}</span>
      </span>
    </button>
  );
}

function Editor({ heading, accent, value, onChange, onSubmit, onCancel, loading, placeholder, submitLabel }) {
  const disabled = loading || !value.trim();
  return (
    <>
      <div style={{
        fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase",
        fontWeight: 800, color: accent, marginBottom: "10px", textAlign: "center",
      }}>{heading}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (!disabled) onSubmit(); } }}
        rows={4} autoFocus disabled={loading}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box", resize: "none",
          borderRadius: radius.control,
          border: `1px solid ${accent}55`,
          backgroundColor: "rgba(10, 12, 14, 0.6)",
          padding: "11px 13px", fontSize: "14px", color: colors.parchment,
          outline: "none", fontFamily: "inherit", lineHeight: 1.45,
        }}
      />
      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <button onClick={onCancel} style={{
          padding: "11px 18px", borderRadius: 12, background: "transparent",
          color: "rgba(215,167,111,0.75)", border: "1px solid rgba(215,167,111,0.2)",
          fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>Cancel</button>
        <button onClick={onSubmit} disabled={disabled} style={{
          flex: 1, padding: "11px 18px", borderRadius: 12,
          background: disabled ? "rgba(215,167,111,0.15)" : accent,
          color: disabled ? "rgba(255,255,255,0.4)" : colors.ink,
          border: "none", fontSize: "13px", fontWeight: 800,
          cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
        }}>{submitLabel}</button>
      </div>
    </>
  );
}
