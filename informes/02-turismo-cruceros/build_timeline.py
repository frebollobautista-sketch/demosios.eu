"""
build_timeline.py — Monta el esqueleto de la timeline del proyecto
"OCRE 01 cruceros" en DaVinci Resolve.

Qué hace:
  1. Conecta con la instancia de Resolve abierta y el proyecto activo.
  2. Configura la timeline a 1920x1080 a 25 fps.
  3. Crea un bin "Graficos" e importa los 8 archivos del informe.
  4. Crea una timeline "OCRE 01 cruceros - v1".
  5. Coloca los 8 clips en V1 en el orden del guion con duraciones de
     scaffold (vas a ajustarlas cuando metas la voz).
  6. Intenta crear sobre V2 títulos Text+ con el texto del membrete
     en los clips de datos. Si tu versión de Resolve no permite
     setear el texto vía API, deja los Text+ creados y los rellenas
     a mano (un click cada uno).

Cómo ejecutarlo:
  Opción A (recomendada) — desde DaVinci, una vez abierto el proyecto:
    1) Preferences > System > General > External scripting using = Local
       (si no estaba activado, reinicia Resolve).
    2) Workspace > Console
    3) En el desplegable de abajo, elige "Py3".
    4) Pega esta linea y dale Enter:
       exec(open("/Users/panch/KOINOS/informes/02-turismo-cruceros/build_timeline.py").read())

  Opción B — desde terminal:
    Requiere definir RESOLVE_SCRIPT_API, RESOLVE_SCRIPT_LIB y PYTHONPATH
    segun la doc de Blackmagic. Mas trabajoso. Mejor opcion A.

Notas:
  - Si ya descargaste clavijo-actual.jpg, viera-y-clavijo.jpg y phelps.jpg
    en la carpeta graficos/, el script los importa tambien. Si no
    estan, avisa y sigue sin ellos.
  - Idempotente: lo puedes correr varias veces; si la timeline ya
    existe, crea otra con sufijo numerico.
"""

import os
import sys

# =====================================================================
# CONFIG
# =====================================================================
PROJECT_NAME   = "OCRE 01 cruceros"
TIMELINE_BASE  = "OCRE 01 cruceros - v1"
GRAFICOS_DIR   = "/Users/panch/KOINOS/informes/02-turismo-cruceros/graficos"
FPS            = 25
WIDTH          = 1920
HEIGHT         = 1080

# Escena: (archivo, segundos en pantalla, texto del membrete o None)
# Las duraciones son scaffold; las ajustas en Resolve al montar la voz.
SCENARIO = [
    ("viera-y-clavijo.jpg",                    3,  None),
    ("clavijo-actual.jpg",                     3,  None),
    ("phelps.jpg",                             3,  None),
    ("06-rata-nadadora.png",                   3,  None),
    ("01-pib-pc-y-salario-ccaa.jpg",           8,  "INE · Contabilidad Regional · 2024"),
    ("02-cruceristas-canarias-2010-2025.jpg",  6,  "Autoridad Portuaria de Las Palmas · 2025"),
    ("03-sankey-euro-turistico.jpg",           8,  "Estudios academicos ULL/ULPGC · 2024-2025"),
    ("04-mapa-cruceros-canarias.jpg",          6,  "Puertos de Canarias · 2025"),
    ("05-comparativa-internacional.jpg",      10,  "Govern Venezia 2021 · Dubrovnik 2019 · Cannes 2026 · Amsterdam 2026-2035"),
]

# =====================================================================
# CONEXION A RESOLVE
# =====================================================================
def get_resolve():
    # Dentro de la consola de Resolve ya existe la variable global 'resolve'
    g = globals()
    if "resolve" in g and g["resolve"] is not None:
        return g["resolve"]
    try:
        import DaVinciResolveScript as dvr  # type: ignore
        return dvr.scriptapp("Resolve")
    except Exception as e:
        print("ERROR: no se ha podido conectar con DaVinci Resolve.")
        print("  Asegurate de que esta abierto y de que en Preferences > System")
        print("  > General > External scripting using = Local esta activado.")
        print(f"  Detalle: {e}")
        sys.exit(1)

resolve = get_resolve()
pm = resolve.GetProjectManager()
project = pm.GetCurrentProject()

if project is None:
    print("ERROR: no hay proyecto activo en Resolve.")
    sys.exit(1)

print(f"[Resolve] Conectado. Proyecto activo: '{project.GetName()}'")

if project.GetName() != PROJECT_NAME:
    print(f"  Cambiando al proyecto '{PROJECT_NAME}'...")
    if not pm.LoadProject(PROJECT_NAME):
        print(f"ERROR: no se encontro el proyecto '{PROJECT_NAME}'.")
        sys.exit(1)
    project = pm.GetCurrentProject()
    print(f"  Cargado: '{project.GetName()}'")

# =====================================================================
# AJUSTES DEL PROYECTO
# =====================================================================
project.SetSetting("timelineResolutionWidth",  str(WIDTH))
project.SetSetting("timelineResolutionHeight", str(HEIGHT))
project.SetSetting("timelineFrameRate",        str(FPS))
# Duracion por defecto de imagenes fijas (en frames) = 5s a 25fps
project.SetSetting("timelineDefaultStillDurationInFrames", str(5 * FPS))
print(f"[Settings] {WIDTH}x{HEIGHT} @ {FPS}fps")

# =====================================================================
# BIN "Graficos" + IMPORT
# =====================================================================
mp   = project.GetMediaPool()
root = mp.GetRootFolder()

