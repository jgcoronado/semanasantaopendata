/**
 * exportar-segmentos-canonicos.mjs
 *
 * Lee los GeoJSONs editados manualmente y genera un fichero de referencia
 * con los tramos exactos del LineString entre calles consecutivas.
 *
 * Para cada par (calleA → calleB) en cada editado:
 *   - Encuentra el punto del LineString más cercano al Point de calleA (idx_inicio)
 *   - Encuentra el punto del LineString más cercano al Point de calleB (idx_fin)
 *   - Extrae lineString[idx_inicio..idx_fin] como coords del tramo
 *
 * Salida: scripts/segmentos-canonicos-2025.json
 *
 * Uso:
 *   node scripts/exportar-segmentos-canonicos.mjs
 *   node scripts/exportar-segmentos-canonicos.mjs --verbose
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = join(__dir, 'geojson-2025');
const OUT     = join(__dir, 'segmentos-canonicos-2025.json');
const VERBOSE = process.argv.includes('--verbose');

const EDITED_IDS = new Set([1, 2, 3, 5, 7, 8, 22, 30, 40]);

// ── Utilidades ────────────────────────────────────────────────────────────────

function dist2d([lon1, lat1], [lon2, lat2]) {
  const dlat = (lat1 - lat2) * 111320;
  const dlon = (lon1 - lon2) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlon * dlon);
}

/**
 * Mapea cada Point al índice del LineString más cercano, avanzando en orden.
 * El primer Point se busca solo en el 15% inicial para evitar saltos en rutas
 * circulares (la iglesia aparece al inicio y al final).
 */
