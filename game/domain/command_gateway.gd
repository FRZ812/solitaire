extends RefCounted
class_name TacticalCommandGateway

const Rules = preload("res://domain/tactical_rules.gd")
const Reducer = preload("res://domain/battle_reducer.gd")
const StateHash = preload("res://domain/state_hash.gd")


static func execute(state, command: Dictionary) -> Dictionary:
	var hash_before := StateHash.of_state(state)
	if state.status != "active":
		return _rejected("battle_not_active", hash_before)
	var actor_id := str(command.get("actor_id", ""))
	if actor_id.is_empty() or not state.units.has(actor_id):
		return _rejected("unknown_actor", hash_before)
	if actor_id != state.active_actor_id():
		return _rejected("actor_not_active", hash_before)
	var actor: Dictionary = state.units[actor_id]
	if not bool(actor.get("alive", false)):
		return _rejected("actor_not_alive", hash_before)
	var resolution := Rules.resolve(state, command)
	if not bool(resolution.get("ok", false)):
		return _rejected(str(resolution.get("error", "command_rejected")), hash_before)
	var event_specs: Array = []
	if bool(actor.get("guarding", false)) and str(command.get("type", "")) != "guard":
		event_specs.append({
			"type": "guard_changed",
			"payload": {"actor_id": actor_id, "guarding": false, "reason": "new_action"},
		})
	event_specs.append_array(Array(resolution.get("events", [])))
	var defeated_ids: Array = Array(resolution.get("defeated_ids", []))
	var remaining_sides := _remaining_sides(state, defeated_ids)
	var battle_finished := remaining_sides.size() <= 1
	var next_index := -1 if battle_finished else _next_living_index(state, defeated_ids)
	event_specs.append({
		"type": "pulse_advanced",
		"payload": {
			"from_pulse": state.pulse,
			"to_pulse": state.pulse + 1,
			"active_index": next_index,
			"active_actor_id": "" if next_index < 0 else str(state.initiative[next_index]),
		},
	})
	if battle_finished:
		event_specs.append({
			"type": "battle_finished",
			"payload": {"victor": "draw" if remaining_sides.is_empty() else str(remaining_sides[0])},
		})
	var events := _materialize_events(state, event_specs)
	var reduce_result := Reducer.apply_all(state, events)
	if not bool(reduce_result.get("ok", false)):
		return _rejected(str(reduce_result.get("error", "reducer_failed")), hash_before)
	return {
		"ok": true,
		"error": "",
		"command": command.duplicate(true),
		"events": events,
		"hash_before": hash_before,
		"hash_after": StateHash.of_state(state),
	}


static func _materialize_events(state, event_specs: Array) -> Array:
	var events: Array = []
	var sequence: int = state.next_event_sequence
	for spec_variant in event_specs:
		var spec: Dictionary = spec_variant
		events.append({
			"schema_version": 1,
			"sequence": sequence,
			"pulse": state.pulse,
			"type": str(spec["type"]),
			"payload": Dictionary(spec.get("payload", {})).duplicate(true),
		})
		sequence += 1
	return events


static func _next_living_index(state, defeated_ids: Array) -> int:
	for offset in range(1, state.initiative.size() + 1):
		var candidate_index: int = (state.active_index + offset) % state.initiative.size()
		var candidate_id := str(state.initiative[candidate_index])
		if defeated_ids.has(candidate_id):
			continue
		if bool(Dictionary(state.units[candidate_id]).get("alive", false)):
			return candidate_index
	return -1


static func _remaining_sides(state, defeated_ids: Array) -> Array:
	var sides: Array = []
	var ids: Array = state.units.keys()
	ids.sort()
	for id_variant in ids:
		var actor_id := str(id_variant)
		if defeated_ids.has(actor_id):
			continue
		var unit: Dictionary = state.units[actor_id]
		if not bool(unit.get("alive", false)):
			continue
		var side := str(unit.get("side", ""))
		if not sides.has(side):
			sides.append(side)
	sides.sort()
	return sides


static func _rejected(error_code: String, state_hash: String) -> Dictionary:
	return {
		"ok": false,
		"error": error_code,
		"events": [],
		"hash_before": state_hash,
		"hash_after": state_hash,
	}
