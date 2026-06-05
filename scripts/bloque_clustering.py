"""Wrapper de compatibilidad · ver packages/iso/bloque_clustering.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from packages.iso.bloque_clustering import *  # noqa: F401,F403
from packages.iso.bloque_clustering import (  # noqa: F401
    compute_bloques, simplify_manzana, unify_manzana, count_vertices,
)
