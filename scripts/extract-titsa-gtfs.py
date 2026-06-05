#!/usr/bin/env python3
"""
extract-titsa-gtfs.py — Descarga el GTFS de Titsa (transporte público
interurbano de Tenerife) y produce un JSON ligero para el visor POLIS.

Fuente:
  https://www.titsa.com/Google_transit.zip   (estable, ~22 MB)
  Estructura GTFS estándar: stops.txt, routes.txt, trips.txt,
  stop_times.txt, calendar.txt.

Salida:
  public/data/titsa-stops.json

Estructura del JSON:
{
  "version": "titsa-gtfs-YYYY-MM-DD",
  "fuente": "...",
  "actualizado": ISO-8601,
  "n_stops": N,
  "n_routes": M,
  "stops": [
    { "id", "name", "lng", "lat",
      "routes_count": 8,             # nº de líneas distintas
      "routes": ["108", "014", ...], # top 5 más frecuentes
      "trips_per_day": 320           # nº de paradas-evento en día laborable
    }, ...
  ],
  "routes": [
    { "id", "short_name", "long_name", "type": "bus", "color": "#A37945" },
    ...
  ]
}

Notas:
- Usa zipfile + csv estándar (sin pandas) para evitar deps pesadas.
- Día tipo laborable = primer service_id que tiene monday=1..friday=1
  (puede haber varios; se acumulan si comparten ese patrón).
- Cachea el ZIP en scripts/_cache/titsa-gtfs-YYYY-MM-DD.zip.
"""

import csv
import io
import json
import os
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import datetime
from urllib.request import urlopen, Request

# Permite leer ficheros CSV con celdas grandes (stop_times suele ser grande).
csv.field_size_limit(sys.maxsize)

GTFS_URL = "https://www.titsa.com/Google_transit.zip"
ROOT = "/Users/panch/KOINOS-iso"
CACHE_DIR = f"{ROOT}/scripts/_cache"
OUT = f"{ROOT}/public/data/titsa-stops.json"

TODAY = datetime.utcnow().strftime("%Y-%m-%d")
CACHE_ZIP = f"{CACHE_DIR}/titsa-gtfs-{TODAY}.zip"

