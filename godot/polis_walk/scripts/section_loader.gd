extends Node
## SectionLoader — carga un "data pack" de sección censal generado por
## scripts/iso_pack.py y lo instancia como Node3D listo para añadir a la
## escena. Convención de ejes: X=east_m, Y=height_m, Z=south_m. Origen:
## centroide de la sección. Unidades: metros.
##
## El pack contiene meta.json + N geojsons en metros locales (ENU
## linealizado por cos(lat0)). Este loader NO toca la red ni descarga
## tiles — todo el contenido vive en res:// (o en disco para depurar).
##
## Uso típico al pie del archivo.

class_name SectionLoader

# // shared helper — carga un JSON de res:// o ruta absoluta y devuelve Dict/Array
static func _load_json(path: String):
	var file := FileAccess.open(path, FileAccess.READ)
	if not file:
		push_warning("SectionLoader: no se pudo abrir %s" % path)
		return null
	var txt := file.get_as_text()
	file.close()
	var json := JSON.new()
	var err := json.parse(txt)
	if err != OK:
		push_error("SectionLoader: JSON inválido en %s — %s" % [path, json.error_string])
		return null
	return json.data

# // shared helper — convierte "#RRGGBB" a Color
static func _hex2color(h: String) -> Color:
	var s: String = h
	if s.begins_with("#"):
		s = s.substr(1)
	if s.length() < 6:
		return Color.WHITE
	var r := s.substr(0, 2).hex_to_int() / 255.0
	var g := s.substr(2, 2).hex_to_int() / 255.0
	var b := s.substr(4, 2).hex_to_int() / 255.0
	return Color(r, g, b)

# // shared helper — construye un StandardMaterial3D opaco con un color base
static func _make_material(color: Color, metallic: float = 0.0,
		roughness: float = 0.85) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.metallic = metallic
	m.roughness = roughness
	return m

# // shared helper — convierte una lista de [x,z] (locales) a PackedVector3Array
# en y=0 para usar como base de extrusión / suelo.
static func _ring_to_vec3(ring: Array, y: float) -> PackedVector3Array:
	var arr := PackedVector3Array()
	for p in ring:
		arr.append(Vector3(float(p[0]), y, float(p[1])))
	return arr

