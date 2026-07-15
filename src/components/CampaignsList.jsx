import React, { useState } from "react";
import { GameLogo } from "./GameLogo.jsx";
import { InitialBackdrop } from "./InitialBackdrop.jsx";
import { Icon } from "./Icon.jsx";
import { ErrorBanner } from "./primitives.jsx";

function formatRelativeTime(iso) {
  if (!iso) return "moments ago";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "moments ago";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function RomanIndex({ index }) {
  const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return <span>{numerals[index] || String(index + 1).padStart(2, "0")}</span>;
}

export function CampaignsList({
  campaigns,
  email,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onBack,
  onSignOut,
  busy,
  error,
}) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  function startRename(c) {
    setRenamingId(c.id);
    setRenameValue(c.name || "");
  }

  function commitRename(event) {
    event?.preventDefault();
    if (!renamingId) return;
    const value = renameValue.trim();
    const current = campaigns.find((campaign) => campaign.id === renamingId)?.name;
    if (value && value !== current) onRename(renamingId, value);
    setRenamingId(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  return (
    <main className="menu-screen campaign-screen fade-in">
      <InitialBackdrop />
      <div className="campaign-screen__veil" aria-hidden="true" />
      <div className="menu-screen__frame" aria-hidden="true" />

      <header className="campaign-nav">
        <button type="button" className="menu-back" onClick={onBack} disabled={busy}>
          <Icon name="arrowLeft" size={15} strokeWidth={1.8} />
          Title
        </button>
        <GameLogo compact className="campaign-nav__logo" />
        <button type="button" className="menu-signout menu-signout--compact" onClick={onSignOut} disabled={busy}>
          <span className="menu-signout__glyph" aria-hidden="true"><i /></span>
          Sign out
        </button>
      </header>

      <div className="campaign-library custom-scroll">
        <section className="campaign-library__intro" aria-labelledby="campaign-heading">
          <p className="menu-eyebrow">Campaign library</p>
          <div className="campaign-library__title-row">
            <div>
              <h1 id="campaign-heading">Choose your journey</h1>
              <p>Return to a road in progress, or begin somewhere new.</p>
            </div>
            <span className="campaign-count" aria-label={`${campaigns.length} saved campaigns`}>
              <strong>{campaigns.length}</strong>
              <small>{campaigns.length === 1 ? "save" : "saves"}</small>
            </span>
          </div>
          {email && <div className="campaign-library__account">Cloud library for <strong>{email}</strong></div>}
        </section>

        {error && <ErrorBanner style={{ margin: "0 0 14px" }}>{error}</ErrorBanner>}

        <button type="button" className="campaign-new" onClick={onNew} disabled={busy}>
          <span className="campaign-new__mark" aria-hidden="true"><i /><i /></span>
          <span>
            <strong>Begin a new journey</strong>
            <small>Create a fresh campaign and choose your traveller</small>
          </span>
          <span className="campaign-new__arrow" aria-hidden="true">›</span>
        </button>

        <div className="campaign-list-heading">
          <span>Your campaigns</span>
          <i />
          <small>Most recent first</small>
        </div>

        {campaigns.length === 0 && !busy ? (
          <section className="campaign-empty">
            <span className="campaign-empty__sigil" aria-hidden="true"><Icon name="compass" size={25} strokeWidth={1.45} /></span>
            <h2>No roads charted yet</h2>
            <p>Your first campaign will appear here, ready to continue from any device.</p>
          </section>
        ) : (
          <div className="campaign-list">
            {campaigns.map((campaign, index) => (
              <article className="campaign-card" key={campaign.id}>
                {renamingId === campaign.id ? (
                  <form className="campaign-rename" onSubmit={commitRename}>
                    <label htmlFor={`campaign-name-${campaign.id}`}>Rename campaign</label>
                    <input
                      id={`campaign-name-${campaign.id}`}
                      autoFocus
                      type="text"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") cancelRename();
                      }}
                    />
                    <div>
                      <button type="button" onClick={cancelRename}>Cancel</button>
                      <button type="submit" disabled={!renameValue.trim()}>Save name</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="campaign-card__open"
                      onClick={() => onSelect(campaign.id)}
                      disabled={busy}
                    >
                      <span className="campaign-card__index" aria-hidden="true"><RomanIndex index={index} /></span>
                      <span className="campaign-card__copy">
                        <small>Last played {formatRelativeTime(campaign.last_played_at)}</small>
                        <strong>{campaign.name || "Untitled journey"}</strong>
                        <span>Continue campaign</span>
                      </span>
                      <span className="campaign-card__arrow" aria-hidden="true">›</span>
                    </button>
                    <footer className="campaign-card__actions">
                      <span>Saved to your account</span>
                      <div>
                        <button type="button" onClick={() => startRename(campaign)} disabled={busy}>Rename</button>
                        <button type="button" className="is-danger" onClick={() => onDelete(campaign.id)} disabled={busy}>Delete</button>
                      </div>
                    </footer>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
