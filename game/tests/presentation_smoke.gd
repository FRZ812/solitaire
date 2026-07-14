extends SceneTree

const MAIN_SCENE_PATH := "res://presentation/main.tscn"
const REQUIRED_BUTTON_LABELS := [
	"move",
	"attack",
	"guard",
	"wait",
	"not ready · select a command",
	"cancel",
	"log",
	"menu",
]
const REQUIRED_UI_PNG_PATHS := {
	"generated command surfaces": "res://assets/ui/surfaces/ui-command-surfaces-whitemarch-v1.png",
	"generated action icons": "res://assets/ui/icons/ui-action-icons-whitemarch-v1.png",
	"generated combat portraits": "res://assets/ui/portraits/ui-combat-portraits-whitemarch-v1.png",
}
const INTERNAL_VIEWPORT_SIZE := Vector2i(720, 1280)
const PHYSICAL_WINDOW_SIZE := Vector2i(432, 768)
const MINIMUM_LOGICAL_TOUCH_TARGET := 80.0
const MINIMUM_PHYSICAL_TOUCH_TARGET := 48.0
const MINIMUM_LOGICAL_FONT_SIZE := 20
const MINIMUM_PHYSICAL_FONT_SIZE := 12.0
const REQUIRED_BUTTON_STYLE_STATES := ["normal", "hover", "pressed", "disabled", "focus"]
const EXPECTED_TOP_BAND_HEIGHT := 87.0
const EXPECTED_BOARD_HEIGHT := 867.0
const EXPECTED_DOCK_TOP := 847.0
const EXPECTED_DOCK_HEIGHT := 433.0
const EXPECTED_FIELD_DOCK_OVERLAP := 20.0
const EXPECTED_DOCK_BOTTOM_INSET := 20.0
const EXPECTED_DOCK_BANDS := {
	"ActiveContextRail": 80.0,
	"ForecastCard": 107.0,
	"ActionTray": 130.0,
	"CommitmentRow": 96.0,
}
const DOCK_BAND_ORDER := [
	"ActiveContextRail",
	"ForecastCard",
	"ActionTray",
	"CommitmentRow",
]
const LAYOUT_TOLERANCE := 0.5
const MINIMUM_MESH_INSTANCES := 10
const MINIMUM_ACTOR_SPRITES := 4
const CONSTRUCTION_FRAMES := 16

var _checks := 0
var _failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var packed_variant := load(MAIN_SCENE_PATH)
	if not packed_variant is PackedScene:
		_failures.append("could not load %s as a PackedScene" % MAIN_SCENE_PATH)
		_finish()
		return

	var scene: Node = (packed_variant as PackedScene).instantiate()
	if scene == null:
		_failures.append("could not instantiate %s" % MAIN_SCENE_PATH)
		_finish()
		return
	get_root().add_child(scene)

	# Presentation construction is intentionally allowed to be script-driven.
	# Waiting several idle and physics ticks also lets deferred children settle.
	for frame in range(CONSTRUCTION_FRAMES):
		await process_frame
		if frame < 4:
			await physics_frame

	var nodes: Array[Node] = []
	_collect_nodes(scene, nodes)
	_test_required_3d_structure(nodes)
	_test_raster_texture_contract(nodes)
	_test_raster_button_style_contract(nodes)
	_test_core_controls(nodes)
	_test_mobile_ui_contract(nodes)
	_test_dock_geometry(nodes)
	_test_initial_idle_state(nodes)
	_test_no_permanently_visible_state_hash(nodes)
	_test_modal_behavior(nodes)
	await _write_optional_screenshot()

	scene.queue_free()
	await process_frame
	_finish()


func _test_required_3d_structure(nodes: Array[Node]) -> void:
	var subviewports := _nodes_of_type(nodes, "SubViewport")
	var cameras := _nodes_of_type(nodes, "Camera3D")
	var meshes := _nodes_of_type(nodes, "MeshInstance3D")
	var actor_sprites := _nodes_of_type(nodes, "Sprite3D")

	_expect(not subviewports.is_empty(), "scene contains a SubViewport for the 2.5D field")
	_expect(not cameras.is_empty(), "scene contains a Camera3D")
	_expect(
		meshes.size() >= MINIMUM_MESH_INSTANCES,
		"scene builds a substantial 3D board/prop set (%d found; need at least %d)" % [
			meshes.size(),
			MINIMUM_MESH_INSTANCES,
		]
	)
	_expect(
		actor_sprites.size() >= MINIMUM_ACTOR_SPRITES,
		"scene contains at least four Sprite3D actors (%d found)" % actor_sprites.size()
	)