## Carga un section pack y devuelve un Node3D con todas las capas instanciadas.
## - cusec: identificador de sección (10 dígitos)
## - base_path: directorio raíz donde vive el pack (puede ser
##   "res://sections_pack/" o una ruta de FS para depuración).
static func load_section(cusec: String, base_path: String) -> Node3D:
	var root := Node3D.new()
	root.name = "Section_%s" % cusec

	# 1) meta.json — categorías, colores, escalas
	var pack_dir := base_path
	if not pack_dir.ends_with("/"):
		pack_dir += "/"
	pack_dir += cusec + "/"
	var meta = _load_json(pack_dir + "meta.json")
	if meta == null:
		push_error("SectionLoader: meta.json no encontrado en %s" % pack_dir)
		return root

	# 2) materiales por categoría a partir del meta
	var materials := {}
	var extrude_flags := {}
	for cat_name in meta["categories"].keys():
		var info: Dictionary = meta["categories"][cat_name]
		materials[cat_name] = _make_material(_hex2color(info["color"]))
		extrude_flags[cat_name] = bool(info.get("extrude", false))

	# Materiales auxiliares planos (calles, parques, agua)
	var mat_road: StandardMaterial3D = materials.get("calle", _make_material(Color(0.54, 0.51, 0.46)))
	var mat_park: StandardMaterial3D = materials.get("parque", _make_material(Color(0.66, 0.76, 0.54)))
	var mat_water: StandardMaterial3D = materials.get("agua", _make_material(Color(0.48, 0.63, 0.76)))

	# 3) suelo de la sección (Polygon plano en y=0)
	var section_data = _load_json(pack_dir + "section.geojson")
	if section_data and section_data.has("features"):
		for f in section_data["features"]:
			if f["properties"].get("coords_system") != "local_m_enu":
				continue
			var ring: Array = f["geometry"]["coordinates"][0]
			var ground_mesh := _make_flat_polygon(ring, 0.0)
			if ground_mesh:
				var gi := MeshInstance3D.new()
				gi.mesh = ground_mesh
				gi.material_override = _make_material(Color(0.96, 0.92, 0.82))
				gi.name = "SectionGround"
				root.add_child(gi)

	# 4) buildings.geojson — extruir cada feature con extrude:true a height_m
	var b_holder := Node3D.new()
	b_holder.name = "Buildings"
	root.add_child(b_holder)
	var b_data = _load_json(pack_dir + "buildings.geojson")
	if b_data and b_data.has("features"):
		for f in b_data["features"]:
			var props: Dictionary = f["properties"]
			var ring: Array = f["geometry"]["coordinates"][0]
			var height: float = float(props.get("height_m", 6.0))
			var cat: String = str(props.get("category", "residencial"))
			var mat: StandardMaterial3D = materials.get(cat, materials["residencial"])
			# Placeholder con BoxMesh sobre el bbox del polígono. Para el
			# polígono real recomendado: usar CSGPolygon3D con polygon =
			# ring proyectado a 2D + depth = height; luego CSGCombiner3D
			# para optimizar. Aquí dejamos el BoxMesh como starter rápido.
			var bbox := _ring_bbox(ring)
			var size := Vector3(bbox[2] - bbox[0], height, bbox[3] - bbox[1])
			if size.x <= 0.1 or size.z <= 0.1:
				continue
			var mesh := BoxMesh.new()
			mesh.size = size
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			mi.material_override = mat
			mi.position = Vector3((bbox[0] + bbox[2]) / 2.0,
								  height / 2.0,
								  (bbox[1] + bbox[3]) / 2.0)
			mi.name = "B_%d" % int(props.get("id", 0))
			b_holder.add_child(mi)
			# NOTA: para extruir el polígono real (no su bbox), reemplazar
			# las 8 líneas anteriores por:
			#   var csg := CSGPolygon3D.new()
			#   csg.polygon = _ring_to_polygon2d(ring)
			#   csg.depth = height
			#   csg.rotation_degrees = Vector3(-90, 0, 0)
			#   csg.material = mat
			#   b_holder.add_child(csg)

	# 5) roads.geojson — Quads planos con ancho width_m, en y=0.05
	var r_holder := Node3D.new()
	r_holder.name = "Roads"
	root.add_child(r_holder)
	var r_data = _load_json(pack_dir + "roads.geojson")
	if r_data and r_data.has("features"):
		for f in r_data["features"]:
			var coords: Array = f["geometry"]["coordinates"]
			var width: float = float(f["properties"].get("width_m", 3.5))
			var rmesh := _make_road_strip(coords, width)
			if rmesh:
				var rmi := MeshInstance3D.new()
				rmi.mesh = rmesh
				rmi.material_override = mat_road
				rmi.position.y = 0.05
				rmi.name = "Road_%s" % str(f["properties"].get("osm_id", "x"))
				r_holder.add_child(rmi)

	# 6) parks.geojson — Polygons planos en y=0.04
	var p_holder := Node3D.new()
	p_holder.name = "Parks"
	root.add_child(p_holder)
	var p_data = _load_json(pack_dir + "parks.geojson")
	if p_data and p_data.has("features"):
		for f in p_data["features"]:
			var ring: Array = f["geometry"]["coordinates"][0]
			var pmesh := _make_flat_polygon(ring, 0.04)
			if pmesh:
				var pmi := MeshInstance3D.new()
				pmi.mesh = pmesh
				pmi.material_override = mat_park
				pmi.name = "Park_%s" % str(f["properties"].get("name", "x"))
				p_holder.add_child(pmi)

	# 7) water.geojson — Polygons planos en y=0.03
	var w_holder := Node3D.new()
	w_holder.name = "Water"
	root.add_child(w_holder)
	var w_data = _load_json(pack_dir + "water.geojson")
	if w_data and w_data.has("features"):
		for f in w_data["features"]:
			var ring: Array = f["geometry"]["coordinates"][0]
			var wmesh := _make_flat_polygon(ring, 0.03)
			if wmesh:
				var wmi := MeshInstance3D.new()
				wmi.mesh = wmesh
				wmi.material_override = mat_water
				w_holder.add_child(wmi)

	# 8) pois.geojson — Sprite3D pequeño plano en y=0.06 con color de cat
	var pois_holder := Node3D.new()
	pois_holder.name = "POIs"
	root.add_child(pois_holder)
	var pois = _load_json(pack_dir + "pois.geojson")
	if pois and pois.has("features"):
		for f in pois["features"]:
			var c: Array = f["geometry"]["coordinates"]
			var cat: String = str(f["properties"].get("category", "comercio"))
			var mat: StandardMaterial3D = materials.get(cat, mat_road)
			var qmesh := QuadMesh.new()
			qmesh.size = Vector2(2.5, 2.5)
			var qi := MeshInstance3D.new()
			qi.mesh = qmesh
			qi.material_override = mat
			qi.position = Vector3(float(c[0]), 0.06, float(c[1]))
			qi.rotation_degrees = Vector3(-90, 0, 0)
			pois_holder.add_child(qi)

	# 9) trees.geojson — extruidos como cilindros a height_m
	var t_holder := Node3D.new()
	t_holder.name = "Trees"
	root.add_child(t_holder)
	var t_data = _load_json(pack_dir + "trees.geojson")
	if t_data and t_data.has("features"):
		for f in t_data["features"]:
			var c: Array = f["geometry"]["coordinates"]
			var h: float = float(f["properties"].get("height_m", 6.0))
			var cyl := CylinderMesh.new()
			cyl.top_radius = 1.0
			cyl.bottom_radius = 1.4
			cyl.height = h
			var ti := MeshInstance3D.new()
			ti.mesh = cyl
			ti.material_override = materials["arbol"]
			ti.position = Vector3(float(c[0]), h / 2.0, float(c[1]))
			t_holder.add_child(ti)

	# 10) monuments.geojson — extruidos a height_m, color #7A3A1A
	var m_holder := Node3D.new()
	m_holder.name = "Monuments"
	root.add_child(m_holder)
	var m_data = _load_json(pack_dir + "monuments.geojson")
	if m_data and m_data.has("features"):
		for f in m_data["features"]:
			var props: Dictionary = f["properties"]
			var h: float = float(props.get("height_m", 6.0))
			var bm := BoxMesh.new()
			bm.size = Vector3(4, h, 4)
			var bi := MeshInstance3D.new()
			bi.mesh = bm
			bi.material_override = materials["monumento"]
			var c: Array = f["geometry"]["coordinates"]
			bi.position = Vector3(float(c[0]), h / 2.0, float(c[1]))
			bi.name = "Mon_%s" % str(props.get("name", "x"))
			m_holder.add_child(bi)

	return root

