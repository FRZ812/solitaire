# Whitemarch First-Pass Tile Plan

This document translates the Whitemarch district bible into a first playable
city skeleton. It is still planning material, but it is written close enough to
game data that later implementation can copy names, descriptions, and adjacency
logic into `handcrafted-tiles.js`.

For the broader map-scale concern behind this plan, see
`MAP_EXPLORATION_REWORK.md`.

The first pass targets roughly 25-30 meaningful city tiles. The purpose is not
to complete Whitemarch, but to make the city immediately legible: walls, trade,
slavery, law, army, grain, faith, foreign contact, prison, and undercity all
present from the start. Major POIs should use footprints rather than being
compressed into one hex.

## Coordinate Assumption

Final coordinates can change during map rebuild. For planning, put Whitemarch's
central gate at `(0, 0)` in a local city coordinate grid, then translate later
to world coordinates.

Current first implementation anchors Whitemarch around world coordinates
`38,-20` through `44,-23`, keeping the rumored city marker close to the Crown
Gate approach while the market, docks, Chain Ward, low wards, and citadel spread
east and south from it.

Local coordinate convention:

- `x` east-west.
- `y` north-south.
- Adjacent tiles should obey the axial hex movement rules when converted.
- Interior/restricted areas should use `doors` once implemented.

## First-Pass City Map

Approximate local layout:

```text
                                [Dragon-Watch Tower]
                                         |
                        [Wall Walk] -- [Toll Hall] -- [Inspection Yard]
                                         |
                              [Crown Road Approach]

        [East Caravan Yard] -- [Grain Square] -- [Butchers' Row] -- [High Quay]
                  |                 |                |               |
            [Public Stable]   [Cloth Awnings] -- [Coin Scales] -- [Warehouse Row]
                                    |                |
                              [Night Market] -- [Chain Market Steps] -- [Registry Hall]
                                                       |              |
                                             [Tenement Row] -- [Sewer Mouth]

        [Public Smith Row] -- [Guild Court] -- [Lower Petition Steps]
                  |                 |              |
           [Granary Court] -- [Inner Gate] -- [Great Oath Steps]
                                    |
                              [Prison Gate]

                             [Embassy Lane]
```

This sketch prioritizes functional adjacency over visual elegance. The city can
be redrawn later, but these relationships should remain:

- Gate traffic flows into market and caravan yards.
- Grand Market is a footprint, not a single tile.
- Chain Ward touches market, registry, docks, low wards, and undercity access.
- Court and Registry sit close enough that status decisions can become sale or
  imprisonment quickly.
- Arsenal, wall, granary, citadel, and prison form the hard state core.
- Temple and foreign quarter offer limited protection but not freedom from law.

## Tile Summary Table

