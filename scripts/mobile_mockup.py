"""Wrapper CLI · ver packages/mockups/mobile.py"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from packages.mockups.mobile import main
if __name__ == "__main__":
    main()
