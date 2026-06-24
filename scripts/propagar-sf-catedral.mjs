/**
 * Propaga el tramo Plaza de San Francisco → Cardenal Carlos Amigo
 * mejorado en 02-la-cena.geojson al resto de hermandades que comparten
 * ese recorrido común (Avenida de la Constitución hacia la Catedral).
 *
 * No toca las 15 hermandades que salen por otro itinerario después de
 * Plaza de San Francisco (sin ancla inferior en Cardenal Carlos Amigo).
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, 'geojson-2025');

// === Nuevo segmento canónico (extraído de 02-la-cena.geojson, revisado manualmente) ===
const NUEVO_SEGMENTO = [
  [-5.994169,  37.388187 ],
  [-5.994296,  37.388071 ],
  [-5.9943041, 37.3879286],
  [-5.9942267, 37.38731  ],
  [-5.9941493, 37.386713 ],
  [-5.9940679, 37.3860718],
  [-5.9940344, 37.3857616],
  [-5.993999,  37.385447 ],
  [-5.9934331, 37.3854932],
  [-5.9929686, 37.3855304],
  [-5.992619,  37.385552 ],
  [-5.9926646, 37.3858225],
  [-5.99271,   37.386038 ],
  [-5.992325,  37.386077 ],
];

// Ancla superior: versión exacta (ya propagada antes) o Plaza de San Francisco
const UPPER_EXACT = [-5.994169, 37.388187];
const UPPER_PSF   = [-5.994154, 37.38867];
// Ancla inferior: Cardenal Carlos Amigo (versión exacta y aproximada)
const LOWER_EXACT = [-5.992325, 37.386077];
const LOWER_APPROX = [-5.992304, 37.386057];

const TOL = 0.0003;
function cerca(a, b) { return Math.abs(a[0]-b[0]) < TOL && Math.abs(a[1]-b[1]) < TOL; }

// Archivos que comparten el tramo (verificado con análisis previo)
const ARCHIVOS = [
  '01-la-borriquita',
  '03-jesus-despojado',
  '04-la-hiniesta',
  '05-la-paz',
  '06-san-roque',
  '07-la-estrella',
  '08-la-amargura',
  '09-el-amor',
  '10-san-pablo',
  '11-redencion',
  '13-santa-marta',
  '14-san-gonzalo',
  '15-vera-cruz',
  '16-las-penas',
  '18-el-museo',
  '20-san-esteban',
  '22-san-benito',
  '23-dulce-nombre',
  '24-los-javieres',
  '27-el-carmen-doloroso',
  '29-la-sed',
  '30-san-bernardo',
  '31-la-lanzada',
  '33-los-panaderos',
  '34-cristo-de-burgos',
  '35-siete-palabras',
  '36-los-negritos',
  '37-la-exaltacion',
  '39-montesion',
  '40-la-quinta-angustia',
  '41-el-valle',
  '42-pasion',
  '43-el-silencio',
  '45-la-macarena',
  '47-esperanza-de-triana',
  '48-los-gitanos',
  '51-el-cachorro',
  '52-la-o',
  '53-san-isidoro',
  '55-la-mortaja',
  '57-los-servitas',
  '58-la-trinidad',
  '59-santo-entierro',
  '60-soledad-de-san-lorenzo',
  '61-la-resurreccion',
];

let ok = 0, err = 0;

for (const nombre of ARCHIVOS) {
  const ruta = path.join(dir, `${nombre}.geojson`);
  const fc = JSON.parse(readFileSync(ruta, 'utf8'));

  const lineFeature = fc.features.find(f => f.geometry.type === 'LineString');
  const coords = lineFeature.geometry.coordinates;

  // Localizar ancla superior (primero exact, luego psf)
  let ui = coords.findIndex(c => cerca(c, UPPER_EXACT));
  let uType = 'exact';
  if (ui < 0) {
    ui = coords.findIndex(c => cerca(c, UPPER_PSF));
    uType = 'psf';
  }

  // Localizar ancla inferior (después de la superior)
  let li = -1;
  if (ui >= 0) {
    for (let i = ui + 1; i < coords.length; i++) {
      if (cerca(coords[i], LOWER_EXACT) || cerca(coords[i], LOWER_APPROX)) {
        li = i;
        break;
      }
    }
  }

  if (ui < 0 || li < 0) {
    console.error(`⚠️  ${nombre}: upper@${ui} lower@${li} — saltado`);
    err++;
    continue;
  }

  // Construir nuevas coordenadas:
  // - uType 'exact': el punto ui ES el inicio del nuevo segmento → sustituir [ui..li]
  // - uType 'psf':  el punto ui se conserva (PSF), el nuevo segmento va a partir de ui+1
  const sliceFrom = uType === 'exact' ? ui : ui + 1;
  const newCoords = [
    ...coords.slice(0, sliceFrom),
    ...NUEVO_SEGMENTO,
    ...coords.slice(li + 1),
  ];

  lineFeature.geometry.coordinates = newCoords;
  writeFileSync(ruta, JSON.stringify(fc), 'utf8');

  const delta = newCoords.length - coords.length;
  console.log(`✓ ${nombre}: ${coords.length} → ${newCoords.length} (${delta >= 0 ? '+' : ''}${delta}) [${uType}]`);
  ok++;
}

console.log(`\nActualizados: ${ok} | Errores: ${err}`);
