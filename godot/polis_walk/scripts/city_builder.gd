extends Node3D
## CityBuilder — management view with census sections as game tiles.
## Sections are the playable units; buildings sit on top colored by use.

const CITY_SCALE := 0.15

# ── Color palette by building use ──
# Warm tones = hospitality/people · Cool tones = services/institutional
var PALETTE := {
	"food_drink":      Color(0.92, 0.42, 0.18),   # naranja cálido
	"shop":            Color(0.25, 0.52, 0.82),   # azul comercio
	"accommodation":   Color(0.58, 0.30, 0.72),   # púrpura turístico
	"health":          Color(0.22, 0.68, 0.38),   # verde salud
	"finance":         Color(0.82, 0.68, 0.18),   # dorado banca
	"education":       Color(0.35, 0.62, 0.82),   # celeste educación
	"culture_leisure": Color(0.78, 0.28, 0.52),   # magenta cultura
	"tourism":         Color(0.18, 0.65, 0.60),   # teal turismo
	"leisure":         Color(0.48, 0.72, 0.30),   # lima ocio
	"office":          Color(0.48, 0.48, 0.55),   # gris oficina
	"transport":       Color(0.38, 0.40, 0.45),   # pizarra transporte
	"public_service":  Color(0.72, 0.25, 0.22),   # rojo institucional
	"amenity_other":   Color(0.60, 0.55, 0.48),   # beige servicios
}
var RESIDENTIAL_COLOR := Color(0.78, 0.75, 0.70, 0.5)  # semitransparente

# ── Section (barrio) colors ──
var BARRIO_COLORS := {
	"Santa Catalina-Canteras": Color(0.20, 0.35, 0.50, 0.35),
	"Guanarteme":              Color(0.18, 0.40, 0.35, 0.35),
	"La Isleta":               Color(0.35, 0.25, 0.42, 0.35),
	"Alcaravaneras":           Color(0.40, 0.30, 0.18, 0.35),
	"Ciudad Jardín":           Color(0.25, 0.38, 0.22, 0.35),
	"Ciudad del Mar":          Color(0.38, 0.20, 0.28, 0.35),
	"Sin nombre":              Color(0.30, 0.30, 0.30, 0.25),
}

# ── Section data for interaction ──
var section_data := {}       # "S_3501603005" → Dictionary
var section_labels := {}     # "S_3501603005" → Label3D
var section_mats := {}       # "S_3501603005" → StandardMaterial3D
var _hovered_section := ""
var _selected_section := ""

# ── Materials ──
var mat_roof: StandardMaterial3D
var mat_road: StandardMaterial3D
var mat_sidewalk: StandardMaterial3D
var mat_beach: StandardMaterial3D
var mat_sea: StandardMaterial3D
var mat_park: StandardMaterial3D
var mat_tree_trunk: StandardMaterial3D
var mat_tree_leaves: StandardMaterial3D

# ── Building data for interaction ──
var building_data := {}      # "B_123" → Dictionary from JSON
var building_labels := {}    # "B_123" → Label3D
var building_mats := {}      # "B_123" → StandardMaterial3D (to highlight)
var _hovered_name := ""
var _selected_name := ""

# ── Info panel (Label3D for selected building) ──
var info_label: Label3D

func _ready() -> void:
	_create_materials()
	_build_ground()
	_load_city()
	_build_sea()
	_create_info_panel()

func _create_materials() -> void:
	mat_roof = StandardMaterial3D.new()
	mat_roof.albedo_color = Color(0.65, 0.42, 0.28)
	mat_roof.roughness = 0.8

	mat_road = StandardMaterial3D.new()
	mat_road.albedo_color = Color(0.28, 0.28, 0.30)
	mat_road.roughness = 0.95

	mat_sidewalk = StandardMaterial3D.new()
	mat_sidewalk.albedo_color = Color(0.68, 0.65, 0.60)
	mat_sidewalk.roughness = 0.9

	mat_beach = StandardMaterial3D.new()
	mat_beach.albedo_color = Color(0.96, 0.91, 0.68)
	mat_beach.roughness = 1.0

	mat_sea = StandardMaterial3D.new()
	mat_sea.albedo_color = Color(0.02, 0.18, 0.42)
	mat_sea.roughness = 0.1
	mat_sea.metallic = 0.3

	mat_park = StandardMaterial3D.new()
	mat_park.albedo_color = Color(0.30, 0.58, 0.25)
	mat_park.roughness = 0.95

	mat_tree_trunk = StandardMaterial3D.new()
	mat_tree_trunk.albedo_color = Color(0.40, 0.28, 0.15)
	mat_tree_trunk.roughness = 0.9

	mat_tree_leaves = StandardMaterial3D.new()
	mat_tree_leaves.albedo_color = Color(0.22, 0.50, 0.18)
	mat_tree_leaves.roughness = 0.85

