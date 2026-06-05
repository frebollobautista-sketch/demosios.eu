#!/usr/bin/env python3
"""
transcribe_local.py — Transcribe la toma de audio en el Mac de Pancho usando
faster-whisper. Genera whisper_toma02.json con palabras + timestamps.

Por que se ejecuta aqui y no en el sandbox de Claude: el sandbox tiene proxy
que bloquea la descarga de modelos desde HuggingFace (403 Forbidden). En tu
Mac no hay restriccion: el modelo se descarga la primera vez y queda en
~/.cache/huggingface, y las siguientes pasadas son instantes.

USO:
    1) Una sola vez:
         pip3 install faster-whisper --break-system-packages
       (o dentro de un venv si lo prefieres)
    2) python3 transcribe_local.py
    3) Cuando termine, se crea whisper_toma02.json al lado de este script.
       Subelo al chat y yo sigo con el mapeo a timecodes y el SRT.

Tiempo estimado en M1/M2:
    - modelo small  : 2-3 minutos para 13 min de audio
    - modelo medium : 5-7 minutos (mas precision en español)
    - modelo large-v3 : 8-12 minutos (top calidad)
"""
import json, time, os, sys
from pathlib import Path

try:
    from faster_whisper import WhisperModel
except ImportError:
    print("ERROR: faster-whisper no instalado. Ejecuta:")
    print("  pip3 install faster-whisper --break-system-packages")
    sys.exit(1)

HERE  = Path(__file__).parent
AUDIO = HERE / "audio" / "cruceros toma 02.wav"
OUT   = HERE / "whisper_toma02.json"

MODEL = "small"   # cambia a "medium" o "large-v3" si quieres mas calidad

if not AUDIO.exists():
    print(f"ERROR: no encuentro {AUDIO}")
    sys.exit(1)

print(f"[{time.strftime('%H:%M:%S')}] cargando modelo {MODEL} (int8)...")
t0 = time.time()
model = WhisperModel(MODEL, device="cpu", compute_type="int8")
print(f"  modelo cargado en {time.time()-t0:.1f}s")

print(f"[{time.strftime('%H:%M:%S')}] transcribiendo {AUDIO.name} ...")
t0 = time.time()
segments, info = model.transcribe(
    str(AUDIO),
    language="es",
    word_timestamps=True,
    vad_filter=True,
    vad_parameters=dict(min_silence_duration_ms=500),
    beam_size=5,
)

result = {"language": info.language, "duration": info.duration, "segments": []}
for i, seg in enumerate(segments):
    result["segments"].append({
        "start": seg.start, "end": seg.end, "text": seg.text,
        "words": [{"start": w.start, "end": w.end, "word": w.word}
                  for w in (seg.words or [])],
    })
    if i % 5 == 0:
        print(f"  [{seg.start:6.1f} -> {seg.end:6.1f}] {seg.text[:80]}")

with open(OUT, "w") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"\n[{time.strftime('%H:%M:%S')}] OK transcripcion en {time.time()-t0:.1f}s")
print(f"  segmentos: {len(result['segments'])}")
print(f"  archivo:   {OUT}")
print(f"\nSubelo al chat con Claude y yo sigo desde ahi.")
