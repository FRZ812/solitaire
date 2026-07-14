extends Control

@onready var map_surface: Control = $MapSurface

var _window_message_callback: JavaScriptObject
var _browser_window: JavaScriptObject
var _browser_origin := ""


func _ready() -> void:
	map_surface.cell_selected.connect(_on_cell_selected)
	if OS.has_feature("web"):
		_connect_browser_bridge()
	else:
		_load_native_preview()


func _connect_browser_bridge() -> void:
	_browser_window = JavaScriptBridge.get_interface("window")
	_browser_origin = str(_browser_window.location.origin)
	_window_message_callback = JavaScriptBridge.create_callback(_on_window_message)
	_browser_window.addEventListener("message", _window_message_callback)
	_post_to_parent({"type": "solitaire-godot-ready"})


func _on_window_message(arguments: Array) -> void:
	if arguments.is_empty():
		return
	var event: JavaScriptObject = arguments[0]
	if str(event.origin) != _browser_origin:
		return
	var decoded: Variant = JSON.parse_string(str(event.data))
	if typeof(decoded) != TYPE_DICTIONARY:
		return
	if decoded.get("type", "") != "solitaire-map-scene":
		return
	var payload: Variant = decoded.get("payload", {})
	if typeof(payload) == TYPE_DICTIONARY:
		map_surface.set_scene(payload)


func _on_cell_selected(key: String) -> void:
	if OS.has_feature("web"):
		_post_to_parent({"type": "solitaire-godot-select", "key": key})
	else:
		print("SOLITAIRE_MAP_SELECT:", key)


func _post_to_parent(payload: Dictionary) -> void:
	if _browser_window == null:
		return
	_browser_window.parent.postMessage(JSON.stringify(payload), _browser_origin)


func _load_native_preview() -> void:
	if "--city-preview" in OS.get_cmdline_user_args():
		map_surface.set_scene(_build_city_preview())
		return
	var text := FileAccess.get_file_as_string("res://data/demo_world.json")
	var payload: Variant = JSON.parse_string(text)
	if typeof(payload) == TYPE_DICTIONARY:
		map_surface.set_scene(payload)
	else:
		push_error("Unable to parse res://data/demo_world.json")


func _build_city_preview() -> Dictionary:
	var cells: Array[Dictionary] = []
	var locations := {
		"2,7": {"name": "South Gate", "color": "#cf9458"},
		"2,5": {"name": "Public Wells", "color": "#62b8c5"},
		"5,5": {"name": "Grand Market", "color": "#efbd5c"},
		"8,5": {"name": "Butchers' Row", "color": "#c96c6c"},
		"2,2": {"name": "River Docks", "color": "#5aa8cf"},
		"5,2": {"name": "High Temple", "color": "#dca7e8"},
		"8,2": {"name": "Aurelian Spire", "color": "#f0cf69"},
	}
	for row in 9:
		for column in 11:
			var key := "%d,%d" % [column, row]
			var surface := "roof"
			if column == 10:
				surface = "river"
			elif column == 0 or row == 0 or row == 8:
				surface = "wall"
			elif column in [2, 5, 8] and row in [2, 5, 7]:
				surface = "plaza"
			elif column in [2, 5, 8]:
				surface = "avenue"
			elif row in [2, 5, 7]:
				surface = "street"
			elif column == 9:
				surface = "indoor"
			var location: Dictionary = locations.get(key, {})
			cells.append({
				"key": key, "x": column, "y": row,
				"col": column, "row": row, "surface": surface,
				"seen": true, "visited": true,
				"interactive": !location.is_empty(),
				"poi_name": str(location.get("name", "")),
				"quest": false,
				"marker_color": str(location.get("color", "#e9ae55")),
			})
	return {
		"version": 1, "mode": "city", "columns": 11, "rows": 9,
		"current_key": "2,7", "selected_key": "8,2", "night": false,
		"route": ["2,7", "2,6", "2,5", "3,5", "4,5", "5,5", "5,4", "5,3", "5,2", "6,2", "7,2", "8,2"],
		"cells": cells,
	}
