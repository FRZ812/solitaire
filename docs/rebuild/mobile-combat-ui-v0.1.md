# Solitaire — Mobile Combat UI Redesign v0.1

**Status:** implementation-ready direction for the clean-room Godot combat screen
**Reference frame:** 432×768 portrait logical pixels
**Applies to:** `game/` only

## 1. Interface identity

The combat interface is a **Whitemarch company field folio**: a compact command instrument issued by a prosperous river city, not a stone shrine, game website, or fantasy jewelry box. Quiet limewashed vellum carries native text; river-blue rules organize information; deep slate gives controls weight; small brass pins mark commitment. Generated oil-brush texture is visible at edges and on icons, while every reading surface remains calm.

The verified 432×768 runtime composition is preserved at `reference/mobile-combat-ui-runtime-final.png`; the earlier generated composition study remains a style reference rather than a shippable screen.

The tactical field remains the dominant image. UI art supports grounded late-medieval equipment and civic craft without making danger grimdark. No SVG, pixel art, photorealistic chrome, Gothic spikes, glowing filigree, or rasterized text is permitted.

## 2. Reference portrait hierarchy

Measurements below are in the 432×768 reference space after conversion from the project viewport. If the internal scene remains 720×1280, multiply measurements by 5/3. Build this with anchored containers and minimum sizes rather than fixed global positions.

| Layer / band | Reference bounds | Purpose |
|---|---:|---|
| World viewport | `x 0–432, y 0–768` | Continues behind translucent edge shadows; camera composes the playable grid inside the unobscured field rect. |
| Top field band | `x 0–432, y 0–52` | Location, objective/pulse line, one 48×48 menu target. |
| Unobscured field | `x 0–432, y 52–520` | 468 px, or 61% of the reference height. No permanent captions or panels cover this area. |
| Field touch rect | `x 0–432, y 52–508` | Board input stops at the command dock; no tap may pass through the dock shadow. |
| Command dock | `x 0–432, y 508–768` | 260 px including a 12 px overlap/shadow and 12 px minimum bottom inset. |
| Active context rail | `x 12–420, y 508–556` | Acting unit, condition, pulse, chronicle entry point. |
| Forecast card | `x 12–420, y 556–620` | Instruction or concise consequences for the proposed command. |
| Action tray | `x 12–420, y 620–698` | Current command families. |
| Commitment row | `x 12–420, y 698–756` | Cancel and one contextual commit button. |
| Bottom breathing room | `x 0–432, y 756–768` | Minimum 12 px; replaced by the device safe-area inset when larger. |

The top field band and command dock are overlays; the 3D world should not end in a differently colored rectangle behind either one. The field camera must keep all legal targets inside `y 60–500` and at least 12 px from the horizontal edges.

### Safe-area and compact rules

- Root content respects `DisplayServer.get_display_safe_area()`; use at least 12 px internal padding even when the reported inset is zero.
- A system top inset is added above the 52 px field band. A bottom inset replaces, rather than stacks with, the 12 px bottom breathing room.
- At heights below 720 logical px, use the compact profile: 44 px top band, 44 px context rail, 56 px forecast, 72 px action tray, and 52 px commitment row. Do not shrink interactive targets or text.
- At taller ratios, the dock stays fixed and the field grows. Do not scale the dock up until controls look like a tablet UI.

## 3. Band contents

### Top field band

- Left block (`x 16–360`): title-case location at 18 px, then a single 12 px line: `Reopen the winter road · Pulse 1`.
- Right block (`x 372–420`): one 48×48 overflow/pause target.
- Save, load, restart, diagnostics, settings, and surrender live in the pause sheet. Standard play autosaves accepted commands; it does not expose save/load as equal combat actions.
- The band is deep slate at 92% opacity with a 1 px river-blue lower rule. It has no ornate frame.

### Active context rail