| Tile | District | Role | Public? | Dominant Power |
|---|---|---|---|---|
| Crown Road Approach | Crown Gate | Arrival road | Yes | Road Wardens |
| Toll Hall | Crown Gate | Payment and papers | Conditional | Gate Clerks |
| Inspection Yard | Crown Gate | Search and sorting | Conditional | Wall Command |
| Wall Walk | Wall Command | Military wall route | Restricted | Wall Command |
| Dragon-Watch Tower | Wall Command | Anti-dragon station | Restricted | Dragon-Watch |
| East Caravan Yard | Caravan Yards | Caravan holding | Yes | Merchant Syndics |
| Public Stable | Great Stable | Mounts and remounts | Yes | Stable Factors |
| Grain Square | Grand Market | Staple food market | Yes | Market Watch |
| Butchers' Row | Grand Market | Meat and offal trade | Yes | Butchers' Guild |
| Cloth Awnings | Grand Market | Cloth, tools, peddlers | Yes | Market Watch |
| Coin Scales | Grand Market | Money changing and valuation | Yes | Money Changers |
| Night Market | Grand Market | Informal/illegal trade | Unofficial | Undercity Networks |
| High Quay | River Docks | Dock and customs | Yes | Dock Factors |
| Warehouse Row | River Docks | Storage and bonded goods | Guarded | Dock Factors |
| Chain Market Steps | Chain Ward | Public sale yard | Yes/guarded | Chain Factors |
| Registry Hall | Chain Ward | Status and labor office | Conditional | Bond Registry |
| Tenement Row | Low Wards | Common housing | Yes | Local gangs/watch |
| Sewer Mouth | Underworks | Hidden descent | Hidden/unsafe | Undercity Networks |
| Public Smith Row | Iron Quarter | Gear and tools | Yes | Iron Guilds |
| Guild Court | Guildhall Row | Licenses and disputes | Conditional | Guild Masters |
| Lower Petition Steps | Court Hill | Legal petitions | Yes | Charter Courts |
| Inner Gate | Citadel Ward | High-city threshold | Restricted | Citadel Guard |
| Great Oath Steps | Temple Steps | Oaths and sanctuary | Yes | Licensed Temples |
| Granary Court | Grain Ward | Food stores | Guarded | Grain Office |
| Prison Gate | Prison | Custody threshold | Restricted | Gaol Wardens |
| Embassy Lane | Foreign Quarter | Foreign compounds | Conditional | Foreign Legations |

The table lists more than 20 tiles because the Grand Market, docks, and wall
defenses should read as footprints. If the first build must be smaller, fold
`Wall Walk` into `Dragon-Watch Tower`, `Warehouse Row` into `High Quay`, and
`Coin Scales` into `Grain Square`; do not reduce the Grand Market below four
tiles.

## Sectioning Pass

All Whitemarch buildings with multiple rooms, service counters, floors, cells,
work areas, or attached yards should be sectioned hexes by default. A section is
smaller than a world tile: it is a room, yard, counter, stair, cell, archive, or
hidden threshold inside the tile. The map still shows the building as one hex,
but the player can occupy meaningful parts of it.

Use sections where position changes authority, access, witnesses, services, or
escape routes. Do not section every decorative room, but do section every
building or compound that clearly contains more than one meaningful part.

First-pass section targets:

| Tile | Sections |
|---|---|
| Toll Hall | Tariff Counter, Papers Queue, Livestock Desk, Guard Rail, Wall Stair |
| Inspection Yard | Search Tables, Confiscation Cart, Dog Run, Sergeant's Awning |
| Dragon-Watch Tower | Lower Watchroom, Harpoon Gallery, Signal Mirror Loft, Bolt Rack |
| Public Stable | Stall Row, Farrier Lane, Fodder Loft, Remount Pen, Tack Room |
| Warehouse Row | Customs-Sealed Door, Guild Chain Door, Cart Ramp, Smuggler Stair |
| Registry Hall | Public Counters, Lease Desk, Collar Archive, Recovery Writ Office |
| Prison Gate | Intake Desk, Chain Room, Family Rail, Work-Gang Side Arch |
| Guild Court | License Counter, Masters' Benches, Fine Ledger Desk, Apprentice Rolls |
| Great Oath Steps | Oath Altars, Hospital Cloister, Sanctuary Rail, Temple Scribe Desk |
| Inner Gate | Permit Arch, Messenger Bench, Guard Room, Inner Portcullis |
| Chain Market Steps | Sale Platform, Petition Rail, Viewing Yard, Collar Stalls, Physician Booth |
| Sewer Mouth | Rusted Grate, Brick Descent, Guide Markings, Drain Junction |
| East Caravan Yard | Hiring Board, Wagon Lines, Guard Fires, Repair Lean-To |
| High Quay | Quay Edge, Crane Line, Customs Awning, River Stairs |
| Holding Yard | Numbered Rails, Water Buckets, Watch Bench, Prison Gate |
| Public Smith Row | Forge Floor, Sales Bench, Work Yard, State Foundry Door |
| Granary Court | Ration Window, Bin Gallery, Rat-Catcher Corner, Seal Room |
| Iron Palace | Outer Hall, Ledger Gallery, Council Room, Treasurer's Office |
| Muster Court | Drill Ground, Weapons Rack, Messenger Door, Officer's Gallery |
| South Wagon-Yard | Wagon Lines, Mule Trough, Load Scale, Factor's Awning |
| Tannery Lane | Soak Vats, Scraping Beam, Drying Yard, Guild Shed |
| Embassy Lane | Interpreter Stalls, Treaty Inn, Compound Gates, Hostage House |
| Outer Slums | Tin-Roof Lane, Cookfire Court, Scrap Shed, Wall Shadow |

