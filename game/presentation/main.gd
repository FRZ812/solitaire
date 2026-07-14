extends Control

const TracerScenario = preload("res://domain/tracer_scenario.gd")
const CommandGateway = preload("res://domain/command_gateway.gd")
const EnemyAI = preload("res://domain/enemy_utility_ai.gd")
const GridRules = preload("res://domain/grid_rules.gd")
const TacticalRules = preload("res://domain/tactical_rules.gd")
const StateHash = preload("res://domain/state_hash.gd")
const BattleState = preload("res://domain/battle_state.gd")

const SURFACE_TEXTURE: Texture2D = preload("res://assets/ui/surfaces/ui-command-surfaces-whitemarch-v1.png")
const ACTION_TEXTURE: Texture2D = preload("res://assets/ui/icons/ui-action-icons-whitemarch-v1.png")
const PORTRAIT_TEXTURE: Texture2D = preload("res://assets/ui/portraits/ui-combat-portraits-whitemarch-v1.png")
const ACTOR_TEXTURE: Texture2D = preload("res://assets/actors/actors-whitemarch-oil-anime-v2.png")

const GRID_WIDTH := 7
const GRID_HEIGHT := 9
const CELL_SIZE := 1.08
const MIN_CELL_HIT_SIZE := 80.0
const SHEET_CELL := 627
const SURFACE_DOCK := 0
const SURFACE_VELLUM := 1
const SURFACE_ACTION := 2
const SURFACE_COMMIT := 3
const PLAYER_SIDE := "company"
const SAVE_PATH := "user://alder_ford_save.json"
const SAVE_FORMAT := "alder_ford_tactical_battle"
const SAVE_FORMAT_VERSION := 1
const INTERNAL_CANVAS_SIZE := Vector2(720, 1280)
const DOCK_BAND_HEIGHT := 413.0

const INK := Color("#172329")
const PARCHMENT := Color("#eee7d3")
const CIVIC_BLUE := Color("#376d8d")
const MOVE_COLOR := Color(0.29, 0.75, 0.84, 0.52)
const PATH_COLOR := Color(0.72, 0.94, 1.0, 0.82)
const ATTACK_COLOR := Color(0.88, 0.38, 0.25, 0.68)

var _state
var _board_container: SubViewportContainer
var _subviewport: SubViewport
var _world_root: Node3D
var _camera: Camera3D
var _status_label: Label
var _unit_label: Label
var _unit_role_label: Label
var _portrait_rect: TextureRect
var _hp_bar: ProgressBar
var _hp_label: Label
var _condition_label: Label
var _forecast_label: Label
var _confirm_button: Button
var _cancel_button: Button
var _move_button: Button
var _attack_button: Button
var _guard_button: Button
var _end_turn_button: Button
var _pause_sheet: Control
var _chronicle_sheet: Control
var _chronicle_title: Label
var _chronicle_text: RichTextLabel

var _tile_markers: Dictionary = {}
var _actor_nodes: Dictionary = {}
var _action_log: Array[String] = []
var _input_locked := false
var _mode := ""
var _pending_command: Dictionary = {}
var _pending_cells: Array = []
var _battle_revision := 0
var _ai_runner_active := false
var _queued_ai_revision := -1

var _mat_grass: StandardMaterial3D
var _mat_path: StandardMaterial3D
var _mat_stone: StandardMaterial3D
var _mat_mortar: StandardMaterial3D
var _mat_wood: StandardMaterial3D
var _mat_reed: StandardMaterial3D
var _mat_water: StandardMaterial3D
var _mat_move: StandardMaterial3D
var _mat_path_preview: StandardMaterial3D
var _mat_attack: StandardMaterial3D


func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	theme = _build_theme()
	_build_materials()
	_build_layout()
	_build_world()
	_reset_battle()


