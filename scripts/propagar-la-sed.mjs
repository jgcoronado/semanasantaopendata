/**
 * Propaga los tramos mejorados de 29-la-sed.geojson a otras hermandades:
 *
 * 1. Sierpes intermedio: actualiza el punto de Calle Sierpes de la versión
 *    vieja [-5.9947885, 37.3908748] a la nueva [-5.9945202, 37.3909414].
 *    Afecta a 50 archivos.
 *
 * 2. SegB (Cardenal Carlos Amigo → Cuesta del Rosario): inserta 2 puntos de
 *    precisión entre [-5.992365, 37.386288] y [-5.992537, 37.386555].
 *    Afecta a 10 archivos con ruta directa (22 pts actuales → 24).
 *
 * 3. SegB san-benito: reemplaza el segmento completo porque usa coords propias
 *    ligeramente diferentes.
 *
 * No toca:
 *  - 29-la-sed (fuente), 02-la-cena (ya tiene 24 pts en SegB), 10-san-pablo
 *    (ruta distinta), ni las hermandades con ruta Pescadería en SegB
 *    (11-redencion, 37-la-exaltacion, 45-la-macarena).
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, 'geojson-2025');

const TOL = 0.0002;
function cerca(a, b, t = TOL) {
  return Math.abs(a[0] - b[0]) < t && Math.abs(a[1] - b[1]) < t;
}

// ── 1. Sierpes intermedio ─────────────────────────────────────────────────
const OLD_SIERPES = [-5.9947885, 37.3908748];
const NEW_SIERPES = [-5.9945202, 37.3909414];

// ── 2 y 3. SegB (Cardenal → Cuesta del Rosario) ─────────────────────────
// 2 nuevos puntos a insertar (La Sed preciso)
const NEW_B_INSERTS = [
  [-5.9924527, 37.3863161],
  [-5.9925164, 37.3863997],
];
// Ancla antes de los inserts
const B_BEFORE_INSERT = [-5.992365, 37.386288];
// Ancla después de los inserts
const B_AFTER_INSERT  = [-5.992537, 37.386555];

// Segmento completo La Sed para SegB (incluye anclas de inicio y fin)
const SEG_B_COMPLETO = [
  [-5.992325,  37.386077 ],
  [-5.992365,  37.386288 ],
  [-5.9924527, 37.3863161],
  [-5.9925164, 37.3863997],
  [-5.992537,  37.386555 ],
  [-5.992515,  37.38666  ],
  [-5.992549,  37.386763 ],
  [-5.992807,  37.386777 ],
  [-5.993037,  37.386751 ],
  [-5.993054,  37.386917 ],
  [-5.9930245, 37.3870101],
  [-5.9929267, 37.3871073],
  [-5.992697,  37.387288 ],
  [-5.992489,  37.387452 ],
  [-5.992594,  37.387654 ],
  [-5.992704,  37.387858 ],
  [-5.99277,   37.38804  ],
  [-5.992784,  37.388285 ],
  [-5.992744,  37.388583 ],
  [-5.992621,  37.388828 ],
  [-5.992568,  37.389176 ],
  [-5.992542,  37.389426 ],
  [-5.992353,  37.389737 ],
  [-5.991765,  37.389785 ],
];
const CARDENAL_END = [-5.992325, 37.386077];
const CUESTA_ROS   = [-5.991765, 37.389785];

// Archivos con ruta directa y 22 pts actuales (SegB inserción)
const ARCHIVOS_SEG_B_INSERT = [
  '04-la-hiniesta',
  '06-san-roque',
  '20-san-esteban',
  '36-los-negritos',
  '48-los-gitanos',
  '53-san-isidoro',
  '55-la-mortaja',
  '57-los-servitas',
  '58-la-trinidad',
  '61-la-resurreccion',
];

let ok = 0, err = 0;

// ── Paso 1: Sierpes intermedio (50 archivos) ─────────────────────────────
console.log('=== Paso 1: Sierpes intermedio ===');
const allFiles = (await import('fs')).readdirSync(dir)
  .filter(f => f.endsWith('.geojson') && !['29-la-sed.geojson'].includes(f));

for (const f of allFiles) {
  const ruta = path.join(dir, f);
  const fc = JSON.parse(readFileSync(ruta, 'utf8'));
  const line = fc.features.find(x => x.geometry.type === 'LineString');
  if (!line) continue;
  const coords = line.geometry.coordinates;
  const idx = coords.findIndex(c => cerca(c, OLD_SIERPES, 0.0001));
  if (idx < 0) continue;
  coords[idx] = NEW_SIERPES;
  writeFileSync(ruta, JSON.stringify(fc), 'utf8');
  console.log(`  ✓ ${f}`);
  ok++;
}

// ── Paso 2: SegB inserción (10 archivos, 22→24 pts) ─────────────────────
console.log('\n=== Paso 2: SegB insertar 2 puntos (22→24) ===');
for (const nombre of ARCHIVOS_SEG_B_INSERT) {
  const ruta = path.join(dir, `${nombre}.geojson`);
  const fc = JSON.parse(readFileSync(ruta, 'utf8'));
  const line = fc.features.find(x => x.geometry.type === 'LineString');
  const coords = line.geometry.coordinates;

  const bi = coords.findIndex(c => cerca(c, B_BEFORE_INSERT));
  const bj = coords.findIndex(c => cerca(c, B_AFTER_INSERT));
  if (bi < 0 || bj <= bi) {
    console.error(`  ⚠️  ${nombre}: before@${bi} after@${bj} — saltado`);
    err++;
    continue;
  }
  // Inserta los 2 nuevos puntos entre bi y bj
  const newCoords = [
    ...coords.slice(0, bi + 1),
    ...NEW_B_INSERTS,
    ...coords.slice(bj),
  ];
  line.geometry.coordinates = newCoords;
  writeFileSync(ruta, JSON.stringify(fc), 'utf8');
  console.log(`  ✓ ${nombre}: ${coords.length} → ${newCoords.length}`);
  ok++;
}

// ── Paso 3: SegB reemplazar san-benito (20→24 pts) ────────────────────────
console.log('\n=== Paso 3: SegB san-benito (reemplazo completo) ===');
{
  const ruta = path.join(dir, '22-san-benito.geojson');
  const fc = JSON.parse(readFileSync(ruta, 'utf8'));
  const line = fc.features.find(x => x.geometry.type === 'LineString');
  const coords = line.geometry.coordinates;

  const bi = coords.findIndex(c => cerca(c, CARDENAL_END));
  const bj = coords.findIndex(c => cerca(c, CUESTA_ROS, 0.0003));
  if (bi < 0 || bj <= bi) {
    console.error(`  ⚠️  22-san-benito: cardenal@${bi} cuesta@${bj} — saltado`);
    err++;
  } else {
    const newCoords = [
      ...coords.slice(0, bi),
      ...SEG_B_COMPLETO,
      ...coords.slice(bj + 1),
    ];
    line.geometry.coordinates = newCoords;
    writeFileSync(ruta, JSON.stringify(fc), 'utf8');
    console.log(`  ✓ 22-san-benito: ${coords.length} → ${newCoords.length}`);
    ok++;
  }
}

console.log(`\nActualizados: ${ok} | Errores: ${err}`);
