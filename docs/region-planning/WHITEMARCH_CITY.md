# Whitemarch City Planning Notes

Whitemarch is the central region's capital: a medieval megacity-fortress, trade
hinge, legal machine, military deterrent, and civic predator. This document
breaks the city into districts so later implementation can convert them into
handcrafted tiles, faction records, shop tables, rumors, and narrator context.

For the first playable tile skeleton, see `WHITEMARCH_FIRST_PASS_TILES.md`.

The city should feel too large to know at once. A new arrival understands the
walls first, then the gates, then the price of standing in the wrong queue.

## City Shape

Whitemarch is built around three facts:

- The river crossing.
- The iron road.
- The inner hill.

The river brings barges, fish, tolls, smugglers, flood risk, and foreign goods.
The iron road brings caravans, remounts, military columns, tax wagons, and
refugees. The inner hill holds the oldest walls, the citadel, the courts, and
the granary vaults. Everything else grew around those pressures until the city
became too useful to abandon and too strong to take cheaply.

## Defensive Layout

Whitemarch is not one wall. It is a set of nested enclosures.

### Outer Works

Road forts, ditch lines, cleared killing fields, watch towers, bridge forts, and
patrol stables. These are outside the main wall but inside the city's practical
reach.

### The Great Wall

The main curtain around the lower city. Wide enough for carts on some stretches,
reinforced by squat towers, gatehouses, scorpions, roofed galleries, and stored
fire-fighting gear.

### Ward Walls

Internal walls divide the city during riot, siege, plague, flood, or dragon
alarm. Rich wards call them firebreaks. Poor wards call them cages.

### The High Wall

The inner wall around Court Hill, the Citadel, the War Granaries, and the
restricted arsenal routes. Invasion can breach the Great Wall and still fail at
the High Wall.

### The Underwall

Old foundations, sealed drains, cistern routes, smugglers' cuts, prison tunnels,
and forgotten posterns. The city's official map lies about these.

## District Index

Whitemarch should eventually support many handcrafted tiles. First-pass
implementation can build fewer, but the districts below should remain the
organizing structure.

Important planning rule: major POIs are footprints, not single hexes, and not
menus inside a single hex. A "Grand Market" label should cover several adjacent
member hexes; the player moves through Grain Square, Butchers' Row, Cloth
Awnings, Coin Scales, and Night Market rather than stepping onto one generic
market tile. The same principle applies to gates, docks, citadels, cathedrals,
castles, inns with yards, prisons, and dense undercity spaces. Use `district`
for broad city organization; reserve `parent` for the actual shared POI
footprint.

Suggested city districts:

- Crown Gate Ward
- Caravan Yards
- Grand Market
- Chain Ward
- River Docks
- Iron Quarter
- Guildhall Row
- Low Wards
- Temple Steps
- Foreign Quarter
- Court Hill
- Citadel Ward
- Wall Command
- Noble Rise
- Grain Ward
- Great Stable
- Prison And Workhouse
- Old City Underworks

## Crown Gate Ward

The main landward entry and the player's most likely first view of Whitemarch.
The wall is the district's skyline: black stone, white mortar, hanging banners,
signal bells, murder holes, toll lamps, and tower crews watching every cart.

Purpose:

- Inspect people and goods.
- Collect tolls.
- Register arrivals.
- Turn road traffic into city order.
- Let the player feel Whitemarch before entering it.

Daily texture:

- Long queues by status: citizens, merchants, guild wagons, soldiers, pilgrims,
  foreigners, livestock, bonded labor, and the paperless.
- Clerks calling names from damp ledgers.
- Guards using pike shafts to separate crowds.
- Money changers working under wall-shadow.
- Beggars who know which gate officer is kind.
- Porters waiting to carry luggage before thieves do.
- Watch bells marking inspection shifts.

Likely tiles:

- Crown Road Approach
- Outer Queue Ground
- Toll Hall
- Inspection Yard
- Gatehouse Underpass
- Wall Stairs
- First Market Under The Wall

Adventure use:

- Good place for first city contact.
- Good place to introduce papers, tolls, prejudice, and rumors.
- Good place for a small legal problem before any combat problem.

