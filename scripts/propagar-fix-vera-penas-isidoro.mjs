/**
 * Corrige 15-vera-cruz, 16-las-penas y 53-san-isidoro:
 *
 * 1. Plaza del Duque Point: el script anterior les puso "(lado derecho)" por
 *    el bug de tolerancia; las tres van vía Gran Poder → restaurar a canónico.
 *
 * 2. LineString: sustituye el tramo OSRM malo
 *    [-5.9924834,37.3870654] → [-5.9927104,37.388333]
 *    por el segmento canónico Cardenal Carlos Amigo→Francos de 08-la-amargura.
 *
 * 3. Points: añade los puntos de referencia que faltan (Alemanes, Álvarez
 *    Quintero, Argote de Molina) antes del punto de Placentines.
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, 'geojson-2025');

const CANONICO_CARDENAL = [
  [-5.992325, 37.386077],
  [-5.992343, 37.386298],
  [-5.992461, 37.386331],
  [-5.992523, 37.386502],
  [-5.992520, 37.386657],
  [-5.992542, 37.386755],
  [-5.992745, 37.386784],  // Alemanes
  [-5.993037, 37.386751],
  [-5.993054, 37.386952],  // Álvarez Quintero
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

const PUNTOS_A_AÑADIR = [
  { calle: 'Calle Alemanes',        osm: 'Calle Alemanes',        coords: [-5.992807, 37.386777] },
  { calle: 'Calle Álvarez Quintero', osm: 'Calle Álvarez Quintero', coords: [-5.993054, 37.386917] },
  { calle: 'Calle Argote de Molina', osm: 'Calle Argote de Molina', coords: [-5.992697, 37.387288] },
];

const ENTRADA    = [-5.99271, 37.386038];
const BAD_INTER  = [-5.9924834, 37.3870654];
const BAD_FRANCOS = [-5.9927104, 37.388333];

const DUQUE_GRAN_PODER = {
  calle:  'Plaza del Duque de la Victoria',
  coords: [-5.996046, 37.393115],
};

function cerca(a, b, tol = 0.00005) {
  return Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol;
}

const TARGETS = ['15-vera-cruz', '16-las-penas', '53-san-isidoro'];

for (const nombre of TARGETS) {
  const ruta = path.join(dir, `${nombre}.geojson`);
  const fc = JSON.parse(readFileSync(ruta, 'utf8'));

  // ── 1. Plaza del Duque Point → Gran Poder ────────────────────
  for (const feat of fc.features) {
    if (feat.geometry.type !== 'Point') continue;
    if ((feat.properties.calle || '').includes('Duque de la Victoria')) {
      feat.properties.calle = DUQUE_GRAN_PODER.calle;
      feat.properties.osm   = DUQUE_GRAN_PODER.calle;
      feat.geometry.coordinates = DUQUE_GRAN_PODER.coords;
      console.log(`  ${nombre}: Plaza del Duque → Gran Poder`);
    }
  }

  // ── 2. LineString: sustituir tramo malo ───────────────────────
  const ls = fc.features.find(f => f.geometry.type === 'LineString');
  const coords = ls.geometry.coordinates;

  const entradaIdx    = coords.findIndex(c => cerca(c, ENTRADA));
  const badInterIdx   = coords.findIndex(c => cerca(c, BAD_INTER, 0.00005));
  const badFrancosIdx = coords.findIndex(c => cerca(c, BAD_FRANCOS, 0.00002));

  if (entradaIdx >= 0 && badInterIdx === entradaIdx + 1 && badFrancosIdx === entradaIdx + 2) {
    const nuevas = [
      ...coords.slice(0, badInterIdx),
      ...CANONICO_CARDENAL,
      ...coords.slice(badFrancosIdx + 1),
    ];
    ls.geometry.coordinates = nuevas;
    console.log(`  ${nombre}: LineString ${coords.length} → ${nuevas.length} coords`);
  } else {
    console.warn(`  ${nombre}: ⚠ patrón no encontrado (entrada=${entradaIdx}, inter=${badInterIdx}, francos=${badFrancosIdx})`);
  }

  // ── 3. Añadir Points faltantes (antes de Placentines) ─────────
  const existentes = new Set(
    fc.features.filter(f => f.geometry.type === 'Point').map(f => f.properties.calle)
  );
  const primerPunto = fc.features.find(f => f.geometry.type === 'Point');
  const id_hdad   = primerPunto?.properties.id_hdad;
  const hermandad = primerPunto?.properties.hermandad;

  for (const p of PUNTOS_A_AÑADIR) {
    if (existentes.has(p.calle)) continue;

    const placentinesIdx = fc.features.findIndex(
      f => f.geometry.type === 'Point' && f.properties.calle === 'Calle Placentines'
    );
    const nuevoFeat = {
      type: 'Feature',
      properties: { id_hdad, hermandad, calle: p.calle, osm: p.osm },
      geometry: { type: 'Point', coordinates: p.coords },
    };
    if (placentinesIdx >= 0) {
      fc.features.splice(placentinesIdx, 0, nuevoFeat);
    } else {
      fc.features.push(nuevoFeat);
    }
    existentes.add(p.calle);
    console.log(`  ${nombre}: + ${p.calle}`);
  }

  writeFileSync(ruta, JSON.stringify(fc), 'utf8');
  console.log(`  ${nombre}: guardado ✓`);
}