- `x 16–56`: dedicated 40×40 bust portrait; tap opens character inspection.
- `x 64–254`: acting character name (15 px semibold) and role/weapon (12 px).
- `x 262–364`: native HP bar plus one highest-priority condition chip. Additional conditions are summarized as `+N` and open inspection on tap.
- `x 372–420`: 48×48 chronicle button with an unread dot when new events exist.
- The rail shows the actor whose pulse is resolving, not whichever unit was most recently inspected. A thin brass notch and the words `Your command` or `Foe acting` distinguish ownership without relying on color.

### Forecast card

The forecast is always one 64 px card; its content changes state without moving the field or tray.

1. **Idle:** one instruction, such as `Choose a command.` No empty ornamental space.
2. **Command selected:** command plus target instruction, such as `Move · choose a marked tile.` Commit remains disabled.
3. **Valid proposal:** first line is `Erran → Move → 3 tiles` or `Maud → Shoot → Odo Pell`. Second line uses at most four native chips: `78% HIT`, `3–5 HARM`, `COVER 1`, `1 PULSE`.
4. **Invalid proposal:** concise cause in a madder-outlined card, for example `Blocked by the collapsed wall.` Commit remains disabled.
5. **Resolving/enemy pulse:** controls lock, the card names the action being resolved, and no indefinite spinner is used.

Known values use plain labels, estimates use `~`, and unknown values use `?`. Color supplements those symbols; it never replaces them. Forecast prose is capped at two lines. Longer rule explanations open an inspection sheet.

### Action tray

- The tracer uses four equal 96×72 targets with 8 px gaps: **Move**, **Attack**, **Guard**, **Wait**. Do not display a dead Pack placeholder before item use exists.
- The full RPG uses five stable command families—**Move**, **Attack**, **Guard**, **Pack**, **Wait**—at approximately 75×72 each. Once Pack ships, these five positions do not reorder between actors; unavailable commands remain visible with a short inspectable reason.
- Each target contains a 30–34 px generated raster icon above a 13 px native label.
- Tapping a command selects a mode and updates field markers. Tapping it again returns to idle. Long-press opens its mechanical definition.
- Selected state uses a 2 px brass outline, an upper selection notch, and a visibly inset surface in addition to civic-blue color.
- **Guard and Wait never resolve directly from this row.** They produce a forecast and require commitment like movement and attacks.
- `Wait` is the player-facing label for yielding one tactical pulse; the domain command may remain `end_turn`.

### Commitment row

- Left: 64×52 **Cancel** target. It clears the proposal but not the selected actor.
- Right: 336×52 primary button with contextual native copy: `Commit move`, `Commit attack`, `Take guard`, or `Wait one pulse`.
- The 8 px gap and size difference establish one obvious commitment path. Reset, load, and diagnostic controls never compete in this row.
- Disabled commitment is indicated by reduced contrast plus a lock/not-ready mark and accessible state text, not opacity alone.

## 4. Interaction sequence

The single combat grammar is **select command → choose/inspect target → read forecast → commit**.

- Selecting Move shows reachable cells; selecting a cell previews the complete route and cost.
- Selecting Attack marks only legal targets. Target selection previews line of sight, range, cover, hit estimate, harm range, and known reactions.
- Selecting Guard or Wait creates a target-free proposal whose consequence is still forecast before commitment.
- A new target replaces the proposal; Cancel removes it; changing command mode removes incompatible markers.
- After commit, the tray locks until deterministic events finish. A short result toast appears above the context rail and the event is appended to the chronicle.
- During a foe pulse, the same context and forecast surfaces show the acting foe and any legitimately known intent. Player action controls remain present but clearly locked, preventing layout jumps.
- Victory or defeat replaces the action and commitment rows with one outcome strip and primary `Continue` / secondary `Review chronicle`; restart remains a pause/debug choice.

Projected board cells should be at least 44 px wide at default zoom. Their touch query region must be at least 48×48 and must resolve overlapping actor/terrain choices through an inspection chooser rather than requiring pixel-perfect taps.

## 5. Chronicle behavior

The chronicle is evidence, not a permanent chat panel.