## Caravan Yards

Walled yards just inside the gate where goods, beasts, drovers, guards, and
foreign merchants are sorted before entering the deeper city. The smell is dung,
wet canvas, hot axle grease, cheap stew, and tired money.

Purpose:

- Hold caravans overnight.
- Hire guards and guides.
- Repair wheels, harness, crates, and contracts.
- Keep strangers useful but contained.

Daily texture:

- Mule lines and ox teams.
- Armed company men waiting for work.
- Drivers sleeping under wagons.
- Scribes translating bills.
- Foreign drovers cooking separately.
- Guild inspectors marking goods for legal sale.
- Children running water for copper.

Likely tiles:

- East Caravan Yard
- West Caravan Yard
- Wagon Repair Shed
- Weigh House
- Drovers' Cookfires
- Guard Hiring Board
- Foreign Beasts Pen

Adventure use:

- Escort contracts.
- Lost goods.
- Forged manifests.
- Foreign contacts.
- Rumors from every direction.

## Grand Market

The public stomach of the city. It should be large, loud, crowded, and
impossible to fully police. It is where a player can buy ordinary supplies,
hear dangerous rumors, meet contacts, get pickpocketed, and see Whitemarch's
order cracking under its own scale.

Purpose:

- Sell food, tools, cloth, medicine, gear, beasts, minor weapons, licenses, and
  practical services.
- Convert regional goods into coin.
- Bring every social class into uncomfortable proximity.

Daily texture:

- Grain dust in sunbeams.
- Butchers rinsing gutters.
- Cloth awnings snapping in wind.
- Fishmongers shouting over bell-metal sellers.
- Apprentices carrying sample boards.
- Watchmen pretending not to see illegal deals.
- Priests blessing scales for a fee.
- Pickpockets using crowd crush as weather.

Likely tiles:

- Grain Square
- Butchers' Row
- Cloth Awnings
- Tool Stalls
- Coin Scales
- Night Market Alley
- Public Wells
- Market Watch Post

Adventure use:

- Core supply area.
- Low-stakes crime.
- Social encounters.
- Public unrest.
- Rumors about prices, war, grain, slavery, and dragons.

## Chain Ward

The ward where Whitemarch's slave economy is most visible. It sits between the
Grand Market, River Docks, Bond Registry, and work routes to the Iron Quarter.
The respectable city calls it necessary. Everyone knows where it is.

Purpose:

- Conduct legal slave sales.
- Hold and inspect captives, debt-bound people, penal laborers, and lease slaves.
- Connect brokers, courts, guild buyers, military quartermasters, and estate
  factors.
- Supply labor to docks, quarries, foundries, households, roads, and farms.

Daily texture:

- Sale bells rung by court clerks.
- Status criers reading names, origins, skills, debts, marks, and terms.
- Collar-smiths riveting numbered plates.
- Physicians checking teeth, scars, limbs, fever, and work value.
- Families pressed against petition rails.
- Brokers speaking softly behind screens.
- Guards moving people before crowds can gather too long.
- Escape-runners watching drains, carts, and sympathetic servants.

Likely tiles:

- Chain Market Steps
- Covered Viewing Yard
- Status Criers' Platform
- Collar Stalls
- Physician's Inspection Booth
- Guild Buyers' Arcade
- Family Petition Rail
- Guarded Holding Cells
- Broker Counting Room
- Drain Gate

Named powers:

- Office of Bonds, Status, and Civic Labor
- Chain Factors
- Collar-Smiths
- Flesh Wardens
- Escape-runners
- Temple petitioners
- Foreign protection clerks

Adventure use:

- Wrongful status cases.
- Escape attempts.
- Recovery writs.
- Broker rivalries.
- Falsified papers.
- Noble hypocrisy.
- Guild labor demand.

## River Docks

The river face of Whitemarch. It is almost a second city: lower, wetter, louder,
less patient with law unless law has a badge and backup.

Purpose:

- Bring goods by barge.
- Control ferries and river chains.
- Collect customs.
- Move grain, timber, fish, prisoners, stone, and contraband.

