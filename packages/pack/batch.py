"""KOINOS · POLIS — Batch generator de data packs por sección censal.

Wrapper sobre ``packages.pack.pack_section.build_pack`` que evita releer
los datasets grandes (roads.json ~38 MB, pois/parks/water y
canteras_data.json) en cada llamada. Construye índices STRtree de shapely
sobre los datasets de líneas/polígonos para acelerar el bbox-clip de
cada sección.

Uso típico:
    python3 -m packages.pack.batch
    python3 -m packages.pack.batch --limit 5
    python3 -m packages.pack.batch --cusecs 3501602052 3501602053
    python3 -m packages.pack.batch --skip-existing
    python3 -m packages.pack.batch --zone canteras
    python3 -m packages.pack.batch --zone province

Salidas:
    public/sections_pack/<cusec>/...    (uno por sección)
    public/sections_pack/manifest.json  (resumen global de la corrida)
    public/sections_pack/contact_sheet.png  (grilla 8×10 de previews)
"""
from __future__ import annotations
import argparse
import json
import math
import pathlib
import statistics
import sys
import time
import traceback
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import shape, box
from shapely.strtree import STRtree

# Importa la lógica refactorizada del pack
from packages.pack import pack_section as iso_pack  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
DEFAULT_OUT = PUBLIC / "sections_pack"
CANTERAS_SECTIONS = ROOT / "godot" / "polis_walk" / "canteras_sections.json"

# Mapeos de islas a códigos de municipio (3 dígitos, sin el prefijo 35).
ISLA_MUNS = {
    "gc": {"001", "002", "005", "006", "008", "009", "011", "012", "013",
           "016", "019", "020", "021", "022", "023", "025", "026", "027",
           "031", "032", "033"},
    "fv": {"003", "007", "014", "015", "017", "030"},
    "lz": {"004", "010", "018", "024", "028", "029", "034"},
}


# --------------------------------------------------------------- carga única

def load_dataset(path: pathlib.Path, label: str) -> dict:
    t0 = time.time()
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    n = len(data.get("features", [])) if "features" in data else 0
    print(f"  · {label:14s} {n:>7,d} features  ({path.stat().st_size/1024/1024:5.1f} MB, {time.time()-t0:4.1f}s)")
    return data


def build_strtree(features: List[dict], label: str) -> Tuple[STRtree, List[dict]]:
    t0 = time.time()
    geoms = []
    keep = []
    for f in features:
        try:
            g = shape(f["geometry"])
            if g.is_empty:
                continue
            geoms.append(box(*g.bounds))
            keep.append(f)
        except Exception:
            continue
    tree = STRtree(geoms)
    print(f"  · STRtree {label:10s} {len(keep):>7,d} bboxes  ({time.time()-t0:4.1f}s)")
    return tree, keep


# --------------------------------------------------------------- contact sheet

def fonts_for_sheet():
    cb = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
    ]
    cr = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    def _try(cands, size):
        for c in cands:
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
        return ImageFont.load_default()
    return (_try(cb, 32), _try(cr, 16), _try(cr, 11), _try(cb, 18))


