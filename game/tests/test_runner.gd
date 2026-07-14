extends SceneTree

const BattleStateScript = preload("res://domain/battle_state.gd")
const EnemyAI = preload("res://domain/enemy_utility_ai.gd")
const Gateway = preload("res://domain/command_gateway.gd")
const GridRules = preload("res://domain/grid_rules.gd")
const NamedRngBankScript = preload("res://domain/named_rng_bank.gd")
const ReplayScript = preload("res://domain/tactical_replay.gd")
const Scenario = preload("res://domain/tracer_scenario.gd")
const StateHash = preload("res://domain/state_hash.gd")

var _checks := 0
var _failures: Array = []


func _initialize() -> void:
	_test_tracer_shape_and_tone()
	_test_named_rng_stream_isolation_and_restore()
	_test_canonical_hash_ignores_dictionary_insertion_order()
	_test_rejected_command_is_atomic()
	_test_movement_advances_exactly_one_pulse()
	_test_end_turn_is_distinct_and_deterministic()
	_test_obstacles_and_occupancy_reject_movement()
	_test_melee_attack_and_guard_mitigation()
	_test_ranged_line_of_sight()
	_test_enemy_utility_is_deterministic()
	_test_battle_completion_event()
	_test_snapshot_round_trip()
	_test_snapshot_schema_is_enforced()
	_test_replay_reaches_identical_hash()
	_test_replay_includes_end_turn_rng_and_completion()
	if _checks != 63:
		_failures.append("test runner completed %d of 63 expected checks" % _checks)
	if _failures.is_empty():
		print("PASS tactical domain: %d checks" % _checks)
		quit(0)
		return
	print("FAIL tactical domain: %d of %d checks failed" % [_failures.size(), _checks])
	for failure in _failures:
		print("  - " + str(failure))
	quit(1)


func _test_tracer_shape_and_tone() -> void:
	var state = Scenario.create()
	_expect(state.scenario["id"] == "alder_ford_tollhouse", "scenario has an original grounded identity")
	_expect(state.scenario["tone"] == "light_grounded_high_fantasy", "scenario explicitly keeps the light high-fantasy contrast")
	_expect(BattleStateScript.GRID_WIDTH == 7 and BattleStateScript.GRID_HEIGHT == 9, "field is exactly 7x9")
	_expect(state.units.size() == 4, "tracer has four combatants")
	_expect(state.living_unit_ids("company").size() == 2, "tracer has two living company combatants")
	_expect(state.living_unit_ids("brigands").size() == 2, "tracer has two living brigands")
	var occupied: Dictionary = {}
	var controllable_count := 0
	for unit_variant in state.units.values():
		var unit: Dictionary = unit_variant
		var cell: Dictionary = unit["position"]
		_expect(GridRules.in_bounds(cell), "%s starts in bounds" % str(unit["id"]))
		_expect(not occupied.has(GridRules.key(cell)), "%s starts on a unique cell" % str(unit["id"]))
		occupied[GridRules.key(cell)] = true
		if bool(unit["controllable"]):
			controllable_count += 1
	_expect(controllable_count == 2, "both company combatants and only company combatants are directly controllable")
	var conditions: Array = state.units["maud_reed"]["conditions"]
	_expect(conditions.size() == 1 and conditions[0]["id"] == "strained_bow_shoulder", "tracer includes one grounded authored condition")
	_expect(bool(conditions[0]["persistent"]), "the authored condition persists beyond this encounter until recovery")


func _test_named_rng_stream_isolation_and_restore() -> void:
	var with_loot_draw = NamedRngBankScript.new()
	var without_loot_draw = NamedRngBankScript.new()
	with_loot_draw.setup(81173)
	without_loot_draw.setup(81173)
	var combat_a1 := with_loot_draw.next_int("combat", 1, 100)
	with_loot_draw.next_int("loot", 1, 100)
	var combat_a2 := with_loot_draw.next_int("combat", 1, 100)
	var combat_b1 := without_loot_draw.next_int("combat", 1, 100)
	var combat_b2 := without_loot_draw.next_int("combat", 1, 100)
	_expect(combat_a1 == combat_b1 and combat_a2 == combat_b2, "loot draws cannot shift combat outcomes")
	var snapshot := with_loot_draw.snapshot()
	var restored = NamedRngBankScript.new()
	restored.restore(snapshot)
	_expect(
		with_loot_draw.next_int("combat", 1, 1000) == restored.next_int("combat", 1, 1000),
		"RNG stream state survives snapshot restore"
	)


