import { readFileSync, readdirSync } from 'fs';
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

// Puntos de referencia de La Quinta Angustia (NUEVOS, no propagados aún)
const PUNTOS_NUEVOS = [
  { calle: 'Calle San Pablo',           coords: [-5.9982008, 37.3902826] },
  { calle: 'Plaza de la Magdalena',     coords: [-5.9968379, 37.390749] },
  { calle: 'Calle Rioja',               coords: [-5.9957878, 37.3909944] },
  { calle: 'Plaza de Molviedro',        coords: [-5.9977813, 37.3878196] },
  { calle: 'Calle Doña Guiomar',        coords: [-5.9976929, 37.3878993] },
  { calle: 'Calle Zaragoza',            coords: [-5.9980142, 37.3885566] },
  { calle: 'Calle Fray Ceferino González', coords: [-5.9931263, 37.3851399] },
];

// Ya propagadas (incluidas también por Quinta Angustia pero ya existentes)
const PUNTOS_YA_PROPAGADOS = [
  { calle: 'Calle Velázquez',           coords: [-5.9954323, 37.3915334] },
  { calle: "Calle O'Donnell",           coords: [-5.9954302, 37.3922483] },
  { calle: 'La Campana',                coords: [-5.9953759, 37.3927251] },
  { calle: 'Calle Sierpes',             coords: [-5.9944906, 37.3907418] },
  { calle: 'Plaza de San Francisco',    coords: [-5.9941544, 37.3886604] },
  { calle: 'Avenida de la Constitución',coords: [-5.9936639, 37.3834745] },
  { calle: 'Calle Almirantazgo',        coords: [-5.9943022, 37.385129] },
  { calle: 'Calle Arco del Postigo',    coords: [-5.9949572, 37.3852368] },
  { calle: 'Calle Dos de Mayo',         coords: [-5.9951972, 37.385176] },
  { calle: 'Calle Arfe',                coords: [-5.9953472, 37.3853603] },
  { calle: 'Calle Puerta del Arenal',   coords: [-5.9961081, 37.3862154] },
  { calle: 'Calle Castelar',            coords: [-5.9972329, 37.3872018] },
];

const TOLERANCIA = 0.0015; // ~150m

function distancia(a, b) {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2);
}

function lineStringPasaPor(coords, punto) {
  return coords.some(c => distancia(c, punto) < TOLERANCIA);
}

const archivos = readdirSync(DIR).filter(f => f.endsWith('.geojson') && !EDITADOS.has(f)).sort();

const resultados = {};

for (const archivo of archivos) {
  const data = JSON.parse(readFileSync(join(DIR, archivo), 'utf8'));
  const lineFeature = data.features.find(f => f.geometry.type === 'LineString');
  if (!lineFeature) continue;

  const coords = lineFeature.geometry.coordinates;
  const callesMatch = [];

  for (const p of PUNTOS_NUEVOS) {
    if (lineStringPasaPor(coords, p.coords)) {
      callesMatch.push(p.calle);
    }
  }

  // También verificar cuáles ya propagadas tiene para saber si hay punto duplicado ya
  const existingPoints = data.features
    .filter(f => f.geometry.type === 'Point')
    .map(f => f.properties.calle);

  if (callesMatch.length > 0) {
    resultados[archivo] = {
      callesFaltantes: callesMatch.filter(c => !existingPoints.includes(c)),
      callesYaTiene: callesMatch.filter(c => existingPoints.includes(c)),
    };
  }
}

console.log('\n=== HERMANDADES QUE PASAN POR CALLES NUEVAS DE LA QUINTA ANGUSTIA ===\n');
for (const [archivo, info] of Object.entries(resultados)) {
  const nombre = archivo.replace('.geojson', '');
  console.log(`\n📍 ${nombre}`);
  if (info.callesFaltantes.length > 0)
    console.log(`   FALTA añadir: ${info.callesFaltantes.join(', ')}`);
  if (info.callesYaTiene.length > 0)
    console.log(`   Ya tiene:     ${info.callesYaTiene.join(', ')}`);
}

console.log('\n=== RESUMEN ===');
const totalArchivos = Object.keys(resultados).length;
console.log(`${totalArchivos} hermandades necesitan actualización`);

// Agrupa por calle
const porCalle = {};
for (const [archivo, info] of Object.entries(resultados)) {
  for (const calle of info.callesFaltantes) {
    if (!porCalle[calle]) porCalle[calle] = [];
    porCalle[calle].push(archivo.replace('.geojson', ''));
  }
}
console.log('\nPor calle:');
for (const [calle, archivos] of Object.entries(porCalle)) {
  console.log(`  ${calle}: ${archivos.join(', ')}`);
}