func _create_info_panel() -> void:
	info_label = Label3D.new()
	info_label.font_size = 32
	info_label.pixel_size = 0.008
	info_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	info_label.no_depth_test = true
	info_label.modulate = Color(1, 1, 1, 1)
	info_label.outline_modulate = Color(0, 0, 0, 0.9)
	info_label.outline_size = 10
	info_label.visible = false
	info_label.name = "InfoPanel"
	add_child(info_label)

# ── Hover / Select callbacks (called by management_camera) ──

func on_building_hover(mesh: MeshInstance3D) -> void:
	var bname := mesh.name
	if bname == _hovered_name:
		return
	# Unhighlight previous
	_unhighlight(_hovered_name)
	_hovered_name = bname
	# Highlight this one
	_highlight(bname)
	# Show marquee label
	if bname in building_labels:
		building_labels[bname].visible = true

func on_building_unhover() -> void:
	if _hovered_name != "" and _hovered_name != _selected_name:
		_unhighlight(_hovered_name)
		if _hovered_name in building_labels:
			building_labels[_hovered_name].visible = false
	_hovered_name = ""

func on_building_select(mesh: MeshInstance3D) -> void:
	var bname := mesh.name
	# Deselect previous
	if _selected_name != "" and _selected_name != _hovered_name:
		_unhighlight(_selected_name)
		if _selected_name in building_labels:
			building_labels[_selected_name].visible = false
	_selected_name = bname
	_highlight(bname)
	# Show detailed info panel
	if bname in building_data:
		var b: Dictionary = building_data[bname]
		var text := _format_detail(b)
		var cx: float = _sx(float(b["cx"]))
		var cz: float = _sx(float(b["cz"]))
		var h: float = float(b["height"]) * CITY_SCALE
		if h < 0.45:
			h = 0.45
		info_label.text = text
		info_label.position = Vector3(cx, h + 1.2, -cz)
		info_label.visible = true

func _highlight(bname: String) -> void:
	if bname in building_mats:
		var mat: StandardMaterial3D = building_mats[bname]
		mat.emission_enabled = true
		mat.emission = Color(1, 1, 1)
		mat.emission_energy_multiplier = 0.4

func _unhighlight(bname: String) -> void:
	if bname in building_mats:
		var mat: StandardMaterial3D = building_mats[bname]
		if bname in building_data and building_data[bname].has("primary_cat"):
			var cat: String = building_data[bname]["primary_cat"]
			mat.emission = PALETTE.get(cat, Color.WHITE) * 0.1
			mat.emission_energy_multiplier = 0.2
		else:
			mat.emission_enabled = false

func _format_detail(b: Dictionary) -> String:
	var lines := PackedStringArray()
	var cat: String = str(b.get("primary_cat", "residencial"))
	var count: int = int(b.get("poi_count", 0))
	lines.append("[%s] %d negocios" % [_cat_name(cat), count])
	lines.append("")
	var names: Array = b.get("poi_names", [])
	for entry in names:
		var n: String = entry.get("name", "")
		var sub: String = entry.get("subcat", "")
		if n:
			var line := "%s  (%s)" % [n, sub]
			if entry.has("cuisine"):
				line += "  [%s]" % entry["cuisine"]
			lines.append(line)
	var extra: int = b.get("poi_extra", 0)
	if extra > 0:
		lines.append("+%d más" % extra)
	return "\n".join(lines)