func _test_canonical_hash_ignores_dictionary_insertion_order() -> void:
	var first := {"b": 2, "a": {"y": 4, "x": 3}}
	var second := {"a": {"x": 3, "y": 4}, "b": 2}
	_expect(StateHash.of_value(first) == StateHash.of_value(second), "canonical hash sorts dictionary keys recursively")


func _test_rejected_command_is_atomic() -> void:
	var state = Scenario.create()
	var before := StateHash.of_state(state)
	var result := Gateway.execute(state, {"type": "guard", "actor_id": "maud_reed"})
	_expect(not bool(result["ok"]) and result["error"] == "actor_not_active", "inactive actor command is rejected")
	_expect(result["events"].is_empty(), "rejected command emits no canonical events")
	_expect(before == StateHash.of_state(state) and state.pulse == 0, "rejected command does not mutate state")


func _test_movement_advances_exactly_one_pulse() -> void:
	var state = Scenario.create()
	var result := Gateway.execute(state, {
		"type": "move",
		"actor_id": "erran_holt",
		"to": {"x": 2, "y": 5},
	})
	_expect(bool(result["ok"]), "legal movement is accepted")
	_expect(GridRules.equal(state.units["erran_holt"]["position"], {"x": 2, "y": 5}), "movement reducer updates position")
	_expect(state.pulse == 1 and state.active_actor_id() == "road_spearman", "one move consumes one pulse and rotates initiative")
	var moved_event: Dictionary = result["events"][0]
	_expect(moved_event["type"] == "actor_moved" and moved_event["payload"]["cost"] == 2, "move event records path cost")
	_expect(moved_event["payload"]["path"].size() == 3, "move event records every traversed cell")


func _test_end_turn_is_distinct_and_deterministic() -> void:
	var state = Scenario.create()
	var result := Gateway.execute(state, {"type": "end_turn", "actor_id": "erran_holt"})
	var waited_event := _event_of_type(result["events"], "actor_waited")
	var repeated_state = Scenario.create()
	var repeated_result := Gateway.execute(repeated_state, {"type": "end_turn", "actor_id": "erran_holt"})
	_expect(bool(result["ok"]), "end turn is an accepted tactical command")
	_expect(state.pulse == 1 and state.active_actor_id() == "road_spearman", "end turn consumes one pulse and rotates initiative")
	_expect(waited_event["payload"] == {"actor_id": "erran_holt", "reason": "end_turn"}, "end turn records its own canonical actor-waited event")
	_expect(_event_of_type(result["events"], "guard_changed").is_empty() and not bool(state.units["erran_holt"]["guarding"]), "end turn does not alias or grant guard")
	_expect(
		state.rng.draw_count_for("combat") == 0
		and result["events"] == repeated_result["events"]
		and result["hash_after"] == repeated_result["hash_after"],
		"end turn is deterministic and consumes no combat RNG draw"
	)


func _test_obstacles_and_occupancy_reject_movement() -> void:
	var blocked_state = Scenario.create()
	var blocked := Gateway.execute(blocked_state, {
		"type": "move",
		"actor_id": "erran_holt",
		"to": {"x": 3, "y": 4},
	})
	_expect(not bool(blocked["ok"]) and blocked["error"] == "destination_unreachable", "blocking terrain cannot be entered")
	var occupied_state = Scenario.create()
	var occupied := Gateway.execute(occupied_state, {
		"type": "move",
		"actor_id": "erran_holt",
		"to": {"x": 4, "y": 7},
	})
	_expect(not bool(occupied["ok"]) and occupied["error"] == "destination_unreachable", "occupied cells cannot be entered")


func _test_melee_attack_and_guard_mitigation() -> void:
	var open_state = _adjacent_melee_state(false)
	var guarded_state = _adjacent_melee_state(true)
	var command := {"type": "attack", "actor_id": "erran_holt", "target_id": "road_spearman", "mode": "melee"}
	var open_result := Gateway.execute(open_state, command)
	var guarded_result := Gateway.execute(guarded_state, command)
	var open_attack := _event_of_type(open_result["events"], "attack_resolved")
	var guarded_attack := _event_of_type(guarded_result["events"], "attack_resolved")
	_expect(bool(open_result["ok"]) and bool(open_attack["payload"]["hit"]), "seeded adjacent melee attack resolves as a hit")
	_expect(int(guarded_attack["payload"]["damage"]) < int(open_attack["payload"]["damage"]), "guard materially reduces incoming melee damage")
	_expect(not bool(guarded_state.units["road_spearman"]["guarding"]), "a hit consumes guard")
	_expect(guarded_state.rng.draw_count_for("combat") == 1, "one attack consumes exactly one combat RNG draw")