func _build_layout() -> void:
	var safe_insets := _display_safe_insets_logical()
	var safe_left := maxf(20.0, safe_insets.x)
	var safe_top := maxf(0.0, safe_insets.y)
	var safe_right := maxf(20.0, safe_insets.z)
	var safe_bottom := maxf(20.0, safe_insets.w)

	var backdrop := ColorRect.new()
	backdrop.color = Color("#b9d5d2")
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(backdrop)
	move_child(backdrop, 0)

	_board_container = SubViewportContainer.new()
	_board_container.name = "TacticalBoard"
	_board_container.anchor_right = 1.0
	_board_container.offset_bottom = 867.0
	_board_container.stretch = true
	_board_container.mouse_filter = Control.MOUSE_FILTER_STOP
	_board_container.gui_input.connect(_on_board_input)
	add_child(_board_container)

	_subviewport = SubViewport.new()
	_subviewport.name = "WorldViewport"
	_subviewport.size = Vector2i(720, 867)
	_subviewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_subviewport.physics_object_picking = false
	_board_container.add_child(_subviewport)

	var board_veil := ColorRect.new()
	board_veil.color = Color(0.05, 0.09, 0.10, 0.08)
	board_veil.anchor_right = 1.0
	board_veil.offset_bottom = 867.0
	board_veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(board_veil)

	var top_band := NinePatchRect.new()
	top_band.name = "FieldFolioTopBand"
	top_band.texture = _surface_atlas(SURFACE_DOCK)
	top_band.patch_margin_left = 48
	top_band.patch_margin_top = 30
	top_band.patch_margin_right = 48
	top_band.patch_margin_bottom = 30
	top_band.anchor_right = 1.0
	top_band.offset_bottom = 87.0 + safe_top
	top_band.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(top_band)

	var title := Label.new()
	title.text = "Alder Ford Tollhouse"
	title.position = Vector2(safe_left + 6, safe_top + 9)
	title.size = Vector2(560, 34)
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", Color("#f5edda"))
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top_band.add_child(title)

	_status_label = Label.new()
	_status_label.position = Vector2(safe_left + 7, safe_top + 43)
	_status_label.size = Vector2(560, 30)
	_status_label.add_theme_font_size_override("font_size", 20)
	_status_label.add_theme_color_override("font_color", Color("#bfe1e4"))
	_status_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top_band.add_child(_status_label)

	var menu_button := _text_button("Menu", _open_pause_sheet, "utility")
	menu_button.name = "MenuButton"
	menu_button.position = Vector2(720.0 - safe_right - 80.0, safe_top + 4)
	menu_button.size = Vector2(80, 80)
	top_band.add_child(menu_button)

	var dock := NinePatchRect.new()
	dock.name = "FieldFolioCommandDock"
	dock.texture = _surface_atlas(SURFACE_DOCK)
	dock.patch_margin_left = 58
	dock.patch_margin_top = 58
	dock.patch_margin_right = 58
	dock.patch_margin_bottom = 58
	dock.anchor_top = 1.0
	dock.anchor_right = 1.0
	dock.anchor_bottom = 1.0
	dock.offset_top = -(DOCK_BAND_HEIGHT + safe_bottom)
	dock.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dock)

	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", int(ceilf(safe_left)))
	# The painted dock begins at y=847 (508 physical pixels). Its first twelve
	# physical pixels overlap the field as a visual shadow; interactive content
	# starts immediately and the dock itself blocks board input underneath.
	margin.add_theme_constant_override("margin_top", 0)
	margin.add_theme_constant_override("margin_right", int(ceilf(safe_right)))
	margin.add_theme_constant_override("margin_bottom", int(ceilf(safe_bottom)))
	dock.add_child(margin)

	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 0)
	margin.add_child(content)

	var context_panel := PanelContainer.new()
	context_panel.name = "ActiveContextRail"
	context_panel.custom_minimum_size = Vector2(0, 80)
	context_panel.add_theme_stylebox_override("panel", _texture_style(SURFACE_VELLUM, 24, 0))
	content.add_child(context_panel)

	var context_margin := MarginContainer.new()
	context_margin.add_theme_constant_override("margin_left", 10)
	context_margin.add_theme_constant_override("margin_right", 10)
	context_panel.add_child(context_margin)

	var context_row := HBoxContainer.new()
	context_row.add_theme_constant_override("separation", 10)
	context_margin.add_child(context_row)

	_portrait_rect = TextureRect.new()
	_portrait_rect.custom_minimum_size = Vector2(64, 64)
	_portrait_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_portrait_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_portrait_rect.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_portrait_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	context_row.add_child(_portrait_rect)

	var identity_column := VBoxContainer.new()
	identity_column.custom_minimum_size = Vector2(190, 0)
	identity_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	identity_column.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	identity_column.alignment = BoxContainer.ALIGNMENT_CENTER
	identity_column.add_theme_constant_override("separation", 0)
	context_row.add_child(identity_column)

	_unit_label = Label.new()
	_unit_label.add_theme_font_size_override("font_size", 24)
	_unit_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	identity_column.add_child(_unit_label)

	_unit_role_label = Label.new()
	_unit_role_label.add_theme_font_size_override("font_size", 20)
	_unit_role_label.add_theme_color_override("font_color", CIVIC_BLUE.darkened(0.22))
	_unit_role_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	identity_column.add_child(_unit_role_label)

	var health_column := VBoxContainer.new()
	health_column.custom_minimum_size = Vector2(180, 0)
	health_column.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	health_column.alignment = BoxContainer.ALIGNMENT_CENTER
	health_column.add_theme_constant_override("separation", 1)
	context_row.add_child(health_column)

	_hp_label = Label.new()
	_hp_label.add_theme_font_size_override("font_size", 20)
	_hp_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	health_column.add_child(_hp_label)

	_hp_bar = ProgressBar.new()
	_hp_bar.custom_minimum_size = Vector2(180, 20)
	_hp_bar.show_percentage = false
	_hp_bar.add_theme_stylebox_override("background", _flat_style(Color("#d8cfb7"), 1, Color("#495860"), 3))
	_hp_bar.add_theme_stylebox_override("fill", _flat_style(Color("#3f7890"), 0, Color.TRANSPARENT, 3))
	health_column.add_child(_hp_bar)

	_condition_label = Label.new()
	_condition_label.add_theme_font_size_override("font_size", 20)
	_condition_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_condition_label.add_theme_color_override("font_color", Color("#6c4d2f"))
	_condition_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	health_column.add_child(_condition_label)

	var chronicle_button := _text_button("Log", _open_chronicle_sheet, "utility")
	chronicle_button.name = "ChronicleButton"
	chronicle_button.custom_minimum_size = Vector2(80, 80)
	context_row.add_child(chronicle_button)

	var forecast_panel := PanelContainer.new()
	forecast_panel.name = "ForecastCard"
	forecast_panel.custom_minimum_size = Vector2(0, 107)
	forecast_panel.add_theme_stylebox_override("panel", _texture_style(SURFACE_VELLUM, 24, 20))
	content.add_child(forecast_panel)

	_forecast_label = Label.new()
	_forecast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	_forecast_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_forecast_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_forecast_label.add_theme_font_size_override("font_size", 22)
	forecast_panel.add_child(_forecast_label)

	var action_row := HBoxContainer.new()
	action_row.name = "ActionTray"
	action_row.custom_minimum_size = Vector2(0, 130)
	action_row.add_theme_constant_override("separation", 14)
	content.add_child(action_row)

	_move_button = _action_button("Move", 0, _on_move_pressed)
	_attack_button = _action_button("Attack", 1, _on_attack_pressed)
	_guard_button = _action_button("Guard", 2, _on_guard_pressed)
	_end_turn_button = _action_button("Wait", 3, _on_end_turn_pressed)
	_move_button.name = "MoveButton"
	_attack_button.name = "AttackButton"
	_guard_button.name = "GuardButton"
	_end_turn_button.name = "WaitButton"
	action_row.add_child(_move_button)
	action_row.add_child(_attack_button)
	action_row.add_child(_guard_button)
	action_row.add_child(_end_turn_button)

	var control_row := HBoxContainer.new()
	control_row.name = "CommitmentRow"
	control_row.custom_minimum_size = Vector2(0, 96)
	control_row.add_theme_constant_override("separation", 14)
	content.add_child(control_row)

	_cancel_button = _text_button("Cancel", _clear_pending, "utility")
	_cancel_button.name = "CancelButton"
	_cancel_button.custom_minimum_size = Vector2(107, 80)
	control_row.add_child(_cancel_button)

	_confirm_button = _text_button("Not ready · Select a command", _on_confirm_pressed, "commit")
	_confirm_button.name = "ConfirmButton"
	_confirm_button.accessibility_name = "Commit command"
	_confirm_button.tooltip_text = "Select a command to enable commitment."
	_confirm_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	control_row.add_child(_confirm_button)

	_build_pause_sheet()
	_build_chronicle_sheet()


func _display_safe_insets_logical() -> Vector4:
	var screen_size := DisplayServer.screen_get_size()
	if screen_size.x <= 0 or screen_size.y <= 0:
		return Vector4.ZERO
	var screen_position := DisplayServer.screen_get_position()
	var safe_area := DisplayServer.get_display_safe_area()
	if safe_area.size.x <= 0 or safe_area.size.y <= 0:
		return Vector4.ZERO
	var left_physical := maxi(0, safe_area.position.x - screen_position.x)
	var top_physical := maxi(0, safe_area.position.y - screen_position.y)
	var right_physical := maxi(0, screen_position.x + screen_size.x - safe_area.end.x)
	var bottom_physical := maxi(0, screen_position.y + screen_size.y - safe_area.end.y)
	return Vector4(
		ceilf(float(left_physical) * INTERNAL_CANVAS_SIZE.x / float(screen_size.x)),
		ceilf(float(top_physical) * INTERNAL_CANVAS_SIZE.y / float(screen_size.y)),
		ceilf(float(right_physical) * INTERNAL_CANVAS_SIZE.x / float(screen_size.x)),
		ceilf(float(bottom_physical) * INTERNAL_CANVAS_SIZE.y / float(screen_size.y))
	)


func _build_pause_sheet() -> void:
	_pause_sheet = Control.new()
	_pause_sheet.name = "PauseSheet"
	_pause_sheet.process_mode = Node.PROCESS_MODE_WHEN_PAUSED
	_pause_sheet.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pause_sheet.mouse_filter = Control.MOUSE_FILTER_STOP
	_pause_sheet.visible = false
	add_child(_pause_sheet)

	var scrim := ColorRect.new()
	scrim.color = Color(0.04, 0.07, 0.09, 0.72)
	scrim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scrim.mouse_filter = Control.MOUSE_FILTER_STOP
	_pause_sheet.add_child(scrim)

	var panel := PanelContainer.new()
	panel.anchor_left = 0.10
	panel.anchor_top = 0.16
	panel.anchor_right = 0.90
	panel.anchor_bottom = 0.67
	panel.add_theme_stylebox_override("panel", _texture_style(SURFACE_VELLUM, 30, 28))
	_pause_sheet.add_child(panel)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	panel.add_child(column)

	var heading := Label.new()
	heading.text = "Field folio"
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	heading.add_theme_font_size_override("font_size", 30)
	column.add_child(heading)

	var explanation := Label.new()
	explanation.text = "Battle is paused. Campaign records and encounter controls live here."
	explanation.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	explanation.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	explanation.add_theme_font_size_override("font_size", 20)
	column.add_child(explanation)

	var save_button := _text_button("Save battle", _save_from_pause, "utility")
	column.add_child(save_button)
	var load_button := _text_button("Load battle", _load_from_pause, "utility")
	column.add_child(load_button)
	var reset_button := _text_button("Restart encounter", _reset_from_pause, "utility")
	column.add_child(reset_button)
	var resume_button := _text_button("Return to battle", _close_pause_sheet, "commit")
	column.add_child(resume_button)


