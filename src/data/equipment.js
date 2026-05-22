// Forgeable / purchasable gear and the raw materials it's made from.
//
// Equipment carries NO explicit `combat` block (with rare unique exceptions):
// itemCombatStats (engine/combat-stats.js) infers a weapon's damage / armour's
// protection from the item's NAME (weapon family + heft keywords, armour class
// keywords) and scales it by TIER. So a "Steel Longsword" (uncommon) is
// automatically stronger than an "Iron Longsword" (common), and a "Greatsword"
// hits harder than an "Arming Sword" of the same grade. Keep the descriptive
// keywords in the name (sword / great / mace / war / leather / plate / helm /
// shield / bow…) so inference can read them.
//
// `value` is the base worth in COPPER (1sp=10cp, 1gp=100cp), anchored to the
// system-prompt STANDARD PRICES and scaled up with tier. `tier` is the default
// grade when bought/looted; the forge overrides it with the grade you hammer.
//
// Body armour (kind "armor") is single-slot; helms/bracers/boots/cloaks are kind
// "clothing" so they stack alongside body armour (they still add armour/ward via
// name inference). Shields are their own slot. Charms/amulets/rings are kind
// "trinket" (ward + Mind-governed requirement).

export const EQUIPMENT = {
  // ============================================================
  // WEAPONS
  // ============================================================

  // ---- daggers & knives (fast, low base, Reflex) ----
  "iron-dagger":      { id: "iron-dagger",      name: "Iron Dagger",        kind: "weapon", tier: "common",    value: 20,  appearance: "A plain leaf-blade dagger with a wrapped grip.", description: "Quick and light. Favours Reflex." },
  "steel-dagger":     { id: "steel-dagger",     name: "Steel Dagger",       kind: "weapon", tier: "uncommon",  value: 45,  appearance: "A bright, well-tempered blade with a brass guard.", description: "A finer dagger — keener and truer than common iron." },
  "rondel-dagger":    { id: "rondel-dagger",    name: "Rondel Dagger",      kind: "weapon", tier: "common",    value: 28,  appearance: "A stiff, needle-pointed blade with disc guards.", description: "Built to punch through gaps in mail. A little extra bite against armour." },
  "stiletto":         { id: "stiletto",         name: "Stiletto",           kind: "weapon", tier: "uncommon",  value: 55,  appearance: "A slim, triangular spike of a blade, no edge to speak of.", description: "A killing-point for close, quiet work. Light and very fast." },
  "fine-dagger":      { id: "fine-dagger",      name: "Masterwork Dirk",    kind: "weapon", tier: "rare",      value: 130, appearance: "A jewelled dirk, perfectly balanced, the steel watered like silk.", description: "A nobleman's blade with a killer's edge." },
  "silvered-dagger":  { id: "silvered-dagger",  name: "Silvered Dagger",    kind: "weapon", tier: "rare",      value: 160, appearance: "A pale, silver-washed blade that catches moonlight.", description: "Old craft says silver bites what iron cannot. Prized against the unnatural." },

  // ---- one-handed swords (balanced, Body) ----
  "arming-sword":     { id: "arming-sword",     name: "Arming Sword",       kind: "weapon", tier: "common",    value: 110, appearance: "A plain cruciform one-hander with a wheel pommel.", description: "The soldier's standard side-arm. Reliable and balanced." },
  "iron-shortsword":  { id: "iron-shortsword",  name: "Iron Shortsword",    kind: "weapon", tier: "common",    value: 100, appearance: "A short, broad blade with a single fuller.", description: "A reliable, fast arming blade." },
  "steel-shortsword": { id: "steel-shortsword", name: "Steel Shortsword",   kind: "weapon", tier: "uncommon",  value: 200, appearance: "A bright short blade, edge ground keen.", description: "A finer short blade — fast and true." },
  "falchion":         { id: "falchion",         name: "Falchion",           kind: "weapon", tier: "common",    value: 95,  appearance: "A heavy single-edged cleaver of a sword.", description: "Chops more than it thrusts. Brutal in a press." },
  "iron-longsword":   { id: "iron-longsword",   name: "Iron Longsword",     kind: "weapon", tier: "common",    value: 200, appearance: "A long double-edged blade with a cruciform hilt.", description: "Reach and bite, in trained hands." },
  "steel-longsword":  { id: "steel-longsword",  name: "Steel Longsword",    kind: "weapon", tier: "uncommon",  value: 380, appearance: "A long blade of folded steel, hilt bound in wire.", description: "A knight's blade — keener and stronger than common iron." },
  "knights-longsword":{ id: "knights-longsword",name: "Knight's Longsword", kind: "weapon", tier: "rare",      value: 700, appearance: "A masterwork war-sword, the steel watered, the guard chased with silver.", description: "The work of a master cutler. A blade to be buried with." },
  "officers-sabre":   { id: "officers-sabre",   name: "Officer's Sabre",    kind: "weapon", tier: "rare",      value: 620, appearance: "A curved cavalry sabre with a basket hilt.", description: "Fast, vicious from horseback or afoot. A captain's blade." },
  "rapier":           { id: "rapier",           name: "Rapier",             kind: "weapon", tier: "uncommon",  value: 260, appearance: "A long, slender thrusting blade with a swept guard.", description: "A duellist's point. Favours Reflex and speed over force." },

  // ---- two-handed / great blades (heavy, high base, Body) ----
  "greatsword":       { id: "greatsword",       name: "Greatsword",         kind: "weapon", tier: "uncommon",  value: 420, appearance: "A two-handed war-blade as long as a man is tall.", description: "Vast reach and crushing cuts — but it asks for strength and room to swing." },
  "executioners-blade":{id: "executioners-blade",name: "Executioner's Greatsword", kind: "weapon", tier: "rare", value: 760, appearance: "A broad, square-tipped two-hander, heavy as a guilt.", description: "Made to take heads. Devastating, and slow." },
  "claymore":         { id: "claymore",         name: "Claymore",           kind: "weapon", tier: "rare",      value: 720, appearance: "A great highland two-hander with forward-swept quillons.", description: "A clan-blade. Sweeping, two-fisted, merciless." },

  // ---- axes (high base, no extra pen, Body) ----
  "hand-axe":         { id: "hand-axe",         name: "Hand Axe",           kind: "weapon", tier: "common",    value: 40,  appearance: "A bearded woodsman's axe, equally at home on a log or a skull.", description: "Cheap, vicious, and throwable at a pinch. Light." },
  "battle-axe":       { id: "battle-axe",       name: "Battle Axe",         kind: "weapon", tier: "common",    value: 120, appearance: "A broad single-bit war-axe on a stout haft.", description: "Hews deep. Heavy work for a strong arm." },
  "bearded-axe":      { id: "bearded-axe",      name: "Bearded Axe",        kind: "weapon", tier: "uncommon",  value: 230, appearance: "A long-bearded northern axe, the edge sweeping low.", description: "Hooks shields and limbs alike. A raider's favourite." },
  "steel-greataxe":   { id: "steel-greataxe",   name: "Steel Greataxe",     kind: "weapon", tier: "rare",      value: 640, appearance: "A two-handed greataxe, the head a crescent of bright steel.", description: "Splits shields, mail, and men. Heavy and unsubtle." },

  // ---- maces, hammers & blunt (armour-cracking pen, Body) ----
  "club":             { id: "club",             name: "Studded Club",       kind: "weapon", tier: "common",    value: 12,  appearance: "A knot of hardwood ringed with iron studs.", description: "Crude and cheap. Better than fists." },
  "iron-mace":        { id: "iron-mace",        name: "Iron Mace",          kind: "weapon", tier: "common",    value: 120, appearance: "A flanged head on a banded haft.", description: "Crushes through armour better than it cuts." },
  "steel-mace":       { id: "steel-mace",       name: "Steel Mace",         kind: "weapon", tier: "uncommon",  value: 240, appearance: "A heavier flanged head of bright steel.", description: "A finer mace — turns mail into bruises and bone." },
  "morningstar":      { id: "morningstar",      name: "Morningstar",        kind: "weapon", tier: "uncommon",  value: 220, appearance: "A spiked iron ball atop a banded haft.", description: "Spikes and weight together. Ugly wounds." },
  "war-hammer":       { id: "war-hammer",       name: "War Hammer",         kind: "weapon", tier: "common",    value: 130, appearance: "A hammer-and-spike head on a long haft.", description: "Made to stave in armour and the man inside it. Heavy, high penetration." },
  "maul":             { id: "maul",             name: "Great Maul",         kind: "weapon", tier: "uncommon",  value: 300, appearance: "A two-handed sledge of iron and oak.", description: "Two-fisted ruin. Cracks plate and shields like crockery." },
  "flanged-mace":     { id: "flanged-mace",     name: "Knightly Flanged Mace", kind: "weapon", tier: "rare",   value: 560, appearance: "A masterwork mace, six steel flanges to a head.", description: "The anti-armour weapon of the mounted knight." },

  // ---- spears & polearms (reach + pen, Body) ----
  "iron-spear":       { id: "iron-spear",       name: "Iron Spear",         kind: "weapon", tier: "common",    value: 80,  appearance: "A leaf-point head on a long ash shaft.", description: "Reach and a punching point. The commonest weapon there is." },
  "boar-spear":       { id: "boar-spear",       name: "Boar Spear",         kind: "weapon", tier: "common",    value: 90,  appearance: "A broad-headed spear with a cross-bar below the blade.", description: "Stops a charge — beast or man — on the point." },
  "pike":             { id: "pike",             name: "Pike",               kind: "weapon", tier: "uncommon",  value: 180, appearance: "An over-long infantry spear, made for the line.", description: "Outreaches everything. Unwieldy alone, deadly in a wall. Heavy." },
  "halberd":          { id: "halberd",          name: "Halberd",            kind: "weapon", tier: "uncommon",  value: 320, appearance: "An axe-blade, spike, and hook on a six-foot haft.", description: "Cut, thrust, and pull a rider down. Heavy and versatile." },
  "glaive":           { id: "glaive",           name: "Glaive",             kind: "weapon", tier: "rare",      value: 600, appearance: "A long single-edged blade on a polearm's shaft.", description: "Sweeping reach and a vicious draw-cut. Heavy." },

  // ---- ranged (Reflex; bows physical) ----
  "sling":            { id: "sling",            name: "Sling",              kind: "weapon", tier: "common",    value: 8,   appearance: "A leather pouch on two cords, a pouch of stones beside.", description: "A shepherd's weapon. Cheap, quiet, surprisingly deadly. Light." },
  "short-bow":        { id: "short-bow",        name: "Short Bow",          kind: "weapon", tier: "common",    value: 70,  appearance: "A short, fast self-bow for the saddle or the wood.", description: "Quick to draw, easy to carry. Light." },
  "hunting-bow":      { id: "hunting-bow",      name: "Hunting Bow",        kind: "weapon", tier: "common",    value: 100, appearance: "A plain self-bow of seasoned yew.", description: "A ranged weapon. Favours Reflex." },
  "war-bow":          { id: "war-bow",          name: "War Bow",            kind: "weapon", tier: "uncommon",  value: 220, appearance: "A tall, heavy-draw longbow of layered yew.", description: "Drives an arrow through mail at a hundred paces. Heavy draw." },
  "composite-bow":    { id: "composite-bow",    name: "Composite Bow",      kind: "weapon", tier: "rare",      value: 520, appearance: "A recurved bow of horn, sinew, and wood, lacquered against the wet.", description: "The horse-lord's bow. Brutal power in a short stave." },
  "light-crossbow":   { id: "light-crossbow",   name: "Light Crossbow",     kind: "weapon", tier: "common",    value: 120, appearance: "A goat's-foot crossbow with a wooden stock.", description: "Slow to span, but it punches and asks little of the shooter." },
  "heavy-crossbow":   { id: "heavy-crossbow",   name: "Heavy Crossbow",     kind: "weapon", tier: "uncommon",  value: 280, appearance: "A windlass crossbow with a steel prod.", description: "Drives a bolt through plate. Heavy, and slow to load." },
  "arbalest":         { id: "arbalest",         name: "Arbalest",           kind: "weapon", tier: "rare",      value: 560, appearance: "A masterwork steel crossbow with a cranequin.", description: "The siege of hand-weapons. Heavy, devastating penetration." },

  // ---- magical foci (Mind; magical damage — caster gear) ----
  "quarterstaff":     { id: "quarterstaff",     name: "Quarterstaff",       kind: "weapon", tier: "common",    value: 18,  appearance: "A six-foot length of iron-shod oak.", description: "A traveller's stave — humble, two-ended, and physical, not magical.", combat: { damage: { min: 3, max: 6, type: "physical", pen: 0 }, weaponType: "staff" } },
  "oak-staff":        { id: "oak-staff",        name: "Oak Spellstaff",     kind: "weapon", tier: "common",    value: 60,  appearance: "A knotted oak staff capped with a dull crystal.", description: "A focus for a caster's will. Channels magical force (needs Mind)." },
  "rune-staff":       { id: "rune-staff",       name: "Runed Staff",        kind: "weapon", tier: "rare",      value: 480, appearance: "A black staff cut with glowing channels.", description: "A finer focus that bites with arcane force." },
  "bone-wand":        { id: "bone-wand",        name: "Bone Wand",          kind: "weapon", tier: "uncommon",  value: 150, appearance: "A polished length of yellowed bone, rune-scored.", description: "A small, quick focus for a hedge-caster (needs Mind)." },

  // ============================================================
  // ARMOUR — body (single slot)
  // ============================================================
  "padded-gambeson":  { id: "padded-gambeson",  name: "Padded Gambeson",    kind: "armor", tier: "common",    value: 60,  appearance: "A thick quilted coat of layered linen.", description: "Light, cheap protection — and what real armour is worn over." },
  "leather-jerkin":   { id: "leather-jerkin",   name: "Leather Jerkin",     kind: "armor", tier: "common",    value: 80,  appearance: "A boiled-leather jerkin, oiled against the wet.", description: "Light body armour that won't slow you down." },
  "studded-leather":  { id: "studded-leather",  name: "Studded Leather",    kind: "armor", tier: "uncommon",  value: 220, appearance: "A leather coat sewn thick with iron studs.", description: "Better cover than plain hide, still light enough to move." },
  "brigandine":       { id: "brigandine",       name: "Brigandine",         kind: "armor", tier: "uncommon",  value: 380, appearance: "A cloth coat lined with riveted steel plates.", description: "Plates where it counts, flex where it doesn't. A mercenary's choice." },
  "scale-mail":       { id: "scale-mail",       name: "Scale Mail",         kind: "armor", tier: "uncommon",  value: 420, appearance: "Overlapping steel scales laced to a leather backing.", description: "Solid protection that turns a cut into a bruise." },
  "chain-shirt":      { id: "chain-shirt",      name: "Chain Shirt",        kind: "armor", tier: "common",    value: 300, appearance: "A short-sleeved shirt of riveted mail.", description: "Lighter than a full hauberk, and turns a blade." },
  "chain-hauberk":    { id: "chain-hauberk",    name: "Chain Hauberk",      kind: "armor", tier: "common",    value: 500, appearance: "A knee-length shirt of riveted mail.", description: "Heavy, but it turns a blade." },
  "banded-mail":      { id: "banded-mail",      name: "Banded Mail",        kind: "armor", tier: "rare",      value: 900, appearance: "Mail reinforced with horizontal steel bands.", description: "Mail's flexibility with a plate's bite at the vitals." },
  "half-plate":       { id: "half-plate",       name: "Half-Plate",         kind: "armor", tier: "rare",      value: 1500,appearance: "Plate at the breast, shoulders, and thighs over mail.", description: "Most of a knight's protection without the full harness's weight." },
  "full-plate":       { id: "full-plate",       name: "Full Plate Harness", kind: "armor", tier: "epic",      value: 3600,appearance: "A full articulated harness of fitted steel plate.", description: "A walking fortress. The pinnacle of the armourer's art — and price." },

  // ============================================================
  // HELMS / LIMBS / CLOAKS (kind "clothing" — stack with body armour)
  // ============================================================
  "leather-cap":      { id: "leather-cap",      name: "Leather Cap",        kind: "clothing", tier: "common",   value: 15,  appearance: "A simple boiled-leather skullcap.", description: "Better than a bare head." },
  "iron-helm":        { id: "iron-helm",        name: "Iron Helm",          kind: "clothing", tier: "common",   value: 40,  appearance: "A simple open-faced iron helm with a nasal bar.", description: "Worn alongside body armour." },
  "steel-helm":       { id: "steel-helm",       name: "Steel Helm",         kind: "clothing", tier: "uncommon", value: 110, appearance: "A close-fitting steel helm with a hinged visor.", description: "A finer helm — full cover for the face." },
  "great-helm":       { id: "great-helm",       name: "Great Helm",         kind: "clothing", tier: "rare",     value: 260, appearance: "A flat-topped tilting helm enclosing the whole head.", description: "A knight's helm. Heavy, hot, and proof against most blows." },
  "leather-bracers":  { id: "leather-bracers",  name: "Leather Bracers",    kind: "clothing", tier: "common",   value: 18,  appearance: "A pair of laced forearm guards.", description: "Turn a glancing cut from the arm." },
  "steel-vambraces":  { id: "steel-vambraces",  name: "Steel Vambraces",    kind: "clothing", tier: "uncommon", value: 90,  appearance: "Articulated steel guards for the forearms.", description: "Plate for the arms, worn over mail." },
  "steel-greaves":    { id: "steel-greaves",    name: "Steel Greaves",      kind: "clothing", tier: "uncommon", value: 95,  appearance: "Shin-guards of fitted steel.", description: "Plate for the legs." },
  "mail-coif":        { id: "mail-coif",        name: "Mail Coif",          kind: "clothing", tier: "common",   value: 70,  appearance: "A hood of riveted mail covering head and neck.", description: "Worn under a helm, over the shoulders." },
  "traveling-cloak":  { id: "traveling-cloak",  name: "Traveling Cloak",    kind: "clothing", tier: "common",   value: 40,  appearance: "A heavy hooded cloak of oiled wool.", description: "Sheds rain and turns the wind. A little cover, much comfort." },
  "fur-cloak":        { id: "fur-cloak",        name: "Fur-Lined Cloak",    kind: "clothing", tier: "uncommon", value: 160, appearance: "A thick cloak lined with dark fur.", description: "Keeps the killing cold of the north at bay." },
  "marching-boots":   { id: "marching-boots",   name: "Sturdy Boots",       kind: "clothing", tier: "common",   value: 80,  appearance: "Hobnailed marching boots of thick leather.", description: "Sure-footed on bad ground. A touch of dodge." },

  // ============================================================
  // SHIELDS (own slot)
  // ============================================================
  "buckler":          { id: "buckler",          name: "Buckler",            kind: "shield", tier: "common",    value: 30,  appearance: "A small steel fist-shield.", description: "Light and quick — turns a blade aside, won't slow you." },
  "round-shield":     { id: "round-shield",     name: "Round Shield",       kind: "shield", tier: "common",    value: 50,  appearance: "A round limewood shield with an iron boss.", description: "Raised to catch blows." },
  "kite-shield":      { id: "kite-shield",      name: "Kite Shield",        kind: "shield", tier: "uncommon",  value: 140, appearance: "A long teardrop shield covering flank and leg.", description: "More cover than a round shield, mounted or afoot." },
  "heater-shield":    { id: "heater-shield",    name: "Heater Shield",      kind: "shield", tier: "uncommon",  value: 130, appearance: "A flat-topped knight's shield, often blazoned.", description: "Compact, strong, easy to handle." },
  "tower-shield":     { id: "tower-shield",     name: "Tower Shield",       kind: "shield", tier: "rare",      value: 320, appearance: "A great rectangular shield you can crouch behind.", description: "A wall of wood and iron. Heavy, but little gets past it." },

  // ============================================================
  // TRINKETS (ward; Mind-governed requirement)
  // ============================================================
  "warding-charm":    { id: "warding-charm",    name: "Warding Charm",      kind: "trinket", tier: "uncommon", value: 200, appearance: "A knot of bone, hair, and red thread on a cord.", description: "Hedge-magic against the unseen. A little ward." },
  "silver-amulet":    { id: "silver-amulet",    name: "Silver Amulet",      kind: "trinket", tier: "rare",     value: 480, appearance: "A worked silver disc on a fine chain.", description: "Old wards worked into the silver. Turns more than the eye can see." },
  "scholars-circlet": { id: "scholars-circlet", name: "Scholar's Circlet",  kind: "trinket", tier: "rare",     value: 520, appearance: "A thin silver circlet set with a clear stone.", description: "Clears and steadies the mind. A caster's ward." },
  "iron-ring":        { id: "iron-ring",        name: "Iron Signet Ring",   kind: "trinket", tier: "common",   value: 60,  appearance: "A heavy iron ring with a worn seal.", description: "A small thing of office or family. More worth than ward." },

  // ============================================================
  // HIGH TIERS — very-rare → divine. The top end is mostly NAMED uniques,
  // including the signature arms of the world's important figures (see their
  // codex `worn` lists), so every grade has concrete anchors to normalise
  // narrator-invented loot against. These are NOT shop stock — they're hoard,
  // relic, reward, and the gear of the great.
  // ============================================================

  // ---- very-rare (×2.4) — masterwork / silvered / kindred-forged ----
  "silvered-longsword": { id: "silvered-longsword", name: "Silvered Longsword", kind: "weapon", tier: "very-rare", hands: 1, value: 1200, appearance: "A pattern-welded blade washed in silver, cold to the touch.", description: "A masterwork sword, silver-edged against the unnatural." },
  "frost-greataxe":     { id: "frost-greataxe",     name: "Frost-Iron Greataxe", kind: "weapon", tier: "very-rare", hands: 2, value: 1300, appearance: "A two-handed axe of pale northern iron that never quite warms.", description: "Northern war-iron. Splits shields and the cold air alike." },
  "war-pick":           { id: "war-pick",           name: "Steel War-Pick",      kind: "weapon", tier: "very-rare", hands: 1, value: 1100, appearance: "A vicious beaked war-pick of bright steel.", description: "Made to punch clean through plate. Fearsome penetration." },
  "elven-warbow":       { id: "elven-warbow",       name: "Elven War-Bow",       kind: "weapon", tier: "very-rare", hands: 2, value: 1300, appearance: "A tall recurve of silver-grey wood, strung with shimmering cord.", description: "Selenyan craft — drives an arrow further and truer than any human bow." },
  "sorcerers-staff":    { id: "sorcerers-staff",    name: "Sorcerer's Staff",    kind: "weapon", tier: "very-rare", hands: 2, value: 1200, appearance: "A black staff crowned with a caged, pulsing stone.", description: "A potent arcane focus (needs Mind)." },
  "elven-mail":         { id: "elven-mail",         name: "Elven Mail",          kind: "armor",  tier: "very-rare", value: 2100, appearance: "Mail of fine silver rings, light as cloth.", description: "Selenyan-woven — a plate's protection at a shirt's weight." },
  "dwarven-scale":      { id: "dwarven-scale",      name: "Dwarven Scale",       kind: "armor",  tier: "very-rare", value: 1900, appearance: "Overlapping scales of blue-grey hold-steel.", description: "Stonehold work. Heavy, and all but uncuttable." },

  // ---- epic (×3.2) — relic-grade ----
  "blacksteel-greatsword": { id: "blacksteel-greatsword", name: "Blacksteel Greatsword", kind: "weapon", tier: "epic", hands: 2, value: 3200, appearance: "A vast two-hander of light-drinking blacksteel.", description: "A relic-blade. Cleaves armour and men in a single sweep." },
  "rune-etched-maul":      { id: "rune-etched-maul",      name: "Rune-Etched Maul",      kind: "weapon", tier: "epic", hands: 2, value: 3000, appearance: "A great maul whose head crawls with cut runes.", description: "Shatters plate, shields, and bone with contemptuous ease." },
  "dragonfang-spear":      { id: "dragonfang-spear",      name: "Dragonfang Spear",      kind: "weapon", tier: "epic", hands: 1, value: 2800, appearance: "A spear tipped with a honed drake's fang.", description: "Reach and a point that bites through any harness." },
  "deathsong-bow":         { id: "deathsong-bow",         name: "Deathsong Bow",         kind: "weapon", tier: "epic", hands: 2, value: 3000, appearance: "A black bow that hums faintly as it draws.", description: "Its arrows find the gap in any armour." },
  "staff-of-embers":       { id: "staff-of-embers",       name: "Staff of Embers",       kind: "weapon", tier: "epic", hands: 2, value: 3000, appearance: "A staff capped with a coal that never dies.", description: "A burning arcane focus (needs Mind)." },
  "dragonscale-mail":      { id: "dragonscale-mail",      name: "Dragonscale Mail",      kind: "armor",  tier: "epic", value: 4200, appearance: "A hauberk of overlapping drake-scales.", description: "Turns fire and steel alike. The spoil of a slain wyrmling." },

  // ---- legendary (×4.3) — named arms of the great ----
  "imperial-cleaver":   { id: "imperial-cleaver",   name: "The Imperial Cleaver", kind: "weapon", tier: "legendary", hands: 2, value: 6000, appearance: "A huge notched cleaver of old imperial steel, taller than a goblin.", description: "A relic of the Sundered Crown, borne by the Goblin King at Brokenhold." },
  "bow-of-her-mother":  { id: "bow-of-her-mother",  name: "Bow of Her Mother",    kind: "weapon", tier: "legendary", hands: 2, value: 6500, appearance: "An ancient Selenyan bow of heartwood and silver, named for its first bearer.", description: "Lirilin of the Long Note carries it; it has loosed arrows for eleven ages." },
  "dragon-lance-old":   { id: "dragon-lance-old",   name: "The Old Dragon-Lance",  kind: "weapon", tier: "legendary", hands: 2, value: 6000, appearance: "A long, fire-scarred lance with a leaf of star-metal at its head.", description: "Brother-Master Anders' lance, that has stood close enough to a wyrm to feel its breath." },
  "warhammer-of-the-breaking": { id: "warhammer-of-the-breaking", name: "Warhammer of the Breaking", kind: "weapon", tier: "legendary", hands: 2, value: 6200, appearance: "A great dwarven war-maul, its head a block of rune-cut hold-steel.", description: "Hold-Father Druin Ironvein's hammer of office — it has broken gates and wyrm-scale both." },
  "patchwork-mail":     { id: "patchwork-mail",     name: "Patchwork Mail",       kind: "armor",  tier: "legendary", value: 6000, appearance: "A hauberk pieced from a hundred fallen foes' armour, riveted into one.", description: "The Goblin King's mail — every plate a kill, and proof against nearly all of them." },

  "spire-staff":        { id: "spire-staff",        name: "Staff of the Glass Spire", kind: "weapon", tier: "legendary", hands: 2, value: 7000, appearance: "A staff of fused glass that holds a slow, turning light.", description: "The High Master's focus — the arcane power that trained a continent's sorcerers (needs Mind)." },

  // ---- mythical (×5.8) — robes of power, fell relics ----
  "black-robe":         { id: "black-robe",         name: "The Black Robe",       kind: "clothing", tier: "mythical", value: 9000, appearance: "A robe of smoke-dark cloth that the eye slides off.", description: "Worn by the Demon King; a ward woven of something older than weaving." },
  "godsteel-greatsword":{ id: "godsteel-greatsword",name: "Godsteel Greatsword",  kind: "weapon", tier: "mythical", hands: 2, value: 11000, appearance: "A two-hander of pale, faintly singing metal that no forge of this age could make.", description: "An apex relic. Anchors the mythical grade." },
  "starsteel-mail":     { id: "starsteel-mail",     name: "Starsteel Mail",       kind: "armor",  tier: "mythical", value: 12000, appearance: "Mail of metal fallen from the sky, blue-black and weightless.", description: "A king's-ransom harness. Anchors the mythical grade." },
  "staff-of-storms":    { id: "staff-of-storms",    name: "Staff of Storms",      kind: "weapon", tier: "mythical", hands: 2, value: 13000, appearance: "A staff that crackles, the air around it always faintly charged.", description: "A mythical arcane focus that calls the sky's own violence (needs Mind)." },

  // ---- divine (×8) — the apex; the arms of fabled powers ----
  "polestar-sword":     { id: "polestar-sword",     name: "The Polestar Sword",   kind: "weapon", tier: "divine", hands: 2, value: 20000, appearance: "A blade of fixed cold light, like a star drawn down and edged.", description: "The Demon King's sword on the Polestar Throne. The single deadliest arm in the known world." },
  "sunforged-blade":    { id: "sunforged-blade",    name: "The Sunforged Blade",  kind: "weapon", tier: "divine", hands: 1, value: 18000, appearance: "A one-handed sword that holds a kept ember of daylight.", description: "A divine relic-sword. Anchors the divine grade for one-handers." },
  "aegis-plate":        { id: "aegis-plate",        name: "The Aegis Harness",    kind: "armor",  tier: "divine", value: 24000, appearance: "A full harness of seamless white metal that no blow has marked.", description: "A divine harness said to have never been pierced. Anchors the divine grade." },
  "godflame-staff":     { id: "godflame-staff",     name: "The Godflame Staff",   kind: "weapon", tier: "divine", hands: 2, value: 22000, appearance: "A staff crowned with a flame that was never lit and will never go out.", description: "A divine focus on the level of the Polestar Sword — the apex of arcane arms (needs Mind)." },
};