Access should be per section. A public tile can still contain restricted
sections, such as a stable's tack room, a gatehouse guard room, or the
Registry's archive doors.

## Tile Details

### Crown Road Approach

District: Crown Gate Ward

Terrain: road

Function: first approach to Whitemarch, outside the main wall but inside its
shadow.

Descriptor draft:

The road widens into trampled stone before Whitemarch's wall. Carts wait in
ranked lines. Oxen steam. Pilgrims sleep against bundles. Above them, the gate
towers rise black and white through chimney smoke, with signal bells hanging
under iron roofs.

Visible details:

- Gate queue by status.
- Wall scale.
- Road Wardens watching travelers before the official inspection.
- Beggars, guides, porters, and paper-sellers.

Hooks:

- A traveler sells false gate papers.
- A northern survivor collapses in the queue.
- A Road Warden asks the player to witness a suspicious wagon.

Future implementation notes:

- Good starting route into the capital.
- Road encounter tables should include clerks, porters, soldiers, refugees,
  false-document sellers, and caravan guards.

### Toll Hall

District: Crown Gate Ward

Terrain: settlement or indoor

Function: toll payment, entry tax, first legal sorting.

Descriptor draft:

The Toll Hall is a long stone throat beneath the gatehouse. Clerks sit behind
barred counters, their ledgers chained to the desks. Every stamp echoes. Every
coin is bitten, weighed, or argued over while guards keep pike points low enough
to remind the crowd that patience is cheaper than injury.

Visible details:

- Chained ledgers.
- Entry tariffs posted by status.
- Separate counters for guild, citizen, foreigner, livestock, and bonded
  traffic.
- Armed clerks' guards.

Hooks:

- The player's coin is short because the rate changed overnight.
- A foreigner's safe-conduct is rejected.
- A clerk recognizes a name from a recovery writ.

Access:

- Public only in the sense that everyone must pass through it.
- Gatehouse interior should use doors when implemented.

### Inspection Yard

District: Crown Gate Ward

Terrain: settlement

Function: searched goods, livestock sorting, contraband discovery, papers
checked under armed supervision.

Descriptor draft:

The Inspection Yard stinks of wet wool, open crates, dung, oilcloth, and fear.
Soldiers prod wagon beds with hooked rods. A bored scribe reads seals aloud.
Travelers stand apart from their belongings while dogs nose the seams and a
gate sergeant decides whose delay will ruin the day.

Visible details:

- Search tables.
- Confiscated goods cart.
- Dogs and hooked rods.
- Wall Command sergeant.

Hooks:

- A smuggled relic is planted in someone's baggage.
- A beast-folk captive's collar plate does not match the manifest.
- A mercenary recognizes the player from an older job.

### Wall Walk

District: Wall Command

Terrain: settlement or indoor

Function: military route along the Great Wall.

Descriptor draft:

The wall walk is broad enough for an ammunition cart and high enough to make the
city sound distant. Scorpions sit under oiled covers between crenels. Soldiers
pace by bell code, pausing only to look north, where every clear sky is treated
as a question.

Visible details:

- Covered scorpions.
- Ammunition lockers.
- Bell-code plaques.
- Restricted stairways.