func _build_chronicle_sheet() -> void:
	_chronicle_sheet = Control.new()
	_chronicle_sheet.name = "ChronicleSheet"
	_chronicle_sheet.process_mode = Node.PROCESS_MODE_WHEN_PAUSED
	_chronicle_sheet.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_chronicle_sheet.mouse_filter = Control.MOUSE_FILTER_STOP
	_chronicle_sheet.visible = false
	add_child(_chronicle_sheet)

	var scrim := ColorRect.new()
	scrim.color = Color(0.04, 0.07, 0.09, 0.62)
	scrim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scrim.mouse_filter = Control.MOUSE_FILTER_STOP
	_chronicle_sheet.add_child(scrim)

	var panel := PanelContainer.new()
	panel.anchor_left = 0.04
	panel.anchor_top = 0.22
	panel.anchor_right = 0.96
	panel.anchor_bottom = 0.98
	panel.add_theme_stylebox_override("panel", _texture_style(SURFACE_VELLUM, 30, 26))
	_chronicle_sheet.add_child(panel)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	panel.add_child(column)

	var header := HBoxContainer.new()
	header.custom_minimum_size = Vector2(0, 80)
	header.add_theme_constant_override("separation", 10)
	column.add_child(header)

	_chronicle_title = Label.new()
	_chronicle_title.text = "Combat chronicle"
	_chronicle_title.add_theme_font_size_override("font_size", 30)
	_chronicle_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_chronicle_title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	header.add_child(_chronicle_title)

	var close_button := _text_button("Close", _close_chronicle_sheet, "utility")
	close_button.custom_minimum_size = Vector2(110, 80)
	header.add_child(close_button)

	_chronicle_text = RichTextLabel.new()
	_chronicle_text.bbcode_enabled = false
	_chronicle_text.add_theme_font_size_override("normal_font_size", 22)
	_chronicle_text.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_chronicle_text.scroll_active = true
	column.add_child(_chronicle_text)


func _open_pause_sheet() -> void:
	_chronicle_sheet.visible = false
	_pause_sheet.visible = true
	get_tree().paused = true


func _close_pause_sheet() -> void:
	_pause_sheet.visible = false
	get_tree().paused = false


func _save_from_pause() -> void:
	_on_save_pressed()
	_close_pause_sheet()


func _load_from_pause() -> void:
	_on_load_pressed()
	_close_pause_sheet()


func _reset_from_pause() -> void:
	_close_pause_sheet()
	_reset_battle()


func _open_chronicle_sheet() -> void:
	_pause_sheet.visible = false
	_chronicle_title.text = "Combat chronicle · Pulse %d" % (_state.pulse + 1)
	_chronicle_text.text = "No commands have resolved yet." if _action_log.is_empty() else "\n\n".join(_action_log)
	_chronicle_sheet.visible = true
	get_tree().paused = true


func _close_chronicle_sheet() -> void:
	_chronicle_sheet.visible = false
	get_tree().paused = false


func _build_world() -> void:
	_world_root = Node3D.new()
	_world_root.name = "WhitemarchTollhouse3D"
	_subviewport.add_child(_world_root)

	var environment_node := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#9dc9cf")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#c7d7cb")
	environment.ambient_light_energy = 0.48
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment_node.environment = environment
	_world_root.add_child(environment_node)

	var sunlight := DirectionalLight3D.new()
	sunlight.rotation_degrees = Vector3(-52, -28, 0)
	sunlight.light_color = Color("#fff0c7")
	sunlight.light_energy = 0.92
	sunlight.shadow_enabled = true
	_world_root.add_child(sunlight)

	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-38, 145, 0)
	fill.light_color = Color("#9fd0df")
	fill.light_energy = 0.22
	fill.shadow_enabled = false
	_world_root.add_child(fill)

	_camera = Camera3D.new()
	_camera.name = "TacticalCamera"
	_camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	_camera.size = 11.4
	_world_root.add_child(_camera)
	_camera.position = Vector3(0.0, 10.0, 9.4)
	_camera.look_at(Vector3(0.0, 0.0, -0.15), Vector3.UP)
	_camera.current = true

	_add_box(Vector3(10.6, 0.18, 16.0), Vector3(0, -0.18, 0), _mat_grass, _world_root, "MeadowGround")
	_add_box(Vector3(2.2, 0.10, 16.0), Vector3(-4.85, -0.06, 0), _mat_water, _world_root, "WhitewendRiver")
	_add_box(Vector3(0.18, 0.12, 16.0), Vector3(-3.95, -0.02, 0), _mat_reed, _world_root, "RiverBank")

	for y in range(GRID_HEIGHT):
		for x in range(GRID_WIDTH):
			_create_tile(x, y)

	_build_tollhouse_props()


func _create_tile(x: int, y: int) -> void:
	var cell := {"x": x, "y": y}
	var world_position := _cell_position(cell)
	var body := StaticBody3D.new()
	body.name = "Cell_%d_%d" % [x, y]
	body.position = world_position
	body.set_meta("cell", cell)
	body.collision_layer = 1
	body.collision_mask = 0
	_world_root.add_child(body)

	var tile_mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(CELL_SIZE - 0.035, 0.10, CELL_SIZE - 0.035)
	tile_mesh.mesh = box
	var path_band: bool = x in [2, 3, 4]
	tile_mesh.material_override = _tile_material(x, y, path_band)
	body.add_child(tile_mesh)
	_add_painterly_breakup(body, x, y, path_band)

	var collider := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(CELL_SIZE - 0.02, 0.14, CELL_SIZE - 0.02)
	collider.shape = shape
	body.add_child(collider)

	var marker := MeshInstance3D.new()
	marker.name = "CommandMarker"
	var marker_box := BoxMesh.new()
	marker_box.size = Vector3(CELL_SIZE - 0.12, 0.035, CELL_SIZE - 0.12)
	marker.mesh = marker_box
	marker.position.y = 0.085
	marker.material_override = _mat_move
	marker.visible = false
	body.add_child(marker)
	_tile_markers[GridRules.key(cell)] = marker


