import React from "react";

// ----- SHARED SVG DEFINITIONS -----
// Reusable gradients and filters used across the thematic icons.
const Definitions = () => (
  <defs>
    {/* Dark iron border gradient */}
    <linearGradient id="tsIronBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#3d4747" />
      <stop offset="35%" stopColor="#252c2c" />
      <stop offset="70%" stopColor="#151a1a" />
      <stop offset="100%" stopColor="#080a0a" />
    </linearGradient>

    {/* Rivet lighting gradient */}
    <radialGradient id="tsRivetGrad" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stopColor="#6e7a7a" />
      <stop offset="50%" stopColor="#313939" />
      <stop offset="100%" stopColor="#090b0b" />
    </radialGradient>

    {/* Dark cracked stone background gradient */}
    <radialGradient id="tsStoneBg" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stopColor="#313b3b" />
      <stop offset="55%" stopColor="#1b2222" />
      <stop offset="100%" stopColor="#0b0f0f" />
    </radialGradient>

    {/* Gold accent/highlight gradient */}
    <linearGradient id="tsGoldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#f5dcb8" />
      <stop offset="50%" stopColor="#d7a76f" />
      <stop offset="100%" stopColor="#9c6d3b" />
    </linearGradient>

    {/* Golden/translucent silhouette gradient for empty slots */}
    <linearGradient id="tsSlotSilhouette" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stopColor="rgba(215, 167, 111, 0.05)" />
      <stop offset="50%" stopColor="rgba(215, 167, 111, 0.16)" />
      <stop offset="100%" stopColor="rgba(215, 167, 111, 0.05)" />
    </linearGradient>
  </defs>
);

// ----- FRAMES -----

// Circular Frame for HUD Needs & Vitals
const CircularFrame = ({ children, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "inline-block", verticalAlign: "middle" }}>
    <Definitions />
    {/* Stone Disc Background */}
    <circle cx="50" cy="50" r="42" fill="url(#tsStoneBg)" />
    
    {/* Hand-drawn stone cracks */}
    <path d="M 50 12 L 44 26 L 47 42" stroke="#070a0a" strokeWidth="1.2" fill="none" opacity="0.75" />
    <path d="M 44 26 L 28 29" stroke="#070a0a" strokeWidth="0.8" fill="none" opacity="0.6" />
    <path d="M 58 78 L 53 62 L 62 48" stroke="#070a0a" strokeWidth="1.2" fill="none" opacity="0.75" />
    <path d="M 22 55 L 34 50" stroke="#070a0a" strokeWidth="1" fill="none" opacity="0.6" />
    <path d="M 78 40 L 66 42" stroke="#070a0a" strokeWidth="0.8" fill="none" opacity="0.6" />
    
    {/* Outer Iron Rim */}
    <circle cx="50" cy="50" r="46" stroke="url(#tsIronBorder)" strokeWidth="5.5" fill="none" />
    <circle cx="50" cy="50" r="48.8" stroke="#070a0a" strokeWidth="0.8" fill="none" />
    <circle cx="50" cy="50" r="43.2" stroke="#070a0a" strokeWidth="0.8" fill="none" />

    {/* Rivets around the rim */}
    <circle cx="50" cy="4.5" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="82.2" cy="17.8" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="95.5" cy="50" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="82.2" cy="82.2" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="50" cy="95.5" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="17.8" cy="82.2" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="4.5" cy="50" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="17.8" cy="17.8" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />

    {/* Inner Shadow / Vignette */}
    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="2.5" />

    {children}
  </svg>
);