func _test_raster_texture_contract(nodes: Array[Node]) -> void:
	var actor_sprites := _nodes_of_type(nodes, "Sprite3D")
	var textured_actor_count := 0
	var actor_texture_paths: Dictionary = {}
	for node in actor_sprites:
		var sprite := node as Sprite3D
		var paths: Dictionary = {}
		_collect_texture_paths(sprite.texture, paths, {})
		if _paths_have_extension(paths, ".png"):
			textured_actor_count += 1
		for path in paths:
			actor_texture_paths[path] = true

	var ui_texture_paths: Dictionary = {}
	for node in nodes:
		if not node is Control:
			continue
		_collect_direct_texture_resources(node, ui_texture_paths)

	var all_runtime_texture_paths: Dictionary = actor_texture_paths.duplicate()
	for path in ui_texture_paths:
		all_runtime_texture_paths[path] = true

	_expect(
		textured_actor_count >= MINIMUM_ACTOR_SPRITES,
		"at least four Sprite3D actors use PNG-backed raster textures (%d found)" % textured_actor_count
	)
	_expect(
		_count_paths_with_extension(ui_texture_paths, ".png") >= REQUIRED_UI_PNG_PATHS.size(),
		"runtime UI exposes at least three PNG-backed raster sources (surface, icons, and portraits)"
	)
	for asset_name_variant in REQUIRED_UI_PNG_PATHS:
		var asset_name := str(asset_name_variant)
		var required_path := str(REQUIRED_UI_PNG_PATHS[asset_name_variant]).to_lower()
		_expect(
			FileAccess.file_exists(required_path),
			"%s PNG exists at %s" % [asset_name, required_path]
		)
		_expect(
			ui_texture_paths.has(required_path),
			"runtime UI exposes the %s PNG" % asset_name
		)
	_expect(
		not _paths_have_extension(all_runtime_texture_paths, ".svg"),
		"runtime UI and actor textures do not reference SVG assets"
	)
	_expect(
		_find_files_with_extension("res://", ".svg").is_empty(),
		"the clean-room game contains no SVG files"
	)


func _test_raster_button_style_contract(nodes: Array[Node]) -> void:
	var required_surface_path := str(REQUIRED_UI_PNG_PATHS["generated command surfaces"]).to_lower()
	var inspected_buttons := 0
	var invalid_states: Array[String] = []
	for node in nodes:
		if not node is Button:
			continue
		var button := node as Button
		inspected_buttons += 1
		var style_states: Array = REQUIRED_BUTTON_STYLE_STATES.duplicate()
		if button.toggle_mode:
			style_states.append("hover_pressed")
		for state_variant in style_states:
			var state := str(state_variant)
			var stylebox := button.get_theme_stylebox(state)
			var texture_paths: Dictionary = {}
			_collect_texture_paths(stylebox, texture_paths, {})
			if not stylebox is StyleBoxTexture or not texture_paths.has(required_surface_path):
				invalid_states.append("%s.%s" % [str(button.get_path()), state])
	_expect(
		inspected_buttons >= REQUIRED_BUTTON_LABELS.size(),
		"raster Button style inspection covers every primary and modal control"
	)
	_expect(
		invalid_states.is_empty(),
		"Button normal/hover/pressed/disabled/focus states are raster-backed by the generated surface sheet%s" % [
			"" if invalid_states.is_empty() else " (invalid: %s)" % ", ".join(invalid_states)
		]
	)


func _test_core_controls(nodes: Array[Node]) -> void:
	var discovered_labels: Dictionary = {}
	var button_count := 0
	for node in nodes:
		if not node is BaseButton:
			continue
		button_count += 1
		for label in _labels_for_button(node as BaseButton):
			discovered_labels[_normalize_label(label)] = true

	_expect(
		button_count >= REQUIRED_BUTTON_LABELS.size(),
		"scene exposes at least %d actionable buttons" % REQUIRED_BUTTON_LABELS.size()
	)
	for required_label in REQUIRED_BUTTON_LABELS:
		_expect(
			discovered_labels.has(required_label),
			"scene has a button labeled '%s'" % _title_case(required_label)
		)
	_expect(
		not discovered_labels.has("end turn"),
		"the concise mobile action is labeled 'Wait', not 'End Turn'"
	)