function mapPointsToLine(pts, lineCoords) {
  const mapping  = [];
  let startFrom  = 0;
  const N        = lineCoords.length;
  const firstMax = Math.min(N, Math.max(5, Math.ceil(N * 0.15)));

  for (let j = 0; j < pts.length; j++) {
    const searchEnd = (j === 0) ? firstMax : N;
    let bestIdx  = startFrom;
    let bestDist = (startFrom < searchEnd)
      ? dist2d(lineCoords[startFrom], pts[j].coord)
      : Infinity;

    for (let i = startFrom + 1; i < searchEnd; i++) {
      const d = dist2d(lineCoords[i], pts[j].coord);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    mapping.push({ idx: bestIdx, distMetros: Math.round(bestDist) });
    startFrom = bestIdx;
  }
  return mapping;
}

// ── Procesar editados ─────────────────────────────────────────────────────────

const archivos = readdirSync(GEO_DIR).filter(f => f.endsWith('.geojson')).sort();
const segmentos = [];

for (const archivo of archivos) {
  const id = parseInt(archivo);
  if (!EDITED_IDS.has(id)) continue;

  const geo  = JSON.parse(readFileSync(join(GEO_DIR, archivo), 'utf8'));
  const line = geo.features.find(f => f.geometry?.type === 'LineString');
  const pts  = geo.features
    .filter(f => f.geometry?.type === 'Point' && f.properties?.calle)
    .map(f => ({
      calle: f.properties.calle,
      osm:   f.properties.osm ?? f.properties.calle,
      coord: f.geometry.coordinates,
    }));

  if (!line || pts.length < 2) {
    console.warn(`  ${archivo}: sin línea o puntos insuficientes — saltado`);
    continue;
  }

  const lineCoords = line.geometry.coordinates;
  const mapping    = mapPointsToLine(pts, lineCoords);
  const hermandad  = line.properties?.nombre ?? archivo.replace('.geojson', '');
  const dia        = line.properties?.dia ?? '';

  console.log(`\n${archivo} (${hermandad}, ${pts.length} pts, ${lineCoords.length} coords)`);

  for (let i = 0; i < pts.length - 1; i++) {
    const { idx: idxA, distMetros: dA } = mapping[i];
    const { idx: idxB, distMetros: dB } = mapping[i + 1];

    if (idxB <= idxA) {
      console.warn(`  ⚠ par ${i}: ${pts[i].calle} → ${pts[i+1].calle} → índices invertidos (${idxA}→${idxB}), saltado`);
      continue;
    }

    const coordsTramo = lineCoords.slice(idxA, idxB + 1);

    const seg = {
      fuente:    archivo.replace('.geojson', ''),
      hermandad,
      dia,
      desde:     pts[i].calle,
      hasta:     pts[i + 1].calle,
      desde_osm: pts[i].osm,
      hasta_osm: pts[i + 1].osm,
      // contexto para desambiguar si hay múltiples fuentes con el mismo par de calles
      calle_anterior: pts[i - 1]?.calle ?? null,
      calle_posterior: pts[i + 2]?.calle ?? null,
      // índices en el LineString fuente (para auditoría)
      idx_inicio: idxA,
      idx_fin:    idxB,
      // calidad del mapeo (distancia Point↔LineString en metros)
      dist_inicio_m: dA,
      dist_fin_m:    dB,
      // coords del tramo (inicio + intermedias + fin)
      n_coords:  coordsTramo.length,
      coords:    coordsTramo,
    };

    segmentos.push(seg);

    if (VERBOSE) {
      console.log(`  [${i}] ${pts[i].calle} → ${pts[i+1].calle}`);
      console.log(`       idx ${idxA}→${idxB}, ${coordsTramo.length} coords, mapeo ${dA}m/${dB}m`);
    } else {
      console.log(`  ${pts[i].calle} → ${pts[i+1].calle} (${coordsTramo.length} coords, ${dA}/${dB}m)`);
    }
  }
}

// ── Enriquecer segmentos con calidad y selección canónica ────────────────────

for (const s of segmentos) {
  const maxDist = Math.max(s.dist_inicio_m, s.dist_fin_m);
  if (maxDist <= 20)       s.calidad = 'buena';
  else if (maxDist <= 80)  s.calidad = 'regular';
  else                     s.calidad = 'mala';
}

// ── Estadísticas y agrupación de pares ───────────────────────────────────────

const parMap = {};   // par → lista de segmentos
for (const s of segmentos) {
  const k = `${s.desde}→${s.hasta}`;
  if (!parMap[k]) parMap[k] = [];
  parMap[k].push(s);
}

// Para cada par, elegir el segmento canónico preferido:
// 1. El de mejor calidad (buena > regular > mala)
// 2. En empate, el de menor max(distA, distB)
// 3. Si el par tiene fuentes con diferente n_coords, señalarlo como "revisar"
const ORDEN_CALIDAD = { buena: 0, regular: 1, mala: 2 };

const pares = Object.entries(parMap).map(([par, segs]) => {
  segs.sort((a, b) =>
    (ORDEN_CALIDAD[a.calidad] - ORDEN_CALIDAD[b.calidad]) ||
    (Math.max(a.dist_inicio_m, a.dist_fin_m) - Math.max(b.dist_inicio_m, b.dist_fin_m))
  );
  const mejor = segs[0];
  const conflicto = segs.length > 1 && new Set(segs.map(s => s.n_coords)).size > 1;
  return {
    par,
    n_fuentes: segs.length,
    fuente_preferida: mejor.fuente,
    calidad: mejor.calidad,
    conflicto_n_coords: conflicto,
    fuentes: segs.map(s => ({
      fuente: s.fuente,
      n_coords: s.n_coords,
      calidad: s.calidad,
      dist_inicio_m: s.dist_inicio_m,
      dist_fin_m: s.dist_fin_m,
    })),
  };
});

const buenos    = segmentos.filter(s => s.calidad === 'buena').length;
const regulares = segmentos.filter(s => s.calidad === 'regular').length;
const malos     = segmentos.filter(s => s.calidad === 'mala').length;
const conflictos = pares.filter(p => p.conflicto_n_coords).length;

// ── Guardar ───────────────────────────────────────────────────────────────────

const salida = {
  generado: new Date().toISOString().split('T')[0],
  nota: 'Tramos canónicos extraídos de los GeoJSONs editados manualmente. NO modificar directamente — editar el GeoJSON fuente y regenerar.',
  fuentes_editadas: [...EDITED_IDS].sort((a, b) => a - b),
  resumen: {
    total_segmentos: segmentos.length,
    pares_unicos: pares.length,
    calidad_buena: buenos,
    calidad_regular: regulares,
    calidad_mala: malos,
    pares_con_conflicto_n_coords: conflictos,
  },
  // Índice de pares: qué fuente usar y si hay conflicto entre fuentes
  pares,
  // Todos los segmentos con su calidad
  segmentos,
};

writeFileSync(OUT, JSON.stringify(salida, null, 2));

console.log(`\n── Resumen ──`);
console.log(`Segmentos extraídos:  ${segmentos.length}  (buena: ${buenos}, regular: ${regulares}, mala: ${malos})`);
console.log(`Pares únicos:         ${pares.length}`);
console.log(`Pares con conflicto:  ${conflictos}`);
if (conflictos > 0) {
  pares.filter(p => p.conflicto_n_coords).forEach(p =>
    console.log(`  conflicto: ${p.par} (${p.fuentes.map(f => f.fuente + ':' + f.n_coords + 'c').join(', ')})`)
  );
}
console.log(`\nGuardado: ${OUT}`);
