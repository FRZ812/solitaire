extends Control

signal cell_selected(key: String)

const MATERIAL_ATLAS: Texture2D = preload("res://assets/map_material_atlas.png")
const SQRT_3 := 1.7320508075688772
const WORLD_DIRECTIONS := [
	Vector2i(1, 0), Vector2i(1, -1), Vector2i(0, -1),
	Vector2i(-1, 0), Vector2i(-1, 1), Vector2i(0, 1),
]
const ATLAS_CELLS := {
	"plains": Vector2i(0, 0), "forest": Vector2i(1, 0),
	"hills": Vector2i(2, 0), "mountains": Vector2i(3, 0),
	"road": Vector2i(0, 1), "water": Vector2i(1, 1),
	"marsh": Vector2i(2, 1), "impassable": Vector2i(3, 1),
	"settlement": Vector2i(0, 2), "street": Vector2i(1, 2),
	"wall": Vector2i(2, 2), "indoor": Vector2i(3, 2),
	"plaza": Vector2i(0, 3), "avenue": Vector2i(1, 3),
	"river": Vector2i(2, 3), "roof": Vector2i(3, 3),
}

@onready var terrain_layer: Node2D = $TerrainLayer
@onready var route_layer: Node2D = $RouteLayer
@onready var marker_layer: Node2D = $MarkerLayer
@onready var fog: ColorRect = $Fog
@onready var player_layer: Node2D = $PlayerLayer

var scene_data: Dictionary = {}
var layout_entries: Array[Dictionary] = []
var center_by_key: Dictionary = {}
var hover_key := ""
var world_radius := 32.0
var city_cell_size := 48.0


func _ready() -> void:
	resized.connect(_rebuild)
	set_process_input(true)


func set_scene(next_scene: Dictionary) -> void:
	scene_data = next_scene.duplicate(true)
	_rebuild()


func _rebuild() -> void:
	if !is_node_ready() or size.x < 8.0 or size.y < 8.0:
		return
	_clear_layer(terrain_layer)
	_clear_layer(route_layer)
	_clear_layer(marker_layer)
	_clear_layer(player_layer)
	layout_entries.clear()
	center_by_key.clear()

	if scene_data.get("mode", "world") == "city":
		_build_city_layout()
	else:
		_build_world_layout()

	_build_terrain()
	_build_route()
	_build_markers()
	_update_fog()


func _clear_layer(layer: Node) -> void:
	for child in layer.get_children():
		child.free()


func _build_world_layout() -> void:
	var cells: Array = scene_data.get("cells", [])
	if cells.is_empty():
		return
	var origin: Dictionary = scene_data.get("origin", {"x": 0, "y": 0})
	var raw_centers: Array[Vector2] = []
	var min_x := INF
	var max_x := -INF
	var min_y := INF
	var max_y := -INF
	for cell_value in cells:
		var cell: Dictionary = cell_value
		var q := float(cell.get("x", 0) - origin.get("x", 0))
		var r := float(cell.get("y", 0) - origin.get("y", 0))
		var raw := Vector2(SQRT_3 * (q + r * 0.5), 1.5 * r)
		raw_centers.append(raw)
		min_x = min(min_x, raw.x)
		max_x = max(max_x, raw.x)
		min_y = min(min_y, raw.y)
		max_y = max(max_y, raw.y)

	var padding: float = clampf(min(size.x, size.y) * 0.025, 8.0, 20.0)
	var available := size - Vector2(padding * 2.0, padding * 2.0)
	world_radius = min(
		available.x / max(1.0, (max_x - min_x) + SQRT_3),
		available.y / max(1.0, (max_y - min_y) + 2.0)
	)
	var content := Vector2((max_x - min_x + SQRT_3) * world_radius, (max_y - min_y + 2.0) * world_radius)
	var offset := (size - content) * 0.5
	offset += Vector2((-min_x + SQRT_3 * 0.5) * world_radius, (-min_y + 1.0) * world_radius)

	for index in cells.size():
		var cell: Dictionary = cells[index]
		var center: Vector2 = offset + raw_centers[index] * world_radius
		var polygon := _hex_polygon(center, world_radius * 1.015)
		var entry := {"cell": cell, "key": str(cell.get("key", "")), "center": center, "polygon": polygon, "size": world_radius}
		layout_entries.append(entry)
		center_by_key[entry.key] = center


