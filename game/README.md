# Solitaire — clean-room Godot game

This directory is an entirely new Godot 4.7 game. It does not evolve or import the legacy React/PWA implementation or the cache-only `godot/` directory.

## Direction

- deterministic, mechanics-authoritative tactical RPG;
- portrait-first mobile controls;
- true 2.5D: a 3D environment with high-definition 2D character billboards;
- lighter, luminous high fantasy with serious but readable danger;
- historically and regionally grounded character and item construction;
- oil-brush painterly 2D anime rendering for characters, items, and UI art;
- offline-complete core play;
- generated raster UI artwork with native Godot layout and text;
- no SVG or deliberate pixel-art assets.

## Commands

This workspace uses the portable Godot build at `C:\tmp\godot47`. Its `bin\_sc_` marker keeps editor and `user://` data inside the writable portable directory, avoiding native crashes when a sandbox cannot write to `%APPDATA%`. Run one Godot process at a time against this project; concurrent import, smoke, and capture processes can contend for the same `.godot` cache.

```powershell
C:\tmp\godot47\bin\Godot_v4.7-stable_win64_console.exe --headless --path game --script res://tests/test_runner.gd
C:\tmp\godot47\bin\Godot_v4.7-stable_win64_console.exe --path game --editor
```

For automated verification, prefer the headless domain and structural smoke suites. Avoid `--write-movie` on the current Intel OpenGL driver; it produced unstable capture/shutdown behavior during development.

The first command runs the deterministic domain suite. The second opens the clean-room project in Godot.
