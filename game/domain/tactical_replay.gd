extends RefCounted
class_name TacticalReplay

const BattleStateScript = preload("res://domain/battle_state.gd")
const Gateway = preload("res://domain/command_gateway.gd")
const JsonValueNormalizer = preload("res://domain/json_value_normalizer.gd")
const StateHash = preload("res://domain/state_hash.gd")

var initial_snapshot: Dictionary = {}
var commands: Array = []


func _init(initial_state = null) -> void:
	if initial_state != null:
		initial_snapshot = initial_state.to_snapshot(true)


func record_accepted(command: Dictionary, result: Dictionary) -> bool:
	if not bool(result.get("ok", false)):
		return false
	commands.append(command.duplicate(true))
	return true


func to_record(final_state) -> Dictionary:
	return {
		"schema_version": 1,
		"initial_snapshot": initial_snapshot.duplicate(true),
		"commands": commands.duplicate(true),
		"expected_final_hash": StateHash.of_state(final_state),
	}


static func run(record: Dictionary) -> Dictionary:
	var normalized: Dictionary = JsonValueNormalizer.normalize(record)
	if int(normalized.get("schema_version", 0)) != 1:
		return {"ok": false, "error": "unsupported_replay_schema"}
	var state = BattleStateScript.from_snapshot(Dictionary(normalized.get("initial_snapshot", {})))
	if state == null:
		return {"ok": false, "error": "unsupported_snapshot_schema"}
	var command_index := 0
	for command_variant in Array(normalized.get("commands", [])):
		var result := Gateway.execute(state, Dictionary(command_variant))
		if not bool(result.get("ok", false)):
			return {
				"ok": false,
				"error": "command_%d_%s" % [command_index, str(result.get("error", "rejected"))],
				"state": state,
			}
		command_index += 1
	var final_hash := StateHash.of_state(state)
	var expected_hash := str(normalized.get("expected_final_hash", ""))
	if not expected_hash.is_empty() and final_hash != expected_hash:
		return {"ok": false, "error": "final_hash_mismatch", "state": state, "final_hash": final_hash}
	return {"ok": true, "error": "", "state": state, "final_hash": final_hash}
