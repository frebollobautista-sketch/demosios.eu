#!/bin/bash
# Abre POLIS en tu navegador con un servidor local
cd "$(dirname "$0")"
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║         POLIS - Las Palmas           ║"
echo "  ║  Abriendo en http://localhost:8080   ║"
echo "  ║  Pulsa Ctrl+C para cerrar            ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
open "http://localhost:8080/polis-mapa-real.html" 2>/dev/null || xdg-open "http://localhost:8080/polis-mapa-real.html" 2>/dev/null
python3 -m http.server 8080
