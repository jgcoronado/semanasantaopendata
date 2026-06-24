/**
 * Reemplaza el segmento de Carrera Oficial (La Campana → Catedral) en todos los GeoJSONs
 * con las coordenadas precisas extraídas de 01-la-borriquita.geojson.
 *
 * Maneja múltiples patrones:
 *   A) 5 pts: Campana → Sierpes → PlSF → AvConst → exit  (+ variantes con exit diferente)
 *   B) 2 pts: Campana → AvConst directamente
 *   C) AvConst aparece primero (outgoing desde el sur), luego la Carrera Oficial correcta
 *      más adelante (p.ej. La Paz, Santa Genoveva, El Cerro)
 *   D) Segmento invertido antes de Campana: AvConst→PlSF→Sierpes→Campana
 *      (Jesús Despojado, La Estrella) — se elimina el segmento invertido y se inserta el
 *      canónico a partir de donde estaba
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIR = 'scripts/geojson-2025';
const SKIP = '01-la-borriquita.geojson';

const CANONICAL = [
  [-5.995547, 37.392722],
  [-5.994924, 37.392751],
  [-5.994797, 37.391803],
  [-5.994542, 37.390976],
  [-5.994258, 37.389845],
  [-5.994175, 37.389143],
  [-5.994151, 37.388605],
  [-5.994133, 37.38836],
  [-5.994169, 37.388187],
  [-5.994296, 37.388071],
  [-5.994296, 37.387946],
  [-5.993999, 37.385447],
  [-5.992619, 37.385552],
  [-5.99271,  37.386038]
];

const CAMPANA = [-5.9953759, 37.3927251];
const SIERPES  = [-5.9947885, 37.3908748];
const PLSF     = [-5.9939375, 37.3886765];
const AVCONST  = [-5.9936639, 37.3834745];

const TOL = 0.00005;

function near(a, b) {
  return Math.abs(a[0] - b[0]) < TOL && Math.abs(a[1] - b[1]) < TOL;
}

function findFrom(coords, target, from) {
  for (let i = from; i < coords.length; i++) {
    if (near(coords[i], target)) return i;
  }
  return -1;
}

// Puntos que indican inicio de la vuelta (no son exit points de la Carrera Oficial)
function isReturnStarter(pt) {
  return near(pt, PLSF) || near(pt, SIERPES);
}

const files = readdirSync(DIR)
  .filter(f => f.endsWith('.geojson') && f !== SKIP)
  .sort();

let updated = 0;
const errors = [];

for (const file of files) {
  const path = join(DIR, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const lineFeature = data.features.find(f => f.geometry?.type === 'LineString');
  if (!lineFeature) { errors.push(`${file}: sin LineString`); continue; }

  const coords = lineFeature.geometry.coordinates;
  const caIdx = findFrom(coords, CAMPANA, 0);

  if (caIdx === -1) { errors.push(`${file}: no se encontró Campana`); continue; }

  // Buscar AvConst DESPUÉS de Campana (ignore occurrences before)
  const avIdxAfter = findFrom(coords, AVCONST, caIdx + 1);

  if (avIdxAfter !== -1) {
    // La Carrera Oficial está en el orden correcto: Campana → ... → AvConst
    // Determinar cuántos puntos reemplazar (posiblemente incluyendo un exit_point)
    const afterAv = avIdxAfter + 1;
    let replaceCount;
    if (afterAv < coords.length && !isReturnStarter(coords[afterAv])) {
      replaceCount = avIdxAfter - caIdx + 2; // incluir exit_point
    } else {
      replaceCount = avIdxAfter - caIdx + 1; // solo hasta AvConst
    }
    coords.splice(caIdx, replaceCount, ...CANONICAL);

  } else {
    // No hay AvConst después de Campana → el segmento de Carrera Oficial está
    // invertido ANTES de Campana: [AvConst→PlSF→Sierpes→Campana]
    // Buscar el inicio del segmento invertido (AvConst justo antes de Campana)
    let rvStart = -1;
    for (let i = caIdx - 1; i >= 0; i--) {
      if (near(coords[i], SIERPES) && i + 1 === caIdx - 1 &&
          near(coords[i + 1], /* PlSF or skip */ PLSF)) {
        // try to find the full reversed sequence
      }
    }

    // Simpler: scan backward from Campana for the pattern [AvConst,PlSF,Sierpes,Campana]
    if (caIdx >= 3 &&
        near(coords[caIdx - 1], SIERPES) &&
        near(coords[caIdx - 2], PLSF) &&
        near(coords[caIdx - 3], AVCONST)) {
      rvStart = caIdx - 3;
      // Replace [AvConst, PlSF, Sierpes, Campana] (4 pts) with canonical
      coords.splice(rvStart, 4, ...CANONICAL);
    } else if (caIdx >= 1 && near(coords[caIdx - 1], AVCONST)) {
      // Just AvConst immediately before Campana
      rvStart = caIdx - 1;
      coords.splice(rvStart, 2, ...CANONICAL);
    } else {
      errors.push(`${file}: Campana encontrada en idx=${caIdx} pero no se detectó segmento canónico`);
      continue;
    }
  }

  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  updated++;
}

console.log(`\nActualizados: ${updated} archivos`);
if (errors.length > 0) {
  console.log(`\nErrores (${errors.length}):`);
  errors.forEach(e => console.log('  -', e));
}
