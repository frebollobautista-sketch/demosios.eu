"""Wrapper de compatibilidad · ver packages/iso/archetypes.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from packages.iso.archetypes import *  # noqa: F401,F403
from packages.iso.archetypes import (  # noqa: F401
    INK, COLORS, ARCHETYPES, ARCHETYPE_DIMS,
    classify_building, axis_angle_from_ring, axis_angle_and_dims,
    draw_residencial_3p, draw_residencial_6p, draw_bloque_grande,
    draw_unifamiliar, draw_comercial, draw_publico, draw_monumento,
    draw_arbol_grande, draw_plaza_pavimento,
)
