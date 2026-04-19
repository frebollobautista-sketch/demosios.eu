# IDEAS — captura del flow del chat

Todo lo que se dice en el chat y no se acaba operando en el mismo turno vive aquí. Formato mínimo:

```
### Fecha — título corto
Contexto de una línea. Decisión pendiente o siguiente paso.
```

---

## Sin clasificar

### 2026-04-19 — Preview renderizable dentro de Cowork
El usuario pidió ver el proyecto en preview sin levantar `npm run dev`. Se generó `ocre-preview.html` en la raíz del proyecto como preview autocontenido (vanilla JS, sin deps) para poder abrirlo directamente. Mantener actualizado cuando cambien las secciones principales.

### 2026-04-19 — Silenciar warning de lockfiles múltiples
Next.js 16 detecta `/Users/panch/package-lock.json` como workspace root. Se fijó `turbopack.root` en `next.config.ts` apuntando al directorio del proyecto. Si aparece en otro proyecto, aplicar el mismo patrón.

## UI / UX

### 2026-04-19 — Candado de privacidad en Ajustes (público/privado del perfil)
En el menú del engranaje (icono superior derecho) añadir un toggle con candado que vuelva el perfil público o privado. Cuando esté privado, mostrar un candado pequeño junto al avatar (tanto en el banner flotante como en la cabecera del perfil) y, en la versión real, ocultar el perfil en Ágora/Polis a quienes no sigas. Implementado ya como prototipo en `ocre-preview.html`; pendiente de cablear en `src/app/ajustes/page.tsx` y en la tabla `profiles` cuando conectemos Supabase (columna `is_public boolean default true`).

### 2026-04-19 — Atributos del cursus honorum: explorar tanto visuales como correspondencias profesionales reales
Propuesta implementada con 7 grados griegos + campo `correspondenciaProfesional`. Falta iterar visualmente: ¿conviene ilustraciones tipo grabado romano sobrio en lugar de símbolos tipográficos (○, ⬡, ◆…)? Probar un segundo set con siluetas de figuras clásicas (togada, laurel, escudo redondo). Posible track paralelo: `poietés` para artistas.

### 2026-04-19 — Banner flotante del avatar: minimización e invisibilidad
Implementado con dos niveles (minimizar → solo avatar; ocultar → desaparece). Falta: recuerdo de la preferencia en localStorage y reapertura desde el icono de perfil del header.

### 2026-04-19 — Suscripción email: persistencia entre rutas
Implementada con `localStorage` vía `useSyncExternalStore` para evitar setState-en-effect de React 19. Si el usuario descarta el banner, al pulsar el icono de correo del header se reabre; tras cerrar con la X vuelve a icono mínimo inferior-izquierda.

## Despliegue

### 2026-04-19 — Dominio: demosios.eu (δημόσιος = "público")
Comprado en DonDominio. Decisión: mantener el registro en DonDominio (precio EU, sin valor migrar), hospedar Next.js en Vercel (free tier suficiente), conectar ambos por DNS (no transfer). SSL lo emite Vercel solo. Runbook completo en [`docs/DEPLOY.md`](./DEPLOY.md). Metadatos y Open Graph de la app ya actualizados en `src/app/layout.tsx`.

### 2026-04-19 — Conectores MCP sugeridos: Supabase y Vercel
Ambos servicios tienen MCP oficial. Conectarlos desde Cowork significa que Claude puede listar proyectos, aplicar migraciones, consultar logs de despliegue y cambiar variables de entorno sin pedir tokens sueltos ni tocar el navegador. GitHub no tiene MCP oficial (sí GitLab / Codeberg); alternativa: `gh auth login` en el sandbox por sesión, o token PAT en `.env.local`.

### 2026-04-19 — Vercel "Install Coding Agent Plugin" — NO hace falta en Cowork
Vercel ofrece un plugin instalable para Claude Code (CLI), Cursor y Codex que les da acceso a su API. Aquí usamos Cowork y ya tenemos el MCP oficial de Vercel conectado, que cubre exactamente las mismas capacidades. Instalar el plugin duplicaría y ensuciaría el entorno local. Solo relevante si algún día se usa Claude Code directamente desde la terminal del Mac.

### 2026-04-19 — Auth y BBDD: Supabase nuevo proyecto para OCRE
Reutilizamos el patrón de KOINOS (`@supabase/ssr`), pero proyecto Supabase separado para no entremezclar datos con KOINOS mientras iteramos. Auth: magic link + Google OAuth como mínimo. Password clásico evitado. Apple OAuth cuando haya app móvil.