// Square Frame for Equipment Slots
const SquareFrame = ({ children, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "inline-block", verticalAlign: "middle" }}>
    <Definitions />
    {/* Stone Slab Background */}
    <rect x="7.5" y="7.5" width="85" height="85" rx="8" fill="url(#tsStoneBg)" />

    {/* Stone cracks */}
    <path d="M 50 14 L 44 32 L 47 52" stroke="#070a0a" strokeWidth="1.2" fill="none" opacity="0.75" />
    <path d="M 44 32 L 22 35" stroke="#070a0a" strokeWidth="0.8" fill="none" opacity="0.6" />
    <path d="M 58 84 L 53 66 L 68 50" stroke="#070a0a" strokeWidth="1.2" fill="none" opacity="0.75" />
    <path d="M 18 60 L 34 54" stroke="#070a0a" strokeWidth="1" fill="none" opacity="0.6" />
    <path d="M 82 45 L 66 48" stroke="#070a0a" strokeWidth="0.8" fill="none" opacity="0.6" />

    {/* Outer Iron Border */}
    <rect x="4.5" y="4.5" width="91" height="91" rx="9" stroke="url(#tsIronBorder)" strokeWidth="5.5" fill="none" />
    <rect x="1.8" y="1.8" width="96.4" height="96.4" rx="10.8" stroke="#070a0a" strokeWidth="0.8" fill="none" />
    <rect x="7.2" y="7.2" width="85.6" height="85.6" rx="7.2" stroke="#070a0a" strokeWidth="0.8" fill="none" />

    {/* Rivets at corners & midpoints */}
    <circle cx="8" cy="8" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="50" cy="8" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="92" cy="8" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="92" cy="50" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="92" cy="92" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="50" cy="92" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="8" cy="92" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />
    <circle cx="8" cy="50" r="1.5" fill="url(#tsRivetGrad)" stroke="#070a0a" strokeWidth="0.4" />

    {/* Inner Vignette */}
    <rect x="8.5" y="8.5" width="83" height="83" rx="7" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="3" />

    {children}
  </svg>
);

// ----- ICON ARTWORKS (0-100 coordinates) -----

