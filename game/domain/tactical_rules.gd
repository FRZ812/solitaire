extends RefCounted
class_name TacticalBattleRules

const GridRules = preload("res://domain/grid_rules.gd")

const COMBAT_STREAM := "combat"


static func resolve(state, command: Dictionary) -> Dictionary:
	match str(command.get("type", "")):
		"move":
			return _resolve_move(state, command)
		"attack":
			return _resolve_attack(state, command)
		"guard":
			return _resolve_guard(state, command)
		"end_turn":
			return _resolve_end_turn(state, command)
		_:
			return _failure("unsupported_command")


static func can_attack(state, actor_id: String, target_id: String, mode: String) -> Dictionary:
	if not state.units.has(actor_id) or not state.units.has(target_id):
		return _failure("unknown_actor")
	var actor: Dictionary = state.units[actor_id]
	var target: Dictionary = state.units[target_id]
	if not bool(actor.get("alive", false)) or not bool(target.get("alive", false)):
		return _failure("actor_not_alive")
	if str(actor.get("side", "")) == str(target.get("side", "")):
		return _failure("friendly_fire_forbidden")
	var distance := GridRules.distance(Dictionary(actor["position"]), Dictionary(target["position"]))
	if mode == "melee":
		if distance > int(actor.get("melee_range", 1)):
			return _failure("target_out_of_melee_range")
	elif mode == "ranged":
		var minimum := int(actor.get("ranged_min", 0))
		var maximum := int(actor.get("ranged_max", 0))
		if maximum <= 0:
			return _failure("no_ranged_weapon")
		if distance < minimum or distance > maximum:
			return _failure("target_out_of_ranged_range")
		if not GridRules.has_line_of_sight(state, Dictionary(actor["position"]), Dictionary(target["position"])):
			return _failure("line_of_sight_blocked")
	else:
		return _failure("unsupported_attack_mode")
	return {"ok": true, "error": "", "distance": distance}


static func _resolve_move(state, command: Dictionary) -> Dictionary:
	if not command.has("to") or not command["to"] is Dictionary:
		return _failure("missing_destination")
	var actor_id := str(command["actor_id"])
	var actor: Dictionary = state.units[actor_id]
	var origin: Dictionary = Dictionary(actor["position"])
	var destination: Dictionary = Dictionary(command["to"])
	var path := GridRules.shortest_path(state, origin, destination, actor_id)
	if path.is_empty():
		return _failure("destination_unreachable")
	var cost := path.size() - 1
	if cost <= 0:
		return _failure("destination_unchanged")
	if cost > int(actor.get("move", 0)):
		return _failure("destination_too_far")
	return {
		"ok": true,
		"error": "",
		"events": [{
			"type": "actor_moved",
			"payload": {
				"actor_id": actor_id,
				"from": origin.duplicate(true),
				"to": destination.duplicate(true),
				"path": path.duplicate(true),
				"cost": cost,
			},
		}],
		"defeated_ids": [],
	}


static func _resolve_attack(state, command: Dictionary) -> Dictionary:
	var actor_id := str(command["actor_id"])
	var target_id := str(command.get("target_id", ""))
	var mode := str(command.get("mode", "melee"))
	var validation := can_attack(state, actor_id, target_id, mode)
	if not bool(validation.get("ok", false)):
		return validation
	var actor: Dictionary = state.units[actor_id]
	var target: Dictionary = state.units[target_id]
	var preview: Dictionary = state.rng.preview_int(COMBAT_STREAM, 1, 100)
	var cover := GridRules.cover_at(state, Dictionary(target["position"])) if mode == "ranged" else 0
	var base_chance := 78 if mode == "melee" else 72
	var condition_modifier := _attack_accuracy_modifier(actor, mode)
	var chance: int = clampi(
		base_chance + int(actor.get("accuracy", 0)) + condition_modifier - int(target.get("evasion", 0)) - cover * 10,
		15,
		95
	)
	var roll := int(preview["value"])
	var hit := roll <= chance
	var critical := hit and roll <= 8
	var power := int(actor.get("melee_power", 1)) if mode == "melee" else int(actor.get("ranged_power", 1))
	var variance := (int(preview["state"]) % 3) - 1
	var guard_reduction := 3 if bool(target.get("guarding", false)) else 0
	var damage := 0
	if hit:
		damage = maxi(1, power + variance + (2 if critical else 0) - int(target.get("armor", 0)) - guard_reduction)
	var hp_before := int(target["hp"])
	var hp_after := maxi(0, hp_before - damage)
	var events: Array = [{
		"type": "rng_advanced",
		"payload": {
			"stream": COMBAT_STREAM,
			"prior_state": int(preview["prior_state"]),
			"state": int(preview["state"]),
			"draw_count": int(preview["draw_count"]),
		},
	}, {
		"type": "attack_resolved",
		"payload": {
			"actor_id": actor_id,
			"target_id": target_id,
			"mode": mode,
			"distance": int(validation["distance"]),
			"roll": roll,
			"chance": chance,
			"condition_modifier": condition_modifier,
			"cover": cover,
			"hit": hit,
			"critical": critical,
			"damage": damage,
		},
	}]
	var defeated_ids: Array = []
	if hit:
		events.append({
			"type": "unit_damaged",
			"payload": {
				"unit_id": target_id,
				"source_id": actor_id,
				"amount": damage,
				"hp_before": hp_before,
				"hp_after": hp_after,
			},
		})
		if bool(target.get("guarding", false)):
			events.append({
				"type": "guard_changed",
				"payload": {"actor_id": target_id, "guarding": false, "reason": "impact"},
			})
		if hp_after == 0:
			defeated_ids.append(target_id)
			events.append({
				"type": "unit_defeated",
				"payload": {"unit_id": target_id, "source_id": actor_id},
			})
	return {"ok": true, "error": "", "events": events, "defeated_ids": defeated_ids}


static func _resolve_guard(state, command: Dictionary) -> Dictionary:
	var actor_id := str(command["actor_id"])
	return {
		"ok": true,
		"error": "",
		"events": [{
			"type": "guard_changed",
			"payload": {"actor_id": actor_id, "guarding": true, "reason": "command"},
		}],
		"defeated_ids": [],
	}


static func _resolve_end_turn(state, command: Dictionary) -> Dictionary:
	var actor_id := str(command["actor_id"])
	return {
		"ok": true,
		"error": "",
		"events": [{
			"type": "actor_waited",
			"payload": {"actor_id": actor_id, "reason": "end_turn"},
		}],
		"defeated_ids": [],
	}


static func _attack_accuracy_modifier(actor: Dictionary, mode: String) -> int:
	var modifier := 0
	for condition_variant in Array(actor.get("conditions", [])):
		var condition: Dictionary = condition_variant
		var effects: Dictionary = condition.get("effects", {})
		modifier += int(effects.get("accuracy", 0))
		modifier += int(effects.get(mode + "_accuracy", 0))
	return modifier


static func _failure(error_code: String) -> Dictionary:
	return {"ok": false, "error": error_code, "events": [], "defeated_ids": []}
