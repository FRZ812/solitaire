extends RefCounted
class_name DeterministicEnemyUtilityAI

const GridRules = preload("res://domain/grid_rules.gd")
const Rules = preload("res://domain/tactical_rules.gd")


static func choose_command(state) -> Dictionary:
	var actor_id: String = state.active_actor_id()
	if actor_id.is_empty() or not state.units.has(actor_id):
		return {}
	var actor: Dictionary = state.units[actor_id]
	if bool(actor.get("controllable", false)) or not bool(actor.get("alive", false)):
		return {}
	var opponent_ids := _opponent_ids(state, str(actor.get("side", "")))
	if opponent_ids.is_empty():
		return {}
	var candidates: Array = []
	_add_attack_candidates(state, actor_id, actor, opponent_ids, candidates)
	_add_move_candidates(state, actor_id, actor, opponent_ids, candidates)
	var hp_ratio := float(actor.get("hp", 0)) / float(maxi(1, int(actor.get("max_hp", 1))))
	candidates.append({
		"score": 150 if hp_ratio <= 0.3 else 10,
		"tie_break": "guard",
		"command": {"type": "guard", "actor_id": actor_id},
	})
	candidates.sort_custom(_candidate_before)
	return Dictionary(candidates[0]["command"]).duplicate(true)


static func _add_attack_candidates(
	state,
	actor_id: String,
	actor: Dictionary,
	opponent_ids: Array,
	candidates: Array
) -> void:
	for target_id_variant in opponent_ids:
		var target_id := str(target_id_variant)
		var target: Dictionary = state.units[target_id]
		for mode in ["melee", "ranged"]:
			var validation := Rules.can_attack(state, actor_id, target_id, mode)
			if not bool(validation.get("ok", false)):
				continue
			var power := int(actor.get("melee_power", 0)) if mode == "melee" else int(actor.get("ranged_power", 0))
			var finishing_bonus := 70 if int(target.get("hp", 1)) <= maxi(1, power - int(target.get("armor", 0))) else 0
			var profile_bonus := 8 if (str(actor.get("ai_profile", "")) == "skirmisher" and mode == "ranged") else 0
			candidates.append({
				"score": 110 + finishing_bonus + profile_bonus - int(target.get("hp", 0)),
				"tie_break": "attack|%s|%s" % [target_id, mode],
				"command": {
					"type": "attack",
					"actor_id": actor_id,
					"target_id": target_id,
					"mode": mode,
				},
			})


static func _add_move_candidates(
	state,
	actor_id: String,
	actor: Dictionary,
	opponent_ids: Array,
	candidates: Array
) -> void:
	var origin: Dictionary = actor["position"]
	var reachable := GridRules.reachable_cells(state, origin, actor_id, int(actor.get("move", 0)))
	for cell_variant in reachable:
		var cell: Dictionary = cell_variant
		var nearest_distance := 999
		for opponent_id_variant in opponent_ids:
			var opponent: Dictionary = state.units[str(opponent_id_variant)]
			nearest_distance = mini(nearest_distance, GridRules.distance(cell, Dictionary(opponent["position"])))
		var profile := str(actor.get("ai_profile", "bruiser"))
		var score := 0
		if profile == "skirmisher":
			score = 72 - absi(nearest_distance - 3) * 14
		else:
			score = 72 - nearest_distance * 14
		candidates.append({
			"score": score,
			"tie_break": "move|" + GridRules.key(cell),
			"command": {"type": "move", "actor_id": actor_id, "to": cell.duplicate(true)},
		})


static func _opponent_ids(state, actor_side: String) -> Array:
	var result: Array = []
	var ids: Array = state.units.keys()
	ids.sort()
	for id_variant in ids:
		var actor_id := str(id_variant)
		var unit: Dictionary = state.units[actor_id]
		if bool(unit.get("alive", false)) and str(unit.get("side", "")) != actor_side:
			result.append(actor_id)
	return result


static func _candidate_before(a: Dictionary, b: Dictionary) -> bool:
	if int(a["score"]) != int(b["score"]):
		return int(a["score"]) > int(b["score"])
	return str(a["tie_break"]) < str(b["tie_break"])
