// Capa de datos: carga los JSON fuente, valida la integridad en build,
// hace el "join" hermandad <-> nazarenos_2026 y precalcula totales y % por día.
// Todo esto se ejecuta en build (SSG): la web final es HTML estático.

import hermandadesRaw from '../data/hermandades.json';
import nazarenosRaw from '../data/nazarenos-2026.json';
import diasRaw from '../data/dias.json';

/** Días en orden litúrgico. */
export const dias = [...diasRaw].sort((a, b) => a.orden - b.orden);

const diaPorSlug = new Map(dias.map((d) => [d.slug, d]));
const nazPorHdad = new Map(nazarenosRaw.map((n) => [n.idHdad, n]));

// --- Validación de integridad referencial (falla el build si algo no cuadra) ---
for (const h of hermandadesRaw) {
  if (!nazPorHdad.has(h.id_hdad)) {
    throw new Error(`[datos] Falta registro nazarenos_2026 para hermandad ${h.id_hdad} (${h.nombre}).`);
  }
  if (!diaPorSlug.has(h.dia)) {
    throw new Error(`[datos] Día desconocido "${h.dia}" en la hermandad "${h.nombre}".`);
  }
}
if (nazarenosRaw.length !== hermandadesRaw.length) {
  throw new Error(`[datos] nazarenos_2026 (${nazarenosRaw.length}) y hermandades (${hermandadesRaw.length}) no coinciden en número.`);
}

const METRICAS = ['nazarenos', 'penitentes', 'noNaz', 'acolitos', 'monaguillos', 'acompCortejo', 'noTotal'];

// --- Totales por día ---
const totalesPorDiaMap = new Map(
  dias.map((d) => [d.slug, { slug: d.slug, nombre: d.nombre, orden: d.orden, hermandades: 0, ...Object.fromEntries(METRICAS.map((m) => [m, 0])) }])
);
for (const h of hermandadesRaw) {
  const n = nazPorHdad.get(h.id_hdad);
  const t = totalesPorDiaMap.get(h.dia);
  t.hermandades += 1;
  for (const m of METRICAS) t[m] += n[m];
}

/** Totales por día, en orden litúrgico. */
export const totalesPorDia = [...totalesPorDiaMap.values()].sort((a, b) => a.orden - b.orden);

// --- Registros enriquecidos: join hermandad + nazarenos + día + % sobre su día ---
export const registros = hermandadesRaw.map((h) => {
  const n = nazPorHdad.get(h.id_hdad);
  const dia = diaPorSlug.get(h.dia);
  const t = totalesPorDiaMap.get(h.dia);
  return {
    id_hdad: h.id_hdad,
    nombre: h.nombre,
    slug: h.slug,
    diaSlug: h.dia,
    diaNombre: dia.nombre,
    diaOrden: dia.orden,
    nazarenos: n.nazarenos,
    penitentes: n.penitentes,
    noNaz: n.noNaz,
    acolitos: n.acolitos,
    monaguillos: n.monaguillos,
    acompCortejo: n.acompCortejo,
    noTotal: n.noTotal,
    // % de esta hermandad respecto al total de su mismo día
    pctNaz: t.noNaz ? (n.noNaz / t.noNaz) * 100 : 0,
    pctTotal: t.noTotal ? (n.noTotal / t.noTotal) * 100 : 0,
  };
});

// Orden por defecto: por día litúrgico y, dentro del día, por nº total descendente.
registros.sort((a, b) => a.diaOrden - b.diaOrden || b.noTotal - a.noTotal);

/** Totales generales del conjunto. */
export const totalGeneral = registros.reduce(
  (acc, r) => {
    for (const m of METRICAS) acc[m] += r[m];
    return acc;
  },
  { hermandades: registros.length, ...Object.fromEntries(METRICAS.map((m) => [m, 0])) }
);

/** Conjunto plano y limpio para exportar como datos abiertos (CSV / JSON). */
export const datasetExport = registros.map((r) => ({
  id_hermandad: r.id_hdad,
  hermandad: r.nombre,
  dia: r.diaNombre,
  dia_slug: r.diaSlug,
  nazarenos: r.nazarenos,
  penitentes: r.penitentes,
  total_nazarenos: r.noNaz,
  acolitos: r.acolitos,
  monaguillos: r.monaguillos,
  acompanamiento: r.acompCortejo,
  total_cortejo: r.noTotal,
  pct_nazarenos_dia: Math.round(r.pctNaz * 10) / 10,
  pct_cortejo_dia: Math.round(r.pctTotal * 10) / 10,
}));

/** Formatea un número entero al estilo español, agrupando siempre los miles (3.958). */
export function fmt(n) {
  return Number(n).toLocaleString('es-ES', { useGrouping: 'always' });
}

/** Formatea un porcentaje con un decimal (12,3 %). */
export function fmtPct(n) {
  return `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}