func _build_tollhouse_props() -> void:
	# A low black-stone wall with pale mortar anchors the grounded Whitemarch identity.
	var wall_center := _cell_position({"x": 3, "y": 4})
	for index in range(4):
		var offset := Vector3((index - 1.5) * 0.32, 0.28 + (index % 2) * 0.06, (index % 2) * 0.11 - 0.05)
		var stone := _add_box(Vector3(0.38, 0.48, 0.58), wall_center + offset, _mat_stone, _world_root, "CollapsedWallStone")
		stone.rotation_degrees.y = -9.0 + index * 6.0
	_add_box(Vector3(1.35, 0.06, 0.68), wall_center + Vector3(0, 0.08, 0), _mat_mortar, _world_root, "MortarBed")

	# Historically plausible woven osier hurdle.
	var hurdle_center := _cell_position({"x": 1, "y": 4})
	for post_x in [-0.38, 0.0, 0.38]:
		_add_cylinder(0.035, 0.72, hurdle_center + Vector3(post_x, 0.36, 0), _mat_wood, _world_root, "HurdleStake")
	for strand in range(4):
		var rail := _add_box(Vector3(0.90, 0.045, 0.055), hurdle_center + Vector3(0, 0.18 + strand * 0.13, 0), _mat_reed, _world_root, "OsierWeave")
		rail.rotation_degrees.y = -4.0 if strand % 2 == 0 else 4.0

	# Abandoned medicine cart, built from timber rather than fantasy ornament.
	var cart_center := _cell_position({"x": 5, "y": 4})
	_add_box(Vector3(0.88, 0.28, 0.62), cart_center + Vector3(0, 0.34, 0), _mat_wood, _world_root, "CartBed")
	_add_box(Vector3(0.08, 0.08, 1.12), cart_center + Vector3(0, 0.28, 0.52), _mat_wood, _world_root, "CartShaft")
	for wheel_x in [-0.50, 0.50]:
		var wheel := MeshInstance3D.new()
		var torus := TorusMesh.new()
		torus.inner_radius = 0.22
		torus.outer_radius = 0.31
		wheel.mesh = torus
		wheel.material_override = _mat_wood
		wheel.position = cart_center + Vector3(wheel_x, 0.30, 0)
		wheel.rotation_degrees.z = 90
		_world_root.add_child(wheel)

	var milestone := _add_box(Vector3(0.48, 0.82, 0.34), _cell_position({"x": 0, "y": 3}) + Vector3(0, 0.38, 0), _mat_stone, _world_root, "FallenMilestone")
	milestone.rotation_degrees = Vector3(0, 16, 67)

	var post_center := _cell_position({"x": 6, "y": 3})
	_add_box(Vector3(0.18, 1.25, 0.18), post_center + Vector3(-0.30, 0.60, 0), _mat_wood, _world_root, "BrokenTollPost")
	var lintel := _add_box(Vector3(0.80, 0.16, 0.18), post_center + Vector3(0.05, 0.96, 0), _mat_wood, _world_root, "BrokenTollLintel")
	lintel.rotation_degrees.z = -13

	# Framing ruins beyond the playable grid add real depth without affecting rules.
	_add_box(Vector3(1.7, 0.45, 0.42), Vector3(3.75, 0.16, -4.75), _mat_stone, _world_root, "TollhouseRuinNorth")
	_add_box(Vector3(0.42, 0.58, 1.9), Vector3(3.75, 0.22, -4.15), _mat_stone, _world_root, "TollhouseRuinEast")
	_add_box(Vector3(1.3, 0.09, 0.75), Vector3(0.2, 0.12, 5.15), _mat_wood, _world_root, "MedicineCrate")


func _reset_battle() -> void:
	_battle_revision += 1
	_state = TracerScenario.create()
	_mode = ""
	_pending_command.clear()
	_pending_cells.clear()
	_input_locked = false
	_action_log = [
		"The brigands hold the medicine cart beyond the ruined toll garden.",
		"Choose Move or Attack, select a board cell, then confirm.",
	]
	_rebuild_actor_nodes()
	_refresh_all("Choose a command.")


func _on_save_pressed() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		_refresh_all("Could not open the campaign save file.")
		return
	var snapshot: Dictionary = _state.to_snapshot(true)
	var save_document := {
		"save_format": SAVE_FORMAT,
		"save_format_version": SAVE_FORMAT_VERSION,
		"expected_state_hash": StateHash.of_value(snapshot),
		"state": snapshot,
	}
	file.store_string(JSON.stringify(save_document, "\t"))
	file.close()
	_action_log.append("Battle state saved at pulse %d." % _state.pulse)
	_refresh_all("Battle saved · deterministic history and named RNG retained.")


func _on_load_pressed() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		_refresh_all("No Alder Ford save exists yet.")
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		_refresh_all("The save file could not be read.")
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if parsed == null or not parsed is Dictionary:
		_refresh_all("The save file is not valid JSON battle data.")
		return
	var save_document := Dictionary(parsed)
	if str(save_document.get("save_format", "")) != SAVE_FORMAT or int(save_document.get("save_format_version", 0)) != SAVE_FORMAT_VERSION:
		_refresh_all("The save uses an unsupported or unhashed battle format.")
		return
	var expected_hash := str(save_document.get("expected_state_hash", ""))
	var snapshot_variant: Variant = save_document.get("state")
	if expected_hash.is_empty() or not snapshot_variant is Dictionary:
		_refresh_all("The save is missing its state or integrity hash.")
		return
	var restored_state = BattleState.from_snapshot(Dictionary(snapshot_variant))
	if restored_state == null:
		_refresh_all("The save uses an unsupported battle schema.")
		return
	var restored_hash := StateHash.of_state(restored_state)
	if restored_hash != expected_hash:
		_refresh_all("Save integrity check failed; the current battle was left unchanged.")
		return
	_battle_revision += 1
	var load_revision := _battle_revision
	_state = restored_state
	_mode = ""
	_pending_command.clear()
	_pending_cells.clear()
	_input_locked = false
	_action_log.clear()
	_append_result_log({"events": _state.history})
	_action_log.append("Saved timeline restored at pulse %d." % _state.pulse)
	_rebuild_actor_nodes()
	_refresh_all("Battle loaded · saved state hash verified.")
	if _state.status == "active":
		var active_id: String = _state.active_actor_id()
		if not active_id.is_empty() and not bool(Dictionary(_state.units[active_id]).get("controllable", false)):
			_input_locked = true
			call_deferred("_resume_loaded_ai", load_revision)


func _resume_loaded_ai(expected_revision: int) -> void:
	if expected_revision != _battle_revision:
		return
	await _run_enemy_turns(expected_revision)


func _rebuild_actor_nodes() -> void:
	for actor_variant in _actor_nodes.values():
		var actor_node: Node = actor_variant
		actor_node.queue_free()
	_actor_nodes.clear()
	var ids: Array = _state.units.keys()
	ids.sort()
	for id_variant in ids:
		var actor_id := str(id_variant)
		var unit: Dictionary = _state.units[actor_id]
		var actor_root := Node3D.new()
		actor_root.name = actor_id
		actor_root.position = _cell_position(Dictionary(unit["position"]))
		_world_root.add_child(actor_root)

		var shadow := MeshInstance3D.new()
		var shadow_mesh := CylinderMesh.new()
		shadow_mesh.top_radius = 0.36
		shadow_mesh.bottom_radius = 0.43
		shadow_mesh.height = 0.018
		shadow.mesh = shadow_mesh
		shadow.material_override = _transparent_material(Color(0.04, 0.05, 0.05, 0.32), 1.0)
		shadow.position.y = 0.075
		actor_root.add_child(shadow)

		var ring := MeshInstance3D.new()
		var ring_mesh := TorusMesh.new()
		ring_mesh.inner_radius = 0.39
		ring_mesh.outer_radius = 0.48
		ring.mesh = ring_mesh
		ring.material_override = _transparent_material(CIVIC_BLUE if str(unit["side"]) == PLAYER_SIDE else Color("#a54d3f"), 0.85)
		ring.position.y = 0.105
		ring.visible = false
		actor_root.add_child(ring)

		var sprite := Sprite3D.new()
		sprite.texture = _actor_atlas(actor_id)
		sprite.pixel_size = 0.00272
		sprite.position.y = 0.92
		sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		# Preserve the generated brush-soft alpha fringe. Alpha cutout made the
		# high-resolution painted silhouettes look jagged against the 3D field.
		sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISABLED
		sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		actor_root.add_child(sprite)
		_actor_nodes[actor_id] = actor_root


func _refresh_all(message: String = "") -> void:
	_refresh_actor_visuals()
	_refresh_markers()
	_refresh_hud(message)


func _refresh_actor_visuals() -> void:
	for id_variant in _actor_nodes.keys():
		var actor_id := str(id_variant)
		var unit: Dictionary = _state.units[actor_id]
		var actor_root: Node3D = _actor_nodes[actor_id]
		actor_root.visible = bool(unit.get("alive", false))
		actor_root.position = _cell_position(Dictionary(unit["position"]))
		var ring: MeshInstance3D = actor_root.get_child(1)
		ring.visible = actor_id == _state.active_actor_id() or str(_pending_command.get("target_id", "")) == actor_id
		if str(_pending_command.get("target_id", "")) == actor_id:
			ring.material_override = _mat_attack
		else:
			ring.material_override = _transparent_material(CIVIC_BLUE if str(unit["side"]) == PLAYER_SIDE else Color("#a54d3f"), 0.85)
		var sprite: Sprite3D = actor_root.get_child(2)
		sprite.modulate = Color(0.82, 0.92, 1.0, 1.0) if bool(unit.get("guarding", false)) else Color.WHITE