func _test_ranged_line_of_sight() -> void:
	var blocked_state = Scenario.create()
	blocked_state.active_index = 2
	blocked_state.units["maud_reed"]["position"] = {"x": 3, "y": 6}
	blocked_state.units["crossbow_skirmisher"]["position"] = {"x": 3, "y": 2}
	var blocked := Gateway.execute(blocked_state, {
		"type": "attack",
		"actor_id": "maud_reed",
		"target_id": "crossbow_skirmisher",
		"mode": "ranged",
	})
	_expect(not bool(blocked["ok"]) and blocked["error"] == "line_of_sight_blocked", "ranged attacks respect sight-blocking terrain")
	var clear_state = Scenario.create()
	clear_state.active_index = 2
	clear_state.units["maud_reed"]["position"] = {"x": 3, "y": 6}
	clear_state.units["crossbow_skirmisher"]["position"] = {"x": 4, "y": 4}
	var clear := Gateway.execute(clear_state, {
		"type": "attack",
		"actor_id": "maud_reed",
		"target_id": "crossbow_skirmisher",
		"mode": "ranged",
	})
	_expect(bool(clear["ok"]), "ranged attack with range and line of sight is accepted")
	var clear_attack := _event_of_type(clear["events"], "attack_resolved")
	_expect(clear_attack["payload"]["mode"] == "ranged", "ranged mode is preserved in canonical event")
	_expect(clear_attack["payload"]["condition_modifier"] == -2, "persistent shoulder strain applies its authored ranged accuracy penalty")


func _test_enemy_utility_is_deterministic() -> void:
	var state = Scenario.create()
	Gateway.execute(state, {"type": "move", "actor_id": "erran_holt", "to": {"x": 2, "y": 5}})
	var first := EnemyAI.choose_command(state)
	var second := EnemyAI.choose_command(state)
	_expect(first == second, "enemy utility selection has deterministic tie-breaking")
	_expect(first["type"] == "move" and first["actor_id"] == "road_spearman", "brigand spearman closes distance when no attack is legal")
	_expect(first["to"] == {"x": 2, "y": 3}, "bruiser selects the highest-utility reachable cell")
	var result := Gateway.execute(state, first)
	_expect(bool(result["ok"]) and state.active_actor_id() == "maud_reed", "AI command uses the same command gateway as a player")


func _test_battle_completion_event() -> void:
	var state = _adjacent_melee_state(false)
	state.units["road_spearman"]["hp"] = 1
	state.units["crossbow_skirmisher"]["hp"] = 0
	state.units["crossbow_skirmisher"]["alive"] = false
	var result := Gateway.execute(state, {
		"type": "attack",
		"actor_id": "erran_holt",
		"target_id": "road_spearman",
		"mode": "melee",
	})
	_expect(bool(result["ok"]) and state.status == "finished", "defeating the last opposing unit ends battle")
	_expect(state.victor == "company" and state.active_actor_id().is_empty(), "battle completion records victor and clears active actor")
	_expect(not _event_of_type(result["events"], "battle_finished").is_empty(), "battle completion is a canonical event")


func _test_snapshot_round_trip() -> void:
	var state = Scenario.create()
	Gateway.execute(state, {"type": "move", "actor_id": "erran_holt", "to": {"x": 2, "y": 5}})
	Gateway.execute(state, EnemyAI.choose_command(state))
	var restored = BattleStateScript.from_snapshot(state.to_snapshot(true))
	_expect(StateHash.of_state(state) == StateHash.of_state(restored), "versioned snapshot round-trip preserves complete state")
	_expect(restored.active_actor_id() == "maud_reed" and restored.history.size() == state.history.size(), "snapshot restores initiative and event history")
	var json_snapshot: Dictionary = JSON.parse_string(JSON.stringify(state.to_snapshot(true)))
	var json_restored = BattleStateScript.from_snapshot(json_snapshot)
	_expect(StateHash.of_state(state) == StateHash.of_state(json_restored), "JSON save and load preserves the canonical state hash")
	_expect(json_restored.units["maud_reed"]["conditions"] == state.units["maud_reed"]["conditions"], "persistent conditions survive a real JSON snapshot round-trip")