def build_contact_sheet(out_path: pathlib.Path, sections_meta: List[dict],
                        totals: dict, title: str = None,
                        cols: int = 8, rows: int = 10,
                        cell_w: int = 220, cell_h: int = 220):
    P = iso_pack.KOINOS_PALETTE
    label_h = 22
    banner_h = 110
    margin = 20
    total_w = margin*2 + cols * cell_w + (cols - 1) * 6
    total_h = banner_h + margin + rows * (cell_h + label_h) + (rows - 1) * 6 + margin
    img = Image.new("RGB", (total_w, total_h), P["paper"])
    d = ImageDraw.Draw(img)

    f_title, f_sub, f_lbl, f_lbl_bold = fonts_for_sheet()

    d.rectangle((0, 0, total_w, banner_h), fill=P["ink"])
    if title is None:
        title = f"KOINOS · POLIS — pack v1 · {len(sections_meta)} secciones"
    d.text((margin, 22), title, fill=P["paper"], font=f_title)
    sub = (f"{totals['successful']}/{len(sections_meta)} paquetes · "
           f"{totals['buildings']:,} edificios · "
           f"{totals['manzanas']:,} manzanas · "
           f"{totals['pois']:,} POIs · "
           f"{totals['trees']:,} árboles · "
           f"{totals['monuments']:,} monumentos · "
           f"{totals['area_ha']:.1f} ha")
    d.text((margin, 66), sub, fill=P["sand_lt"], font=f_sub)

    items = sorted(sections_meta, key=lambda s: s["cusec"])
    y = banner_h + margin
    for r in range(rows):
        x = margin
        for c in range(cols):
            idx = r * cols + c
            if idx >= len(items):
                break
            it = items[idx]
            preview_path = PUBLIC / it["preview"]
            cell_box = (x, y, x + cell_w, y + cell_h)
            d.rectangle(cell_box, fill=P["cream"], outline=P["ocre_dk"], width=1)
            if preview_path.exists():
                try:
                    thumb = Image.open(preview_path).convert("RGB")
                    thumb = thumb.crop((0, 0, 1024, 1024))
                    thumb = thumb.resize((cell_w, cell_h), Image.LANCZOS)
                    img.paste(thumb, (x, y))
                except Exception as e:
                    d.text((x+8, y+8), f"err: {e}", fill=P["ink"], font=f_lbl)
            lab_y = y + cell_h
            d.rectangle((x, lab_y, x + cell_w, lab_y + label_h),
                        fill=P["ink"])
            d.text((x + 6, lab_y + 4),
                   f"{it['cusec']}  ·  {it['buildings']} edif  ·  "
                   f"{it['area_ha']:.2f} ha",
                   fill=P["sand_lt"], font=f_lbl)
            x += cell_w + 6
        y += cell_h + label_h + 6

    img.save(out_path, "PNG", optimize=True)
    print(f"  · contact_sheet → {out_path}  ({total_w}×{total_h})")


# --------------------------------------------------------------- main

def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=str(DEFAULT_OUT))
    ap.add_argument("--limit", type=int, default=None,
                    help="Procesar solo las primeras N secciones (debug)")
    ap.add_argument("--cusecs", nargs="+", default=None,
                    help="Lista explícita de cusecs (sobrescribe --zone)")
    ap.add_argument("--zone", choices=["canteras", "province", "lpgc"],
                    default="canteras",
                    help="Lista de cusecs por defecto (canteras: 76 secciones; "
                         "lpgc: 274 secciones del municipio 016; "
                         "province: todas las 709 cusecs de la provincia 35)")
    ap.add_argument("--mun", default=None,
                    help="Filtrar por código de municipio (3 dígitos, "
                         "p.ej. '016' para LPGC). Sobrescribe --zone.")
    ap.add_argument("--isla", choices=sorted(ISLA_MUNS.keys()), default=None,
                    help="Filtrar por isla (gc=Gran Canaria, fv=Fuerteventura, "
                         "lz=Lanzarote). Sobrescribe --zone.")
    ap.add_argument("--exclude-mun", nargs="+", default=None,
                    help="Excluir muns concretos (3 dígitos). Útil con --isla "
                         "para procesar solo el resto.")
    ap.add_argument("--skip-existing", action="store_true",
                    help="Saltar secciones cuyo preview.png ya existe")
    ap.add_argument("--no-contact-sheet", action="store_true",
                    help="No regenerar contact_sheet.png")
    ap.add_argument("--no-manifest", action="store_true",
                    help="No regenerar manifest.json (útil en chunks)")
    return ap.parse_args()


def collect_cusecs(args) -> List[str]:
    if args.cusecs:
        return list(args.cusecs)
    if args.isla:
        muns = set(ISLA_MUNS[args.isla])
        if args.exclude_mun:
            muns -= set(args.exclude_mun)
        sections = json.load(open(iso_pack.SECCIONES_FILE, encoding="utf-8"))
        out = sorted({f["properties"]["cusec"]
                      for f in sections["features"]
                      if f["properties"].get("mun") in muns})
        return out
    if args.mun:
        sections = json.load(open(iso_pack.SECCIONES_FILE, encoding="utf-8"))
        out = sorted({f["properties"]["cusec"]
                      for f in sections["features"]
                      if f["properties"].get("mun") == args.mun})
        return out
    if args.zone == "lpgc":
        sections = json.load(open(iso_pack.SECCIONES_FILE, encoding="utf-8"))
        out = sorted({f["properties"]["cusec"]
                      for f in sections["features"]
                      if f["properties"].get("mun") == "016"})
        return out
    if args.zone == "province":
        sections = json.load(open(iso_pack.SECCIONES_FILE, encoding="utf-8"))
        out = sorted({f["properties"]["cusec"]
                      for f in sections["features"]})
        return out
    raw = json.load(open(CANTERAS_SECTIONS, encoding="utf-8"))
    seen, out = set(), []
    for r in raw:
        c = r.get("id") or r.get("cusec")
        if c and c not in seen:
            seen.add(c); out.append(c)
    out.sort()
    return out


