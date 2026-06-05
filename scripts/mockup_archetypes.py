"""Wrapper CLI · ver packages/mockups/archetypes_compare.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from packages.mockups.archetypes_compare import main
if __name__ == "__main__":
    main()