// Crafting materials — kind "material", so they stack in the pack, sell to a
// smith, and are consumed by the forge. Buyable at the smithy or market.
export const MATERIALS = {
  "iron-ingot":     { id: "iron-ingot",     name: "Iron Ingot",     kind: "material", value: 8,   appearance: "A rough grey bar of smelted iron.", description: "Forge-stock for common arms and armour." },
  "steel-ingot":    { id: "steel-ingot",    name: "Steel Ingot",    kind: "material", value: 25,  appearance: "A bright bar of folded steel.", description: "Finer forge-stock for better work (uncommon–rare)." },
  "silver-ingot":   { id: "silver-ingot",   name: "Silver Ingot",   kind: "material", value: 60,  appearance: "A soft, gleaming bar of refined silver.", description: "Alloyed into edges said to bite the unnatural." },
  "blacksteel-ingot":{id: "blacksteel-ingot",name: "Blacksteel Ingot",kind: "material", value: 140, appearance: "A dark, dense bar that drinks the light.", description: "Rare forge-stock for the finest arms (rare–epic)." },
  "leather-hide":   { id: "leather-hide",   name: "Leather Hide",   kind: "material", value: 6,   appearance: "A cured hide, supple and oiled.", description: "Cut and boiled for leather armour." },
  "thick-hide":     { id: "thick-hide",     name: "Thick Beast-Hide",kind: "material", value: 22,  appearance: "A heavy, scarred hide from something large.", description: "Tougher backing for studded and scaled armour." },
  "hardwood-haft":  { id: "hardwood-haft",  name: "Hardwood Haft",  kind: "material", value: 4,   appearance: "A turned length of seasoned ash.", description: "A handle or shaft for hafted weapons." },
  "yew-stave":      { id: "yew-stave",      name: "Yew Stave",      kind: "material", value: 12,  appearance: "A straight-grained billet of seasoned yew.", description: "Worked down into bows." },
  "bowstring":      { id: "bowstring",      name: "Waxed Bowstring", kind: "material", value: 5,   appearance: "A hank of waxed linen bowstring.", description: "Strings a bow; spares for the road." },
  "whetstone-grit": { id: "whetstone-grit", name: "Sharpening Grit", kind: "material", value: 3,   appearance: "A twist of coarse grinding grit.", description: "Consumed in finishing an edge at the forge." },
};