func _cat_name(cat: String) -> String:
	match cat:
		"food_drink": return "Restauración"
		"shop": return "Comercio"
		"accommodation": return "Alojamiento"
		"health": return "Salud"
		"finance": return "Finanzas"
		"culture_leisure": return "Cultura"
		"education": return "Educación"
		"tourism": return "Turismo"
		"leisure": return "Ocio"
		"office": return "Oficinas"
		"transport": return "Transporte"
		"public_service": return "Serv. Público"
		"amenity_other": return "Servicios"
		_: return "Residencial"

func _sx(v: float) -> float:
	return v * CITY_SCALE

# ── Ground ──

func _build_ground() -> void:
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(600, 600)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.22, 0.21, 0.20)  # dark base for contrast
	mat.roughness = 0.95
	mesh.material = mat
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.name = "Ground"
	add_child(mi)
	var sb := StaticBody3D.new()
	sb.name = "GroundBody"
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(600, 0.1, 600)
	cs.shape = box
	cs.position = Vector3(0, -0.05, 0)
	sb.add_child(cs)
	add_child(sb)

func _build_sea() -> void:
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(800, 800)
	mesh.material = mat_sea
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.name = "Sea"
	mi.position = Vector3(-280, 0.01, -30)
	add_child(mi)

# ── Load city ──

func _load_city() -> void:
	var file := FileAccess.open("res://canteras_enriched.json", FileAccess.READ)
	if not file:
		file = FileAccess.open("res://canteras_data.json", FileAccess.READ)
	if not file:
		push_error("No data file found")
		return
	var json := JSON.new()
	var err := json.parse(file.get_as_text())
	file.close()
	if err != OK:
		push_error("JSON parse error")
		return
	var data: Dictionary = json.data

	# Load census sections as game tiles
	_load_sections()

	if data.has("buildings"):
		_build_buildings(data["buildings"])
	if data.has("roads"):
		_build_roads(data["roads"])
	if data.has("beaches"):
		_build_beaches(data["beaches"])
	if data.has("parks"):
		_build_parks(data["parks"])
	if data.has("trees"):
		_build_trees(data["trees"])
	if data.has("coastline"):
		_build_coastline(data["coastline"])

# ── CENSUS SECTIONS (game tiles) ──

func _load_sections() -> void:
	var file := FileAccess.open("res://canteras_sections.json", FileAccess.READ)
	if not file:
		push_warning("No canteras_sections.json — skipping sections")
		return
	var json := JSON.new()
	var err := json.parse(file.get_as_text())
	file.close()
	if err != OK:
		return

	var sections: Array = json.data
	var holder := Node3D.new()
	holder.name = "Sections"
	add_child(holder)

	var label_h := Node3D.new()
	label_h.name = "SectionLabels"
	add_child(label_h)

	for sec in sections:
		var sid: String = str(sec["id"])
		var barrio: String = str(sec.get("barrio", "Sin nombre"))
		var coords: Array = sec["coords"]
		var cx: float = float(sec["cx"])
		var cz: float = float(sec["cz"])
		var sname := "S_%s" % sid

		section_data[sname] = sec

		# Section polygon on ground
		var base_color: Color = BARRIO_COLORS.get(barrio, Color(0.30, 0.30, 0.30, 0.25))
		var smat := StandardMaterial3D.new()
		smat.albedo_color = base_color
		smat.roughness = 0.9
		smat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		section_mats[sname] = smat

		# Coords are already scaled — build flat polygon directly
		var mesh := _make_section_polygon(coords, 0.005)
		if mesh:
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			mi.material_override = smat
			mi.name = sname
			holder.add_child(mi)

		# Section border (slightly elevated line)
		var border := _make_section_border(coords)
		if border:
			var bi := MeshInstance3D.new()
			bi.mesh = border
			var bmat := StandardMaterial3D.new()
			bmat.albedo_color = Color(0.8, 0.8, 0.8, 0.3)
			bmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			bi.material_override = bmat
			bi.position.y = 0.01
			bi.name = "Border_%s" % sid
			holder.add_child(bi)

		# Section label (barrio + id)
		var secnum: String = str(sec.get("seccion", ""))
		var lbl := Label3D.new()
		lbl.text = "%s\n§%s" % [barrio, secnum]
		lbl.font_size = 18
		lbl.pixel_size = 0.008
		lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		lbl.no_depth_test = true
		lbl.modulate = Color(1, 1, 1, 0.0)  # hidden by default
		lbl.outline_modulate = Color(0, 0, 0, 0.8)
		lbl.outline_size = 6
		lbl.visible = true
		lbl.position = Vector3(cx, 0.5, -cz)
		lbl.name = "SL_%s" % sid
		label_h.add_child(lbl)
		section_labels[sname] = lbl

	print("Sections: %d" % sections.size())

