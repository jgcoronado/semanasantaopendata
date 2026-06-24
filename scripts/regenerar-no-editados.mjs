/**
 * regenerar-no-editados.mjs
 *
 * Propaga las coordenadas canónicas de los GeoJSONs editados manualmente
 * al resto de hermandades usando emparejamiento contextual:
 *
 *   Para cada punto P con calle C en un GeoJSON no editado (posición i):
 *     1. Busca en todos los GeoJSONs editados las ocurrencias de calle C.
 *     2. Puntúa cada ocurrencia según si coinciden la calle previa (i-1) y/o
 *        la siguiente (i+1): +2 por cada coincidencia de vecino.
 *     3. Si la mejor puntuación ≥ 2 → usa esa coordenada (al menos un vecino coincide).
 *     4. Si no hay coincidencia contextual pero C aparece en UN SOLO GeoJSON editado
 *        → usa esa coordenada.
 *     5. Si C aparece en varios editados con coordenadas diferentes y ningún contexto
 *        coincide → elige la más cercana al punto medio entre los vecinos del GeoJSON
 *        actual (preserva la continuidad geométrica).
 *
 * Uso:
 *   node scripts/regenerar-no-editados.mjs
 *   node scripts/regenerar-no-editados.mjs --dry-run   (solo muestra cambios)
 *   node scripts/regenerar-no-editados.mjs --verbose    (detalla cada punto)
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const GEOJSON_DIR = join(__dir, 'geojson-2025');
const DRY_RUN  = process.argv.includes('--dry-run');
const VERBOSE  = process.argv.includes('--verbose');

// IDs editados manualmente (fuente de verdad, no se modifican)
const EDITED_IDS = new Set([1, 3, 5, 7, 8, 22, 30, 40]);

function dist2d(lon1, lat1, lon2, lat2) {
  const dlat = (lat1 - lat2) * 111320;
  const dlon = (lon1 - lon2) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlon * dlon);
}

// ── 1. Cargar GeoJSONs editados y construir lookup contextual ────────────────
//
// editedLookup: Map<calle, [{lon, lat, osm, prev, next, src}]>
//
const editedLookup = new Map(); // calle → [{lon, lat, osm, prev, next, src}]

const archivos = readdirSync(GEOJSON_DIR)
  .filter(f => f.endsWith('.geojson'))
  .sort();

console.log('── Cargando GeoJSONs editados ──\n');

for (const archivo of archivos) {
  const id = parseInt(archivo);
  if (!EDITED_IDS.has(id)) continue;

  const geo = JSON.parse(readFileSync(join(GEOJSON_DIR, archivo), 'utf8'));
  const pts = geo.features.filter(
    f => f.geometry?.type === 'Point' && f.properties?.calle
  );

  let count = 0;
  for (let j = 0; j < pts.length; j++) {
    const p = pts[j];
    const calle = p.properties.calle;
    const [lon, lat] = p.geometry.coordinates;
    const entry = {
      lon, lat,
      osm: p.properties.osm ?? calle,
      prev: pts[j - 1]?.properties?.calle ?? null,
      next: pts[j + 1]?.properties?.calle ?? null,
      src: archivo,
    };
    if (!editedLookup.has(calle)) editedLookup.set(calle, []);
    editedLookup.get(calle).push(entry);
    count++;
  }
  console.log(`  ${archivo}: ${count} puntos indexados`);
}

console.log(`\nLookup contextual: ${editedLookup.size} calles únicas`);
console.log(`(algunas calles tienen múltiples coordenadas según contexto)\n`);

// ── 2. Función de selección canónica contextual ──────────────────────────────

function selectCanonical(calle, prevCalle, nextCalle, curLon, curLat, neighborMid) {
  const candidates = editedLookup.get(calle);
  if (!candidates || candidates.length === 0) return null;

  // Puntuar cada candidato por coincidencia de vecinos
  let best = null;
  let bestScore = -1;

  for (const c of candidates) {
    let score = 0;
    if (prevCalle && c.prev === prevCalle) score += 2;
    if (nextCalle && c.next === nextCalle) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    } else if (score === bestScore && best !== null) {
      // Empate: preferir el más cercano al punto medio de los vecinos (si está disponible)
      if (neighborMid) {
        const dNew = dist2d(c.lon, c.lat, neighborMid.lon, neighborMid.lat);
        const dBest = dist2d(best.lon, best.lat, neighborMid.lon, neighborMid.lat);
        if (dNew < dBest) { best = c; }
      }
    }
  }

  // Si hay coincidencia contextual (score ≥ 2) → usar sin dudar
  if (bestScore >= 2) return best;

  // Sin contexto: verificar si todos los candidatos coinciden en coord (±5m)
  const allSameCoord = candidates.every(
    c => dist2d(c.lon, c.lat, candidates[0].lon, candidates[0].lat) < 5
  );
  if (allSameCoord) return candidates[0];

  // Múltiples coords distintas sin contexto → elegir por cercanía al punto medio
  if (neighborMid) {
    return candidates.reduce((b, c) =>
      dist2d(c.lon, c.lat, neighborMid.lon, neighborMid.lat) <
      dist2d(b.lon, b.lat, neighborMid.lon, neighborMid.lat) ? c : b
    );
  }

  // Último recurso: primer candidato
  return candidates[0];
}

// ── 3. Actualizar GeoJSONs no editados ───────────────────────────────────────

console.log('── Actualizando GeoJSONs no editados ──\n');
let totalArchivos = 0;
let totalPuntos = 0;

for (const archivo of archivos) {
  const id = parseInt(archivo);
  if (EDITED_IDS.has(id)) continue;

  const filePath = join(GEOJSON_DIR, archivo);
  const geo = JSON.parse(readFileSync(filePath, 'utf8'));

  const lineFeature = geo.features.find(f => f.geometry?.type === 'LineString');
  const pts = geo.features.filter(
    f => f.geometry?.type === 'Point' && f.properties?.calle
  );

  if (pts.length === 0) {
    console.log(`  ${archivo}: sin puntos`);
    continue;
  }

  let cambios = 0;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const calle    = p.properties.calle;
    const prevCalle = pts[i - 1]?.properties?.calle ?? null;
    const nextCalle = pts[i + 1]?.properties?.calle ?? null;
    const [lonAct, latAct] = p.geometry.coordinates;

    // Punto medio entre vecinos (para desempates geométricos)
    let neighborMid = null;
    const prevPt = pts[i - 1];
    const nextPt = pts[i + 1];
    if (prevPt && nextPt) {
      neighborMid = {
        lon: (prevPt.geometry.coordinates[0] + nextPt.geometry.coordinates[0]) / 2,
        lat: (prevPt.geometry.coordinates[1] + nextPt.geometry.coordinates[1]) / 2,
      };
    }

    const canon = selectCanonical(calle, prevCalle, nextCalle, lonAct, latAct, neighborMid);
    if (!canon) continue;

    if (lonAct === canon.lon && latAct === canon.lat) continue;

    const d = Math.round(dist2d(lonAct, latAct, canon.lon, canon.lat));

    if (VERBOSE) {
      console.log(`    [${archivo}] ${calle}`);
      console.log(`      contexto: ${prevCalle ?? '-'} → ${calle} → ${nextCalle ?? '-'}`);
      console.log(`      fuente:   ${canon.src} (${canon.prev ?? '-'} → ${calle} → ${canon.next ?? '-'})`);
      console.log(`      cambio:   ${d}m`);
    }

    p.geometry.coordinates = [canon.lon, canon.lat];
    p.properties.osm = canon.osm;
    cambios++;
    totalPuntos++;
  }

  if (cambios === 0) {
    console.log(`  ${archivo}: sin cambios`);
    continue;
  }

  // Regenerar LineString con los puntos actualizados en el mismo orden
  if (lineFeature) {
    lineFeature.geometry.coordinates = pts.map(p => p.geometry.coordinates);
  }

  geo.features = lineFeature ? [lineFeature, ...pts] : pts;

  if (!DRY_RUN) {
    writeFileSync(filePath, JSON.stringify(geo, null, 2));
  }

  const marca = DRY_RUN ? ' (dry-run)' : '';
  console.log(`  ✓ ${archivo}: ${cambios} puntos actualizados${marca}`);
  totalArchivos++;
}

console.log(`\nTotal: ${totalArchivos} archivos, ${totalPuntos} puntos actualizados`);
if (DRY_RUN) console.log('(modo --dry-run: no se guardaron cambios)');
