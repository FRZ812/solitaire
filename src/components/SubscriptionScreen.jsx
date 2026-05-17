import React from "react";

// Shown (web build only) when the signed-in user has no active subscription
// row. The real enforcement is server-side in the narrate edge function;
// this screen explains the locked state and offers a way out (sign out).
export function SubscriptionScreen({ email, onSignOut, onRecheck, busy }) {
  return (
    <div style={{
      backgroundColor: "#FBF8F2",
      height: "100dvh", width: "100%", maxWidth: "640px", margin: "0 auto",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "0 32px", boxSizing: "border-box",
    }}>
      <h1 style={{
        fontFamily: "'Instrument Serif', serif", fontStyle: "italic",
        fontSize: "44px", margin: "0 0 6px", letterSpacing: "-0.5px",
        color: "#1A1A1A",
      }}>
        Solitaire
      </h1>
      <p style={{
        fontSize: "14px", color: "#8B857A", margin: "0 0 24px",
        lineHeight: "1.5",
      }}>
        This narrator runs on a paid model. Your account
        {email ? <> (<strong>{email}</strong>)</> : null} doesn't have an
        active subscription yet, so play is locked.
      </p>

      <div style={{
        padding: "14px 16px", backgroundColor: "#F1ECDE",
        border: "1px solid #E5DFD2", color: "#5B554C",
        borderRadius: "12px", fontSize: "13px", lineHeight: "1.6",
        marginBottom: "24px",
      }}>
        Subscriptions are granted manually for now. Once your access is
        enabled, tap <em>I've subscribed — recheck</em> below (or sign in
        again) and the game will unlock.
      </div>

      {onRecheck && (
        <button
          onClick={onRecheck}
          disabled={busy}
          style={{
            width: "100%", padding: "14px 18px", fontSize: "14px", fontWeight: 500,
            backgroundColor: "#1A1A1A", color: "#FBF8F2", border: "none",
            borderRadius: "12px", cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1, fontFamily: "inherit", marginBottom: "10px",
          }}
        >
          {busy ? "..." : "I've subscribed — recheck"}
        </button>
      )}

      {onSignOut && (
        <button
          onClick={onSignOut}
          disabled={busy}
          style={{
            width: "100%", padding: "12px 18px", fontSize: "14px",
            backgroundColor: "transparent", color: "#1A1A1A",
            border: "1px solid #1A1A1A", borderRadius: "12px",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.4 : 1, fontFamily: "inherit", fontWeight: 500,
          }}
        >
          Sign out
        </button>
      )}
    </div>
  );
}
