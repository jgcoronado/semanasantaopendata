/**
 * generar-indice-tramos.mjs
 *
 * Genera scripts/indice-tramos-canonicos.json a partir de los GeoJSONs
 * editados manualmente.
 *
 * Para cada archivo editado extrae TODOS los sub-segmentos de longitud
 * 2..MAX_LEN calles consecutivas (ventana deslizante sobre los Points)
 * con sus coordenadas del LineString.
 *
 * El índice resultante permite componer LineStrings de nuevos GeoJSONs:
 *   - Dado un recorrido como lista de calles, busca el fragmento más largo
 *     que esté en el índice y encadena las coords.
 *   - Deduplicación: si el mismo par/tramo aparece en varios editados,
 *     se guarda el de mejor calidad (menor distancia punto↔línea).
 *
 * Uso:
 *   node scripts/generar-indice-tramos.mjs
 *   node scripts/generar-indice-tramos.mjs --verbose
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const GEO_DIR = join(__dir, '..', 'public', 'geojson', '2025');
const OUT     = join(__dir, 'indice-tramos-canonicos.json');
const VERBOSE = process.argv.includes('--verbose');
const MAX_LEN    = 8;    // máx. nº de calles por segmento almacenado
const MAX_DIST_M = 300;  // distancia máxima coord↔punto para aceptar un segmento

// Todos los GeoJSONs de 2025 están corregidos y verificados manualmente (jun 2026)
const EDITED_IDS = new Set([
   1,  2,  3,  4,  5,  6,  7,  8,  9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
  51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61,
]);

// ── Utilidades ────────────────────────────────────────────────────────────────

function dist2d([lon1, lat1], [lon2, lat2]) {
  const dlat = (lat1 - lat2) * 111320;
  const dlon = (lon1 - lon2) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlon * dlon);
}

function mapPointsToLine(pts, lineCoords) {
  const mapping = [];
  let startFrom = 0;
  const N       = lineCoords.length;
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
    mapping.push({ idx: bestIdx, dist: Math.round(bestDist) });
    startFrom = bestIdx;
  }
  return mapping;
}

function calidad(maxDist) {
  if (maxDist <= 20) return 'buena';
  if (maxDist <= 80) return 'regular';
  return 'mala';
}

const ORDEN_CALIDAD = { buena: 0, regular: 1, mala: 2 };

// ── Índice principal ──────────────────────────────────────────────────────────
// clave → { fuente, calidad, maxDist, coords }
const indice = {};
const callesTodas = new Set();

// ── Procesar editados ─────────────────────────────────────────────────────────

const archivos = readdirSync(GEO_DIR).filter(f => f.endsWith('.geojson')).sort();

for (const archivo of archivos) {
  const id = parseInt(archivo);
  if (!EDITED_IDS.has(id)) continue;

  const geo  = JSON.parse(readFileSync(join(GEO_DIR, archivo), 'utf8'));
  const line = geo.features.find(f => f.geometry?.type === 'LineString');
  const pts  = geo.features
    .filter(f => f.geometry?.type === 'Point' && f.properties?.calle)
    .map(f => ({ calle: f.properties.calle, coord: f.geometry.coordinates }));

  if (!line || pts.length < 2) continue;

  const lineCoords = line.geometry.coordinates;
  const mapping    = mapPointsToLine(pts, lineCoords);
  const fuente     = archivo.replace('.geojson', '');

  pts.forEach(p => callesTodas.add(p.calle));

  if (VERBOSE) console.log(`\n${archivo} (${pts.length} pts, ${lineCoords.length} coords)`);

  // Ventana deslizante: longitudes 2..MAX_LEN
  for (let len = 2; len <= Math.min(MAX_LEN, pts.length); len++) {
    for (let i = 0; i <= pts.length - len; i++) {
      const window  = pts.slice(i, i + len);
      const idxA    = mapping[i].idx;
      const idxB    = mapping[i + len - 1].idx;

      if (idxB <= idxA) continue;  // orden inválido

      const coords = lineCoords.slice(idxA, idxB + 1);
      const dists  = window.map((_, j) => mapping[i + j].dist);
      const maxD   = Math.max(...dists);
      const qual   = calidad(maxD);
      const clave  = window.map(p => p.calle).join('→');

      const existing = indice[clave];
      if (maxD > MAX_DIST_M) continue;  // mapeo roto (ruta circular / punto fuera)

      const esBetter = !existing
        || ORDEN_CALIDAD[qual] < ORDEN_CALIDAD[existing.calidad]
        || (qual === existing.calidad && maxD < existing.maxDist);

      if (esBetter) {
        indice[clave] = { fuente, calidad: qual, maxDist: maxD, n_coords: coords.length, coords };
        if (VERBOSE && len <= 3) console.log(`  [len${len}] ${clave} (${coords.length}c, ${maxD}m)`);
      }
    }
  }
}

// ── Segmentos nombrados: pre-construidos desde fuentes fiables ────────────────
// Cada entrada define un bloque canónico largo; se construye extrayendo el tramo
// entre dos Points conocidos del archivo fuente.

function extractTramoBetweenPoints(archivo, calleDesde, calleHasta) {
  const geo = JSON.parse(readFileSync(join(GEO_DIR, archivo), 'utf8'));
  const ls  = geo.features.find(f => f.geometry?.type === 'LineString');
  const pts = geo.features.filter(f => f.geometry?.type === 'Point' && f.properties?.calle);
  if (!ls || pts.length < 2) return null;
  const coords = ls.geometry.coordinates;

  const ptDesde = pts.find(p => p.properties.calle === calleDesde);
  const ptHasta = pts.find(p => p.properties.calle === calleHasta);
  if (!ptDesde || !ptHasta) return null;

  function cercanoDesde(coord) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = dist2d(coords[i], coord);
      if (d < bd) { bd = d; best = i; }
    }
    return { idx: best, dist: Math.round(bd) };
  }

  const { idx: idxA, dist: dA } = cercanoDesde(ptDesde.geometry.coordinates);
  // Para el punto final, buscamos SÓLO en coords > idxA
  let idxB = idxA, dB = Infinity;
  for (let i = idxA + 1; i < coords.length; i++) {
    const d = dist2d(coords[i], ptHasta.geometry.coordinates);
    if (d < dB) { dB = d; idxB = i; }
  }
  if (idxB <= idxA || dA > 50 || dB > 50) return null;

  return {
    fuente: archivo.replace('.geojson', ''),
    calidad: 'buena',
    maxDist: Math.max(dA, dB),
    n_coords: idxB - idxA + 1,
    coords: coords.slice(idxA, idxB + 1),
  };
}

const NOMBRADOS_DEF = [
  // id                          archivo                      desde                                    hasta
  ['co-campana-constitucion',    '06-san-roque.geojson',      'La Campana',                            'Avenida de la Constitución'],
  ['co-constitucion-camigo',     '06-san-roque.geojson',      'Avenida de la Constitución',             'Calle Cardenal Carlos Amigo'],
  ['co-campana-camigo',          '06-san-roque.geojson',      'La Campana',                            'Calle Cardenal Carlos Amigo'],
  ['co-vuelta-sur-puerta-jerez', '25-los-estudiantes.geojson','La Campana',                            'Plaza Puerta de Jerez'],
  ['larana-campana-via-duque',   '06-san-roque.geojson',      'Calle Laraña',                          'La Campana'],
  ['campana-via-odonnell',       '12-santa-genoveva.geojson', 'Calle O\'Donnell',                      'La Campana'],
  ['vuelta-arenal-arfe-jacinto', '07-la-estrella.geojson',    'Calle Arfe',                            'Calle San Jacinto'],
  ['co-campana-arfe',            '07-la-estrella.geojson',    'La Campana',                            'Calle Arfe'],
  ['camigo-francos',             '01-la-borriquita.geojson',  'Calle Cardenal Carlos Amigo',           'Calle Francos'],
  ['francos-orfila-daoiz',       '13-santa-marta.geojson',    'Calle Francos',                         'Calle Daoiz'],
  ['triunfo-puerta-jerez',       '05-la-paz.geojson',         'Plaza del Triunfo',                     'Plaza Puerta de Jerez'],
  ['constitucion-triunfo',       '19-el-cerro.geojson',       'Avenida de la Constitución',             'Plaza del Triunfo'],
  ['puerta-jerez-roma',          '05-la-paz.geojson',         'Plaza Puerta de Jerez',                 'Avenida de Roma'],
  ['campana-co-jacinto',         '14-san-gonzalo.geojson',    'La Campana',                            'Calle San Jacinto'],
  ['encarnacion-campana',        '06-san-roque.geojson',      'Plaza de la Encarnación',               'La Campana'],
  ['amor-dios-campana-gran-poder','02-la-cena.geojson',       'Calle Amor de Dios',                    'La Campana'],
];

// Resolver extractTramoBetweenPoints para la-paz especialmente (Points fuera de orden)
// Para la-paz usamos directamente el tramo que ya calculamos antes (coord 75-113)
function extractLaPazTriunfoJerez() {
  const geo = JSON.parse(readFileSync(join(GEO_DIR, '05-la-paz.geojson'), 'utf8'));
  const ls  = geo.features.find(f => f.geometry?.type === 'LineString');
  const pts = geo.features.filter(f => f.geometry?.type === 'Point');
  const coords = ls.geometry.coordinates;
  // Campana: punto 27; Puerta de Jerez vuelta: punto 32
  function cercano(coord, lista) {
    let best = 0, bd = Infinity;
    lista.forEach((c, i) => { const d = dist2d(c, coord); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  const iCamp  = cercano(pts[27].geometry.coordinates, coords);
  const iJerez = cercano(pts[32].geometry.coordinates, coords);
  if (iJerez <= iCamp) return null;
  return {
    fuente: '05-la-paz',
    calidad: 'buena',
    maxDist: 5,
    n_coords: iJerez - iCamp + 1,
    coords: coords.slice(iCamp, iJerez + 1),
  };
}

const nombrados = {};
for (const [id, archivo, desde, hasta] of NOMBRADOS_DEF) {
  const seg = extractTramoBetweenPoints(archivo, desde, hasta);
  if (seg) {
    nombrados[id] = { calles_extremo: [desde, hasta], ...seg };
    console.log(`  [nombrado] ${id} → ${seg.n_coords}c [${seg.fuente}] ${seg.calidad} (${seg.maxDist}m)`);
  } else {
    console.warn(`  [nombrado] ⚠ ${id} — no encontrado en ${archivo}`);
  }
}
// Añadir la-paz manualmente (ruta circular — mapPointsToLine no funciona)
const pazSeg = extractLaPazTriunfoJerez();
if (pazSeg) {
  nombrados['co-vuelta-sur-puerta-jerez'] = { calles_extremo: ['La Campana', 'Plaza Puerta de Jerez'], ...pazSeg };
  console.log(`  [nombrado] co-vuelta-sur-puerta-jerez → ${pazSeg.n_coords}c [05-la-paz] buena (corregido)`);

  // Split la-paz en sub-tramos para poder encadenar desde Plaza del Triunfo
  const pazCoords = JSON.parse(readFileSync(join(GEO_DIR, '05-la-paz.geojson'), 'utf8'))
    .features.find(f => f.geometry?.type === 'LineString').geometry.coordinates;
  const pazPts = JSON.parse(readFileSync(join(GEO_DIR, '05-la-paz.geojson'), 'utf8'))
    .features.filter(f => f.geometry?.type === 'Point');
  function cercanoDespues(coord, lista, start) {
    let best = start, bd = Infinity;
    for (let i = start + 1; i < lista.length; i++) {
      const d = dist2d(lista[i], coord);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  const iCamp    = pazCoords.findIndex((c, i) =>
    i > 60 && dist2d(c, pazPts[27].geometry.coordinates) < 5
  );
  if (iCamp >= 0) {
    const iTriunfo = cercanoDespues(pazPts[28].geometry.coordinates, pazCoords, iCamp);
    const iJerez   = cercanoDespues(pazPts[32].geometry.coordinates, pazCoords, iTriunfo);
    if (iTriunfo > iCamp) {
      nombrados['co-campana-triunfo'] = {
        calles_extremo: ['La Campana', 'Plaza del Triunfo'],
        fuente: '05-la-paz', calidad: 'buena', maxDist: 4,
        n_coords: iTriunfo - iCamp + 1,
        coords: pazCoords.slice(iCamp, iTriunfo + 1),
      };
      console.log(`  [nombrado] co-campana-triunfo → ${iTriunfo - iCamp + 1}c [05-la-paz] buena`);
    }
  }
}

// ── Inyectar nombrados en el índice de segmentos (por clave de extremos) ─────
// Permite que componer-ruta los encuentre automáticamente.
for (const [id, seg] of Object.entries(nombrados)) {
  const clave = seg.calles_extremo.join('→');
  const existing = indice[clave];
  const esBetter = !existing
    || ORDEN_CALIDAD[seg.calidad] < ORDEN_CALIDAD[existing.calidad]
    || (seg.calidad === existing.calidad && seg.maxDist < existing.maxDist);
  if (esBetter) {
    indice[clave] = { fuente: seg.fuente, calidad: seg.calidad, maxDist: seg.maxDist, n_coords: seg.n_coords, coords: seg.coords };
    if (VERBOSE) console.log(`  [nombrado→seg] ${clave} (${seg.n_coords}c)`);
  }
}

// ── Estadísticas ──────────────────────────────────────────────────────────────

const nPares    = Object.keys(indice).filter(k => k.split('→').length === 2).length;
const nTriples  = Object.keys(indice).filter(k => k.split('→').length === 3).length;
const nLargos   = Object.keys(indice).filter(k => k.split('→').length > 3).length;
const callesSorted = [...callesTodas].sort();

const buenas    = Object.values(indice).filter(v => v.calidad === 'buena').length;
const regulares = Object.values(indice).filter(v => v.calidad === 'regular').length;
const malas     = Object.values(indice).filter(v => v.calidad === 'mala').length;

// ── Guardar ───────────────────────────────────────────────────────────────────

const salida = {
  generado: new Date().toISOString().split('T')[0],
  nota_uso: [
    'SEGMENTOS: índice de tramos por ventana de 2-8 calles consecutivas.',
    'Clave: "CalleA→CalleB→CalleC" → { fuente, calidad, coords }.',
    'Para componer un LineString:',
    '  1. Busca el prefijo más largo de tu lista de calles que exista en "segmentos".',
    '  2. Usa esas coords; avanza en la lista al último elem. del prefijo.',
    '  3. Repite. Al encadenar: elimina el primer coord de cada tramo (duplicado del anterior).',
    'O usa el script: node scripts/componer-ruta.mjs "CalleA" "CalleB" ...',
    '',
    'NOMBRADOS: bloques largos pre-construidos; úsalos cuando necesites el',
    'tramo completo de extremo a extremo (CO, vuelta sur, etc.).',
  ].join('\n'),
  fuentes_editadas: [...EDITED_IDS].sort((a, b) => a - b),
  resumen: {
    total_segmentos: Object.keys(indice).length,
    pares: nPares,
    triples: nTriples,
    largos_4_a_8: nLargos,
    calidad_buena: buenas,
    calidad_regular: regulares,
    calidad_mala: malas,
    calles_conocidas: callesSorted.length,
  },
  calles_conocidas: callesSorted,
  nombrados,
  segmentos: indice,
};

writeFileSync(OUT, JSON.stringify(salida, null, 2));

console.log(`\n── Resumen ──`);
console.log(`Editados procesados: ${EDITED_IDS.size}`);
console.log(`Segmentos totales:   ${Object.keys(indice).length}  (pares: ${nPares}, triples: ${nTriples}, 4-8 calles: ${nLargos})`);
console.log(`Calidad:             buena: ${buenas}, regular: ${regulares}, mala: ${malas}`);
console.log(`Segmentos nombrados: ${Object.keys(nombrados).length}`);
console.log(`Calles conocidas:    ${callesSorted.length}`);
console.log(`\nGuardado: ${OUT}`);
