extends CharacterBody3D
## Third-person player: WASD + mouse look.
## W moves toward where the camera looks, S backward, A/D strafe.

const SPEED := 8.0
const SPRINT_SPEED := 18.0
const JUMP_VELOCITY := 4.0
const MOUSE_SENSITIVITY := 0.003
const CAMERA_DISTANCE := 6.0
const CAMERA_HEIGHT := 3.5
const MIN_PITCH := -0.85
const MAX_PITCH := 0.6

var yaw := 2.75   # facing along the paseo (south-ish)
var pitch := -0.25

@onready var camera_pivot: Node3D = $CameraPivot
@onready var camera: Camera3D = $CameraPivot/Camera3D

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		yaw -= event.relative.x * MOUSE_SENSITIVITY
		pitch -= event.relative.y * MOUSE_SENSITIVITY
		pitch = clamp(pitch, MIN_PITCH, MAX_PITCH)
	if event.is_action_pressed("ui_cancel"):
		if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		else:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _physics_process(delta: float) -> void:
	# Gravity
	if not is_on_floor():
		velocity += get_gravity() * delta

	# Jump
	if Input.is_action_just_pressed("ui_accept") and is_on_floor():
		velocity.y = JUMP_VELOCITY

	# Direction vectors based on camera yaw
	# Forward = direction camera faces (projected on XZ)
	var forward := Vector3(-sin(yaw), 0, -cos(yaw)).normalized()
	var right := Vector3(cos(yaw), 0, -sin(yaw)).normalized()

	# Input
	var input_dir := Vector3.ZERO
	if Input.is_action_pressed("move_forward"):
		input_dir += forward
	if Input.is_action_pressed("move_back"):
		input_dir -= forward
	if Input.is_action_pressed("move_left"):
		input_dir -= right
	if Input.is_action_pressed("move_right"):
		input_dir += right

	if input_dir.length() > 0:
		input_dir = input_dir.normalized()

	var speed := SPRINT_SPEED if Input.is_action_pressed("ui_page_down") else SPEED
	if input_dir.length() > 0:
		velocity.x = input_dir.x * speed
		velocity.z = input_dir.z * speed
		# Rotate character mesh to face movement direction
		rotation.y = atan2(input_dir.x, input_dir.z)
	else:
		velocity.x = move_toward(velocity.x, 0, speed * 0.3)
		velocity.z = move_toward(velocity.z, 0, speed * 0.3)

	move_and_slide()

	# Camera follows behind, orbiting around player
	# Use global_rotation so character body rotation doesn't affect camera
	camera_pivot.global_position = global_position + Vector3(0, CAMERA_HEIGHT, 0)
	camera_pivot.global_rotation = Vector3(pitch, yaw, 0)
	camera.position = Vector3(0, 0, CAMERA_DISTANCE)