const ARTWORK = {
  // === HUD Status Needs ===
  "hud-hunger": (
    <g>
      {/* Shadow */}
      <path d="M 32 68 C 30 65 24 57 26 53 C 28 49 32 50 36 54 C 40 58 43 65 41 68 Z" fill="#1b120c" opacity="0.6" />
      {/* Bone Shaft */}
      <path d="M 25 72 L 38 60 L 43 65 L 30 77 Z" fill="#ebd9c0" stroke="#362214" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 28 73 L 39 63" stroke="#ffffff" strokeWidth="0.8" opacity="0.5" />
      {/* Bone Knobs */}
      <circle cx="24" cy="74" r="4.5" fill="#ebd9c0" stroke="#362214" strokeWidth="1.5" />
      <circle cx="28" cy="78" r="4.5" fill="#ebd9c0" stroke="#362214" strokeWidth="1.5" />
      {/* Meat body */}
      <path d="M 36 58 C 32 45 41 30 55 25 C 68 20 78 30 76 43 C 74 56 60 66 47 64 C 41 63 38 60 36 58 Z" fill="#9c5225" stroke="#26140a" strokeWidth="2.2" strokeLinejoin="round" />
      {/* Meat highlight/shading */}
      <path d="M 45 56 C 41 52 40 46 45 38 C 50 30 60 26 68 28 C 74 30 73 38 68 46 C 63 54 52 58 45 56 Z" fill="#bf723c" />
      <path d="M 52 42 C 50 36 55 30 62 30 C 67 30 68 35 64 40 C 60 45 55 45 52 42 Z" fill="#e0975e" />
      <path d="M 56 34 Q 60 32 62 35" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      {/* Dark grilled markings */}
      <path d="M 48 30 Q 52 38 46 48" stroke="#4d2208" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M 58 26 Q 62 35 56 46" stroke="#4d2208" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M 66 28 Q 70 34 66 42" stroke="#4d2208" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Rosemary/herb garnish flecks */}
      <path d="M 46 42 L 49 44 M 50 36 L 52 39 M 58 32 L 61 31 M 65 36 L 67 39 M 60 42 L 62 45 M 54 48 L 56 50" stroke="#3b5220" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  ),

  "hud-thirst": (
    <g>
      {/* Strap */}
      <path d="M 32 30 L 68 70" stroke="#361a09" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M 34 28 L 66 68" stroke="#663c1a" strokeWidth="1.2" strokeLinecap="round" />
      {/* Canteen Body */}
      <path d="M 50 32 C 40 32 32 42 32 55 C 32 68 40 76 50 76 C 60 76 68 68 68 55 C 68 42 60 32 50 32 Z" fill="#693517" stroke="#210d03" strokeWidth="2.2" strokeLinejoin="round" />
      {/* Inner leather tones */}
      <path d="M 50 36 C 43 36 36 44 36 55 C 36 64 43 72 50 72 C 57 72 64 64 64 55 C 64 44 57 36 50 36 Z" fill="#8c4922" />
      {/* Highlight edge */}
      <path d="M 44 48 C 40 48 38 52 38 56 C 38 60 41 62 44 62" stroke="#cf7d4c" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 42 50 C 40 50 39 52 39 55" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.4" />
      {/* Brass Spout */}
      <rect x="46" y="21" width="8" height="12" rx="1.5" fill="#a88036" stroke="#210d03" strokeWidth="1.5" />
      <line x1="47" y1="26" x2="53" y2="26" stroke="#d6b167" strokeWidth="1.2" />
      {/* Water Droplet */}
      <path d="M 50 83 C 48 83 46 81 46 79 C 46 77 50 72 50 72 C 50 72 54 77 54 79 C 54 81 52 83 50 83 Z" fill="#2d9beb" stroke="#0c3c61" strokeWidth="1.2" />
      <circle cx="49" cy="78" r="0.6" fill="#fff" opacity="0.8" />
    </g>
  ),

  "hud-sleep": (
    <g>
      {/* Glow */}
      <circle cx="50" cy="50" r="24" fill="#4d92e8" opacity="0.08" />
      <circle cx="50" cy="50" r="18" fill="#9ec9ff" opacity="0.12" />
      {/* Moon shape */}
      <path d="M 64 30 C 42 30 32 45 32 60 C 32 72 40 80 50 80 C 58 80 66 74 68 70 C 52 72 44 60 44 50 C 44 40 52 32 64 30 Z" fill="#e1ecf7" stroke="#16253d" strokeWidth="2.2" strokeLinejoin="round" />
      {/* Moon texture / shading */}
      <path d="M 60 33 C 48 36 40 45 40 53 C 40 61 46 68 56 72 C 48 71 42 63 42 53 C 42 42 48 35 60 33 Z" fill="#90afd1" />
      <path d="M 48 50 C 48 45 52 40 58 37 C 50 40 46 46 46 52 C 46 57 49 61 54 64 C 50 62 48 56 48 50 Z" fill="#5f83ab" />
      {/* Little magical stars */}
      <path d="M 30 31 L 31.5 29.5 L 30 28 L 28.5 29.5 Z" fill="#ffffff" />
      <path d="M 68 62 L 69.5 60.5 L 68 59 L 66.5 60.5 Z" fill="#ffffff" />
      <path d="M 64 21 L 65.5 19.5 L 64 18 L 62.5 19.5 Z" fill="#ffebad" />
    </g>
  ),

  "hud-vitality": (
    <g>
      {/* Glow */}
      <path d="M 50 32 C 46 22 28 22 28 38 C 28 56 50 74 50 74 C 50 74 72 56 72 38 C 72 22 54 22 50 32 Z" fill="#ff3333" opacity="0.12" />
      {/* Heart outer outline */}
      <path d="M 50 32 C 46 22 28 22 28 38 C 28 56 50 74 50 74 C 50 74 72 56 72 38 C 72 22 54 22 50 32 Z" fill="#b01b22" stroke="#330306" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Facet Cuts & 3D Shading */}
      <path d="M 50 32 L 28 38 L 38 52 Z" fill="#cc252e" />
      <path d="M 50 32 L 50 74 L 38 52 Z" fill="#8a0f15" />
      <path d="M 50 32 L 72 38 L 62 52 Z" fill="#d93b44" />
      <path d="M 50 32 L 50 74 L 62 52 Z" fill="#b01b22" />
      {/* Facet Highlights */}
      <path d="M 36 34 L 46 30 L 44 38 Z" fill="#ff757d" />
      <path d="M 33 36 L 40 33.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
      <circle cx="33" cy="39" r="1.2" fill="#ffffff" opacity="0.9" />
    </g>
  ),

  "hud-resolve": (
    <g>
      {/* Glow aura */}
      <circle cx="50" cy="52" r="22" fill="#ba55d3" opacity="0.14" />
      {/* Purple flame shape */}
      <path d="M 50 19 C 44 35 30 45 30 60 C 30 72 39 80 50 80 C 61 80 70 72 70 60 C 70 46 56 35 50 19 Z" fill="#621494" stroke="#1d0130" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Intermediate flame tones */}
      <path d="M 50 30 C 46 41 36 49 36 60 C 36 69 42 74 50 74 C 58 74 64 69 64 60 C 64 49 54 41 50 30 Z" fill="#9e3ebf" stroke="#440169" strokeWidth="1.2" />
      {/* Hot white-purple core */}
      <path d="M 50 43 C 47 49 42 54 42 62 C 42 67 46 70 50 70 C 54 70 58 67 58 62 C 58 54 53 49 50 43 Z" fill="#dfb1eb" />
      <path d="M 50 51 C 49 55 46 58 46 63 C 46 66 48 68 50 68 C 52 68 54 66 54 63 C 54 58 51 55 50 51 Z" fill="#ffffff" />
      {/* Magic sparks */}
      <circle cx="48" cy="27" r="1.2" fill="#ffffff" />
      <circle cx="53" cy="34" r="0.8" fill="#ffffff" />
      <circle cx="39" cy="46" r="1" fill="#f5b8ff" />
      <circle cx="61" cy="50" r="1.2" fill="#f5b8ff" />
    </g>
  ),

  // === Equipment Slots (Golden-edged low-opacity silhouettes) ===
  "slot-weapon-melee": (
    <g opacity="0.32">
      <path d="M 30 70 L 60 40 L 70 50 L 40 80 Z" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="1" />
      <path d="M 24 76 L 30 70 M 25 78 A 2 2 0 1 0 29 74" stroke="url(#tsGoldAccent)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M 33 67 L 27 73" stroke="url(#tsGoldAccent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M 36 64 L 64 36" stroke="url(#tsGoldAccent)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 64 36 L 75 25 L 75 18 L 68 18 L 57 29 Z" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  ),

  "slot-weapon-shield": (
    <g opacity="0.32">
      <path d="M 50 22 C 65 22 75 28 75 28 L 70 55 C 67 71 50 82 50 82 C 50 82 33 71 30 55 L 25 28 C 25 28 35 22 50 22 Z" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="2.2" strokeLinejoin="round" />
      {/* Inner shield rim details */}
      <path d="M 50 28 C 60 28 68 33 68 33 L 64 53 C 62 65 50 74 50 74 C 50 74 38 65 36 53 L 32 33 C 32 33 40 28 50 28 Z" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="1" strokeDasharray="3,3" />
      <circle cx="50" cy="50" r="6" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="2" fill="url(#tsGoldAccent)" />
    </g>
  ),

  "slot-weapon-ranged": (
    <g opacity="0.32">
      {/* Recurve Bow */}
      <path d="M 30 75 C 28 60 38 40 50 30 C 62 20 72 25 72 25" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 30 75 Q 32 50 22 25" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Bowstring */}
      <line x1="22" y1="25" x2="72" y2="25" stroke="url(#tsGoldAccent)" strokeWidth="0.8" />
      {/* Arrow */}
      <line x1="25" y1="65" x2="68" y2="22" stroke="url(#tsGoldAccent)" strokeWidth="1.8" />
      <path d="M 68 22 L 60 25 M 68 22 L 65 30" stroke="url(#tsGoldAccent)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 25 65 L 20 70 M 23 67 L 18 72" stroke="url(#tsGoldAccent)" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  ),

  "slot-weapon-magic": (
    <g opacity="0.32">
      {/* Wizard staff */}
      <line x1="28" y1="80" x2="62" y2="30" stroke="url(#tsGoldAccent)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="28" y1="80" x2="62" y2="30" stroke="url(#tsStoneBg)" strokeWidth="1.2" strokeLinecap="round" />
      {/* Gnarled head wrap */}
      <path d="M 62 30 C 65 24 72 24 75 28 C 78 32 72 38 66 34 Z" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="1.8" />
      {/* Floating Gem */}
      <polygon points="72,16 80,22 75,32 67,26" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="1.5" />
      {/* Sparkles */}
      <circle cx="78" cy="12" r="1" fill="url(#tsGoldAccent)" />
      <circle cx="63" cy="22" r="0.8" fill="url(#tsGoldAccent)" />
    </g>
  ),

  "slot-armor-head": (
    <g opacity="0.32">
      {/* Knight helmet / bascinet shape */}
      <path d="M 50 20 C 34 20 30 32 30 48 C 30 54 32 68 35 78 L 65 78 C 68 68 70 54 70 48 C 70 32 66 20 50 20 Z" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="2.2" strokeLinejoin="round" />
      {/* Visor slit */}
      <path d="M 33 46 L 67 46 M 34 50 L 66 50" stroke="url(#tsGoldAccent)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Breathing vent holes */}
      <circle cx="42" cy="62" r="1" fill="url(#tsGoldAccent)" />
      <circle cx="48" cy="62" r="1" fill="url(#tsGoldAccent)" />
      <circle cx="54" cy="62" r="1" fill="url(#tsGoldAccent)" />
      <circle cx="58" cy="62" r="1" fill="url(#tsGoldAccent)" />
      {/* Neck guard */}
      <path d="M 35 78 C 35 78 40 85 50 85 C 60 85 65 78 65 78" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="1.8" />
    </g>
  ),

  "slot-armor-chest": (
    <g opacity="0.32">
      {/* Cuirass / breastplate */}
      <path d="M 35 22 C 40 22 42 26 50 26 C 58 26 60 22 65 22 C 72 22 75 32 75 42 L 72 74 C 72 74 65 82 50 82 C 35 82 28 74 28 74 L 25 42 C 25 42 28 22 35 22 Z" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="2.2" strokeLinejoin="round" />
      {/* Neck arch */}
      <path d="M 40 22 C 43 28 57 28 60 22" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="1.8" />
      {/* Chest rib detail */}
      <path d="M 50 26 L 50 78" stroke="url(#tsGoldAccent)" strokeWidth="1.5" />
      <path d="M 33 42 Q 50 48 67 42 M 31 54 Q 50 60 69 54" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="1.2" />
    </g>
  ),

  "slot-armor-feet": (
    <g opacity="0.32">
      {/* Pair of travel boots */}
      {/* Left boot */}
      <path d="M 28 78 L 30 40 L 40 40 L 40 65 L 48 70 L 48 78 L 28 78 Z" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="2" strokeLinejoin="round" />
      {/* Right boot (slightly behind/overlapping) */}
      <path d="M 50 78 L 52 36 L 62 36 L 62 61 L 70 66 L 70 78 L 50 78 Z" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="2" strokeLinejoin="round" />
      {/* Boot folding lines */}
      <path d="M 30 48 Q 35 50 40 48 M 52 44 Q 57 46 62 44" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="1.2" />
    </g>
  ),

  "slot-armor-hands": (
    <g opacity="0.32">
      {/* Left gauntlet */}
      <path d="M 24 74 L 28 42 L 40 42 L 38 74 Z" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="32" cy="42" r="3" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="1" />
      {/* Right gauntlet */}
      <path d="M 60 74 L 62 42 L 74 42 L 76 74 Z" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="68" cy="42" r="3" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="1" />
    </g>
  ),

  "slot-armor-back": (
    <g opacity="0.32">
      {/* Tattered traveler cloak */}
      <path d="M 35 22 C 40 22 42 25 50 25 C 58 25 60 22 65 22 C 72 25 80 40 82 72 C 82 82 76 85 70 80 L 58 84 L 50 78 L 42 84 L 30 80 C 24 85 18 82 18 72 C 20 40 28 25 35 22 Z" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="2" strokeLinejoin="round" />
      {/* Fold lines */}
      <path d="M 35 22 Q 40 50 32 80 M 65 22 Q 60 50 68 80 M 50 25 Q 50 50 50 78" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="1.2" />
    </g>
  ),

  "slot-accessory-ring": (
    <g opacity="0.32">
      {/* Classical Ring */}
      <circle cx="50" cy="54" r="20" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="3" />
      <circle cx="50" cy="54" r="16" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="1" />
      {/* Gem mount */}
      <rect x="42" y="24" width="16" height="12" rx="2" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="2" />
      {/* Gem facet */}
      <polygon points="46,30 50,26 54,30 50,34" fill="url(#tsGoldAccent)" />
    </g>
  ),

  "slot-accessory-amulet": (
    <g opacity="0.32">
      {/* Amulet Chain */}
      <path d="M 28 22 C 32 45 42 55 50 55 C 58 55 68 45 72 22" fill="none" stroke="url(#tsGoldAccent)" strokeWidth="1.5" />
      {/* Amulet Frame / Seal */}
      <circle cx="50" cy="62" r="12" fill="url(#tsSlotSilhouette)" stroke="url(#tsGoldAccent)" strokeWidth="2" />
      {/* Rune center */}
      <path d="M 50 55 L 50 69 M 45 62 L 55 62 M 46 58 L 54 66" stroke="url(#tsGoldAccent)" strokeWidth="1" />
    </g>
  ),

  // === Standalone Map Legends (Simplified for HUD context or direct render) ===
  "map-bldg": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d7a76f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M3 21h18M3 10l9-7 9 7v11H3V10z" fill="rgba(215, 167, 111, 0.15)" />
      <path d="M9 21v-8h6v8M9 10h6" strokeWidth="1.2" />
      <circle cx="17" cy="14" r="1" fill="#d7a76f" />
    </svg>
  ),

  "map-smithy": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d7a76f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M18 10h-2V7l2-3M6 10h2V7L6 4" />
      <path d="M5 10h14v5a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4v-5z" fill="rgba(215, 167, 111, 0.15)" strokeWidth="1.8" />
      <path d="M12 10v9M8 13h8" strokeWidth="1.2" />
    </svg>
  ),

  "map-temple": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d7a76f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M12 2v20M5 12h14" />
      <path d="M12 2L6 8h12L12 2zM8 12v9h8v-9" fill="rgba(215, 167, 111, 0.15)" />
      <circle cx="12" cy="15" r="1.5" fill="#d7a76f" />
    </svg>
  ),

  "map-town": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d7a76f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M4 21h16M5 21V8l3-3 4 3 4-3 3 3v13H5z" fill="rgba(215, 167, 111, 0.15)" />
      <path d="M10 21v-5h4v5M9 12h6" strokeWidth="1.2" />
    </svg>
  ),

  "map-gate": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d7a76f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M4 21V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v15" fill="rgba(215, 167, 111, 0.15)" />
      <path d="M8 8h8M8 12h8M8 16h8M9 4v17M15 4v17" strokeWidth="1.2" />
    </svg>
  ),

  "map-site": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d7a76f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M8 22l2-16 2-4 2 4 2 16H8z" fill="rgba(215, 167, 111, 0.15)" />
      <path d="M12 6v10M10 12h4" strokeWidth="1.2" />
    </svg>
  ),

  "map-unknown": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 4px rgba(239, 68, 68, 0.4))" }}>
      <path d="M12 2L2 12l10 10 10-10L12 2z" fill="rgba(239, 68, 68, 0.08)" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="1.2" fill="#fca5a5" />
    </svg>
  ),

  "map-city": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d7a76f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M3 21h18" />
      <path d="M5 21V10h4V7h6v3h4v11H5z" fill="rgba(215, 167, 111, 0.15)" />
      <path d="M11 21v-4h2v4M8 13h8" strokeWidth="1.2" />
    </svg>
  ),

  "map-river": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5ba6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M2 8c4-3 6 3 10 0s6 3 10 0M2 16c4-3 6 3 10 0s6 3 10 0" />
    </svg>
  ),

  "map-mtns": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a08575" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M4 22L12 5l8 17H4z" fill="rgba(160, 133, 117, 0.15)" />
      <path d="M2 22l6-11 4 7.5M10 22l4-7.5" strokeWidth="1.2" />
    </svg>
  ),

  "map-ruin": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d7a76f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M6 21V8l6-4v4h6v13H6z" fill="rgba(215, 167, 111, 0.1)" />
      <path d="M6 12h6M12 16h6" strokeWidth="1.2" />
      <path d="M9 8v4M15 12v4" strokeWidth="1.2" />
      <path d="M12 4v4" />
      <path d="M10 12l2 2" stroke="#d7a76f" strokeWidth="1.2" />
    </svg>
  ),

  "map-lake": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5ba6ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="rgba(91, 166, 255, 0.12)" />
      <path d="M8 12c2-1 4 1 6 0s2-1 2-1" strokeWidth="1.2" />
    </svg>
  ),
};