TOP_ROUTES_PER_STOP = 5


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def ensure_zip():
    """Descarga el ZIP si no existe el cache de hoy. Devuelve la ruta."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    if os.path.exists(CACHE_ZIP) and os.path.getsize(CACHE_ZIP) > 1_000_000:
        log(f"cache hit: {CACHE_ZIP} ({os.path.getsize(CACHE_ZIP):,} bytes)")
        return CACHE_ZIP

    log(f"descargando {GTFS_URL} → {CACHE_ZIP}")
    req = Request(GTFS_URL, headers={"User-Agent": "polis-titsa-extractor/1.0"})
    with urlopen(req, timeout=60) as r:
        data = r.read()
    if len(data) < 1_000_000:
        raise RuntimeError(f"descarga sospechosamente pequeña: {len(data)} bytes")
    with open(CACHE_ZIP, "wb") as f:
        f.write(data)
    log(f"descargado: {len(data):,} bytes")
    return CACHE_ZIP


def _read_csv(zf, name):
    """Devuelve un DictReader sobre el fichero `name` dentro del ZIP."""
    with zf.open(name) as raw:
        # GTFS suele ser UTF-8 con BOM ocasional.
        text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        for row in csv.DictReader(text):
            yield row


def parse_calendar(zf):
    """
    Devuelve un set de service_id activos para un día laborable tipo.

    Titsa publica un GTFS sin `calendar.txt`: solo `calendar_dates.txt`
    donde cada (service_id, fecha) define un viaje concreto. Para
    obtener un "laborable tipo" elegimos el PRIMER día laborable
    (lun-vie) que aparezca en el dataset y agregamos sus services.
    Así no contamos varias jornadas a la vez.
    """
    names = set(zf.namelist())
    weekday_services = set()

    if "calendar.txt" in names:
        weekday_keys = ("monday", "tuesday", "wednesday", "thursday", "friday")
        for row in _read_csv(zf, "calendar.txt"):
            if all(row.get(k) == "1" for k in weekday_keys):
                weekday_services.add(row["service_id"])
        if weekday_services:
            log(f"calendar.txt: {len(weekday_services)} services laborables")
            return weekday_services

    if "calendar_dates.txt" not in names:
        log("aviso: ni calendar.txt ni calendar_dates.txt; no filtramos")
        return weekday_services

    # Recolectar services por fecha y elegir el primer laborable.
    by_date = {}
    for row in _read_csv(zf, "calendar_dates.txt"):
        d = row.get("date")
        sid = row.get("service_id")
        if not (d and sid):
            continue
        # exception_type == "1" → service activo ese día; "2" → cancelado.
        if row.get("exception_type") != "1":
            continue
        by_date.setdefault(d, set()).add(sid)

    if not by_date:
        return weekday_services

    chosen = None
    for d in sorted(by_date.keys()):
        try:
            dt = datetime.strptime(d, "%Y%m%d")
        except ValueError:
            continue
        # weekday(): lun=0 ... dom=6 → laborable = 0..4
        if dt.weekday() < 5:
            chosen = d
            break

    if chosen is None:
        chosen = sorted(by_date.keys())[0]
        log(f"aviso: sin laborables en calendar_dates; uso {chosen}")
    else:
        dt = datetime.strptime(chosen, "%Y%m%d")
        log(f"calendar_dates: usando día tipo {chosen} ({dt.strftime('%A')})")

    return by_date[chosen]


def parse_routes(zf):
    """route_id → dict con id/short_name/long_name/type/color."""
    routes = {}
    for row in _read_csv(zf, "routes.txt"):
        rid = row.get("route_id")
        if not rid:
            continue
        color = (row.get("route_color") or "").strip()
        if color and not color.startswith("#"):
            color = "#" + color
        if not color:
            color = "#A37945"  # ocre fallback (paleta visor)
        routes[rid] = {
            "id": rid,
            "short_name": (row.get("route_short_name") or rid).strip(),
            "long_name": (row.get("route_long_name") or "").strip(),
            "type": "bus",
            "color": color,
        }
    return routes


def parse_stops(zf):
    """stop_id → dict con id/name/lng/lat."""
    stops = {}
    for row in _read_csv(zf, "stops.txt"):
        sid = row.get("stop_id")
        if not sid:
            continue
        try:
            lng = float(row["stop_lon"])
            lat = float(row["stop_lat"])
        except (KeyError, ValueError, TypeError):
            continue
        stops[sid] = {
            "id": sid,
            "name": (row.get("stop_name") or "").strip(),
            "lng": round(lng, 6),
            "lat": round(lat, 6),
        }
    return stops


def parse_trips(zf, weekday_services):
    """trip_id → route_id. Filtra por service activo en laborable si hay set."""
    trips = {}
    for row in _read_csv(zf, "trips.txt"):
        tid = row.get("trip_id")
        rid = row.get("route_id")
        svc = row.get("service_id")
        if not (tid and rid):
            continue
        if weekday_services and svc not in weekday_services:
            continue
        trips[tid] = rid
    return trips


def aggregate_stop_times(zf, trips):
    """
    Recorre stop_times.txt y agrega por parada:
      - trips_per_day: nº de eventos (trip × parada) en día laborable
      - routes_count: nº de route_id distintas que pasan
      - top routes: los TOP_ROUTES_PER_STOP route_id con más eventos
    Devuelve dict stop_id → {trips_per_day, route_counter}.
    """
    agg = defaultdict(lambda: {"trips": 0, "routes": Counter()})
    for row in _read_csv(zf, "stop_times.txt"):
        tid = row.get("trip_id")
        sid = row.get("stop_id")
        if not (tid and sid):
            continue
        rid = trips.get(tid)
        if not rid:
            continue
        a = agg[sid]
        a["trips"] += 1
        a["routes"][rid] += 1
    return agg


def main():
    path = ensure_zip()
    log(f"abriendo ZIP: {path}")
    with zipfile.ZipFile(path) as zf:
        names = set(zf.namelist())
        required = {"stops.txt", "routes.txt", "trips.txt", "stop_times.txt"}
        missing = required - names
        if missing:
            log(f"ERROR: faltan ficheros en GTFS: {missing}")
            sys.exit(1)

        weekday_services = parse_calendar(zf)
        log(f"servicios laborables: {len(weekday_services)}")

        routes = parse_routes(zf)
        log(f"rutas: {len(routes)}")

        stops = parse_stops(zf)
        log(f"paradas (raw): {len(stops)}")

        trips = parse_trips(zf, weekday_services)
        log(f"trips (laborable): {len(trips)}")

        log("agregando stop_times (puede tardar)...")
        agg = aggregate_stop_times(zf, trips)
        log(f"paradas con tráfico laborable: {len(agg)}")

    # Componer paradas enriquecidas. Solo conservamos las que tienen
    # al menos un trip laborable (las inactivas suelen ser ruido).
    stops_out = []
    for sid, st in stops.items():
        a = agg.get(sid)
        if not a or a["trips"] == 0:
            continue
        rc = a["routes"]
        top = [rid for rid, _ in rc.most_common(TOP_ROUTES_PER_STOP)]
        stops_out.append({
            "id": st["id"],
            "name": st["name"],
            "lng": st["lng"],
            "lat": st["lat"],
            "routes_count": len(rc),
            "routes": top,
            "trips_per_day": a["trips"],
        })
    stops_out.sort(key=lambda s: -s["routes_count"])

    # Conservar solo las rutas referenciadas por alguna parada.
    referenced = set()
    for s in stops_out:
        referenced.update(s["routes"])
    routes_out = [routes[rid] for rid in sorted(referenced) if rid in routes]

    out = {
        "version": f"titsa-gtfs-{TODAY}",
        "fuente": f"Titsa GTFS · {GTFS_URL}",
        "actualizado": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "n_stops": len(stops_out),
        "n_routes": len(routes_out),
        "stops": stops_out,
        "routes": routes_out,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(OUT) / 1024
    log(f"escrito {OUT} — {size_kb:.1f} KB")

    log("")
    log("=== RESUMEN ===")
    log(f"paradas escritas:  {len(stops_out):,}")
    log(f"rutas referencias: {len(routes_out):,}")
    log(f"peso JSON:         {size_kb:.1f} KB")
    log("")
    log("Top 5 paradas con más líneas:")
    for s in stops_out[:5]:
        log(f"  [{s['routes_count']:>3} líneas · {s['trips_per_day']:>4} trips/día]  "
            f"{s['name']}  ({s['id']})")


if __name__ == "__main__":
    main()
