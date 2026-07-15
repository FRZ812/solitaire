import React, { useEffect, useState, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { radius, glass, shadow, metaStyle } from "./tokens.js";
import { PartyView } from "./PartyView.jsx";
import { MenuSheet } from "./MenuSheet.jsx";
import { InventoryView } from "./InventoryView.jsx";

// The unified character deck: Company · Character · Inventory as three pages of one
// bottom-sheet, opened from a single header button (defaults to Character). Swipe
// LEFT/RIGHT to move between them — it LOOPS — or tap a page dot. Pull DOWN on the
// grab handle (or tap the dimmed backdrop) to dismiss; there is no close button.
//
// Order matters: Company sits LEFT of Character, Inventory RIGHT (per the brief).
const PAGES = ["party", "character", "inventory"];
const LABELS = { party: "Company", character: "Character", inventory: "Inventory" };
const PAGE_ICONS = { party: "users", character: "user", inventory: "bag" };

export function PanelDeck({ state, user, initialPage = "character", onClose, handlers }) {
  const start = Math.max(0, PAGES.indexOf(initialPage));
  const [page, setPage] = useState(start === -1 ? 1 : start);
  const [inventoryTarget, setInventoryTarget] = useState("wanderer");
  const [dragY, setDragY] = useState(0); // live downward pull on the grab handle
  const swipe = useRef(null);
  const grab = useRef(null);

  const go = (dir) => setPage((p) => (p + dir + PAGES.length) % PAGES.length); // wraps around

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && event.altKey) go(-1);
      if (event.key === "ArrowRight" && event.altKey) go(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const openInventory = (characterId) => {
    setInventoryTarget(characterId || "wanderer");
    setPage(PAGES.indexOf("inventory"));
  };

  // One gesture handler for the whole content area. A mostly-horizontal swipe
  // changes page (snap, loops). A downward pull that STARTS at the top of a page
  // dismisses the sheet (so you can fling it away from anywhere, not just the
  // grab handle); otherwise the touch falls through to normal content scroll.
  function onTouchStart(e) {
    const t = e.touches[0];
    const sc = e.target.closest?.(".no-scrollbar");
    swipe.current = { x: t.clientX, y: t.clientY, atTop: !sc || sc.scrollTop <= 0, mode: null };
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
          height: "92dvh",
          backgroundColor: "rgba(20, 29, 29, 0.94)",
          border: "1px solid rgba(215, 167, 111, 0.22)", borderBottom: "none",
          borderTopLeftRadius: "24px", borderTopRightRadius: "24px",
          display: "flex", flexDirection: "column",
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? "none" : "transform 0.25s cubic-bezier(0.16,1,0.3,1)",
          ...glass, boxShadow: shadow.sheet,
        }}
      >
        {/* Grab handle + page indicator — drag this down to dismiss. */}
        <div
          onTouchStart={onGrabStart}
          onTouchMove={onGrabMove}
          onTouchEnd={onGrabEnd}
          style={{ flexShrink: 0, padding: "10px 12px 8px", cursor: "grab", touchAction: "none" }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "9px" }}>
            <div style={{ width: "40px", height: "4px", borderRadius: radius.pill, backgroundColor: "rgba(215, 167, 111, 0.35)" }} />
          </div>
          {/* Named page rail keeps all three destinations visible and tappable. */}
          <div className="panel-deck__nav" role="tablist" aria-label="Character pages">
            <button onClick={() => go(-1)} aria-label="Previous" style={chevBtn}>
              <Icon name="arrowLeft" size={13} color="rgba(215,167,111,0.5)" strokeWidth={2} />
            </button>
            <div className="panel-deck__tabs">
              {PAGES.map((key, i) => (
                <button
                  key={key}
                  className={`panel-deck__tab${i === page ? " is-active" : ""}`}
                  onClick={() => setPage(i)}
                  role="tab"
                  aria-selected={i === page}
                  aria-controls={`deck-page-${key}`}
                  tabIndex={i === page ? 0 : -1}
                >
                  <span><Icon name={PAGE_ICONS[key]} size={14} strokeWidth={1.7} /></span>
                  <small>{LABELS[key]}</small>
                </button>
              ))}
            </div>
            <button onClick={() => go(1)} aria-label="Next" style={chevBtn}>
              <span style={{ display: "flex", transform: "rotate(180deg)" }}>
                <Icon name="arrowLeft" size={13} color="rgba(215,167,111,0.5)" strokeWidth={2} />
              </span>
            </button>
          </div>
          <div className="panel-deck__hint" style={{ ...metaStyle }}>
            swipe pages · pull down to close
          </div>
        </div>

        {/* Pages — a horizontal track; only the active page is in view. */}
        <div style={{ flex: 1, overflow: "hidden" }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div style={{
            display: "flex", width: "300%", height: "100%",
            transform: `translateX(-${page * (100 / PAGES.length)}%)`,
            transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <Page pageKey="party" active={page === 0}>
              <PartyView state={state} onDismiss={handlers.onDismiss} onMount={handlers.onMount} onDismount={handlers.onDismount} onOpenInventory={openInventory} />
            </Page>
            <Page pageKey="character" active={page === 1}>
              <MenuSheet
                state={state} user={user}
                onReset={handlers.onReset} onOpenCodex={handlers.onOpenCodex}
                onBackToCampaigns={handlers.onBackToCampaigns} onSignOut={handlers.onSignOut}
                onLinkEmail={handlers.onLinkEmail} onExtinguish={handlers.onExtinguish}
                onCastBuff={handlers.onCastBuff}
              />
            </Page>
            <Page pageKey="inventory" active={page === 2}>
              <InventoryView
                state={state}
                onEquip={handlers.onEquip} onUnequip={handlers.onUnequip} onUse={handlers.onUse}
                onLightTorch={handlers.onLightTorch} onLightLantern={handlers.onLightLantern}
                onRest={handlers.onRest} onBindRune={handlers.onBindRune}
                onTransfer={handlers.onTransfer}
                initialSelectedId={inventoryTarget}
              />
            </Page>
          </div>
        </div>
      </div>
    </div>
  );
}

function Page({ pageKey, active, children }) {
  return (
    <div
      id={`deck-page-${pageKey}`}
      className={`panel-deck__page panel-deck__page--${pageKey} no-scrollbar${active ? " is-active" : ""}`}
      role="tabpanel"
      aria-hidden={!active}
      inert={active ? undefined : ""}
      style={{
        width: `${100 / PAGES.length}%`, height: "100%", overflowY: "auto",
        WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
      }}
    >
      {children}
    </div>
  );
}

const chevBtn = {
  width: "28px", height: "28px", borderRadius: radius.pill, border: "none",
  background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", flexShrink: 0,
};