Hooks:

- A missing bolt count suggests theft.
- A nervous recruit saw something over the northern hills.
- Wall Command needs a deniable messenger.

Access:

- Restricted. Entry through permit, military service, escort, or illegal climb.

### Dragon-Watch Tower

District: Wall Command

Terrain: indoor

Function: anti-dragon station and sky-alarm post.

Descriptor draft:

The Dragon-Watch Tower smells of oil, cold iron, and old smoke. Harpoon frames
point through open shutters. Signal mirrors hang under wool covers. On the
central rack rests a bolt as long as a man, its head blackened by some alchemy
that no one in the room jokes about.

Visible details:

- Harpoon frames.
- Signal mirrors.
- Relic bolt rack.
- Veteran watchers.
- Sky charts and dragon habit records.

Hooks:

- A relic bolt is missing.
- A watcher wants proof that a Frostmaw has shifted territory.
- A noble has bribed someone to hide a dragon-sighting report.

Access:

- Restricted and heavily watched.
- Should connect to Wall Walk and perhaps Arsenal routes later.

### East Caravan Yard

District: Caravan Yards

Terrain: settlement

Function: holding yard for incoming caravans and hired guards.

Descriptor draft:

The East Caravan Yard is a fenced acre of mud, canvas, wagon wheels, and
languages shouted over animals. Drivers cook beside their loads. Guards sleep
with boots on. A hiring board under a rain hood is pinned with work, lies, and
one bloodstained scrap nobody has taken down.

Visible details:

- Hiring board.
- Foreign drovers.
- Wagon repairs.
- Armed caravan guards.

Hooks:

- Escort job east or north.
- Missing driver from a sealed wagon.
- Rumor of direwolves beyond the last bridgefort.

### Public Stable

District: Great Stable

Terrain: settlement

Function: mounts, remounts, pack animals, courier beasts.

Descriptor draft:

The public stable runs hotter than the street. Horses stamp under striped
blankets. Mules bite at gate rails. Farriers burn hoof in blue smoke while a
stable factor argues over whether a courser is lame or merely insulted.

Visible details:

- Mount auction ring.
- Fodder loft.
- Farrier lane.
- Military remount pen behind a locked rail.

Hooks:

- A courier mount is stolen.
- A beast from another region panics at a familiar scent.
- A stable factor offers a cheap mount with a legal complication.

### Grain Square

District: Grand Market

Terrain: settlement

Function: staple food market and central civilian crossroads.

Descriptor draft:

Grain Square is noise given stone. Flour dust drifts from sacks stacked taller
than children. Bakers argue quotas under guard eyes, farmers curse the weighers,
and every crowd watches the bins with the private arithmetic of hunger.

Visible details:

- Grain sacks.
- Weigh platforms.
- Bread sellers.
- Market Watch post.
- Price boards.

Hooks:

- Price riot.
- Poisoned flour.
- A market priest blessing scales for coin.
- A merchant selling news from every direction.

Footprint:

- Parent POI: `whitemarch-grand-market`.
- Adjacent to Butchers' Row, Cloth Awnings, East Caravan Yard, and Chain Market
  approaches.

### Butchers' Row

District: Grand Market

Terrain: settlement

Function: meat, offal, hides, sausage, bones, and animal inspection.

Descriptor draft:

Butchers' Row runs red by noon no matter how often apprentices throw water. Meat
hooks creak under awnings. Dogs nose the gutters until kicked away. A city
inspector marks carcasses with chalk while customers judge freshness by smell,
price, and how hungry they are willing to admit being.

Visible details:

- Meat hooks.
- Gutters.
- Hide barrels.
- Bone sellers.
- Butchers' guild marks.

Hooks:

- Diseased meat covered by a false inspection mark.
- A body part found among animal offal.
- A butcher knows which prison carts came through before dawn.

Footprint:

- Parent POI: `whitemarch-grand-market`.
- Adjacent to Grain Square, Coin Scales, and High Quay.

### Cloth Awnings

District: Grand Market

Terrain: settlement

Function: cloth, tools, peddlers, minor luxuries, cheap gear, and rumor traffic.

Descriptor draft:

The Cloth Awnings turn the market light into stained color. Bolts of wool,
linen, and foreign silk hang beside boot stalls, knife trays, charm strings,
lamp oil, patched cloaks, and peddlers with voices trained to find the coin in
any passerby.

Visible details:

- Dyed cloth.
- Tool stalls.
- Cheap cloaks.
- Peddlers.
- Pickpockets using awning shadows.

Hooks:

- A foreign cloth carries hidden writing.
- A peddler sells a stolen guild token.
- A child thief lifts something from the player's pack.

Footprint:

- Parent POI: `whitemarch-grand-market`.
- Adjacent to Grain Square, Coin Scales, Night Market, and Guild Court routes.

### Coin Scales

District: Grand Market

Terrain: settlement

Function: money changing, valuation, pawning, appraisal, contract witnesses.

Descriptor draft:

The Coin Scales are quieter than the stalls around them. Brass pans click under
the hands of money changers, pawnbrokers, appraisers, and contract witnesses.
Here a thing becomes a price, a price becomes a debt, and debt becomes someone
else's problem.

Visible details:

- Money changer benches.
- Pawnbroker boxes.
- Appraisal weights.
- Armed private guards.
- Quiet brokers watching Chain Ward traffic.

Hooks:

- A debt note is valued like a weapon.
- A broker offers to buy a legal claim on someone.
- Forged coin triggers a public accusation.

Footprint:

- Parent POI: `whitemarch-grand-market`.
- Adjacent to Butchers' Row, Cloth Awnings, Chain Market Steps, and Warehouse
  Row.

### Night Market

District: Grand Market

Terrain: settlement

Function: after-dark informal trade, stolen goods, hidden messages, illegal
medicine, quiet hiring.

Descriptor draft:

By day this lane is only overflow and shuttered backs. By night the lamps are
hooded, the stalls fold open, and the city sells what it denies owning: stolen
tools, false papers, unlicensed charms, names, routes, poisons, and questions
that cost extra if answered honestly.

Visible details:

- Hooded lamps.
- Folding stalls.
- Lookouts.
- False-document sellers.
- Hidden undercity contacts.

Hooks:

- Buy forged papers.
- Hire a sewer guide.
- Hear about an escape route under Chain Ward.
- Get trapped in a Market Watch sweep.

Footprint:

- Parent POI: `whitemarch-grand-market`.
- Adjacent to Cloth Awnings, Chain Market Steps, and Tenement Row.

### High Quay

District: River Docks

Terrain: settlement

Function: main dock and customs landing.

Descriptor draft:

The High Quay stands above brown river water on stone piles dark with tar.
Barges crowd the cranes. Customs officers work beneath armed awnings while dock
gangs haul sacks in rhythm, each man watching the tally stick more closely than
the river.

Visible details:

- Customs house.
- Cranes.
- Dock gangs.
- River chain tower in view.
- Smuggler stairs nearby.

Hooks:

- A barge arrives with dead crew.
- Customs seizes foreign goods after safe-conduct trouble.
- A dock gang hides an escaped person in cargo.

### Warehouse Row

District: River Docks

Terrain: settlement

Function: bonded goods, storage, smuggling cover, customs disputes.

Descriptor draft:

Warehouse Row is a wall of numbered doors and wet rope. Goods wait here between
river, market, court, and theft. Some doors are sealed by customs wax, some by
guild chains, and some by the private locks of people rich enough that no guard
asks what spoils inside.

Visible details:

- Numbered warehouse doors.
- Customs wax.
- Guild chains.
- Cart ramps.
- Quiet guards.

Hooks:

- Confiscated foreign cargo.
- Hidden people in grain bales.
- Smuggler stairs behind a bonded warehouse.

Footprint:

- Parent POI: `whitemarch-river-docks`.
- Adjacent to High Quay, Coin Scales, Registry routes, and Chain Ward traffic.

### Chain Market Steps

District: Chain Ward

Terrain: settlement

Function: public slave sale yard.

Descriptor draft:

The Chain Market Steps are paved in pale stone so stains show quickly and can
be washed before the next bell. Status criers stand on a raised platform.
Buyers wait under awnings. At the petition rail, families press papers through
the bars while guards keep their faces turned toward the crowd.

Visible details:

- Sale steps.
- Petition rail.
- Covered viewing yard.
- Collar stalls.
- Physician inspection booth.
- Chain Factor agents.

Hooks:

- A person on the sale steps claims chartered birth.
- A Chain Factor's private holding yard is robbed.
- An escape-runner asks the player to distract a Flesh Warden.

Tone notes:

- Write it as civic routine, not spectacle for its own sake.
- Let the horror come from ordinary procedure and public indifference.

Footprint:

- Parent POI: `whitemarch-chain-ward`.
- Adjacent to Coin Scales, Night Market, Registry Hall, Tenement Row, and later
  holding-cell/viewing-yard tiles.

### Registry Hall

District: Chain Ward

Terrain: indoor

Function: status rulings, labor leases, collar archive, recovery writs.

Descriptor draft:

Registry Hall is quieter than the market and worse for it. Shelves of bound
status rolls climb into the gloom. Clerks move brass weights from name to name.
A mural over the main counter shows Whitemarch raising a wall; below it, people
argue over whether a seal makes someone free.

Visible details:

- Status rolls.
- Lease counters.
- Collar archive doors.
- Recovery writ board.
- Armed Flesh Wardens.

Hooks:

- Manumission papers are delayed, missing, or forged.
- The player is asked to recover a stolen status roll.
- A foreign embassy contests a seizure.

Access:

- Public counters open.
- Archives and recovery offices restricted.

### Tenement Row

District: Low Wards

Terrain: settlement

Function: dense common housing, labor pools, hiding places.

Descriptor draft:

Tenement Row leans over itself in timber, plaster, laundry rope, and smoke.
Every window has a face until you look directly at it. A public pump knocks in
the courtyard below, and someone has chalked three different warnings beside
the same alley mouth.

Visible details:

- Public pump.
- Pawn stair.
- Cheap cookshop.
- Roof bridges.
- Watch patrol marks.

Hooks:

- Safehouse rumor.
- Missing child.
- Watch raid.
- Food debt.
- Gang toll.

### Sewer Mouth

District: Old City Underworks

Terrain: indoor

Function: first descent into undercity.

Descriptor draft:

The sewer mouth crouches behind a rusted grate below the Low Wards, half-hidden
by broken baskets and old ash. Warm stink breathes from the dark. Someone has
scratched fresh arrows into the brick beside older marks that look less like
directions than warnings.

Visible details:

- Rusted grate.
- Fresh scratches.
- Old brick under newer streetwork.
- Hidden movement.

Hooks:

- Escape route.
- Smuggled goods.
- Plague vault entrance.
- Something has moved up from the old city.

Access:

- Should use doors or special entry once implemented.
- Not a casual road; it is hidden or unlocked by action.

### Public Smith Row

District: Iron Quarter

Terrain: settlement

Function: legal smithing, repairs, common arms and tools.

Descriptor draft:

Public Smith Row rings from dawn to curfew. Sparks skitter across wet stone.
Guild marks hang above each forge. Behind the open shops, higher chimneys mark
the state foundries where no customer is allowed to ask what is being cast.

Visible details:

- Public forges.
- Guild marks.
- Tool racks.
- State foundry smoke.

Hooks:

- Repair and buy gear.
- A collar-smith's apprentice carries forbidden proof.
- A batch of dragon-watch bolts failed inspection.

### Guild Court

District: Guildhall Row

Terrain: indoor or settlement

Function: licenses, craft disputes, apprenticeship law.

Descriptor draft:

The Guild Court is paved in polished slate and surrounded by doors that cost
more than village houses. Masters sit beneath painted tools and speak of honor
while clerks record fines large enough to starve anyone who works without their
permission.

Visible details:

- Guild benches.
- License counters.
- Apprentice rolls.
- Fine ledgers.

Hooks:

- The player needs a license or sponsor.
- An apprentice death is ruled accident too quickly.
- A guild hires deniable help against another guild.

### Lower Petition Steps

District: Court Hill

Terrain: settlement

Function: public approach to courts.

Descriptor draft:

The lower steps of Court Hill are crowded from sunrise: widows with petitions,
debtors with sponsors, merchants with sealed cases, foreigners with interpreters,
and soldiers escorting people who have learned too late that law can move
faster than mercy.

Visible details:

- Petition queues.
- Advocate cloister above.
- Debt collectors waiting.
- Court guards.

Hooks:

- Witness job.
- Wrongful status appeal.
- Debt trap.
- Noble case with public consequences.

### Inner Gate

District: Citadel Ward

Terrain: settlement or indoor

Function: threshold to the high city and state core.

Descriptor draft:

The Inner Gate is smaller than the Crown Gate and harder to pass. Its stones are
older, its guards quieter, its hinges cleaner. Beyond the bars, the city noise
drops away into courtyards where messengers run, officers wait, and every door
has a second guard behind it.

Visible details:

- Citadel guards.
- Restricted passage.
- Messenger traffic.
- War banners.

Hooks:

- Need permit to enter.
- Hostage tower rumor.
- Military summons.
- Treasury or grain-key intrigue.

Access:

- Restricted.
- Door graph important once implemented.

### Great Oath Steps

District: Temple Steps

Terrain: settlement

Function: oaths, sanctuary requests, public ritual.

Descriptor draft:

The Great Oath Steps are worn hollow by knees and court shoes alike. Priests
mark contracts with ash, oil, blood, or salt depending on the god invoked.
Hospital bells ring from the cloister below, and petitioners wait where temple
shade meets city law.

Visible details:

- Oath altars.
- Hospital cloister.
- Pilgrims.
- Temple protection letters.

Hooks:

- Sanctuary dispute.
- Injured fugitive.
- Temple faction asks for help.
- Oath contract has supernatural weight.

### Granary Court

District: Grain Ward

Terrain: settlement

Function: guarded grain stores, ration office, food politics.

Descriptor draft:

Granary Court smells of flour, mouse poison, and soldier oil. Tall bins stand
behind barred galleries. Bakers argue quotas at one window while guards watch
the crowd count sacks with the hungry arithmetic of people who know exactly how
thin bread can get.

Visible details:

- Guarded bins.
- Ration office.
- Bread queue.
- Rat catchers.
- Emergency seals.

Hooks:

- Bread price riot.
- Poisoned flour.
- Grain theft through old tunnels.
- Village tithe dispute.

### Prison Gate

District: Prison And Workhouse

Terrain: settlement or indoor

Function: prison threshold and intake.

Descriptor draft:

The Prison Gate has no ornament except old nail scars. Intake clerks sort names
under a lantern that burns all day. Work gangs leave by the side arch before
dawn and return at dusk, counted twice: once by the gaolers, once by the
Registry man.

Visible details:

- Intake desk.
- Side arch for work gangs.
- Chain room nearby.
- Families waiting with food.

Hooks:

- Visit prisoner.
- Rescue or legal appeal.
- Defeat aftermath location.
- Work gang transfer tied to Registry corruption.

Access:

- Restricted beyond gate.

### Embassy Lane

District: Foreign Quarter