# // shared helper — bbox [minX, minZ, maxX, maxZ] de un ring [[x,z],..]
static func _ring_bbox(ring: Array) -> Array:
	var minx := INF; var minz := INF
	var maxx := -INF; var maxz := -INF
	for p in ring:
		var x: float = float(p[0]); var z: float = float(p[1])
		if x < minx: minx = x
		if z < minz: minz = z
		if x > maxx: maxx = x
		if z > maxz: maxz = z
	return [minx, minz, maxx, maxz]

# // shared helper — triangulación de un polígono plano (fan desde v0)
static func _make_flat_polygon(ring: Array, y: float) -> ArrayMesh:
	var n: int = ring.size()
	if n < 3:
		return null
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	var v0 := Vector3(float(ring[0][0]), y, float(ring[0][1]))
	for i in range(1, n - 1):
		var v1 := Vector3(float(ring[i][0]), y, float(ring[i][1]))
		var v2 := Vector3(float(ring[i + 1][0]), y, float(ring[i + 1][1]))
		st.set_uv(Vector2(0, 0)); st.add_vertex(v0)
		st.set_uv(Vector2(1, 0)); st.add_vertex(v1)
		st.set_uv(Vector2(1, 1)); st.add_vertex(v2)
	return st.commit()

# // shared helper — strip plano para LineString con ancho dado
static func _make_road_strip(coords: Array, width: float) -> ArrayMesh:
	var n: int = coords.size()
	if n < 2:
		return null
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	var half_w := width / 2.0
	for i in range(n - 1):
		var ax: float = float(coords[i][0])
		var az: float = float(coords[i][1])
		var bx: float = float(coords[i + 1][0])
		var bz: float = float(coords[i + 1][1])
		var dx := bx - ax
		var dz := bz - az
		var seg_len: float = sqrt(dx * dx + dz * dz)
		if seg_len < 0.001:
			continue
		var nx := -dz / seg_len * half_w
		var nz := dx / seg_len * half_w
		var p0 := Vector3(ax + nx, 0, az + nz)
		var p1 := Vector3(ax - nx, 0, az - nz)
		var p2 := Vector3(bx - nx, 0, bz - nz)
		var p3 := Vector3(bx + nx, 0, bz + nz)
		st.set_uv(Vector2(0, 0)); st.add_vertex(p0)
		st.set_uv(Vector2(1, 0)); st.add_vertex(p1)
		st.set_uv(Vector2(1, 1)); st.add_vertex(p2)
		st.set_uv(Vector2(0, 0)); st.add_vertex(p0)
		st.set_uv(Vector2(1, 1)); st.add_vertex(p2)
		st.set_uv(Vector2(0, 1)); st.add_vertex(p3)
	return st.commit()

# // shared helper — convierte ring [[x,z],..] a PackedVector2Array (para CSGPolygon3D)
static func _ring_to_polygon2d(ring: Array) -> PackedVector2Array:
	var arr := PackedVector2Array()
	for p in ring:
		arr.append(Vector2(float(p[0]), float(p[1])))
	return arr

# Ejemplo de uso:
#
#   var section = SectionLoader.load_section("3501602052", "res://sections_pack/")
#   add_child(section)
#
# Tras añadir el Node3D devuelto, la sección queda centrada en el origen
# de mundo Godot (X=east_m, Y=up=height_m, Z=south_m). Para mover varias
# secciones lado a lado, basta con setear section.position al offset
# entre centroides (en metros locales también).
