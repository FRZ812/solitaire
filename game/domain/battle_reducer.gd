extends RefCounted
class_name TacticalBattleReducer


static func apply_all(state, events: Array) -> Dictionary:
	for event_variant in events:
		var error := apply_event(state, Dictionary(event_variant))
		if not error.is_empty():
			return {"ok": false, "error": error}
	return {"ok": true, "error": ""}


static func apply_event(state, event: Dictionary) -> String:
	if int(event.get("schema_version", 0)) != 1:
		return "unsupported_event_schema"
	if int(event.get("sequence", -1)) != state.next_event_sequence:
		return "event_sequence_mismatch"
	var payload: Dictionary = event.get("payload", {})
	match str(event.get("type", "")):
		"actor_moved":
			var moved_actor_id := str(payload["actor_id"])
			var moved_unit: Dictionary = state.units[moved_actor_id]
			moved_unit["position"] = Dictionary(payload["to"]).duplicate(true)
			state.units[moved_actor_id] = moved_unit
		"rng_advanced":
			var stream_name := str(payload["stream"])
			if state.rng.state_for(stream_name) != int(payload["prior_state"]):
				return "rng_state_mismatch"
			state.rng.advance_to(stream_name, int(payload["state"]), int(payload["draw_count"]))
		"unit_damaged":
			var damaged_unit_id := str(payload["unit_id"])
			var damaged_unit: Dictionary = state.units[damaged_unit_id]
			damaged_unit["hp"] = int(payload["hp_after"])
			state.units[damaged_unit_id] = damaged_unit
		"guard_changed":
			var guard_actor_id := str(payload["actor_id"])
			var guard_unit: Dictionary = state.units[guard_actor_id]
			guard_unit["guarding"] = bool(payload["guarding"])
			state.units[guard_actor_id] = guard_unit
		"unit_defeated":
			var defeated_unit_id := str(payload["unit_id"])
			var defeated_unit: Dictionary = state.units[defeated_unit_id]
			defeated_unit["alive"] = false
			defeated_unit["hp"] = 0
			state.units[defeated_unit_id] = defeated_unit
		"pulse_advanced":
			state.pulse = int(payload["to_pulse"])
			state.active_index = int(payload["active_index"])
		"battle_finished":
			state.status = "finished"
			state.victor = str(payload["victor"])
		"attack_resolved":
			pass
		"actor_waited":
			pass
		_:
			return "unsupported_event_type"
	state.history.append(event.duplicate(true))
	state.next_event_sequence += 1
	return ""
