#!/usr/bin/env python3
# Copia (snapshot) de subreddits vía RSS (Atom), que NO está bloqueado
# como el .json. Guarda JSON normalizado en public/data/reddit/<sub>.json
# + un index.json. Re-ejecutable para refrescar. Sin dependencias.
import urllib.request, xml.etree.ElementTree as ET, json, os, re, html, time, sys

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36"
SUBS = ["canarias", "spain", "es", "futbol", "cine", "libros", "ciencia",
        "musica", "videojuegos", "askspain", "esCambioClimatico", "podemos"]
OUT = "/Users/panch/KOINOS-iso/public/data/reddit"
ATOM = "{http://www.w3.org/2005/Atom}"
os.makedirs(OUT, exist_ok=True)

def strip_html(s):
    if not s: return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"&#?\w+;", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # quitar boilerplate "submitted by ... [link] [comments]"
    s = re.split(r"submitted by", s)[0].strip()
    return s

manifest = []
for sub in SUBS:
    url = f"https://www.reddit.com/r/{sub}/.rss?limit=25"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.reddit.com/"})
        raw = urllib.request.urlopen(req, timeout=12).read()
        root = ET.fromstring(raw)
    except Exception as e:
        print(f"r/{sub}: FAIL {e}", file=sys.stderr)
        time.sleep(1.5); continue
    items = []
    for e in root.findall(f"{ATOM}entry"):
        title = (e.findtext(f"{ATOM}title") or "").strip()
        an = e.find(f"{ATOM}author/{ATOM}name")
        author = an.text if an is not None else ""
        ce = e.find(f"{ATOM}content")
        body = strip_html(ce.text if ce is not None else "")[:500]
        le = e.find(f"{ATOM}link")
        link = le.get("href") if le is not None else ""
        ts = e.findtext(f"{ATOM}published") or e.findtext(f"{ATOM}updated") or ""
        rid = (e.findtext(f"{ATOM}id") or "").replace("t3_", "")
        if not title: continue
        items.append({"id": rid, "title": title, "author": author,
                      "body": body, "ts": ts, "url": link, "subreddit": sub})
    if len(items) >= 3:
        with open(f"{OUT}/{sub}.json", "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=1)
        manifest.append({"sub": sub, "n": len(items)})
        print(f"r/{sub}: {len(items)} ✓")
    else:
        print(f"r/{sub}: {len(items)} (skip)")
    time.sleep(1.5)

with open(f"{OUT}/index.json", "w", encoding="utf-8") as f:
    json.dump({"subs": manifest, "snapshot_ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, f, ensure_ascii=False, indent=1)
print("\nmanifest:", [m["sub"] for m in manifest])