Daily texture:

- Tar, rope, mud, fish scales, and river fog.
- Cranes groaning above barges.
- Customs clerks under armed awnings.
- Dock gangs hauling sacks in rhythm.
- River priests marking flood levels.
- Smugglers using legitimate noise as cover.
- Bodies occasionally found in pilings and explained as accident.

Likely tiles:

- High Quay
- Low Fish Dock
- Customs House
- River Chain Tower
- Warehouse Row
- Smuggler Stairs
- Ferry Steps
- Flood Gate

Adventure use:

- Smuggling.
- Foreign arrivals.
- Missing cargo.
- River monsters.
- Dock labor unrest.
- Escape routes.

## Iron Quarter

The district of heat, smoke, noise, and state violence. Public smiths work near
guild halls; deeper inside are foundries, arsenal gates, siege sheds, proofing
yards, and dragon-defense stores.

Purpose:

- Make tools, weapons, armor, chain, fittings, bolts, nails, engines, and city
  hardware.
- Keep Whitemarch militarily credible.
- Supply the walls and roads.

Daily texture:

- Bellows breathing like beasts.
- Charcoal dust in every wrinkle.
- Hammer rhythm from dawn to curfew.
- Guild marks stamped into iron.
- Proofers testing blades and bow arms.
- State inspectors counting bolts.
- Labor columns moving ore, coal, lime, and slag.

Likely tiles:

- Public Smith Row
- Foundry Court
- Guild Proofing Yard
- Arsenal Gate
- Siege Engine Shed
- Relic Bolt Vault Approach
- Charcoal Court
- Slag Canal

Adventure use:

- Gear shopping.
- Sabotage.
- Stolen dragon-watch munitions.
- Labor exploitation.
- Guild secrets.
- Military contracts.

## Guildhall Row

Respectable stone facades where economic power dresses itself as craft order.
Guildhall Row should feel cleaner than the Iron Quarter and more dangerous in
paper.

Purpose:

- Issue licenses.
- Control apprenticeships.
- Fix prices.
- Arbitrate trade disputes.
- Exclude unlicensed workers.
- Bribe law into policy.

Daily texture:

- Carved signs above polished doors.
- Apprentices in rank-colored caps.
- Masters pretending not to count political favors.
- Petitioners waiting outside in work clothes.
- Disputes settled in rooms with no witnesses.
- Feast banners after a guild has just ruined someone.

Likely tiles:

- Mercers' Hall
- Smiths' Hall
- Teamsters' Hall
- Scribes' Hall
- Guild Court
- Apprentice Dormitory Lane
- License Office
- Masters' Feast House

Adventure use:

- Training access.
- Craft services.
- Economic sabotage.
- Apprentice disputes.
- Licensed versus illegal labor.
- Social advancement.

## Low Wards

Dense common housing, cheap food, day labor, pawn shops, illegal shrines,
tenements, roof bridges, public pumps, and people with more knowledge than
protection. The Low Wards are not only misery. They are also memory, mutual aid,
gang power, jokes, sickness, fire risk, and a thousand private economies.

Purpose:

- House workers, migrants, servants, porters, apprentices, and the unwanted.
- Absorb shocks the rich wards refuse to see.
- Hide people who know how to be hidden.

Daily texture:

- Laundry ropes across alleys.
- Public pumps with long lines.
- Thin soup and fried scraps.
- Children warning each other about watch patrols.
- Pawn brokers with saint icons over ledgers.
- Rookeries of sleeping rooms above workshops.
- Fires that spread faster than law.

Likely tiles:

- Tenement Row
- Public Pump
- Pawn Stair
- Cheap Cookshop
- Rat Lane
- Hidden Chapel
- Roof Bridge
- Back-Court Well

Adventure use:

- Safehouses.
- Street gangs.
- Informants.
- Disease.
- Food riots.
- Missing persons.
- Hidden kindness.

## Temple Steps

Whitemarch regulates faith because faith can feed, heal, bury, riot, or crown.
The district rises by steps toward old shrines, licensed temples, hospitals,
funerary offices, oath houses, and charitable institutions with sharp ledgers.

