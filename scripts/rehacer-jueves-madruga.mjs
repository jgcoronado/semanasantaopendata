/**
 * rehacer-jueves-madruga.mjs
 *
 * Igual que rehacer-martes-miercoles.mjs pero para las hermandades NO editadas
 * manualmente de Jueves Santo y Madrugá. Rehace DESDE CERO sus GeoJSON a partir
 * del itinerario oficial (Nómina 2025) y de los fragmentos de recorrido ya
 * verificados (indice-tramos-canonicos.json + fragmentos curados de los GeoJSON
 * editados a mano).
 *
 * No toca Lunes/Martes/Miércoles (ya revisados/confirmados a mano).
 *
 * Método (idéntico al de martes/miércoles):
 *   1. Points = itinerario oficial completo, en orden, con repeticiones exactas
 *      de la Nómina (una calle no aparece más veces de las de su recorrido).
 *   2. Coords: compartidas = curadas del HEAD (lado norte/sur, variante de
 *      Duque…) o extremo del índice; de barrio = geocodificación OSRM original.
 *   3. LineString = fragmentos canónicos verificados encadenados en sentido del
 *      itinerario (ventanas 2-8, con inversión de coords si el tramo va al
 *      revés). Guardas: descartar calidad 'mala' y bucles. Barrio = interior
 *      OSRM original limpio o recta marcada. La línea pasa por cada Point.
 *
 * USO:
 *   node scripts/rehacer-jueves-madruga.mjs --dry-run   # informe, no escribe
 *   node scripts/rehacer-jueves-madruga.mjs             # escribe los GeoJSON
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const IDX_PATH    = join(__dir, 'indice-tramos-canonicos.json');
const GEOJSON_DIR = join(__dir, 'geojson-2025');
const ORIG_DIR = process.env.ORIG_DIR || null;
const ORIG_REF = process.env.ORIG_REF || '6d4b56c';

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
// Avenida de la Constitución (todas la recorren en ese sentido).

const ITINERARIOS = {
  // ─── JUEVES SANTO ─────────────────────────────────────────────────────────────
  '36-los-negritos': [
    'Calle Recaredo', 'Plaza de San Agustín', 'Calle Puerta de Carmona', 'Calle San Esteban',
    'Plaza de Pilatos', 'Calle Águilas', 'Calle Alfalfa', 'Calle Jesús de las Tres Caídas',
    'Cuesta del Rosario', 'Calle Villegas', 'Plaza del Salvador', 'Calle Sagasta',
    'Calle Jovellanos', 'Calle Tetuán', 'Calle Velázquez', "Calle O'Donnell",
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Cuesta del Rosario',
    'Plaza de la Pescadería', 'Calle Ángel María Camacho', 'Plaza de La Alfalfa', 'Calle Alfalfa',
    'Calle Águilas', 'Plaza de Pilatos', 'Calle San Esteban', 'Calle Puerta de Carmona',
    'Calle Muro de los Navarros', 'Calle Guadalupe', 'Calle Recaredo',
  ],
  '37-la-exaltacion': [
    'Calle Santa Catalina', 'Calle Gerona', 'Calle Santa Ángela de la Cruz', 'Calle Alcázares',
    'Plaza de la Encarnación', 'Calle Laraña', 'Calle Orfila', 'Calle Javier Lasso de la Vega',
    'Calle Trajano', 'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Calle Chapineros',
    'Calle Álvarez Quintero', 'Calle Villegas', 'Cuesta del Rosario', 'Plaza de la Pescadería',
    'Calle Ángel María Camacho', 'Plaza de La Alfalfa', 'Calle Odreros', 'Calle Boteros',
    'Calle Sales y Ferré', 'Plaza del Cristo de Burgos', 'Calle Almirante Apodaca',
    'Calle Alhóndiga', 'Calle Santa Catalina',
  ],
  '38-las-cigarreras': [
    'Calle Sol', 'Plaza de Los Terceros', 'Calle Capataz Manuel Santiago', 'Calle Alhóndiga',
    'Calle Almirante Apodaca', 'Plaza de San Pedro', 'Calle Imagen', 'Plaza de la Encarnación',
    'Calle Laraña', 'Calle Orfila', 'Calle Javier Lasso de la Vega', 'Calle Trajano',
    'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Plaza del Triunfo', 'Calle Miguel Mañara', 'Plaza de La Contratación', 'Calle San Gregorio',
    'Plaza Puerta de Jerez', 'Calle San Fernando', 'Calle Paseo de Catalina de Ribera',
    'Calle Cano y Cueto', 'Calle Santa María la Blanca', 'Calle San José',
    'Plaza Nuestro Padre Jesús de la Salud', 'Plaza Ramón Ybarra Llosent', 'Calle Muñoz y Pabón',
    'Calle Cabeza del Rey Don Pedro', 'Calle Candilejo', 'Calle Alfalfa', 'Calle Odreros',
    'Calle Boteros', 'Calle Sales y Ferré', 'Plaza del Cristo de Burgos', 'Calle Doña María Coronel',
    'Calle Bustos Tavera', 'Plaza de Los Terceros', 'Calle Sol',
  ],
  '39-montesion': [
    'Calle Feria', 'Calle Correduría', 'Calle Amor de Dios', 'Alameda de Hércules',
    'Calle Trajano', 'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Calle Chapineros',
    'Calle Álvarez Quintero', 'Plaza del Salvador', 'Calle Cuna', 'Calle Laraña',
    'Plaza de la Encarnación', 'Calle Alcázares', 'Calle Santa Ángela de la Cruz',
    'Calle San Juan de la Palma', 'Calle Madre María Purísima de la Cruz', 'Calle Feria',
  ],
  '41-el-valle': [
    'Calle Laraña', 'Calle Orfila', 'Plaza Fernando de Herrera', 'Calle Daoiz',
    'Calle García Tassara', 'Calle Amor de Dios', 'Calle San Miguel', 'Calle Jesús del Gran Poder',
    'Plaza del Duque de la Victoria',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Calle Chapineros',
    'Calle Álvarez Quintero', 'Plaza del Salvador', 'Calle Cuna', 'Calle Laraña',
  ],
  '42-pasion': [
    'Plaza del Salvador', 'Calle Cuna', 'Calle Orfila', 'Calle Javier Lasso de la Vega',
    'Calle Amor de Dios', 'Calle San Miguel', 'Calle Trajano',
    'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Calle Villegas',
    'Plaza del Salvador',
  ],
  // ─── MADRUGÁ ─────────────────────────────────────────────────────────────────
  '43-el-silencio': [
    'Calle El Silencio', 'Calle Alfonso XII', 'Plaza del Duque de la Victoria',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Calle Villegas',
    'Plaza del Salvador', 'Calle Cuna', 'Calle Orfila', 'Plaza Fernando de Herrera',
    'Calle Daoiz', 'Calle García Tassara', 'Calle Amor de Dios', 'Calle San Miguel',
    'Calle Jesús del Gran Poder', 'Plaza del Duque de la Victoria', 'Calle Alfonso XII',
    'Calle El Silencio',
  ],
  '44-el-gran-poder': [
    'Plaza de San Lorenzo', 'Calle Conde de Barajas', 'Calle Jesús del Gran Poder',
    'Plaza del Duque de la Victoria',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Plaza del Triunfo', 'Calle Fray Ceferino González', 'Calle Almirantazgo',
    'Calle Arco del Postigo', 'Calle Dos de Mayo', 'Calle Arfe', 'Calle Adriano',
    'Calle López de Arenas', 'Calle Santas Patronas', 'Calle Puerta de Triana', 'Calle Gravina',
    'Calle Pedro del Toro', 'Calle Bailén', 'Calle Miguel de Carvajal', 'Plaza del Museo',
    'Calle San Vicente', 'Calle Cardenal Cisneros', 'Calle Jesús de la Vera-Cruz', 'Calle Baños',
    'Plaza de la Gavidia', 'Calle Cardenal Spínola', 'Plaza de San Lorenzo',
  ],
  '45-la-macarena': [
    'Plaza de la Esperanza Macarena', 'Calle Resolana', 'Calle Feria', 'Calle Relator',
    'Alameda de Hércules', 'Calle Trajano', 'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Calle Chapineros',
    'Calle Álvarez Quintero', 'Calle Villegas', 'Cuesta del Rosario',
    'Calle Jesús de las Tres Caídas', 'Calle Odreros', 'Calle Boteros', 'Calle Sales y Ferré',
    'Plaza del Cristo de Burgos', 'Plaza de San Pedro', 'Calle Santa Ángela de la Cruz',
    'Calle San Juan de la Palma', 'Calle Madre María Purísima de la Cruz', 'Calle Feria',
    'Calle Relator', 'Calle Parras', 'Calle Escoberos', 'Calle Fray Luis Sotelo',
    'Calle Resolana', 'Arco de la Macarena', 'Plaza de la Esperanza Macarena',
  ],
  '46-el-calvario': [
    'Calle San Pablo', 'Calle Murillo', 'Plaza de la Magdalena', "Calle O'Donnell",
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Plaza del Triunfo', 'Calle Fray Ceferino González', 'Calle Almirantazgo',
    'Calle Arco del Postigo', 'Calle Dos de Mayo', 'Calle Arfe', 'Calle Puerta del Arenal',
    'Calle Castelar', 'Plaza de Molviedro', 'Calle Doña Guiomar', 'Calle Zaragoza',
    'Calle San Pablo',
  ],
  '48-los-gitanos': [
    'Plaza del Señor de la Salud', 'Calle Valle', 'Calle Puerta del Osario', 'Calle Matahacas',
    'Plaza de San Román', 'Calle Peñuelas', 'Calle Doña María Coronel', 'Calle Dueñas',
    'Calle Santa Ángela de la Cruz', 'Calle Alcázares', 'Plaza de la Encarnación', 'Calle Laraña',
    'Calle Orfila', 'Calle Javier Lasso de la Vega', 'Calle Trajano',
    'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Cuesta del Rosario',
    'Calle Jesús de las Tres Caídas', 'Calle Odreros', 'Calle Boteros', 'Calle Sales y Ferré',
    'Plaza del Cristo de Burgos', 'Calle Almirante Apodaca', 'Calle Juan de Mesa',
    'Plaza de Ponce de León', 'Calle Escuelas Pías', 'Calle Pinto', 'Calle Valle',
    'Plaza del Señor de la Salud',
  ],
};

// ── Carga del índice y registros de coords ────────────────────────────────────

const idx  = JSON.parse(readFileSync(IDX_PATH, 'utf8'));
const segs = idx.segmentos;

// ── Fragmentos curados: cadenas verificadas que el índice no extrae solo ───────
const CURADOS_DEF = [
  // salida/vuelta por Plaza del Triunfo hacia Fray Ceferino y el Arenal (grupo B)
  ['14-san-gonzalo', ['Avenida de la Constitución', 'Plaza del Triunfo', 'Calle Fray Ceferino González',
    'Calle Almirantazgo', 'Calle Arco del Postigo', 'Calle Dos de Mayo', 'Calle Arfe']],
  // salida inversa por Plaza del Triunfo hacia Santo Tomás → Arenal
  ['03-jesus-despojado', ['Avenida de la Constitución', 'Plaza del Triunfo', 'Calle Santo Tomás',
    'Calle Adolfo Rodríguez Jurado', 'Plaza Ministro Indalecio Prieto', 'Calle Tomás de Ibarra', 'Calle Almirantazgo']],
  ['03-jesus-despojado', ['Calle Puerta del Arenal', 'Calle Castelar', 'Calle Gamazo']],
  // Arenal → Campana por el oeste: Gamazo → Plaza Nueva → Tetuán → O'Donnell
  ['05-la-paz', ['Calle Gamazo', 'Calle Joaquín Guichot', 'Calle Barcelona', 'Plaza Nueva',
    'Calle Tetuán', 'Calle Velázquez', "Calle O'Donnell"]],
  // vuelta por el Arenal hacia el Museo: Castelar → Molviedro → Zaragoza → Museo
  ['18-el-museo', ['Calle Puerta del Arenal', 'Calle Castelar', 'Plaza de Molviedro',
    'Calle Doña Guiomar', 'Calle Zaragoza', 'Calle Gravina', 'Calle Pedro del Toro',
    'Calle Bailén', 'Calle Miguel de Carvajal', 'Plaza del Museo']],
  // salida sur por Plaza del Triunfo (Las Cigarreras): Triunfo → Miguel Mañara → Puerta de Jerez
  ['05-la-paz', ['Plaza del Triunfo', 'Calle Miguel Mañara', 'Plaza de La Contratación',
    'Calle San Gregorio', 'Plaza Puerta de Jerez']],
];

function extraerCadena(sourceFile, cadena) {
  const gj = JSON.parse(readFileSync(join(GEOJSON_DIR, sourceFile + '.geojson'), 'utf8'));
  const ls = gj.features.find(f => f.geometry.type === 'LineString').geometry.coordinates;
  const ptByName = {};
  for (const f of gj.features) if (f.geometry.type === 'Point') (ptByName[f.properties.calle] ||= []).push(f.geometry.coordinates);

  const idxs = [];
  let cursor = 0;
  for (const calle of cadena) {
    const target = ptByName[calle]?.[0];
    if (!target) return [];
    let best = cursor, bd = Infinity;
    for (let i = cursor; i < ls.length; i++) { const d = distM(ls[i], target); if (d < bd) { bd = d; best = i; } }
    if (bd > 45) return [];
    idxs.push(best); cursor = best;
  }
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

let nCurados = 0;
for (const [src, cadena] of CURADOS_DEF) {
  for (const frag of extraerCadena(src, cadena)) {
    segs[frag.clave] = { fuente: frag.fuente, calidad: 'buena', n_coords: frag.coords.length, coords: frag.coords };
    nCurados++;
  }
}

const idxReg = {};
for (const k of Object.keys(segs)) {
  const parts = k.split('→');
  const c = segs[k].coords;
  if (!c || c.length < 2) continue;
  const first = parts[0], last = parts[parts.length - 1];
  if (!idxReg[first]) idxReg[first] = c[0];
  idxReg[last] = c[c.length - 1];
}

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

function interiorOsrm(origCoords, locA, locB, A, B) {
  if (!origCoords || origCoords.length < 2) return null;
  const s = nearestIdx(origCoords, locA);
  const e = nearestIdx(origCoords, locB);
  if (s === e) return null;
  const lo = Math.min(s, e), hi = Math.max(s, e);
  let seg = origCoords.slice(lo, hi + 1);
  if (s > e) seg = seg.reverse();
  const interior = seg.slice(1, -1);
  const full = [A, ...interior, B];
  for (let i = 1; i < full.length; i++) if (distM(full[i - 1], full[i]) > 95) return null;
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

  const localQueue = {};
  for (const p of curPoints) {
    (localQueue[p.properties.calle] ||= []).push(p.geometry.coordinates);
  }

  let origCoords = null;
  const origPtByName = {};
  const og = leerOriginal(file);
  if (og) {
    origCoords = og.features.find(f => f.geometry.type === 'LineString')?.geometry.coordinates;
    for (const f of og.features) if (f.geometry.type === 'Point') (origPtByName[f.properties.calle] ||= []).push(f.geometry.coordinates);
  }
  if (!origCoords) origCoords = lsFeature.geometry.coordinates;

  // 1) Resolver coords de los Points
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

  // 2) Componer LineString
  const calles = points.map(p => p.calle);
  const ptCoords = points.map(p => p.coord);
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
        coords = [A, B];
        nRectas++; tramosRecta.push(t.clave);
      }
    }
    if (firstTramo) { out.push(...coords); firstTramo = false; }
    else { out.push(...coords.slice(1)); }
  }

  // Si el primer/último tramo es canónico, el marcador de la parroquia (primer/
  // último Point) puede caer en otra sección de una calle larga (Sol, Feria,
  // San Pablo…). La geometría canónica es la verificada → fijar el marcador
  // extremo sobre la línea.
  if (out.length && tramos[0]?.tipo === 'canonico' && points[0]) points[0].coord = out[0];
  if (out.length && tramos[tramos.length - 1]?.tipo === 'canonico' && points[points.length - 1])
    points[points.length - 1].coord = out[out.length - 1];

  const nCanon = tramos.filter(t => t.tipo === 'canonico').length;
  const nOsrm  = tramos.filter(t => t.tipo === 'osrm').length;

  let maxGap = 0, maxGapAt = 0;
  for (let k = 1; k < out.length; k++) {
    const g = distM(out[k - 1], out[k]);
    if (g > maxGap) { maxGap = g; maxGapAt = k; }
  }

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

console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Rehaciendo ${Object.keys(ITINERARIOS).length} GeoJSON (Jueves/Madrugá, no editados)...\n`);

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
