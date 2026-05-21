import React from "react";
import { colors, shadow, radius, fonts } from "./tokens.js";

// Shown (web build only) when the signed-in user has no active subscription
// row. The real enforcement is server-side in the narrate edge function;
// this screen explains the locked state and offers a way out (sign out).
export function SubscriptionScreen({ email, onSignOut, onRecheck, busy }) {
  return (
    <div className="fade-in" style={{
      backgroundColor: colors.ink,
      backgroundImage: "radial-gradient(circle at 50% 30%, #152422 0%, #0a0f0e 80%)",
      minHeight: "100dvh",
      width: "100%", maxWidth: "480px", margin: "0 auto",
      display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "stretch",
      padding: "32px 24px", boxSizing: "border-box",
      color: colors.parchment,
    }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{
          fontSize: "12px", letterSpacing: "0.22em", textTransform: "uppercase",
          color: colors.gold, marginBottom: "8px", fontWeight: 700,
          textShadow: "0 0 8px rgba(215, 167, 111, 0.25)",
        }}>
          Access restricted
        </div>
        <h1 style={{
          fontFamily: fonts.serif, fontStyle: "italic",
          fontSize: "52px", margin: "0 0 16px",
          letterSpacing: "-0.5px", lineHeight: 1,
          color: colors.parchment,
          textShadow: "0 2px 12px rgba(0,0,0,0.6)",
        }}>
          Subscription required
        </h1>
        <div style={{
          width: "40px", height: "2px",
          backgroundColor: colors.gold,
          margin: "0 auto 24px",
          boxShadow: `0 0 6px ${colors.gold}`,
          opacity: 0.6,
        }} />
        <p style={{
          fontSize: "14px", color: "rgba(237, 228, 208, 0.8)",
          margin: "0 auto", lineHeight: "1.6", maxWidth: "320px",
        }}>
          Your account{email ? <> (<strong>{email}</strong>)</> : null} doesn't currently have an active subscription.
        </p>
      </div>

      <div style={{
        padding: "20px 18px",
        backgroundColor: "rgba(20, 29, 29, 0.85)",
        border: `1px solid rgba(215, 167, 111, 0.2)`,
        boxShadow: `${shadow.cardDeep}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        color: "rgba(237, 228, 208, 0.85)",
        borderRadius: radius.control,
        fontSize: "13px", lineHeight: "1.6",
        marginBottom: "32px",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{
          color: colors.gold, fontWeight: 700, marginBottom: "8px",
          fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase",
        }}>
          How to unlock
        </div>
        Subscriptions are granted manually. Once your access is enabled, tap recheck below.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {onRecheck && (
          <button
            onClick={onRecheck}
            disabled={busy}
            style={{
              width: "100%", padding: "14px 18px",
              fontSize: "14px", fontWeight: 700,
              backgroundColor: "rgba(215, 167, 111, 0.15)",
              color: colors.parchmentMuted,
              border: `1px solid rgba(215, 167, 111, 0.4)`,
              borderRadius: radius.control,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1,
              fontFamily: "inherit",
              boxShadow: "0 4px 12px rgba(215, 167, 111, 0.05)",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
            onMouseOver={(e) => {
              if (!busy) {
                e.currentTarget.style.backgroundColor = "rgba(215, 167, 111, 0.25)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(215, 167, 111, 0.15)";
              }
            }}
            onMouseOut={(e) => {
              if (!busy) {
                e.currentTarget.style.backgroundColor = "rgba(215, 167, 111, 0.15)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(215, 167, 111, 0.05)";
              }
            }}
          >
            {busy ? "Rechecking..." : "Recheck subscription"}
          </button>
        )}

        {onSignOut && (
          <button
            onClick={onSignOut}
            disabled={busy}
            style={{
              width: "100%", padding: "12px 18px",
              fontSize: "13px", fontWeight: 500,
              backgroundColor: "transparent",
              color: "rgba(237, 228, 208, 0.6)",
              border: `1px solid rgba(237, 228, 208, 0.15)`,
              borderRadius: radius.control,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.4 : 1,
              fontFamily: "inherit",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            onMouseOver={(e) => {
              if (!busy) {
                e.currentTarget.style.borderColor = "rgba(215, 167, 111, 0.3)";
                e.currentTarget.style.color = colors.gold;
              }
            }}
            onMouseOut={(e) => {
              if (!busy) {
                e.currentTarget.style.borderColor = "rgba(237, 228, 208, 0.15)";
                e.currentTarget.style.color = "rgba(237, 228, 208, 0.6)";
              }
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