func _test_snapshot_schema_is_enforced() -> void:
	var snapshot: Dictionary = Scenario.create().to_snapshot(true)
	snapshot["schema_version"] = 99
	_expect(BattleStateScript.from_snapshot(snapshot) == null, "unsupported snapshot schemas are rejected instead of silently loaded")


func _test_replay_reaches_identical_hash() -> void:
	var state = Scenario.create()
	var replay = ReplayScript.new(state)
	var commands := [
		{"type": "move", "actor_id": "erran_holt", "to": {"x": 2, "y": 5}},
	]
	var first_result := Gateway.execute(state, commands[0])
	replay.record_accepted(commands[0], first_result)
	var spearman_command := EnemyAI.choose_command(state)
	var spearman_result := Gateway.execute(state, spearman_command)
	replay.record_accepted(spearman_command, spearman_result)
	var maud_command := {"type": "move", "actor_id": "maud_reed", "to": {"x": 4, "y": 5}}
	var maud_result := Gateway.execute(state, maud_command)
	replay.record_accepted(maud_command, maud_result)
	var skirmisher_command := EnemyAI.choose_command(state)
	var skirmisher_result := Gateway.execute(state, skirmisher_command)
	replay.record_accepted(skirmisher_command, skirmisher_result)
	var final_hash := StateHash.of_state(state)
	var replay_result := ReplayScript.run(replay.to_record(state))
	_expect(bool(replay_result["ok"]), "accepted command record replays without rejection")
	_expect(replay_result["final_hash"] == final_hash, "replay reaches byte-identical canonical state hash")
	_expect(replay_result["state"].history == state.history, "replay reproduces canonical event history")
	var json_record: Dictionary = JSON.parse_string(JSON.stringify(replay.to_record(state)))
	var json_replay_result := ReplayScript.run(json_record)
	_expect(bool(json_replay_result["ok"]) and json_replay_result["final_hash"] == final_hash, "serialized replay restores numeric types and reaches the expected hash")


func _test_replay_includes_end_turn_rng_and_completion() -> void:
	var state = Scenario.create()
	state.initiative = ["erran_holt", "maud_reed", "road_spearman", "crossbow_skirmisher"]
	state.units["road_spearman"]["position"] = {"x": 2, "y": 6}
	state.units["road_spearman"]["hp"] = 1
	state.units["crossbow_skirmisher"]["hp"] = 0
	state.units["crossbow_skirmisher"]["alive"] = false
	var replay = ReplayScript.new(state)
	var end_command := {"type": "end_turn", "actor_id": "erran_holt"}
	var end_result := Gateway.execute(state, end_command)
	replay.record_accepted(end_command, end_result)
	var attack_command := {"type": "attack", "actor_id": "maud_reed", "target_id": "road_spearman", "mode": "ranged"}
	var attack_result := Gateway.execute(state, attack_command)
	replay.record_accepted(attack_command, attack_result)
	_expect(bool(end_result["ok"]) and not _event_of_type(end_result["events"], "actor_waited").is_empty(), "vertical replay records a distinct end-turn action")
	_expect(
		bool(attack_result["ok"])
		and not _event_of_type(attack_result["events"], "rng_advanced").is_empty()
		and not _event_of_type(attack_result["events"], "attack_resolved").is_empty(),
		"vertical replay records deterministic attack RNG and resolution"
	)
	_expect(
		state.status == "finished"
		and not _event_of_type(attack_result["events"], "unit_defeated").is_empty()
		and not _event_of_type(attack_result["events"], "battle_finished").is_empty(),
		"vertical replay reaches canonical defeat and battle-completion events"
	)
	var record: Dictionary = JSON.parse_string(JSON.stringify(replay.to_record(state)))
	var replay_result := ReplayScript.run(record)
	_expect(
		bool(replay_result["ok"])
		and replay_result["final_hash"] == StateHash.of_state(state)
		and replay_result["state"].history == state.history,
		"serialized vertical replay reproduces end turn, attack, defeat, completion, and final hash"
	)


func _adjacent_melee_state(guarded: bool):
	var state = Scenario.create()
	state.units["road_spearman"]["position"] = {"x": 2, "y": 6}
	state.units["road_spearman"]["guarding"] = guarded
	return state


func _event_of_type(events: Array, event_type: String) -> Dictionary:
	for event_variant in events:
		var event: Dictionary = event_variant
		if str(event.get("type", "")) == event_type:
			return event
	return {}


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if condition:
		return
	_failures.append(message)
	push_error(message)
