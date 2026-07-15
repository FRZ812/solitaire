import React, { useState } from "react";
import { signInWithGoogle } from "../engine/auth-supabase.js";
import { InitialBackdrop } from "./InitialBackdrop.jsx";
import { MotionPermissionButton } from "./MotionPermissionButton.jsx";
import { ErrorBanner } from "./primitives.jsx";
import { colors, shadow, radius, fonts } from "./tokens.js";

export function AuthScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      // Redirects the page; busy stays true through the navigation.
      await signInWithGoogle();
    } catch (e) {
      setError(e.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen fade-in" style={{
      backgroundColor: colors.ink,
      backgroundImage: "radial-gradient(circle at 50% 30%, #152422 0%, #0a0f0e 80%)",
      minHeight: "100dvh", width: "100%", maxWidth: "480px", margin: "0 auto",
      display: "flex", flexDirection: "column",
      justifyContent: "center",
      padding: "calc(env(safe-area-inset-top, 0px) + 32px) 24px calc(env(safe-area-inset-bottom, 0px) + 24px) 24px",
      boxSizing: "border-box",
      position: "relative",
      overflow: "hidden",
    }}>
      <InitialBackdrop />
      <div className="screen-inner-frame" style={{
        position: "absolute",
        inset: "12px",
        border: `1px solid rgba(215, 167, 111, 0.08)`,
        pointerEvents: "none",
        borderRadius: "20px",
      }} />

      <div className="auth-card scale-in" style={{
        backgroundColor: "rgba(20, 29, 29, 0.72)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid rgba(215, 167, 111, 0.18)`,
        borderRadius: "24px",
        padding: "36px 24px 28px 24px",
        boxShadow: `0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)`,
        display: "flex", flexDirection: "column", gap: "24px",
        zIndex: 1,
      }}>
        <div className="auth-card__aurora" aria-hidden="true" />
        {/* Hero */}
        <div className="auth-hero" style={{ textAlign: "center" }}>
          <div className="title-seal" aria-hidden="true"><span>S</span></div>
          <div className="title-kicker" style={{
            fontSize: "9px", letterSpacing: "0.26em", textTransform: "uppercase",
            color: colors.gold, marginBottom: "8px", fontWeight: 700,
            textShadow: "0 0 8px rgba(215, 167, 111, 0.25)",
          }}>
            A Solo RPG Narrative Engine
          </div>
          <h1 className="game-logo" style={{
            fontFamily: fonts.serif, fontStyle: "italic",
            fontSize: "56px", margin: "0 0 12px",
            letterSpacing: "-0.5px", lineHeight: 1,
            color: colors.parchment,
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}>
            Solitaire
          </h1>
          <p style={{
            fontFamily: fonts.serif, fontStyle: "italic",
            fontSize: "15px", color: "rgba(237, 228, 208, 0.72)",
            margin: "0 auto", lineHeight: 1.5, maxWidth: "290px",
          }}>
            A lone traveller, an open road, and a world that answers back — and remembers.
          </p>
          <div className="auth-hero__facets" aria-label="Game qualities">
            <span>Rule-bound</span><i /> <span>Persistent</span><i /> <span>Yours</span>
          </div>
          <MotionPermissionButton className="motion-permission--auth" />
        </div>

        {/* Sign-in */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            className="auth-primary"
            onClick={handleGoogle}
            disabled={busy}
            style={{
              width: "100%", padding: "14px 18px", fontSize: "14px", fontWeight: 700,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              color: colors.parchment,
              border: `1px solid rgba(215, 167, 111, 0.25)`,
              borderRadius: radius.control,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              boxShadow: shadow.subtle,
            }}
          >
            <div style={{
              width: "20px", height: "20px", borderRadius: "50%",
              backgroundColor: "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            }}>
              <svg width="12" height="12" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
            </div>
            <span className="auth-primary__label">{busy ? "Opening the road…" : "Continue with Google"}</span>
          </button>

          {error && <ErrorBanner style={{ marginTop: "8px" }}>{error}</ErrorBanner>}
        </div>
      </div>
    </div>
  );
}
