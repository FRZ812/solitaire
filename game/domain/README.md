# Deterministic tactical domain

This directory is a clean-room Godot 4.7 rules kernel. It does not depend on scenes, rendering, network access, generated assets, or the legacy web project.

The boundary is deliberately narrow:

1. UI or AI submits a dictionary command to `TacticalCommandGateway.execute`.
2. `TacticalBattleRules` validates intent and produces event specifications.
3. The gateway assigns canonical sequence numbers and advances one pulse.
4. `TacticalBattleReducer` is the only gameplay path that mutates battle state.
5. `TacticalReplay` re-runs accepted commands from a versioned initial snapshot and verifies the SHA-256 state hash.

Supported tracer commands are `move`, `attack` (`melee` or `ranged`), `guard`, and `end_turn`. `end_turn` emits its own `actor_waited` event; it never grants guard. Every accepted command consumes exactly one pulse. Invalid commands emit no events and preserve the state hash.

`NamedRngBank` provides isolated `combat`, `loot`, and `world`-style streams using a platform-stable integer generator. The tracer only draws `combat`; future systems can add streams without shifting existing outcomes.

Snapshots and replay records are versioned. Their JSON boundary restores integral number types recursively before hashing or command replay, so a serialized save reaches the same canonical hash as its in-memory source. Unsupported snapshot versions are rejected instead of being loaded as if they were current data.

`WhitewendRoadTracerScenario` is a light but grounded high-fantasy encounter on a 7×9 field: a mail-and-gambeson company warden and a wool-clad Whitewend yew-bow scout confront a spear carrier and light-crossbow brigand at a ruined toll garden. Materials and equipment are regionally plausible rather than magical spectacle.

Maud enters the tracer with a persistent strained bow shoulder from the previous expedition. Its authored `-2` ranged-accuracy effect survives saves and replays until company rest or treatment clears it. This is the first narrow proof for expedition consequences, not a general-purpose freeform status system.

No tracer unit can cast magic. The scenario records the only permitted future acquisition categories—authored tutelage, sworn covenant, or attuned relic—and the gateway rejects unsupported cast intent atomically. Any future magical command must therefore arrive as a named, content-defined rule path rather than freeform power.