func _build_city_layout() -> void:
	var cells: Array = scene_data.get("cells", [])
	if cells.is_empty():
		return
	var columns := int(scene_data.get("columns", 11))
	var rows := int(scene_data.get("rows", 9))
	var padding: float = clampf(min(size.x, size.y) * 0.025, 8.0, 20.0)
	city_cell_size = min((size.x - padding * 2.0) / max(1, columns), (size.y - padding * 2.0) / max(1, rows))
	var content := Vector2(columns * city_cell_size, rows * city_cell_size)
	var offset := (size - content) * 0.5
	for cell_value in cells:
		var cell: Dictionary = cell_value
		var center := offset + Vector2((float(cell.get("col", 0)) + 0.5) * city_cell_size, (float(cell.get("row", 0)) + 0.5) * city_cell_size)
		var half := city_cell_size * 0.505
		var polygon := PackedVector2Array([
			center + Vector2(-half, -half), center + Vector2(half, -half),
			center + Vector2(half, half), center + Vector2(-half, half),
		])
		var entry := {"cell": cell, "key": str(cell.get("key", "")), "center": center, "polygon": polygon, "size": city_cell_size * 0.5}
		layout_entries.append(entry)
		center_by_key[entry.key] = center


func _build_terrain() -> void:
	var night := bool(scene_data.get("night", false))
	for entry in layout_entries:
		var cell: Dictionary = entry.cell
		var material_id := _material_for_cell(cell)
		var atlas_cell: Vector2i = ATLAS_CELLS.get(material_id, ATLAS_CELLS.impassable)
		var polygon_points: PackedVector2Array = entry.polygon
		var local_points := PackedVector2Array()
		for point in polygon_points:
			local_points.append(point - entry.center)

		if material_id in ["mountains", "wall", "settlement", "roof", "indoor"]:
			var shadow := Polygon2D.new()
			shadow.polygon = local_points
			shadow.position = entry.center + Vector2(0.0, entry.size * 0.11)
			shadow.color = Color(0.015, 0.025, 0.05, 0.42)
			terrain_layer.add_child(shadow)

		var tile := Polygon2D.new()
		tile.polygon = local_points
		tile.uv = _atlas_uvs(atlas_cell, local_points.size() == 6)
		tile.texture = MATERIAL_ATLAS
		tile.position = entry.center
		tile.color = Color(0.63, 0.7, 0.84, 1.0) if night else Color.WHITE
		terrain_layer.add_child(tile)

		if bool(cell.get("seen", true)):
			var sheen := Polygon2D.new()
			sheen.polygon = local_points
			sheen.position = entry.center
			sheen.color = Color(0.16, 0.35, 0.4, 0.06) if !cell.get("visited", false) else Color(1.0, 0.88, 0.55, 0.025)
			terrain_layer.add_child(sheen)


func _build_route() -> void:
	var route_keys: Array = scene_data.get("route", [])
	if route_keys.size() < 2:
		return
	var segments: Array[PackedVector2Array] = []
	var active := PackedVector2Array()
	for route_key in route_keys:
		var key := str(route_key)
		if center_by_key.has(key):
			active.append(center_by_key[key])
		else:
			if active.size() > 1:
				segments.append(active)
			active = PackedVector2Array()
	if active.size() > 1:
		segments.append(active)
	for points in segments:
		var shadow := Line2D.new()
		shadow.points = points
		shadow.width = max(8.0, _route_width() * 2.15)
		shadow.default_color = Color(0.03, 0.05, 0.1, 0.86)
		shadow.joint_mode = Line2D.LINE_JOINT_ROUND
		shadow.begin_cap_mode = Line2D.LINE_CAP_ROUND
		shadow.end_cap_mode = Line2D.LINE_CAP_ROUND
		route_layer.add_child(shadow)
		var line := Line2D.new()
		line.points = points
		line.width = _route_width()
		line.default_color = Color("ffe47c")
		line.joint_mode = Line2D.LINE_JOINT_ROUND
		line.begin_cap_mode = Line2D.LINE_CAP_ROUND
		line.end_cap_mode = Line2D.LINE_CAP_ROUND
		route_layer.add_child(line)


func _build_markers() -> void:
	var selected_key := str(scene_data.get("selected_key", ""))
	var current_key := str(scene_data.get("current_key", ""))
	for entry in layout_entries:
		var cell: Dictionary = entry.cell
		if !bool(cell.get("seen", true)):
			continue
		if entry.key == selected_key:
			_add_selection(entry)
		var poi_name := str(cell.get("poi_name", ""))
		if !poi_name.is_empty() and entry.key != current_key:
			_add_poi(entry, poi_name, str(cell.get("marker_color", "#efb957")), bool(cell.get("quest", false)))
		if entry.key == current_key:
			_add_player(entry)


