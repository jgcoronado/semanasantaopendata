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

// Puntos de La Quinta Angustia a propagar (coordenadas canónicas)
const PUNTOS_QUINTA = [
  { calle: 'Calle San Pablo',              coords: [-5.9982008, 37.3902826] },
  { calle: 'Plaza de la Magdalena',        coords: [-5.9968379, 37.390749] },
  { calle: 'Calle Rioja',                  coords: [-5.9957878, 37.3909944] },
  { calle: 'Plaza de Molviedro',           coords: [-5.9977813, 37.3878196] },
  { calle: 'Calle Doña Guiomar',           coords: [-5.9976929, 37.3878993] },
  { calle: 'Calle Zaragoza',               coords: [-5.9980142, 37.3885566] },
  { calle: 'Calle Fray Ceferino González', coords: [-5.9931263, 37.3851399] },
];

const TOLERANCIA = 0.0015;

function dist(a, b) {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2);
}

function lineStringPasaPor(coords, punto) {
  return coords.some(c => dist(c, punto) < TOLERANCIA);
}

const archivos = readdirSync(DIR).filter(f => f.endsWith('.geojson') && !EDITADOS.has(f)).sort();

let totalModificados = 0;
let totalPuntosAñadidos = 0;

for (const archivo of archivos) {
  const ruta = join(DIR, archivo);
  const data = JSON.parse(readFileSync(ruta, 'utf8'));

  const lineFeature = data.features.find(f => f.geometry.type === 'LineString');
  if (!lineFeature) continue;

  const coords = lineFeature.geometry.coordinates;
  const props = lineFeature.properties;
  const idHdad = props.id_hdad;
  // Obtener nombre de hermandad de las props del LineString (campo 'nombre')
  const nombreHdad = props.nombre || props.hermandad || archivo.replace(/^\d+-/, '').replace('.geojson', '');

  // Calles ya presentes como Point features
  const callesExistentes = new Set(
    data.features
      .filter(f => f.geometry.type === 'Point')
      .map(f => f.properties.calle)
  );

  const nuevosFeatures = [];
  for (const p of PUNTOS_QUINTA) {
    if (callesExistentes.has(p.calle)) continue;
    if (!lineStringPasaPor(coords, p.coords)) continue;

    nuevosFeatures.push({
      type: 'Feature',
      properties: {
        id_hdad: idHdad,
        hermandad: nombreHdad,
        calle: p.calle,
        osm: p.calle,
      },
      geometry: {
        type: 'Point',
        coordinates: p.coords,
      },
    });
  }

  if (nuevosFeatures.length === 0) continue;

  data.features.push(...nuevosFeatures);
  writeFileSync(ruta, JSON.stringify(data), 'utf8');
  totalModificados++;
  totalPuntosAñadidos += nuevosFeatures.length;
  console.log(`✅ ${archivo}: +${nuevosFeatures.length} puntos → ${nuevosFeatures.map(f => f.properties.calle).join(', ')}`);
}

console.log(`\n✔ ${totalModificados} archivos modificados, ${totalPuntosAñadidos} puntos añadidos.`);