### 2026-04-19 — Escalado 0 → ~2.4M usuarios
Supabase Pro cubre hasta ~500k-1M MAUs cómodamente. Para 2.4M se queda en Supabase Team o se migra gradualmente a Postgres autogestionado (Neon / RDS) con réplicas de lectura, Redis delante para sesiones, Cloudflare como CDN. No optimizar antes de tener 10× la demanda actual — la arquitectura se valida con datos reales.

### 2026-04-19 — Tabla de contribuciones única con enum
Diseño sugerido: `contribuciones(id, user_id, tipo enum, seccion_pharos text null, target_id uuid null, creada timestamptz)`. Un solo insert por cualquier acción cívica (video, hilo, respuesta, PEC, pin, espacio recuperado). El agregado de capital se computa con una sola query por usuario, y así podemos re-ejecutar la función `puntosPorContribucion` cuando iteremos sus pesos sin migrar datos.

## Articulación con KOINOS

### 2026-04-19 — Compartir perfil y capital con KOINOS
Prevista la tabla `profiles` replicada. Decisión pendiente: ¿perfil único cross-producto (una sola tabla para KOINOS + OCRE) o perfiles espejo con sync? Favorece lo primero si queremos una sola identidad cívica.

### 2026-04-19 — Digitalizador urbano pixel art → Polis OCRE
El pipeline ya documentado en `KOINOS/POLIS_digitalizador_urbano.md` debe alimentar el mapa de Polis. Material base en `KOINOS/estilos/*.json`.

## Territorio

### 2026-04-19 — Rutas dinámicas por territorio
Pendiente: `/isla/[islaId]`, `/isla/[islaId]/[municipioId]`, `/isla/[islaId]/[municipioId]/[barrioId]`. Cuando exista, convertir los botones del `NavegadorTerritorio` en `<Link>`.

### 2026-04-19 — Barrios reales
Hoy solo hay barrios mapeados para las capitales insulares y algunos municipios grandes. Fuente real: secciones censales del INE + OSM. Cuando conectemos, generar seed SQL.

## Gamificación / Cursus

### 2026-04-19 — Producción de vídeo del cursus: iPad + Procreate Dreams
Tres rutas ordenadas de menor a mayor coste por pieza: (1) kinetic typography + grabado fijo en PNG exportado desde Procreate y compuesto en Dreams con keyframes de posición/opacidad; (2) motion comic con capas separadas (cabeza/cuerpo/fondo) performadas con el dedo en Dreams; (3) cutout articulado con rig. Decisión: arrancar por (1), fija la gramática visual que heredan las otras dos. Antes de tocar Procreate: fijar encuadre único (1080x1920 o 1920x1080, no mezclar), paleta cerrada a los 7 colores del cursus + blanco/negro (cada vídeo vive en el color del grado o eje que explica), y bumper reutilizable de 3 s (logo OCRE → griego → latino → castellano). Pipeline: `docs/guiones/NN-titulo.md` → storyboard → PNGs en `public/cursus/NN/` → Dreams → MP4 → contribución `video` del eje `paideía`.

### 2026-04-19 — Pivote editorial: primero la serie "Circunstancia canaria", luego el cursus
Decisión del usuario: arrancar la producción de vídeo con una serie previa al cursus que explique el porqué del proyecto. Tono Ortega ("yo soy yo y mi circunstancia"), marco civico-territorial. Arco propuesto de 5-6 episodios: (00) Canarias, circunstancia — marco general; (01) La tierra que fue común — heredamientos, suelo comunal, dehesas; (02) Cómo se privatizó el archipiélago — turismo, vivienda vacacional, grandes patrimonios, costa; (03) Qué sigue siendo común — inventario de comunes vivos; (04) Organizarse: por qué ahora — precariedad, éxodo, resistencias; (05) OCRE: para qué existe — puente al mecanismo (cursus, Polis, Ágora, Bibliotheka) como respuesta a los cuatro anteriores. Se mantiene ruta 1 de producción (kinetic typography + grabado fijo) y el pipeline, solo cambian los assets: `public/series/circunstancia/mapa-canarias.svg`, grabados de oficios canarios (gofio, salinas, aljibes, molinos), y fotografía doc ilustrada. Fuentes de datos a tener abiertas desde el guion 00: ISTAC, INE, datos.canarias.es, Ministerio de Vivienda, reportes de impacto turístico. Pendiente: redactar guion del ep 00 en `docs/guiones/00-circunstancia-canaria.md`.

