/**
 * rehacer-viernes-sabado-resurreccion.mjs
 *
 * Igual que rehacer-martes-miercoles.mjs / rehacer-jueves-madruga.mjs pero para
 * las hermandades NO editadas manualmente de Viernes Santo (tarde), Sábado Santo
 * y Domingo de Resurrección. Rehace DESDE CERO sus GeoJSON a partir del
 * itinerario oficial (Nómina 2025) y de los fragmentos de recorrido verificados.
 *
 * No toca el resto de días (ya rehechos/confirmados).
 *
 * Método (idéntico): Points = itinerario oficial completo (orden + repeticiones
 * exactas); LineString = fragmentos canónicos verificados + curados, encadenados
 * en sentido (con inversión de coords), guardas anti-'mala'/anti-bucle; barrio =
 * interior OSRM original limpio o recta marcada; la línea pasa por cada Point y
 * los marcadores extremos se fijan sobre la línea.
 *
 * USO:
 *   node scripts/rehacer-viernes-sabado-resurreccion.mjs --dry-run
 *   node scripts/rehacer-viernes-sabado-resurreccion.mjs
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

// Coords correctas para Points cuyo único valor disponible es un placeholder
// erróneo (corregir-no-editados los añadió a ojo) y no existen en el original.
const COORD_OVERRIDES = {
  // Compás de la Basílica de María Auxiliadora (Trinidad), junto a c/ María
  // Auxiliadora; el placeholder del HEAD caía 1,7 km al sur.
  'Compás de la Basílica de María Auxiliadora': [-5.98365, 37.39335],
  // Plaza Padre Jerónimo de Córdoba: entre Jáuregui y Ponce de León (no está en
  // el original ni en el índice; el HEAD tenía un placeholder a ~900 m).
  'Plaza Padre Jerónimo de Córdoba': [-5.9865, 37.39275],
};

// ── Itinerarios oficiales (Nómina 2025) ───────────────────────────────────────
const ITINERARIOS = {
  // ─── VIERNES SANTO (TARDE) ───────────────────────────────────────────────────
  '49-la-carreteria': [
    'Calle Real de la Carretería', 'Calle Toneleros', 'Calle Antonia Díaz', 'Calle Arfe',
    'Calle Puerta del Arenal', 'Calle Castelar', 'Calle Gamazo', 'Calle Joaquín Guichot',
    'Calle Barcelona', 'Plaza Nueva', 'Calle Tetuán', 'Calle Velázquez', "Calle O'Donnell",
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Plaza del Triunfo', 'Calle Santo Tomás', 'Calle Adolfo Rodríguez Jurado', 'Calle Santander',
    'Calle Temprado', 'Calle Dos de Mayo', 'Calle Rodo', 'Calle Real de la Carretería',
  ],
  '50-soledad-de-san-buenaventura': [
    'Calle Carlos Cañal', 'Calle Zaragoza', 'Calle Madrid', 'Plaza Nueva', 'Calle Tetuán',
    'Calle Velázquez', "Calle O'Donnell",
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Plaza del Triunfo', 'Calle Fray Ceferino González', 'Calle Almirantazgo',
    'Calle Arco del Postigo', 'Calle Dos de Mayo', 'Calle Arfe', 'Calle Puerta del Arenal',
    'Calle Castelar', 'Plaza de Molviedro', 'Calle Doña Guiomar', 'Calle Zaragoza',
    'Calle Carlos Cañal',
  ],
  '53-san-isidoro': [
    'Calle Luchana', 'Cuesta del Rosario', 'Calle Villegas', 'Plaza del Salvador', 'Calle Cuna',
    'Calle Orfila', 'Calle Javier Lasso de la Vega', 'Calle Tarifa',
    'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Placentines', 'Calle Francos', 'Cuesta del Rosario',
    'Calle Luchana',
  ],
  '54-montserrat': [
    'Calle Cristo del Calvario', 'Calle San Pablo', 'Plaza de la Magdalena', 'Calle Rioja',
    'Calle Velázquez', "Calle O'Donnell",
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Plaza del Triunfo', 'Calle Fray Ceferino González', 'Calle Almirantazgo',
    'Calle Arco del Postigo', 'Calle Dos de Mayo', 'Calle Arfe', 'Calle Puerta del Arenal',
    'Calle Castelar', 'Plaza de Molviedro', 'Calle Doña Guiomar', 'Calle Zaragoza',
    'Calle San Pablo', 'Calle Cristo del Calvario',
  ],
  '55-la-mortaja': [
    'Calle Bustos Tavera', 'Calle Doña María Coronel', 'Calle Dueñas', 'Calle San Juan de la Palma',
    'Calle Madre María Purísima de la Cruz', 'Calle Feria', 'Calle Castellar', 'Calle Alberto Lista',
    'Calle Saavedras', 'Plaza de San Martín', 'Calle Cervantes', 'Calle San Andrés',
    'Calle García Tassara', 'Calle Amor de Dios', 'Calle San Miguel', 'Calle Trajano',
    'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Cuesta del Rosario',
    'Calle Jesús de las Tres Caídas', 'Calle Odreros', 'Calle Boteros', 'Calle Sales y Ferré',
    'Plaza del Cristo de Burgos', 'Calle Doña María Coronel', 'Calle Bustos Tavera',
  ],
  // ─── SÁBADO SANTO ────────────────────────────────────────────────────────────
  '56-el-sol': [
    'Plaza del Aljarafe', 'Calle Virgen del Sol', 'Calle Ramón y Cajal', 'Calle Enramadilla',
    'Glorieta Doña María de las Mercedes de Borbón y Orleans', 'Avenida de Carlos V',
    'Plaza de Don Juan de Austria', 'Calle Paseo de Catalina de Ribera', 'Calle Cano y Cueto',
    'Calle Santa María la Blanca', 'Calle San José', 'Plaza Nuestro Padre Jesús de la Salud',
    'Plaza Ramón Ybarra Llosent', 'Calle Muñoz y Pabón', 'Calle Cabeza del Rey Don Pedro',
    'Calle Candilejo', 'Calle Alfalfa', 'Calle Jesús de las Tres Caídas', 'Cuesta del Rosario',
    'Calle Villegas', 'Plaza del Salvador', 'Calle Sagasta', 'Calle Jovellanos', 'Calle Tetuán',
    'Calle Velázquez', "Calle O'Donnell",
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Plaza del Triunfo', 'Calle Miguel Mañara', 'Plaza de La Contratación', 'Calle San Gregorio',
    'Plaza Puerta de Jerez', 'Calle San Fernando', 'Plaza de Don Juan de Austria',
    'Avenida de Carlos V', 'Glorieta Doña María de las Mercedes de Borbón y Orleans',
    'Calle Enramadilla', 'Calle Avión Cuatro Vientos', 'Calle Virgen del Sol', 'Plaza del Aljarafe',
  ],
  '57-los-servitas': [
    'Calle Siete Dolores de Nuestra Señora', 'Plaza de San Marcos', 'Calle Bustos Tavera',
    'Calle Doña María Coronel', 'Calle Dueñas', 'Calle Santa Ángela de la Cruz', 'Calle Alcázares',
    'Plaza de la Encarnación', 'Calle Laraña', 'Calle Orfila', 'Calle Javier Lasso de la Vega',
    'Calle Trajano', 'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Cuesta del Rosario',
    'Calle Jesús de las Tres Caídas', 'Calle Odreros', 'Calle Boteros', 'Calle Sales y Ferré',
    'Plaza del Cristo de Burgos', 'Calle Doña María Coronel', 'Calle Bustos Tavera',
    'Plaza de San Marcos', 'Calle Vergara', 'Plaza de Santa Isabel',
    'Calle Siete Dolores de Nuestra Señora',
  ],
  '58-la-trinidad': [
    'Compás de la Basílica de María Auxiliadora', 'Calle María Auxiliadora', 'Calle Mateos',
    'Calle Valle', 'Calle Jáuregui', 'Plaza Padre Jerónimo de Córdoba', 'Plaza de Ponce de León',
    'Calle Juan de Mesa', 'Calle Almirante Apodaca', 'Plaza de San Pedro', 'Calle Imagen',
    'Plaza de la Encarnación', 'Calle Laraña', 'Calle Orfila', 'Calle Javier Lasso de la Vega',
    'Calle Trajano', 'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Cuesta del Rosario',
    'Calle Jesús de las Tres Caídas', 'Calle Odreros', 'Calle Boteros', 'Plaza de San Ildefonso',
    'Calle Zamudio', 'Plaza de San Leandro', 'Calle Francisco Carrión Mejías', 'Calle Juan de Mesa',
    'Plaza de Ponce de León', 'Plaza Padre Jerónimo de Córdoba', 'Calle Jáuregui', 'Calle Valle',
    'Calle Verónica', 'Calle Cristo de las Cinco Llagas', 'Calle Sol', 'Calle Madre Isabel de la Trinidad',
    'Calle María Auxiliadora', 'Compás de la Basílica de María Auxiliadora',
  ],
  '59-santo-entierro': [
    'Calle Alfonso XII', 'Plaza del Duque de la Victoria',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Hernando Colón',
    'Plaza de San Francisco', 'Plaza Nueva', 'Calle Tetuán', 'Calle Velázquez', "Calle O'Donnell",
    'La Campana', 'Plaza del Duque de la Victoria', 'Calle Alfonso XII',
  ],
  '60-soledad-de-san-lorenzo': [
    'Plaza de San Lorenzo', 'Calle Conde de Barajas', 'Calle Jesús del Gran Poder', 'Calle San Miguel',
    'Calle Trajano', 'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Calle Chapineros',
    'Calle Álvarez Quintero', 'Plaza del Salvador', 'Calle Cuna', 'Calle Orfila',
    'Calle Javier Lasso de la Vega', 'Calle Aponte', 'Calle Jesús del Gran Poder', 'Calle Las Cortes',
    'Plaza de La Concordia', 'Plaza de la Gavidia', 'Calle Cardenal Spínola', 'Plaza de San Lorenzo',
  ],
  // ─── DOMINGO DE RESURRECCIÓN ──────────────────────────────────────────────────
  '61-la-resurreccion': [
    'Plaza del Señor de la Resurrección', 'Calle San Luis', 'Calle Arrayán',
    'Calle Virgen del Carmen Dolorosa', 'Plaza del Cronista', 'Calle San Blas', 'Calle Infantes',
    'Calle Almirante Espinosa', 'Plaza de Monte Sión', 'Calle Feria', 'Calle Conde de Torrejón',
    'Calle Amor de Dios', 'Alameda de Hércules', 'Calle Trajano',
    'Plaza del Duque de la Victoria (lado derecho)',
    'La Campana', 'Calle Sierpes', 'Plaza de San Francisco', 'Avenida de la Constitución',
    'Calle Cardenal Carlos Amigo', 'Calle Alemanes', 'Calle Álvarez Quintero',
    'Calle Argote de Molina', 'Calle Placentines', 'Calle Francos', 'Cuesta del Rosario',
    'Calle Jesús de las Tres Caídas', 'Calle Odreros', 'Calle Boteros', 'Calle Sales y Ferré',
    'Plaza del Cristo de Burgos', 'Calle Doña María Coronel', 'Calle Bustos Tavera',
    'Plaza de San Marcos', 'Calle San Luis', 'Plaza del Señor de la Resurrección',
  ],
};

// ── Carga del índice y registros de coords ────────────────────────────────────

const idx  = JSON.parse(readFileSync(IDX_PATH, 'utf8'));
const segs = idx.segmentos;

// ── Fragmentos curados: cadenas verificadas que el índice no extrae solo ───────
const CURADOS_DEF = [
  ['14-san-gonzalo', ['Avenida de la Constitución', 'Plaza del Triunfo', 'Calle Fray Ceferino González',
    'Calle Almirantazgo', 'Calle Arco del Postigo', 'Calle Dos de Mayo', 'Calle Arfe']],
  ['03-jesus-despojado', ['Avenida de la Constitución', 'Plaza del Triunfo', 'Calle Santo Tomás',
    'Calle Adolfo Rodríguez Jurado', 'Plaza Ministro Indalecio Prieto', 'Calle Tomás de Ibarra', 'Calle Almirantazgo']],
  ['03-jesus-despojado', ['Calle Puerta del Arenal', 'Calle Castelar', 'Calle Gamazo']],
  ['05-la-paz', ['Calle Gamazo', 'Calle Joaquín Guichot', 'Calle Barcelona', 'Plaza Nueva',
    'Calle Tetuán', 'Calle Velázquez', "Calle O'Donnell"]],
  ['18-el-museo', ['Calle Puerta del Arenal', 'Calle Castelar', 'Plaza de Molviedro',
    'Calle Doña Guiomar', 'Calle Zaragoza', 'Calle Gravina', 'Calle Pedro del Toro',
    'Calle Bailén', 'Calle Miguel de Carvajal', 'Plaza del Museo']],
  ['05-la-paz', ['Plaza del Triunfo', 'Calle Miguel Mañara', 'Plaza de La Contratación',
    'Calle San Gregorio', 'Plaza Puerta de Jerez']],
  // vuelta de La Carretería: Dos de Mayo → Rodo → Real Carretería → Toneleros → Antonia Díaz
  ['03-jesus-despojado', ['Calle Dos de Mayo', 'Calle Rodo', 'Calle Real de la Carretería',
    'Calle Toneleros', 'Calle Antonia Díaz']],
  // vuelta por el Arenal (Soledad SB, Montserrat): Dos de Mayo → Arfe → … → Zaragoza
  ['17-las-aguas', ['Calle Dos de Mayo', 'Calle Arfe', 'Calle Puerta del Arenal', 'Calle Castelar',
    'Plaza de Molviedro', 'Calle Doña Guiomar', 'Calle Zaragoza']],
  // zona Cerro/Sur de El Sol, verificada en 19-el-cerro (mismo sentido en ida;
  // la vuelta usa la inversión): Ramón y Cajal → Enramadilla → glorieta D.Mª de
  // las Mercedes → Carlos V → Don Juan de Austria → San Fernando → Puerta de Jerez
  ['19-el-cerro', ['Calle Ramón y Cajal', 'Calle Enramadilla',
    'Glorieta Doña María de las Mercedes de Borbón y Orleans', 'Avenida de Carlos V',
    'Plaza de Don Juan de Austria', 'Calle San Fernando', 'Plaza Puerta de Jerez'],
    { maxIdx: 100, maxDist: 90 }],   // sólo la ida de El Cerro; sus Points son ~60 m imprecisos
];

function extraerCadena(sourceFile, cadena, opts = {}) {
  // opts.maxIdx  → limitar la búsqueda al tramo de ida (evita engancharse a una
  //                segunda aparición de la calle en la vuelta del fichero fuente).
  // opts.maxDist → distancia máxima coord↔línea aceptable (por defecto 45 m;
  //                algunos ficheros tienen Points menos precisos).
  const maxDist = opts.maxDist ?? 45;
  const gj = JSON.parse(readFileSync(join(GEOJSON_DIR, sourceFile + '.geojson'), 'utf8'));
  const ls = gj.features.find(f => f.geometry.type === 'LineString').geometry.coordinates;
  const limite = Math.min(ls.length, opts.maxIdx ?? ls.length);
  const ptByName = {};
  for (const f of gj.features) if (f.geometry.type === 'Point') (ptByName[f.properties.calle] ||= []).push(f.geometry.coordinates);

  const idxs = [];
  let cursor = 0;
  for (const calle of cadena) {
    const target = ptByName[calle]?.[0];
    if (!target) return [];
    let best = cursor, bd = Infinity;
    for (let i = cursor; i < limite; i++) { const d = distM(ls[i], target); if (d < bd) { bd = d; best = i; } }
    if (bd > maxDist) return [];
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
for (const [src, cadena, opts] of CURADOS_DEF) {
  for (const frag of extraerCadena(src, cadena, opts)) {
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
    const orig = origPtByName[calle]?.[k] ?? origPtByName[calle]?.[0] ?? null;
    let coord;
    if (COORD_OVERRIDES[calle]) {
      coord = COORD_OVERRIDES[calle];
    } else if (esCompartida) {
      coord = (localQueue[calle] && localQueue[calle].shift()) || idxReg[calle];
      // Colisión de nombre: una calle compartida cuyo nombre existe en otra zona
      // (Calle Sol, Valle, Jáuregui…) puede resolver a la coord equivocada. Si la
      // geocodificación local (fichero original de ESTA hermandad) discrepa mucho,
      // es la fiable para este recorrido.
      if (coord && orig && distM(coord, orig) > 350) coord = orig;
    } else {
      coord = orig
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

console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Rehaciendo ${Object.keys(ITINERARIOS).length} GeoJSON (Viernes/Sábado/Resurrección, no editados)...\n`);

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
