import React from "react";
import { GameLogo } from "./GameLogo.jsx";
import { InitialBackdrop } from "./InitialBackdrop.jsx";
import { MotionPermissionButton } from "./MotionPermissionButton.jsx";
import { Icon } from "./Icon.jsx";

export function TitleScreen({ email, onStart, onSignOut, busy = false, error = null }) {
  return (
    <main className="menu-screen title-screen fade-in">
      <InitialBackdrop />
      <div className="menu-screen__veil" aria-hidden="true" />
      <div className="menu-screen__frame" aria-hidden="true" />

      <header className="title-screen__utility">
        <div className="title-account">
          <span>Signed in</span>
          <strong title={email}>{email || "Traveller"}</strong>
        </div>
        <button
          type="button"
          className="menu-signout"
          onClick={onSignOut}
        >
          <span className="menu-signout__glyph" aria-hidden="true"><i /></span>
          Sign out
        </button>
      </header>

      <section className="title-screen__hero" aria-labelledby="title-screen-heading">
        <p className="menu-eyebrow">A living world for one traveller</p>
        <GameLogo className="title-screen__logo" />
        <h1 id="title-screen-heading" className="sr-only">Solitaire</h1>
        <p className="title-screen__lede">
          Walk your own road through a world that listens, changes, and remembers.
        </p>

        {error && <div className="title-screen__error" role="alert">{error}</div>}

        <button
          type="button"
          className="title-start"
          onClick={onStart}
          disabled={busy}
        >
          <span className="title-start__compass" aria-hidden="true">
            <Icon name="compass" size={23} strokeWidth={1.6} />
          </span>
          <span className="title-start__copy">
            <strong>{busy ? "Preparing the road…" : "Click to start"}</strong>
            <small>{busy ? "Loading your saved journeys" : "Open your campaign library"}</small>
          </span>
          <span className="title-start__arrow" aria-hidden="true">›</span>
        </button>

        <div className="title-screen__details" aria-label="Game qualities">
          <span>Rule-bound</span><i />
          <span>Persistent</span><i />
          <span>Yours</span>
        </div>
      </section>

      <footer className="title-screen__footer">
        <MotionPermissionButton className="motion-permission--title" />
        <span>Best experienced with sound and motion</span>
      </footer>
    </main>
  );
}