func _test_mobile_ui_contract(nodes: Array[Node]) -> void:
	var configured_internal_size := Vector2i(
		int(ProjectSettings.get_setting("display/window/size/viewport_width", 0)),
		int(ProjectSettings.get_setting("display/window/size/viewport_height", 0))
	)
	var configured_physical_size := Vector2i(
		int(ProjectSettings.get_setting("display/window/size/window_width_override", 0)),
		int(ProjectSettings.get_setting("display/window/size/window_height_override", 0))
	)
	_expect(
		configured_internal_size == INTERNAL_VIEWPORT_SIZE,
		"internal portrait canvas is 720x1280"
	)
	_expect(
		configured_physical_size == PHYSICAL_WINDOW_SIZE,
		"mobile window override is 432x768"
	)

	var scale_x := float(PHYSICAL_WINDOW_SIZE.x) / float(INTERNAL_VIEWPORT_SIZE.x)
	var scale_y := float(PHYSICAL_WINDOW_SIZE.y) / float(INTERNAL_VIEWPORT_SIZE.y)
	_expect(
		is_equal_approx(scale_x, scale_y),
		"mobile window scales the internal canvas uniformly"
	)
	_expect(
		MINIMUM_LOGICAL_TOUCH_TARGET * scale_x >= MINIMUM_PHYSICAL_TOUCH_TARGET,
		"80 logical pixels correspond to at least 48 physical pixels"
	)
	_expect(
		float(MINIMUM_LOGICAL_FONT_SIZE) * scale_x >= MINIMUM_PHYSICAL_FONT_SIZE,
		"20 logical font pixels correspond to at least 12 physical pixels"
	)

	var buttons_by_label := _buttons_by_normalized_label(nodes)
	for required_label in REQUIRED_BUTTON_LABELS:
		if not buttons_by_label.has(required_label):
			_expect(false, "cannot measure missing '%s' mobile target" % _title_case(required_label))
			continue
		var button := buttons_by_label[required_label] as BaseButton
		var target_size := button.get_global_rect().size
		var physical_size := target_size * Vector2(scale_x, scale_y)
		_expect(
			target_size.x >= MINIMUM_LOGICAL_TOUCH_TARGET and target_size.y >= MINIMUM_LOGICAL_TOUCH_TARGET,
			"'%s' target is at least 80x80 logical pixels (%.0fx%.0f logical; %.0fx%.0f physical)" % [
				_title_case(required_label),
				target_size.x,
				target_size.y,
				physical_size.x,
				physical_size.y,
			]
		)

	var undersized_text: Array[String] = []
	for node in nodes:
		if not node is Control:
			continue
		var control := node as Control
		if not control.is_visible_in_tree() or _visible_text_for_control(control).is_empty():
			continue
		var theme_item := &"normal_font_size" if control is RichTextLabel else &"font_size"
		var font_size := control.get_theme_font_size(theme_item)
		if font_size < MINIMUM_LOGICAL_FONT_SIZE:
			undersized_text.append("%s=%d" % [str(control.get_path()), font_size])
	_expect(
		undersized_text.is_empty(),
		"visible operational text uses at least 20 logical pixels%s" % [
			"" if undersized_text.is_empty() else " (too small: %s)" % ", ".join(undersized_text)
		]
	)


