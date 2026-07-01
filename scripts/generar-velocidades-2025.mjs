// Genera src/data/velocidades-2025.json a partir de:
//   - public/geojson/2025/*.geojson   (trazado real de cada hermandad: LineString + Points de calle)
//   - src/data/horarios-2025.json     (tiempos en salida, campana, catedral, entrada, …)
//   - src/data/hermandades.json       (catálogo: id, nombre, slug, día)
//
// Calcula, por hermandad, la velocidad media en METROS POR HORA en tres tramos:
//   - completa : todo el recorrido            (salida  → entrada)
//   - ida      : del templo a La Campana       (salida  → campana)   [entrada a Carrera Oficial]
//   - vuelta   : de la Catedral al templo       (catedral → entrada)
// y, como extra útil, la velocidad en Carrera Oficial (campana → catedral, la cruz de guía).
//
// Metodología (según decisiones del proyecto):
//   - El trazado se REMUESTREA cada 5 m: la polilínea se recorre acumulando distancia geodésica
//     y se insertan puntos cada 5 m. Las distancias parciales se leen sobre ese muestreo.
//   - Punto de fin de Carrera Oficial ("catedral") = coordenada fija -5.9925187, 37.3860585,
//     común a todas las rutas (a <10 m del trazado, salvo Candelaria que lo tiene simplificado).
//   - Punto de La Campana = Point "La Campana" propio de cada geojson.
//   - Tiempos en minutos monotónicos (se suman 1440 min al cruzar la medianoche), igual que datos.js.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, '..');
const DIR_GEO = join(RAIZ, 'public', 'geojson', '2025');

const PASO_M = 5;                                  // remuestreo cada 5 m
const CATEDRAL = [-5.9925187, 37.3860585];         // fin de Carrera Oficial (coordenada fija)
const R = 6371000;                                 // radio terrestre (m)
const rad = (d) => (d * Math.PI) / 180;

// ── geometría ───────────────────────────────────────────────────────────────
function haversine([lon1, lat1], [lon2, lat2]) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Proyección plana local (equirectangular) en metros centrada en `o`. Suficiente a escala ciudad.
function proyector(o) {
  const k = Math.cos(rad(o[1]));
  return ([lon, lat]) => [rad(lon - o[0]) * R * k, rad(lat - o[1]) * R];
}

// Remuestrea la polilínea cada PASO_M metros. Devuelve puntos con su distancia acumulada.
function remuestrear(coords, paso) {
  const salida = [{ pt: coords[0], cum: 0 }];
  let cum = 0;
  let resto = 0; // distancia que falta para el próximo punto de muestreo
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = haversine(a, b);
    if (segLen === 0) continue;
    let d = resto;
    while (d < segLen) {
      const f = d / segLen;
      const pt = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      salida.push({ pt, cum: cum + d });
      d += paso;
    }
    resto = d - segLen;
    cum += segLen;
  }
  salida.push({ pt: coords[coords.length - 1], cum }); // vértice final exacto
  return { muestras: salida, total: cum };
}

// Distancia acumulada del punto del muestreo más cercano a `objetivo` (con su separación perpendicular).
function cumMasCercano(muestras, objetivo) {
  const xy = proyector(objetivo);
  const O = xy(objetivo);
  let mejor = null;
  let dmin = Infinity;
  for (const m of muestras) {
    const p = xy(m.pt);
    const d = Math.hypot(p[0] - O[0], p[1] - O[1]);
    if (d < dmin) { dmin = d; mejor = m; }
  }
  return { cum: mejor.cum, separacion: dmin };
}

// ── tiempos ──────────────────────────────────────────────────────────────────
const PUNTOS = ['salida', 'campana', 'sierpes', 'plaza', 'catedral', 'ultimoPasoFuera', 'entrada'];
const aMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
function minutosMonotonicos(h) {
  const min = {};
  let prev = -Infinity;
  for (const p of PUNTOS) {
    let v = aMin(h[p]);
    while (v < prev) v += 1440;
    min[p] = v;
    prev = v;
  }
  return min;
}

// velocidad en m/h: metros recorridos / minutos transcurridos · 60. null si el intervalo no es positivo.
const velMH = (metros, minutos) =>
  minutos > 0 ? Math.round((metros / minutos) * 60) : null;

// ── carga de datos ───────────────────────────────────────────────────────────
const hermandades = JSON.parse(readFileSync(join(RAIZ, 'src/data/hermandades.json'), 'utf8'));
const horarios = JSON.parse(readFileSync(join(RAIZ, 'src/data/horarios-2025.json'), 'utf8'));
const hdadPorId = new Map(hermandades.map((h) => [h.id_hdad, h]));
const horarioPorId = new Map(horarios.map((h) => [h.idHdad, h]));

const OMITIR = new Set();

const archivos = readdirSync(DIR_GEO).filter((f) => f.endsWith('.geojson')).sort();

