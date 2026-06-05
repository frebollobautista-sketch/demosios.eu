"""Wrapper CLI · ver packages/mockups/filter.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from packages.mockups.filter import main
if __name__ == "__main__":
    main()