func _add_selection(entry: Dictionary) -> void:
	var outline := Line2D.new()
	var points: PackedVector2Array = entry.polygon.duplicate()
	points.append(points[0])
	outline.points = points
	outline.width = max(3.0, entry.size * 0.075)
	outline.default_color = Color("fff09b")
	outline.joint_mode = Line2D.LINE_JOINT_ROUND
	marker_layer.add_child(outline)
	var glow := Line2D.new()
	glow.points = points
	glow.width = outline.width * 3.0
	glow.default_color = Color(1.0, 0.78, 0.25, 0.18)
	glow.joint_mode = Line2D.LINE_JOINT_ROUND
	marker_layer.add_child(glow)


func _add_poi(entry: Dictionary, title: String, color_hex: String, quest: bool) -> void:
	var holder := Node2D.new()
	holder.position = entry.center
	marker_layer.add_child(holder)
	var marker_size: float = clampf(float(entry.size) * 0.33, 8.0, 19.0)
	var shadow := Polygon2D.new()
	shadow.polygon = PackedVector2Array([Vector2(0, -marker_size), Vector2(marker_size, 0), Vector2(0, marker_size), Vector2(-marker_size, 0)])
	shadow.position = Vector2(2.0, 4.0)
	shadow.color = Color(0.01, 0.025, 0.06, 0.76)
	holder.add_child(shadow)
	var marker := Polygon2D.new()
	marker.polygon = shadow.polygon
	marker.color = Color(color_hex)
	holder.add_child(marker)
	var core := Polygon2D.new()
	core.polygon = PackedVector2Array([Vector2(0, -marker_size * 0.42), Vector2(marker_size * 0.42, 0), Vector2(0, marker_size * 0.42), Vector2(-marker_size * 0.42, 0)])
	core.color = Color("fff0b0")
	holder.add_child(core)
	if quest:
		var badge := Label.new()
		badge.text = "!"
		badge.position = Vector2(marker_size * 0.5, -marker_size * 1.1)
		badge.add_theme_font_size_override("font_size", int(clamp(entry.size * 0.28, 10.0, 16.0)))
		badge.add_theme_color_override("font_color", Color("fff28a"))
		holder.add_child(badge)
	if entry.key == str(scene_data.get("selected_key", "")):
		_add_marker_label(holder, title, entry.size)


func _add_player(entry: Dictionary) -> void:
	var holder := Node2D.new()
	holder.position = entry.center + Vector2(0.0, -entry.size * 0.05)
	player_layer.add_child(holder)
	var radius: float = clampf(float(entry.size) * 0.35, 10.0, 21.0)
	var shadow := Polygon2D.new()
	shadow.polygon = _ellipse_polygon(Vector2(radius * 1.05, radius * 0.38), 20)
	shadow.position = Vector2(0.0, radius * 0.9)
	shadow.color = Color(0.01, 0.02, 0.04, 0.58)
	holder.add_child(shadow)
	var cloak := Polygon2D.new()
	cloak.polygon = PackedVector2Array([
		Vector2(0.0, -radius * 1.55), Vector2(radius * 0.78, -radius * 0.32),
		Vector2(radius * 0.64, radius * 1.0), Vector2(0.0, radius * 1.26),
		Vector2(-radius * 0.64, radius * 1.0), Vector2(-radius * 0.78, -radius * 0.32),
	])
	cloak.color = Color("168ba0")
	holder.add_child(cloak)
	var hood := Polygon2D.new()
	hood.polygon = _ellipse_polygon(Vector2(radius * 0.72, radius * 0.62), 20)
	hood.position = Vector2(0.0, -radius * 0.62)
	hood.color = Color("27bdd0")
	holder.add_child(hood)
	var face := Polygon2D.new()
	face.polygon = _ellipse_polygon(Vector2(radius * 0.43, radius * 0.31), 18)
	face.position = Vector2(0.0, -radius * 0.5)
	face.color = Color("07162a")
	holder.add_child(face)
	var clasp := Polygon2D.new()
	clasp.polygon = _ellipse_polygon(Vector2(radius * 0.18, radius * 0.18), 14)
	clasp.position = Vector2(0.0, radius * 0.08)
	clasp.color = Color("f0b84f")
	holder.add_child(clasp)
	_add_marker_label(holder, "YOU", entry.size, radius * 1.35)


func _add_marker_label(holder: Node2D, text: String, scale_hint: float, y_offset := 22.0) -> void:
	var label := Label.new()
	var label_width: float = clampf(scale_hint * 2.5, 76.0, 150.0)
	label.text = text
	label.position = Vector2(-label_width * 0.5, y_offset)
	label.size = Vector2(label_width, 22.0)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	label.add_theme_font_size_override("font_size", int(clamp(scale_hint * 0.24, 9.0, 13.0)))
	label.add_theme_color_override("font_color", Color("fff3c4"))
	label.add_theme_color_override("font_shadow_color", Color(0.0, 0.0, 0.0, 0.9))
	label.add_theme_constant_override("shadow_offset_x", 1)
	label.add_theme_constant_override("shadow_offset_y", 2)
	holder.add_child(label)