func _make_section_polygon(coords: Array, y: float) -> ArrayMesh:
	var n := coords.size()
	if n < 3:
		return null
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	# Coords are already in scaled local space
	var v0 := Vector3(float(coords[0][0]), y, -float(coords[0][1]))
	for i in range(1, n - 1):
		var v1 := Vector3(float(coords[i][0]), y, -float(coords[i][1]))
		var v2 := Vector3(float(coords[i + 1][0]), y, -float(coords[i + 1][1]))
		st.set_uv(Vector2(0, 0)); st.add_vertex(v0)
		st.set_uv(Vector2(1, 0)); st.add_vertex(v1)
		st.set_uv(Vector2(1, 1)); st.add_vertex(v2)
	return st.commit()

func _make_section_border(coords: Array) -> ArrayMesh:
	var n := coords.size()
	if n < 3:
		return null
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	var w := 0.15  # border width
	for i in range(n):
		var j := (i + 1) % n
		var ax: float = float(coords[i][0])
		var az: float = float(coords[i][1])
		var bx: float = float(coords[j][0])
		var bz: float = float(coords[j][1])
		var dx := bx - ax
		var dz := bz - az
		var seg_len := sqrt(dx * dx + dz * dz)
		if seg_len < 0.01:
			continue
		var nx := -dz / seg_len * w
		var nz := dx / seg_len * w
		var p0 := Vector3(ax + nx, 0, -(az + nz))
		var p1 := Vector3(ax - nx, 0, -(az - nz))
		var p2 := Vector3(bx - nx, 0, -(bz - nz))
		var p3 := Vector3(bx + nx, 0, -(bz + nz))
		st.set_uv(Vector2(0, 0)); st.add_vertex(p0)
		st.set_uv(Vector2(1, 0)); st.add_vertex(p1)
		st.set_uv(Vector2(1, 1)); st.add_vertex(p2)
		st.set_uv(Vector2(0, 0)); st.add_vertex(p0)
		st.set_uv(Vector2(1, 1)); st.add_vertex(p2)
		st.set_uv(Vector2(0, 1)); st.add_vertex(p3)
	return st.commit()

# ── BUILDINGS ──

func _build_buildings(buildings: Array) -> void:
	var holder := Node3D.new()
	holder.name = "Buildings"
	add_child(holder)

	var label_holder := Node3D.new()
	label_holder.name = "Labels"
	add_child(label_holder)

	var poi_count := 0

	for i in buildings.size():
		var b: Dictionary = buildings[i]
		var coords: Array = b["coords"]
		var height: float = float(b["height"]) * CITY_SCALE
		if height < 0.15:
			height = 0.45

		var has_poi: bool = b.has("primary_cat")
		var cat: String = b.get("primary_cat", "")
		var bname := "B_%d" % i

		# Store data for interaction
		building_data[bname] = b

		# Material
		var bmat := StandardMaterial3D.new()
		if has_poi:
			bmat.albedo_color = PALETTE.get(cat, RESIDENTIAL_COLOR)
			bmat.roughness = 0.5
			bmat.emission_enabled = true
			bmat.emission = PALETTE.get(cat, Color.WHITE) * 0.1
			bmat.emission_energy_multiplier = 0.2
		else:
			bmat.albedo_color = RESIDENTIAL_COLOR
			bmat.roughness = 0.85
			bmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		building_mats[bname] = bmat

		# Walls
		var walls := _extrude_polygon_scaled(coords, height)
		if walls:
			var mi := MeshInstance3D.new()
			mi.mesh = walls
			mi.material_override = bmat
			mi.name = bname
			holder.add_child(mi)
			mi.create_trimesh_collision()

		# Roof
		var roof_mat := bmat if has_poi else mat_roof
		var roof := _make_flat_polygon_scaled(coords, height)
		if roof:
			var ri := MeshInstance3D.new()
			ri.mesh = roof
			ri.material_override = roof_mat
			ri.name = "R_%d" % i
			holder.add_child(ri)

		# Marquee label (hidden until hover)
		if has_poi:
			poi_count += 1
			var cx: float = _sx(float(b["cx"]))
			var cz: float = _sx(float(b["cz"]))

			# Build short label text: main name or category
			var label_text := ""
			var names: Array = b.get("poi_names", [])
			if names.size() > 0:
				label_text = names[0].get("name", _cat_name(cat))
				if names.size() > 1:
					label_text += "  +%d" % (names.size() - 1)
			else:
				label_text = _cat_name(cat)

			var lbl := Label3D.new()
			lbl.text = label_text
			lbl.font_size = 22
			lbl.pixel_size = 0.006
			lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			lbl.no_depth_test = true
			lbl.modulate = Color(1, 1, 1, 0.95)
			lbl.outline_modulate = Color(0, 0, 0, 0.85)
			lbl.outline_size = 8
			lbl.visible = false
			lbl.name = "L_%d" % i
			lbl.position = Vector3(cx, height + 0.25, -cz)
			label_holder.add_child(lbl)
			building_labels[bname] = lbl

	print("Buildings: %d (%d with POIs)" % [buildings.size(), poi_count])

