/**
 * componer-ruta.mjs
 *
 * Compone el LineString de un GeoJSON a partir de un recorrido expresado
 * como lista de nombres de calles, usando el índice de tramos canónicos.
 *
 * USO:
 *   node scripts/componer-ruta.mjs "CalleA" "CalleB" "CalleC" "CalleD" ...
 *
 * SALIDA:
 *   - Lista de tramos reconocidos y sus coords
 *   - Tramos NO reconocidos (para rellenar a mano)
 *   - Coords finales encadenadas listas para pegar en el GeoJSON
 *
 * ALGORITMO:
 *   Para cada posición i en la lista de calles, busca el prefijo más largo
 *   que exista en el índice (de MAX_LEN hacia abajo hasta 2).
 *   Si no hay ningún par, el tramo se marca como "sin datos".
 *   Al encadenar, el primer coord de cada fragmento (≈ último del anterior)
 *   se elimina para evitar duplicados.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const IDX   = join(__dir, 'indice-tramos-canonicos.json');

const calles = process.argv.slice(2);
if (calles.length < 2) {
  console.error('Uso: node scripts/componer-ruta.mjs "Calle A" "Calle B" "Calle C" ...');
  process.exit(1);
}

const idx = JSON.parse(readFileSync(IDX, 'utf8'));
const segs = idx.segmentos;
const MAX_LEN = 8;

// ── Buscar prefijo más largo ──────────────────────────────────────────────────

const tramos = [];
let i = 0;

while (i < calles.length - 1) {
  let found = false;
  for (let len = Math.min(MAX_LEN, calles.length - i); len >= 2; len--) {
    const ventana = calles.slice(i, i + len);
    const clave   = ventana.join('→');
    if (segs[clave]) {
      tramos.push({ tipo: 'conocido', calles: ventana, clave, ...segs[clave] });
      i += len - 1;  // el último de este tramo es el primero del siguiente
      found = true;
      break;
    }
  }
  if (!found) {
    tramos.push({ tipo: 'desconocido', calles: calles.slice(i, i + 2), clave: calles[i] + '→' + calles[i + 1] });
    i += 1;
  }
}

// ── Mostrar diagnóstico ───────────────────────────────────────────────────────

console.log('\n── Tramos reconocidos ──────────────────────────────────────────────────────');
for (const t of tramos) {
  if (t.tipo === 'conocido') {
    console.log(`  ✓ [${t.calles.length} calles, ${t.n_coords}c, ${t.calidad}, ${t.fuente}]`);
    console.log(`    ${t.clave}`);
  } else {
    console.log(`  ✗ SIN DATOS: ${t.clave}`);
  }
}

// ── Encadenar coords ──────────────────────────────────────────────────────────

const coordsFinal = [];
let firstTramo = true;

for (const t of tramos) {
  if (t.tipo !== 'conocido') continue;
  const c = t.coords;
  if (firstTramo) {
    coordsFinal.push(...c);
    firstTramo = false;
  } else {
    coordsFinal.push(...c.slice(1));  // eliminar primer coord duplicado
  }
}

// ── Resumen ───────────────────────────────────────────────────────────────────

const nConocidos   = tramos.filter(t => t.tipo === 'conocido').length;
const nDesconocidos = tramos.filter(t => t.tipo === 'desconocido').length;

console.log('\n── Resultado ───────────────────────────────────────────────────────────────');
console.log(`Tramos conocidos:    ${nConocidos}`);
console.log(`Tramos sin datos:    ${nDesconocidos}`);
console.log(`Coords encadenadas:  ${coordsFinal.length}`);

if (nDesconocidos > 0) {
  console.log('\n⚠ Tramos sin datos (completar manualmente):');
  tramos.filter(t => t.tipo === 'desconocido').forEach(t => console.log('  -', t.clave));
}

// ── Salida JSON de coords ─────────────────────────────────────────────────────

if (coordsFinal.length > 0) {
  console.log('\n── Coords LineString (JSON) ────────────────────────────────────────────────');
  console.log(JSON.stringify(coordsFinal, null, 2));
}