func _test_dock_geometry(nodes: Array[Node]) -> void:
	var top_band := _control_named(nodes, "FieldFolioTopBand")
	var board := _control_named(nodes, "TacticalBoard")
	var dock := _control_named(nodes, "FieldFolioCommandDock")
	_expect(top_band != null, "scene exposes the named top field-folio band")
	_expect(board != null, "scene exposes the named tactical board")
	_expect(dock != null, "scene exposes the named command dock")
	if top_band == null or board == null or dock == null:
		return

	var top_band_rect := top_band.get_global_rect()
	var board_rect := board.get_global_rect()
	var dock_rect := dock.get_global_rect()
	_expect_close(top_band_rect.size.y, EXPECTED_TOP_BAND_HEIGHT, "top band height is exactly 87 logical pixels")
	_expect_close(board_rect.size.y, EXPECTED_BOARD_HEIGHT, "tactical field height is exactly 867 logical pixels")
	_expect_close(dock_rect.position.y, EXPECTED_DOCK_TOP, "command dock begins at logical y=847")
	_expect_close(dock_rect.size.y, EXPECTED_DOCK_HEIGHT, "command dock height is exactly 433 logical pixels")
	_expect_close(
		board_rect.end.y - dock_rect.position.y,
		EXPECTED_FIELD_DOCK_OVERLAP,
		"command dock overlaps the field by exactly 20 logical pixels"
	)

	var band_controls: Array[Control] = []
	for band_name_variant in DOCK_BAND_ORDER:
		var band_name := str(band_name_variant)
		var band := _control_named(nodes, band_name)
		_expect(band != null, "dock exposes the '%s' band" % band_name)
		if band == null:
			continue
		band_controls.append(band)
		_expect_close(
			band.get_global_rect().size.y,
			float(EXPECTED_DOCK_BANDS[band_name]),
			"%s height is exactly %d logical pixels" % [band_name, int(EXPECTED_DOCK_BANDS[band_name])]
		)
	if band_controls.size() != DOCK_BAND_ORDER.size():
		return

	for index in range(band_controls.size() - 1):
		var current_rect := band_controls[index].get_global_rect()
		var next_rect := band_controls[index + 1].get_global_rect()
		_expect_close(
			next_rect.position.y - current_rect.end.y,
			0.0,
			"dock bands '%s' and '%s' have no unintended gap" % [
				str(DOCK_BAND_ORDER[index]),
				str(DOCK_BAND_ORDER[index + 1]),
			]
		)
	var final_band_rect := band_controls[band_controls.size() - 1].get_global_rect()
	_expect_close(
		dock_rect.end.y - final_band_rect.end.y,
		EXPECTED_DOCK_BOTTOM_INSET,
		"command dock retains exactly 20 logical pixels of bottom inset"
	)


func _test_initial_idle_state(nodes: Array[Node]) -> void:
	var buttons_by_label := _buttons_by_normalized_label(nodes)
	for action_label in ["move", "attack", "guard", "wait"]:
		if not buttons_by_label.has(action_label):
			_expect(false, "cannot inspect missing '%s' initial action state" % _title_case(action_label))
			continue
		var action_button := buttons_by_label[action_label] as BaseButton
		_expect(action_button.toggle_mode, "'%s' is a selectable action" % _title_case(action_label))
		_expect(not action_button.button_pressed, "'%s' is not preselected at idle" % _title_case(action_label))
		_expect(not action_button.disabled, "'%s' is available at the initial player pulse" % _title_case(action_label))

	for disabled_label in ["not ready · select a command", "cancel"]:
		if not buttons_by_label.has(disabled_label):
			_expect(false, "cannot inspect missing '%s' idle state" % _title_case(disabled_label))
			continue
		var idle_button := buttons_by_label[disabled_label] as BaseButton
		_expect(idle_button.disabled, "'%s' is disabled until a command is pending" % _title_case(disabled_label))

	var visible_prompt_count := 0
	for node in nodes:
		if not node is Control:
			continue
		var control := node as Control
		if control.is_visible_in_tree() and _normalize_label(_visible_text_for_control(control)) == "choose a command.":
			visible_prompt_count += 1
	_expect(visible_prompt_count >= 1, "initial idle forecast visibly reads 'Choose a command.'")


func _test_no_permanently_visible_state_hash(nodes: Array[Node]) -> void:
	var visible_hash_controls: Array[String] = []
	for node in nodes:
		if not node is Control:
			continue
		var control := node as Control
		if not control.is_visible_in_tree():
			continue
		var normalized_text := _normalize_label(_visible_text_for_control(control))
		var normalized_name := String(control.name).to_lower()
		if (
			normalized_name.contains("hash")
			or normalized_text.contains("state hash")
			or normalized_text.contains("deterministic state")
		):
			visible_hash_controls.append(str(control.get_path()))
	_expect(
		visible_hash_controls.is_empty(),
		"no state hash is permanently visible in the player HUD%s" % [
			"" if visible_hash_controls.is_empty() else " (%s)" % ", ".join(visible_hash_controls)
		]
	)


