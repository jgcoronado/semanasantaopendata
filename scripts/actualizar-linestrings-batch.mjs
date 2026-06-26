/**
 * actualizar-linestrings-batch.mjs
 *
 * Actualiza los LineStrings de los GeoJSONs NO editados manualmente usando el
 * índice de tramos canónicos (indice-tramos-canonicos.json).
 *
 * Para cada segmento reconocido en el índice → usa las coords canónicas.
 * Para segmentos no reconocidos → extrae el tramo del LineString OSRM existente
 * buscando los puntos más cercanos a los waypoints del tramo.
 *
 * USO:
 *   node scripts/actualizar-linestrings-batch.mjs          # actualiza todos
 *   node scripts/actualizar-linestrings-batch.mjs --dry-run  # solo informa
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const IDX_PATH   = join(__dir, 'indice-tramos-canonicos.json');
const GEOJSON_DIR = join(__dir, 'geojson-2025');

const DRY_RUN = process.argv.includes('--dry-run');

// IDs editados manualmente — fuentes de verdad, nunca modificar
const EDITADOS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16,
  17, 18, 19, 20, 21, 22, 24, 25, 30, 40, 47, 51, 52,
]);

const MAX_LEN = 8;

// Normaliza nombres de calle para búsqueda en el índice
// NOTA: no eliminar "(lado derecho)" — el índice lo mantiene en las claves
function normCalle(calle) {
  return calle.trim();
}

const idx  = JSON.parse(readFileSync(IDX_PATH, 'utf8'));
const segs = idx.segmentos;

function dist2(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

// AVISO: nearestIdx siempre busca desde el inicio del array.
// En rutas que pasan dos veces por la misma zona (ida+vuelta),
// el nearestIdx para waypoints de la vuelta puede devolver el índice
// de la ida, extrayendo el segmento OSRM en dirección errónea y creando loops.
// Por eso este script no debe usarse para hermdandades con Carrera Oficial
// sin revisar manualmente el resultado. Los IDs en EDITADOS quedan excluidos.
function nearestIdx(coords, target) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = dist2(coords[i], target);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function procesarGeoJSON(filePath) {
  const gj       = JSON.parse(readFileSync(filePath, 'utf8'));
  const features = gj.features;

  const lsFeature    = features.find(f => f.geometry.type === 'LineString');
  const pointFeatures = features.filter(f => f.geometry.type === 'Point');

  if (!lsFeature || pointFeatures.length < 2) return null;

  const existingCoords = lsFeature.geometry.coordinates;
  const rawCalles      = pointFeatures.map(f => f.properties.calle);
  const calles         = rawCalles.map(normCalle);
  const pointCoords    = pointFeatures.map(f => f.geometry.coordinates);

  // Índice en el LineString existente más cercano a cada Point
  const ptIdxInLS = pointCoords.map(pc => nearestIdx(existingCoords, pc));

  // Composición con ventanas decrecientes (algoritmo idéntico a componer-ruta.mjs)
  const tramosResult = [];
  let i = 0;
  while (i < calles.length - 1) {
    let found = false;
    for (let len = Math.min(MAX_LEN, calles.length - i); len >= 2; len--) {
      const clave = calles.slice(i, i + len).join('→');
      if (segs[clave]) {
        tramosResult.push({ tipo: 'canonico', clave, ...segs[clave], ptStart: i, ptEnd: i + len - 1 });
        i += len - 1;
        found = true;
        break;
      }
    }
    if (!found) {
      tramosResult.push({
        tipo: 'osrm',
        clave: rawCalles[i] + '→' + rawCalles[i + 1],
        ptStart: i,
        ptEnd: i + 1,
        lsStart: ptIdxInLS[i],
        lsEnd:   ptIdxInLS[i + 1],
      });
      i += 1;
    }
  }

  // Encadenar coords
  const result = [];
  let first = true;
  for (const t of tramosResult) {
    let coords;
    if (t.tipo === 'canonico') {
      coords = t.coords;
    } else {
      const s = t.lsStart, e = t.lsEnd;
      coords = s <= e
        ? existingCoords.slice(s, e + 1)
        : existingCoords.slice(e, s + 1).reverse();
      if (coords.length === 0) coords = [existingCoords[Math.max(s, e)] ?? existingCoords[0]];
    }
    if (first) {
      result.push(...coords);
      first = false;
    } else {
      result.push(...coords.slice(1));
    }
  }

  const nCanonico = tramosResult.filter(t => t.tipo === 'canonico').length;
  const nOsrm     = tramosResult.filter(t => t.tipo === 'osrm').length;

  return { gj, lsFeature, newCoords: result, tramosResult, nCanonico, nOsrm, rawCalles };
}

// ── Listar archivos no editados ───────────────────────────────────────────────

const files = readdirSync(GEOJSON_DIR)
  .filter(f => f.endsWith('.geojson'))
  .filter(f => {
    const m = f.match(/^(\d+)-/);
    return m && !EDITADOS.has(parseInt(m[1]));
  })
  .sort();

console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Procesando ${files.length} GeoJSONs no editados...\n`);

const resumen = [];

for (const file of files) {
  const filePath = join(GEOJSON_DIR, file);
  const result   = procesarGeoJSON(filePath);

  if (!result) {
    console.log(`⚠ ${file}: sin LineString o Points insuficientes`);
    continue;
  }

  const { gj, lsFeature, newCoords, nCanonico, nOsrm, tramosResult } = result;
  const total = nCanonico + nOsrm;
  const pct   = Math.round(100 * nCanonico / total);

  if (!DRY_RUN) {
    lsFeature.geometry.coordinates = newCoords;
    writeFileSync(filePath, JSON.stringify(gj, null, 2), 'utf8');
  }

  const icon = nOsrm === 0 ? '✓' : pct >= 70 ? '~' : '⚠';
  console.log(`${icon} ${file}: ${nCanonico}/${total} canónicos (${pct}%), ${newCoords.length} coords`);
  if (nOsrm > 0) {
    tramosResult.filter(t => t.tipo === 'osrm').forEach(t => console.log(`    ✗ ${t.clave}`));
  }

  resumen.push({ file, nCanonico, nOsrm, pct, nCoords: newCoords.length });
}

console.log('\n── Resumen ─────────────────────────────────────────────────────────────────');
console.log(`${DRY_RUN ? 'Simulados' : 'Actualizados'}: ${resumen.length} archivos`);
if (resumen.length > 0) {
  const mediaCobertura = Math.round(resumen.reduce((s, r) => s + r.pct, 0) / resumen.length);
  console.log(`Cobertura canónica media: ${mediaCobertura}%`);
  const perfectos = resumen.filter(r => r.nOsrm === 0).length;
  console.log(`100% canónicos: ${perfectos}/${resumen.length}`);
}
