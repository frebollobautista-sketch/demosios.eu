"""
build_timeline_v2.py — Versión con timecodes REALES de la toma 02.
Importa el video y el WAV con la sync correcta, aplica los cortes
de retakes, y coloca los gráficos en sus momentos exactos.

Como ejecutarlo en Resolve (Workspace > Console > Py3):
    exec(open("/Users/panch/KOINOS/informes/02-turismo-cruceros/build_timeline_v2.py").read())
"""
import os, sys

PROJECT_NAME = "OCRE 01 cruceros"
TIMELINE_NAME = "OCRE 01 cruceros - cortado v1"
BASE  = "/Users/panch/KOINOS/informes/02-turismo-cruceros"
VIDEO = f"{BASE}/video-raw/cruceros t01.mov"
AUDIO = f"{BASE}/audio/cruceros toma 02.wav"
GRAF  = f"{BASE}/graficos"
FPS   = 25
SYNC_OFFSET_S = 5.838  # el WAV empezo SYNC_OFFSET s antes que el video

# Segmentos a mantener, en tiempo de AUDIO (toma 02). Para video, resta SYNC_OFFSET.
KEEP_AUDIO = [(19.18, 32.12, 'hook'), (43.66, 51.17, 'hook'), (82.33, 107.74, 'hook'), (152.34, 164.11, 'hook'), (164.11, 185.78, 'paradoja'), (199.19, 235.3, 'paradoja'), (236.03, 264.61, 'paradoja'), (269.31, 304.5, 'paradoja'), (325.44, 359.24, 'cruceros'), (373.47, 405.93, 'cruceros'), (425.0, 451.5, 'cruceros'), (474.89, 493.4, 'cruceros'), (493.4, 523.35, 'cruceros'), (515.36, 519.5, 'fuga'), (534.28, 565.88, 'fuga'), (565.88, 593.3, 'fuga'), (593.3, 622.91, 'fuga'), (622.91, 646.43, 'comparativa'), (646.43, 655.71, 'comparativa'), (684.5, 692.34, 'comparativa'), (700.13, 717.05, 'comparativa'), (717.05, 738.73, 'comparativa'), (744.15, 766.89, 'cierre')]

# Graficos: (archivo, audio_time_in, audio_time_out)
GRAPHICS = [('viera-y-clavijo.jpg', 19.5, 21.5), ('clavijo-actual.jpg', 21.5, 24.5), ('phelps.jpg', 24.5, 26.5), ('06-rata-nadadora.png', 26.5, 29.5), ('01-pib-pc-y-salario-ccaa.jpg', 205.0, 240.0), ('02-cruceristas-canarias-2010-2025.jpg', 373.0, 395.0), ('03-sankey-euro-turistico.jpg', 540.0, 570.0), ('04-mapa-cruceros-canarias.jpg', 570.0, 593.0), ('05-comparativa-internacional.jpg', 623.0, 740.0)]

# ---------------------------------------------------------------
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

proj.SetSetting("timelineResolutionWidth", "1920")
proj.SetSetting("timelineResolutionHeight", "1080")
proj.SetSetting("timelineFrameRate", str(FPS))

mp = proj.GetMediaPool()
root = mp.GetRootFolder()

def get_or_create_bin(name):
    for f in root.GetSubFolderList():
        if f.GetName() == name: return f
    return mp.AddSubFolder(root, name)

bin_media = get_or_create_bin("Media")
bin_graf  = get_or_create_bin("Graficos")

# Importar video, audio y graficos
mp.SetCurrentFolder(bin_media)
existing = {c.GetName(): c for c in bin_media.GetClipList()}
to_import = []
if "cruceros t01.mov" not in existing: to_import.append(VIDEO)
if "cruceros toma 02.wav" not in existing: to_import.append(AUDIO)
if to_import: mp.ImportMedia(to_import)
items_media = {c.GetName(): c for c in bin_media.GetClipList()}
video_item = items_media.get("cruceros t01.mov")
audio_item = items_media.get("cruceros toma 02.wav")