- On resolution, a 40 px one-line toast sits at `x 12–420`, immediately above the dock, for 2.5 seconds. It can be tapped to open the chronicle and must not intercept board input after fading.
- The rail's chronicle target opens a bottom sheet from `y 216` to the safe bottom. Combat input pauses while the sheet is open; simulation time does not advance.
- Header is 48 px with `Combat chronicle`, current pulse, and a 48×48 close target.
- Event rows are at least 48 px high: 32 px portrait/status icon, pulse/actor metadata at 12 px, result at 14 px. Group rows by pulse and preserve deterministic event order.
- The initial view shows mechanical facts. Optional generated narration, if later enabled, is subordinate expandable copy and never replaces damage, condition, movement, or cost facts.
- The latest read position and scroll position persist when the sheet closes. New-event state is cleared only after the corresponding row has been visible.
- State hashes, event IDs, and RNG stream names are developer diagnostics behind a debug toggle; they are not permanent player-facing footer text.

## 6. Type system

All text is native Godot `Label`, `RichTextLabel`, or `Button` content. Do not generate text into any bitmap.

Use Source Serif 4 Semibold for location/sheet titles and Source Sans 3 for all operational text, bundled as font resources with an audited fallback. Until those fonts are packaged, use the Godot default sans rather than raster substitutes or faux-medieval display type.

| Role | Size / line | Weight |
|---|---:|---|
| Location / sheet title | 18 / 22 | Semibold, title case |
| Forecast action / actor name | 15 / 19 | Semibold |
| Body / chronicle result | 14 / 18 | Regular |
| Action button label | 13 / 16 | Semibold |
| Metadata / chips | 12 / 15 | Medium; tabular numerals where available |

No combat text is smaller than 12 px. Support 115% text scale without clipping forecast values or action labels; the forecast may grow to 80 px and take space from the unobscured field in accessibility mode. Maintain at least 4.5:1 contrast for normal text and 3:1 for large text and control boundaries.

## 7. Palette and material rules

| Role | Color |
|---|---|
| Vellum reading field | `#F1E8D1` |
| Limewash secondary surface | `#E8E1CB` |
| Ink | `#172329` |
| Deep slate structure | `#25345D` |
| Civic blue selection | `#405A70` |
| River-blue rule / information | `#5E89A6` |
| Muted brass commitment | `#B58A44` |
| Plant green favorable state | `#70845C` |
| Madder warning | `#9B4F43` |
| Coral immediate danger only | `#E66B65` |

- One material family covers every combat surface: quiet painted vellum, narrow slate edge, river-blue ruling, and restrained brass fastening.
- Painterly variation is concentrated in the outer 12–16 px of scalable surfaces. Text centers remain low-contrast and free of knots, scratches, mortar blocks, or highlights.
- Normal action buttons are limewash with ink; selected buttons are civic blue with pearl text and brass outline; pressed buttons are deep slate with a 1 px downward shift. Primary commit is deep slate with a brass upper rule.
- Black Whitemarch stone appears only as a narrow edge color. It must not become a thick masonry frame around reading content.
- Shadows are soft and functional: maximum 2 px offset, 8 px blur, roughly 24% ink. No beveled gold slabs, giant corner plates, jeweled tabs, leather-book clichés, or glowing ordinary controls.

## 8. Generated raster asset requirements

Generate new UI assets for this system; do not stretch the current monolithic HUD panel or its 2×2 icon sheet into the redesign. Preserve high-resolution source masters and export the following lossless RGBA runtime atlases.

### `ui-command-surfaces-whitemarch-v1.png`

Runtime atlas: 1024×1024. Source master: at least 2048×2048. No text, symbols, crests, or baked data.