def main():
    args = parse_args()
    out_dir = pathlib.Path(args.out_dir)
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    cusecs = collect_cusecs(args)
    if args.limit:
        cusecs = cusecs[:args.limit]

    have, missing = [], []
    for c in cusecs:
        if (PUBLIC / "buildings" / f"{c}.json").exists():
            have.append(c)
        else:
            missing.append(c)
    print(f"Cusecs solicitados: {len(cusecs)}  ·  con edificios: {len(have)}  ·  faltantes: {len(missing)}")
    if missing:
        print(f"  faltan: {missing[:10]}{' …' if len(missing)>10 else ''}")

    print("\nCargando datasets en memoria…")
    t_load = time.time()
    sections = load_dataset(iso_pack.SECCIONES_FILE, "sections")
    roads = load_dataset(iso_pack.ROADS_FILE, "roads")
    pois = load_dataset(iso_pack.POIS_FILE, "pois")
    parks = load_dataset(iso_pack.PARKS_FILE, "parks")
    water = load_dataset(iso_pack.WATER_FILE, "water")
    canteras = None
    if iso_pack.CANTERAS_DATA.exists():
        with open(iso_pack.CANTERAS_DATA, encoding="utf-8") as f:
            canteras = json.load(f)
        print(f"  · canteras_data árboles={len(canteras.get('trees', []))}")

    print("\nConstruyendo índices STRtree…")
    roads_idx = build_strtree(roads["features"], "roads")
    pois_idx = build_strtree(pois["features"], "pois")
    parks_idx = build_strtree(parks["features"], "parks")
    water_idx = build_strtree(water["features"], "water")
    print(f"Datasets + índices listos en {time.time()-t_load:.1f}s")

    cache = {
        "sections": sections,
        "roads": roads,
        "pois": pois,
        "parks": parks,
        "water": water,
        "canteras": canteras,
        "roads_idx": roads_idx,
        "pois_idx": pois_idx,
        "parks_idx": parks_idx,
        "water_idx": water_idx,
    }

    print(f"\nProcesando {len(have)} secciones…")
    times = []
    sections_meta = []
    failures = []
    totals = dict(buildings=0, manzanas=0, trees=0, monuments=0,
                  pois=0, area_ha=0.0)
    t_batch = time.time()

    for i, cusec in enumerate(have, 1):
        pack_dir = out_dir / cusec
        if args.skip_existing and (pack_dir / "preview.png").exists():
            try:
                meta = json.load(open(pack_dir / "meta.json", encoding="utf-8"))
                # manzana_count no siempre está en meta antiguos; lo leemos
                # del propio manzanas.geojson como fallback.
                n_mz = meta.get("manzana_count")
                if n_mz is None:
                    mz_path = pack_dir / "manzanas.geojson"
                    if mz_path.exists():
                        try:
                            n_mz = len(json.load(open(mz_path, encoding="utf-8"))
                                        .get("features", []))
                        except Exception:
                            n_mz = 0
                    else:
                        n_mz = 0
                sections_meta.append({
                    "cusec": cusec,
                    "area_ha": meta["area_ha"],
                    "buildings": meta["building_count"],
                    "manzanas": n_mz,
                    "pois": meta["poi_count"],
                    "trees": meta["tree_count"],
                    "monuments": meta["monument_count"],
                    "centroid_lnglat": meta["centroid_lnglat"],
                    "preview": f"sections_pack/{cusec}/preview.png",
                })
                totals["buildings"] += meta["building_count"]
                totals["pois"] += meta["poi_count"]
                totals["trees"] += meta["tree_count"]
                totals["monuments"] += meta["monument_count"]
                totals["area_ha"] += meta["area_ha"]
                totals["manzanas"] += n_mz
            except Exception:
                pass
            continue

        t0 = time.time()
        try:
            pack_dir2, elapsed, stats, n_mz, n_rd, n_pk, n_wa = \
                iso_pack.build_pack(cusec, out_dir, cache=cache, verbose=False)
            times.append(elapsed)
            sections_meta.append({
                "cusec": cusec,
                "area_ha": round(stats["area_ha"], 4),
                "buildings": stats["n_edif"],
                "manzanas": n_mz,
                "pois": stats["n_pois"],
                "trees": stats["n_arboles"],
                "monuments": stats["n_monumentos"],
                "centroid_lnglat": json.load(
                    open(pack_dir2 / "meta.json", encoding="utf-8")
                )["centroid_lnglat"],
                "preview": f"sections_pack/{cusec}/preview.png",
            })
            totals["buildings"] += stats["n_edif"]
            totals["manzanas"] += n_mz
            totals["pois"] += stats["n_pois"]
            totals["trees"] += stats["n_arboles"]
            totals["monuments"] += stats["n_monumentos"]
            totals["area_ha"] += stats["area_ha"]
        except Exception as e:
            tb = traceback.format_exc(limit=2)
            failures.append({"cusec": cusec, "error": f"{type(e).__name__}: {e}",
                             "traceback": tb})
            print(f"  ! [{cusec}] FAIL: {type(e).__name__}: {e}")
            continue

        if i % 10 == 0 or i == len(have):
            avg = sum(times) / len(times) if times else 0
            eta = avg * (len(have) - i)
            print(f"  · [{i:>2d}/{len(have)}] {cusec}  "
                  f"({time.time()-t0:4.1f}s, total {time.time()-t_batch:5.1f}s, "
                  f"avg {avg:4.1f}s, ETA {eta:5.0f}s)")

    total_elapsed = time.time() - t_batch
    n_ok = len([s for s in sections_meta if s["cusec"] not in {f["cusec"] for f in failures}])
    n_fail = len(failures)

    median_t = statistics.median(times) if times else 0
    p95_t = (statistics.quantiles(times, n=20)[18] if len(times) >= 20 else
             max(times) if times else 0)

    print("\n" + "="*60)
    print(f"BATCH FINAL  ·  {n_ok} OK  ·  {n_fail} fallos")
    print(f"tiempo total:    {total_elapsed:.1f}s")
    print(f"mediana/sec:     {median_t:.2f}s")
    print(f"p95/sec:         {p95_t:.2f}s")
    print(f"totales: edif={totals['buildings']}  mz={totals['manzanas']}  "
          f"pois={totals['pois']}  trees={totals['trees']}  "
          f"mon={totals['monuments']}  area={totals['area_ha']:.1f}ha")
    print("="*60)

    manifest = {
        "version": "1.0",
        "produced_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "zone": ("isla:" + args.isla) if args.isla else (
                ("mun:" + args.mun) if args.mun else (
                args.zone if not args.cusecs else "custom")),
        "total_sections": len(have),
        "successful": n_ok,
        "failed": n_fail,
        "totals": {
            "buildings": totals["buildings"],
            "manzanas": totals["manzanas"],
            "trees": totals["trees"],
            "monuments": totals["monuments"],
            "pois": totals["pois"],
            "area_ha": round(totals["area_ha"], 3),
        },
        "timing": {
            "total_s": round(total_elapsed, 2),
            "median_s": round(median_t, 3),
            "p95_s": round(p95_t, 3),
            "avg_s": round(sum(times)/len(times), 3) if times else 0,
        },
        "sections": sorted(sections_meta, key=lambda s: s["cusec"]),
        "failures": failures,
    }
    if not args.no_manifest:
        manifest_path = out_dir / "manifest.json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        print(f"manifest → {manifest_path}")

    if not args.no_contact_sheet and sections_meta:
        sheet_path = out_dir / "contact_sheet.png"
        build_contact_sheet(sheet_path, sections_meta, manifest["totals"] | {
            "successful": n_ok})

    return manifest


if __name__ == "__main__":
    main()
