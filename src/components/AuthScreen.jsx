import React, { useState } from "react";
import { signInWithGoogle } from "../engine/auth-supabase.js";
import { ErrorBanner } from "./primitives.jsx";
import { GameLogo } from "./GameLogo.jsx";
import { Icon } from "./Icon.jsx";
import { InitialBackdrop } from "./InitialBackdrop.jsx";
import { MotionPermissionButton } from "./MotionPermissionButton.jsx";

function GoogleMark() {
  return (
    <span className="google-mark" aria-hidden="true">
      <svg width="15" height="15" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
      </svg>
    </span>
  );
}

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
    <main className="menu-screen auth-screen fade-in">
      <InitialBackdrop />
      <div className="menu-screen__veil" aria-hidden="true" />
      <div className="menu-screen__frame" aria-hidden="true" />

      <section className="auth-stage" aria-labelledby="auth-heading">
        <div className="auth-stage__brand">
          <p className="menu-eyebrow">A solo high-fantasy roleplaying game</p>
          <GameLogo className="auth-stage__logo" />
          <h1 id="auth-heading" className="sr-only">Sign in to Solitaire</h1>
          <p className="auth-stage__lede">
            A lone traveller. An open road. A world that answers back — and remembers.
          </p>
        </div>

        <div className="auth-panel scale-in">
          <div className="auth-panel__heading">
            <span className="auth-panel__sigil" aria-hidden="true">
              <Icon name="compass" size={22} strokeWidth={1.55} />
            </span>
            <div>
              <p>Traveller's passage</p>
              <h2>Continue your journey</h2>
            </div>
          </div>
          <p className="auth-panel__copy">
            Sign in to keep your campaigns, characters, and changing world safely tied to you.
          </p>

          <button className="auth-primary" onClick={handleGoogle} disabled={busy}>
            <GoogleMark />
            <span className="auth-primary__label">{busy ? "Opening the road…" : "Continue with Google"}</span>
            <span className="auth-primary__arrow" aria-hidden="true">›</span>
          </button>

          {error && <ErrorBanner style={{ margin: 0 }}>{error}</ErrorBanner>}
          <p className="auth-panel__note">Your save data stays private to your account.</p>
        </div>

        <div className="auth-stage__facets" aria-label="Game qualities">
          <span>Rule-bound</span><i />
          <span>Persistent</span><i />
          <span>Yours</span>
        </div>
        <MotionPermissionButton className="motion-permission--auth" />
      </section>
    </main>
  );
}