func _update_fog() -> void:
	var material := fog.material as ShaderMaterial
	var fog_enabled: bool = str(scene_data.get("mode", "world")) == "world"
	material.set_shader_parameter("fog_enabled", fog_enabled)
	material.set_shader_parameter("fog_strength", 0.97 if bool(scene_data.get("night", false)) else 0.93)
	if !fog_enabled:
		material.set_shader_parameter("reveal_count", 0)
		return
	var centers := PackedVector2Array()
	var radii := PackedVector2Array()
	for entry in layout_entries:
		var cell: Dictionary = entry.cell
		if !bool(cell.get("seen", false)):
			continue
		centers.append(Vector2(entry.center.x / size.x, entry.center.y / size.y))
		var radius_scale := 1.28 if bool(cell.get("visited", false)) else 1.12
		radii.append(Vector2(SQRT_3 * entry.size * 0.58 * radius_scale / size.x, entry.size * 0.88 * radius_scale / size.y))
		if centers.size() >= 128:
			break
	material.set_shader_parameter("reveal_count", centers.size())
	material.set_shader_parameter("reveal_centers", centers)
	material.set_shader_parameter("reveal_radii", radii)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		var key := _key_at(event.position)
		if !key.is_empty():
			cell_selected.emit(key)
			accept_event()
	elif event is InputEventMouseMotion:
		var next_hover := _key_at(event.position)
		if next_hover != hover_key:
			hover_key = next_hover
			mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND if !hover_key.is_empty() else Control.CURSOR_ARROW


func _key_at(point: Vector2) -> String:
	for index in range(layout_entries.size() - 1, -1, -1):
		var entry: Dictionary = layout_entries[index]
		var cell: Dictionary = entry.cell
		if !bool(cell.get("interactive", false)):
			continue
		if Geometry2D.is_point_in_polygon(point, entry.polygon):
			return entry.key
	return ""


func _material_for_cell(cell: Dictionary) -> String:
	if scene_data.get("mode", "world") == "city":
		return str(cell.get("surface", "roof"))
	return str(cell.get("terrain", "impassable"))


func _atlas_uvs(atlas_cell: Vector2i, hexagonal: bool) -> PackedVector2Array:
	var texture_size := Vector2(MATERIAL_ATLAS.get_width(), MATERIAL_ATLAS.get_height())
	var atlas_size := texture_size / 4.0
	var inset: float = min(atlas_size.x, atlas_size.y) * 0.018
	var top_left := Vector2(atlas_cell) * atlas_size + Vector2(inset, inset)
	var usable := atlas_size - Vector2(inset * 2.0, inset * 2.0)
	if hexagonal:
		return PackedVector2Array([
			top_left + Vector2(usable.x * 0.5, 0.0),
			top_left + Vector2(usable.x, usable.y * 0.25),
			top_left + Vector2(usable.x, usable.y * 0.75),
			top_left + Vector2(usable.x * 0.5, usable.y),
			top_left + Vector2(0.0, usable.y * 0.75),
			top_left + Vector2(0.0, usable.y * 0.25),
		])
	return PackedVector2Array([
		top_left, top_left + Vector2(usable.x, 0.0),
		top_left + usable, top_left + Vector2(0.0, usable.y),
	])


func _hex_polygon(center: Vector2, radius: float) -> PackedVector2Array:
	return PackedVector2Array([
		center + Vector2(0.0, -radius),
		center + Vector2(SQRT_3 * 0.5 * radius, -0.5 * radius),
		center + Vector2(SQRT_3 * 0.5 * radius, 0.5 * radius),
		center + Vector2(0.0, radius),
		center + Vector2(-SQRT_3 * 0.5 * radius, 0.5 * radius),
		center + Vector2(-SQRT_3 * 0.5 * radius, -0.5 * radius),
	])


func _ellipse_polygon(radius: Vector2, segments: int) -> PackedVector2Array:
	var points := PackedVector2Array()
	for index in segments:
		var angle := TAU * float(index) / float(segments)
		points.append(Vector2(cos(angle) * radius.x, sin(angle) * radius.y))
	return points


func _route_width() -> float:
	return max(4.0, world_radius * 0.13) if scene_data.get("mode", "world") == "world" else max(4.0, city_cell_size * 0.1)
