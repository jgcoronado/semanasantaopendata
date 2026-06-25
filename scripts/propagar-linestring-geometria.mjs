/**
 * propagar-linestring-geometria.mjs
 *
 * Para cada GeoJSON no editado, reconstruye la LineString insertando las
 * coordenadas intermedias canónicas de los GeoJSONs editados:
 *   - Para cada par de calles consecutivas (A→B) en el archivo no editado,
 *     si ese par aparece en algún editado, extrae el segmento detallado de
 *     su LineString (coords entre el punto más cercano a A y el más cercano a B)
 *     y lo usa en lugar de ir directamente de A a B.
 *   - Si el par no aparece en ningún editado, se mantiene la línea directa.
 *
 * También corrige en todos los archivos:
 *   "Plaza de Jesús del Gran Poder" → "Calle Jesús del Gran Poder"
 *   con la coordenada correcta [-5.995978500352905, 37.3940198419956]
 *
 * Uso:
 *   node scripts/propagar-linestring-geometria.mjs
 *   node scripts/propagar-linestring-geometria.mjs --dry-run
 *   node scripts/propagar-linestring-geometria.mjs --verbose
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = join(__dir, 'geojson-2025');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE  = process.argv.includes('--verbose');

const EDITED_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 22, 30, 40]);

const GRAN_PODER = {
  nombres: ['Plaza de Jesús del Gran Poder', 'Calle Jesús del Gran Poder'],
  nombre_correcto: 'Calle Jesús del Gran Poder',
  osm_correcto: 'Calle Jesús del Gran Poder',
  coord: [-5.995978500352905, 37.3940198419956],
};

// ── Utilidades ───────────────────────────────────────────────────────────────

function dist2d([lon1, lat1], [lon2, lat2]) {
  const dlat = (lat1 - lat2) * 111320;
  const dlon = (lon1 - lon2) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlon * dlon);
}

/** Devuelve el índice en lineCoords más cercano a coord, buscando desde startFrom en adelante. */
function closestFromIdx(lineCoords, coord, startFrom) {
  let bestIdx  = startFrom;
  let bestDist = dist2d(lineCoords[startFrom], coord);
  for (let i = startFrom + 1; i < lineCoords.length; i++) {
    const d = dist2d(lineCoords[i], coord);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return { idx: bestIdx, dist: bestDist };
}

/**
 * Mapea cada Point de pts a su posición en lineCoords, avanzando en orden
 * (no se puede ir hacia atrás).
 * Devuelve array de índices, uno por Point.
 *
 * Las rutas son circulares: el primer Point (la iglesia) aparece también al
 * final del LineString. Sin límite, el primer Point saltaría al extremo de
 * vuelta (idx alto), bloqueando todos los demás. Por eso limitamos la búsqueda
 * del primer Point al primer 15 % del LineString.
 */
function mapPointsToLine(pts, lineCoords) {
  const mapping  = [];
  let startFrom  = 0;
  const N        = lineCoords.length;
  const firstMax = Math.min(N, Math.max(5, Math.ceil(N * 0.15)));

  for (let j = 0; j < pts.length; j++) {
    const searchEnd = (j === 0) ? firstMax : N;
    let bestIdx  = startFrom;
    let bestDist = startFrom < searchEnd ? dist2d(lineCoords[startFrom], pts[j].coord) : Infinity;
    for (let i = startFrom + 1; i < searchEnd; i++) {
      const d = dist2d(lineCoords[i], pts[j].coord);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    mapping.push({ idx: bestIdx, dist: bestDist });
    startFrom = bestIdx;
  }
  return mapping;
}

// ── 1. Cargar segmentos desde el fichero de referencia canónico ──────────────
//
// Lee segmentos-canonicos-2025.json (generado por exportar-segmentos-canonicos.mjs
// con fuentes elegidas manualmente). Si no existe, cae al método original.
//

const segDB = new Map();

const archivos = readdirSync(GEO_DIR).filter(f => f.endsWith('.geojson')).sort();

const REF_FILE = join(__dir, 'segmentos-canonicos-2025.json');
let usandoReferencia = false;

if (existsSync(REF_FILE)) {
  const ref = JSON.parse(readFileSync(REF_FILE, 'utf8'));
  // Para cada par, cargar el segmento de la fuente preferida
  for (const par of ref.pares) {
    const seg = ref.segmentos.find(
      s => s.fuente === par.fuente_preferida && `${s.desde}→${s.hasta}` === par.par
    );
    if (!seg || seg.calidad === 'mala') continue;
    // Encontrar contexto (calle anterior y posterior) desde el segmento
    segDB.set(par.par, [{
      coords:    seg.coords,
      prevCalle: seg.calle_anterior,
      nextCalle: seg.calle_posterior,
      src:       seg.fuente + '.geojson',
      distA:     seg.dist_inicio_m,
      distB:     seg.dist_fin_m,
    }]);
  }
  console.log(`── Cargando desde referencia canónica (${REF_FILE.split(/[\\/]/).pop()}) ──`);
  console.log(`   ${segDB.size} pares cargados (fuentes elegidas manualmente, calidad mala descartada)\n`);
  usandoReferencia = true;
} else {
  // Fallback: construir segDB desde los GeoJSONs editados (método original)
  console.log('── Cargando GeoJSONs editados (sin fichero de referencia) ──\n');

  for (const archivo of archivos) {
    const id = parseInt(archivo);
    if (!EDITED_IDS.has(id)) continue;

    const geo  = JSON.parse(readFileSync(join(GEO_DIR, archivo), 'utf8'));
    const line = geo.features.find(f => f.geometry?.type === 'LineString');
    const pts  = geo.features
      .filter(f => f.geometry?.type === 'Point' && f.properties?.calle)
      .map(f => ({ calle: f.properties.calle, coord: f.geometry.coordinates }));

    if (!line || pts.length < 2) { console.log(`  ${archivo}: sin línea o sin puntos`); continue; }

    const lineCoords = line.geometry.coordinates;
    const mapping    = mapPointsToLine(pts, lineCoords);

    let segsExtraidos = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const idxA = mapping[i].idx;
      const idxB = mapping[i + 1].idx;
      if (idxB <= idxA) continue;

      const coords    = lineCoords.slice(idxA, idxB + 1);
      const calleA    = pts[i].calle;
      const calleB    = pts[i + 1].calle;
      const prevCalle = pts[i - 1]?.calle ?? null;
      const nextCalle = pts[i + 2]?.calle ?? null;
      const key       = `${calleA}→${calleB}`;

      if (!segDB.has(key)) segDB.set(key, []);
      segDB.get(key).push({ coords, prevCalle, nextCalle, src: archivo, distA: mapping[i].dist, distB: mapping[i + 1].dist });
      segsExtraidos++;
    }
    console.log(`  ${archivo}: ${pts.length} pts, ${lineCoords.length} coords línea → ${segsExtraidos} segmentos`);
  }
  console.log(`\nBase de datos: ${segDB.size} pares únicos de calles\n`);
}

// ── 2. Función para seleccionar el segmento canónico de una par A→B ──────────

function selectCanonical(calleA, calleB, prevCalle) {
  const entries = segDB.get(`${calleA}→${calleB}`);
  if (!entries || entries.length === 0) return null;
  if (entries.length === 1) return entries[0];

  // Con referencia manual hay una sola entrada por par; sin ella, desambiguar por contexto
  if (prevCalle) {
    const byPrev = entries.filter(e => e.prevCalle === prevCalle);
    if (byPrev.length === 1) return byPrev[0];
  }

  return entries.reduce((best, e) =>
    (e.distA + e.distB) < (best.distA + best.distB) ? e : best
  );
}

// ── 3. Función para corregir Gran Poder en los features de un GeoJSON ────────

function fixGranPoder(geo) {
  let cambios = 0;
  for (const f of geo.features) {
    if (f.geometry?.type !== 'Point') continue;
    if (!GRAN_PODER.nombres.includes(f.properties?.calle)) continue;

    const [lonAct, latAct] = f.geometry.coordinates;
    const [lonOk,  latOk ] = GRAN_PODER.coord;
    const esNombreOk  = f.properties.calle === GRAN_PODER.nombre_correcto;
    const esCoordOk   = (lonAct === lonOk && latAct === latOk);

    if (!esNombreOk) { f.properties.calle = GRAN_PODER.nombre_correcto; cambios++; }
    if (f.properties.osm !== GRAN_PODER.osm_correcto) { f.properties.osm = GRAN_PODER.osm_correcto; cambios++; }
    if (!esCoordOk) { f.geometry.coordinates = [...GRAN_PODER.coord]; cambios++; }
  }
  return cambios;
}

// ── 4. Reconstruir LineString con segmentos canónicos ────────────────────────
//
// Para cada par consecutivo de Points, si hay un segmento canónico con más de
// 2 coords, se usa su interior (entre los extremos, que se reemplazan por las
// coords reales del archivo en proceso para garantizar continuidad).
//

function buildLineString(pts, archivo) {
  if (pts.length === 0) return [];

  // Construye segmentos: cada uno incluye start y end (extremos del par)
  const segs = [];
  let segsCanonicos = 0;
  let coordsAñadidas = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const a        = pts[i];
    const b        = pts[i + 1];
    const prevCalle = pts[i - 1]?.calle ?? null;

    const canon = selectCanonical(a.calle, b.calle, prevCalle);

    if (canon && canon.coords.length > 2) {
      // Interior del segmento canónico (sin sus extremos)
      const interior = canon.coords.slice(1, -1);
      segs.push([a.coord, ...interior, b.coord]);
      segsCanonicos++;
      coordsAñadidas += interior.length;
      if (VERBOSE) {
        console.log(`    [${archivo}] ${a.calle} → ${b.calle}`);
        console.log(`      fuente: ${canon.src}, +${interior.length} coords intermedias`);
      }
    } else {
      segs.push([a.coord, b.coord]);
    }
  }

  // Fusionar: cada segmento comparte el extremo final con el inicio del siguiente
  const newLine = [...segs[0]];
  for (let s = 1; s < segs.length; s++) {
    newLine.push(...segs[s].slice(1)); // el primer punto ya está como último del anterior
  }

  return { coords: newLine, segsCanonicos, coordsAñadidas };
}