Purpose:

- Manage oath, burial, healing, festival, sanctuary, and public grief.
- Keep religious factions close enough to watch.
- Provide social legitimacy to law and war.

Daily texture:

- Incense over blood and boiled bandages.
- Pilgrims sleeping under colonnades.
- Funeral bells competing with market bells.
- Priests arguing jurisdiction over a corpse.
- Temple scribes writing protection letters.
- Charity lines sorted by status.

Likely tiles:

- Great Oath Steps
- Pale Chapel
- War Shrine
- Hospital Cloister
- Funerary Gate
- Pilgrim Dormitory
- Temple Kitchen
- Relic Court

Adventure use:

- Healing.
- Sanctuary.
- Status protection.
- Religious intrigue.
- Burial mysteries.
- Hidden escape networks.

## Foreign Quarter

A regulated district for envoys, merchants, translators, hostage delegations,
foreign temples, guarded compounds, treaty inns, and spies everybody politely
pretends are clerks.

Purpose:

- Let other regions touch Whitemarch without letting them dissolve into it.
- Host embassies and merchant houses.
- Provide a future bridge to eastern, southern, western, and northern content.

Daily texture:

- Different calendars posted on the same wall.
- Interpreters making more money than soldiers.
- Guards protecting compounds from both locals and homesick guests.
- Foreign cooks drawing crowds.
- Treaty flags repaired after drunken insults.
- Hostages studying the city they may someday fight.

Likely tiles:

- Embassy Lane
- Treaty Inn
- Interpreter Court
- Foreign Counting House
- Guarded Compound
- Tea House
- Spice House
- Hostage Residence

Adventure use:

- Diplomatic hooks.
- Foreign rumors.
- Safe-conduct disputes.
- Cultural contact.
- Spies.
- Eastern-region foreshadowing.

## Court Hill

The hill where Whitemarch turns conflict into documents. The courts should feel
old, expensive, crowded, and frighteningly calm.

Purpose:

- Rule on debt, personhood, inheritance, trade, guild law, foreign status,
  military obligations, and treason.
- Give the city a way to call violence lawful before anyone draws a blade.

Daily texture:

- Petitioners on wet steps.
- Advocates in stained cuffs.
- Clerks who remember every missing seal.
- Witnesses rehearsing lies.
- Debt collectors waiting after verdicts.
- Soldiers escorting people from a ruling directly into custody.

Likely tiles:

- Lower Petition Steps
- Clerk Hall
- Debt Court
- Charter Court
- Noble Hearing Room
- Execution Warrant Office
- Advocate Cloister
- Status Archive

Adventure use:

- Legal status quests.
- Debt and inheritance.
- Trials.
- Witness protection.
- Contract enforcement.
- Political traps.

## Citadel Ward

The inner hardpoint: council, treasury, war room, hostage tower, old keep, and
the administrative spine. It is less beautiful than secure.

Purpose:

- Hold command authority.
- Protect treasury and emergency grain keys.
- House hostages and high prisoners.
- Coordinate defense and policy.

Daily texture:

- Iron-banded doors.
- Wardens who do not joke.
- Courtyards swept clean enough to show blood.
- Messengers moving at a controlled run.
- Councilors arriving with private guards.
- Quiet rooms where maps matter more than people.

Likely tiles:

- Inner Gate
- Muster Court
- Council Hall
- Treasury Passage
- Hostage Tower
- War Room
- Charter Vault
- Inner Chapel

Adventure use:

- High politics.
- Military commands.
- Noble hostage plots.
- Treasury theft.
- Siege decisions.

## Wall Command

The military district attached to the walls, towers, bell codes, dragon-watch
stations, arbalest stores, signal crews, and barracks courts.

Purpose:

- Keep the walls operational.
- Train troops.
- Maintain dragon deterrence.
- Crush major internal disorder if ordered.

Daily texture:

- Boots on stone stairs.
- Oilcloth over siege engines.
- Alarm drills that stop conversation across a ward.
- Veterans measuring sky by habit.
- Dragon-watch crews gambling under covered harpoons.
- Quartermasters counting bolts twice.

