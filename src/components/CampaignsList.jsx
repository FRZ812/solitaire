import React, { useState } from "react";

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
    <div style={{
      backgroundColor: "#FBF8F2",
      height: "100dvh", width: "100%", maxWidth: "640px", margin: "0 auto",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{
        padding: "20px 24px 14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid #EBE5D6",
      }}>
        <div style={{
          fontFamily: "'Instrument Serif', serif", fontStyle: "italic",
          fontSize: "28px", color: "#1A1A1A",
        }}>
          Solitaire
        </div>
        {onSignOut && (
          <button
            onClick={onSignOut}
            disabled={busy}
            style={{
              padding: "8px 14px", fontSize: "12px",
              border: "1px solid #E5DFD2", borderRadius: "20px",
              backgroundColor: "transparent", color: "#1A1A1A",
              cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
              fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
        {error && (
          <div style={{
            marginBottom: "16px", padding: "10px 12px",
            borderRadius: "10px", backgroundColor: "#FBE3DC",
            border: "1px solid #D9A89A", color: "#7A2C18",
            fontSize: "12px", lineHeight: "1.4",
          }}>
            {error}
          </div>
        )}

        <button
          onClick={onNew}
          disabled={busy}
          style={{
            width: "100%", padding: "14px 18px", marginBottom: "16px",
            fontSize: "14px", fontWeight: 500,
            backgroundColor: "#1A1A1A", color: "#FBF8F2",
            border: "none", borderRadius: "12px",
            cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
            fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          }}
        >
          <span style={{ fontSize: "18px", fontWeight: 400, lineHeight: 1 }}>+</span>
          New campaign
        </button>

        {campaigns.length === 0 && !busy && (
          <div style={{
            textAlign: "center", padding: "32px 16px",
            color: "#8B857A", fontSize: "13px", lineHeight: "1.5",
          }}>
            No campaigns yet. Tap "New campaign" to begin.
          </div>
        )}

        {campaigns.map(c => (
          <div key={c.id} style={{
            marginBottom: "10px",
            backgroundColor: "#F4EFE3", border: "1px solid #E5DFD2",
            borderRadius: "12px", overflow: "hidden",
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
                    width: "100%", padding: "6px 10px", fontSize: "18px",
                    fontFamily: "'Instrument Serif', serif", fontStyle: "italic",
                    border: "1px solid #C9A876", borderRadius: "8px",
                    backgroundColor: "white", color: "#1A1A1A", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => onSelect(c.id)}
                disabled={busy}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "14px 16px 4px 16px",
                  backgroundColor: "transparent", border: "none",
                  cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                <div style={{
                  fontFamily: "'Instrument Serif', serif", fontStyle: "italic",
                  fontSize: "18px", color: "#1A1A1A",
                }}>
                  {c.name || "Untitled"}
                </div>
              </button>
            )}
            <div style={{
              padding: "0 16px 12px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: "11px", color: "#8B857A",
            }}>
              <span>Last played {formatRelativeTime(c.last_played_at)}</span>
              {renamingId !== c.id && (
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => startRename(c)}
                    disabled={busy}
                    style={{
                      background: "transparent", border: "none", padding: 0,
                      fontSize: "11px", color: "#8B5A2B",
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
                      fontSize: "11px", color: "#7A2C18",
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
