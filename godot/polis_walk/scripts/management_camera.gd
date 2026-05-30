extends Camera3D
## Management camera: orbit, pan, zoom with mouse.
## Left-click selects buildings. Hover shows labels.

const ZOOM_SPEED := 2.0
const ZOOM_MIN := 5.0
const ZOOM_MAX := 120.0
const PAN_SPEED := 0.15
const ORBIT_SPEED := 0.005
const INITIAL_DISTANCE := 40.0
const INITIAL_PITCH := -1.1   # looking down ~63°
const INITIAL_YAW := 0.4

var pivot := Vector3(-10, 0, -20)  # center of paseo area (scaled)
var distance := INITIAL_DISTANCE
var pitch := INITIAL_PITCH
var yaw := INITIAL_YAW

var _dragging_pan := false
var _dragging_orbit := false
var _last_mouse := Vector2.ZERO

# Hover / selection
var _hovered_building: Node = null
var _city_builder: Node = null

func _ready() -> void:
	_update_transform()
	# Find city builder for hover callbacks
	_city_builder = get_node_or_null("../City")

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		match mb.button_index:
			MOUSE_BUTTON_MIDDLE:
				if mb.pressed:
					if mb.shift_pressed:
						_dragging_orbit = true
					else:
						_dragging_pan = true
					_last_mouse = mb.position
				else:
					_dragging_pan = false
					_dragging_orbit = false
			MOUSE_BUTTON_RIGHT:
				if mb.pressed:
					_dragging_orbit = true
					_last_mouse = mb.position
				else:
					_dragging_orbit = false
			MOUSE_BUTTON_WHEEL_UP:
				distance = max(ZOOM_MIN, distance - ZOOM_SPEED * (distance * 0.08))
				_update_transform()
			MOUSE_BUTTON_WHEEL_DOWN:
				distance = min(ZOOM_MAX, distance + ZOOM_SPEED * (distance * 0.08))
				_update_transform()
			MOUSE_BUTTON_LEFT:
				if mb.pressed:
					_try_select(mb.position)

	if event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		if _dragging_pan:
			var delta := mm.position - _last_mouse
			_last_mouse = mm.position
			# Pan in the camera's local XZ plane
			var right := global_transform.basis.x
			var forward := global_transform.basis.z
			# Project to horizontal
			right.y = 0
			forward.y = 0
			right = right.normalized()
			forward = forward.normalized()
			pivot -= right * delta.x * PAN_SPEED * (distance * 0.01)
			pivot += forward * delta.y * PAN_SPEED * (distance * 0.01)
			_update_transform()
		elif _dragging_orbit:
			var delta := mm.position - _last_mouse
			_last_mouse = mm.position
			yaw -= delta.x * ORBIT_SPEED
			pitch -= delta.y * ORBIT_SPEED
			pitch = clamp(pitch, -1.5, -0.2)
			_update_transform()
		else:
			# Hover detection
			_try_hover(mm.position)

func _update_transform() -> void:
	var offset := Vector3(
		sin(yaw) * cos(pitch) * distance,
		-sin(pitch) * distance,
		cos(yaw) * cos(pitch) * distance,
	)
	global_position = pivot + offset
	look_at(pivot, Vector3.UP)

func _try_hover(screen_pos: Vector2) -> void:
	if not _city_builder or not _city_builder.has_method("on_building_hover"):
		return
	var from := project_ray_origin(screen_pos)
	var dir := project_ray_normal(screen_pos)
	var space := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(from, from + dir * 500.0)
	var result := space.intersect_ray(query)
	if result:
		var collider: Object = result["collider"]
		var parent: Node = collider.get_parent() if collider is Node else null
		if parent and parent is MeshInstance3D and parent.name.begins_with("B_"):
			if parent != _hovered_building:
				_city_builder.on_building_hover(parent)
				_hovered_building = parent
		else:
			if _hovered_building:
				_city_builder.on_building_unhover()
				_hovered_building = null
	else:
		if _hovered_building:
			_city_builder.on_building_unhover()
			_hovered_building = null

func _try_select(screen_pos: Vector2) -> void:
	if not _city_builder or not _city_builder.has_method("on_building_select"):
		return
	var from := project_ray_origin(screen_pos)
	var dir := project_ray_normal(screen_pos)
	var space := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(from, from + dir * 500.0)
	var result := space.intersect_ray(query)
	if result:
		var collider: Object = result["collider"]
		var parent: Node = collider.get_parent() if collider is Node else null
		if parent and parent is MeshInstance3D and parent.name.begins_with("B_"):
			_city_builder.on_building_select(parent)
