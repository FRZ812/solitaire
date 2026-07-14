extends Resource
class_name NamedRngBank

## Small, platform-stable Park-Miller streams keyed by a semantic name.
## Adding a draw to `loot` never shifts results from `combat` or `world`.

const MODULUS := 2147483647
const MULTIPLIER := 48271

var master_seed: int = 1
var _states: Dictionary = {}
var _draw_counts: Dictionary = {}


func setup(seed_value: int) -> void:
	master_seed = _normalize_seed(seed_value)
	_states.clear()
	_draw_counts.clear()


func next_int(stream_name: String, minimum: int, maximum: int) -> int:
	var preview := preview_int(stream_name, minimum, maximum)
	advance_to(stream_name, int(preview["state"]), int(preview["draw_count"]))
	return int(preview["value"])


func preview_int(stream_name: String, minimum: int, maximum: int) -> Dictionary:
	assert(maximum >= minimum, "RNG range must not be inverted")
	var prior_state := state_for(stream_name)
	var next_state: int = (prior_state * MULTIPLIER) % MODULUS
	var span: int = maximum - minimum + 1
	return {
		"value": minimum + (next_state % span),
		"prior_state": prior_state,
		"state": next_state,
		"draw_count": draw_count_for(stream_name) + 1,
	}


func advance_to(stream_name: String, next_state: int, next_draw_count: int) -> void:
	_states[stream_name] = _normalize_seed(next_state)
	_draw_counts[stream_name] = maxi(0, next_draw_count)


func state_for(stream_name: String) -> int:
	if _states.has(stream_name):
		return int(_states[stream_name])
	return _derive_stream_seed(stream_name)


func draw_count_for(stream_name: String) -> int:
	return int(_draw_counts.get(stream_name, 0))


func snapshot() -> Dictionary:
	var names: Array = _states.keys()
	names.sort()
	var streams: Dictionary = {}
	for stream_name_variant in names:
		var stream_name := str(stream_name_variant)
		streams[stream_name] = {
			"state": int(_states[stream_name]),
			"draw_count": int(_draw_counts.get(stream_name, 0)),
		}
	return {
		"algorithm": "park_miller_named_v1",
		"master_seed": master_seed,
		"streams": streams,
	}


func restore(data: Dictionary) -> void:
	setup(int(data.get("master_seed", 1)))
	var streams: Dictionary = data.get("streams", {})
	var names: Array = streams.keys()
	names.sort()
	for stream_name_variant in names:
		var stream_name := str(stream_name_variant)
		var stream_data: Dictionary = streams[stream_name]
		advance_to(
			stream_name,
			int(stream_data.get("state", _derive_stream_seed(stream_name))),
			int(stream_data.get("draw_count", 0))
		)


func _derive_stream_seed(stream_name: String) -> int:
	var value := master_seed
	for byte_value in stream_name.to_utf8_buffer():
		value = (value * 131 + int(byte_value) + 17) % MODULUS
	return _normalize_seed(value)


func _normalize_seed(value: int) -> int:
	var normalized: int = value % MODULUS
	if normalized < 0:
		normalized += MODULUS
	if normalized == 0:
		normalized = 1
	return normalized
