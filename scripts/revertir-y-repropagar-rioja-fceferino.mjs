/**
 * 1. Elimina de todos los GeoJSON (no editados) los Point features que añadimos
 *    con coordenadas exactas de La Quinta Angustia para Calle Rioja y Fray Ceferino González.
 * 2. Vuelve a añadirlos solo donde la ruta realmente los recorre, con criterios precisos:
 *    - Rioja: el linestring pasa por Magdalena ANTES que por Rioja (ruta oeste→este,
 *             no Trajano que viene del norte y cruza Rioja perpendicularmente)
 *    - Fray Ceferino: tolerancia muy ajustada (≈50m) — la calle es paralela y muy
 *             próxima a Almirantazgo, pero solo la recorren las que salen de la Catedral
 *             hacia Plaza del Triunfo y siguen al oeste hacia Almirantazgo
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIR = './scripts/geojson-2025/';
const EDITADOS = new Set([
  '01-la-borriquita.geojson',
  '05-la-paz.geojson',
  '07-la-estrella.geojson',
  '08-la-amargura.geojson',
  '22-san-benito.geojson',
  '30-san-bernardo.geojson',
  '40-la-quinta-angustia.geojson',
]);

// Coordenadas exactas que añadimos de La Quinta Angustia — son las que hay que revertir
const RIOJA_COORDS = [-5.9957878, 37.3909944];
const FCEFERINO_COORDS = [-5.9931263, 37.3851399];

// Coordenadas de referencia para detección precisa
const MAGDALENA_REF  = [-5.9968379, 37.390749];   // Plaza de la Magdalena
const RIOJA_REF      = [-5.9957878, 37.3909944];  // Calle Rioja
const FCEFERINO_REF  = [-5.9931263, 37.3851399];  // Calle Fray Ceferino González

const TOLS = {
  magdalena:  0.0015,  // 150 m
  rioja:      0.0015,  // 150 m  — se usa solo con el criterio de orden
  fceferino:  0.0005,  // ~50 m — muy ajustado: la calle es diminuta
};

function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

function closestIndex(coords, punto, tol) {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = dist(coords[i], punto);
    if (d < tol && d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function usaRioja(coords) {
  // Rioja solo si Magdalena aparece ANTES en el linestring y el movimiento es hacia el este
  const iMag  = closestIndex(coords, MAGDALENA_REF, TOLS.magdalena);
  const iRioja = closestIndex(coords, RIOJA_REF, TOLS.rioja);
  if (iMag === -1 || iRioja === -1) return false;
  if (iMag >= iRioja) return false; // Magdalena debe ir antes
  // El movimiento de Magdalena a Rioja debe ser predominantemente hacia el este
  // (longitud menos negativa = más al este)
  const lonMag   = coords[iMag][0];
  const lonRioja = coords[iRioja][0];
  return lonRioja > lonMag; // más al este
}

function usaFrayCeferino(coords) {
  // Tolerancia muy ajustada: ~50 m
  return closestIndex(coords, FCEFERINO_REF, TOLS.fceferino) !== -1;
}

function coordIguales(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

const archivos = readdirSync(DIR)
  .filter(f => f.endsWith('.geojson') && !EDITADOS.has(f))
  .sort();

let revertidos = 0;
let reañadidos = 0;
let noAñadidos = 0;

for (const archivo of archivos) {
  const ruta = join(DIR, archivo);
  const data = JSON.parse(readFileSync(ruta, 'utf8'));

  const lineFeature = data.features.find(f => f.geometry.type === 'LineString');
  if (!lineFeature) continue;

  const coords = lineFeature.geometry.coordinates;
  const props = lineFeature.properties;
  const idHdad = props.id_hdad;
  const nombreHdad = props.nombre || props.hermandad || archivo.replace(/^\d+-/, '').replace('.geojson', '');

  // 1. Eliminar puntos que añadimos (coords exactas de Quinta Angustia)
  const antes = data.features.length;
  data.features = data.features.filter(f => {
    if (f.geometry.type !== 'Point') return true;
    const c = f.geometry.coordinates;
    if (coordIguales(c, RIOJA_COORDS) && f.properties.calle === 'Calle Rioja') return false;
    if (coordIguales(c, FCEFERINO_COORDS) && f.properties.calle === 'Calle Fray Ceferino González') return false;
    return true;
  });
  const eliminados = antes - data.features.length;
  if (eliminados > 0) revertidos += eliminados;

  // 2. Comprobar si ya tiene cada calle (puede haberla tenido antes con otras coords)
  const callesExistentes = new Set(
    data.features.filter(f => f.geometry.type === 'Point').map(f => f.properties.calle)
  );

  const añadir = [];

  if (!callesExistentes.has('Calle Rioja') && usaRioja(coords)) {
    añadir.push({ calle: 'Calle Rioja', coords: RIOJA_COORDS });
  }
  if (!callesExistentes.has('Calle Fray Ceferino González') && usaFrayCeferino(coords)) {
    añadir.push({ calle: 'Calle Fray Ceferino González', coords: FCEFERINO_COORDS });
  }

  for (const p of añadir) {
    data.features.push({
      type: 'Feature',
      properties: { id_hdad: idHdad, hermandad: nombreHdad, calle: p.calle, osm: p.calle },
      geometry: { type: 'Point', coordinates: p.coords },
    });
    reañadidos++;
  }

  if (eliminados > 0 || añadir.length > 0) {
    writeFileSync(ruta, JSON.stringify(data), 'utf8');
  }

  // Log solo los que cambian respecto a la primera propagación
  if (eliminados > 0 && añadir.length < eliminados) {
    const callesQuitadas = eliminados - añadir.length;
    noAñadidos += callesQuitadas;
    const quitadas = [];
    if (eliminados > añadir.length) {
      // Alguna calle se quitó y no se reañadió
      const antes_set = new Set();
      if (eliminados >= 1) antes_set.add('Calle Rioja');
      if (eliminados >= 2 || (eliminados === 1 && !usaRioja(coords))) antes_set.add('Calle Fray Ceferino González');
    }
    console.log(`🔁 ${archivo}: eliminados ${eliminados}, reañadidos ${añadir.length}${añadir.length > 0 ? ' (' + añadir.map(p=>p.calle).join(', ') + ')' : ''}`);
  } else if (añadir.length > 0 && eliminados === 0) {
    console.log(`➕ ${archivo}: +${añadir.map(p=>p.calle).join(', ')}`);
  }
}

console.log(`\n✔ Revertidos: ${revertidos} puntos | Reañadidos correctamente: ${reañadidos} | Eliminados en total: ${revertidos - reañadidos}`);
