import React, { useCallback, useEffect, useState, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { glass, shadow } from "./tokens.js";
import { PartyView } from "./PartyView.jsx";
import { MenuSheet } from "./MenuSheet.jsx";
import { InventoryView } from "./InventoryView.jsx";
import { MotionPermissionButton } from "./MotionPermissionButton.jsx";
import { useParallaxMotion } from "../hooks/useParallaxMotion.js";
import dossierPortrait from "../assets/generated/character-dossier-wanderer-v1.webp";

// The unified character deck: Company · Character · Inventory as three pages of one
// portrait-led bottom sheet, opened from a single header button (defaults to
// Character). Swipe LEFT/RIGHT to move between sections, or use the tabs.
//
// Order matters: Company sits LEFT of Character, Inventory RIGHT (per the brief).
const PAGES = ["party", "character", "inventory"];
const LABELS = { party: "Company", character: "Character", inventory: "Inventory" };
const PAGE_ICONS = { party: "users", character: "user", inventory: "bag" };

export function PanelDeck({ state, user, initialPage = "character", onClose, handlers }) {
  const requestedPage = PAGES.indexOf(initialPage);
  const [page, setPage] = useState(requestedPage === -1 ? 1 : requestedPage);
  const [inventoryTarget, setInventoryTarget] = useState("wanderer");
  const [dragY, setDragY] = useState(0); // live downward pull on the grab handle
  const [direction, setDirection] = useState(1);
  const swipe = useRef(null);
  const grab = useRef(null);
  const scroll = useRef(null);

  const go = useCallback((dir) => {
    setDirection(dir);
    setPage((p) => (p + dir + PAGES.length) % PAGES.length);
  }, []); // wraps around

  const selectPage = (next) => {
    if (next === page) return;
    setDirection(next > page ? 1 : -1);
    setPage(next);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && event.altKey) go(-1);
      if (event.key === "ArrowRight" && event.altKey) go(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, onClose]);

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [page]);

  const openInventory = (characterId) => {
    setInventoryTarget(characterId || "wanderer");
    setDirection(1);
    setPage(PAGES.indexOf("inventory"));
  };

  // One gesture handler for the whole content area. A mostly-horizontal swipe
  // changes page (snap, loops). A downward pull that STARTS at the top of a page
  // dismisses the sheet (so you can fling it away from anywhere, not just the
  // grab handle); otherwise the touch falls through to normal content scroll.
  function onTouchStart(e) {
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, atTop: !scroll.current || scroll.current.scrollTop <= 0, mode: null };
  }
  function onTouchMove(e) {
    const s = swipe.current; if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (!s.mode) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) s.mode = "swipe";
      else if (dy > 8 && s.atTop) s.mode = "pull";
      else if (Math.abs(dy) > 8) s.mode = "scroll";
    }
    if (s.mode === "pull") setDragY(Math.max(0, dy));
  }
  function onTouchEnd(e) {
    const s = swipe.current; swipe.current = null;
    if (!s) return;
    if (s.mode === "pull") { const pulled = dragY; setDragY(0); if (pulled > 64) onClose(); return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx > 0 ? -1 : 1);
  }

  // Pull DOWN on the grab handle to dismiss — the sheet follows the finger and
  // closes if pulled far enough, else snaps back (the "pull away" the brief asks for).
  function onGrabStart(e) { const t = e.touches[0]; grab.current = { x: t.clientX, y: t.clientY }; }
  function onGrabMove(e) {
    const s = grab.current; if (!s) return;
    const dy = e.touches[0].clientY - s.y;
    if (dy > 0) setDragY(dy);
  }
  function onGrabEnd() {
    const pulled = dragY;
    grab.current = null;
    setDragY(0);
    if (pulled > 64) onClose();
  }

  return (
    <div
      className="panel-deck-backdrop"
      onClick={onClose}
      role="presentation"
      style={{
        position: "absolute", inset: 0, zIndex: 20,
        backgroundColor: "rgba(11, 15, 14, 0.65)", backdropFilter: "blur(6px)",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}
    >
      <div
        className="panel-deck slide-up"
        onClick={(e) => e.stopPropagation()}
        data-page={PAGES[page]}
        role="dialog"
        aria-modal="true"
        aria-label={`${LABELS[PAGES[page]]} menu`}
        style={{
          width: "100%", maxWidth: "480px", margin: "0 auto",
          height: "96dvh",
          backgroundColor: "rgba(20, 29, 29, 0.94)",
          border: "1px solid rgba(215, 167, 111, 0.22)", borderBottom: "none",
          borderTopLeftRadius: "24px", borderTopRightRadius: "24px",
          display: "flex", flexDirection: "column",
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? "none" : "transform 0.25s cubic-bezier(0.16,1,0.3,1)",
          ...glass, boxShadow: shadow.sheet,
        }}
      >
        {/* Minimal sheet chrome: the illustrated dossier owns the hierarchy. */}
        <div className="panel-deck__chrome"
          onTouchStart={onGrabStart}
          onTouchMove={onGrabMove}
          onTouchEnd={onGrabEnd}
          style={{ flexShrink: 0, cursor: "grab", touchAction: "none" }}
        >
          <div className="panel-deck__grab" aria-hidden="true">
            <span />
          </div>
          <div className="panel-deck__chrome-row">
            <span>Wanderer dossier</span>
            <div>
              <MotionPermissionButton compact />
              <button type="button" className="panel-deck__close" onClick={onClose} aria-label="Close character menu">
                <Icon name="x" size={16} strokeWidth={1.7} />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={scroll}
          className="panel-deck__scroll no-scrollbar"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <DossierHero state={state} page={page} onSelectPage={selectPage} />
          <div
            key={PAGES[page]}
            id={`deck-page-${PAGES[page]}`}
            className="panel-deck__active-page"
            role="tabpanel"
            aria-labelledby={`deck-tab-${PAGES[page]}`}
            style={{ "--page-enter": `${direction * 18}px` }}
          >
            {page === 0 && (
              <PartyView state={state} onDismiss={handlers.onDismiss} onMount={handlers.onMount} onDismount={handlers.onDismount} onOpenInventory={openInventory} />
            )}
            {page === 1 && (
              <MenuSheet
                state={state} user={user}
                onReset={handlers.onReset} onOpenCodex={handlers.onOpenCodex}
                onBackToCampaigns={handlers.onBackToCampaigns} onSignOut={handlers.onSignOut}
                onLinkEmail={handlers.onLinkEmail} onExtinguish={handlers.onExtinguish}
                onCastBuff={handlers.onCastBuff}
              />
            )}
            {page === 2 && (
              <InventoryView
                state={state}
                onEquip={handlers.onEquip} onUnequip={handlers.onUnequip} onUse={handlers.onUse}
                onLightTorch={handlers.onLightTorch} onLightLantern={handlers.onLightLantern}
                onRest={handlers.onRest} onBindRune={handlers.onBindRune}
                onTransfer={handlers.onTransfer}
                initialSelectedId={inventoryTarget}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function labelize(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function DossierHero({ state, page, onSelectPage }) {
  const motionRef = useParallaxMotion({ strength: 1.1 });
  const character = state.character;
  const identity = [labelize(character.race), labelize(character.profession)].filter(Boolean).join(" · ") || "Wanderer";

  return (
    <section ref={motionRef} className="dossier-hero">
      <img className="dossier-hero__art" src={dossierPortrait} alt="" draggable="false" />
      <div className="dossier-hero__wash" aria-hidden="true" />
      <div className="dossier-hero__identity">
        <small>Player character</small>
        <h2>{character.name}</h2>
        <div>{identity}</div>
        {character.bond && <p>{character.bond}</p>}
      </div>
      <div className="dossier-hero__tabs" role="tablist" aria-label="Dossier sections">
        {PAGES.map((key, index) => (
          <button
            key={key}
            id={`deck-tab-${key}`}
            type="button"
            className={index === page ? "is-active" : ""}
            onClick={() => onSelectPage(index)}
            role="tab"
            aria-selected={index === page}
            aria-controls={`deck-page-${key}`}
            tabIndex={index === page ? 0 : -1}
          >
            <Icon name={PAGE_ICONS[key]} size={15} strokeWidth={1.55} />
            <span>{LABELS[key]}</span>
          </button>
        ))}
      </div>
      <div className="dossier-hero__gesture">swipe sections · pull down to close</div>
    </section>
  );
}
