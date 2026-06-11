# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Web estática (no oficial) de datos abiertos del conteo de la Semana Santa de Sevilla:
nazarenos y participantes por hermandad y día, multi-año (2023, 2025, 2026), con horarios
oficiales, paso real por La Campana y análisis cruzados. Todo el proyecto está **en español**:
UI, comentarios, commits y documentación.

## Comandos

```bash
npm run dev       # servidor local en http://localhost:4321
npm run build     # genera dist/ — también es la VALIDACIÓN: falla si los datos no cuadran
npm run preview   # sirve dist/ (idéntico a producción)

node scripts/generar-horarios-AAAA.mjs   # convierte el CSV del Consejo en horarios-AAAA.json
```

No hay tests ni linter; `npm run build` es la verificación (la capa de datos valida integridad
referencial en build y lanza errores claros).

## Arquitectura

Astro 5 SSG puro (sin SSR, sin base de datos, sin frameworks de UI). Los JSON de `src/data/`
son la única fuente de verdad y se procesan íntegramente en build. La interactividad
(ordenar/filtrar tablas, gráficas Chart.js, buscador) es JS mínimo inline en cada componente
`.astro` como mejora progresiva sobre HTML ya renderizado.

### Capa de datos: `src/lib/datos.js`

Todo pasa por este módulo. **Auto-descubre** con `import.meta.glob` los ficheros por año:
`nazarenos-AAAA.json`, `horarios-AAAA.json` y `paso-real-AAAA.json`. Añadir un año = soltar su
JSON + entrada en `src/data/anios.json`; todas las páginas, pestañas y comparativas se generan
solas.

- **Catálogos maestros**: `hermandades.json` (id, nombre, slug, dia), `dias.json` (9 días
  litúrgicos con `orden`), `anios.json` (años + fuente por dataset), `fuentes.json` (catálogo
  de procedencia; cada registro puede llevar `fuente_id`, si no, hereda el default del año).
- **Join + derivados en build**: `getAnio()` (totales y % por día), `getHorariosAnio()`
  (minutos *monotónicos*: si un punto horario es menor que el anterior se le suman 1440 min
  para cruzar la medianoche; duración, ocupación de Carrera Oficial),
  `getCruceNazarenosHorarios()` (hermandades con horario pero sin conteo →
  `incidencia: 'sin_datos'`, posible lluvia/suspensión), `getHorariosEnCalle()` (nazarenos
  simultáneos en calle, muestreo cada 5 min), `getPasoReal()` (retrasos acumulados Campana/
  Catedral, depende del orden cronológico previo dentro del día).
- **Formato es-ES**: usar siempre `fmt()`, `fmtPct()`, `fmtDur()` — nunca formatear números a
  mano.

### Rutas (`src/pages/`)

- `/` — hub con tarjetas por año.
- `/[anio]/` — portada del año: KPIs, tabla, explorador y todas las gráficas (horarios,
  análisis, paso real) cuando ese año tiene esos datasets.
- `/[anio]/dia/[dia]/` — página de un día con las mismas gráficas filtradas al día.
- `/[anio]/hermandad/[slug]/` — ficha con datos de **todos** los años.
- `/[anio]/datos/conteo.{csv,json}` — descargas open data (endpoints `.js`).
- `/hermandades/` (buscador) y `/comparativa/` (entre años, con selector de año base).

> Ojo: `/[anio]/horarios/` y `/[anio]/analisis/` ya **no** existen como páginas separadas
> (los docs antiguos las mencionan); sus gráficas viven ahora en la página del año y del día.

### Normas visuales (fijas, no alterar)

- **9 colores por día litúrgico**, en orden:
  `['#6929c4','#1192e8','#005d5d','#9f1853','#fa4d56','#198038','#b28600','#012749','#8a3800']`
  (Domingo de Ramos → Domingo de Resurrección). Toda gráfica nueva que coloree por día usa
  esta paleta.
- **Formas**: solo `circle`, `triangle`, `rect` (ciclo de 3).
- **Tooltips**: siempre el nombre de la hermandad; en scatter `usePointStyle: true`; en barras
  horizontales `interaction: { axis: 'y' }`.
- **Filas de tabla**: fondo = color del día al 10 % de opacidad vía `style` inline calculado
  en frontmatter; `tr:hover` con `!important` en CSS.
- Leyendas HTML junto a la gráfica que las usa, antes del `<figure>`.

## Git y despliegue

- **`main` = producción** (https://semanasantaopendata.jaguerra27.workers.dev — Cloudflare
  Worker de solo-assets; cada push redespliega). **`pre` = pruebas**, con URL estable
  https://pre-semanasantaopendata.jaguerra27.workers.dev. Cambios grandes en `pre`, merge a
  `main` al validarlos.
- Autor de commits: **`jgcoronado <jgcoronado@users.noreply.github.com>`** (el email real está
  privado en GitHub y rechaza el push).
- `wrangler.jsonc` es config de solo-assets; **no** añadir el adaptador SSR de Cloudflare.
- La rama `cloudflare/workers-autoconfig` la gestiona Cloudflare: **no fusionarla** (propone
  config SSR).

## Documentación

- `docs/estado-del-proyecto.md` — estado y datos disponibles por año.
- `docs/guia-anadir-horarios-nuevo-anio.md` — proceso completo para horarios de un año nuevo
  (formato CSV del Consejo, alias de nombres en `idPorNombre`, validaciones).
- `docs/flujo-pre-y-produccion.md` — detalle del flujo PRE → producción.