func _refresh_markers() -> void:
	for marker_variant in _tile_markers.values():
		var marker: MeshInstance3D = marker_variant
		marker.visible = false
	if _state.status != "active" or _input_locked:
		return
	var actor_id: String = _state.active_actor_id()
	if actor_id.is_empty():
		return
	var actor: Dictionary = _state.units[actor_id]
	if not bool(actor.get("controllable", false)):
		return
	if _pending_command.is_empty():
		if _mode == "move":
			var reachable := GridRules.reachable_cells(_state, Dictionary(actor["position"]), actor_id, int(actor["move"]))
			for cell_variant in reachable:
				_set_marker(Dictionary(cell_variant), _mat_move)
		elif _mode == "attack":
			for target_id_variant in _state.living_unit_ids():
				var target_id := str(target_id_variant)
				var target: Dictionary = _state.units[target_id]
				if str(target["side"]) == str(actor["side"]):
					continue
				if _best_attack_mode(actor_id, target_id).is_empty():
					continue
				_set_marker(Dictionary(target["position"]), _mat_attack)
	else:
		if str(_pending_command.get("type", "")) == "move":
			for cell_variant in _pending_cells:
				_set_marker(Dictionary(cell_variant), _mat_path_preview)
		elif str(_pending_command.get("type", "")) == "attack":
			var target: Dictionary = _state.units[str(_pending_command["target_id"])]
			_set_marker(Dictionary(target["position"]), _mat_attack)


func _refresh_hud(message: String = "") -> void:
	var active_id: String = _state.active_actor_id()
	var is_player_turn := false
	if _state.status == "finished":
		_status_label.text = "Encounter resolved · Pulse %d" % (_state.pulse + 1)
		_portrait_rect.texture = null
		_hp_bar.max_value = 1
		_hp_bar.value = 0
		_hp_label.text = "Road status"
		_condition_label.text = str(_state.victor).capitalize() + " victory"
		if _state.victor == PLAYER_SIDE:
			_unit_label.text = "The winter road is open"
			_unit_role_label.text = "The medicine cart may pass Alder Ford."
		elif _state.victor == "brigands":
			_unit_label.text = "The company was driven back"
			_unit_role_label.text = "The medicine remains at risk."
		else:
			_unit_label.text = "The ford remains uncertain"
			_unit_role_label.text = "Neither side holds the toll garden."
	elif not active_id.is_empty():
		var unit: Dictionary = _state.units[active_id]
		is_player_turn = bool(unit.get("controllable", false))
		_status_label.text = "Reopen the winter road · Pulse %d · %s" % [_state.pulse + 1, "Your command" if is_player_turn else "Foe acting"]
		_portrait_rect.texture = _portrait_atlas(active_id)
		_unit_label.text = str(unit["name"])
		_unit_role_label.text = "%s · %s" % [str(unit["role"]), str(unit["weapon"]).replace("_", " ").capitalize()]
		_hp_bar.max_value = maxi(1, int(unit["max_hp"]))
		_hp_bar.value = int(unit["hp"])
		_hp_label.text = "HP %d / %d" % [int(unit["hp"]), int(unit["max_hp"])]
		_condition_label.text = _highest_priority_condition(unit)
	if _state.status == "finished":
		_forecast_label.text = message if not message.is_empty() else "Encounter resolved · review the chronicle or return to the road."
	elif not message.is_empty():
		_forecast_label.text = message
	elif not is_player_turn:
		_forecast_label.text = "Opposition acting · player commands are locked."
	elif _pending_command.is_empty():
		match _mode:
			"move":
				_forecast_label.text = "Move · choose a marked tile."
			"attack":
				_forecast_label.text = "Attack · choose a marked foe."
			_:
				_forecast_label.text = "Choose a command."
	var controls_enabled: bool = is_player_turn and not _input_locked and _state.status == "active"
	_move_button.disabled = not controls_enabled
	_attack_button.disabled = not controls_enabled
	_guard_button.disabled = not controls_enabled
	_end_turn_button.disabled = not controls_enabled
	_confirm_button.disabled = not controls_enabled or _pending_command.is_empty()
	_cancel_button.disabled = not controls_enabled or _pending_command.is_empty()
	_move_button.button_pressed = _mode == "move"
	_attack_button.button_pressed = _mode == "attack"
	_guard_button.button_pressed = _mode == "guard"
	_end_turn_button.button_pressed = _mode == "end_turn"
	_set_action_label_state(_move_button, _mode == "move")
	_set_action_label_state(_attack_button, _mode == "attack")
	_set_action_label_state(_guard_button, _mode == "guard")
	_set_action_label_state(_end_turn_button, _mode == "end_turn")
	if _state.status == "finished":
		_confirm_button.text = "Encounter resolved"
	elif not is_player_turn:
		_confirm_button.text = "Commands locked"
	else:
		match str(_pending_command.get("type", "")):
			"move":
				_confirm_button.text = "Commit move"
			"attack":
				_confirm_button.text = "Commit attack"
			"guard":
				_confirm_button.text = "Take guard"
			"end_turn":
				_confirm_button.text = "Wait one pulse"
			_:
				_confirm_button.text = "Not ready · Select a command"


func _on_board_input(event: InputEvent) -> void:
	var pressed := false
	var event_position := Vector2.ZERO
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton
		pressed = mouse_event.pressed and mouse_event.button_index == MOUSE_BUTTON_LEFT
		event_position = mouse_event.position
	elif event is InputEventScreenTouch:
		var touch_event := event as InputEventScreenTouch
		pressed = touch_event.pressed
		event_position = touch_event.position
	if not pressed or _input_locked or _state.status != "active":
		return
	var active_id: String = _state.active_actor_id()
	if active_id.is_empty() or not bool(Dictionary(_state.units[active_id]).get("controllable", false)):
		return
	# Events emitted by Control.gui_input already use the receiving control's
	# local coordinate space. Subtracting global_position offsets board picks.
	var local_position := event_position
	if not Rect2(Vector2.ZERO, _board_container.size).has_point(local_position):
		return
	if _board_container.size.x <= 0.0 or _board_container.size.y <= 0.0:
		return
	var viewport_position := local_position * Vector2(_subviewport.size) / _board_container.size
	var cell := _screen_space_cell_at(viewport_position)
	if cell.is_empty():
		return
	_select_cell(cell)


func _screen_space_cell_at(viewport_position: Vector2) -> Dictionary:
	# The tilted 2.5D board visually foreshortens a tile's depth. Resolve taps
	# against overlapping 80x80 logical screen-space regions and choose the
	# nearest projected center so every cell still meets a 48x48 physical hit
	# target at the 432x768 mobile override.
	var half_extent := MIN_CELL_HIT_SIZE * 0.5
	var best_cell: Dictionary = {}
	var best_distance := INF
	for y in range(GRID_HEIGHT):
		for x in range(GRID_WIDTH):
			var cell := {"x": x, "y": y}
			var projected := _camera.unproject_position(_cell_position(cell) + Vector3(0, 0.10, 0))
			var delta := viewport_position - projected
			if absf(delta.x) > half_extent or absf(delta.y) > half_extent:
				continue
			var distance := delta.length_squared()
			if distance < best_distance:
				best_distance = distance
				best_cell = cell
	return best_cell