Likely tiles:

- Wall Stair
- Bell Tower
- Archer Walk
- Barracks Court
- Drill Yard
- Dragon-Watch Tower
- Bolt Magazine
- Signal Mirror Roof

Adventure use:

- Military service.
- Dragon alarms.
- Stolen munitions.
- Wall access.
- Riot response.
- Veteran contacts.

## Noble Rise

The high residential ward below the Citadel, where old houses turn commerce
into lineage and call it dignity.

Purpose:

- House noble families, high officials, patrons, private chapels, guarded
  gardens, and marriage politics.
- Provide social ambition, hypocrisy, and patronage.

Daily texture:

- Carriages behind iron gates.
- Servants using side stairs.
- Private guards in family colors.
- Garden walls hiding debts.
- Soft music over hard negotiations.
- Young nobles bored enough to be dangerous.

Likely tiles:

- Noble Gate
- Garden Court
- Major House Front
- Dueling Arcade
- Servants' Lane
- Private Chapel
- Marriage Hall
- Patron's Salon

Adventure use:

- Patronage.
- Duels.
- Scandals.
- House rivalries.
- Hidden slave ownership.
- Political marriages.

## Grain Ward

The true heart of the city. Whitemarch can survive because it stores grain at
scale and protects those stores like a temple and arsenal combined.

Purpose:

- Store grain.
- Control rationing.
- Stabilize bread prices.
- Feed army and city during siege.
- Make famine political rather than immediate.

Daily texture:

- Flour dust and guarded silence.
- Sealed emergency bins.
- Clerks weighing sacks under soldier eyes.
- Rat catchers paid by tail.
- Bakers arguing quotas.
- Crowds counting loaves before riots begin.

Likely tiles:

- Granary Court
- Weighing Hall
- Guarded Bins
- Miller's Lane
- Ration Office
- Vermin Cellar
- Bread Queue
- Emergency Stores

Adventure use:

- Food riots.
- Poisoning.
- Theft.
- Siege preparation.
- Corruption.
- Hidden tunnels.

## Great Stable

The city's ground-speed economy. Horses, mules, oxen, courier beasts, foreign
mounts, military remounts, fodder contracts, farriers, and stable politics.

Purpose:

- Support road trade.
- Supply military remounts.
- Sell, lease, inspect, and stable mounts.
- Feed courier and patrol networks.

Daily texture:

- Hot animal breath.
- Fodder dust.
- Farriers burning hoof.
- Couriers sleeping in tack rooms.
- Remount officers rejecting expensive lies.
- Stable boys knowing which lord beats horses.

Likely tiles:

- Public Stable Yard
- Military Remount Pen
- Farrier Lane
- Fodder Loft
- Mount Auction Ring
- Courier Post
- Ox Yard
- Vet Shed

Adventure use:

- Mount acquisition.
- Courier jobs.
- Stolen horses.
- Military requisition.
- Exotic mount rumors.

## Prison And Workhouse

Whitemarch does not waste prisoners if it can use them. The prison and workhouse
touch the courts, Registry, wall labor, and public punishment system.

Purpose:

- Hold criminals, debtors, spies, political prisoners, and condemned labor.
- Feed penal labor into city works.
- Provide a pressure valve for law.

Daily texture:

- Iron doors sweating rust.
- Intake clerks sorting people faster than names.
- Families waiting with food that guards may take.
- Work gangs chained in pairs.
- Chaplains who have heard every last-minute innocence.
- Old cells below the legal ones.

Likely tiles:

- Prison Gate
- Intake Hall
- Workhouse Yard
- Chain Room
- Gaol Chapel
- Old Oubliette
- Sentence Yard
- Prison Kitchen

Adventure use:

- Rescue.
- Imprisonment aftermath.
- Prison labor.
- Legal consequences.
- Political prisoners.
- Underworks access.

## Old City Underworks

The city beneath the city: sewers, cisterns, buried streets, old foundations,
plague pits, sealed shrines, guild vaults, smuggler cuts, and routes no official
map wants to admit.