func _test_modal_behavior(nodes: Array[Node]) -> void:
	var pause_sheet := _control_named(nodes, "PauseSheet")
	var chronicle_sheet := _control_named(nodes, "ChronicleSheet")
	_expect(pause_sheet != null, "scene exposes the pause sheet")
	_expect(chronicle_sheet != null, "scene exposes the combat chronicle sheet")
	if pause_sheet == null or chronicle_sheet == null:
		paused = false
		return

	_expect(not paused, "scene begins with simulation processing active")
	_expect(not pause_sheet.visible, "pause sheet begins closed")
	_expect(not chronicle_sheet.visible, "chronicle sheet begins closed")
	_expect(pause_sheet.process_mode == Node.PROCESS_MODE_WHEN_PAUSED, "pause sheet remains operable while the tree is paused")
	_expect(chronicle_sheet.process_mode == Node.PROCESS_MODE_WHEN_PAUSED, "chronicle sheet remains operable while the tree is paused")
	_expect(pause_sheet.mouse_filter == Control.MOUSE_FILTER_STOP, "pause sheet blocks field input while open")
	_expect(chronicle_sheet.mouse_filter == Control.MOUSE_FILTER_STOP, "chronicle sheet blocks field input while open")

	var buttons_by_label := _buttons_by_normalized_label(nodes)
	for modal_button_label in ["menu", "return to battle", "log", "close"]:
		_expect(
			buttons_by_label.has(modal_button_label),
			"modal flow exposes a '%s' button" % _title_case(modal_button_label)
		)
	if (
		not buttons_by_label.has("menu")
		or not buttons_by_label.has("return to battle")
		or not buttons_by_label.has("log")
		or not buttons_by_label.has("close")
	):
		pause_sheet.visible = false
		chronicle_sheet.visible = false
		paused = false
		return

	var menu_button := buttons_by_label["menu"] as BaseButton
	var return_button := buttons_by_label["return to battle"] as BaseButton
	var log_button := buttons_by_label["log"] as BaseButton
	var close_button := buttons_by_label["close"] as BaseButton

	menu_button.pressed.emit()
	_expect(paused, "opening Menu pauses battle processing")
	_expect(pause_sheet.visible, "opening Menu reveals the pause sheet")
	_expect(not chronicle_sheet.visible, "opening Menu keeps the chronicle sheet closed")

	return_button.pressed.emit()
	_expect(not paused, "returning to battle resumes processing")
	_expect(not pause_sheet.visible, "returning to battle closes the pause sheet")

	log_button.pressed.emit()
	_expect(paused, "opening Log pauses battle processing")
	_expect(chronicle_sheet.visible, "opening Log reveals the combat chronicle")
	_expect(not pause_sheet.visible, "opening Log keeps the pause sheet closed")
	var populated_chronicle := false
	for node in nodes:
		if node is RichTextLabel and _is_descendant_of(node, chronicle_sheet):
			populated_chronicle = not (node as RichTextLabel).text.strip_edges().is_empty()
			if populated_chronicle:
				break
	_expect(populated_chronicle, "opening Log populates the combat chronicle")

	close_button.pressed.emit()
	_expect(not paused, "closing the chronicle resumes battle processing")
	_expect(not chronicle_sheet.visible, "closing the chronicle hides its modal sheet")

	# Keep screenshot and teardown behavior deterministic even when a modal
	# assertion above fails without invoking its expected callback.
	pause_sheet.visible = false
	chronicle_sheet.visible = false
	paused = false


func _collect_nodes(node: Node, destination: Array[Node]) -> void:
	destination.append(node)
	for child in node.get_children():
		_collect_nodes(child, destination)


func _nodes_of_type(nodes: Array[Node], type_name: StringName) -> Array[Node]:
	var matches: Array[Node] = []
	for node in nodes:
		if node.is_class(type_name):
			matches.append(node)
	return matches


func _control_named(nodes: Array[Node], node_name: String) -> Control:
	for node in nodes:
		if node is Control and String(node.name) == node_name:
			return node as Control
	return null


func _is_descendant_of(node: Node, ancestor: Node) -> bool:
	var current := node.get_parent()
	while current != null:
		if current == ancestor:
			return true
		current = current.get_parent()
	return false


func _collect_direct_texture_resources(node: Node, paths: Dictionary) -> void:
	for property_variant in node.get_property_list():
		var property: Dictionary = property_variant
		var property_name := StringName(property.get("name", ""))
		if property_name == &"":
			continue
		var value = node.get(property_name)
		if value is Texture2D or value is StyleBoxTexture:
			_collect_texture_paths(value, paths, {})


func _collect_texture_paths(value: Variant, paths: Dictionary, seen: Dictionary) -> void:
	if value == null or not value is Resource:
		return
	var resource := value as Resource
	var instance_id := resource.get_instance_id()
	if seen.has(instance_id):
		return
	seen[instance_id] = true

	var resource_path := resource.resource_path.to_lower()
	if not resource_path.is_empty():
		paths[resource_path] = true

	if resource is AtlasTexture:
		_collect_texture_paths((resource as AtlasTexture).atlas, paths, seen)
	elif resource is StyleBoxTexture:
		_collect_texture_paths((resource as StyleBoxTexture).texture, paths, seen)


