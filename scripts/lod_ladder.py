"""Wrapper CLI · ver packages/mockups/lod_ladder.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from packages.mockups.lod_ladder import main
if __name__ == "__main__":
    main()
