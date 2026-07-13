// Design tokens. The polish pass scattered the same hex/rgba/radii/shadow
// values across a dozen files; these are the canonical sources. New code
// should import from here rather than inline. Old inline values are being
// migrated incrementally.

// ----- Colors -----

// Dark theme (game world). Used by SceneBackdrop overlay, panels, vitals,
// beats, header, menus, codex, map.
export const colors = {
  ink: "#07101c",             // deepest midnight-blue UI surface
  inkDeep: "#040913",         // overlays / vignette anchor
  parchment: "#F4E8C3",       // primary text on dark
  parchmentLight: "#FFF4D0",  // title and dialogue highlight
  parchmentMuted: "#C9A96A",  // warm pixel-gold metadata
  gold: "#E7B95E",            // primary accent
  goldSoft: "#D3A650",        // secondary accent

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
  panel: "5px 6px 0 rgba(3,7,15,0.72)",
  card: "4px 5px 0 rgba(3,7,15,0.66)",
  cardDeep: "6px 7px 0 rgba(3,7,15,0.78)",
  sheet: "0 -6px 0 rgba(3,7,15,0.78)",
  subtle: "3px 3px 0 rgba(3,7,15,0.58)",
};

// ----- Radii -----

export const radius = {
  pill: "3px",
  panel: "4px",
  panelCompact: "3px",
  control: "3px",
  chip: "2px",
};

// ----- Glass / backdrop -----

// Spread into a style object: `style={{ ...glass, backgroundColor: ... }}`
export const glass = {
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
};

// ----- Typography -----

export const fonts = {
  serif: "'Alegreya', Georgia, serif",
  pixel: "'Pixelify Sans', 'Trebuchet MS', sans-serif",
};

// The 9px uppercase letterspaced label style used in beat metadata,
// section headers, condition pills, and vital labels.
export const metaStyle = {
  fontFamily: fonts.pixel,
  fontSize: "10px",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 800,
};