mp.SetCurrentFolder(bin_graf)
existing_g = {c.GetName(): c for c in bin_graf.GetClipList()}
graf_paths = []
for (fn, *_rest) in GRAPHICS:
    if fn not in existing_g:
        graf_paths.append(f"{GRAF}/{fn}")
if graf_paths: mp.ImportMedia(graf_paths)
items_g = {c.GetName(): c for c in bin_graf.GetClipList()}

# Crear timeline
mp.SetCurrentFolder(root)
tl = mp.CreateEmptyTimeline(TIMELINE_NAME)
proj.SetCurrentTimeline(tl)

# V1: trozos de VIDEO segun KEEP_AUDIO (en VIDEO time = audio - SYNC_OFFSET)
print("Colocando trozos de video en V1...")
clips_info = []
for (a_start, a_end, sec) in KEEP_AUDIO:
    v_start = max(0, a_start - SYNC_OFFSET_S)
    v_end   = max(0, a_end   - SYNC_OFFSET_S)
    clips_info.append({
        "mediaPoolItem": video_item,
        "startFrame": int(v_start * FPS),
        "endFrame":   int(v_end   * FPS),
        "trackIndex": 1,
    })
added = mp.AppendToTimeline(clips_info) or []
print(f"  V1: {len(added)} clips de video")

# A1: trozos de AUDIO (en audio time, sin offset)
print("Colocando trozos de audio en A1...")
audio_info = []
for (a_start, a_end, sec) in KEEP_AUDIO:
    audio_info.append({
        "mediaPoolItem": audio_item,
        "startFrame": int(a_start * FPS),
        "endFrame":   int(a_end   * FPS),
        "trackIndex": 1,
        "mediaType":  2,  # audio
    })
addedA = mp.AppendToTimeline(audio_info) or []
print(f"  A1: {len(addedA)} clips de audio")

# V2: graficos en sus momentos
print("Colocando graficos en V2...")
def audio_to_cut_frame(t_audio):
    cut = 0.0
    for (s, e, _sec) in KEEP_AUDIO:
        if t_audio < s: return None
        if s <= t_audio <= e: return int((cut + (t_audio - s)) * FPS)
        cut += e - s
    return None

graf_info = []
for (fn, a_in, a_out) in GRAPHICS:
    item = items_g.get(fn)
    if not item: continue
    f_in  = audio_to_cut_frame(a_in)
    f_out = audio_to_cut_frame(a_out)
    if f_in is None or f_out is None: continue
    graf_info.append({
        "mediaPoolItem": item,
        "startFrame": 0, "endFrame": f_out - f_in - 1,
        "trackIndex": 2,
    })

# Para V2 con posicion exacta hace falta InsertClipsIntoTimeline con timecode.
# Como AppendToTimeline solo agrega, usamos un workaround: insertamos los graficos
# uno a uno con SetCurrentTimecode + InsertClipsIntoTimeline.
for fn, a_in, a_out in GRAPHICS:
    item = items_g.get(fn)
    if not item: continue
    f_in  = audio_to_cut_frame(a_in)
    f_out = audio_to_cut_frame(a_out)
    if f_in is None or f_out is None: continue
    total_sec = f_in / FPS
    h = int(total_sec // 3600); m = int((total_sec // 60) % 60)
    s = int(total_sec % 60); fr = f_in % FPS
    tc = f"{h:02d}:{m:02d}:{s:02d}:{fr:02d}"
    try:
        tl.SetCurrentTimecode(tc)
        mp.AppendToTimeline([{"mediaPoolItem": item,
                              "startFrame": 0, "endFrame": f_out - f_in - 1,
                              "trackIndex": 2}])
        print(f"  + {fn} @ {tc}")
    except Exception as e:
        print(f"  ! {fn}: {e}")

print("\nTimeline cortada lista. Revisa V1/V2/A1.")