# ── ROADS ──

func _build_roads(roads: Array) -> void:
	var holder := Node3D.new()
	holder.name = "Roads"
	add_child(holder)
	for i in roads.size():
		var r: Dictionary = roads[i]
		var coords: Array = r["coords"]
		var width: float = float(r["width"]) * CITY_SCALE
		var rtype: String = r.get("type", "residential")
		var mat := mat_sidewalk if rtype in ["pedestrian", "footway", "path", "steps"] else mat_road
		var road_mesh := _make_road_strip_scaled(coords, width)
		if road_mesh:
			var mi := MeshInstance3D.new()
			mi.mesh = road_mesh
			mi.material_override = mat
			mi.name = "Road_%d" % i
			mi.position.y = 0.02
			holder.add_child(mi)
	print("Roads: %d" % roads.size())

# ── BEACHES ──

func _build_beaches(beaches: Array) -> void:
	for i in beaches.size():
		var coords: Array = beaches[i]
		var mesh := _make_flat_polygon_scaled(coords, 0.06)
		if mesh:
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			mi.material_override = mat_beach
			mi.name = "Beach_%d" % i
			add_child(mi)
	print("Beaches: %d" % beaches.size())

# ── PARKS ──

func _build_parks(parks: Array) -> void:
	var holder := Node3D.new()
	holder.name = "Parks"
	add_child(holder)
	for i in parks.size():
		var p: Dictionary = parks[i]
		var coords: Array = p["coords"]
		var mesh := _make_flat_polygon_scaled(coords, 0.03)
		if mesh:
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			mi.material_override = mat_park
			mi.name = "Park_%d" % i
			holder.add_child(mi)
	print("Parks: %d" % parks.size())

# ── TREES ──

func _build_trees(tree_positions: Array) -> void:
	var holder := Node3D.new()
	holder.name = "Trees"
	add_child(holder)
	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.02
	trunk_mesh.bottom_radius = 0.03
	trunk_mesh.height = 0.4
	var canopy_mesh := SphereMesh.new()
	canopy_mesh.radius = 0.25
	canopy_mesh.height = 0.35
	for i in tree_positions.size():
		var pos: Array = tree_positions[i]
		var x: float = _sx(float(pos[0]))
		var z: float = _sx(float(pos[1]))
		var tree := Node3D.new()
		tree.name = "Tree_%d" % i
		tree.position = Vector3(x, 0, -z)
		var ti := MeshInstance3D.new()
		ti.mesh = trunk_mesh
		ti.material_override = mat_tree_trunk
		ti.position.y = 0.2
		tree.add_child(ti)
		var ci := MeshInstance3D.new()
		ci.mesh = canopy_mesh
		ci.material_override = mat_tree_leaves
		ci.position.y = 0.5
		tree.add_child(ci)
		holder.add_child(tree)
	print("Trees: %d" % tree_positions.size())

