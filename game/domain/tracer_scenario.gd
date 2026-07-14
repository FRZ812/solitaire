extends RefCounted
class_name WhitewendRoadTracerScenario

const BattleStateScript = preload("res://domain/battle_state.gd")

const DEFAULT_SEED := 20260714


static func create(seed_value: int = DEFAULT_SEED):
	var state = BattleStateScript.new()
	state.campaign_seed = seed_value
	state.rng.setup(seed_value)
	state.scenario = {
		"id": "alder_ford_tollhouse",
		"title": "Alder Ford Tollhouse",
		"tone": "light_grounded_high_fantasy",
		"premise": "A company warden and a Whitewend scout confront two road brigands who seized a cart of winter medicine at a ruined toll garden.",
		"magic_policy": {
			"present_in_tracer": false,
			"freeform_casting": false,
			"explicit_acquisition_paths": ["authored_tutelage", "sworn_covenant", "attuned_relic"],
		},
	}
	state.initiative = [
		"erran_holt",
		"road_spearman",
		"maud_reed",
		"crossbow_skirmisher",
	]
	state.units = {
		"erran_holt": _unit({
			"id": "erran_holt",
			"name": "Erran Holt",
			"role": "Company Warden",
			"side": "company",
			"controllable": true,
			"position": {"x": 2, "y": 7},
			"max_hp": 16,
			"armor": 2,
			"accuracy": 9,
			"evasion": 6,
			"melee_power": 5,
			"ranged_power": 0,
			"move": 3,
			"melee_range": 1,
			"ranged_min": 0,
			"ranged_max": 0,
			"weapon": "ash_spear",
			"equipment": {
				"body": "linen gambeson with short riveted-mail sleeves",
				"off_hand": "painted wood-and-hide kite shield",
				"clothing": "dyed wool coat, linen shirt, leather turnshoes",
			},
			"magic_paths": [],
			"ai_profile": "",
		}),
		"maud_reed": _unit({
			"id": "maud_reed",
			"name": "Maud Reed",
			"role": "Whitewend Scout",
			"side": "company",
			"controllable": true,
			"position": {"x": 4, "y": 7},
			"max_hp": 12,
			"armor": 1,
			"accuracy": 11,
			"evasion": 8,
			"melee_power": 3,
			"ranged_power": 4,
			"move": 3,
			"melee_range": 1,
			"ranged_min": 2,
			"ranged_max": 5,
			"weapon": "whitewend_yew_bow",
			"equipment": {
				"body": "quilted wool jack",
				"off_hand": "hemp-strung yew bow and ash arrows",
				"clothing": "undyed wool mantle, linen layers, calf-high leather boots",
			},
			"magic_paths": [],
			"conditions": [{
				"id": "strained_bow_shoulder",
				"name": "Strained bow shoulder",
				"severity": 1,
				"persistent": true,
				"source": "previous_expedition",
				"effects": {"ranged_accuracy": -2},
				"recovery": "company_rest_or_treatment",
			}],
			"ai_profile": "",
		}),
		"road_spearman": _unit({
			"id": "road_spearman",
			"name": "Tavin Croft",
			"role": "River-road Brigand Spearman",
			"side": "brigands",
			"controllable": false,
			"position": {"x": 2, "y": 1},
			"max_hp": 13,
			"armor": 1,
			"accuracy": 7,
			"evasion": 4,
			"melee_power": 4,
			"ranged_power": 0,
			"move": 2,
			"melee_range": 1,
			"ranged_min": 0,
			"ranged_max": 0,
			"weapon": "repaired_ash_spear",
			"equipment": {
				"body": "patched linen gambeson",
				"off_hand": "small plank shield with an iron boss",
				"clothing": "coarse wool hood, work trousers, hobnailed shoes",
			},
			"magic_paths": [],
			"ai_profile": "bruiser",
		}),
		"crossbow_skirmisher": _unit({
			"id": "crossbow_skirmisher",
			"name": "Odo Pell",
			"role": "River-road Crossbow Skirmisher",
			"side": "brigands",
			"controllable": false,
			"position": {"x": 4, "y": 1},
			"max_hp": 9,
			"armor": 0,
			"accuracy": 9,
			"evasion": 10,
			"melee_power": 2,
			"ranged_power": 3,
			"move": 3,
			"melee_range": 1,
			"ranged_min": 2,
			"ranged_max": 4,
			"weapon": "goatsfoot_light_crossbow",
			"equipment": {
				"body": "sleeveless padded jack",
				"off_hand": "light crossbow, goatsfoot lever, and belt quiver",
				"clothing": "brown wool coat, linen coif, leather ankle boots",
			},
			"magic_paths": [],
			"ai_profile": "skirmisher",
		}),
	}
	state.terrain = {
		"3,4": {
			"id": "collapsed_tollhouse_wall",
			"blocks_movement": true,
			"blocks_sight": true,
			"cover": 2,
		},
		"1,4": {
			"id": "overgrown_osier_hurdle",
			"blocks_movement": false,
			"blocks_sight": false,
			"cover": 1,
		},
		"5,4": {
			"id": "abandoned_cart_side",
			"blocks_movement": false,
			"blocks_sight": false,
			"cover": 1,
		},
		"0,3": {
			"id": "fallen_milestone",
			"blocks_movement": true,
			"blocks_sight": false,
			"cover": 1,
		},
		"6,3": {
			"id": "broken_toll_post",
			"blocks_movement": true,
			"blocks_sight": false,
			"cover": 1,
		},
	}
	return state


static func _unit(values: Dictionary) -> Dictionary:
	var unit := {
		"id": "",
		"name": "",
		"role": "",
		"side": "",
		"controllable": false,
		"position": {"x": 0, "y": 0},
		"hp": 1,
		"max_hp": 1,
		"armor": 0,
		"accuracy": 0,
		"evasion": 0,
		"melee_power": 1,
		"ranged_power": 0,
		"move": 2,
		"melee_range": 1,
		"ranged_min": 0,
		"ranged_max": 0,
		"weapon": "",
		"equipment": {},
		"magic_paths": [],
		"conditions": [],
		"guarding": false,
		"alive": true,
		"ai_profile": "",
	}
	unit.merge(values, true)
	unit["hp"] = int(unit["max_hp"])
	return unit
