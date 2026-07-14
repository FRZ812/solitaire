extends RefCounted
class_name TacticalGridRules

const CARDINAL_DIRECTIONS := [
	{"x": 0, "y": -1},
	{"x": -1, "y": 0},
	{"x": 1, "y": 0},
	{"x": 0, "y": 1},
]


static func position(x: int, y: int) -> Dictionary:
	return {"x": x, "y": y}


static func key(cell: Dictionary) -> String:
	return "%d,%d" % [int(cell.get("x", -1)), int(cell.get("y", -1))]


static func from_key(cell_key: String) -> Dictionary:
	var parts := cell_key.split(",")
	return position(int(parts[0]), int(parts[1]))


static func equal(a: Dictionary, b: Dictionary) -> bool:
	return int(a.get("x", -99)) == int(b.get("x", -98)) and int(a.get("y", -99)) == int(b.get("y", -98))


static func in_bounds(cell: Dictionary) -> bool:
	var x := int(cell.get("x", -1))
	var y := int(cell.get("y", -1))
	return x >= 0 and x < 7 and y >= 0 and y < 9


static func distance(a: Dictionary, b: Dictionary) -> int:
	return absi(int(a["x"]) - int(b["x"])) + absi(int(a["y"]) - int(b["y"]))


static func tile_at(state, cell: Dictionary) -> Dictionary:
	return state.terrain.get(key(cell), {})


static func blocks_movement(state, cell: Dictionary) -> bool:
	return bool(tile_at(state, cell).get("blocks_movement", false))


static func blocks_sight(state, cell: Dictionary) -> bool:
	return bool(tile_at(state, cell).get("blocks_sight", false))


static func occupant_id(state, cell: Dictionary, except_actor_id: String = "") -> String:
	var ids: Array = state.units.keys()
	ids.sort()
	for id_variant in ids:
		var actor_id := str(id_variant)
		if actor_id == except_actor_id:
			continue
		var unit: Dictionary = state.units[actor_id]
		if bool(unit.get("alive", false)) and equal(Dictionary(unit["position"]), cell):
			return actor_id
	return ""


static func is_walkable(state, cell: Dictionary, actor_id: String) -> bool:
	return in_bounds(cell) and not blocks_movement(state, cell) and occupant_id(state, cell, actor_id).is_empty()


static func shortest_path(state, start: Dictionary, destination: Dictionary, actor_id: String) -> Array:
	if not in_bounds(start) or not is_walkable(state, destination, actor_id):
		return []
	var start_key := key(start)
	var destination_key := key(destination)
	if start_key == destination_key:
		return [start.duplicate(true)]
	var frontier: Array = [start.duplicate(true)]
	var came_from: Dictionary = {start_key: ""}
	while not frontier.is_empty():
		var current: Dictionary = frontier.pop_front()
		for direction in CARDINAL_DIRECTIONS:
			var next_cell := position(
				int(current["x"]) + int(direction["x"]),
				int(current["y"]) + int(direction["y"])
			)
			var next_key := key(next_cell)
			if came_from.has(next_key) or not is_walkable(state, next_cell, actor_id):
				continue
			came_from[next_key] = key(current)
			if next_key == destination_key:
				return _reconstruct_path(came_from, start_key, destination_key)
			frontier.append(next_cell)
	return []


static func reachable_cells(state, start: Dictionary, actor_id: String, maximum_steps: int) -> Array:
	var start_key := key(start)
	var frontier: Array = [start.duplicate(true)]
	var costs: Dictionary = {start_key: 0}
	var result: Array = []
	while not frontier.is_empty():
		var current: Dictionary = frontier.pop_front()
		var current_cost := int(costs[key(current)])
		if current_cost >= maximum_steps:
			continue
		for direction in CARDINAL_DIRECTIONS:
			var next_cell := position(
				int(current["x"]) + int(direction["x"]),
				int(current["y"]) + int(direction["y"])
			)
			var next_key := key(next_cell)
			if costs.has(next_key) or not is_walkable(state, next_cell, actor_id):
				continue
			costs[next_key] = current_cost + 1
			frontier.append(next_cell)
			result.append(next_cell)
	result.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return key(a) < key(b))
	return result


static func has_line_of_sight(state, start: Dictionary, destination: Dictionary) -> bool:
	var x0 := int(start["x"])
	var y0 := int(start["y"])
	var x1 := int(destination["x"])
	var y1 := int(destination["y"])
	var delta_x := absi(x1 - x0)
	var step_x := 1 if x0 < x1 else -1
	var delta_y := -absi(y1 - y0)
	var step_y := 1 if y0 < y1 else -1
	var error := delta_x + delta_y
	while true:
		if not (x0 == int(start["x"]) and y0 == int(start["y"])) and not (x0 == x1 and y0 == y1):
			if blocks_sight(state, position(x0, y0)):
				return false
		if x0 == x1 and y0 == y1:
			return true
		var double_error := 2 * error
		if double_error >= delta_y:
			error += delta_y
			x0 += step_x
		if double_error <= delta_x:
			error += delta_x
			y0 += step_y
	return true


static func cover_at(state, cell: Dictionary) -> int:
	return int(tile_at(state, cell).get("cover", 0))


static func _reconstruct_path(came_from: Dictionary, start_key: String, destination_key: String) -> Array:
	var reversed_path: Array = []
	var cursor := destination_key
	while not cursor.is_empty():
		reversed_path.append(from_key(cursor))
		if cursor == start_key:
			break
		cursor = str(came_from.get(cursor, ""))
	reversed_path.reverse()
	return reversed_path
