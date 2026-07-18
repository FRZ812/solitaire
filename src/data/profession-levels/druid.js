// Druid progression is primal spellwork practiced through the turning year.
// Every native Druid action belongs to one season. The matching season is
// empowered, then a committed action advances Spring -> Summer -> Autumn ->
// Winter -> Spring exactly once. Each Druid owns an independent cycle.

const grant = (type, id, details = {}) => Object.freeze({ type, id, ...details });
const seasonalAbility = (id, authoredSeason) => grant("ability", id, { authoredSeason, nativeDruidAction: true });
const primalAction = (id, name, description, details = {}) => grant("action", id, { name, description, noncombatBenefit: true, ...details });
const primalPassive = (id, name, description, details = {}) => grant("passive", id, { name, description, noncombatBenefit: true, ...details });
const primalProficiency = (id, name, description, details = {}) => grant("proficiency", id, { name, description, noncombatBenefit: true, ...details });
const row = (name, description, grants) => Object.freeze({
  name,
  feature: name,
  description,
  grants: Object.freeze(grants),
});

const ROWS = [
  row("First Bud", "Awaken the Spring expression of primal spellwork and learn the four-season rhythm that governs every native Druid action.", [
    seasonalAbility("druid-verdant-spark", "spring"),
    primalPassive("druid:four-season-cycle", "Four-Season Cycle", "This Druid begins every combat in Spring. A committed native Druid action is empowered when its authored season matches the current season, then advances this Druid's own cycle exactly once through Spring, Summer, Autumn, Winter, and back to Spring. A cancelled action or another profession's action never advances it.", {
      selfSide: true,
      independentDruids: true,
      seasonOrder: Object.freeze(["spring", "summer", "autumn", "winter"]),
      resetEachFight: "spring",
      matchingSeasonEmpowered: true,
      advancesOnCommittedNativeAction: true,
      advancesOnMiss: true,
      multiHitAdvancesOnce: true,
      cancelledActionsAdvance: false,
      foreignActionsAdvance: false,
    }),
    primalProficiency("druid:primal-spellworker", "Primal Spellworker", "Read land, weather, growth, animal life, bodily change, decay, and renewal as one material and magical ecology without borrowing arcane formulae, divine prayer, pacts, or Ranger fieldcraft."),
  ]),
  row("Soil Hand", "Judge structure, moisture, drainage, compaction, organic matter, salinity, and disturbance before planting or restoring ground.", [primalAction("druid:read-soil", "Read Soil", "Inspect a bounded patch of earth, record its layers and recent use, and identify what can safely grow there now.")]),
  row("Weather Ear", "Combine cloud form, pressure, wind, scent, humidity, animal behaviour, and local memory into a restrained short-range forecast.", [primalAction("druid:read-near-weather", "Read Near Weather", "Prepare a local forecast with timing, uncertainty, exposed routes, shelter options, and signs that would overturn it.")]),
  row("Wild Courtesy", "Approach wild creatures through distance, posture, scent, food security, escape routes, and patient observation rather than supernatural command.", [primalPassive("druid:wild-courtesy", "Wild Courtesy", "Ordinary animals are less likely to be needlessly cornered or provoked by a Druid who respects their warning signs; they retain their own instincts and agency.")]),
  row("Living Seed Bank", "Collect, label, dry, store, test, and exchange locally appropriate seed without stripping a wild population.", [primalAction("druid:keep-seed-bank", "Keep a Living Seed Bank", "Preserve provenance, season, habitat, germination needs, quantity, and stewardship terms for gathered seed.")]),
  row("Sunlance", "Release a Summer-authored line of concentrated primal heat and light; outside battle the same practice manages warmth, glare, and solar exposure.", [
    seasonalAbility("druid-sunlance", "summer"),
    primalAction("druid:manage-solar-exposure", "Manage Solar Exposure", "Arrange shade, reflective cover, ventilation, water, work periods, and heat checks for people, animals, seedlings, or stored goods."),
  ]),
  row("Waterfinder", "Trace slope, vegetation, stone, soil colour, seepage, insects, tracks, and weather to locate water without assuming it is safe.", [primalAction("druid:survey-water-source", "Survey a Water Source", "Identify likely water, access cost, seasonal reliability, contamination risks, and the treatment required before use.")]),
  row("Field Herbarium", "Preserve plants with location, season, habitat, lookalikes, handling hazards, known uses, and uncertainty attached.", [primalAction("druid:make-field-herbarium", "Make a Field Herbarium", "Prepare a labelled specimen and notes that another careful worker can compare without treating resemblance as proof.")]),
  row("Fire Ecology", "Read fuel, wind, slope, moisture, recent burns, escape lanes, and fire-dependent growth as parts of one changing system.", [primalPassive("druid:fire-ecology", "Fire Ecology", "The Druid can distinguish ordinary renewal by fire from dangerous accumulation, deliberate destruction, and conditions too volatile for intervention.")]),
  row("Primal Circle", "Choose Circle of Root, Circle of Fang, Circle of Sky, or Circle of Cycle while the four-season progression continues unchanged.", [primalPassive("druid:declared-circle", "Declared Primal Circle", "The selected circle deepens growth and terrain, self-shapeshifting, weather, or decay and reclamation. It does not import summoned pets, Ranger techniques, arcane spellbooks, divine rites, or pact magic.")]),

  row("Canopy Route", "Plan movement through forest by crown density, dead limbs, roots, visibility, water, animal paths, fragile habitat, and safe return.", [primalAction("druid:plan-canopy-route", "Plan a Canopy Route", "Mark a low-impact route, hazards, crossings, rest sites, seasonal closures, and signs for turning back.")]),
  row("Leafrot", "Cast an Autumn-authored wave of accelerated leaf decay and returning nutrients, weakening active growth without creating disease from nothing.", [
    seasonalAbility("druid-leafrot", "autumn"),
    primalAction("druid:prepare-leaf-mould", "Prepare Leaf Mould", "Gather suitable fallen leaves, exclude diseased or contaminated material, manage air and moisture, and return the finished amendment to depleted soil."),
  ]),
  row("Compost Measure", "Balance moisture, air, carbon, nitrogen, heat, pathogens, time, and intended use in a managed decay pile.", [primalAction("druid:build-compost", "Build Compost", "Assemble and monitor a bounded compost system, correcting smell, heat, pests, dryness, or contamination before use.")]),
  row("Migration Signs", "Interpret tracks, feeding, calls, moult, fat, water, wind, and remembered timing without inventing speech or prophecy.", [primalAction("druid:record-migration", "Record a Migration", "Document species, number, condition, direction, timing, habitat use, interruption, and uncertainty for later seasonal comparison.")]),
  row("Vernal Calendar", "Coordinate planting, grazing, gathering, travel, and rites around observed thaw, bud, insect, bird, rain, and soil signs.", [primalAction("druid:prepare-vernal-calendar", "Prepare a Vernal Calendar", "Translate local Spring indicators into revisable dates, responsibilities, contingencies, and protected no-harvest periods.")]),
  row("Stream Mender", "Restore flow around erosion, blockage, trampling, shade loss, spawning beds, banks, and downstream users.", [primalAction("druid:mend-stream", "Mend a Stream", "Plan a small restoration with lawful access, staged work, sediment control, habitat protection, flood allowance, and later monitoring.")]),
  row("Mutable Anatomy", "Study how bone, muscle, skin, breath, balance, digestion, and sense must change together before attempting bodily transformation.", [primalPassive("druid:mutable-anatomy", "Mutable Anatomy", "Self-shapeshifting remains a coherent living-body change limited by the Druid's circle, practiced forms, available space, and the body's ability to return safely.")]),
  row("Rimebark", "Shape a Winter-authored shell of primal frost and bark that resists exposed harm while respecting heat, mass, duration, and living tissue.", [
    seasonalAbility("druid-rimebark", "winter"),
    primalAction("druid:stabilize-with-cold", "Stabilize with Cold", "Use bounded cooling, insulation, clean wrapping, and monitoring to preserve food, seed, specimens, or a heat-sensitive remedy without freezing what must remain living."),
  ]),
  row("Weather Shelter", "Site a refuge by drainage, wind, falling material, lightning, cold sinks, sun, fire, access, and rapid evacuation.", [primalAction("druid:site-weather-shelter", "Site a Weather Shelter", "Choose and prepare a temporary shelter with ventilation, runoff, anchors, bedding, safe heat, occupancy, and an exit plan.")]),
  row("Poison Ecology", "Understand toxin as dose, route, timing, organism, purpose, decomposition, and food-web consequence rather than a label of evil.", [primalPassive("druid:poison-ecology", "Poison Ecology", "The Druid can handle known natural toxins more safely and distinguish likely exposure from disease, spoilage, venom, or harmless defence.")]),

  row("Almanac of Turning", "Keep weather, bloom, fruit, migration, birth, fire, flood, freeze, work, and scarcity in one comparable seasonal record.", [primalAction("druid:keep-seasonal-almanac", "Keep a Seasonal Almanac", "Record dated local observations, sources, confidence, anomalies, and consequences so later decisions rest on more than memory.")]),
  row("Good Burn", "Prepare a small controlled fire only where fuel, weather, permits, crew, water, containment, smoke, wildlife, and escape allow it.", [primalAction("druid:plan-good-burn", "Plan a Good Burn", "Write ignition limits, no-burn conditions, roles, boundaries, smoke warnings, refuge zones, suppression, and post-burn checks.")]),
  row("Living Graft", "Join compatible plant tissues with clean cuts, alignment, support, timing, aftercare, and honest expectations of failure.", [primalAction("druid:make-living-graft", "Make a Living Graft", "Graft or bud one suitable plant for repair, propagation, pollination, or resilience while labelling stock and scion.")]),
  row("Saprise", "Call a Spring-authored pulse of rising primal vitality that closes immediate harm without replacing food, rest, medicine, or time.", [
    seasonalAbility("druid-saprise", "spring"),
    primalAction("druid:tend-recovery-garden", "Tend a Recovery Garden", "Grow and schedule safe food, shade, scent, medicinal plants, accessible paths, and quiet work around a convalescent community."),
  ]),
  row("Fungal Survey", "Read fruiting bodies, substrate, moisture, host, spore, decay stage, lookalikes, and contamination before harvest or treatment.", [primalAction("druid:survey-fungi", "Survey Fungi", "Document a fungal site and decide whether to protect, sample, cultivate, avoid, or refer it for specialist study.")]),
  row("Animal Passage", "Preserve routes between feeding, water, shelter, breeding, and seasonal refuge without drawing animals into dangerous human traffic.", [primalAction("druid:mark-animal-passage", "Mark Animal Passage", "Identify a mundane wildlife corridor, conflict points, seasonal timing, barriers, and practical changes that reduce collision or entrapment.")]),
  row("Watershed Memory", "Connect springs, streams, wetlands, slopes, wells, farms, settlements, floodplains, and waste across an entire drainage.", [primalAction("druid:map-watershed", "Map a Watershed", "Create a layered map of flow, use, contamination, erosion, habitat, flood, drought, responsibility, and downstream consequence.")]),
  row("Dormant Life", "Recognize when seed, bulb, root, egg, spore, or hibernating body is alive but waiting rather than dead or ready to wake.", [primalPassive("druid:dormant-life", "Dormant Life", "The Druid avoids destructive handling and can provide appropriate cold, moisture, darkness, air, or quiet for known dormant life.")]),
  row("Habitat Covenant", "Negotiate bounded human use around breeding grounds, sacred groves, water, grazing, gathering, dangerous wildlife, and subsistence need.", [primalAction("druid:negotiate-habitat-covenant", "Negotiate a Habitat Covenant", "Set seasons, zones, quantities, methods, monitors, emergency exceptions, remedies, and review with the people affected.")]),
  row("Elder Method", "Choose one mature method within the selected primal circle while retaining general seasonal spellwork and ecological practice.", [primalPassive("druid:declared-circle-method", "Declared Circle Method", "The chosen method refines one circle through native primal spellwork and stewardship; it never grants summoned pets or another profession's abilities.")]),

  row("Storm Readiness", "Prepare people, animals, stores, trees, boats, roofs, drainage, communications, and shelters for forecast severe weather.", [primalAction("druid:prepare-for-storm", "Prepare for a Storm", "Assign warnings, reinforcement, evacuation, animal shelter, water protection, lightning rules, checks, and recovery priorities.")]),
  row("Sirocco", "Raise a Summer-authored rush of heated, drying wind that punishes exposed approach without becoming illusion or conjured fire.", [
    seasonalAbility("druid-sirocco", "summer"),
    primalAction("druid:vent-heat", "Vent Dangerous Heat", "Use shade, high and low openings, thermal mass, airflow, work timing, hydration, and occupancy limits to cool a real space."),
  ]),
  row("Wetland Steward", "Balance flood storage, clean water, peat, reeds, fish, insects, birds, disease, grazing, and human access.", [primalAction("druid:restore-wetland", "Restore a Wetland", "Plan staged rewetting or protection with water rights, soil limits, habitat seasons, safe paths, monitoring, and neighbouring land in view.")]),
  row("Phenology", "Compare the timing of biological events across years to detect mismatch among bloom, pollinator, rain, frost, migration, and harvest.", [primalAction("druid:track-phenology", "Track Phenology", "Maintain comparable dated observations and identify which change is witnessed, which is inferred, and what decision it may affect.")]),
  row("Pest Balance", "Identify whether damage comes from outbreak, introduced species, stressed habitat, missing predators, weather, storage, or ordinary appetite.", [primalAction("druid:rebalance-pests", "Rebalance Pests", "Choose the least disruptive mix of exclusion, sanitation, timing, habitat, hand removal, trap, or tolerance, then monitor unintended harm.")]),
  row("Beast Physiology", "Compare gait, respiration, temperature, digestion, sensory range, injury signs, and stress across known animal bodies.", [primalPassive("druid:beast-physiology", "Beast Physiology", "The Druid notices when a practiced self-form is moving, breathing, feeding, or recovering unsafely and can end or correct it sooner.")]),
  row("Lightning Ground", "Read exposure, height, conductive paths, shelter, spacing, water, metal, and storm motion before lightning arrives.", [primalAction("druid:plan-lightning-safety", "Plan Lightning Safety", "Mark safer ground, forbidden shelter, group spacing, equipment handling, watch signs, casualty response, and the all-clear rule.")]),
  row("Harvest Tide", "Drive an Autumn-authored sweep of hardened thorn, burr, husk, and falling growth through an exposed lane.", [
    seasonalAbility("druid-harvest-tide", "autumn"),
    primalAction("druid:harvest-thorn-crop", "Harvest a Thorn Crop", "Cut, bundle, transport, and regrow thorny living material for hedges, basketry, medicine, or fuel without scattering injury or invasive seed."),
  ]),
  row("Food Forest", "Layer canopy, understory, shrub, vine, root, fungi, pollinator habitat, paths, water, harvest, and succession.", [primalAction("druid:design-food-forest", "Design a Food Forest", "Plan a locally suitable perennial planting with access, labour, time to yield, water, soil, community rights, and replacement in mind.")]),
  row("Ice Reader", "Judge ice by temperature history, current, springs, snow, colour, sound, load, cracks, shore, and changing weather.", [primalAction("druid:read-natural-ice", "Read Natural Ice", "Survey a necessary crossing or work area, mark uncertainty and hazards, distribute load, and identify a safer alternative or rescue plan.")]),

  row("Erosion Work", "Treat bare soil, concentrated water, wave, wind, trampling, failed drainage, slope, and lost roots as connected causes.", [primalAction("druid:control-erosion", "Control Erosion", "Use staged drainage, cover, contour, living roots, barriers, access changes, and monitoring suited to the actual cause.")]),
  row("Antidote Garden", "Cultivate verified medicinal and counteragent plants alongside labels, lookalike controls, dose records, clean tools, and referral limits.", [primalAction("druid:keep-antidote-garden", "Keep an Antidote Garden", "Maintain safe living reference stock and preparation records without claiming that every natural poison has a plant cure.")]),
  row("Solar Preservation", "Use heat, dry air, shade, smoke, salt, screens, clean surfaces, and storage timing to preserve food and materials.", [primalAction("druid:preserve-by-season", "Preserve by Season", "Choose a safe drying or curing method, record batch and conditions, inspect spoilage, and protect the result from moisture and pests.")]),
  row("Frostroot", "Raise a Winter-authored shelter of rime, packed earth, dormant root, and still air that grants bounded protection rather than immunity.", [
    seasonalAbility("druid-frostroot", "winter"),
    primalAction("druid:build-winter-haven", "Build a Winter Haven", "Prepare insulation, ventilation, dry bedding, safe heat, food, water, waste, watch, occupancy, and thaw drainage for a cold-weather refuge."),
  ]),
  row("Mycorrhizal Map", "Trace likely exchange among root, fungus, moisture, nutrient, disturbance, disease, and succession without treating the network as a speaking mind.", [primalAction("druid:map-root-fungus", "Map Root and Fungus", "Sample and record a bounded plant-fungal association with host, soil, season, condition, method, uncertainty, and minimal disturbance.")]),
  row("Wildlife Corridor", "Reconnect divided habitat around roads, fences, farms, towns, predators, prey, seasonal movement, and human safety.", [primalAction("druid:design-wildlife-corridor", "Design a Wildlife Corridor", "Propose crossings, cover, water, fencing, warnings, timing, monitoring, land agreements, and conflict response for actual species.")]),
  row("Drought Compact", "Allocate scarce water among drinking, sanitation, food, livestock, habitat, fire, craft, and future reserve through visible rules.", [primalAction("druid:prepare-drought-compact", "Prepare a Drought Compact", "Set measurements, priorities, restrictions, support, enforcement, emergency exceptions, review triggers, and rain-independent reserves.")]),
  row("Salvage Woodland", "Recover stormfall, deadwood, coppice, bark, fibre, fuel, and construction timber while retaining soil and habitat.", [primalAction("druid:plan-woodland-salvage", "Plan Woodland Salvage", "Mark what must remain, what may be taken, access, tools, season, worker safety, wildlife checks, regeneration, and ownership.")]),
  row("Solstice Observatory", "Use horizon, shadow, stars, temperature, wind, plants, and records to anchor a local seasonal calendar.", [primalAction("druid:keep-solstice-observatory", "Keep a Solstice Observatory", "Maintain sightlines, fixed marks, dated observations, instrument checks, and community interpretation without turning weather into prophecy.")]),
  row("Master Circle", "Choose the final mastery within the mature Druid method; it adds stewardship and precision but no additional combat card.", [primalPassive("druid:declared-circle-mastery", "Declared Circle Mastery", "The final specialization deepens its existing method without adding summoned creatures, foreign spells, or another profession resource.")]),

  row("Living Canopy", "Send a Spring-authored front of roots, shoots, and spreading canopy through suitable ground, then leave living growth that must be stewarded.", [
    seasonalAbility("druid-living-canopy", "spring"),
    primalAction("druid:stabilize-living-bank", "Stabilize a Living Bank", "Plant and protect locally suitable roots along an eroding bank with spacing, access, flood, wildlife, and establishment care in view."),
  ]),
  row("Avalanche Country", "Read slab, layer, wind loading, temperature, sun, terrain trap, trigger, runout, escape, and recent evidence.", [primalAction("druid:survey-avalanche-country", "Survey Avalanche Country", "Choose a route and timing, mark no-go conditions, distribute travellers, prepare rescue tools, and record why the remaining risk is accepted.")]),
  row("Seed Commons", "Build fair exchange of seed, cutting, knowledge, labour, risk, and benefit while protecting provenance and local adaptation.", [primalAction("druid:organize-seed-commons", "Organize a Seed Commons", "Set contribution, access, record, quarantine, germination testing, replenishment, stewardship, and dispute terms for shared living stock.")]),
  row("Pollinator Stewardship", "Coordinate flowers, nesting, water, pesticide limits, mowing, crop timing, disease, and public access for actual pollinators.", [primalAction("druid:steward-pollinators", "Steward Pollinators", "Prepare a season-by-season habitat and work plan, including observation and correction when the intended species do not arrive.")]),
  row("Deadwood Life", "Distinguish hazardous timber from standing and fallen deadwood that shelters fungi, insects, birds, mammals, moisture, and soil.", [primalPassive("druid:deadwood-life", "Deadwood Life", "The Druid can retain ecological structure while marking and reducing specific risks to paths, homes, workers, and fire control.")]),
  row("High Summer", "Call a Summer-authored burst of wind, rain, heat, and lightning from an existing charged sky, bounded by the actual weather rather than conjured from nothing.", [
    seasonalAbility("druid-high-summer", "summer"),
    primalAction("druid:manage-stormwater", "Manage Stormwater", "Route roof, street, field, and slope runoff through storage, overflow, filtration, safe discharge, and maintenance sized to real storms."),
  ]),
  row("Coastal Windbreak", "Design shelter against salt wind, moving sand, storm surge, erosion, fire, and blocked views without freezing a living shore in place.", [primalAction("druid:design-coastal-windbreak", "Design a Coastal Windbreak", "Choose local vegetation, spacing, setbacks, access, drainage, establishment care, and sacrificial zones for a changing coast.")]),
  row("Disease Ecology", "Trace host, vector, water, waste, crowding, nutrition, season, movement, immunity, and habitat without moralizing illness.", [primalAction("druid:map-disease-ecology", "Map Disease Ecology", "Build a practical exposure map, separate evidence from suspicion, and coordinate sanitation, isolation, vector control, care, and environmental repair.")]),
  row("Glacial Archive", "Read ice layers, trapped material, melt channels, moraine, old vegetation, and local accounts as a fragile climate record.", [primalAction("druid:document-glacial-record", "Document a Glacial Record", "Sample minimally, preserve location and chain of custody, note melt danger, and compare physical evidence with dated records.")]),
  row("Seasonal Council", "Bring growers, gatherers, herders, fishers, healers, builders, travellers, elders, and young observers into a shared review of the year.", [primalAction("druid:convene-seasonal-council", "Convene a Seasonal Council", "Compare evidence, name conflicts, decide limited work, protect dissent, assign observation, and set the next review at a meaningful seasonal marker.")]),

  row("Wild Rescue", "Capture, move, release, or humanely refer an injured or trapped wild creature without turning rescue into ownership.", [primalAction("druid:conduct-wild-rescue", "Conduct a Wild Rescue", "Assess species, stress, injury, restraint, transport, legal authority, specialist care, release habitat, disease, and human safety.")]),
  row("Reclamation Sequence", "Order stabilization, contamination control, soil repair, water, pioneer growth, habitat, access, livelihood, and long monitoring.", [primalAction("druid:plan-land-reclamation", "Plan Land Reclamation", "Create phases, responsibilities, material needs, success measures, failure triggers, public access, and honest limits for damaged land.")]),
  row("Return to Soil", "Release an Autumn-authored wave of enervation and reclamation that weakens active life while returning bounded residue to the surrounding cycle.", [
    seasonalAbility("druid-return-to-soil", "autumn"),
    primalAction("druid:close-the-growing-year", "Close the Growing Year", "Inventory seed, food, soil cover, tools, debts, failures, waste, habitat needs, and unfinished work before winter hides them."),
  ]),
  row("Canopy Weather", "Read how forest height, gaps, leaves, moisture, slope, fire, and edges alter wind, rain, frost, heat, and smoke beneath them.", [primalAction("druid:map-canopy-weather", "Map Canopy Weather", "Record local differences across clearings, edges, ridges, hollows, young growth, and old canopy to guide shelter, planting, and fire planning.")]),
  row("Succession Keeper", "Guide the changing sequence from bare ground through pioneer, thicket, young canopy, maturity, disturbance, and renewed mosaic.", [primalAction("druid:guide-land-succession", "Guide Land Succession", "Choose where to protect, disturb, plant, thin, graze, leave alone, or monitor according to habitat, risk, livelihood, and time.")]),
  row("Transformation Safeguard", "Prepare identity, space, clothing, tools, witnesses, duration, nutrition, injury checks, and return conditions before profound self-change.", [primalAction("druid:prepare-safe-transformation", "Prepare a Safe Transformation", "Write and rehearse the mundane safeguards for a practiced form, including an abort signal and care if the Druid cannot return unaided.")]),
  row("After the Fire", "Coordinate safety, ash, erosion, toxic debris, surviving roots, shelter, water, seed, wildlife, grief, salvage, and future burn pattern.", [primalAction("druid:guide-fire-recovery", "Guide Fire Recovery", "Survey before entry, protect urgent water and slopes, retain living refuges, sequence necessary work, and monitor regrowth rather than planting blindly.")]),
  row("Long Climate Record", "Reconcile instruments, rings, sediment, ice, harvest, travel, disease, species, stories, and changed measurement over generations.", [primalAction("druid:compile-climate-record", "Compile a Climate Record", "Preserve sources, uncertainty, gaps, local consequences, and comparable measures so a long trend is not reduced to one strange season.")]),
  row("Fourfold Stewardship", "Hold Spring renewal, Summer abundance, Autumn return, and Winter restraint together when one urgent need would consume the others.", [primalPassive("druid:fourfold-stewardship", "Fourfold Stewardship", "The Druid can explain a land decision through immediate benefit, seasonal cost, recovery, scarcity, and who must live with the consequence.")]),
  row("Great Year", "Complete the Winter-authored apex of native Druid spellwork, closing one exact seasonal cycle so Spring can begin again without erasing consequence.", [
    seasonalAbility("druid-great-year", "winter"),
    primalPassive("druid:living-year", "Living Year", "Outside combat, the Druid can found and hand on a durable seasonal stewardship with observation, seed, water, habitat, transformation safeguards, decay, disaster preparation, public duties, and long review."),
  ]),
];

if (ROWS.length !== 70) throw new Error(`Druid progression must contain 70 authored levels, received ${ROWS.length}`);
if (new Set(ROWS.map((entry) => entry.feature)).size !== ROWS.length) throw new Error("Druid progression feature names must be unique");

export const DRUID_PROGRESSION_LEVELS = Object.freeze(ROWS.map((entry, index) => Object.freeze({
  level: index + 1,
  ...entry,
})));
