"""Wrapper CLI · ver packages/pack/pack_section.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from packages.pack.pack_section import main
if __name__ == "__main__":
    main()
