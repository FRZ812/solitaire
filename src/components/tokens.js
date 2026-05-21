// Design tokens. The polish pass scattered the same hex/rgba/radii/shadow
// values across a dozen files; these are the canonical sources. New code
// should import from here rather than inline. Old inline values are being
// migrated incrementally.

// ----- Colors -----

// Dark theme (game world). Used by SceneBackdrop overlay, panels, vitals,
// beats, header, menus, codex, map.
export const colors = {
  ink: "#0d1312",             // primary surface (game container, button-text-on-gold)
  inkDeep: "#0a0f0e",         // overlays / vignette anchor
  parchment: "#EDE4D0",       // primary text on dark
  parchmentLight: "#f5dcb8",  // serif highlight / serif titles
  parchmentMuted: "#e6b98c",  // warm gold-cream, label highlights
  gold: "#d7a76f",            // primary accent
  goldSoft: "#d8bb86",        // soft label accent

  // Cream theme (lobby / auth / menu sheet). Same value as parchment but
  // named differently to clarify intent at the call site.
  paperBg: "#EDE4D0",
  paperText: "#171c1b",
  paperMuted: "#75644A",
  paperSubtle: "#4b493f",
};

// Unified alert palette. Pre-cleanup, every screen invented its own error
// styling. Use the danger* values via ErrorBanner; the success* values are
// referenced directly by GuestNagSection (no banner wrapper yet — only one
// success surface in the app).
export const alert = {
  dangerBg: "rgba(88, 22, 12, 0.86)",
  dangerBorder: "rgba(255, 205, 180, 0.28)",
  dangerText: "#FFE7DB",
  dangerAccent: "#fca5a5",

  successBg: "rgba(16, 185, 129, 0.12)",
  successBorder: "rgba(16, 185, 129, 0.30)",
  successText: "#a7f3d0",
};

// ----- Shadows -----

export const shadow = {
  panel: "0 14px 30px rgba(0,0,0,0.25)",
  card: "0 12px 26px rgba(0,0,0,0.20)",
  cardDeep: "0 12px 28px rgba(0,0,0,0.30)",
  sheet: "0 -18px 44px rgba(0,0,0,0.28)",
  subtle: "0 4px 12px rgba(0,0,0,0.18)",
};

// ----- Radii -----

export const radius = {
  pill: "999px",
  panel: "18px",         // main glass panel
  panelCompact: "14px",  // compact panel + standard control
  control: "16px",       // input / large button
  chip: "10px",          // small inline chip / inventory tag
};

// ----- Glass / backdrop -----

// Spread into a style object: `style={{ ...glass, backgroundColor: ... }}`
export const glass = {
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

// ----- Typography -----

export const fonts = {
  serif: "'Instrument Serif', serif",
};

// The 9px uppercase letterspaced label style used in beat metadata,
// section headers, condition pills, and vital labels.
export const metaStyle = {
  fontSize: "9px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontWeight: 800,
};