Purpose:

- Give the central city exploration danger.
- Connect districts through hidden routes.
- Preserve older history beneath civic order.
- Support smuggling, escapes, disease, monsters, and buried secrets.

Daily texture:

- Dripping brick.
- Blind fish in cistern water.
- Old street signs below new streets.
- Rusted grates with fresh scratches.
- Offerings left where no temple claims them.
- Echoes that are not always rats.

Likely tiles:

- Sewer Mouth
- Main Drain
- Cistern Chamber
- Old Street Below
- Plague Vault
- Buried Shrine
- Guild Smuggler Door
- Flooded Tunnel
- Forgotten Postern
- Deep Well

Adventure use:

- Dungeon-style exploration inside the capital.
- Escape routes.
- Hidden cults.
- Old city lore.
- Plague hazards.
- Monster nests.
- Guild secrets.

## District Adjacency

Suggested rough adjacency for later map layout:

- Crown Gate touches Caravan Yards, Grand Market, Wall Command, and road exits.
- Caravan Yards touch Crown Gate, Grand Market, Chain Ward, and Foreign Quarter.
- Grand Market touches Crown Gate, Caravan Yards, Chain Ward, Guildhall Row, Low
  Wards, and River Docks.
- Chain Ward touches Grand Market, Bond Registry/Court Hill approaches, River
  Docks, Iron Quarter work routes, and Low Wards.
- River Docks touch Grand Market, Chain Ward, Grain Ward, Low Wards, and river
  exits.
- Iron Quarter touches Guildhall Row, Chain Ward, Wall Command, Great Stable,
  and arsenal-restricted routes.
- Guildhall Row touches Grand Market, Iron Quarter, Court Hill, and Noble Rise.
- Low Wards touch Grand Market, River Docks, Chain Ward, Temple Steps, and
  Underworks entrances.
- Temple Steps touch Low Wards, Noble Rise, Court Hill, and hidden safehouse
  routes.
- Foreign Quarter touches Caravan Yards, Grand Market, Noble Rise, and docks by
  guarded streets.
- Court Hill touches Guildhall Row, Temple Steps, Chain Ward offices, Citadel
  Ward, and Noble Rise.
- Citadel Ward touches Court Hill, Wall Command, Grain Ward, and restricted
  military passages.
- Wall Command touches Crown Gate, Iron Quarter, Citadel Ward, and wall walks.
- Noble Rise touches Guildhall Row, Temple Steps, Court Hill, Foreign Quarter,
  and Citadel approaches.
- Grain Ward touches River Docks, Citadel Ward, Great Stable, and guarded store
  roads.
- Great Stable touches Caravan Yards, Iron Quarter, Grain Ward, and road exits.
- Prison And Workhouse touch Court Hill, Chain Ward, Wall Command, and
  Underworks.
- Old City Underworks can surface under any ward, but stable entrances should be
  limited and intentional.

## First-Pass Tile Priority

For an initial playable Whitemarch, build enough tiles to communicate scale
without completing every ward.

Priority set:

- Crown Road Approach
- Toll Hall
- Inspection Yard
- East Caravan Yard
- Grand Market Grain Square
- Chain Market Steps
- Registry Hall
- High Quay
- Public Smith Row
- Guild Court
- Tenement Row
- Great Oath Steps
- Embassy Lane
- Lower Petition Steps
- Inner Gate
- Dragon-Watch Tower
- Granary Court
- Public Stable Yard
- Prison Gate
- Sewer Mouth

This creates a 20-tile first city that can later expand to 40-60 without
changing the concept.

## Descriptor Style

Whitemarch descriptors should be dense with function. Every description should
answer at least one of these questions:

- What is being bought, counted, guarded, moved, punished, stored, forged, or
  hidden here?
- Which institution owns the space?
- Who is allowed to stand comfortably here?
- Who is watched?
- What sound tells you where you are?
- What smell tells you where you are?
- What visible detail proves the city is rich?
- What visible detail proves the city is cruel?
- What visible detail proves the city is afraid?

The city should feel complete because every ward has a job.