Terrain: settlement

Function: foreign compounds, interpreters, treaty houses.

Descriptor draft:

Embassy Lane smells of unfamiliar tea, horse sweat, incense, and guarded
patience. Flags from distant courts hang beside Whitemarch seals. Interpreters
walk faster than soldiers here, and every compound gate has someone watching
from both sides.

Visible details:

- Treaty inn.
- Foreign counting house.
- Guarded compounds.
- Interpreter stalls.
- Hostage residence.

Hooks:

- Eastern contact.
- Safe-conduct dispute.
- Foreign hostage intrigue.
- Embassy objects to Registry seizure.

## First-Pass NPC/Institution Placements

Use named roles before named individuals if character canon is not settled.

- Crown Road Approach: Road Warden patrol captain, paper seller, refugee family.
- Toll Hall: gate clerk, tariff reader, bored guard.
- Inspection Yard: wall sergeant, search dog handler, confiscation scribe.
- Wall Walk: veteran arbalester, nervous recruit.
- Dragon-Watch Tower: watch captain, arsenal inspector.
- East Caravan Yard: caravan master, mercenary recruiter, foreign drover.
- Public Stable: stable factor, farrier, courier.
- Grand Market: market priest, pickpocket, food seller, Market Watch pair.
- High Quay: customs officer, dock gang boss, ferryman.
- Chain Market: Chain Factor agent, status crier, Flesh Warden, petitioner.
- Registry Hall: status clerk, recovery officer, archive runner.
- Tenement Row: pump elder, gang lookout, safehouse contact.
- Sewer Mouth: sewer guide, corpse carrier, hidden runner.
- Public Smith Row: guild smith, collar-smith apprentice, proofer.
- Guild Court: guild advocate, apprentice sponsor, fine clerk.
- Lower Petition Steps: advocate, debt collector, court guard.
- Inner Gate: citadel guard, messenger, officer's servant.
- Great Oath Steps: temple scribe, hospital sister/brother, oath priest.
- Granary Court: ration clerk, grain guard, rat catcher.
- Prison Gate: gaoler, Registry counter, prisoner family.
- Embassy Lane: interpreter, foreign guard, hostage tutor.

## First-Pass Rumor Lines

These can later feed `rumored.js`, tile-specific context, or NPC dialogue.

- "The Crown Gate rate changed again. Funny how it always changes after a long
  caravan road."
- "Keep your papers dry. Ink runs faster than a guilty man in this city."
- "They rang the Chain Market bell before breakfast. Bad luck to hear it before
  bread."
- "A northern cart came in with claw marks through the axle wood. No horses."
- "The Dragon-Watch covered one of their tower windows. Means they saw something
  they don't want the market counting."
- "A Registry clerk vanished. Not killed, vanished. That means papers."
- "The grain bins are sealed early this year. The bakers are smiling too hard."
- "An eastern envoy bought three interpreters and no guards. Either brave or
  already protected."
- "Someone found an old street under Rat Lane. City says it was always known.
  City lies."
- "If a Flesh Warden asks your name, answer with a patron before a parent."

## Implementation Notes

When converting to actual tiles:

- Keep most public streets open with no `doors`.
- Use `doors` for Toll Hall interiors, Dragon-Watch Tower, Registry archives,
  Inner Gate, Prison Gate, and Sewer Mouth.
- Consider `terrain: "settlement"` for most streets and `terrain: "indoor"` for
  restricted halls/towers.
- Use `poi.type` values like `gate`, `market`, `dock`, `court`, `tower`,
  `stable`, `prison`, `temple`, `hall`, `sewer`, `arsenal`, `granary`.
- Whitemarch should probably occupy a large handcrafted cluster. Do not let
  procedural terrain fill between city districts once the final coordinates are
  chosen.
- The first city pass can be placed compactly, then expanded outward with
  additional wards, alleys, interiors, and undercity routes.