### 2026-04-19 — El grabado romano sobrio puede debutar en vídeo antes que en UI
La exploración pendiente de sustituir los símbolos tipográficos del cursus (○⬡◆✦❖✶♁) por ilustraciones de grabado romano puede probarse primero en el formato vídeo (ruta 1 de la producción). Ahí el coste es bajo y, si funciona, migra a la UI con aval visual real.

### 2026-04-19 — Track `poietés` nace del propio trabajo de animación
Si el admin/autor anima el cursus en Procreate Dreams, se convierte en el primer `poietés` del sistema. El track paralelo artístico (mencionado como variante futura en `CURSUS_HONORUM.md`) puede arrancar con este caso de uso concreto: animar vídeos del cursus entrena el hueco del grado.

### 2026-04-19 — Insignias laterales no lineales
Idea: "custodio/a del agua", "guardián/ana de la biblioteca del barrio", etc. Insignias que cruzan el cursus y aportan reconocimiento lateral sin escalar niveles.

### 2026-04-19 — Red profesional a partir del cursus
Cuando haya varios oikonómoi y ergátai por barrio, ofrecer "sugeridos cercanos con PECs relevantes" como motor de enlace profesional dentro del común.

## Taxonomía

### 2026-04-19 — Códigos cortos de los ejes: KOI · PAI · POL
Notas previas sobre abreviaturas de los indicadores (en sesiones anteriores o NotebookLM) no se encontraron en disco. Decisión: tres letras en alfabeto latino por cada eje — `KOI` (Koinonía), `PAI` (Paideía), `POL` (Politeía). Campo `codigo` añadido al tipo `Eje` en `src/lib/capital/ejes.ts`. Uso previsto: columnas SQL (`cap_koi`, `cap_pai`, `cap_pol` si alguna vez materializamos totales), parámetros de URL (`?eje=KOI`), badges compactos. Si aparecieran las notas originales y divergieran, renombrar es `sed` + una migración SQL.

### 2026-04-19 — Códigos cortos de las 8 secciones PHAROS (pendiente)
Para simetría con los ejes, conviene un código corto por sección PHAROS: propuesta `SAL / CLI / COM / MIG / DEF / MED / IND / TRA`. Todavía sin aplicar al código. Cuando las contribuciones empiecen a cargar la columna `seccion_pharos` con su id-slug actual (`salud-servicios-sociales`, etc.) podemos mantener ese slug y usar los códigos solo para UI.

## Auth

### 2026-04-19 — Tres vías de entrada: magic link · password · Google
Magic link sigue siendo la puerta por defecto (menos fricción, más segura que password débil). Password clásico añadido en `/login` como tab alternativa y en `/registro` como flujo formal de alta. Google OAuth habilitado como atajo. Implementación en `src/app/login/LoginForm.tsx` y `src/app/registro/RegistroForm.tsx`.

### 2026-04-19 — Registro mínimo: email + password + handle (sin domicilio)
Decisión del usuario: pedir domicilio es más sensible que un email, y OCRE es una plataforma cívica, no un censo. El registro formal pide solo correo, contraseña de 8+ caracteres y un handle (minúsculas/números/guión bajo, 3-30). El barrio se setea opcionalmente después desde `/ajustes`. El trigger `handle_new_user` de Supabase lee `raw_user_meta_data->>'handle'` y crea la fila en `profiles` automáticamente.

### 2026-04-19 — Gating: botones visibles pero inertes con microcopy "Entra para..."
Patrón implementado en `src/components/CTAProtegido.tsx`. Un botón que requiere sesión: con usuario activo se comporta normal, sin usuario queda visible con etiqueta alternativa y al clicar muestra un tooltip que enlaza a `/login` y `/registro`. Aplicado ya en: "Subir video" (Bibliotheka) y "Proponer un barrio" (Navegador territorial). Cuando se añadan más acciones (crear hilo en Ágora, marcar pin en Polis, PEC) se usa el mismo componente.

### 2026-04-19 — Banner flotante del avatar: solo con sesión activa
Antes se pintaba siempre con `PERFIL_DEMO`. Ahora el banner solo se monta cuando `useSession()` devuelve un usuario. Pendiente: sustituir `PERFIL_DEMO` por una lectura real desde `profiles` + `contribuciones` del usuario actual cuando cableemos el cálculo de capital en servidor.

### 2026-04-19 — Cuarto eje opcional `oikonomia`
Se decidió reducir a 3 ejes (koinonía/paideía/politeía). Si en iteraciones posteriores aparece una economía local productiva en OCRE, la interfaz `PesoPorEje` admite ampliarla sin romper contribuciones existentes.
