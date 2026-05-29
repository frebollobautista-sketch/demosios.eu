## Paleta y perfiles de material generados desde KOINOS/estilos/materiales_base.json
## Este archivo debería regenerarse automáticamente cuando el calibrador exporte nuevos JSON.
##
## Uso típico:
##   var encalado = PixelArtStyles.get_material("encalado_blanco")
##   my_mesh.material_override.albedo_color = encalado.paleta[2]

class_name PixelArtStyles
extends Resource

## Perfiles de material canónicos para Las Palmas de GC.
static var materiales: Dictionary = {
	"piedra_volcanica_canaria": {
		"pixel_size": 9,
		"colores": 7,
		"contraste_pct": 140,
		"saturacion_pct": 50,
		"paleta": [
			Color("#1a1a1a"), Color("#2d2a28"), Color("#403c38"),
			Color("#5a5350"), Color("#6e6660"), Color("#847a72"), Color("#968b82")
		]
	},
	"madera_tea": {
		"pixel_size": 6,
		"colores": 12,
		"contraste_pct": 150,
		"saturacion_pct": 90,
		"paleta": [
			Color("#2e1a0a"), Color("#5a2f14"), Color("#7a4420"),
			Color("#8c5a2c"), Color("#a06f38"), Color("#b48446"),
			Color("#c69856"), Color("#d6ac68"), Color("#e0bc7a"),
			Color("#ebcc90"), Color("#f3dba6"), Color("#f9e6bc")
		]
	},
	"encalado_blanco": {
		"pixel_size": 7,
		"colores": 5,
		"contraste_pct": 90,
		"saturacion_pct": 30,
		"paleta": [
			Color("#e8e4db"), Color("#f0ece4"), Color("#f5f2eb"),
			Color("#fbf8f2"), Color("#ffffff")
		]
	},
	"azulejo_hidraulico": {
		"pixel_size": 3,
		"colores": 20,
		"contraste_pct": 120,
		"saturacion_pct": 140,
		"paleta": [
			Color("#1a3a5c"), Color("#2a5a8c"), Color("#4a8cbc"),
			Color("#7cbcdc"), Color("#f0e8c4"), Color("#e0b060"),
			Color("#c08040"), Color("#a04030"), Color("#702020"),
			Color("#e8d4a0")
		]
	},
	"tejado_teja_arabe": {
		"pixel_size": 5,
		"colores": 10,
		"contraste_pct": 130,
		"saturacion_pct": 80,
		"paleta": [
			Color("#3a1a0a"), Color("#5a2810"), Color("#7a3818"),
			Color("#944a20"), Color("#a85e2c"), Color("#b8703a"),
			Color("#c48448"), Color("#d09658"), Color("#dba868"),
			Color("#e5ba7a")
		]
	}
}

## Devuelve el perfil completo de un material por id.
static func get_material(id: String) -> Dictionary:
	return materiales.get(id, {})

## Devuelve el color medio de la paleta de un material.
## Útil como albedo de referencia en Mesh materials sin textura.
static func get_color_medio(id: String) -> Color:
	var mat: Dictionary = materiales.get(id, {})
	if mat.is_empty():
		return Color.MAGENTA
	var paleta: Array = mat["paleta"]
	return paleta[paleta.size() / 2]

## Crea un StandardMaterial3D configurado para renderizado pixel art
## (filtro nearest, sombras afiladas, sin reflejos).
static func make_material_3d(id: String) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = get_color_medio(id)
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mat.metallic = 0.0
	mat.roughness = 0.9
	return mat
