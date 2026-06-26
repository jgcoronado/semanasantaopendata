/**
 * Calcula distancias de recorrido de hermandades.
 * Estrategia:
 *   1. Descarga UN SOLO índice de todas las vías/plazas de Sevilla desde Overpass (se cachea).
 *   2. Resuelve cada nombre de calle contra ese índice local (sin rate limit, búsqueda fuzzy).
 *   3. Usa OSRM foot para calcular la ruta a pie entre los puntos en orden.
 *   4. Guarda en src/data/recorridos-AAAA.json
 *
 * Uso:
 *   node scripts/calcular-recorridos.mjs 2025
 *   node scripts/calcular-recorridos.mjs 2025 --dia domingo-de-ramos
 *   node scripts/calcular-recorridos.mjs 2025 --id 1,2,3
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dir, '../src/data');
const INDICE_FILE = join(__dir, '.calles-sevilla.json');

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const OSRM     = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const UA       = 'SemanaSantaOpenData/1.0 (github.com/jgcoronado)';

// ─── Índice de calles ──────────────────────────────────────────────────────
// Bbox ampliado: casco histórico + Triana + Cerro del Águila + Nervión + Macarena + María Luisa
const BBOX = '37.33,-6.03,37.44,-5.93'; // S,W,N,E

// Descarga (si no existe) el índice completo de vías y plazas de Sevilla.
// Retorna Map<nombre_normalizado, { lon, lat, nombre_osm }>
async function cargarIndice() {
  if (existsSync(INDICE_FILE)) {
    const raw = JSON.parse(readFileSync(INDICE_FILE, 'utf8'));
    console.log(`Índice OSM cargado: ${raw.length} elementos`);
    return construirMapa(raw);
  }

  console.log('Descargando índice de calles de Sevilla desde Overpass (una sola vez)...');
  const q = `[out:json][timeout:90];
(
  way["highway"]["name"](${BBOX});
  way["place"]["name"](${BBOX});
  node["place"]["name"](${BBOX});
  way["amenity"="place_of_worship"]["name"](${BBOX});
  way["historic"]["name"](${BBOX});
);
out center;`;

  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: `data=${encodeURIComponent(q)}`,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Overpass devolvió XML (error): ${text.slice(0, 200)}`); }

  const elementos = (data.elements ?? [])
    .filter(e => e.tags?.name)
    .map(e => ({
      nombre: e.tags.name,
      lat: e.center?.lat ?? e.lat,
      lon: e.center?.lon ?? e.lon,
      tipo: e.tags.highway ?? e.tags.place ?? e.tags.amenity ?? e.tags.historic ?? e.type,
    }))
    .filter(e => e.lat && e.lon);

  writeFileSync(INDICE_FILE, JSON.stringify(elementos, null, 2));
  console.log(`Índice descargado y guardado: ${elementos.length} elementos`);
  return construirMapa(elementos);
}

function normalizar(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '') // quitar acentos
    .replace(/^(calle|plaza|avenida|avda|paseo|glorieta|puente|puerta)\s+(de\s+)?(el\s+|la\s+|los\s+|las\s+|del\s+)?/i, '')
    .trim();
}

// Calles ausentes de OSM o resueltas incorrectamente con el BBOX ampliado.
// Los OVERRIDES SUSTITUYEN cualquier entrada OSM para ese nombre normalizado.
// Si el campo `waypoints` está presente (array de {lat,lon}), la calle/plaza se
// geocodifica como múltiples waypoints consecutivos (trayecto en línea recta).
const OVERRIDES = [
  // Ausentes de OSM
  { nombre: 'Calle Tomás de Ibarra',               lat: 37.38437, lon: -5.99490 },
  { nombre: 'Calle Arco del Postigo',              lat: 37.38500, lon: -5.99555 },
  { nombre: 'Calle Miguel Mañara',                 lat: 37.38436, lon: -5.99235 },
  { nombre: 'Calle Madre María Purísima de la Cruz', lat: 37.39655, lon: -5.99157 },
  { nombre: 'Calle Entrecárceles',  lat: 37.38936, lon: -5.99373 }, // entre Álvarez Quintero y Francisco Bruna
  { nombre: 'Calle Rodríguez Marín', lat: 37.39030, lon: -5.98833 }, // entre Águilas y Caballerizas
  { nombre: 'Calle Puerta de Carmona', lat: 37.38920, lon: -5.98280 }, // puerta E del casco histórico (no la Calle Carmona al sur)
  { nombre: 'Calle Puerta de la Carne', lat: 37.38584, lon: -5.98656 }, // puerta SE del casco histórico
  { nombre: 'Calle Puerta del Osario',  lat: 37.39346, lon: -5.98503 }, // puerta NE del casco histórico
  { nombre: 'Plaza del Cronista',    lat: 37.39882, lon: -5.98959 }, // junto a Santa Ángela de la Cruz
  { nombre: 'Plaza de Monte Sión',   lat: 37.39682, lon: -5.99108 }, // junto a Gran Poder / Montesión
  // Calles con homónimas fuera del casco histórico (BBOX ampliado las resuelve mal)
  { nombre: 'Calle Velázquez',      lat: 37.39062, lon: -5.99590 }, // entre Rioja/Tetuán y Magdalena
  { nombre: 'Calle San Pablo',      lat: 37.38940, lon: -5.99740 }, // entre Magdalena y Puerta de Triana
  { nombre: 'Calle Adriano',        lat: 37.38680, lon: -5.99840 }, // Arenal/Triana
  { nombre: 'Calle Conde de Barajas', lat: 37.39770, lon: -5.99572 }, // junto a Gran Poder
  { nombre: 'Plaza Puerta de Jerez',  lat: 37.38237, lon: -5.99281 }, // glorieta sur de la Catedral
  { nombre: 'Plaza Nuestro Padre Jesús de la Salud', lat: 37.38929, lon: -5.98986 }, // junto a Candilejo/Alfalfa
  { nombre: 'Plaza de Santa Isabel', lat: 37.39632, lon: -5.98762 }, // junto a San Marcos/Servitas
  { nombre: 'Calle Luca de Tena',   lat: 37.38200, lon: -6.00200 }, // Triana (no la Glorieta de Luca de Tena al sur)
  // Plazas recorridas en línea recta (dos waypoints: entrada y salida)
  { nombre: 'Plaza Fernando de Herrera', waypoints: [
    { lat: 37.393767, lon: -5.993848 }, // entrada desde Orfila
    { lat: 37.394243, lon: -5.994158 }, // salida hacia Daoiz
  ]},
];

function construirMapa(elementos) {
  const mapa = new Map();
  for (const el of elementos) {
    const clave = normalizar(el.nombre);
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push({ ...el });
  }
  // OVERRIDES reemplazan completamente cualquier entrada OSM para esa clave.
  // Si el override tiene `waypoints`, se almacena como un único elemento especial
  // con `_waypoints` para que geocodeLocal pueda devolver múltiples puntos.
  for (const el of OVERRIDES) {
    const clave = normalizar(el.nombre);
    if (el.waypoints) {
      mapa.set(clave, [{ nombre: el.nombre, tipo: 'pedestrian', _waypoints: el.waypoints }]);
    } else {
      mapa.set(clave, [{ ...el, tipo: 'pedestrian' }]);
    }
  }
  return mapa;
}

// Busca en el índice local la mejor coincidencia para un nombre de calle.
// Devuelve { lon, lat, nombre_osm } o null.
function geocodeLocal(nombre, indice) {
  const clave = normalizar(nombre);

  // 1. Coincidencia exacta (normalizada)
  if (indice.has(clave)) {
    const candidatos = indice.get(clave);
    // Multi-waypoint (plaza recorrida en línea recta): devuelve array de puntos
    if (candidatos[0]?._waypoints) {
      return candidatos[0]._waypoints.map(wp => ({ lon: wp.lon, lat: wp.lat, osm: candidatos[0].nombre }));
    }
    // Priorizar highways sobre plazas sobre el resto
    const orden = ['living_street', 'pedestrian', 'residential', 'tertiary', 'secondary', 'primary', 'square'];
    candidatos.sort((a, b) => {
      const ia = orden.indexOf(a.tipo ?? '');
      const ib = orden.indexOf(b.tipo ?? '');
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    const el = candidatos[0];
    return { lon: el.lon, lat: el.lat, osm: el.nombre };
  }

  // 2. Búsqueda parcial: el nombre buscado está contenido en alguna clave
  for (const [k, v] of indice) {
    if (k.includes(clave) && clave.length >= 4) {
      return { lon: v[0].lon, lat: v[0].lat, osm: v[0].nombre };
    }
  }

  // 3. Búsqueda parcial inversa: alguna clave está contenida en el nombre buscado
  for (const [k, v] of indice) {
    if (k.length >= 5 && clave.includes(k)) {
      return { lon: v[0].lon, lat: v[0].lat, osm: v[0].nombre };
    }
  }

  return null;
}

// ─── OSRM ──────────────────────────────────────────────────────────────────

async function rutaOSRM(puntos) {
  let pts = puntos;
  if (pts.length > 50) {
    const paso = Math.ceil(pts.length / 48);
    pts = [pts[0], ...pts.filter((_, i) => i > 0 && i < pts.length - 1 && i % paso === 0), pts.at(-1)];
    pts = [...new Map(pts.map(p => [`${p.lon},${p.lat}`, p])).values()];
  }
  const coords = pts.map(p => `${p.lon},${p.lat}`).join(';');
  const res = await fetch(`${OSRM}/${coords}?overview=false`);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(`OSRM: ${data.message ?? data.code}`);
  return Math.round(data.routes[0].distance);
}

// ─── Carrera Oficial ───────────────────────────────────────────────────────

const CARRERA_IDA = [
  'Plaza del Duque de la Victoria',
  'La Campana',
  'Calle Sierpes',
  'Plaza de San Francisco',
  'Avenida de la Constitución',
];
const CARRERA_VUELTA = [...CARRERA_IDA].reverse();

function expandir(calles) {
  const out = [];
  for (const c of calles) {
    if (c === 'CARRERA OFICIAL IDA')    { out.push(...CARRERA_IDA);    continue; }
    if (c === 'CARRERA OFICIAL VUELTA') { out.push(...CARRERA_VUELTA); continue; }
    out.push(c);
  }
  return out;
}

// ─── Itinerarios ───────────────────────────────────────────────────────────
// Fuente: Nomina_OFICIAL_Semana_Santa_2025.pdf (Consejo General, marzo 2025)

const ITINERARIOS_2025 = [

  // ── DOMINGO DE RAMOS ────────────────────────────────────────────────────────
  {
    id_hdad: 1,
    nombre: 'La Borriquita',
    calles: [
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Amor de Dios',
      'Calle San Miguel',
      'Plaza de Jesús del Gran Poder',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Plaza del Salvador',
    ],
  },
  {
    id_hdad: 2,
    nombre: 'La Cena',
    calles: [
      'Calle Sol',
      'Plaza de Los Terceros',
      'Calle Capataz Manuel Santiago',
      'Calle Alhóndiga',
      'Calle Almirante Apodaca',
      'Plaza de San Pedro',
      'Calle Imagen',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Plaza Fernando de Herrera',
      'Calle Daoiz',
      'Calle García Tassara',
      'Calle Amor de Dios',
      'Calle San Miguel',
      'Plaza de Jesús del Gran Poder',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Plaza de la Pescadería',
      'Calle Ángel María Camacho',
      'Plaza de La Alfalfa',
      'Calle San Juan',
      'Calle Boteros',
      'Calle Sales y Ferré',
      'Plaza del Cristo de Burgos',
      'Calle Doña María Coronel',
      'Calle Gerona',
      'Calle Capataz Manuel Santiago',
      'Plaza de Los Terceros',
      'Calle Sol',
    ],
  },
  {
    id_hdad: 3,
    nombre: 'Jesús Despojado',
    calles: [
      'Plaza de Molviedro',
      'Calle Adolfo Cuéllar',
      'Calle Fray Bartolomé de las Casas',
      'Calle Zaragoza',
      'Calle San Pablo',
      'Plaza de la Magdalena',
      'Calle Rioja',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL VUELTA',
      'Plaza del Triunfo',
      'Calle Santo Tomás',
      'Calle Adolfo Rodríguez Jurado',
      'Plaza Ministro Indalecio Prieto',
      'Calle Tomás de Ibarra',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Rodo',
      'Calle Real de la Carretería',
      'Calle Toneleros',
      'Calle Antonia Díaz',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Calle Gamazo',
      'Calle Zaragoza',
      'Calle Fray Bartolomé de las Casas',
      'Calle Adolfo Cuéllar',
      'Plaza de Molviedro',
    ],
  },
  {
    id_hdad: 4,
    nombre: 'La Hiniesta',
    calles: [
      'Calle San Julián',
      'Calle Madre Dolores Márquez',
      'Calle Puerta de Córdoba',
      'Calle Morera',
      'Calle Macarena',
      'Calle Aniceto Sáenz',
      'Plaza del Pumarejo',
      'Calle San Luis',
      'Calle Relator',
      'Calle Feria',
      'Calle Correduría',
      'Calle Amor de Dios',
      'Alameda de Hércules',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Calle Jesús de las Tres Caídas',
      'Calle Odreros',
      'Calle Boteros',
      'Calle Sales y Ferré',
      'Plaza del Cristo de Burgos',
      'Calle Doña María Coronel',
      'Calle Bustos Tavera',
      'Plaza de San Marcos',
      'Calle Vergara',
      'Calle Hiniesta',
      'Calle Lira',
      'Calle Juzgado',
      'Calle Moravia',
      'Calle Duque Cornejo',
      'Calle San Julián',
    ],
  },
  {
    id_hdad: 5,
    nombre: 'La Paz',
    calles: [
      'Calle San Salvador',
      'Calle Río de la Plata',
      'Calle Brasil',
      'Avenida de Covadonga',
      'Avenida de Isabel la Católica',
      'Calle Palos de la Frontera',
      'Avenida de Roma',
      'Plaza Puerta de Jerez',
      'Avenida de la Constitución',
      'Calle Adolfo Rodríguez Jurado',
      'Plaza Ministro Indalecio Prieto',
      'Calle Tomás de Ibarra',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Calle Gamazo',
      'Calle Joaquín Guichot',
      'Calle Barcelona',
      'Plaza Nueva',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL VUELTA',
      'Plaza del Triunfo',
      'Calle Miguel Mañara',
      'Plaza de La Contratación',
      'Calle San Gregorio',
      'Plaza Puerta de Jerez',
      'Avenida de Roma',
      'Calle Palos de la Frontera',
      'Avenida de Isabel la Católica',
      'Avenida de Covadonga',
      'Calle Brasil',
      'Calle Progreso',
      'Calle Porvenir',
      'Calle Río de la Plata',
      'Calle San Salvador',
    ],
  },
  {
    id_hdad: 6,
    nombre: 'San Roque',
    calles: [
      'Plaza Carmen Benítez',
      'Calle Recaredo',
      'Calle Puñonrostro',
      'Calle Jáuregui',
      'Plaza Ponce de León',
      'Calle Juan de Mesa',
      'Calle Almirante Apodaca',
      'Plaza de San Pedro',
      'Calle Imagen',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Calle Jesús de las Tres Caídas',
      'Calle Alfalfa',
      'Calle Cabeza del Rey Don Pedro',
      'Calle Boteros',
      'Plaza de San Ildefonso',
      'Calle Caballerizas',
      'Plaza de Pilatos',
      'Calle San Esteban',
      'Calle Medinaceli',
      'Calle Imperial',
      'Calle Calería',
      'Calle Juan de la Encina',
      'Calle Guadalupe',
      'Calle Recaredo',
      'Plaza Carmen Benítez',
    ],
  },
  {
    id_hdad: 7,
    nombre: 'La Estrella',
    calles: [
      'Calle San Jacinto',
      'Plaza del Altozano',
      'Puente de Isabel II',
      'Calle Reyes Católicos',
      'Calle Puerta de Triana',
      'Calle San Pablo',
      'Plaza de la Magdalena',
      'Calle Rioja',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL VUELTA',
      'Plaza del Triunfo',
      'Calle Fray Ceferino González',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Adriano',
      'Calle Pastor y Landero',
      'Calle Reyes Católicos',
      'Puente de Isabel II',
      'Plaza del Altozano',
      'Calle San Jacinto',
    ],
  },
  {
    id_hdad: 8,
    nombre: 'La Amargura',
    calles: [
      'Calle San Juan de la Palma',
      'Calle Madre María Purísima de la Cruz',
      'Calle Feria',
      'Calle Conde de Torrejón',
      'Calle Amor de Dios',
      'Alameda de Hércules',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Villegas',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Laraña',
      'Plaza de la Encarnación',
      'Calle Alcázares',
      'Calle Santa Ángela de la Cruz',
      'Calle San Juan de la Palma',
    ],
  },
  {
    id_hdad: 9,
    nombre: 'El Amor',
    calles: [
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Amor de Dios',
      'Calle San Miguel',
      'Plaza de Jesús del Gran Poder',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Plaza del Salvador',
    ],
  },

  // ── LUNES SANTO ─────────────────────────────────────────────────────────────
  {
    id_hdad: 10,
    nombre: 'San Pablo',
    calles: [
      'Avenida de Pedro Romero',
      'Calle Luis Montoto',
      'Calle Puerta de Carmona',
      'Calle San Esteban',
      'Plaza de Pilatos',
      'Calle Águilas',
      'Calle Alfalfa',
      'Calle Jesús de las Tres Caídas',
      'Cuesta del Rosario',
      'Calle Villegas',
      'Calle Álvarez Quintero',
      'Calle Entrecárceles',
      'Calle Francisco Bruna',
      'Plaza de San Francisco',
      'Calle Granada',
      'Plaza Nueva',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Lineros',
      'Plaza de la Encarnación',
      'Calle Imagen',
      'Plaza de San Pedro',
      'Calle Almirante Apodaca',
      'Calle Juan de Mesa',
      'Plaza de Ponce de León',
      'Calle Pinto',
      'Calle Valle',
      'Calle Mateos',
      'Calle María Auxiliadora',
      'Avenida de Pedro Romero',
    ],
  },
  {
    id_hdad: 11,
    nombre: 'Redención',
    calles: [
      'Calle Santiago',
      'Calle Juan de Mesa',
      'Calle Almirante Apodaca',
      'Plaza de San Pedro',
      'Calle Imagen',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Calle Villegas',
      'Cuesta del Rosario',
      'Calle Jesús de las Tres Caídas',
      'Calle Odreros',
      'Calle Boteros',
      'Calle Sales y Ferré',
      'Plaza del Cristo de Burgos',
      'Calle Dormitorio',
      'Calle Alhóndiga',
      'Plaza de San Leandro',
      'Calle Francisco Carrión Mejías',
      'Calle Juan de Mesa',
      'Calle Santiago',
    ],
  },
  {
    id_hdad: 12,
    nombre: 'Santa Genoveva',
    calles: [
      'Calle Romero de Torres',
      'Calle Almirante Topete',
      'Calle Río de la Plata',
      'Calle Brasil',
      'Avenida de Covadonga',
      'Avenida de Isabel la Católica',
      'Avenida de Roma',
      'Plaza Puerta de Jerez',
      'Avenida de la Constitución',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Calle Gamazo',
      'Calle Joaquín Guichot',
      'Calle Barcelona',
      'Plaza Nueva',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Miguel Mañara',
      'Plaza de La Contratación',
      'Calle San Gregorio',
      'Plaza Puerta de Jerez',
      'Calle San Fernando',
      'Avenida de Isabel la Católica',
      'Avenida de Covadonga',
      'Calle Brasil',
      'Calle Río de la Plata',
      'Calle Romero de Torres',
    ],
  },
  {
    id_hdad: 13,
    nombre: 'Santa Marta',
    calles: [
      'Calle San Andrés',
      'Calle García Tassara',
      'Calle Amor de Dios',
      'Calle San Miguel',
      'Plaza de Jesús del Gran Poder',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Plaza Fernando de Herrera',
      'Calle Daoiz',
      'Calle San Andrés',
    ],
  },
  {
    id_hdad: 14,
    nombre: 'San Gonzalo',
    calles: [
      'Plaza de San Gonzalo',
      'Calle San Jacinto',
      'Plaza del Altozano',
      'Puente de Isabel II',
      'Calle Reyes Católicos',
      'Calle Puerta de Triana',
      'Calle San Pablo',
      'Plaza de la Magdalena',
      'Calle Rioja',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Fray Ceferino González',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Adriano',
      'Calle Pastor y Landero',
      'Calle Reyes Católicos',
      'Puente de Isabel II',
      'Plaza del Altozano',
      'Calle San Jacinto',
      'Plaza de San Gonzalo',
    ],
  },
  {
    id_hdad: 15,
    nombre: 'Vera-Cruz',
    calles: [
      'Calle Jesús de la Vera-Cruz',
      'Calle Virgen de los Buenos Libros',
      'Calle Teniente Borges',
      'Plaza de La Concordia',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Placentines',
      'Calle Francos',
      'Calle Villegas',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Aponte',
      'Plaza de Jesús del Gran Poder',
      'Calle Las Cortes',
      'Plaza de La Concordia',
      'Plaza de la Gavidia',
      'Calle Baños',
      'Calle Jesús de la Vera-Cruz',
    ],
  },
  {
    id_hdad: 16,
    nombre: 'Las Penas',
    calles: [
      'Calle Cardenal Cisneros',
      'Calle San Vicente',
      'Calle Alfonso XII',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Placentines',
      'Calle Francos',
      'Calle Villegas',
      'Plaza del Salvador',
      'Calle Sagasta',
      'Calle Jovellanos',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'La Campana',
      'Calle Alfonso XII',
      'Calle Santa Vicenta María',
      'Calle Virgen de los Buenos Libros',
      'Calle Cardenal Cisneros',
    ],
  },
  {
    id_hdad: 17,
    nombre: 'Las Aguas',
    calles: [
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Plaza de Molviedro',
      'Calle Doña Guiomar',
      'Calle Zaragoza',
      'Calle San Pablo',
      'Plaza de la Magdalena',
      'Calle Rioja',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Santo Tomás',
      'Calle Adolfo Rodríguez Jurado',
      'Plaza Ministro Indalecio Prieto',
      'Calle Tomás de Ibarra',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
    ],
  },
  {
    id_hdad: 18,
    nombre: 'El Museo',
    calles: [
      'Plaza del Museo',
      'Calle Alfonso XII',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle García de Vinuesa',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Plaza de Molviedro',
      'Calle Doña Guiomar',
      'Calle Zaragoza',
      'Calle Gravina',
      'Calle Pedro del Toro',
      'Calle Bailén',
      'Calle Miguel de Carvajal',
      'Plaza del Museo',
    ],
  },

  // ── MARTES SANTO ────────────────────────────────────────────────────────────
  {
    id_hdad: 19,
    nombre: 'El Cerro',
    calles: [
      'Calle Afán de Ribera',
      'Calle Aragón',
      'Avenida de Hytasa',
      'Calle Ramón y Cajal',
      'Calle Enramadilla',
      'Avenida de Carlos V',
      'Plaza de Don Juan de Austria',
      'Calle San Fernando',
      'Plaza Puerta de Jerez',
      'Avenida de la Constitución',
      'Calle Almirantazgo',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle García de Vinuesa',
      'Calle Fernández y González',
      'Plaza Nueva',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Fray Ceferino González',
      'Avenida de la Constitución',
      'Plaza Puerta de Jerez',
      'Avenida de Roma',
      'Calle Palos de la Frontera',
      'Calle Enramadilla',
      'Calle Ramón y Cajal',
      'Avenida de Hytasa',
      'Calle Afán de Ribera',
    ],
  },
  {
    id_hdad: 20,
    nombre: 'San Esteban',
    calles: [
      'Calle San Esteban',
      'Plaza de Pilatos',
      'Calle Águilas',
      'Calle Rodríguez Marín',
      'Plaza de San Ildefonso',
      'Calle Zamudio',
      'Plaza de San Leandro',
      'Calle Alhóndiga',
      'Calle Dormitorio',
      'Plaza del Cristo de Burgos',
      'Plaza de San Pedro',
      'Calle Imagen',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Plaza de la Pescadería',
      'Calle Ángel María Camacho',
      'Plaza de La Alfalfa',
      'Calle Alfalfa',
      'Calle Águilas',
      'Plaza de Pilatos',
      'Calle San Esteban',
    ],
  },
  {
    id_hdad: 21,
    nombre: 'La Candelaria',
    calles: [
      'Plaza Nuestro Padre Jesús de la Salud',
      'Calle Muñoz y Pabón',
      'Calle Cabeza del Rey Don Pedro',
      'Calle Candilejo',
      'Calle Alfalfa',
      'Plaza de La Alfalfa',
      'Calle Ángel María Camacho',
      'Plaza de la Pescadería',
      'Cuesta del Rosario',
      'Calle Villegas',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Miguel Mañara',
      'Plaza de La Contratación',
      'Calle San Gregorio',
      'Plaza Puerta de Jerez',
      'Calle San Fernando',
      'Calle Paseo de Catalina de Ribera',
      'Calle Cano y Cueto',
      'Calle Santa María la Blanca',
      'Calle San José',
      'Plaza Nuestro Padre Jesús de la Salud',
    ],
  },
  {
    id_hdad: 22,
    nombre: 'San Benito',
    calles: [
      'Calle San Benito',
      'Calle Luis Montoto',
      'Calle Puerta de Carmona',
      'Calle Muro de los Navarros',
      'Calle Santiago',
      'Calle Juan de Mesa',
      'Calle Almirante Apodaca',
      'Plaza de San Pedro',
      'Calle Imagen',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Calle Jesús de las Tres Caídas',
      'Calle Alfalfa',
      'Calle Águilas',
      'Plaza de Pilatos',
      'Calle San Esteban',
      'Calle Puerta de Carmona',
      'Calle Luis Montoto',
      'Calle San Benito',
    ],
  },
  {
    id_hdad: 23,
    nombre: 'Dulce Nombre',
    calles: [
      'Plaza de San Lorenzo',
      'Calle Cardenal Spínola',
      'Plaza de la Gavidia',
      'Plaza de La Concordia',
      'Calle Las Cortes',
      'Plaza de Jesús del Gran Poder',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Calle Daoiz',
      'Calle García Tassara',
      'Calle Amor de Dios',
      'Calle San Miguel',
      'Plaza de Jesús del Gran Poder',
      'Calle Conde de Barajas',
      'Plaza de San Lorenzo',
    ],
  },
  {
    id_hdad: 24,
    nombre: 'Los Javieres',
    calles: [
      'Calle Feria',
      'Calle Correduría',
      'Calle Amor de Dios',
      'Alameda de Hércules',
      'Calle Trajano',
      'Calle Conde de Barajas',
      'Plaza de Jesús del Gran Poder',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Plaza Fernando de Herrera',
      'Calle Daoiz',
      'Calle García Tassara',
      'Calle Amor de Dios',
      'Calle Correduría',
      'Calle Feria',
    ],
  },
  {
    id_hdad: 25,
    nombre: 'Los Estudiantes',
    calles: [
      'Calle San Fernando',
      'Plaza Puerta de Jerez',
      'Calle San Gregorio',
      'Plaza de La Contratación',
      'Calle Miguel Mañara',
      'Plaza del Triunfo',
      'Calle Fray Ceferino González',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Calle Gamazo',
      'Calle Zaragoza',
      'Calle Badajoz',
      'Plaza Nueva',
      'Calle Méndez Núñez',
      'Plaza de la Magdalena',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Miguel Mañara',
      'Plaza de La Contratación',
      'Calle San Gregorio',
      'Plaza Puerta de Jerez',
      'Calle San Fernando',
    ],
  },
  {
    id_hdad: 26,
    nombre: 'Santa Cruz',
    calles: [
      'Calle Mateos Gago',
      'Calle Rodrigo Caro',
      'Plaza de La Alianza',
      'Calle Joaquín Romero Murube',
      'Calle Santo Tomás',
      'Calle Santander',
      'Calle Tomás de Ibarra',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Calle Gamazo',
      'Calle Joaquín Guichot',
      'Calle Barcelona',
      'Plaza Nueva',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Joaquín Romero Murube',
      'Plaza de La Alianza',
      'Calle Rodrigo Caro',
      'Calle Mateos Gago',
    ],
  },

  // ── MIÉRCOLES SANTO ─────────────────────────────────────────────────────────
  {
    id_hdad: 27,
    nombre: 'El Carmen Doloroso',
    calles: [
      'Calle Feria',
      'Calle Peris Mencheta',
      'Calle Mata',
      'Calle Belén',
      'Alameda de Hércules',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Plaza del Salvador',
      'Calle Córdoba',
      'Calle Lineros',
      'Calle Puente y Pellón',
      'Plaza de la Encarnación',
      'Calle Alcázares',
      'Calle Santa Ángela de la Cruz',
      'Calle San Juan de la Palma',
      'Calle Madre María Purísima de la Cruz',
      'Calle Feria',
      'Calle Guadiana',
      'Calle Peris Mencheta',
    ],
  },
  {
    id_hdad: 28,
    nombre: 'El Buen Fin',
    calles: [
      'Calle San Vicente',
      'Plaza de San Antonio de Padua',
      'Calle Marqués de la Mina',
      'Calle Alcoy',
      'Calle Eslava',
      'Plaza de San Lorenzo',
      'Calle Conde de Barajas',
      'Plaza de Jesús del Gran Poder',
      'CARRERA OFICIAL IDA',
      'Calle Fray Ceferino González',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Plaza de Molviedro',
      'Calle Doña Guiomar',
      'Calle Zaragoza',
      'Calle Gravina',
      'Calle Pedro del Toro',
      'Calle Bailén',
      'Calle Miguel de Carvajal',
      'Plaza del Museo',
      'Calle San Vicente',
    ],
  },
  {
    id_hdad: 29,
    nombre: 'La Sed',
    calles: [
      'Avenida de Eduardo Dato',
      'Calle Jiménez Aranda',
      'Calle Luis Montoto',
      'Calle Puerta de Carmona',
      'Calle Muro de los Navarros',
      'Calle Santiago',
      'Calle Juan de Mesa',
      'Calle Almirante Apodaca',
      'Plaza de San Pedro',
      'Calle Imagen',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Calle Jesús de las Tres Caídas',
      'Calle Alfalfa',
      'Calle Águilas',
      'Plaza de Pilatos',
      'Calle San Esteban',
      'Calle Puerta de Carmona',
      'Calle Luis Montoto',
      'Calle Rico Cejudo',
      'Calle Goya',
      'Avenida de Eduardo Dato',
    ],
  },
  {
    id_hdad: 30,
    nombre: 'San Bernardo',
    calles: [
      'Calle San Bernardo',
      'Avenida de Eduardo Dato',
      'Calle Demetrio de los Ríos',
      'Calle Puerta de la Carne',
      'Calle Santa María la Blanca',
      'Calle San José',
      'Plaza Nuestro Padre Jesús de la Salud',
      'Calle Muñoz y Pabón',
      'Calle Cabeza del Rey Don Pedro',
      'Calle Candilejo',
      'Calle Alfalfa',
      'Plaza de La Alfalfa',
      'Calle Ángel María Camacho',
      'Plaza de la Pescadería',
      'Cuesta del Rosario',
      'Calle Villegas',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Joaquín Romero Murube',
      'Plaza de La Alianza',
      'Calle Rodrigo Caro',
      'Calle Mateos Gago',
      'Calle Fabiola',
      'Calle Madre de Dios',
      'Calle San José',
      'Calle Santa María la Blanca',
      'Calle Puerta de la Carne',
      'Calle Demetrio de los Ríos',
      'Avenida de Eduardo Dato',
      'Calle San Bernardo',
    ],
  },
  {
    id_hdad: 31,
    nombre: 'La Lanzada',
    calles: [
      'Plaza de San Martín',
      'Calle Saavedras',
      'Calle Alberto Lista',
      'Calle Conde de Torrejón',
      'Calle Marco Sancho',
      'Calle Correduría',
      'Calle Amor de Dios',
      'Alameda de Hércules',
      'Calle Trajano',
      'Calle Santa Bárbara',
      'Plaza de Jesús del Gran Poder',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Plaza Fernando de Herrera',
      'Calle Daoiz',
      'Calle San Andrés',
      'Calle Cervantes',
      'Plaza de San Martín',
    ],
  },
  {
    id_hdad: 32,
    nombre: 'El Baratillo',
    calles: [
      'Calle Adriano',
      'Calle Pastor y Landero',
      'Calle Reyes Católicos',
      'Calle Puerta de Triana',
      'Calle San Pablo',
      'Plaza de la Magdalena',
      'Calle Méndez Núñez',
      'Plaza Nueva',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Santo Tomás',
      'Calle Adolfo Rodríguez Jurado',
      'Plaza Ministro Indalecio Prieto',
      'Calle Tomás de Ibarra',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Adriano',
    ],
  },
  {
    id_hdad: 33,
    nombre: 'Los Panaderos',
    calles: [
      'Calle Orfila',
      'Plaza Fernando de Herrera',
      'Calle Daoiz',
      'Calle García Tassara',
      'Calle Amor de Dios',
      'Calle San Miguel',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
    ],
  },
  {
    id_hdad: 34,
    nombre: 'Cristo de Burgos',
    calles: [
      'Plaza de San Pedro',
      'Calle Imagen',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Plaza de Jesús de la Pasión',
      'Calle Alcaicería de la Loza',
      'Plaza de La Alfalfa',
      'Calle San Juan',
      'Calle Boteros',
      'Calle Sales y Ferré',
      'Plaza del Cristo de Burgos',
      'Plaza de San Pedro',
    ],
  },
  {
    id_hdad: 35,
    nombre: 'Siete Palabras',
    calles: [
      'Calle Cardenal Cisneros',
      'Calle Jesús de la Vera-Cruz',
      'Calle Baños',
      'Plaza de la Gavidia',
      'Plaza de La Concordia',
      'Calle Las Cortes',
      'Plaza de Jesús del Gran Poder',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Hernando Colón',
      'Plaza de San Francisco',
      'Plaza Nueva',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'La Campana',
      'Calle Alfonso XII',
      'Calle Santa Vicenta María',
      'Calle Virgen de los Buenos Libros',
      'Calle Cardenal Cisneros',
    ],
  },

  // ── JUEVES SANTO ────────────────────────────────────────────────────────────
  {
    id_hdad: 36,
    nombre: 'Los Negritos',
    calles: [
      'Calle Recaredo',
      'Calle Puerta de Carmona',
      'Calle San Esteban',
      'Plaza de Pilatos',
      'Calle Águilas',
      'Calle Alfalfa',
      'Calle Jesús de las Tres Caídas',
      'Cuesta del Rosario',
      'Calle Villegas',
      'Plaza del Salvador',
      'Calle Sagasta',
      'Calle Jovellanos',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Plaza de la Pescadería',
      'Calle Ángel María Camacho',
      'Plaza de La Alfalfa',
      'Calle Alfalfa',
      'Calle Águilas',
      'Plaza de Pilatos',
      'Calle San Esteban',
      'Calle Puerta de Carmona',
      'Calle Muro de los Navarros',
      'Calle Guadalupe',
      'Calle Recaredo',
    ],
  },
  {
    id_hdad: 37,
    nombre: 'La Exaltación',
    calles: [
      'Calle Santa Catalina',
      'Calle Gerona',
      'Calle Santa Ángela de la Cruz',
      'Calle Alcázares',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Calle Villegas',
      'Cuesta del Rosario',
      'Plaza de la Pescadería',
      'Calle Ángel María Camacho',
      'Plaza de La Alfalfa',
      'Calle Odreros',
      'Calle Boteros',
      'Calle Sales y Ferré',
      'Plaza del Cristo de Burgos',
      'Calle Almirante Apodaca',
      'Calle Alhóndiga',
      'Calle Santa Catalina',
    ],
  },
  {
    id_hdad: 38,
    nombre: 'Las Cigarreras',
    calles: [
      'Calle Sol',
      'Plaza de Los Terceros',
      'Calle Capataz Manuel Santiago',
      'Calle Alhóndiga',
      'Calle Almirante Apodaca',
      'Plaza de San Pedro',
      'Calle Imagen',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Miguel Mañara',
      'Plaza de La Contratación',
      'Calle San Gregorio',
      'Plaza Puerta de Jerez',
      'Calle San Fernando',
      'Calle Paseo de Catalina de Ribera',
      'Calle Cano y Cueto',
      'Calle Santa María la Blanca',
      'Calle San José',
      'Plaza Nuestro Padre Jesús de la Salud',
      'Calle Muñoz y Pabón',
      'Calle Cabeza del Rey Don Pedro',
      'Calle Candilejo',
      'Calle Alfalfa',
      'Calle Odreros',
      'Calle Boteros',
      'Calle Sales y Ferré',
      'Plaza del Cristo de Burgos',
      'Calle Doña María Coronel',
      'Calle Bustos Tavera',
      'Plaza de Los Terceros',
      'Calle Sol',
    ],
  },
  {
    id_hdad: 39,
    nombre: 'Montesión',
    calles: [
      'Calle Feria',
      'Calle Correduría',
      'Calle Amor de Dios',
      'Alameda de Hércules',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Laraña',
      'Plaza de la Encarnación',
      'Calle Alcázares',
      'Calle Santa Ángela de la Cruz',
      'Calle San Juan de la Palma',
      'Calle Madre María Purísima de la Cruz',
      'Calle Feria',
    ],
  },
  {
    id_hdad: 40,
    nombre: 'La Quinta Angustia',
    calles: [
      'Calle San Pablo',
      'Plaza de la Magdalena',
      'Calle Rioja',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Fray Ceferino González',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Plaza de Molviedro',
      'Calle Doña Guiomar',
      'Calle Zaragoza',
      'Calle San Pablo',
    ],
  },
  {
    id_hdad: 41,
    nombre: 'El Valle',
    calles: [
      'Calle Laraña',
      'Calle Orfila',
      'Plaza Fernando de Herrera',
      'Calle Daoiz',
      'Calle García Tassara',
      'Calle Amor de Dios',
      'Calle San Miguel',
      'Plaza de Jesús del Gran Poder',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Laraña',
    ],
  },
  {
    id_hdad: 42,
    nombre: 'Pasión',
    calles: [
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Amor de Dios',
      'Calle San Miguel',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Villegas',
      'Plaza del Salvador',
    ],
  },

  // ── MADRUGÁ ─────────────────────────────────────────────────────────────────
  {
    id_hdad: 43,
    nombre: 'El Silencio',
    calles: [
      'Calle El Silencio',
      'Calle Alfonso XII',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Villegas',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Plaza Fernando de Herrera',
      'Calle Daoiz',
      'Calle García Tassara',
      'Calle Amor de Dios',
      'Calle San Miguel',
      'Plaza de Jesús del Gran Poder',
      'Calle Alfonso XII',
      'Calle El Silencio',
    ],
  },
  {
    id_hdad: 44,
    nombre: 'El Gran Poder',
    calles: [
      'Plaza de San Lorenzo',
      'Calle Conde de Barajas',
      'Plaza de Jesús del Gran Poder',
      'CARRERA OFICIAL IDA',
      'Calle Fray Ceferino González',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Adriano',
      'Calle López de Arenas',
      'Calle Santas Patronas',
      'Calle Puerta de Triana',
      'Calle Gravina',
      'Calle Pedro del Toro',
      'Calle Bailén',
      'Calle Miguel de Carvajal',
      'Plaza del Museo',
      'Calle San Vicente',
      'Calle Cardenal Cisneros',
      'Calle Jesús de la Vera-Cruz',
      'Calle Baños',
      'Plaza de la Gavidia',
      'Calle Cardenal Spínola',
      'Plaza de San Lorenzo',
    ],
  },
  {
    id_hdad: 45,
    nombre: 'La Macarena',
    calles: [
      'Calle Resolana',
      'Calle Feria',
      'Calle Relator',
      'Alameda de Hércules',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Calle Villegas',
      'Cuesta del Rosario',
      'Calle Jesús de las Tres Caídas',
      'Calle Odreros',
      'Calle Boteros',
      'Calle Sales y Ferré',
      'Plaza del Cristo de Burgos',
      'Plaza de San Pedro',
      'Calle Santa Ángela de la Cruz',
      'Calle San Juan de la Palma',
      'Calle Madre María Purísima de la Cruz',
      'Calle Feria',
      'Calle Relator',
      'Calle Parras',
      'Calle Escoberos',
      'Calle Fray Luis Sotelo',
      'Calle Resolana',
    ],
  },
  {
    id_hdad: 46,
    nombre: 'El Calvario',
    calles: [
      'Calle San Pablo',
      'Calle Murillo',
      'Plaza de la Magdalena',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Fray Ceferino González',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Plaza de Molviedro',
      'Calle Doña Guiomar',
      'Calle Zaragoza',
      'Calle San Pablo',
    ],
  },
  {
    id_hdad: 47,
    nombre: 'Esperanza de Triana',
    calles: [
      'Calle Pureza',
      'Plaza del Altozano',
      'Puente de Isabel II',
      'Calle Reyes Católicos',
      'Calle Puerta de Triana',
      'Calle Zaragoza',
      'Calle Madrid',
      'Plaza Nueva',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Fray Ceferino González',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Adriano',
      'Calle Pastor y Landero',
      'Calle Reyes Católicos',
      'Puente de Isabel II',
      'Plaza del Altozano',
      'Calle San Jacinto',
      'Calle Pagés del Corro',
      'Calle Luca de Tena',
      'Calle Pelay Correa',
      'Calle Pureza',
    ],
  },
  {
    id_hdad: 48,
    nombre: 'Los Gitanos',
    calles: [
      'Calle Valle',
      'Calle Puerta del Osario',
      'Calle Matahacas',
      'Plaza de San Román',
      'Calle Peñuelas',
      'Calle Doña María Coronel',
      'Calle Dueñas',
      'Calle Santa Ángela de la Cruz',
      'Calle Alcázares',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Calle Jesús de las Tres Caídas',
      'Calle Odreros',
      'Calle Boteros',
      'Calle Sales y Ferré',
      'Plaza del Cristo de Burgos',
      'Calle Almirante Apodaca',
      'Calle Juan de Mesa',
      'Plaza de Ponce de León',
      'Calle Escuelas Pías',
      'Calle Pinto',
      'Calle Valle',
    ],
  },

  // ── VIERNES SANTO ───────────────────────────────────────────────────────────
  {
    id_hdad: 49,
    nombre: 'La Carretería',
    calles: [
      'Calle Real de la Carretería',
      'Calle Toneleros',
      'Calle Antonia Díaz',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Calle Gamazo',
      'Calle Joaquín Guichot',
      'Calle Barcelona',
      'Plaza Nueva',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Santo Tomás',
      'Calle Adolfo Rodríguez Jurado',
      'Calle Santander',
      'Calle Temprado',
      'Calle Dos de Mayo',
      'Calle Rodo',
      'Calle Real de la Carretería',
    ],
  },
  {
    id_hdad: 50,
    nombre: 'Soledad de San Buenaventura',
    calles: [
      'Calle Carlos Cañal',
      'Calle Zaragoza',
      'Calle Madrid',
      'Plaza Nueva',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Fray Ceferino González',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Plaza de Molviedro',
      'Calle Doña Guiomar',
      'Calle Zaragoza',
      'Calle Carlos Cañal',
    ],
  },
  {
    id_hdad: 51,
    nombre: 'El Cachorro',
    calles: [
      'Calle Castilla',
      'Calle Callao',
      'Calle San Jorge',
      'Plaza del Altozano',
      'Puente de Isabel II',
      'Calle Reyes Católicos',
      'Calle Puerta de Triana',
      'Calle San Pablo',
      'Plaza de la Magdalena',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Fray Ceferino González',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Adriano',
      'Calle Pastor y Landero',
      'Calle Reyes Católicos',
      'Puente de Isabel II',
      'Plaza del Altozano',
      'Calle San Jorge',
      'Calle Callao',
      'Calle Castilla',
    ],
  },
  {
    id_hdad: 52,
    nombre: 'La O',
    calles: [
      'Calle Castilla',
      'Calle Callao',
      'Calle San Jorge',
      'Plaza del Altozano',
      'Puente de Isabel II',
      'Calle Reyes Católicos',
      'Calle Puerta de Triana',
      'Calle San Pablo',
      'Plaza de la Magdalena',
      'Calle Rioja',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Santo Tomás',
      'Calle Adolfo Rodríguez Jurado',
      'Calle Santander',
      'Calle Temprado',
      'Calle Dos de Mayo',
      'Calle Rodo',
      'Calle Real de la Carretería',
      'Calle Toneleros',
      'Calle Adriano',
      'Calle Pastor y Landero',
      'Calle Reyes Católicos',
      'Puente de Isabel II',
      'Plaza del Altozano',
      'Calle San Jorge',
      'Calle Callao',
      'Calle Castilla',
    ],
  },
  {
    id_hdad: 53,
    nombre: 'San Isidoro',
    calles: [
      'Calle Luchana',
      'Cuesta del Rosario',
      'Calle Villegas',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Tarifa',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Calle Luchana',
    ],
  },
  {
    id_hdad: 54,
    nombre: 'Montserrat',
    calles: [
      'Calle Cristo del Calvario',
      'Calle San Pablo',
      'Plaza de la Magdalena',
      'Calle Rioja',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Fray Ceferino González',
      'Calle Almirantazgo',
      'Calle Arco del Postigo',
      'Calle Dos de Mayo',
      'Calle Arfe',
      'Calle Puerta del Arenal',
      'Calle Castelar',
      'Plaza de Molviedro',
      'Calle Doña Guiomar',
      'Calle Zaragoza',
      'Calle San Pablo',
      'Calle Cristo del Calvario',
    ],
  },
  {
    id_hdad: 55,
    nombre: 'La Mortaja',
    calles: [
      'Calle Bustos Tavera',
      'Calle Doña María Coronel',
      'Calle Dueñas',
      'Calle San Juan de la Palma',
      'Calle Madre María Purísima de la Cruz',
      'Calle Feria',
      'Calle Castellar',
      'Calle Alberto Lista',
      'Calle Saavedras',
      'Plaza de San Martín',
      'Calle Cervantes',
      'Calle San Andrés',
      'Calle García Tassara',
      'Calle Amor de Dios',
      'Calle San Miguel',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Calle Jesús de las Tres Caídas',
      'Calle Odreros',
      'Calle Boteros',
      'Calle Sales y Ferré',
      'Plaza del Cristo de Burgos',
      'Calle Doña María Coronel',
      'Calle Bustos Tavera',
    ],
  },

  // ── SÁBADO SANTO ────────────────────────────────────────────────────────────
  {
    id_hdad: 56,
    nombre: 'El Sol',
    calles: [
      'Calle Virgen del Sol',
      'Avenida de Ramón y Cajal',
      'Calle Enramadilla',
      'Avenida de Carlos V',
      'Plaza de Don Juan de Austria',
      'Calle Paseo de Catalina de Ribera',
      'Calle Cano y Cueto',
      'Calle Santa María la Blanca',
      'Calle San José',
      'Plaza Nuestro Padre Jesús de la Salud',
      'Calle Muñoz y Pabón',
      'Calle Cabeza del Rey Don Pedro',
      'Calle Candilejo',
      'Calle Alfalfa',
      'Calle Jesús de las Tres Caídas',
      'Cuesta del Rosario',
      'Calle Villegas',
      'Plaza del Salvador',
      'Calle Sagasta',
      'Calle Jovellanos',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'CARRERA OFICIAL IDA',
      'Calle Miguel Mañara',
      'Plaza de La Contratación',
      'Calle San Gregorio',
      'Plaza Puerta de Jerez',
      'Calle San Fernando',
      'Plaza de Don Juan de Austria',
      'Avenida de Carlos V',
      'Calle Enramadilla',
      'Calle Virgen del Sol',
    ],
  },
  {
    id_hdad: 57,
    nombre: 'Los Servitas',
    calles: [
      'Calle Siete Dolores de Nuestra Señora',
      'Plaza de San Marcos',
      'Calle Bustos Tavera',
      'Calle Doña María Coronel',
      'Calle Dueñas',
      'Calle Santa Ángela de la Cruz',
      'Calle Alcázares',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Calle Jesús de las Tres Caídas',
      'Calle Odreros',
      'Calle Boteros',
      'Calle Sales y Ferré',
      'Plaza del Cristo de Burgos',
      'Calle Doña María Coronel',
      'Calle Bustos Tavera',
      'Plaza de San Marcos',
      'Calle Vergara',
      'Plaza de Santa Isabel',
      'Calle Siete Dolores de Nuestra Señora',
    ],
  },
  {
    id_hdad: 58,
    nombre: 'La Trinidad',
    calles: [
      'Calle María Auxiliadora',
      'Calle Mateos',
      'Calle Valle',
      'Calle Jáuregui',
      'Plaza de Ponce de León',
      'Calle Juan de Mesa',
      'Calle Almirante Apodaca',
      'Plaza de San Pedro',
      'Calle Imagen',
      'Plaza de la Encarnación',
      'Calle Laraña',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Calle Jesús de las Tres Caídas',
      'Calle Odreros',
      'Calle Boteros',
      'Plaza de San Ildefonso',
      'Calle Zamudio',
      'Plaza de San Leandro',
      'Calle Francisco Carrión Mejías',
      'Calle Juan de Mesa',
      'Plaza de Ponce de León',
      'Calle Jáuregui',
      'Calle Valle',
      'Calle Verónica',
      'Calle Cristo de las Cinco Llagas',
      'Calle Sol',
      'Calle Madre Isabel de la Trinidad',
      'Calle María Auxiliadora',
    ],
  },
  {
    id_hdad: 59,
    nombre: 'Santo Entierro',
    calles: [
      'Calle Alfonso XII',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Hernando Colón',
      'Plaza de San Francisco',
      'Plaza Nueva',
      'Calle Tetuán',
      'Calle Velázquez',
      "Calle O'Donnell",
      'La Campana',
      'Calle Alfonso XII',
    ],
  },
  {
    id_hdad: 60,
    nombre: 'Soledad de San Lorenzo',
    calles: [
      'Plaza de San Lorenzo',
      'Calle Conde de Barajas',
      'Plaza de Jesús del Gran Poder',
      'Calle San Miguel',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Calle Chapineros',
      'Calle Álvarez Quintero',
      'Plaza del Salvador',
      'Calle Cuna',
      'Calle Orfila',
      'Calle Javier Lasso de la Vega',
      'Calle Aponte',
      'Plaza de Jesús del Gran Poder',
      'Calle Las Cortes',
      'Plaza de La Concordia',
      'Plaza de la Gavidia',
      'Calle Cardenal Spínola',
      'Plaza de San Lorenzo',
    ],
  },

  // ── DOMINGO DE RESURRECCIÓN ──────────────────────────────────────────────────
  {
    id_hdad: 61,
    nombre: 'La Resurrección',
    calles: [
      'Calle San Luis',
      'Calle Arrayán',
      'Calle Virgen del Carmen Dolorosa',
      'Plaza del Cronista',
      'Calle San Blas',
      'Calle Infantes',
      'Calle Almirante Espinosa',
      'Plaza de Monte Sión',
      'Calle Feria',
      'Calle Conde de Torrejón',
      'Calle Amor de Dios',
      'Alameda de Hércules',
      'Calle Trajano',
      'CARRERA OFICIAL IDA',
      'Calle Cardenal Carlos Amigo',
      'Calle Alemanes',
      'Calle Álvarez Quintero',
      'Calle Argote de Molina',
      'Calle Placentines',
      'Calle Francos',
      'Cuesta del Rosario',
      'Calle Jesús de las Tres Caídas',
      'Calle Odreros',
      'Calle Boteros',
      'Calle Sales y Ferré',
      'Plaza del Cristo de Burgos',
      'Calle Doña María Coronel',
      'Calle Bustos Tavera',
      'Plaza de San Marcos',
      'Calle San Luis',
    ],
  },
];

const ITINERARIOS = { 2025: ITINERARIOS_2025 };

// ─── CLI ───────────────────────────────────────────────────────────────────

const [,, anioArg, ...flags] = process.argv;
const anio = parseInt(anioArg);
if (!anio || !ITINERARIOS[anio]) {
  console.error(`Uso: node scripts/calcular-recorridos.mjs <anio>\nAños disponibles: ${Object.keys(ITINERARIOS).join(', ')}`);
  process.exit(1);
}

const diaFlag    = flags.includes('--dia')    ? flags[flags.indexOf('--dia')    + 1] : null;
const idFlag     = flags.includes('--id')     ? flags[flags.indexOf('--id')     + 1].split(',').map(Number) : null;
const geoJsonFlag = flags.includes('--geojson');

let hermandades = ITINERARIOS[anio];
if (diaFlag) {
  const hdades = JSON.parse(readFileSync(join(dataDir, 'hermandades.json'), 'utf8'));
  const ids = hdades.filter(h => h.dia === diaFlag).map(h => h.id_hdad);
  hermandades = hermandades.filter(h => ids.includes(h.id_hdad));
  if (!hermandades.length) { console.error(`Sin itinerarios para el día: ${diaFlag}`); process.exit(1); }
}
if (idFlag) {
  hermandades = hermandades.filter(h => idFlag.includes(h.id_hdad));
}

// ─── Main ──────────────────────────────────────────────────────────────────

const indice = await cargarIndice();

// ─── Modo --geojson: exporta waypoints geocodificados sin llamar a OSRM ────
// Uso: node scripts/calcular-recorridos.mjs 2025 --geojson
//      node scripts/calcular-recorridos.mjs 2025 --id 5,12 --geojson
// Abre el archivo generado en https://geojson.io para visualizar y editar.
if (geoJsonFlag) {
  const hdadesMeta = new Map(
    JSON.parse(readFileSync(join(dataDir, 'hermandades.json'), 'utf8')).map(h => [h.id_hdad, h])
  );
  const slugNombre = (s) => s.toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const outDir = join(__dir, `geojson-${anio}`);
  mkdirSync(outDir, { recursive: true });

  for (const hdad of hermandades) {
    process.stdout.write(`→ ${hdad.nombre}…`);
    const nombres = expandir(hdad.calles);
    const waypoints = [];
    for (const nombre of nombres) {
      const pt = geocodeLocal(nombre, indice);
      if (!pt) continue;
      const pts = Array.isArray(pt) ? pt : [pt];
      for (const p of pts) waypoints.push({ calle: nombre, lon: p.lon, lat: p.lat, osm: p.osm ?? '' });
    }
    if (waypoints.length < 2) { console.log(' (sin puntos)'); continue; }
    const meta = hdadesMeta.get(hdad.id_hdad) ?? {};
    const features = [
      // Línea conectando waypoints en orden
      {
        type: 'Feature',
        properties: { id_hdad: hdad.id_hdad, nombre: hdad.nombre, dia: meta.dia ?? '' },
        geometry: { type: 'LineString', coordinates: waypoints.map(p => [p.lon, p.lat]) },
      },
      // Un punto por waypoint para identificar cada calle
      ...waypoints.map((p) => ({
        type: 'Feature',
        properties: { id_hdad: hdad.id_hdad, hermandad: hdad.nombre, calle: p.calle, osm: p.osm },
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      })),
    ];
    const fileName = `${String(hdad.id_hdad).padStart(2, '0')}-${slugNombre(hdad.nombre)}.geojson`;
    writeFileSync(join(outDir, fileName), JSON.stringify({ type: 'FeatureCollection', features }));
    console.log(` ${waypoints.length} puntos → ${fileName}`);
  }
  console.log(`\nArchivos guardados en: ${outDir}`);
  console.log(`→ Abre cada uno en https://geojson.io para visualizar y editar waypoints.`);
  process.exit(0);
}

const outputFile = join(dataDir, `recorridos-${anio}.json`);
const existentes = existsSync(outputFile) ? JSON.parse(readFileSync(outputFile, 'utf8')) : [];
const resultados = [...existentes];

for (const hdad of hermandades) {
  const yaCalculado = resultados.find(r => r.id_hdad === hdad.id_hdad);
  if (yaCalculado) {
    console.log(`✓ ${hdad.nombre} — ya calculado (${yaCalculado.metros.toLocaleString('es-ES')} m)`);
    continue;
  }

  console.log(`\n→ ${hdad.nombre} (id=${hdad.id_hdad})`);
  const nombres = expandir(hdad.calles);
  const puntos = [];
  const noEncontrados = [];

  for (const nombre of nombres) {
    const pt = geocodeLocal(nombre, indice);
    if (pt) {
      if (Array.isArray(pt)) {
        for (const p of pt) puntos.push(p);
        process.stdout.write(`  ✓ ${nombre} → ${pt.length} waypoints (${pt.map(p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(' → ')})\n`);
      } else {
        process.stdout.write(`  ✓ ${nombre} → "${pt.osm}" (${pt.lat.toFixed(5)}, ${pt.lon.toFixed(5)})\n`);
        puntos.push(pt);
      }
    } else {
      process.stdout.write(`  ⚠ ${nombre} → no encontrado\n`);
      noEncontrados.push(nombre);
    }
  }

  if (noEncontrados.length) {
    console.log(`\n  Sin geocodificar (${noEncontrados.length}): ${noEncontrados.join(', ')}`);
  }

  if (puntos.length < 3) {
    console.log(`  ✗ Muy pocos puntos (${puntos.length}), saltando`);
    continue;
  }

  console.log(`\n  Calculando ruta OSRM con ${puntos.length}/${nombres.length} puntos...`);
  try {
    const metros = await rutaOSRM(puntos);
    console.log(`  ✓ Distancia: ${metros.toLocaleString('es-ES')} m`);
    resultados.push({
      id_hdad: hdad.id_hdad,
      metros,
      fuente: `Itinerario oficial Consejo ${anio}, calculado con OSRM foot`,
      notas: noEncontrados.length ? `Calles sin geocodificar: ${noEncontrados.join('; ')}` : '',
    });
    resultados.sort((a, b) => a.id_hdad - b.id_hdad);
    writeFileSync(outputFile, JSON.stringify(resultados, null, 2));
  } catch (e) {
    console.error(`  ✗ Error OSRM: ${e.message}`);
  }
}

console.log(`\nListo. ${resultados.length} hermandad(es) en ${outputFile}`);
