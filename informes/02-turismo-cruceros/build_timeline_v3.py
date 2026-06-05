"""
build_timeline_v3.py — VERSION SIN CORTES.
  - Vídeo entero en V1 (un solo clip).
  - Audio entero en A1, alineado al vídeo con el offset de 5,838 s.
  - 6 gráficos en V2 en los timecodes donde toca, listos para que muevas tú.

Tú haces el resto: trimear lo que sobra, decidir cuándo entra y sale cada
gráfico, color, etc.

Ejecución (en Resolve, consola Py3, modo Local activado en Preferences):
    exec(open("/Users/panch/KOINOS/informes/02-turismo-cruceros/build_timeline_v3.py",
              encoding="utf-8").read())
"""
import os, sys

PROJECT_NAME  = "OCRE 01 cruceros"
TIMELINE_NAME = "OCRE 01 cruceros - bruto + graficos"
BASE  = "/Users/panch/KOINOS/informes/02-turismo-cruceros"
VIDEO = f"{BASE}/video-raw/cruceros t01.mov"
AUDIO = f"{BASE}/audio/cruceros toma 02.wav"
GRAF  = f"{BASE}/graficos"
FPS   = 25
SYNC_OFFSET_S = 5.838  # el WAV arrancó 5,838 s antes que el vídeo

# Los gráficos quedan suspendidos en estos momentos del AUDIO (toma 02).
# La duración es orientativa — los recortas tú en Resolve.
# (archivo, audio_time_in, duracion_segundos)
GRAPHICS = [
    ("viera-y-clavijo.jpg",                    19.5,  2.5),
    ("clavijo-actual.jpg",                     22.0,  2.5),
    ("phelps.jpg",                             24.5,  2.0),
    ("06-rata-nadadora.png",                   26.5,  3.0),
    ("01-pib-pc-y-salario-ccaa.jpg",          205.0, 30.0),
    ("02-cruceristas-canarias-2010-2025.jpg", 373.0, 20.0),
    ("03-sankey-euro-turistico.jpg",          540.0, 25.0),
    ("04-mapa-cruceros-canarias.jpg",         570.0, 22.0),
    ("05-comparativa-internacional.jpg",      623.0, 110.0),
]

# =====================================================================
def get_resolve():
    g = globals()
    if "resolve" in g and g["resolve"] is not None:
        return g["resolve"]
    import DaVinciResolveScript as dvr  # type: ignore
    return dvr.scriptapp("Resolve")

resolve = get_resolve()
pm = resolve.GetProjectManager()
proj = pm.GetCurrentProject()
if proj.GetName() != PROJECT_NAME:
    pm.LoadProject(PROJECT_NAME)
    proj = pm.GetCurrentProject()
print(f"Proyecto: {proj.GetName()}")

proj.SetSetting("timelineResolutionWidth",  "1920")
proj.SetSetting("timelineResolutionHeight", "1080")
proj.SetSetting("timelineFrameRate",        str(FPS))

mp   = proj.GetMediaPool()
root = mp.GetRootFolder()

def get_or_create_bin(name):
    for f in root.GetSubFolderList():
        if f.GetName() == name: return f
    return mp.AddSubFolder(root, name)

bin_media = get_or_create_bin("Media")
bin_graf  = get_or_create_bin("Graficos")

# --- importar media ---
mp.SetCurrentFolder(bin_media)
have = {c.GetName(): c for c in bin_media.GetClipList()}
to_import = []
if "cruceros t01.mov" not in have:    to_import.append(VIDEO)
if "cruceros toma 02.wav" not in have: to_import.append(AUDIO)
if to_import: mp.ImportMedia(to_import)
have = {c.GetName(): c for c in bin_media.GetClipList()}
video_item = have["cruceros t01.mov"]
audio_item = have["cruceros toma 02.wav"]

# --- importar graficos ---
mp.SetCurrentFolder(bin_graf)
have_g = {c.GetName(): c for c in bin_graf.GetClipList()}
to_import = [f"{GRAF}/{fn}" for fn, *_ in GRAPHICS if fn not in have_g]
if to_import: mp.ImportMedia(to_import)
items_g = {c.GetName(): c for c in bin_graf.GetClipList()}

# --- crear timeline limpia ---
mp.SetCurrentFolder(root)
# si ya existe una con ese nombre, le añadimos sufijo
def unique(name):
    names = set()
    for i in range(1, (proj.GetTimelineCount() or 0) + 1):
        t = proj.GetTimelineByIndex(i)
        if t: names.add(t.GetName())
    if name not in names: return name
    n = 2
    while f"{name}.{n}" in names: n += 1
    return f"{name}.{n}"

tl_name = unique(TIMELINE_NAME)
tl = mp.CreateEmptyTimeline(tl_name)
proj.SetCurrentTimeline(tl)
print(f"Timeline creada: {tl_name}")

# --- V1: vídeo entero ---
print("Colocando video entero en V1...")
added = mp.AppendToTimeline([{"mediaPoolItem": video_item, "trackIndex": 1}])
print(f"  V1: {len(added) if added else 0} clip (video entero)")

# --- A1: audio entero, con offset para sincronizar ---
# Trimeamos los primeros SYNC_OFFSET_S del WAV para que su frame 0 en la timeline
# coincida con el frame 0 del video.
print("Colocando audio entero en A1 con sync...")
addedA = mp.AppendToTimeline([{
    "mediaPoolItem": audio_item,
    "startFrame": int(SYNC_OFFSET_S * FPS),
    "endFrame": int(770 * FPS),  # toda la duracion menos los primeros 5.838s
    "trackIndex": 1,
    "mediaType": 2,  # audio
}])
print(f"  A1: {len(addedA) if addedA else 0} clip (audio offseteado {SYNC_OFFSET_S:.3f}s)")

# --- V2: gráficos en sus momentos ---
print("Colocando graficos en V2...")
ok = fail = 0
for fn, a_in, dur in GRAPHICS:
    item = items_g.get(fn)
    if not item:
        print(f"  ! falta archivo: {fn}")
        fail += 1
        continue
    # convertir audio_time -> video_time (timeline empieza en frame 0 = video 0)
    v_in = a_in - SYNC_OFFSET_S
    if v_in < 0:
        print(f"  ! {fn} cae antes del video, saltando")
        fail += 1
        continue
    # mover playhead
    total_sec = v_in
    h = int(total_sec // 3600); m = int((total_sec // 60) % 60)
    s = int(total_sec % 60);     fr = int((total_sec % 1) * FPS)
    tc = f"{h:02d}:{m:02d}:{s:02d}:{fr:02d}"
    try:
        tl.SetCurrentTimecode(tc)
        r = mp.AppendToTimeline([{
            "mediaPoolItem": item,
            "startFrame": 0,
            "endFrame":   int(dur * FPS) - 1,
            "trackIndex": 2,
        }])
        print(f"  + {fn} @ {tc} ({dur:.1f}s)")
        ok += 1
    except Exception as e:
        print(f"  ! {fn}: {e}")
        fail += 1

print(f"\nGraficos en V2: ok={ok} fail={fail}")
print(f"\nTimeline '{tl_name}' lista. Vídeo + audio sincronizados, gráficos suspendidos.")
print("Borra la timeline cortada anterior si la tienes (clic derecho > delete).")