// ── 5. Procesar GeoJSONs no editados ─────────────────────────────────────────

console.log('── Procesando GeoJSONs no editados ──\n');
let totalArchivos = 0, totalGranPoder = 0, totalCoords = 0;

for (const archivo of archivos) {
  const id = parseInt(archivo);
  if (EDITED_IDS.has(id)) continue;

  const filePath = join(GEO_DIR, archivo);
  const geo      = JSON.parse(readFileSync(filePath, 'utf8'));

  // a) Corregir Gran Poder
  const gpCambios = fixGranPoder(geo);
  if (gpCambios > 0) {
    totalGranPoder += gpCambios;
    if (VERBOSE) console.log(`  [${archivo}] Gran Poder: ${gpCambios} cambios`);
  }

  // b) Extraer Points (en orden del GeoJSON)
  const lineFeature = geo.features.find(f => f.geometry?.type === 'LineString');
  const pts = geo.features
    .filter(f => f.geometry?.type === 'Point' && f.properties?.calle)
    .map(f => ({ calle: f.properties.calle, coord: f.geometry.coordinates }));

  if (!lineFeature || pts.length < 2) {
    console.log(`  ${archivo}: sin línea o sin puntos suficientes`);
    continue;
  }

  // c) Construir nueva LineString con segmentos canónicos
  const { coords: newCoords, segsCanonicos, coordsAñadidas } = buildLineString(pts, archivo);

  const coordsAntes  = lineFeature.geometry.coordinates.length;
  const coordsDespues = newCoords.length;

  if (coordsAñadidas === 0 && gpCambios === 0) {
    if (VERBOSE) console.log(`  ${archivo}: sin cambios`);
    continue;
  }

  lineFeature.geometry.coordinates = newCoords;
  geo.features = [lineFeature, ...geo.features.filter(f => f.geometry?.type === 'Point')];

  if (!DRY_RUN) writeFileSync(filePath, JSON.stringify(geo, null, 2));

  const marca = DRY_RUN ? ' (dry-run)' : '';
  console.log(`  ✓ ${archivo}: ${coordsAntes}→${coordsDespues} coords (+${coordsAñadidas} intermedias, ${segsCanonicos} seg. canónicos)${gpCambios ? `, GP:${gpCambios}` : ''}${marca}`);
  totalArchivos++;
  totalCoords += coordsAñadidas;
}

// ── 6. Corregir Gran Poder también en los editados ───────────────────────────

console.log('\n── Corrigiendo Gran Poder en editados ──\n');
for (const archivo of archivos) {
  const id = parseInt(archivo);
  if (!EDITED_IDS.has(id)) continue;

  const filePath = join(GEO_DIR, archivo);
  const geo      = JSON.parse(readFileSync(filePath, 'utf8'));
  const cambios  = fixGranPoder(geo);

  if (cambios > 0) {
    if (!DRY_RUN) writeFileSync(filePath, JSON.stringify(geo, null, 2));
    console.log(`  ✓ ${archivo}: Gran Poder corregido (${cambios} cambios)${DRY_RUN ? ' (dry-run)' : ''}`);
    totalGranPoder += cambios;
  }
}

console.log(`\n── Resumen ──`);
console.log(`Archivos modificados:    ${totalArchivos}`);
console.log(`Coords intermedias añadidas: ${totalCoords}`);
console.log(`Cambios Gran Poder:      ${totalGranPoder}`);
if (DRY_RUN) console.log('(modo --dry-run: no se guardaron cambios)');