func _select_cell(cell: Dictionary) -> void:
	var actor_id: String = _state.active_actor_id()
	var actor: Dictionary = _state.units[actor_id]
	if _mode == "guard":
		_refresh_all(_guard_forecast(actor))
		return
	if _mode == "end_turn":
		_refresh_all(_end_turn_forecast(actor))
		return
	_pending_command.clear()
	_pending_cells.clear()
	if _mode == "move":
		var path := GridRules.shortest_path(_state, Dictionary(actor["position"]), cell, actor_id)
		if path.is_empty() or path.size() <= 1:
			_refresh_all("That tile is occupied or cannot be reached.")
			return
		var cost := path.size() - 1
		if cost > int(actor["move"]):
			_refresh_all("Path costs %d; %s can move %d." % [cost, str(actor["name"]), int(actor["move"])])
			return
		_pending_command = {"type": "move", "actor_id": actor_id, "to": cell.duplicate(true)}
		_pending_cells = path.duplicate(true)
		_refresh_all("Move %d tile%s · route is clear · confirm to commit" % [cost, "" if cost == 1 else "s"])
	else:
		var target_id := GridRules.occupant_id(_state, cell)
		if target_id.is_empty() or str(Dictionary(_state.units[target_id])["side"]) == str(actor["side"]):
			_refresh_all("Choose a marked brigand.")
			return
		var attack_mode := _best_attack_mode(actor_id, target_id)
		if attack_mode.is_empty():
			var distance := GridRules.distance(Dictionary(actor["position"]), cell)
			_refresh_all("No clear attack from here · target is %d tiles away." % distance)
			return
		_pending_command = {"type": "attack", "actor_id": actor_id, "target_id": target_id, "mode": attack_mode}
		_refresh_all(_attack_forecast(actor_id, target_id, attack_mode))


func _on_move_pressed() -> void:
	if _mode == "move":
		_clear_pending()
		return
	_pending_command.clear()
	_pending_cells.clear()
	_mode = "move"
	_refresh_all()


func _on_attack_pressed() -> void:
	if _mode == "attack":
		_clear_pending()
		return
	_pending_command.clear()
	_pending_cells.clear()
	_mode = "attack"
	_refresh_all()


func _on_guard_pressed() -> void:
	if not _can_player_act():
		return
	if _mode == "guard":
		_clear_pending()
		return
	var actor_id: String = _state.active_actor_id()
	var actor: Dictionary = _state.units[actor_id]
	_mode = "guard"
	_pending_cells.clear()
	_pending_command = {"type": "guard", "actor_id": actor_id}
	_refresh_all(_guard_forecast(actor))


func _on_end_turn_pressed() -> void:
	if not _can_player_act():
		return
	if _mode == "end_turn":
		_clear_pending()
		return
	var actor_id: String = _state.active_actor_id()
	var actor: Dictionary = _state.units[actor_id]
	_mode = "end_turn"
	_pending_cells.clear()
	_pending_command = {"type": "end_turn", "actor_id": actor_id}
	_refresh_all(_end_turn_forecast(actor))


func _on_confirm_pressed() -> void:
	if not _can_player_act() or _pending_command.is_empty():
		return
	_execute_player_command(_pending_command.duplicate(true))


func _clear_pending() -> void:
	_pending_command.clear()
	_pending_cells.clear()
	_mode = ""
	_refresh_all()


func _execute_player_command(command: Dictionary) -> void:
	var command_revision := _battle_revision
	_input_locked = true
	_pending_command.clear()
	_pending_cells.clear()
	var result := CommandGateway.execute(_state, command)
	if not bool(result.get("ok", false)):
		_input_locked = false
		_refresh_all("Command rejected: %s" % str(result.get("error", "unknown")).replace("_", " "))
		return
	_append_result_log(result)
	_refresh_all("Command resolved.")
	await get_tree().create_timer(0.36, false).timeout
	if command_revision != _battle_revision:
		return
	await _run_enemy_turns(command_revision)


func _run_enemy_turns(expected_revision: int = -1) -> void:
	if expected_revision < 0:
		expected_revision = _battle_revision
	if expected_revision != _battle_revision:
		return
	if _ai_runner_active:
		# Keep only the newest still-current request. The active coroutine will
		# observe its stale revision after Load/Reset and hand ownership over.
		_queued_ai_revision = expected_revision
		return
	_ai_runner_active = true
	await _run_enemy_turn_sequence(expected_revision)
	_ai_runner_active = false
	var queued_revision := _queued_ai_revision
	_queued_ai_revision = -1
	if queued_revision != _battle_revision or _state.status != "active":
		return
	var queued_actor_id: String = _state.active_actor_id()
	if queued_actor_id.is_empty() or bool(Dictionary(_state.units[queued_actor_id]).get("controllable", false)):
		return
	_input_locked = true
	await _run_enemy_turns(queued_revision)


func _run_enemy_turn_sequence(expected_revision: int) -> void:
	var ai_stalled := false
	while _state.status == "active":
		if expected_revision != _battle_revision:
			return
		var active_id: String = _state.active_actor_id()
		if active_id.is_empty():
			break
		var active: Dictionary = _state.units[active_id]
		if bool(active.get("controllable", false)):
			break
		_refresh_all("%s weighs cover, distance, and injury…" % str(active["name"]))
		await get_tree().create_timer(0.52, false).timeout
		if expected_revision != _battle_revision:
			return
		var command := EnemyAI.choose_command(_state)
		if command.is_empty():
			command = {"type": "end_turn", "actor_id": active_id}
		var result := CommandGateway.execute(_state, command)
		if not bool(result.get("ok", false)):
			_action_log.append("%s could not execute its chosen command; yielding the pulse." % str(active["name"]))
			var fallback := CommandGateway.execute(_state, {"type": "end_turn", "actor_id": active_id})
			if not bool(fallback.get("ok", false)):
				_action_log.append("AI recovery failed: %s." % str(fallback.get("error", "unknown")).replace("_", " "))
				ai_stalled = true
				break
			result = fallback
		_append_result_log(result)
		_refresh_all()
		await get_tree().create_timer(0.40, false).timeout
		if expected_revision != _battle_revision:
			return
	if expected_revision != _battle_revision:
		return
	if ai_stalled:
		_input_locked = true
		_refresh_all("Turn recovery failed. Reset or load a saved battle to continue.")
		return
	_input_locked = false
	_mode = ""
	_refresh_all("Choose a command." if _state.status == "active" else "The encounter is decided.")


func _append_result_log(result: Dictionary) -> void:
	for event_variant in Array(result.get("events", [])):
		var event: Dictionary = event_variant
		var payload: Dictionary = event.get("payload", {})
		match str(event.get("type", "")):
			"actor_moved":
				var actor: Dictionary = _state.units[str(payload["actor_id"])]
				_action_log.append("%s moved %d tiles." % [str(actor["name"]), int(payload["cost"])])
			"attack_resolved":
				var attacker: Dictionary = _state.units[str(payload["actor_id"])]
				var defender: Dictionary = _state.units[str(payload["target_id"])]
				if bool(payload["hit"]):
					_action_log.append("%s struck %s for %d harm%s." % [str(attacker["name"]), str(defender["name"]), int(payload["damage"]), " — critical" if bool(payload["critical"]) else ""])
				else:
					_action_log.append("%s missed %s (%d%% chance)." % [str(attacker["name"]), str(defender["name"]), int(payload["chance"])])
			"guard_changed":
				if bool(payload.get("guarding", false)) and str(payload.get("reason", "")) == "command":
					var guarder: Dictionary = _state.units[str(payload["actor_id"])]
					_action_log.append("%s set a guarded stance." % str(guarder["name"]))
			"actor_waited":
				var waiter: Dictionary = _state.units[str(payload["actor_id"])]
				_action_log.append("%s yielded the pulse." % str(waiter["name"]))
			"unit_defeated":
				var fallen: Dictionary = _state.units[str(payload["unit_id"])]
				_action_log.append("%s fell and can no longer fight." % str(fallen["name"]))
			"battle_finished":
				_action_log.append("The encounter ended: %s victory." % str(payload["victor"]).capitalize())


