/**
 * Exportadores de mediciones del calibrador.
 *
 * JSON → compatible con KOINOS/estilos/materiales_base.json
 * GDScript → compatible con KOINOS/godot/mercado_vegueta/scripts/pixel_art_styles.gd
 */

export type Medicion = {
  id: string;
  nombre: string;
  pixelSize: number;
  colores: number;
  contraste: number;
  saturacion: number;
  paletaHex: string[];
  tilesUnicos: number;
  densidadBitsPx: number;
  timestamp: string;
};

export function exportarJson(mediciones: Medicion[]): string {
  const materiales: Record<string, unknown> = {};
  for (const m of mediciones) {
    materiales[m.nombre] = {
      pixel_size: { recomendado: m.pixelSize },
      colores: { recomendado: m.colores },
      contraste_pct: { recomendado: m.contraste },
      saturacion_pct: { recomendado: m.saturacion },
      paleta_referencia_hex: m.paletaHex,
      metricas: {
        tiles_unicos: m.tilesUnicos,
        densidad_bits_px: Number(m.densidadBitsPx.toFixed(3)),
      },
      timestamp: m.timestamp,
    };
  }
  return JSON.stringify(
    {
      version: "0.2.0",
      fuente: "KOINOS/calibrador",
      materiales,
    },
    null,
    2
  );
}

export function exportarGdScript(mediciones: Medicion[]): string {
  const lineas: string[] = [];
  lineas.push(
    "## Perfiles de material generados por el calibrador de KOINOS.",
    "## NO EDITAR A MANO — se regenera desde /calibrador.",
    "",
    "class_name PixelArtStyles",
    "extends Resource",
    "",
    "static var materiales: Dictionary = {"
  );

  mediciones.forEach((m, i) => {
    const coma = i < mediciones.length - 1 ? "," : "";
    lineas.push(`\t"${m.nombre}": {`);
    lineas.push(`\t\t"pixel_size": ${m.pixelSize},`);
    lineas.push(`\t\t"colores": ${m.colores},`);
    lineas.push(`\t\t"contraste_pct": ${m.contraste},`);
    lineas.push(`\t\t"saturacion_pct": ${m.saturacion},`);
    const paleta = m.paletaHex.map((h) => `Color("${h}")`).join(", ");
    lineas.push(`\t\t"paleta": [${paleta}]`);
    lineas.push(`\t}${coma}`);
  });

  lineas.push(
    "}",
    "",
    "static func get_material(id: String) -> Dictionary:",
    "\treturn materiales.get(id, {})",
    "",
    "static func get_color_medio(id: String) -> Color:",
    "\tvar mat: Dictionary = materiales.get(id, {})",
    "\tif mat.is_empty():",
    "\t\treturn Color.MAGENTA",
    "\tvar paleta: Array = mat[\"paleta\"]",
    "\treturn paleta[paleta.size() / 2]",
    "",
    "static func make_material_3d(id: String) -> StandardMaterial3D:",
    "\tvar mat := StandardMaterial3D.new()",
    "\tmat.albedo_color = get_color_medio(id)",
    "\tmat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST",
    "\tmat.metallic = 0.0",
    "\tmat.roughness = 0.9",
    "\treturn mat",
    ""
  );

  return lineas.join("\n");
}

export function descargar(nombre: string, contenido: string, mime: string) {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
