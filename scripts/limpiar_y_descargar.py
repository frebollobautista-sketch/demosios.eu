#!/usr/bin/env python3
"""
Limpia ZIPs inválidos y reintenta la descarga del Catastro.
Ejecutar: python3 scripts/limpiar_y_descargar.py
"""
import json
import os
from pathlib import Path

import requests

KOINOS_DIR = Path(__file__).parent.parent
DATA_DIR = KOINOS_DIR / "catastro_data"

with open(KOINOS_DIR / "catastro_download_links.json") as f:
    MUNICIPIOS = json.load(f)

# También comprobar el ZIP que ya teníamos en la raíz (35017)
EXISTING_35017 = KOINOS_DIR / "A.ES.SDGC.BU.35017.zip"

print("=== LIMPIEZA: eliminando ZIPs inválidos ===\n")
for fname in sorted(DATA_DIR.glob("*.zip")):
    size = fname.stat().st_size
    # Check magic bytes
    with open(fname, "rb") as f:
        magic = f.read(4)
    if magic[:2] != b"PK":
        print(f"  ✗ {fname.name} — {size} bytes, NO es ZIP. Eliminando.")
        fname.unlink()
    elif size < 10000:  # Less than 10KB is suspicious
        print(f"  ? {fname.name} — {size} bytes (muy pequeño, verificar)")
    else:
        print(f"  ✓ {fname.name} — {size / 1024 / 1024:.1f} MB")

# Si ya existe 35017 en la raíz, copiarlo/linkearlo
dest_35017 = DATA_DIR / "A.ES.SDGC.BU.35017.zip"
if EXISTING_35017.exists() and not dest_35017.exists():
    import shutil
    shutil.copy2(EXISTING_35017, dest_35017)
    print(f"\n  → Copiado 35017 desde raíz ({dest_35017.stat().st_size / 1024 / 1024:.1f} MB)")

print("\n=== DESCARGA: municipios pendientes ===\n")

# The Catastro INSPIRE ATOM feed lists actual download URLs
# Let's try the ATOM feed first to get correct URLs
ATOM_URL = "https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/35/ES.SDGC.bu.atom.xml"
print("Consultando ATOM feed del Catastro...")

try:
    r = requests.get(ATOM_URL, timeout=30)
    r.raise_for_status()
    atom_xml = r.text

    # Parse actual download URLs from ATOM feed
    import re
    # Pattern: <link href="..." type="application/zip" .../>
    # or <link rel="alternate" href="https://...zip" .../>
    zip_links = re.findall(r'href="([^"]*\.zip)"', atom_xml)

    print(f"  Encontrados {len(zip_links)} links en el ATOM feed")

    # Map code → actual URL
    code_to_url = {}
    for link in zip_links:
        # Extract code from URL (e.g., A.ES.SDGC.BU.35001.zip → 35001)
        m = re.search(r'BU\.(\d{5})\.zip', link)
        if m:
            code_to_url[m.group(1)] = link

    print(f"  Mapeados {len(code_to_url)} municipios\n")

except Exception as e:
    print(f"  ATOM feed falló: {e}")
    print("  Usando URLs del JSON local\n")
    code_to_url = {}

downloaded = 0
skipped = 0
failed = 0

for cod, info in sorted(MUNICIPIOS.items()):
    zip_path = DATA_DIR / f"A.ES.SDGC.BU.{cod}.zip"

    if zip_path.exists():
        # Verify existing
        with open(zip_path, "rb") as f:
            magic = f.read(2)
        if magic == b"PK" and zip_path.stat().st_size > 10000:
            print(f"  ✓ {cod} {info['nombre']} — ya descargado ({zip_path.stat().st_size / 1024 / 1024:.1f} MB)")
            skipped += 1
            continue
        else:
            zip_path.unlink()

    # Try ATOM URL first, then JSON URL
    urls_to_try = []
    if cod in code_to_url:
        urls_to_try.append(("ATOM", code_to_url[cod]))
    urls_to_try.append(("JSON", info["url"].replace(" ", "%20")))

    success = False
    for source, url in urls_to_try:
        print(f"  ↓ {cod} {info['nombre']} ({source})...", end=" ", flush=True)
        try:
            r = requests.get(url, timeout=300, stream=True, allow_redirects=True)
            r.raise_for_status()

            with open(zip_path, "wb") as f:
                total = 0
                for chunk in r.iter_content(8192):
                    f.write(chunk)
                    total += len(chunk)

            # Verify ZIP
            with open(zip_path, "rb") as f:
                magic = f.read(2)

            if magic == b"PK" and total > 10000:
                print(f"{total / 1024 / 1024:.1f} MB ✓")
                downloaded += 1
                success = True
                break
            else:
                print(f"inválido ({total} bytes)")
                zip_path.unlink()
        except Exception as e:
            print(f"error: {e}")
            if zip_path.exists():
                zip_path.unlink()

    if not success:
        print(f"  ✗ {cod} {info['nombre']} — FALLÓ todas las URLs")
        failed += 1

print(f"\n=== Resultado: {downloaded} descargados, {skipped} existentes, {failed} fallidos ===")
print(f"=== ZIPs válidos en {DATA_DIR}: {len(list(DATA_DIR.glob('*.zip')))} ===")