func _best_attack_mode(actor_id: String, target_id: String) -> String:
	var melee := TacticalRules.can_attack(_state, actor_id, target_id, "melee")
	if bool(melee.get("ok", false)):
		return "melee"
	var ranged := TacticalRules.can_attack(_state, actor_id, target_id, "ranged")
	if bool(ranged.get("ok", false)):
		return "ranged"
	return ""


func _attack_forecast(actor_id: String, target_id: String, mode: String) -> String:
	var actor: Dictionary = _state.units[actor_id]
	var target: Dictionary = _state.units[target_id]
	var distance := GridRules.distance(Dictionary(actor["position"]), Dictionary(target["position"]))
	var cover := GridRules.cover_at(_state, Dictionary(target["position"])) if mode == "ranged" else 0
	var base_chance := 78 if mode == "melee" else 72
	var condition_modifier := _condition_accuracy_modifier(actor, mode)
	var chance := clampi(base_chance + int(actor["accuracy"]) + condition_modifier - int(target["evasion"]) - cover * 10, 15, 95)
	var power := int(actor["melee_power"]) if mode == "melee" else int(actor["ranged_power"])
	var min_harm := maxi(1, power - 1 - int(target["armor"]) - (3 if bool(target["guarding"]) else 0))
	var max_harm := maxi(1, power + 1 - int(target["armor"]) - (3 if bool(target["guarding"]) else 0))
	var condition_note := " · condition %d" % condition_modifier if condition_modifier != 0 else ""
	return "%s %s · %d%% hit · %d–%d harm · range %d · cover %d%s" % [mode.capitalize(), str(target["name"]), chance, min_harm, max_harm, distance, cover, condition_note]


func _guard_forecast(actor: Dictionary) -> String:
	var renewal := " · renew stance" if bool(actor.get("guarding", false)) else ""
	return "%s → Guard · mitigate up to 3 harm · 1 pulse%s" % [str(actor["name"]), renewal]


func _end_turn_forecast(actor: Dictionary) -> String:
	var guard_note := " · current guard stance will end" if bool(actor.get("guarding", false)) else ""
	return "%s → Wait → 1 pulse · no move or attack%s" % [str(actor["name"]), guard_note]


func _highest_priority_condition(unit: Dictionary) -> String:
	if bool(unit.get("guarding", false)):
		return "Guarded"
	var conditions: Array = Array(unit.get("conditions", []))
	if conditions.is_empty():
		return "Steady"
	var first_condition: Dictionary = conditions[0]
	var result := str(first_condition.get("name", "Condition"))
	if conditions.size() > 1:
		result += " +%d" % (conditions.size() - 1)
	return result


func _condition_accuracy_modifier(actor: Dictionary, mode: String) -> int:
	var effect_name := "melee_accuracy" if mode == "melee" else "ranged_accuracy"
	var modifier := 0
	for condition_variant in Array(actor.get("conditions", [])):
		var condition: Dictionary = condition_variant
		modifier += int(Dictionary(condition.get("effects", {})).get(effect_name, 0))
	return modifier


func _can_player_act() -> bool:
	if _input_locked or _state.status != "active":
		return false
	var active_id: String = _state.active_actor_id()
	return not active_id.is_empty() and bool(Dictionary(_state.units[active_id]).get("controllable", false))


func _set_marker(cell: Dictionary, material: Material) -> void:
	var key := GridRules.key(cell)
	if not _tile_markers.has(key):
		return
	var marker: MeshInstance3D = _tile_markers[key]
	marker.material_override = material
	marker.visible = true


func _cell_position(cell: Dictionary) -> Vector3:
	return Vector3((int(cell["x"]) - 3) * CELL_SIZE, 0.0, (int(cell["y"]) - 4) * CELL_SIZE)


func _actor_atlas(actor_id: String) -> AtlasTexture:
	var quadrant: Vector2i = {
		"erran_holt": Vector2i(0, 0),
		"maud_reed": Vector2i(1, 0),
		"road_spearman": Vector2i(0, 1),
		"crossbow_skirmisher": Vector2i(1, 1),
	}.get(actor_id, Vector2i.ZERO)
	var atlas := AtlasTexture.new()
	atlas.atlas = ACTOR_TEXTURE
	atlas.region = Rect2(quadrant.x * SHEET_CELL, quadrant.y * SHEET_CELL, SHEET_CELL, SHEET_CELL)
	atlas.filter_clip = true
	return atlas


func _portrait_atlas(actor_id: String) -> AtlasTexture:
	var quadrant: Vector2i = {
		"erran_holt": Vector2i(0, 0),
		"maud_reed": Vector2i(1, 0),
		"road_spearman": Vector2i(0, 1),
		"crossbow_skirmisher": Vector2i(1, 1),
	}.get(actor_id, Vector2i.ZERO)
	var atlas := AtlasTexture.new()
	atlas.atlas = PORTRAIT_TEXTURE
	atlas.region = Rect2(quadrant.x * SHEET_CELL, quadrant.y * SHEET_CELL, SHEET_CELL, SHEET_CELL)
	atlas.filter_clip = true
	return atlas


func _tile_material(x: int, y: int, path_band: bool) -> StandardMaterial3D:
	# A deterministic, low-contrast value shift keeps the board matte and hand-painted
	# instead of reading as a repeated glossy primitive grid.
	var base_color := Color("#7e7666") if path_band else Color("#657a53")
	var variation: float = (float((x * 17 + y * 29) % 7) - 3.0) * 0.018
	var color := base_color.lightened(variation) if variation >= 0.0 else base_color.darkened(-variation)
	return _opaque_material(color, 0.99)


func _add_painterly_breakup(parent: Node3D, x: int, y: int, path_band: bool) -> void:
	var accent_base := Color("#c2b79b") if path_band else Color("#a0aa72")
	for stroke_index in range(2):
		var stroke := MeshInstance3D.new()
		stroke.name = "MatteColorStroke"
		var stroke_mesh := BoxMesh.new()
		var length: float = 0.24 + float((x + y + stroke_index) % 4) * 0.07
		stroke_mesh.size = Vector3(length, 0.012, 0.045 + stroke_index * 0.012)
		stroke.mesh = stroke_mesh
		var alpha_color := accent_base.darkened(0.05 * float((x + stroke_index) % 3))
		stroke.material_override = _opaque_material(alpha_color, 1.0)
		stroke.position = Vector3(
			-0.28 + float((x * 13 + y * 7 + stroke_index * 19) % 57) / 100.0,
			0.058,
			-0.30 + float((x * 5 + y * 11 + stroke_index * 23) % 61) / 100.0
		)
		stroke.rotation_degrees.y = -24.0 + float((x * 9 + y * 15 + stroke_index * 31) % 49)
		parent.add_child(stroke)


func _action_button(label_text: String, icon_index: int, callback: Callable) -> Button:
	var button := Button.new()
	button.tooltip_text = label_text
	button.accessibility_name = label_text
	button.custom_minimum_size = Vector2(0, 130)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.toggle_mode = true
	button.clip_contents = true
	_apply_action_button_styles(button)
	button.pressed.connect(callback)

	var content := VBoxContainer.new()
	content.name = "ActionContent"
	content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content.offset_left = 8
	content.offset_top = 6
	content.offset_right = -8
	content.offset_bottom = -8
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_theme_constant_override("separation", 0)
	button.add_child(content)

	var icon_slot := CenterContainer.new()
	icon_slot.size_flags_vertical = Control.SIZE_EXPAND_FILL
	icon_slot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_child(icon_slot)

	var icon := TextureRect.new()
	icon.texture = _action_atlas(icon_index)
	icon.custom_minimum_size = Vector2(64, 64)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	icon_slot.add_child(icon)

	var label := Label.new()
	label.name = "ActionLabel"
	label.text = label_text
	label.custom_minimum_size = Vector2(0, 32)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 22)
	label.add_theme_color_override("font_color", INK)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_child(label)
	return button


