# Solitaire exploration renderer

This Godot 4.7 project owns the interactive world and Whitemarch map surface. React still owns the surrounding RPG interface, commands, saves, and simulation.

## Scene bridge

- React posts a `solitaire-map-scene` JSON message containing the authoritative cells, route, selection, and visibility state.
- Godot posts `solitaire-godot-ready` once its web runtime is listening.
- Godot posts `solitaire-godot-select` when the player clicks an interactive map cell.
- Messages are restricted to the iframe's same-origin parent.

The world uses axial pointy-top hexes. Whitemarch uses graph-derived square city cells. Unknown world cells cross the bridge as `impassable`, so the fog shader cannot reveal hidden terrain through texture details.

## Preview and export

Open `project.godot` in Godot for the world preview. Run with `-- --city-preview` to inspect the city renderer.

The committed browser build is a non-threaded web export, so it can run inside the React iframe without cross-origin isolation headers:

```powershell
godot --headless --path godot --export-release Web public/godot/index.html
```
