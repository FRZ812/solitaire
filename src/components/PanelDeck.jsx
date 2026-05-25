import React, { useState, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { colors, radius, glass, shadow, metaStyle } from "./tokens.js";
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

export function PanelDeck({ state, user, initialPage = "character", onClose, handlers }) {
  const start = Math.max(0, PAGES.indexOf(initialPage));
  const [page, setPage] = useState(start === -1 ? 1 : start);
  const [dragY, setDragY] = useState(0); // live downward pull on the grab handle
  const swipe = useRef(null);
  const grab = useRef(null);

  const go = (dir) => setPage((p) => (p + dir + PAGES.length) % PAGES.length); // wraps around

  // Horizontal swipe anywhere on the deck changes page (snap), DIRECTIONALLY:
  // swipe RIGHT → the page on the right (Inventory), swipe LEFT → the page on the
  // left (Company) — and it loops. Guarded so a mostly-vertical drag (content
  // scroll) is ignored.
  function onTouchStart(e) { const t = e.touches[0]; swipe.current = { x: t.clientX, y: t.clientY }; }
  function onTouchEnd(e) {
    const s = swipe.current; swipe.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx > 0 ? 1 : -1);
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
    if (pulled > 90) onClose();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 20,
        backgroundColor: "rgba(11, 15, 14, 0.65)", backdropFilter: "blur(6px)",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-up"
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
          {/* Pager: ‹ dots › — the subtle "you can swipe" cue, and tappable. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
            <button onClick={() => go(-1)} aria-label="Previous" style={chevBtn}>
              <Icon name="arrowLeft" size={13} color="rgba(215,167,111,0.5)" strokeWidth={2} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              {PAGES.map((key, i) => (
                <button key={key} onClick={() => setPage(i)} aria-label={LABELS[key]} style={{
                  width: i === page ? "20px" : "7px", height: "7px", borderRadius: radius.pill, border: "none", padding: 0,
                  backgroundColor: i === page ? colors.gold : "rgba(215,167,111,0.3)",
                  cursor: "pointer", transition: "width 0.25s, background-color 0.25s",
                }} />
              ))}
            </div>
            <button onClick={() => go(1)} aria-label="Next" style={chevBtn}>
              <span style={{ display: "flex", transform: "rotate(180deg)" }}>
                <Icon name="arrowLeft" size={13} color="rgba(215,167,111,0.5)" strokeWidth={2} />
              </span>
            </button>
          </div>
          <div style={{ ...metaStyle, fontSize: "7.5px", letterSpacing: "0.18em", color: "rgba(215,167,111,0.4)", textAlign: "center", marginTop: "6px" }}>
            ‹ swipe · {LABELS[PAGES[page]]} ›
          </div>
        </div>

        {/* Pages — a horizontal track; only the active page is in view. */}
        <div style={{ flex: 1, overflow: "hidden" }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div style={{
            display: "flex", width: "300%", height: "100%",
            transform: `translateX(-${page * (100 / PAGES.length)}%)`,
            transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <Page>
              <PartyView state={state} onDismiss={handlers.onDismiss} onMount={handlers.onMount} onDismount={handlers.onDismount} />
            </Page>
            <Page>
              <MenuSheet
                state={state} user={user}
                onReset={handlers.onReset} onOpenCodex={handlers.onOpenCodex}
                onBackToCampaigns={handlers.onBackToCampaigns} onSignOut={handlers.onSignOut}
                onLinkEmail={handlers.onLinkEmail} onExtinguish={handlers.onExtinguish}
                onCastBuff={handlers.onCastBuff}
              />
            </Page>
            <Page>
              <InventoryView
                state={state}
                onEquip={handlers.onEquip} onUnequip={handlers.onUnequip} onUse={handlers.onUse}
                onLightTorch={handlers.onLightTorch} onLightLantern={handlers.onLightLantern}
                onRest={handlers.onRest} onBindRune={handlers.onBindRune}
              />
            </Page>
          </div>
        </div>
      </div>
    </div>
  );
}

function Page({ children }) {
  return (
    <div className="no-scrollbar" style={{
      width: `${100 / PAGES.length}%`, height: "100%", overflowY: "auto",
      WebkitOverflowScrolling: "touch", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
    }}>
      {children}
    </div>
  );
}

const chevBtn = {
  width: "28px", height: "28px", borderRadius: radius.pill, border: "none",
  background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", flexShrink: 0,
};
