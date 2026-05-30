## Constructor procedimental del Mercado de Vegueta a partir de su ficha en
## KOINOS/estilos/mercado_vegueta.json. Este script levanta la geometría base
## (4 lienzos, patio, cubierta y pórtico) usando las dimensiones estimadas.
##
## Todo es BoxMesh puro — placeholder pixel-art-compatible. Se sustituirá por
## tiles/sprites calibrados cuando existan.

extends Node3D

const PIX := preload("res://scripts/pixel_art_styles.gd")

# Dimensiones estimadas (en metros) — espejo 1:1 de
# KOINOS/estilos/mercado_vegueta.json § dimensiones_estimadas.
const ANCHO := 30.0
const PROFUNDIDAD := 45.0
const ALTURA_MUROS := 7.0
const ALTURA_TOTAL := 10.0
const PATIO_ANCHO := 12.0
const PATIO_PROFUNDIDAD := 22.0
const GROSOR_MURO := 0.8

func _ready() -> void:
	_levantar_zocalo()
	_levantar_lienzos_exteriores()
	_levantar_cubierta()
	_levantar_portico_principal()
	_marcar_patio_central()

func _levantar_zocalo() -> void:
	# Un zócalo de piedra de 30cm de altura que enlaza todo el edificio.
	var zocalo := MeshInstance3D.new()
	zocalo.name = "Zocalo_Piedra"
	var box := BoxMesh.new()
	box.size = Vector3(ANCHO, 0.3, PROFUNDIDAD)
	zocalo.mesh = box
	zocalo.position = Vector3(0, 0.15, 0)
	zocalo.material_override = PIX.make_material_3d("piedra_volcanica_canaria")
	add_child(zocalo)

func _levantar_lienzos_exteriores() -> void:
	# 4 paños de fachada-pantalla en encalado, separados del patio por grosor
	# constante. No se sustrae el patio — se implementará con 4 muros.
	var mat := PIX.make_material_3d("encalado_blanco")

	var norte := _crear_muro(Vector3(ANCHO, ALTURA_MUROS, GROSOR_MURO),
		Vector3(0, 0.3 + ALTURA_MUROS / 2, -PROFUNDIDAD / 2))
	norte.name = "Muro_Norte_Encalado"
	norte.material_override = mat
	add_child(norte)

	var sur := _crear_muro(Vector3(ANCHO, ALTURA_MUROS, GROSOR_MURO),
		Vector3(0, 0.3 + ALTURA_MUROS / 2, PROFUNDIDAD / 2))
	sur.name = "Muro_Sur_Encalado_Fachada_Principal"
	sur.material_override = mat
	add_child(sur)

	var este := _crear_muro(Vector3(GROSOR_MURO, ALTURA_MUROS, PROFUNDIDAD),
		Vector3(ANCHO / 2, 0.3 + ALTURA_MUROS / 2, 0))
	este.name = "Muro_Este_Encalado"
	este.material_override = mat
	add_child(este)

	var oeste := _crear_muro(Vector3(GROSOR_MURO, ALTURA_MUROS, PROFUNDIDAD),
		Vector3(-ANCHO / 2, 0.3 + ALTURA_MUROS / 2, 0))
	oeste.name = "Muro_Oeste_Encalado"
	oeste.material_override = mat
	add_child(oeste)

func _crear_muro(tamano: Vector3, pos: Vector3) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = tamano
	m.mesh = box
	m.position = pos
	return m

func _levantar_cubierta() -> void:
	# Placeholder plano. La teja árabe a dos aguas sobre el perímetro
	# del claustro queda pendiente de modelar con prisma trapezoidal.
	var mat := PIX.make_material_3d("tejado_teja_arabe")

	# Cuatro franjas perimetrales que cubren solo los corredores,
	# dejando el patio central descubierto.
	var borde_long := (PROFUNDIDAD - PATIO_PROFUNDIDAD) / 2
	var borde_corto := (ANCHO - PATIO_ANCHO) / 2

	var norte := _crear_muro(Vector3(ANCHO, 0.4, borde_long),
		Vector3(0, ALTURA_TOTAL, -PROFUNDIDAD / 2 + borde_long / 2))
	norte.name = "Cubierta_Norte_Teja"
	norte.material_override = mat
	add_child(norte)

	var sur := _crear_muro(Vector3(ANCHO, 0.4, borde_long),
		Vector3(0, ALTURA_TOTAL, PROFUNDIDAD / 2 - borde_long / 2))
	sur.name = "Cubierta_Sur_Teja"
	sur.material_override = mat
	add_child(sur)

	var este := _crear_muro(Vector3(borde_corto, 0.4, PATIO_PROFUNDIDAD),
		Vector3(ANCHO / 2 - borde_corto / 2, ALTURA_TOTAL, 0))
	este.name = "Cubierta_Este_Teja"
	este.material_override = mat
	add_child(este)

	var oeste := _crear_muro(Vector3(borde_corto, 0.4, PATIO_PROFUNDIDAD),
		Vector3(-ANCHO / 2 + borde_corto / 2, ALTURA_TOTAL, 0))
	oeste.name = "Cubierta_Oeste_Teja"
	oeste.material_override = mat
	add_child(oeste)

func _levantar_portico_principal() -> void:
	# Pórtico en cantería, centrado en la fachada sur (la que mira al
	# Guiniguada). Un volumen más pesado, con una puerta de madera
	# simbólica al frente.
	var piedra := PIX.make_material_3d("piedra_volcanica_canaria")
	var madera := PIX.make_material_3d("madera_tea")

	var portico := _crear_muro(Vector3(6.0, ALTURA_MUROS + 1.5, 2.0),
		Vector3(0, 0.3 + (ALTURA_MUROS + 1.5) / 2, PROFUNDIDAD / 2 + 1.0))
	portico.name = "Portico_Cantera"
	portico.material_override = piedra
	add_child(portico)

	var puerta := _crear_muro(Vector3(2.2, 3.5, 0.3),
		Vector3(0, 0.3 + 1.75, PROFUNDIDAD / 2 + 2.05))
	puerta.name = "Puerta_Madera_Tea"
	puerta.material_override = madera
	add_child(puerta)

	# Segunda puerta: el Mercado de Vegueta tiene dos accesos en la fachada
	# principal, rasgo regionalmente único según las fuentes.
	var portico2 := _crear_muro(Vector3(6.0, ALTURA_MUROS + 1.5, 2.0),
		Vector3(-8.0, 0.3 + (ALTURA_MUROS + 1.5) / 2, PROFUNDIDAD / 2 + 1.0))
	portico2.name = "Portico_Secundario_Cantera"
	portico2.material_override = piedra
	add_child(portico2)

	var puerta2 := _crear_muro(Vector3(2.2, 3.5, 0.3),
		Vector3(-8.0, 0.3 + 1.75, PROFUNDIDAD / 2 + 2.05))
	puerta2.name = "Puerta_Secundaria_Madera_Tea"
	puerta2.material_override = madera
	add_child(puerta2)

func _marcar_patio_central() -> void:
	# Marca visual del patio claustral con un suelo de azulejo hidráulico.
	var mat := PIX.make_material_3d("azulejo_hidraulico")
	var suelo := MeshInstance3D.new()
	suelo.name = "Patio_Azulejo_Hidraulico"
	var box := BoxMesh.new()
	box.size = Vector3(PATIO_ANCHO, 0.1, PATIO_PROFUNDIDAD)
	suelo.mesh = box
	suelo.position = Vector3(0, 0.35, 0)
	suelo.material_override = mat
	add_child(suelo)