/**
 * ThematicIcon Component
 * Designed to provide cohesive, beautiful, Stoneshard-inspired assets in SVG.
 * Supports:
 * - HUD Status Needs (circular frame, cracked stone bg, detailed items):
 *     "hud-hunger", "hud-thirst", "hud-sleep", "hud-vitality", "hud-resolve"
 * - Equipment Slots (square frame, cracked stone bg, empty slot golden silhouettes):
 *     "slot-weapon-melee", "slot-weapon-shield", "slot-weapon-ranged", "slot-weapon-magic",
 *     "slot-armor-head", "slot-armor-chest", "slot-armor-feet", "slot-armor-hands",
 *     "slot-armor-back", "slot-accessory-ring", "slot-accessory-amulet"
 * - Map Legends (clean medieval styled standalone SVGs):
 *     "map-bldg", "map-smithy", "map-temple", "map-town", "map-gate", "map-site",
 *     "map-unknown", "map-city", "map-river", "map-mtns", "map-ruin", "map-lake"
 */
export function ThematicIcon({ name, size = 32 }) {
  const isHud = name && name.startsWith("hud-");
  const isSlot = name && name.startsWith("slot-");
  const isMap = name && name.startsWith("map-");

  const artwork = ARTWORK[name];
  if (!artwork) {
    // Fail-safe simple outline if icon not found
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    );
  }

  // Map legends are standalone, they don't get the stone-plate frames
  if (isMap) {
    // If it's a map icon, clone it and set width/height to size
    return React.cloneElement(artwork, { width: size, height: size });
  }

  // HUD items get the circular frame
  if (isHud) {
    return <CircularFrame size={size}>{artwork}</CircularFrame>;
  }

  // Equipment slots get the square frame
  if (isSlot) {
    return <SquareFrame size={size}>{artwork}</SquareFrame>;
  }

  return artwork;
}