func _labels_for_button(button: BaseButton) -> Array[String]:
	var labels: Array[String] = []
	if button is Button:
		var own_text := (button as Button).text.strip_edges()
		if not own_text.is_empty():
			labels.append(own_text)
	for descendant in button.find_children("*", "Label", true, false):
		var child_text := (descendant as Label).text.strip_edges()
		if not child_text.is_empty():
			labels.append(child_text)
	return labels


func _buttons_by_normalized_label(nodes: Array[Node]) -> Dictionary:
	var buttons: Dictionary = {}
	for node in nodes:
		if not node is BaseButton:
			continue
		var button := node as BaseButton
		for label in _labels_for_button(button):
			var normalized := _normalize_label(label)
			if not normalized.is_empty() and not buttons.has(normalized):
				buttons[normalized] = button
	return buttons


func _visible_text_for_control(control: Control) -> String:
	if control is Button:
		return (control as Button).text.strip_edges()
	if control is Label:
		return (control as Label).text.strip_edges()
	if control is RichTextLabel:
		return (control as RichTextLabel).text.strip_edges()
	return ""


func _normalize_label(value: String) -> String:
	var normalized := value.strip_edges().to_lower().replace("\n", " ").replace("\t", " ")
	while normalized.contains("  "):
		normalized = normalized.replace("  ", " ")
	return normalized


func _title_case(value: String) -> String:
	var words := value.split(" ", false)
	for index in range(words.size()):
		words[index] = words[index].capitalize()
	return " ".join(words)


func _paths_have_extension(paths: Dictionary, extension: String) -> bool:
	return _count_paths_with_extension(paths, extension) > 0


func _count_paths_with_extension(paths: Dictionary, extension: String) -> int:
	var count := 0
	for path_variant in paths:
		var path := str(path_variant).to_lower()
		if path.get_extension() == extension.trim_prefix("."):
			count += 1
	return count


func _find_files_with_extension(root_path: String, extension: String) -> Array[String]:
	var matches: Array[String] = []
	var directory := DirAccess.open(root_path)
	if directory == null:
		return matches
	directory.list_dir_begin()
	var entry := directory.get_next()
	while not entry.is_empty():
		if entry != "." and entry != "..":
			var path := root_path.path_join(entry)
			if directory.current_is_dir():
				matches.append_array(_find_files_with_extension(path, extension))
			elif entry.to_lower().ends_with(extension.to_lower()):
				matches.append(path)
		entry = directory.get_next()
	directory.list_dir_end()
	return matches


func _requested_screenshot_path() -> String:
	var arguments := OS.get_cmdline_user_args()
	for index in range(arguments.size()):
		var argument := str(arguments[index])
		if argument.begins_with("--screenshot="):
			return argument.trim_prefix("--screenshot=")
		if argument == "--screenshot" and index + 1 < arguments.size():
			return str(arguments[index + 1])
	return ""


func _write_optional_screenshot() -> void:
	var requested_path := _requested_screenshot_path()
	if requested_path.is_empty():
		return
	await RenderingServer.frame_post_draw
	var image := get_root().get_texture().get_image()
	if image == null or image.get_width() <= 1 or image.get_height() <= 1:
		push_warning("Screenshot unavailable from the current renderer; structural smoke checks still ran.")
		return
	var output_path := requested_path
	if output_path.begins_with("res://") or output_path.begins_with("user://"):
		output_path = ProjectSettings.globalize_path(output_path)
	var error := image.save_png(output_path)
	if error == OK:
		print("Presentation screenshot: %s" % output_path)
	else:
		push_warning("Could not save optional screenshot to %s (error %d)." % [output_path, error])


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _expect_close(actual: float, expected: float, message: String) -> void:
	_expect(
		absf(actual - expected) <= LAYOUT_TOLERANCE,
		"%s (expected %.1f, found %.1f)" % [message, expected, actual]
	)


func _finish() -> void:
	if _failures.is_empty():
		print("PASS presentation smoke: %d checks" % _checks)
		quit(0)
		return
	print("FAIL presentation smoke: %d of %d checks failed" % [_failures.size(), _checks])
	for failure in _failures:
		print("  - " + failure)
	quit(1)
