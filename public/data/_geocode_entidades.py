#!/usr/bin/env python3
"""
Etapa 2: geocode entidades de provincia 35 (GC + LZ + FV) y split por isla.

Idempotente. Cache persistente en geocode-cache.json. Si se interrumpe,
relanzar el script reanuda donde quedó.

Output a /Users/panch/KOINOS-iso/public/data/entidades/:
  gc.json, lz.json, fv.json, tf.json, lp.json, lg.json, eh.json, manifest.json
"""
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict

ROOT = "/Users/panch/KOINOS-iso/public/data"
RAW = f"{ROOT}/entidades-canarias-raw.json"
OUT_DIR = f"{ROOT}/entidades"
CACHE = f"{OUT_DIR}/geocode-cache.json"
PROGRESS_LOG = f"{OUT_DIR}/_progress.log"

USER_AGENT = "KOINOS-POLIS/0.1 (entidades-canarias seeder)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
RATE_LIMIT_S = 1.1

ISLA_VIEWBOX = {
    "gran canaria": "-15.85,28.20,-15.30,27.70",
    "lanzarote":    "-13.95,29.30,-13.40,28.83",
    "fuerteventura":"-14.55,28.78,-13.78,28.00",
}

ISLA_KEY = {
    "gran canaria":  "gc",
    "lanzarote":     "lz",
    "fuerteventura": "fv",
    "tenerife":      "tf",
    "la palma":      "lp",
    "la gomera":     "lg",
    "el hierro":     "eh",
}

GEOCODE_TARGETS = {"gc", "lz", "fv"}  # B2 scope

def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(PROGRESS_LOG, "a") as f:
        f.write(line + "\n")

def isla_norm(s):
    if not s:
        return ""
    return s.strip().lower()

def isla_to_key(isla):
    return ISLA_KEY.get(isla_norm(isla), "?")