const registros = [];
for (const archivo of archivos) {
  const geo = JSON.parse(readFileSync(join(DIR_GEO, archivo), 'utf8'));
  const linea = geo.features.find((f) => f.geometry.type === 'LineString');
  const puntos = geo.features.filter((f) => f.geometry.type === 'Point');
  const id = linea.properties.id_hdad;
  if (OMITIR.has(id)) { console.warn(`↷  ${archivo}: omitida (id ${id}).`); continue; }
  const hdad = hdadPorId.get(id);
  const horario = horarioPorId.get(id);
  if (!hdad || !horario) {
    console.warn(`⚠  ${archivo}: sin hermandad u horario (id ${id}), se omite.`);
    continue;
  }

  const { muestras, total } = remuestrear(linea.geometry.coordinates, PASO_M);

  // distancias acumuladas de los cortes
  const ptCampana = puntos.find((p) => /campana/i.test(p.properties.calle));
  const cortCampana = cumMasCercano(muestras, ptCampana.geometry.coordinates);
  const cortCatedral = cumMasCercano(muestras, CATEDRAL);

  const distIda = cortCampana.cum;
  const distCO = cortCatedral.cum - cortCampana.cum;
  const distVuelta = total - cortCatedral.cum;

  // tiempos (minutos monotónicos)
  const t = minutosMonotonicos(horario);
  // `entrada` marca la recogida COMPLETA de la cofradía (cola); el resto de hitos
  // (salida, campana, catedral) son de la cruz de guía (cabeza). Para medir velocidades
  // cabeza-contra-cabeza, estimamos cuándo la CABEZA entra en el templo descontando el
  // "tiempo de paso" del cortejo, medido en la Catedral: TP = ultimoPasoFuera − catedral.
  // (En 2025 no hay tiempos reales para corregir el retraso, así que TP se toma del horario.)
  const tiempoPaso = t.ultimoPasoFuera - t.catedral;
  const cabezaEntrada = t.entrada - tiempoPaso; // cabeza entra en el templo
  const minTotal = cabezaEntrada - t.salida;    // = catedral − salida + entrada − ultimoPasoFuera
  const minIda = t.campana - t.salida;
  const minCO = t.catedral - t.campana;
  const minVuelta = cabezaEntrada - t.catedral; // = entrada − ultimoPasoFuera

  const notas = [];
  if (cortCatedral.separacion > 10) {
    notas.push(`corte de Catedral a ${cortCatedral.separacion.toFixed(0)} m del trazado (geometría simplificada en este tramo): ida/vuelta aproximadas`);
  }

  registros.push({
    id_hdad: id,
    nombre: hdad.nombre,
    slug: hdad.slug,
    dia: hdad.dia,
    distancias_m: {
      total: Math.round(total),
      ida: Math.round(distIda),
      carrera_oficial: Math.round(distCO),
      vuelta: Math.round(distVuelta),
    },
    duracion_min: {
      total: minTotal,
      ida: minIda,
      carrera_oficial: minCO,
      vuelta: minVuelta,
    },
    velocidad_mh: {
      completa: velMH(total, minTotal),
      ida: velMH(distIda, minIda),
      carrera_oficial: velMH(distCO, minCO),
      vuelta: velMH(distVuelta, minVuelta),
    },
    notas: notas.join('; '),
  });
}

registros.sort((a, b) => a.id_hdad - b.id_hdad);

const salida = {
  anio: 2025,
  generado: new Date().toISOString().slice(0, 10),
  unidad_velocidad: 'm/h',
  unidad_distancia: 'm',
  remuestreo_m: PASO_M,
  punto_fin_carrera_oficial: CATEDRAL,
  descripcion: {
    completa: 'salida → templo (todo el recorrido, cabeza de la cofradía)',
    ida: 'salida → La Campana (hasta entrar en Carrera Oficial)',
    carrera_oficial: 'La Campana → Catedral (la cruz de guía en Carrera Oficial)',
    vuelta: 'Catedral → templo (regreso de la cabeza, descontando el tiempo de paso)',
  },
  criterio_tiempos: 'Velocidades cabeza-contra-cabeza. Como `entrada` es la recogida completa (cola), la entrada de la cabeza se estima como entrada − (ultimoPasoFuera − catedral).',
  fuente: 'GeoJSON de recorridos 2025 + horarios-2025.json',
  registros,
};

writeFileSync(join(RAIZ, 'src/data/velocidades-2025.json'), JSON.stringify(salida, null, 2) + '\n');

// ── informe en consola ───────────────────────────────────────────────────────
const f0 = (n) => (n == null ? '   —' : String(n).padStart(4));
console.log(`\n✔  ${registros.length} hermandades → src/data/velocidades-2025.json (velocidades en m/h)\n`);
console.log('  ' + 'hermandad'.padEnd(26) + 'compl.  ida  C.Of. vuelta');
for (const r of registros) {
  const v = r.velocidad_mh;
  console.log('  ' + r.nombre.padEnd(26) + `${f0(v.completa)} ${f0(v.ida)} ${f0(v.carrera_oficial)} ${f0(v.vuelta)}`);
}
const conNota = registros.filter((r) => r.notas);
if (conNota.length) {
  console.log('\nNotas:');
  conNota.forEach((r) => console.log(`  - ${r.nombre}: ${r.notas}`));
}