| Region `(x,y,w,h)` | Asset | Nine-slice margin |
|---|---|---:|
| `0,0,512,256` | command dock | 32 px |
| `512,0,512,256` | forecast card | 24 px |
| `0,256,512,128` | context rail | 24 px |
| `0,384,512,128` | commit surface | 24 px |
| `512,256,512,256` | chronicle sheet | 32 px |
| `0/256/512/768,512,256,128` | action normal / selected / pressed / disabled | 24 px |
| `0/256/512/768,640,256,128` | utility normal / selected / pressed / disabled | 24 px |
| `0/128/256/384,768,128,128` | neutral / favorable / warning / danger chip | 16 px |
| `512,768,512,128` | event toast | 24 px |
| `0,896,512,128` | ruled divider | 16 px |
| `512,896,256,128` | turn badge | 16 px |
| `768,896,256,128` | notification badge | 16 px |

Corners must survive the shortest 48 px runtime control without colliding. Every scalable center must be flat enough to tile/stretch invisibly.

### `ui-action-icons-whitemarch-v1.png`

Runtime atlas: 1024×512, eight 256×256 cells in a 4×2 grid; source master at least 2048×1024. Transparent background, 16% clear padding, common three-quarter lighting, common visual weight, and no baked button tile.

Cells: Move (plain leather turnshoe), Attack (measured weapon strike; allow equipped-weapon substitution), Guard (functional painted shield/guarded shaft), Pack (linen field satchel), Wait (sandglass), Cancel (released knot or plain cancel mark), Chronicle (vellum field ledger), Menu (three restrained brass pins). Subjects follow Whitemarch 1400–1475 material rules and the oil-brush painterly 2D anime rendering contract.

### `ui-status-icons-whitemarch-v1.png`

Runtime atlas: 1024×1024, sixteen 256×256 transparent cells. Initial semantic set: wound, guarding, cover, blocked path, line of sight, melee, ranged, movement, morale, noise, light, time/pulse, known, estimated, unknown, and incapacitated. Native labels and accessible descriptions remain mandatory.

### `ui-combat-portraits-whitemarch-v1.png`

Runtime atlas: 1024×512, 4×2 cells at 256×256. Generate dedicated head-and-shoulder portraits with a shared neutral limewash field; do not improvise inconsistent crops from the full-body billboard sheet. The first row contains Erran Holt, Maud Reed, Tavin Croft, and Odo Pell. Keep the second row available for state variants or the next encounter.

For all UI atlases: PNG RGBA8, sRGB, lossless import, linear filtering, mipmaps off, repeat off, no generated words/numbers/logos/watermarks, and no SVG derivative. Record prompts, crop map, generation mode, and historical/style review in provenance.

## 9. Remove from the current tracer UI

- Remove the large black-stone-and-brass frame that turns the entire lower screen into a monument and competes with the field.
- Remove the visual collision among the flat teal title bar, detached dark actor strip, ornate masonry panel, and modern flat buttons; all combat chrome must use the field-folio system.
- Remove Save and Load from the top bar, Reset from the commitment row, and Clear as a peer of Confirm.
- Remove the permanent deterministic hash and three tiny event-log lines from the player HUD.
- Remove the duplicated unit/status strips and consolidate acting-unit facts in the 48 px context rail.
- Replace the current oversized icon crops and inconsistent icon backplates with transparent, consistently scaled atlas icons.
- Replace all-caps location shouting and tiny low-contrast metadata with the type scale above.
- Do not fire Guard or End Turn immediately from the action row; both require forecast and commit.
- Do not show a disabled Pack button until item use is implemented in the tracer.

## 10. Acceptance checks

- At 432×768, at least 468 px of the field remains visually unobscured and the dock occupies no more than 260 px including safe padding.
- Every primary touch target is at least 48×48 with at least 8 px separation; board hit regions meet the same minimum.
- Move, Attack, Guard, Wait, Cancel, and Commit can be understood in grayscale from shape, label, outline, and state—not color alone.
- Forecast, actor condition, and latest event are readable at arm's length without text below 12 px.
- Opening the chronicle is reversible, advances no simulation, and exposes all mechanical facts from the toast.
- A 115% text-scale screenshot has no clipped controls, ellipsized outcome numbers, or overlapping labels.
- Visual QA passes at 432×768 and the compact 360×640 profile.
- The shipped `game/` combat UI references PNG/WebP raster artwork only; native text remains live and no `.svg` reference exists.