def slug(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s

def load_cache():
    if os.path.exists(CACHE):
        try:
            with open(CACHE) as f:
                return json.load(f)
        except Exception:
            log(f"cache corrupto, arrancando vacío")
    return {}

def save_cache(cache):
    tmp = CACHE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(cache, f, ensure_ascii=False)
    os.replace(tmp, CACHE)

def build_query(direccion_via, municipio, isla, fallback_to_mun=False):
    parts = []
    if direccion_via and direccion_via.strip() and direccion_via.strip() != "_U" and not fallback_to_mun:
        parts.append(direccion_via.strip())
    if municipio:
        parts.append(municipio.strip())
    if isla:
        parts.append(isla.strip())
    parts.append("Canarias, Spain")
    return ", ".join(parts)

def nominatim_get(query, viewbox):
    params = {
        "q": query,
        "format": "json",
        "limit": "1",
        "viewbox": viewbox,
        "bounded": "1",
        "countrycodes": "es",
    }
    url = f"{NOMINATIM}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())

def geocode(query, viewbox, cache, backoffs=(2, 8, 30)):
    if query in cache:
        return cache[query]
    last_err = None
    for delay in (0,) + backoffs:
        if delay:
            log(f"  backoff {delay}s tras error: {last_err}")
            time.sleep(delay)
        try:
            data = nominatim_get(query, viewbox)
            time.sleep(RATE_LIMIT_S)
            if not data:
                cache[query] = {"status": "empty"}
                return cache[query]
            r = data[0]
            cache[query] = {
                "status": "ok",
                "lat": float(r["lat"]),
                "lon": float(r["lon"]),
                "type": r.get("type"),
                "class": r.get("class"),
                "osm_id": r.get("osm_id"),
            }
            return cache[query]
        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code}"
            if e.code in (429, 503):
                continue
            cache[query] = {"status": f"error-http-{e.code}"}
            return cache[query]
        except Exception as e:
            last_err = str(e)
            continue
    cache[query] = {"status": f"error-final: {last_err}"}
    return cache[query]

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    open(PROGRESS_LOG, "a").close()

    log("== Etapa 2: geocode + split por isla ==")
    log(f"leyendo {RAW}")
    with open(RAW) as f:
        raw = json.load(f)
    entidades = raw["entidades"]
    log(f"total entidades: {len(entidades)}")

    cache = load_cache()
    log(f"cache cargado: {len(cache)} entradas previas")

    # Particionar por isla key
    by_isla = defaultdict(list)
    for e in entidades:
        key = isla_to_key(e.get("isla"))
        by_isla[key].append(e)

    for k, lst in by_isla.items():
        log(f"  isla {k}: {len(lst)}")

    # Para GC + LZ + FV: geocodificar lo que no tenga lat/lon
    targets = []
    for k in GEOCODE_TARGETS:
        for e in by_isla.get(k, []):
            if e.get("lat") is None and e.get("lon") is None:
                targets.append((k, e))
    log(f"a geocodificar (prov 35 sin geo): {len(targets)}")

    # Pre-construir queries
    work = []
    for k, e in targets:
        isla = e.get("isla", "")
        muni = e.get("municipio", "")
        via = e.get("direccion_via", "")
        viewbox = ISLA_VIEWBOX[isla_norm(isla)]
        # Intentar primero con calle si existe
        primary = build_query(via, muni, isla, fallback_to_mun=False)
        fallback = build_query(None, muni, isla, fallback_to_mun=True)
        work.append((k, e, primary, fallback, viewbox))

    unique_primary = len({w[2] for w in work})
    unique_fallback = len({w[3] for w in work})
    log(f"queries únicas estimadas — calle: {unique_primary}, mun: {unique_fallback}")

    # Geocodificar respetando cache
    ok_street = ok_mun = failed = 0
    t0 = time.time()
    save_every = 200
    processed = 0
    for k, e, primary, fallback, viewbox in work:
        processed += 1
        result = geocode(primary, viewbox, cache)
        if result.get("status") == "ok":
            e["lat"] = result["lat"]
            e["lon"] = result["lon"]
            e["geocode_status"] = "ok-street"
            e["geocode_source"] = "nominatim"
            ok_street += 1
        else:
            # fallback a centroide municipio
            result2 = geocode(fallback, viewbox, cache)
            if result2.get("status") == "ok":
                e["lat"] = result2["lat"]
                e["lon"] = result2["lon"]
                e["geocode_status"] = "ok-municipio"
                e["geocode_source"] = "nominatim"
                ok_mun += 1
            else:
                e["geocode_status"] = "failed"
                e["geocode_source"] = None
                failed += 1
        if processed % save_every == 0:
            save_cache(cache)
            elapsed = time.time() - t0
            rate = processed / elapsed
            eta = (len(work) - processed) / rate if rate > 0 else 0
            log(f"  progreso {processed}/{len(work)} · ok-street={ok_street} ok-mun={ok_mun} fail={failed} · rate={rate:.2f}/s · ETA={eta/60:.1f}min")
    save_cache(cache)
    elapsed = time.time() - t0
    log(f"geocoding terminado en {elapsed/60:.1f}min · ok-street={ok_street} ok-mun={ok_mun} fail={failed}")

    # Marcar Tenerife sin geo nativo, etc.
    for e in by_isla.get("tf", []):
        if e.get("lat") is None:
            e.setdefault("geocode_status", "skipped-no-address")
            e.setdefault("geocode_source", None)
        elif e.get("geocode_source") is None:
            e["geocode_status"] = "ok-native"
            e["geocode_source"] = "tenerife-cabildo"
    for k in ("lp", "lg", "eh"):
        for e in by_isla.get(k, []):
            e["geocode_status"] = "skipped-out-of-scope"
            e["geocode_source"] = None

    # Re-dedup con clave laxa (slug nombre + slug municipio)
    dedup_dropped = 0
    for k in by_isla:
        seen = {}
        kept = []
        for e in by_isla[k]:
            key = (slug(e.get("nombre")), slug(e.get("municipio")))
            if not key[0]:
                kept.append(e)
                continue
            prev = seen.get(key)
            if prev is None:
                seen[key] = e
                kept.append(e)
            else:
                # Conservar la que tenga lat/lon
                if e.get("lat") is not None and prev.get("lat") is None:
                    # reemplazar prev por e
                    kept = [x for x in kept if x is not prev]
                    kept.append(e)
                    seen[key] = e
                dedup_dropped += 1
        by_isla[k] = kept
    log(f"dedup laxo: {dedup_dropped} duplicados eliminados")

    # Escribir 7 archivos + manifest
    manifest = {
        "version": "v0-prov35-2026-05-13",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scope": "B2 — provincia 35 geocodificada (GC + LZ + FV)",
        "files": {},
    }
    for k, lst in by_isla.items():
        path = f"{OUT_DIR}/{k}.json"
        geocoded = sum(1 for e in lst if e.get("lat") is not None)
        out = {
            "isla_key": k,
            "count": len(lst),
            "geocoded": geocoded,
            "geocoded_pct": round(geocoded / max(1, len(lst)) * 100, 1),
            "entidades": lst,
        }
        with open(path, "w") as f:
            json.dump(out, f, ensure_ascii=False)
        size_kb = os.path.getsize(path) // 1024
        manifest["files"][k] = {
            "path": f"entidades/{k}.json",
            "count": len(lst),
            "geocoded": geocoded,
            "geocoded_pct": out["geocoded_pct"],
            "size_kb": size_kb,
        }
        log(f"  escrito {k}.json — {len(lst)} ents, {geocoded} geo ({out['geocoded_pct']}%), {size_kb}KB")

    with open(f"{OUT_DIR}/manifest.json", "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    log(f"manifest escrito en {OUT_DIR}/manifest.json")
    log(f"== Etapa 2 OK · dedup={dedup_dropped} ==")

if __name__ == "__main__":
    main()
