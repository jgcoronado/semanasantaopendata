/**
 * Valida los archivos GeoJSON de recorridos 2025 buscando calles duplicadas.
 * Solo revisa los archivos NO editados manualmente.
 * Uso: node scripts/validar-geojson.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FOLDER = 'scripts/geojson-2025';
const MANUALES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 25, 30, 40, 47, 51, 52]);

// Hermandades con recorridos de ida y vuelta legítimos (actualmente ninguna)
const ROUND_TRIP = new Set([]);

const files = readdirSync(FOLDER).filter((f) => f.endsWith('.geojson')).sort();

let errores = 0;
let ok = 0;

for (const fname of files) {
  let hid;
  try {
    hid = parseInt(fname.split('-')[0], 10);
  } catch {
    continue;
  }
  if (isNaN(hid)) continue;
  if (MANUALES.has(hid)) continue;

  const path = join(FOLDER, fname);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const features = data.features;

  if (!features || features.length < 2) {
    console.error(`[${hid}] ${fname}: archivo inválido (sin features)`);
    errores++;
    continue;
  }

  const ls = features[0];
  const lsCoords = ls?.geometry?.coordinates ?? [];

  const points = features.slice(1).filter((f) => f.geometry?.type === 'Point');
  const calles = points.map((p) => p.properties?.calle ?? '');

  // Contar ocurrencias
  const cnt = {};
  for (const c of calles) cnt[c] = (cnt[c] ?? 0) + 1;

  const dups = Object.entries(cnt).filter(([, v]) => v > 1 && !ROUND_TRIP.has(hid));

  if (dups.length > 0) {
    console.error(`[${hid}] ${fname}: DUPLICADOS → ${dups.map(([k, v]) => `"${k}" ×${v}`).join(', ')}`);
    errores++;
  } else {
    // Verificar que el primer y último Point están en el LineString
    const tol = 1e-7;
    const findInLS = (coord) =>
      lsCoords.some((c) => Math.abs(c[0] - coord[0]) < tol && Math.abs(c[1] - coord[1]) < tol);

    const firstCoord = points[0]?.geometry?.coordinates;
    const lastCoord = points[points.length - 1]?.geometry?.coordinates;

    let warned = false;
    if (firstCoord && !findInLS(firstCoord)) {
      console.warn(`[${hid}] ${fname}: primer Point no encontrado en LineString`);
      warned = true;
    }
    if (lastCoord && !findInLS(lastCoord)) {
      console.warn(`[${hid}] ${fname}: último Point no encontrado en LineString`);
      warned = true;
    }

    if (!warned) {
      console.log(`[${hid}] ${fname}: OK (${points.length} calles, ${lsCoords.length} coords)`);
    }
    ok++;
  }
}

console.log(`\n${ok} OK, ${errores} con duplicados o errores`);
if (errores > 0) process.exit(1);
