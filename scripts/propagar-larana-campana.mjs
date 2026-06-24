/**
 * Propaga el tramo Laraña→Campana corregido de 22-san-benito.geojson
 * a los archivos que usan el mismo recorrido (Orfila→Lasso→Trajano→Duque).
 *
 * No toca: 02-la-cena, 41-el-valle (van por Fernando de Herrera/Gran Poder),
 * ni los archivos donde Laraña está en la vuelta (08, 27, 39).
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, 'geojson-2025');

// === Segmento canónico Laraña→pre-Campana (de 22-san-benito, verificado manualmente) ===
const NUEVO_LARANA_CAMPANA = [
  [-5.992981, 37.392804],  // Laraña
  [-5.993644, 37.39282],
  [-5.9937,   37.393434],  // Orfila
  [-5.993802, 37.393688],
  [-5.994752, 37.393518],  // Javier Lasso de la Vega
  [-5.995283, 37.393895],
  [-5.995408, 37.393656],  // Trajano
  [-5.995613, 37.39343],
  [-5.995634, 37.39313],   // Plaza del Duque (lado derecho)
  [-5.995631, 37.392901],
  [-5.99564,  37.392719],  // entrada La Campana
];

// Coordenadas de referencia de los Points (de 22-san-benito)
const PUNTOS_REF = {
  'Calle Laraña':                         [-5.992981, 37.392804],
  'Calle Orfila':                          [-5.993689, 37.393287],
  'Calle Javier Lasso de la Vega':         [-5.994575, 37.393545],
  'Calle Trajano':                         [-5.99537,  37.393742],
  'Plaza del Duque de la Victoria':        [-5.99564,  37.393105],
  'Plaza del Duque de la Victoria (lado derecho)': [-5.99564, 37.393105],
  'La Campana':                            [-5.995376, 37.392725],
};

const OLD_LARANA  = [-5.9929812, 37.3928036];
const CANONICAL_0 = [-5.995547,  37.392722];

const ARCHIVOS = [
  '06-san-roque',
  '11-redencion',
  '20-san-esteban',
  '29-la-sed',
  '34-cristo-de-burgos',
  '37-la-exaltacion',
  '38-las-cigarreras',
  '48-los-gitanos',
  '57-los-servitas',
  '58-la-trinidad',
];

function cerca(a, b, tol = 0.00002) {
  return Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol;
}

let ok = 0, err = 0;

for (const nombre of ARCHIVOS) {
  const ruta = path.join(dir, `${nombre}.geojson`);
  const fc = JSON.parse(readFileSync(ruta, 'utf8'));

  // --- LineString ---
  const lineFeature = fc.features.find(f => f.geometry.type === 'LineString');
  const coords = lineFeature.geometry.coordinates;

  const laIdx = coords.findIndex(c => cerca(c, OLD_LARANA));
  const caIdx = coords.findIndex(c => cerca(c, CANONICAL_0, 0.0001));

  if (laIdx < 0 || caIdx < 0 || laIdx >= caIdx) {
    console.error(`⚠️  ${nombre}: Laraña@${laIdx} canonical@${caIdx} — saltado`);
    err++;
    continue;
  }

  // Reemplaza [laIdx, caIdx) con el nuevo segmento
  const newCoords = [
    ...coords.slice(0, laIdx),
    ...NUEVO_LARANA_CAMPANA,
    ...coords.slice(caIdx),
  ];
  lineFeature.geometry.coordinates = newCoords;

  // --- Point features ---
  for (const feat of fc.features) {
    if (feat.geometry.type !== 'Point') continue;
    const calle = feat.properties.calle || '';
    if (PUNTOS_REF[calle]) {
      feat.geometry.coordinates = PUNTOS_REF[calle];
    }
  }

  writeFileSync(ruta, JSON.stringify(fc), 'utf8');
  const delta = newCoords.length - coords.length;
  console.log(`✓ ${nombre}: ${coords.length} → ${newCoords.length} coords (${delta > 0 ? '+' : ''}${delta})`);
  ok++;
}

console.log(`\nActualizados: ${ok} | Errores: ${err}`);