# ── COASTLINE ──

func _build_coastline(segments: Array) -> void:
	for i in segments.size():
		var coords: Array = segments[i]
		var mesh := _make_road_strip_scaled(coords, 1.5 * CITY_SCALE)
		if mesh:
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			mi.material_override = mat_beach
			mi.name = "Coast_%d" % i
			mi.position.y = 0.05
			add_child(mi)
	print("Coastline segments: %d" % segments.size())

# ══════════════════════════════════════════
#  GEOMETRY HELPERS
# ══════════════════════════════════════════

func _extrude_polygon_scaled(coords: Array, height: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := coords.size()
	if n < 3:
		return null
	for i in range(n):
		var j := (i + 1) % n
		var ax: float = _sx(float(coords[i][0]))
		var az: float = _sx(float(coords[i][1]))
		var bx: float = _sx(float(coords[j][0]))
		var bz: float = _sx(float(coords[j][1]))
		var p0 := Vector3(ax, 0, -az)
		var p1 := Vector3(bx, 0, -bz)
		var p2 := Vector3(bx, height, -bz)
		var p3 := Vector3(ax, height, -az)
		var edge := p1 - p0
		var normal := edge.cross(Vector3.UP).normalized()
		st.set_normal(normal)
		st.set_uv(Vector2(0, 0)); st.add_vertex(p0)
		st.set_uv(Vector2(1, 0)); st.add_vertex(p1)
		st.set_uv(Vector2(1, 1)); st.add_vertex(p2)
		st.set_normal(normal)
		st.set_uv(Vector2(0, 0)); st.add_vertex(p0)
		st.set_uv(Vector2(1, 1)); st.add_vertex(p2)
		st.set_uv(Vector2(0, 1)); st.add_vertex(p3)
	return st.commit()

func _make_flat_polygon_scaled(coords: Array, y: float) -> ArrayMesh:
	var n := coords.size()
	if n < 3:
		return null
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	var v0 := Vector3(_sx(float(coords[0][0])), y, -_sx(float(coords[0][1])))
	for i in range(1, n - 1):
		var v1 := Vector3(_sx(float(coords[i][0])), y, -_sx(float(coords[i][1])))
		var v2 := Vector3(_sx(float(coords[i + 1][0])), y, -_sx(float(coords[i + 1][1])))
		st.set_uv(Vector2(0, 0)); st.add_vertex(v0)
		st.set_uv(Vector2(1, 0)); st.add_vertex(v1)
		st.set_uv(Vector2(1, 1)); st.add_vertex(v2)
	return st.commit()

func _make_road_strip_scaled(coords: Array, width: float) -> ArrayMesh:
	var n := coords.size()
	if n < 2:
		return null
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	var half_w := width / 2.0
	for i in range(n - 1):
		var ax: float = _sx(float(coords[i][0]))
		var az: float = _sx(float(coords[i][1]))
		var bx: float = _sx(float(coords[i + 1][0]))
		var bz: float = _sx(float(coords[i + 1][1]))
		var dx := bx - ax
		var dz := bz - az
		var seg_len := sqrt(dx * dx + dz * dz)
		if seg_len < 0.001:
			continue
		var nx := -dz / seg_len * half_w
		var nz := dx / seg_len * half_w
		var p0 := Vector3(ax + nx, 0, -(az + nz))
		var p1 := Vector3(ax - nx, 0, -(az - nz))
		var p2 := Vector3(bx - nx, 0, -(bz - nz))
		var p3 := Vector3(bx + nx, 0, -(bz + nz))
		st.set_uv(Vector2(0, 0)); st.add_vertex(p0)
		st.set_uv(Vector2(1, 0)); st.add_vertex(p1)
		st.set_uv(Vector2(1, 1)); st.add_vertex(p2)
		st.set_uv(Vector2(0, 0)); st.add_vertex(p0)
		st.set_uv(Vector2(1, 1)); st.add_vertex(p2)
		st.set_uv(Vector2(0, 1)); st.add_vertex(p3)
	return st.commit()
