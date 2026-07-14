extends Resource
class_name TacticalBattleState

const NamedRngBankScript = preload("res://domain/named_rng_bank.gd")
const JsonValueNormalizer = preload("res://domain/json_value_normalizer.gd")

const SCHEMA_VERSION := 1
const GRID_WIDTH := 7
const GRID_HEIGHT := 9

var scenario: Dictionary = {}
var campaign_seed: int = 1
var pulse: int = 0
var active_index: int = 0
var initiative: Array = []
var units: Dictionary = {}
var terrain: Dictionary = {}
var status: String = "active"
var victor: String = ""
var next_event_sequence: int = 0
var history: Array = []
var rng = NamedRngBankScript.new()


func active_actor_id() -> String:
	if status != "active" or active_index < 0 or active_index >= initiative.size():
		return ""
	return str(initiative[active_index])


func get_unit(actor_id: String) -> Dictionary:
	return units.get(actor_id, {})


func living_unit_ids(side: String = "") -> Array:
	var result: Array = []
	var ids: Array = units.keys()
	ids.sort()
	for id_variant in ids:
		var actor_id := str(id_variant)
		var unit: Dictionary = units[actor_id]
		if not bool(unit.get("alive", false)):
			continue
		if not side.is_empty() and str(unit.get("side", "")) != side:
			continue
		result.append(actor_id)
	return result


func to_snapshot(include_history: bool = true) -> Dictionary:
	var snapshot := {
		"schema_version": SCHEMA_VERSION,
		"scenario": scenario.duplicate(true),
		"campaign_seed": campaign_seed,
		"grid": {"width": GRID_WIDTH, "height": GRID_HEIGHT},
		"pulse": pulse,
		"active_index": active_index,
		"initiative": initiative.duplicate(true),
		"units": units.duplicate(true),
		"terrain": terrain.duplicate(true),
		"status": status,
		"victor": victor,
		"next_event_sequence": next_event_sequence,
		"rng": rng.snapshot(),
	}
	if include_history:
		snapshot["history"] = history.duplicate(true)
	return snapshot


static func from_snapshot(snapshot: Dictionary):
	# Load the defining script directly so snapshot restore also works on the first
	# headless run, before Godot has populated its global class-name cache.
	var normalized: Dictionary = JsonValueNormalizer.normalize(snapshot)
	if int(normalized.get("schema_version", 0)) != SCHEMA_VERSION:
		return null
	var state = load("res://domain/battle_state.gd").new()
	state.scenario = Dictionary(normalized.get("scenario", {})).duplicate(true)
	state.campaign_seed = int(normalized.get("campaign_seed", 1))
	state.pulse = int(normalized.get("pulse", 0))
	state.active_index = int(normalized.get("active_index", 0))
	state.initiative = Array(normalized.get("initiative", [])).duplicate(true)
	state.units = Dictionary(normalized.get("units", {})).duplicate(true)
	state.terrain = Dictionary(normalized.get("terrain", {})).duplicate(true)
	state.status = str(normalized.get("status", "active"))
	state.victor = str(normalized.get("victor", ""))
	state.next_event_sequence = int(normalized.get("next_event_sequence", 0))
	state.history = Array(normalized.get("history", [])).duplicate(true)
	state.rng.restore(Dictionary(normalized.get("rng", {"master_seed": state.campaign_seed})))
	return state
