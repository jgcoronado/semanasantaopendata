/**
 * Propaga el tramo Cardenal Carlos Amigo→Alemanes→Álvarez Quintero→Argote
 * de Molina→Placentines→Francos corregido de 08-la-amargura.geojson
 * a todos los archivos que tienen las coordenadas OSRM erróneas.
 *
 * También corrige la etiqueta de Plaza del Duque:
 *  - Vía Trajano (lon ≈ -5.9956): "Plaza del Duque de la Victoria (lado derecho)"
 *  - Vía Gran Poder (lon ≈ -5.9960): "Plaza del Duque de la Victoria"
 *
 * Y simplifica el trazado de Plaza del Duque (lado derecho) para las que
 * vienen por Trajano, usando el trazado canónico de La Amargura.
 *
 * NO toca: 01-la-borriquita, 07-la-estrella, 08-la-amargura, 22-san-benito
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, 'geojson-2025');

const SKIP = new Set([
  '01-la-borriquita',
  '07-la-estrella',
  '08-la-amargura',
  '22-san-benito',
]);

// ─────────────────────────────────────────────────────────────
// Segmento canónico Cardenal Carlos Amigo → Francos (de 08-la-amargura)
// Se inserta DESPUÉS de [-5.99271, 37.386038] (entrada a Cardenal Carlos Amigo)
// ─────────────────────────────────────────────────────────────
const CANONICO_CARDENAL = [
  [-5.992325, 37.386077],
  [-5.992343, 37.386298],
  [-5.992461, 37.386331],
  [-5.992523, 37.386502],
  [-5.992520, 37.386657],
  [-5.992542, 37.386755],
  [-5.992745, 37.386784],  // Alemanes
  [-5.993037, 37.386751],
  [-5.993054, 37.386952],  // Álvarez Quintero (dobla hacia el norte)
  [-5.992903, 37.387134],
  [-5.992485, 37.387448],  // Argote de Molina
  [-5.992658, 37.387808],  // Placentines
  [-5.992770, 37.388079],
  [-5.992774, 37.388353],
  [-5.992739, 37.388594],
  [-5.992652, 37.388762],
  [-5.992579, 37.389047],
  [-5.992548, 37.389396],
  [-5.992496, 37.389533],
  [-5.992354, 37.389739],  // fin del tramo Francos
];

// Puntos de referencia (de 08-la-amargura)
const PUNTOS_CARDENAL_REF = {
  'Calle Cardenal Carlos Amigo': [-5.992537, 37.386555],
  'Calle Alemanes':              [-5.992807, 37.386777],
  'Calle Álvarez Quintero':      [-5.993054, 37.386917],
  'Calle Argote de Molina':      [-5.992697, 37.387288],
  'Calle Placentines':           [-5.992594, 37.387654],
  'Calle Francos':               [-5.992765, 37.388268],
};

// ─────────────────────────────────────────────────────────────
// Coordenada de entrada al tramo Cardenal Carlos Amigo (ancla de inicio)
// ─────────────────────────────────────────────────────────────
const ENTRADA_CARDENAL = [-5.99271, 37.386038];

// Coordenada OSRM errónea de Alemanes (identifica el tramo a sustituir)
const BAD_ALEMANES = [-5.9940816, 37.3866707];

// Coordenada OSRM errónea de Francos (último punto del tramo malo)
const BAD_FRANCOS = [-5.9927104, 37.388333];

// ─────────────────────────────────────────────────────────────
// Plaza del Duque (lado derecho) — trazado canónico para vía Trajano
// Se usa para simplificar el trazado de los archivos de San Benito
// Ancla de inicio: el punto ~[-5.995613, 37.39343] (penúltimo antes del vértice)
// ─────────────────────────────────────────────────────────────
const DUQUE_TRAJANO_OLD_CORNER = [-5.995613, 37.39343]; // coord previa al vértice (San Benito style)
const DUQUE_TRAJANO_CANONICO_POST = [
  // Se insertan DESPUÉS de la coord ancla (que se actualiza a la versión de Amargura)
  [-5.995644, 37.393115],  // vértice Plaza del Duque (lado derecho)
  [-5.995643, 37.392720],  // salida hacia La Campana
  [-5.994924, 37.392751],  // La Campana
];
// La coord ancla actualizada (de Amargura)
const DUQUE_TRAJANO_CORNER_NUEVO = [-5.995615, 37.39345];

// Puntos de referencia Plaza del Duque
const DUQUE_REF = {
  trajano: {
    calle: 'Plaza del Duque de la Victoria (lado derecho)',
    coords: [-5.995633, 37.393113],
  },
  gran_poder: {
    calle: 'Plaza del Duque de la Victoria',
    coords: [-5.996046, 37.393115],
  },
};

// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────
function cerca(a, b, tol = 0.00004) {
  return Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol;
}

function esViaTrajano(fc) {
  const duque = fc.features.find(
    f => f.geometry.type === 'Point' && (f.properties.calle || '').includes('Duque')
  );
  if (!duque) return false;
  // Via Trajano: lon ≈ -5.9956
  return Math.abs(duque.geometry.coordinates[0] - (-5.9956)) < 0.0006;
}

// ─────────────────────────────────────────────────────────────
// Procesar
// ─────────────────────────────────────────────────────────────
const archivos = readdirSync(dir)
  .filter(f => f.endsWith('.geojson'))
  .map(f => f.replace('.geojson', ''))
  .filter(f => !SKIP.has(f))
  .sort();

let ok = 0, sinCardenal = 0, err = 0;

for (const nombre of archivos) {
  const ruta = path.join(dir, `${nombre}.geojson`);
  const fc = JSON.parse(readFileSync(ruta, 'utf8'));

  const lineFeature = fc.features.find(f => f.geometry.type === 'LineString');
  if (!lineFeature) { console.log(`  ⚠  ${nombre}: sin LineString — saltado`); err++; continue; }

  const coords = lineFeature.geometry.coordinates;
  const viaTrajano = esViaTrajano(fc);

  // ── 1. Tramo Cardenal Carlos Amigo → Francos ──────────────
  const entradaIdx = coords.findIndex(c => cerca(c, ENTRADA_CARDENAL));
  const alemanesBadIdx = coords.findIndex(c => cerca(c, BAD_ALEMANES, 0.00002));
  const francosBadIdx = coords.findIndex(c => cerca(c, BAD_FRANCOS, 0.00002));

  let coordsNuevas = coords;
  let fixedCardenal = false;

  if (entradaIdx >= 0 && alemanesBadIdx >= 0 && francosBadIdx >= 0
      && alemanesBadIdx === entradaIdx + 1) {
    // Sustituir desde BAD_ALEMANES hasta BAD_FRANCOS (inclusive)
    coordsNuevas = [
      ...coords.slice(0, alemanesBadIdx),
      ...CANONICO_CARDENAL,
      ...coords.slice(francosBadIdx + 1),
    ];
    fixedCardenal = true;
  } else if (alemanesBadIdx >= 0) {
    console.warn(`  ⚠  ${nombre}: bad Alemanes encontrado (idx=${alemanesBadIdx}) pero anclas no encajan — saltado Cardenal`);
    err++;
  }

  // ── 2. Plaza del Duque LineString (vía Trajano: simplificar) ──
  let fixedDuque = false;
  if (viaTrajano) {
    const cornerIdx = coordsNuevas.findIndex(c => cerca(c, DUQUE_TRAJANO_OLD_CORNER));
    if (cornerIdx >= 0) {
      // Encontrar dónde empieza La Campana real [-5.994924, 37.392751]
      const campanaCanon = [-5.994924, 37.392751];
      const campanaIdx = coordsNuevas.findIndex((c, i) => i > cornerIdx && cerca(c, campanaCanon, 0.0001));
      if (campanaIdx > cornerIdx) {
        // Reemplazar [cornerIdx, campanaIdx) con el trazado canónico de Amargura
        coordsNuevas = [
          ...coordsNuevas.slice(0, cornerIdx),
          DUQUE_TRAJANO_CORNER_NUEVO,
          ...DUQUE_TRAJANO_CANONICO_POST,
          ...coordsNuevas.slice(campanaIdx + 1),
        ];
        fixedDuque = true;
      }
    }
  }

  lineFeature.geometry.coordinates = coordsNuevas;

  // ── 3. Puntos de referencia: Cardenal Carlos Amigo → Francos ──
  let fixedPuntos = 0;
  for (const feat of fc.features) {
    if (feat.geometry.type !== 'Point') continue;
    const calle = feat.properties.calle || '';
    if (PUNTOS_CARDENAL_REF[calle]) {
      feat.geometry.coordinates = PUNTOS_CARDENAL_REF[calle];
      fixedPuntos++;
    }
  }

  // ── 4. Plaza del Duque: etiqueta y coordenada del Point ────
  const ref = viaTrajano ? DUQUE_REF.trajano : DUQUE_REF.gran_poder;
  for (const feat of fc.features) {
    if (feat.geometry.type !== 'Point') continue;
    const calle = feat.properties.calle || '';
    if (calle.includes('Duque de la Victoria')) {
      feat.properties.calle = ref.calle;
      feat.properties.osm = ref.calle;
      feat.geometry.coordinates = ref.coords;
    }
  }

  writeFileSync(ruta, JSON.stringify(fc), 'utf8');

  if (!fixedCardenal && alemanesBadIdx < 0) {
    console.log(`  ○  ${nombre}: sin tramo Cardenal Carlos Amigo — no modificado`);
    sinCardenal++;
  } else {
    const viaStr = viaTrajano ? 'Trajano' : 'Gran Poder';
    const duqueStr = fixedDuque ? '+Duque' : '';
    console.log(`  ✓  ${nombre} [${viaStr}${duqueStr}]: Cardenal=${fixedCardenal ? 'ok' : 'sin cambios'}, puntos=${fixedPuntos}`);
    ok++;
  }
}

console.log(`\nActualizados: ${ok} | Sin tramo Cardenal: ${sinCardenal} | Errores/advertencias: ${err}`);
