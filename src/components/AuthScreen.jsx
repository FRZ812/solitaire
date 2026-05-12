import React, { useState } from "react";
import { signInAnonymously, signInWithEmail } from "$auth";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [linkSent, setLinkSent] = useState(false);

  async function handleGuest() {
    setBusy(true);
    setError(null);
    try {
      await signInAnonymously();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleMagicLink(e) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(addr);
      setLinkSent(true);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

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
        fontSize: "14px", color: "#8B857A", margin: "0 0 32px",
        lineHeight: "1.5",
      }}>
        A solo RPG narrated by Claude. Sign in to sync campaigns across devices, or play as a guest.
      </p>

      <button
        onClick={handleGuest}
        disabled={busy}
        style={{
          width: "100%", padding: "14px 18px", fontSize: "14px", fontWeight: 500,
          backgroundColor: "#1A1A1A", color: "#FBF8F2", border: "none",
          borderRadius: "12px", cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1, fontFamily: "inherit",
        }}
      >
        {busy ? "..." : "Play as guest"}
      </button>

      <div style={{
        display: "flex", alignItems: "center", margin: "18px 0",
        color: "#A8A199", fontSize: "11px", letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}>
        <div style={{ flex: 1, height: 1, backgroundColor: "#E5DFD2" }} />
        <span style={{ margin: "0 12px" }}>or</span>
        <div style={{ flex: 1, height: 1, backgroundColor: "#E5DFD2" }} />
      </div>

      {linkSent ? (
        <div style={{
          padding: "14px 16px", backgroundColor: "#e9efde",
          border: "1px solid #b5c69b", color: "#3a4a26",
          borderRadius: "12px", fontSize: "13px", lineHeight: "1.5",
        }}>
          Check <strong>{email}</strong> for a sign-in link.
        </div>
      ) : (
        <form onSubmit={handleMagicLink}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
            required
            style={{
              width: "100%", padding: "12px 14px", fontSize: "14px",
              backgroundColor: "#FFFFFF", color: "#1A1A1A",
              border: "1px solid #E5DFD2", borderRadius: "12px",
              fontFamily: "inherit", boxSizing: "border-box",
              marginBottom: "10px", outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            style={{
              width: "100%", padding: "12px 18px", fontSize: "14px",
              backgroundColor: "transparent", color: "#1A1A1A",
              border: "1px solid #1A1A1A", borderRadius: "12px",
              cursor: (busy || !email.trim()) ? "default" : "pointer",
              opacity: (busy || !email.trim()) ? 0.4 : 1,
              fontFamily: "inherit", fontWeight: 500,
            }}
          >
            {busy ? "..." : "Send magic link"}
          </button>
        </form>
      )}

      {error && (
        <div style={{
          marginTop: "16px", padding: "10px 12px", borderRadius: "10px",
          backgroundColor: "#FBE3DC", border: "1px solid #D9A89A",
          color: "#7A2C18", fontSize: "12px", lineHeight: "1.4",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
