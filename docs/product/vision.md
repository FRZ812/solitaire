# Product vision

Status: **canonical product direction**

## Product sentence

Solitaire is a portrait-friendly, browser-native mechanical RPG in which a
grounded adventuring company explores a bright but dangerous fantasy world,
builds decks from training and equipment, and resolves consequences through
explicit rules while optional AI narration gives those rules a human voice.

## Product boundaries

- This is a new game. Existing code, lore, and prototypes are references to
  study, not constraints to evolve in place.
- Mechanical outcomes must remain complete without a network or language model.
- No generic game-engine runtime is shipped. React, browser graphics APIs, and
  purpose-built mechanics form the client.
- Inspiration describes useful design vocabulary; it does not license copying
  another game's content, balance, interface, or tone.

## Experience pillars

1. **Readable mechanical depth.** Cards, equipment, wounds, weather, travel,
   relationships, and faction choices expose their rules before commitment.
2. **Persistent adventure.** Health, supplies, deck changes, promises, local
   conditions, and world consequences carry between encounters.
3. **Light high fantasy.** The world can be perilous and emotionally serious,
   but wonder, fellowship, humor, recovery, and civic life define its contrast.
4. **Grounded invention.** Characters and objects begin with a coherent
   historical region, occupation, material, and manufacturing tradition.
5. **Rule-bound magic.** Every supernatural effect has a source, cost, scope,
   duration, tell, and form of resistance or counterplay.
6. **AI as performance, not authority.** A model may phrase dialogue and
   description from approved facts; only game rules create facts.

## Visual direction

- High-definition 2.5D composition: layered depth, camera parallax, lighting,
  weather, and occlusion without requiring a separate 3D engine.
- Oil-brush painterly 2D anime art, with confident shapes and visible brushwork
  rather than low-resolution pixel art.
- Historically plausible silhouettes for clothing, armor, weapons, tools, and
  architecture, adapted deliberately for each region.
- Characters and items remain realistic in construction even when magic is
  present. Magic changes a known material through a stated rule; it does not
  excuse arbitrary ornament.
- Interface surfaces, frames, portraits, icons, and ornament use generated and
  art-directed raster assets. SVG is reserved for technical geometry only, not
  as the game's visual identity.
- Mobile legibility comes from hierarchy, contrast, touch targets, and layout,
  not from reducing the artwork to an 8-bit style.

## Campaign shape

The player prepares a company, chooses a route, resolves encounters, returns to
recover and trade, improves a focused deck, and watches settlements and factions
respond. A short session can complete one choice or fight; a long session can
cross a route, clear a site, or finish a multi-encounter expedition.

The first complete release target is one dense region with a capital, nearby
communities, roads, factions, professions, encounter families, and a coherent
regional arc. Breadth follows depth.

## Non-goals

- A grimdark tone built around cruelty or shock.
- An MMO or an infinite procedurally generated world.
- A chat interface that asks prose to decide game rules.
- A tactical grid bolted onto every encounter.
- Collectible-card monetization or mechanical power sold through AI credits.
- Shipping Godot, an iframe game, or a large WebAssembly engine payload.
