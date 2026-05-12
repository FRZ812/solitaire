import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle, ConditionPill, NeedBar, AttrBlock, StatBlock } from "./primitives.jsx";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";

export function MenuSheet({ state, user, onClose, onReset, onOpenCodex, onBackToCampaigns, onSignOut, onLinkEmail }) {
  const inv = state.character.inventory;
  const codex = state.world.codex;
  const wornIds = codex.characters.wanderer?.worn || [];
  const attrs = state.character.attributes;

  const showGuestNag = user?.is_anonymous && onLinkEmail;

  return (
    <div
      style={{ position: "absolute", inset: 0, backgroundColor: "rgba(26, 26, 26, 0.4)", backdropFilter: "blur(4px)", zIndex: 20, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: "#FBF8F2", borderTopLeftRadius: "24px", borderTopRightRadius: "24px", padding: "20px 24px calc(env(safe-area-inset-bottom, 0px) + 28px) 24px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "88dvh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "22px", color: "#1A1A1A" }}>{state.character.name}</div>
          <button onClick={onClose} style={iconButtonStyle}>
            <Icon name="x" size={15} color="#1A1A1A" strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "14px", lineHeight: "1.5", color: "#3A3A3A", paddingLeft: "12px", borderLeft: "2px solid #C9A876" }}>
          {state.character.bond}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <StatBlock label="Vitality" value={`${Math.round(state.character.vitality)} / ${state.character.vitalityMax}`} />
          <StatBlock label="Resolve"  value={`${state.character.resolve} / ${state.character.resolveMax}`} />
        </div>

        <div style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B857A" }}>Attributes</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginTop: "-6px" }}>
          {ATTR_KEYS.map(k => <AttrBlock key={k} label={ATTR_LABELS[k]} score={attrs[k]} />)}
        </div>

        <div style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B857A" }}>Conditions</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "-8px" }}>
          {state.character.conditions.length === 0
            ? <span style={{ fontSize: "12px", color: "#A8A199" }}>None</span>
            : state.character.conditions.map((c) => <ConditionPill key={c} label={c} />)}
        </div>

        <div style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B857A" }}>Needs</div>
        <div style={{ marginTop: "-8px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <NeedBar label="Hunger" value={state.character.needs.hunger} />
          <NeedBar label="Thirst" value={state.character.needs.thirst} />
          <NeedBar label="Sleep"  value={state.character.needs.sleep}  />
        </div>

        <div style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B857A" }}>Coin</div>
        <div style={{ marginTop: "-8px", fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "16px", color: "#1A1A1A" }}>
          {inv.coins.gold}gp · {inv.coins.silver}sp · {inv.coins.copper}cp
        </div>

        <div style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B857A" }}>Wearing</div>
        <div style={{ marginTop: "-8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {wornIds.length === 0
            ? <span style={{ fontSize: "12px", color: "#A8A199", fontStyle: "italic" }}>Nothing.</span>
            : wornIds.map((id) => <div key={id} style={{ fontSize: "13px", color: "#1A1A1A" }}>{codex.items[id]?.name || id}</div>)}
        </div>

        <div style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B857A" }}>Carrying (pack)</div>
        <div style={{ marginTop: "-8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {inv.carried.length === 0
            ? <span style={{ fontSize: "12px", color: "#A8A199", fontStyle: "italic" }}>Empty.</span>
            : inv.carried.map((c) => (
                <div key={c.itemId} style={{ fontSize: "13px", color: "#1A1A1A", display: "flex", justifyContent: "space-between" }}>
                  <span>{codex.items[c.itemId]?.name || c.itemId}</span>
                  <span style={{ color: "#8B857A" }}>×{c.quantity}</span>
                </div>
              ))}
        </div>

        {showGuestNag && <GuestNagSection onLinkEmail={onLinkEmail} />}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
          <button
            onClick={onOpenCodex}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", border: "1px solid #E5DFD2", borderRadius: "12px", backgroundColor: "transparent", color: "#1A1A1A", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
          >
            <Icon name="book" size={14} strokeWidth={1.5} />
            Open codex
          </button>
          {onBackToCampaigns && (
            <button
              onClick={onBackToCampaigns}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", border: "1px solid #E5DFD2", borderRadius: "12px", backgroundColor: "transparent", color: "#1A1A1A", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
            >
              <Icon name="arrowLeft" size={14} strokeWidth={1.5} />
              Back to campaigns
            </button>
          )}
          <button
            onClick={onReset}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", border: "1px solid #E5DFD2", borderRadius: "12px", backgroundColor: "transparent", color: "#7A2C18", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
          >
            <Icon name="reset" size={14} strokeWidth={1.5} />
            Reset this campaign
          </button>
          {onSignOut && (
            <button
              onClick={onSignOut}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", border: "1px solid #E5DFD2", borderRadius: "12px", backgroundColor: "transparent", color: "#8B857A", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GuestNagSection({ onLinkEmail }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onLinkEmail(addr);
      setSent(true);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      marginTop: "4px", padding: "12px 14px",
      backgroundColor: "#F4EFE3", border: "1px solid #E5DFD2",
      borderRadius: "12px",
    }}>
      <div style={{
        fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase",
        color: "#8B5A2B", fontWeight: 500, marginBottom: "6px",
      }}>
        Playing as guest
      </div>
      <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#3A3A3A", lineHeight: "1.45" }}>
        Link an email so you can resume your campaigns from another device.
      </p>
      {sent ? (
        <div style={{ fontSize: "12px", color: "#3a4a26", padding: "8px 10px", backgroundColor: "#e9efde", border: "1px solid #b5c69b", borderRadius: "8px" }}>
          Check <strong>{email}</strong> for a confirmation link.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "6px" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
            required
            style={{
              flex: 1, padding: "8px 10px", fontSize: "13px",
              backgroundColor: "white", color: "#1A1A1A",
              border: "1px solid #E5DFD2", borderRadius: "8px",
              fontFamily: "inherit", outline: "none", minWidth: 0,
            }}
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            style={{
              padding: "8px 12px", fontSize: "12px", fontWeight: 500,
              backgroundColor: "#1A1A1A", color: "#FBF8F2",
              border: "none", borderRadius: "8px",
              cursor: (busy || !email.trim()) ? "default" : "pointer",
              opacity: (busy || !email.trim()) ? 0.4 : 1,
              fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            {busy ? "..." : "Link"}
          </button>
        </form>
      )}
      {error && (
        <div style={{
          marginTop: "8px", padding: "8px 10px", borderRadius: "8px",
          backgroundColor: "#FBE3DC", border: "1px solid #D9A89A",
          color: "#7A2C18", fontSize: "11px", lineHeight: "1.4",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
