/**
 * rehacer-martes-miercoles.mjs
 *
 * Rehace DESDE CERO los GeoJSON de las hermandades NO editadas manualmente de
 * Martes Santo y Miércoles Santo, a partir del itinerario oficial (Nómina 2025)
 * y de los fragmentos de recorrido ya verificados (indice-tramos-canonicos.json,
 * extraído de los GeoJSON editados a mano).
 *
 * Para cada hermandad:
 *   1. Points = itinerario oficial completo (una calle por entrada, en orden,
 *      respetando los pasos repetidos exactos de la Nómina). El "sentido importa":
 *      el orden es el de la Nómina (ida → Carrera Oficial → vuelta).
 *   2. Coords de cada Point: se reutiliza la coord curada del fichero actual
 *      (consumiendo por orden de aparición, para preservar tramos norte/sur);
 *      si falta, registro global de todos los ficheros; si falta, índice; si
 *      falta, fichero original (OSRM); si no, se omite y se reporta.
 *   3. LineString = fragmentos canónicos del índice encadenados en el orden del
 *      itinerario (ventanas de 2-8 calles). Tramos de barrio sin cobertura →
 *      se extraen del LineString OSRM original (commit 6d4b56c) con cursor
 *      monotónico (evita los bucles ida/vuelta de actualizar-linestrings-batch).
 *
 * USO:
 *   node scripts/rehacer-martes-miercoles.mjs --dry-run   # informe, no escribe
 *   node scripts/rehacer-martes-miercoles.mjs             # escribe los GeoJSON
 *
 * El fichero original OSRM debe estar volcado en ORIG_DIR (uno por hermandad).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const IDX_PATH    = join(__dir, 'indice-tramos-canonicos.json');
const GEOJSON_DIR = join(__dir, 'geojson-2025');
// Origen del trazado OSRM original (para tramos de barrio): por defecto se lee
// del commit ORIG_REF; si se define ORIG_DIR, se lee de ese volcado; si todo
// falla, se usa el LineString del propio fichero actual.
const ORIG_DIR = process.env.ORIG_DIR || null;
const ORIG_REF = process.env.ORIG_REF || '6d4b56c';

// Devuelve el GeoJSON original (pre-correcciones) de una hermandad, o null.
function leerOriginal(file) {
  if (ORIG_DIR && existsSync(join(ORIG_DIR, file))) {
    return JSON.parse(readFileSync(join(ORIG_DIR, file), 'utf8'));
  }
  try {
    const txt = execFileSync('git', ['show', `${ORIG_REF}:scripts/geojson-2025/${file}`],
      { cwd: __dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(txt);
  } catch { return null; }
}

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const MAX_LEN = 8;

// ── Itinerarios oficiales (Nómina 2025) ───────────────────────────────────────
// La Carrera Oficial se expande siempre a: La Campana, Sierpes, San Francisco,
// Avenida de la Constitución (todas las hermandades la recorren en ese sentido).

const ITINERARIOS = {
  // ─── MARTES SANTO ───────────────────────────────────────────────────────────
  '23-dulce-nombre': [
    'Plaza de San Lorenzo', 'Calle Cardenal Spínola', 'Plaza de la Gavidia',
    'Plaza de La Concordia', 'Calle Las Cortes', 'Calle Jesús del Gran Poder',
    'Plaza del Duque de la Victoria',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Calle Chapineros',
    'Calle Álvarez Quintero', 'Plaza del Salvador', 'Calle Cuna', 'Calle Orfila',
    'Calle Daoiz', 'Calle García Tassara', 'Calle Amor de Dios', 'Calle San Miguel',
    'Calle Jesús del Gran Poder', 'Calle Conde de Barajas', 'Plaza de San Lorenzo',
  ],
  '26-santa-cruz': [
    'Calle Mateos Gago', 'Calle Rodrigo Caro', 'Plaza de La Alianza',
    'Calle Joaquín Romero Murube', 'Plaza del Triunfo', 'Calle Santo Tomás',
    'Calle Santander', 'Calle Tomás de Ibarra', 'Calle Almirantazgo',
    'Calle Arco del Postigo', 'Calle Dos de Mayo', 'Calle Arfe', 'Calle Puerta del Arenal',
    'Calle Castelar', 'Calle Gamazo', 'Calle Joaquín Guichot', 'Calle Barcelona',
    'Plaza Nueva', 'Calle Tetuán', 'Calle Velázquez', "Calle O'Donnell",
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Plaza del Triunfo', 'Calle Joaquín Romero Murube', 'Plaza de La Alianza',
    'Calle Rodrigo Caro', 'Calle Mateos Gago',
  ],
  // ─── MIÉRCOLES SANTO ─────────────────────────────────────────────────────────
  '27-el-carmen-doloroso': [
    'Calle Feria', 'Calle Peris Mencheta', 'Calle Mata', 'Calle Belén',
    'Alameda de Hércules', 'Calle Trajano', 'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Calle Chapineros',
    'Calle Álvarez Quintero', 'Plaza del Salvador', 'Calle Córdoba', 'Calle Lineros',
    'Calle Puente y Pellón', 'Plaza de la Encarnación', 'Calle Alcázares',
    'Calle Santa Ángela de la Cruz', 'Calle San Juan de la Palma',
    'Calle Madre María Purísima de la Cruz', 'Calle Feria', 'Calle Guadiana',
    'Calle Peris Mencheta', 'Calle Feria',
  ],
  '28-el-buen-fin': [
    'Calle San Vicente', 'Plaza de San Antonio de Padua', 'Calle Marqués de la Mina',
    'Calle Alcoy', 'Calle Eslava', 'Plaza de San Lorenzo', 'Calle Conde de Barajas',
    'Calle Jesús del Gran Poder', 'Plaza del Duque de la Victoria',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Plaza del Triunfo', 'Calle Fray Ceferino González', 'Calle Almirantazgo',
    'Calle Arco del Postigo', 'Calle Dos de Mayo', 'Calle Arfe', 'Calle Puerta del Arenal',
    'Calle Castelar', 'Plaza de Molviedro', 'Calle Doña Guiomar', 'Calle Zaragoza',
    'Calle Gravina', 'Calle Pedro del Toro', 'Calle Bailén', 'Calle Miguel de Carvajal',
    'Plaza del Museo', 'Calle San Vicente',
  ],
  '29-la-sed': [
    'Calle Cristo de la Sed', 'Calle Cardenal Lluch', 'Avenida de Eduardo Dato',
    'Calle Hospital de San Juan de Dios', 'Avenida de Eduardo Dato', 'Calle Jiménez Aranda',
    'Calle Luis Montoto', 'Calle Puerta de Carmona', 'Calle Muro de los Navarros',
    'Calle Santiago', 'Calle Juan de Mesa', 'Calle Almirante Apodaca', 'Plaza de San Pedro',
    'Calle Imagen', 'Plaza de la Encarnación', 'Calle Laraña', 'Calle Orfila',
    'Calle Javier Lasso de la Vega', 'Calle Trajano', 'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Cuesta del Rosario',
    'Calle Jesús de las Tres Caídas', 'Calle Alfalfa', 'Calle Águilas', 'Plaza de Pilatos',
    'Calle San Esteban', 'Calle Puerta de Carmona', 'Calle Luis Montoto',
    'Calle José Luis de Casso', 'Calle Rico Cejudo', 'Calle Goya', 'Calle Cristo de la Sed',
  ],
  '31-la-lanzada': [
    'Plaza de San Martín', 'Calle Saavedras', 'Calle Alberto Lista', 'Calle Conde de Torrejón',
    'Calle Marco Sancho', 'Calle Correduría', 'Calle Amor de Dios', 'Alameda de Hércules',
    'Calle Trajano', 'Calle Santa Bárbara', 'Calle Jesús del Gran Poder',
    'Plaza del Duque de la Victoria',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Calle Chapineros',
    'Calle Álvarez Quintero', 'Plaza del Salvador', 'Calle Cuna', 'Calle Orfila',
    'Plaza Fernando de Herrera', 'Calle Daoiz', 'Calle San Andrés', 'Calle Cervantes',
    'Plaza de San Martín',
  ],
  '32-el-baratillo': [
    'Calle Adriano', 'Calle Pastor y Landero', 'Calle Reyes Católicos', 'Calle Puerta de Triana',
    'Calle San Pablo', 'Plaza de la Magdalena', 'Calle Méndez Núñez', 'Plaza Nueva',
    'Calle Tetuán', 'Calle Velázquez', "Calle O'Donnell",
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Plaza del Triunfo', 'Calle Santo Tomás', 'Calle Adolfo Rodríguez Jurado',
    'Plaza Ministro Indalecio Prieto', 'Calle Tomás de Ibarra', 'Calle Almirantazgo',
    'Calle Arco del Postigo', 'Calle Dos de Mayo', 'Calle Arfe', 'Calle Adriano',
  ],
  '33-los-panaderos': [
    'Calle Orfila', 'Plaza Fernando de Herrera', 'Calle Daoiz', 'Calle García Tassara',
    'Calle Amor de Dios', 'Calle San Miguel', 'Calle Trajano',
    'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Calle Chapineros',
    'Calle Álvarez Quintero', 'Plaza del Salvador', 'Calle Cuna', 'Calle Orfila',
  ],
  '34-cristo-de-burgos': [
    'Plaza de San Pedro', 'Calle Imagen', 'Plaza de la Encarnación', 'Calle Laraña',
    'Calle Orfila', 'Calle Javier Lasso de la Vega', 'Calle Trajano',
    'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Plaza de Jesús de la Pasión',
    'Calle Alcaicería de la Loza', 'Plaza de La Alfalfa', 'Calle San Juan', 'Calle Boteros',
    'Calle Sales y Ferré', 'Plaza del Cristo de Burgos', 'Plaza de San Pedro',
  ],
  '35-siete-palabras': [
    'Calle Cardenal Cisneros', 'Calle Jesús de la Vera-Cruz', 'Calle Baños',
    'Plaza de la Gavidia', 'Plaza de La Concordia', 'Calle Las Cortes',
    'Calle Jesús del Gran Poder', 'Plaza del Duque de la Victoria',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Hernando Colón',
    'Plaza de San Francisco', 'Plaza Nueva', 'Calle Tetuán', 'Calle Velázquez', "Calle O'Donnell",
    'La Campana', 'Plaza del Duque de la Victoria', 'Calle Alfonso XII',
    'Calle Santa Vicenta María', 'Calle Virgen de los Buenos Libros', 'Calle Cardenal Cisneros',
  ],
};

// ── Carga del índice y registros de coords ────────────────────────────────────

const idx  = JSON.parse(readFileSync(IDX_PATH, 'utf8'));
const segs = idx.segmentos;

// ── Fragmentos curados: cadenas verificadas que el índice no extrae solo ───────
// (sus rutas fuente son circulares y mapPointsToLine las rechaza). Se extraen
// directamente del fichero editado fuente, entre Points consecutivos, con
// búsqueda hacia delante. Se inyectan en el índice (todas sus sub-ventanas)
// para que el emparejador por ventana las use con prioridad de calidad 'buena'.
const CURADOS_DEF = [
  // salida/vuelta por Plaza del Triunfo hacia Fray Ceferino y el Arenal (grupo B)
  ['14-san-gonzalo', ['Avenida de la Constitución', 'Plaza del Triunfo', 'Calle Fray Ceferino González',
    'Calle Almirantazgo', 'Calle Arco del Postigo', 'Calle Dos de Mayo', 'Calle Arfe']],
  // salida inversa por Plaza del Triunfo hacia Santo Tomás → Arenal (Santa Cruz, Baratillo)
  ['03-jesus-despojado', ['Avenida de la Constitución', 'Plaza del Triunfo', 'Calle Santo Tomás',
    'Calle Adolfo Rodríguez Jurado', 'Plaza Ministro Indalecio Prieto', 'Calle Tomás de Ibarra', 'Calle Almirantazgo']],
  ['03-jesus-despojado', ['Calle Puerta del Arenal', 'Calle Castelar', 'Calle Gamazo']],
  // Arenal → Campana por el oeste (Santa Cruz): Gamazo → Plaza Nueva → Tetuán → O'Donnell
  ['05-la-paz', ['Calle Gamazo', 'Calle Joaquín Guichot', 'Calle Barcelona', 'Plaza Nueva',
    'Calle Tetuán', 'Calle Velázquez', "Calle O'Donnell"]],
  // vuelta por el Arenal hacia el Museo (Buen Fin): Castelar → Molviedro → Zaragoza → Museo
  ['18-el-museo', ['Calle Puerta del Arenal', 'Calle Castelar', 'Plaza de Molviedro',
    'Calle Doña Guiomar', 'Calle Zaragoza', 'Calle Gravina', 'Calle Pedro del Toro',
    'Calle Bailén', 'Calle Miguel de Carvajal', 'Plaza del Museo']],
];

function extraerCadena(sourceFile, cadena) {
  const gj = JSON.parse(readFileSync(join(GEOJSON_DIR, sourceFile + '.geojson'), 'utf8'));
  const ls = gj.features.find(f => f.geometry.type === 'LineString').geometry.coordinates;
  const ptByName = {};
  for (const f of gj.features) if (f.geometry.type === 'Point') (ptByName[f.properties.calle] ||= []).push(f.geometry.coordinates);

  // índice en la LineString de cada calle de la cadena (búsqueda monotónica hacia delante)
  const idxs = [];
  let cursor = 0;
  for (const calle of cadena) {
    const target = ptByName[calle]?.[0];
    if (!target) return [];
    let best = cursor, bd = Infinity;
    for (let i = cursor; i < ls.length; i++) { const d = distM(ls[i], target); if (d < bd) { bd = d; best = i; } }
    if (bd > 45) return [];   // mapeo dudoso → descartar cadena entera
    idxs.push(best); cursor = best;
  }
  // generar todas las sub-ventanas (longitud 2..N)
  const out = [];
  for (let a = 0; a < cadena.length; a++) {
    for (let b = a + 1; b < cadena.length; b++) {
      const ia = idxs[a], ib = idxs[b];
      if (ib <= ia) continue;
      out.push({ clave: cadena.slice(a, b + 1).join('→'),
                 coords: ls.slice(ia, ib + 1), fuente: sourceFile });
    }
  }
  return out;
}

// Inyectar fragmentos curados (prioridad: sobrescriben al índice auto-extraído)
let nCurados = 0;
for (const [src, cadena] of CURADOS_DEF) {
  for (const frag of extraerCadena(src, cadena)) {
    segs[frag.clave] = { fuente: frag.fuente, calidad: 'buena', n_coords: frag.coords.length, coords: frag.coords };
    nCurados++;
  }
}

// Registro de coords por nombre de calle a partir de los extremos del índice
const idxReg = {};
for (const k of Object.keys(segs)) {
  const parts = k.split('→');
  const c = segs[k].coords;
  if (!c || c.length < 2) continue;
  const first = parts[0], last = parts[parts.length - 1];
  if (!idxReg[first]) idxReg[first] = c[0];
  idxReg[last] = c[c.length - 1];   // el extremo final es más fiable
}

// Registro global de coords (primera aparición) escaneando todos los GeoJSON actuales
const globalReg = {};
for (const f of readdirSync(GEOJSON_DIR).filter(f => f.endsWith('.geojson'))) {
  const gj = JSON.parse(readFileSync(join(GEOJSON_DIR, f), 'utf8'));
  for (const ft of gj.features) {
    if (ft.geometry.type !== 'Point') continue;
    const n = ft.properties.calle;
    if (!globalReg[n]) globalReg[n] = ft.geometry.coordinates;
  }
}

function dist2(a, b) { const dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; }

function distM([lon1, lat1], [lon2, lat2]) {
  const dlat = (lat1 - lat2) * 111320;
  const dlon = (lon1 - lon2) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.hypot(dlat, dlon);
}

// Detecta fragmentos del índice que trazan un bucle (artefacto de rutas
// circulares, p.ej. "Constitución→Plaza del Triunfo" 59c de El Cerro): la
// longitud recorrida es muy superior a la distancia en línea recta entre
// extremos. Verdaderos tramos sinuosos (Amor de Dios→Campana) quedan por debajo.
function esBucle(coords) {
  if (coords.length < 3) return false;
  let pathLen = 0;
  for (let i = 1; i < coords.length; i++) pathLen += distM(coords[i - 1], coords[i]);
  const straight = distM(coords[0], coords[coords.length - 1]);
  return pathLen > 250 && pathLen > straight * 3.2;
}

function nearestIdx(coords, target) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = dist2(coords[i], target);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Interior OSRM entre dos Points de barrio A→B. Localiza A y B sobre la línea
// OSRM original usando las coords de localización (los Points del fichero
// original, que SÍ están sobre la línea), sin forzar monotonía → admite tramos
// de vuelta. Devuelve sólo los coords intermedios SI forman un trazado limpio
// (sin saltos internos grandes, sin rodeo absurdo). Si no, null → recta.
function interiorOsrm(origCoords, locA, locB, A, B) {
  if (!origCoords || origCoords.length < 2) return null;
  const s = nearestIdx(origCoords, locA);
  const e = nearestIdx(origCoords, locB);
  if (s === e) return null;
  const lo = Math.min(s, e), hi = Math.max(s, e);
  let seg = origCoords.slice(lo, hi + 1);
  if (s > e) seg = seg.reverse();               // orientar de A hacia B
  const interior = seg.slice(1, -1);            // sólo intermedios
  // validación: sin saltos internos grandes en [A, ...interior, B]
  const full = [A, ...interior, B];
  for (let i = 1; i < full.length; i++) if (distM(full[i - 1], full[i]) > 95) return null;
  // validación: sin rodeo absurdo respecto a la distancia A→B
  let pathLen = 0;
  for (let i = 1; i < full.length; i++) pathLen += distM(full[i - 1], full[i]);
  if (pathLen > Math.max(140, distM(A, B) * 2.8)) return null;
  return interior;
}

// ── Procesar una hermandad ────────────────────────────────────────────────────

function procesar(file) {
  const filePath = join(GEOJSON_DIR, file);
  const gj = JSON.parse(readFileSync(filePath, 'utf8'));
  const lsFeature = gj.features.find(f => f.geometry.type === 'LineString');
  const curPoints = gj.features.filter(f => f.geometry.type === 'Point');
  const idHdad    = lsFeature.properties.id_hdad;
  const hermandad = lsFeature.properties.nombre;
  const dia       = lsFeature.properties.dia;

  const itinerario = ITINERARIOS[file.replace('.geojson', '')];

  // Cola de coords curadas del fichero actual, por nombre y orden de aparición
  const localQueue = {};
  for (const p of curPoints) {
    (localQueue[p.properties.calle] ||= []).push(p.geometry.coordinates);
  }

  // LineString OSRM original (para tramos de barrio sin cobertura canónica)
  let origCoords = null;
  const origPtByName = {};
  const og = leerOriginal(file);
  if (og) {
    origCoords = og.features.find(f => f.geometry.type === 'LineString')?.geometry.coordinates;
    for (const f of og.features) if (f.geometry.type === 'Point') (origPtByName[f.properties.calle] ||= []).push(f.geometry.coordinates);
  }
  if (!origCoords) origCoords = lsFeature.geometry.coordinates;

  // 1) Resolver coords de los Points del itinerario oficial.
  // Prioridad por tipo de calle:
  //   · Calle compartida (en el índice): coord curada del fichero HEAD (lado
  //     norte/sur de Álvarez Quintero, variante de Duque, etc. ya ajustadas);
  //     en su defecto, extremo del índice.
  //   · Calle de barrio: geocodificación del fichero ORIGINAL (OSRM, fiable),
  //     no la del HEAD (que para calles añadidas a posteriori es un placeholder).
  const points = [];
  const omitidos = [];
  const occCount = {};
  for (const calle of itinerario) {
    const k = occCount[calle] || 0; occCount[calle] = k + 1;
    const esCompartida = !!idxReg[calle];
    let coord;
    if (esCompartida) {
      coord = (localQueue[calle] && localQueue[calle].shift()) || idxReg[calle];
    } else {
      coord = origPtByName[calle]?.[k] ?? origPtByName[calle]?.[0]
           ?? (localQueue[calle] && localQueue[calle].shift())
           ?? globalReg[calle] ?? null;
    }
    if (!coord) { omitidos.push(calle); continue; }
    points.push({ calle, coord });
  }

  // 2) Componer LineString con fragmentos canónicos + fallback OSRM monotónico
  const calles = points.map(p => p.calle);
  const ptCoords = points.map(p => p.coord);
  // ocurrencia (0,1,2..) de cada calle hasta su posición → localizar el Point
  // correcto en el fichero original cuando una calle se repite (ida/vuelta)
  const occ = [];
  const seen = {};
  for (const c of calles) { occ.push(seen[c] || 0); seen[c] = (seen[c] || 0) + 1; }
  const locCoord = (i) => origPtByName[calles[i]]?.[occ[i]]
                       ?? origPtByName[calles[i]]?.[0] ?? ptCoords[i];
  const tramos = [];
  let i = 0;
  while (i < calles.length - 1) {
    let found = false;
    for (let len = Math.min(MAX_LEN, calles.length - i); len >= 2; len--) {
      const ventana = calles.slice(i, i + len);
      const clave = ventana.join('→');
      const claveRev = ventana.slice().reverse().join('→');
      const fwd = segs[clave];
      const rev = segs[claveRev];
      if (fwd && fwd.calidad !== 'mala' && !esBucle(fwd.coords)) {
        tramos.push({ tipo: 'canonico', clave, coords: fwd.coords,
                      fuente: fwd.fuente, ptStart: i, ptEnd: i + len - 1 });
        i += len - 1; found = true; break;
      }
      if (rev && rev.calidad !== 'mala' && !esBucle(rev.coords)) {
        // Mismo tramo físico recorrido en sentido contrario → invertir coords
        tramos.push({ tipo: 'canonico', clave: clave + ' (rev)', coords: rev.coords.slice().reverse(),
                      fuente: rev.fuente, ptStart: i, ptEnd: i + len - 1 });
        i += len - 1; found = true; break;
      }
    }
    if (!found) {
      tramos.push({ tipo: 'osrm', clave: calles[i] + '→' + calles[i + 1],
                    ptStart: i, ptEnd: i + 1 });
      i += 1;
    }
  }

  // Encadenar coords. Los tramos canónicos aportan su geometría verificada tal
  // cual; los tramos de barrio empiezan y acaban EXACTAMENTE en la coord del
  // Point (continuidad garantizada, sin offset marcador↔línea) con interiores
  // OSRM sólo si forman un trazado limpio, o recta en su defecto (marcado).
  const out = [];
  let firstTramo = true;
  let nRectas = 0;
  const tramosRecta = [];
  for (const t of tramos) {
    let coords;
    if (t.tipo === 'canonico') {
      coords = t.coords;
    } else {
      const A = ptCoords[t.ptStart], B = ptCoords[t.ptEnd];
      const interior = interiorOsrm(origCoords, locCoord(t.ptStart), locCoord(t.ptEnd), A, B);
      if (interior && interior.length) {
        coords = [A, ...interior, B];
      } else {
        coords = [A, B];                 // recta — necesita trazado manual
        nRectas++; tramosRecta.push(t.clave);
      }
    }
    if (firstTramo) { out.push(...coords); firstTramo = false; }
    else { out.push(...coords.slice(1)); }
  }

  const nCanon = tramos.filter(t => t.tipo === 'canonico').length;
  const nOsrm  = tramos.filter(t => t.tipo === 'osrm').length;

  // Salto máximo entre coords consecutivas (detecta empalmes rotos / teletransportes)
  let maxGap = 0, maxGapAt = 0;
  for (let k = 1; k < out.length; k++) {
    const g = distM(out[k - 1], out[k]);
    if (g > maxGap) { maxGap = g; maxGapAt = k; }
  }

  // 3) Reconstruir features
  const newFeatures = [
    { type: 'Feature',
      properties: { id_hdad: idHdad, nombre: hermandad, dia },
      geometry: { type: 'LineString', coordinates: out } },
    ...points.map(p => ({
      type: 'Feature',
      properties: { id_hdad: idHdad, hermandad, calle: p.calle, osm: p.calle },
      geometry: { type: 'Point', coordinates: p.coord },
    })),
  ];
  gj.features = newFeatures;

  if (!DRY_RUN) writeFileSync(filePath, JSON.stringify(gj, null, 2), 'utf8');

  return { file, hermandad, nPoints: points.length, nCoords: out.length,
           nCanon, nOsrm, omitidos, maxGap: Math.round(maxGap), maxGapAt, nRectas, tramosRecta,
           tramosCanon: tramos.filter(t => t.tipo === 'canonico'),
           tramosOsrm: tramos.filter(t => t.tipo === 'osrm').map(t => t.clave) };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Rehaciendo ${Object.keys(ITINERARIOS).length} GeoJSON (Martes/Miércoles, no editados)...\n`);

for (const key of Object.keys(ITINERARIOS)) {
  const r = procesar(key + '.geojson');
  const total = r.nCanon + r.nOsrm;
  const pct = total ? Math.round(100 * r.nCanon / total) : 0;
  const icon = r.nOsrm === 0 ? '✓' : pct >= 60 ? '~' : '⚠';
  console.log(`${icon} ${r.file}: ${r.nPoints} Points, ${r.nCoords} coords | canónicos ${r.nCanon}/${total} (${pct}%) | rectas ${r.nRectas} | salto máx ${r.maxGap}m`);
  if (r.omitidos.length) console.log(`    · Points omitidos (sin coord en Nómina/registro): ${r.omitidos.join(', ')}`);
  if (VERBOSE) r.tramosCanon.forEach(t => console.log(`    ✓ ${t.coords.length}c ${t.fuente}${t.clave.endsWith('(rev)') ? ' [rev]' : ''} | ${t.clave}`));
  if (r.tramosRecta.length) r.tramosRecta.forEach(c => console.log(`    ✎ RECTA (trazar a mano): ${c}`));
  const soloOsrm = r.tramosOsrm.filter(c => !r.tramosRecta.includes(c));
  if (soloOsrm.length) soloOsrm.forEach(c => console.log(`    · barrio/OSRM: ${c}`));
}

console.log('\nHecho.');