bin_graf = None
for f in root.GetSubFolderList():
    if f.GetName() == "Graficos":
        bin_graf = f
        print("[Bin] 'Graficos' ya existe, reutilizando.")
        break
if not bin_graf:
    bin_graf = mp.AddSubFolder(root, "Graficos")
    print("[Bin] 'Graficos' creado.")

mp.SetCurrentFolder(bin_graf)

# Que archivos existen realmente en disco
to_import = []
for filename, _, _ in SCENARIO:
    path = os.path.join(GRAFICOS_DIR, filename)
    if os.path.exists(path):
        to_import.append(path)
    else:
        print(f"  ! Falta en disco: {filename} (se ignora)")

# No reimportar lo que ya este en el bin
existing_names = {c.GetName() for c in bin_graf.GetClipList()}
new_paths = [p for p in to_import if os.path.basename(p) not in existing_names]
if new_paths:
    imported = mp.ImportMedia(new_paths) or []
    print(f"[Import] {len(imported)} archivos importados.")
else:
    print("[Import] Todo ya estaba en el bin.")

# Mapa filename -> MediaPoolItem (todos, los recien importados y los previos)
by_name = {c.GetName(): c for c in bin_graf.GetClipList()}

# =====================================================================
# TIMELINE
# =====================================================================
# Sufijo numerico si ya existe
def unique_timeline_name(base):
    names = set()
    for i in range(1, (project.GetTimelineCount() or 0) + 1):
        t = project.GetTimelineByIndex(i)
        if t: names.add(t.GetName())
    if base not in names:
        return base
    n = 2
    while f"{base}.{n}" in names:
        n += 1
    return f"{base}.{n}"

tl_name = unique_timeline_name(TIMELINE_BASE)
mp.SetCurrentFolder(root)
timeline = mp.CreateEmptyTimeline(tl_name)
project.SetCurrentTimeline(timeline)
print(f"[Timeline] Creada: '{tl_name}'")

# =====================================================================
# AÑADIR CLIPS A V1
# =====================================================================
clips_info = []
for filename, secs, _ in SCENARIO:
    item = by_name.get(filename)
    if not item:
        continue
    clips_info.append({
        "mediaPoolItem": item,
        "startFrame": 0,
        "endFrame":   secs * FPS - 1,
    })

added = mp.AppendToTimeline(clips_info) or []
print(f"[V1] {len(added)} clips colocados.")

# =====================================================================
# MEMBRETES (Text+) EN V2
# =====================================================================
print("[V2] Generando membretes Text+ sobre los clips de datos...")
current_frame = 0
ok = 0
fail = 0

for filename, secs, membrete in SCENARIO:
    if filename not in by_name:
        current_frame += secs * FPS
        continue
    if not membrete:
        current_frame += secs * FPS
        continue

    # Mover el playhead al inicio de este clip
    total_seconds = current_frame / FPS
    h = int(total_seconds // 3600)
    m = int((total_seconds // 60) % 60)
    s = int(total_seconds % 60)
    f = current_frame % FPS
    tc = f"{h:02d}:{m:02d}:{s:02d}:{f:02d}"
    try:
        timeline.SetCurrentTimecode(tc)
    except Exception:
        pass

    ti = None
    try:
        ti = timeline.InsertFusionTitleIntoTimeline("Text+")
    except Exception as e:
        print(f"  ! No se pudo insertar Text+ sobre {filename}: {e}")
        fail += 1
        current_frame += secs * FPS
        continue

    if not ti:
        print(f"  ! Text+ devolvio None sobre {filename} (rellenar a mano)")
        fail += 1
        current_frame += secs * FPS
        continue

    # Intentar fijar el texto del Text+ accediendo a la comp Fusion
    text_set = False
    try:
        comp = ti.GetFusionCompByIndex(1)
        if comp:
            tools = comp.GetToolList() or {}
            for _, tool in (tools.items() if hasattr(tools, "items") else []):
                try:
                    attrs = tool.GetAttrs() or {}
                    if attrs.get("TOOLS_RegID") in ("TextPlus", "Template"):
                        tool.SetInput("StyledText", membrete)
                        text_set = True
                        break
                except Exception:
                    continue
    except Exception:
        pass

    if text_set:
        print(f"  + Membrete '{membrete[:50]}...' sobre {filename}")
    else:
        print(f"  + Text+ creado sobre {filename}, rellenar texto a mano:")
        print(f"      \"{membrete}\"")
    ok += 1

    current_frame += secs * FPS

print(f"[V2] Membretes creados: {ok} | fallos: {fail}")

# =====================================================================
# RESUMEN
# =====================================================================
total_dur_s = sum(s for _, s, _ in SCENARIO if by_name.get(_[0] if False else _ ) or True)  # estimate
total_dur_s = sum(s for filename, s, _ in SCENARIO if filename in by_name)
print("")
print("=" * 60)
print(f"  Timeline lista: {tl_name}")
print(f"  Duracion total scaffold: {total_dur_s}s ({total_dur_s//60}m {total_dur_s%60}s)")
print(f"  Pista V1: 8 clips de imagen (orden del guion).")
print(f"  Pista V2: {ok} membretes Text+.")
print("")
print("  Siguientes pasos manuales:")
print("    1. Si algun membrete quedo sin texto, doble-click y pegalo.")
print("    2. Importa tu portadilla con efecto click como primer clip.")
print("    3. Cuando tengas el audio grabado, deslizalo a A1 y ajusta los cortes de V1/V2.")
print("=" * 60)