func _action_atlas(index: int) -> AtlasTexture:
	var atlas := AtlasTexture.new()
	atlas.atlas = ACTION_TEXTURE
	atlas.region = Rect2((index % 2) * SHEET_CELL, (index / 2) * SHEET_CELL, SHEET_CELL, SHEET_CELL)
	atlas.filter_clip = true
	return atlas


func _surface_atlas(index: int) -> AtlasTexture:
	# Each generated quadrant includes a generous dark presentation surround.
	# Crop to the role-specific inner painted rule so runtime controls retain
	# the oil-brush material without turning every band into a black monument.
	var inset := 0
	match index:
		SURFACE_DOCK:
			inset = 60
		SURFACE_VELLUM:
			inset = 40
		SURFACE_ACTION:
			inset = 30
		SURFACE_COMMIT:
			inset = 40
	var atlas := AtlasTexture.new()
	atlas.atlas = SURFACE_TEXTURE
	atlas.region = Rect2(
		(index % 2) * SHEET_CELL + inset,
		(index / 2) * SHEET_CELL + inset,
		SHEET_CELL - inset * 2,
		SHEET_CELL - inset * 2
	)
	atlas.filter_clip = true
	return atlas


func _texture_style(index: int, texture_margin: float, content_margin: float, tint: Color = Color.WHITE) -> StyleBoxTexture:
	var style := StyleBoxTexture.new()
	style.texture = _surface_atlas(index)
	style.modulate_color = tint
	for side in [SIDE_LEFT, SIDE_TOP, SIDE_RIGHT, SIDE_BOTTOM]:
		style.set_texture_margin(side, texture_margin)
		style.set_content_margin(side, content_margin)
	return style


func _text_button(label_text: String, callback: Callable, style_kind: String) -> Button:
	var button := Button.new()
	button.text = label_text
	button.custom_minimum_size = Vector2(80, 80)
	button.add_theme_font_size_override("font_size", 20)
	if style_kind == "commit":
		_apply_commit_button_styles(button)
	else:
		_apply_utility_button_styles(button)
	button.pressed.connect(callback)
	return button


func _apply_action_button_styles(button: Button) -> void:
	button.add_theme_stylebox_override("normal", _texture_style(SURFACE_ACTION, 24, 7))
	button.add_theme_stylebox_override("hover", _texture_style(SURFACE_ACTION, 24, 7, Color(1.08, 1.08, 1.04, 1.0)))
	button.add_theme_stylebox_override("pressed", _texture_style(SURFACE_ACTION, 24, 7, Color("#6f93a0")))
	button.add_theme_stylebox_override("hover_pressed", _texture_style(SURFACE_ACTION, 24, 7, Color("#7ea4b0")))
	button.add_theme_stylebox_override("disabled", _texture_style(SURFACE_ACTION, 24, 7, Color("#858b82")))
	button.add_theme_stylebox_override("focus", _texture_style(SURFACE_ACTION, 24, 7, Color("#d4c18a")))


func _apply_utility_button_styles(button: Button) -> void:
	button.add_theme_stylebox_override("normal", _texture_style(SURFACE_VELLUM, 24, 9))
	button.add_theme_stylebox_override("hover", _texture_style(SURFACE_VELLUM, 24, 9, Color(1.06, 1.06, 1.02, 1.0)))
	button.add_theme_stylebox_override("pressed", _texture_style(SURFACE_VELLUM, 24, 9, Color("#a5bdc1")))
	button.add_theme_stylebox_override("disabled", _texture_style(SURFACE_VELLUM, 24, 9, Color("#90938b")))
	button.add_theme_stylebox_override("focus", _texture_style(SURFACE_VELLUM, 24, 9, Color("#d2bd83")))
	button.add_theme_color_override("font_color", INK)
	button.add_theme_color_override("font_hover_color", INK)
	button.add_theme_color_override("font_pressed_color", PARCHMENT)
	button.add_theme_color_override("font_disabled_color", Color("#4a5451"))


func _apply_commit_button_styles(button: Button) -> void:
	button.add_theme_stylebox_override("normal", _texture_style(SURFACE_COMMIT, 24, 10))
	button.add_theme_stylebox_override("hover", _texture_style(SURFACE_COMMIT, 24, 10, Color(1.08, 1.05, 0.98, 1.0)))
	button.add_theme_stylebox_override("pressed", _texture_style(SURFACE_COMMIT, 24, 10, Color("#829aa1")))
	button.add_theme_stylebox_override("disabled", _texture_style(SURFACE_COMMIT, 24, 10, Color("#747e80")))
	button.add_theme_stylebox_override("focus", _texture_style(SURFACE_COMMIT, 24, 10, Color("#d4bd78")))
	button.add_theme_color_override("font_color", PARCHMENT)
	button.add_theme_color_override("font_hover_color", Color.WHITE)
	button.add_theme_color_override("font_pressed_color", Color.WHITE)
	button.add_theme_color_override("font_disabled_color", Color(0.86, 0.85, 0.78, 0.88))


func _set_action_label_state(button: Button, selected: bool) -> void:
	var label := button.get_node_or_null("ActionContent/ActionLabel") as Label
	if label != null:
		var color := Color(0.34, 0.38, 0.37, 0.70) if button.disabled else (PARCHMENT if selected else INK)
		label.add_theme_color_override("font_color", color)


func _build_materials() -> void:
	_mat_grass = _opaque_material(Color("#657a53"), 0.98)
	_mat_path = _opaque_material(Color("#7e7666"), 0.99)
	_mat_stone = _opaque_material(Color("#27353a"), 0.92)
	_mat_mortar = _opaque_material(Color("#d5d0bc"), 0.95)
	_mat_wood = _opaque_material(Color("#6d4a30"), 0.94)
	_mat_reed = _opaque_material(Color("#8b7744"), 0.96)
	_mat_water = _transparent_material(Color(0.13, 0.40, 0.47, 0.90), 0.68)
	_mat_water.metallic = 0.0
	_mat_move = _transparent_material(MOVE_COLOR, 0.55)
	_mat_path_preview = _transparent_material(PATH_COLOR, 0.40)
	_mat_attack = _transparent_material(ATTACK_COLOR, 0.52)


func _opaque_material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material


func _transparent_material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return material


func _add_box(size_value: Vector3, position_value: Vector3, material: Material, parent: Node, node_name: String) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	var mesh := BoxMesh.new()
	mesh.size = size_value
	instance.mesh = mesh
	instance.material_override = material
	instance.position = position_value
	parent.add_child(instance)
	return instance


func _add_cylinder(radius: float, height: float, position_value: Vector3, material: Material, parent: Node, node_name: String) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius * 1.08
	mesh.height = height
	instance.mesh = mesh
	instance.material_override = material
	instance.position = position_value
	parent.add_child(instance)
	return instance


func _build_theme() -> Theme:
	var ui_theme := Theme.new()
	ui_theme.set_default_font_size(20)
	ui_theme.set_color("font_color", "Label", INK)
	ui_theme.set_color("default_color", "RichTextLabel", INK)
	ui_theme.set_font_size("normal_font_size", "RichTextLabel", 20)
	return ui_theme


func _flat_style(color: Color, border_width: int, border_color: Color, corner_radius: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border_color
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(corner_radius)
	style.content_margin_left = 9
	style.content_margin_right = 9
	style.content_margin_top = 5
	style.content_margin_bottom = 5
	return style
