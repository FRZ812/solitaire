import React, { useState } from "react";
import { InitialBackdrop } from "./InitialBackdrop.jsx";
import { ErrorBanner } from "./primitives.jsx";
import { colors, shadow, radius, fonts } from "./tokens.js";

function formatRelativeTime(iso) {
  if (!iso) return "moments ago";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "moments ago";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function CampaignsList({ campaigns, onSelect, onNew, onDelete, onRename, onSignOut, busy, error }) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  function startRename(c) {
    setRenamingId(c.id);
    setRenameValue(c.name);
  }
  function commitRename() {
    if (!renamingId) return;
    const v = renameValue.trim();
    if (v && v !== campaigns.find(c => c.id === renamingId)?.name) {
      onRename(renamingId, v);
    }
    setRenamingId(null);
  }
  function cancelRename() {
    setRenamingId(null);
  }

  return (
    <div className="campaign-screen fade-in" style={{
      backgroundColor: colors.ink,
      backgroundImage: "radial-gradient(circle at 50% 30%, #152422 0%, #0a0f0e 80%)",
      height: "100dvh", width: "100%", maxWidth: "480px", margin: "0 auto",
      display: "flex", flexDirection: "column", overflow: "hidden",
      position: "relative",
    }}>
      <InitialBackdrop />
      <div className="screen-inner-frame" style={{
        position: "absolute",
        inset: "12px",
        border: `1px solid rgba(215, 167, 111, 0.06)`,
        pointerEvents: "none",
        borderRadius: "20px",
        zIndex: 0,
      }} />

      <div className="campaign-screen__header" style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 20px) 20px 14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid rgba(215, 167, 111, 0.14)`,
        zIndex: 1,
      }}>
        <div>
          <div className="campaign-screen__kicker">Continue the road</div>
          <div className="campaign-screen__title" style={{
            fontFamily: fonts.serif, fontStyle: "italic",
            fontSize: "26px", color: colors.parchment,
            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
          }}>
            Solitaire
          </div>
        </div>
        {onSignOut && (
          <button
            onClick={onSignOut}
            disabled={busy}
            style={{
              padding: "7px 12px", fontSize: "11px", fontWeight: 700,
              border: `1px solid rgba(215, 167, 111, 0.28)`,
              borderRadius: radius.chip,
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              color: colors.gold,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.5 : 1,
              fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        )}
      </div>

      <div className="campaign-screen__scroll custom-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 20px 24px", zIndex: 1 }}>
        {error && <ErrorBanner style={{ margin: "0 0 16px" }}>{error}</ErrorBanner>}

        <button
          className="campaign-new"
          onClick={onNew}
          disabled={busy}
          style={{
            width: "100%", padding: "14px 18px", marginBottom: "20px",
            fontSize: "14px", fontWeight: 700,
            backgroundColor: "rgba(215, 167, 111, 0.12)",
            color: colors.gold,
            border: `1px solid rgba(215, 167, 111, 0.4)`,
            borderRadius: radius.control,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.5 : 1,
            fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            boxShadow: shadow.subtle,
          }}
        >
          <span style={{ fontSize: "18px", fontWeight: 400, lineHeight: 1 }}>+</span>
          New campaign
        </button>

        {campaigns.length === 0 && !busy && (
          <div style={{
            textAlign: "center", padding: "48px 16px",
            color: "rgba(237, 228, 208, 0.58)", lineHeight: "1.6",
            fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px",
          }}>
            No campaigns yet.<br />
            Tap "New campaign" to begin.
          </div>
        )}

        {campaigns.map(c => (
          <div key={c.id} className="campaign-card" style={{
            marginBottom: "12px",
            backgroundColor: "rgba(20, 29, 29, 0.45)",
            border: `1px solid rgba(215, 167, 111, 0.16)`,
            borderRadius: radius.control,
            overflow: "hidden",
            boxShadow: shadow.subtle,
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}>
            {renamingId === c.id ? (
              <div style={{ padding: "14px 16px 6px 16px" }}>
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                    if (e.key === "Escape") cancelRename();
                  }}
                  style={{
                    width: "100%", padding: "8px 12px", fontSize: "18px",
                    fontFamily: fonts.serif, fontStyle: "italic",
                    border: `1px solid rgba(215, 167, 111, 0.4)`,
                    borderRadius: radius.chip,
                    backgroundColor: "rgba(0, 0, 0, 0.38)",
                    color: colors.parchment, outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ) : (
              <button
                className="campaign-card__open"
                onClick={() => onSelect(c.id)}
                disabled={busy}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "14px 16px 4px 16px",
                  backgroundColor: "transparent", border: "none",
                  cursor: busy ? "default" : "pointer",
                  opacity: busy ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                <div style={{
                  fontFamily: fonts.serif, fontStyle: "italic",
                  fontSize: "20px", color: colors.parchment,
                  textShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }}>
                  {c.name || "Untitled"}
                </div>
              </button>
            )}
            <div style={{
              padding: "0 16px 12px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: "11px", color: "rgba(237, 228, 208, 0.54)",
            }}>
              <span style={{ fontSize: "10px" }}>Last played {formatRelativeTime(c.last_played_at)}</span>
              {renamingId !== c.id && (
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => startRename(c)}
                    disabled={busy}
                    style={{
                      background: "transparent", border: "none", padding: 0,
                      fontSize: "11px", color: colors.gold, fontWeight: 700,
                      cursor: busy ? "default" : "pointer",
                      fontFamily: "inherit", opacity: busy ? 0.5 : 1,
                    }}
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => onDelete(c.id)}
                    disabled={busy}
                    style={{
                      background: "transparent", border: "none", padding: 0,
                      fontSize: "11px", color: "#f87171", fontWeight: 700,
                      cursor: busy ? "default" : "pointer",
                      fontFamily: "inherit", opacity: busy ? 0.5 : 1,
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
