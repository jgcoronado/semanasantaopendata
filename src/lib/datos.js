// Capa de datos MULTI-AÑO. Carga los JSON fuente, valida integridad en build,
// une hermandad <-> nazarenos_AAAA y precalcula totales y % por día, para cada año.
// Auto-descubre los ficheros `nazarenos-AAAA.json`: añadir un año = soltar su JSON
// y añadir su entrada en `anios.json`. Todo se ejecuta en build (SSG).

import hermandadesRaw from '../data/hermandades.json';
import diasRaw from '../data/dias.json';
import aniosRaw from '../data/anios.json';

// Auto-descubrimiento de los datos por año.
const ficheros = import.meta.glob('../data/nazarenos-*.json', { eager: true });
const datosPorAnio = {};
for (const [ruta, mod] of Object.entries(ficheros)) {
  const m = ruta.match(/nazarenos-(\d{4})\.json$/);
  if (m) datosPorAnio[Number(m[1])] = mod.default;
}

/** Días en orden litúrgico (catálogo maestro de 9 días). */
export const dias = [...diasRaw].sort((a, b) => a.orden - b.orden);
const diaPorSlug = new Map(dias.map((d) => [d.slug, d]));
const hdadPorId = new Map(hermandadesRaw.map((h) => [h.id_hdad, h]));

/** Años disponibles, del más reciente al más antiguo, con su metadato. */
export const anios = [...aniosRaw]
  .sort((a, b) => b.anio - a.anio)
  .map((a) => ({ ...a, slug: String(a.anio) }));

/** Año principal (el más reciente). */
export const anioPrincipal = anios[0].anio;

const METRICAS = ['nazarenos', 'penitentes', 'noNaz', 'acolitos', 'monaguillos', 'acompCortejo', 'noTotal'];

function construirAnio(anio) {
  const naz = datosPorAnio[anio];
  if (!naz) throw new Error(`[datos] No hay datos (nazarenos-${anio}.json) para el año ${anio}.`);

  const nazPorHdad = new Map(naz.map((n) => [n.idHdad, n]));

  // Validación: cada registro apunta a una hermandad del catálogo.
  for (const n of naz) {
    const h = hdadPorId.get(n.idHdad);
    if (!h) throw new Error(`[datos] ${anio}: idHdad ${n.idHdad} no existe en el catálogo de hermandades.`);
    if (!diaPorSlug.has(h.dia)) throw new Error(`[datos] Día desconocido "${h.dia}" en la hermandad "${h.nombre}".`);
  }

  // Totales por día (solo días con datos ese año).
  const totalesMap = new Map();
  for (const n of naz) {
    const h = hdadPorId.get(n.idHdad);
    if (!totalesMap.has(h.dia)) {
      const d = diaPorSlug.get(h.dia);
      totalesMap.set(h.dia, { slug: d.slug, nombre: d.nombre, orden: d.orden, hermandades: 0, ...Object.fromEntries(METRICAS.map((m) => [m, 0])) });
    }
    const t = totalesMap.get(h.dia);
    t.hermandades += 1;
    for (const m of METRICAS) t[m] += n[m];
  }
  const totalesPorDia = [...totalesMap.values()].sort((a, b) => a.orden - b.orden);
  const diasPresentes = totalesPorDia.map((t) => ({ slug: t.slug, nombre: t.nombre, orden: t.orden, hermandades: t.hermandades }));

  // Registros enriquecidos (join + % sobre su día).
  const registros = naz.map((n) => {
    const h = hdadPorId.get(n.idHdad);
    const d = diaPorSlug.get(h.dia);
    const t = totalesMap.get(h.dia);
    return {
      anio,
      id_hdad: h.id_hdad,
      nombre: h.nombre,
      slug: h.slug,
      diaSlug: h.dia,
      diaNombre: d.nombre,
      diaOrden: d.orden,
      nazarenos: n.nazarenos,
      penitentes: n.penitentes,
      noNaz: n.noNaz,
      acolitos: n.acolitos,
      monaguillos: n.monaguillos,
      acompCortejo: n.acompCortejo,
      noTotal: n.noTotal,
      pctNaz: t.noNaz ? (n.noNaz / t.noNaz) * 100 : 0,
      pctTotal: t.noTotal ? (n.noTotal / t.noTotal) * 100 : 0,
    };
  });
  registros.sort((a, b) => a.diaOrden - b.diaOrden || b.noTotal - a.noTotal);

  const totalGeneral = registros.reduce(
    (acc, r) => { for (const m of METRICAS) acc[m] += r[m]; return acc; },
    { hermandades: registros.length, dias: diasPresentes.length, ...Object.fromEntries(METRICAS.map((m) => [m, 0])) }
  );

  return { anio, registros, totalesPorDia, diasPresentes, totalGeneral };
}

const cache = new Map();
/** Devuelve los datos calculados de un año: { registros, totalesPorDia, diasPresentes, totalGeneral }. */
export function getAnio(anio) {
  const a = Number(anio);
  if (!cache.has(a)) cache.set(a, construirAnio(a));
  return cache.get(a);
}

/** Conjunto plano y limpio para exportar como datos abiertos (CSV / JSON) de un año. */
export function getDatasetExport(anio) {
  return getAnio(anio).registros.map((r) => ({
    anio: r.anio,
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
}

// ---------- Comparativa entre años ----------

/** Comparativa por hermandad: para cada hermandad, sus cifras por año (o null si no salió). */
export function getComparativaHermandades() {
  return hermandadesRaw
    .map((h) => {
      const d = diaPorSlug.get(h.dia);
      const porAnio = {};
      for (const a of anios) {
        const r = getAnio(a.anio).registros.find((x) => x.id_hdad === h.id_hdad);
        porAnio[a.anio] = r ? { noNaz: r.noNaz, noTotal: r.noTotal, pctNaz: r.pctNaz, pctTotal: r.pctTotal } : null;
      }
      return { id_hdad: h.id_hdad, nombre: h.nombre, slug: h.slug, diaSlug: h.dia, diaNombre: d.nombre, diaOrden: d.orden, porAnio };
    })
    .sort((a, b) => a.diaOrden - b.diaOrden || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Comparativa por día: para cada día, los totales por año (o null si no se contó ese año). */
export function getComparativaDias() {
  return dias.map((d) => {
    const porAnio = {};
    for (const a of anios) {
      const t = getAnio(a.anio).totalesPorDia.find((x) => x.slug === d.slug);
      porAnio[a.anio] = t ? { noNaz: t.noNaz, noTotal: t.noTotal, hermandades: t.hermandades } : null;
    }
    return { slug: d.slug, nombre: d.nombre, orden: d.orden, porAnio };
  });
}

// ---------- Horarios oficiales ----------

const ficherosHorarios = import.meta.glob('../data/horarios-*.json', { eager: true });
const horariosPorAnio = {};
for (const [ruta, mod] of Object.entries(ficherosHorarios)) {
  const m = ruta.match(/horarios-(\d{4})\.json$/);
  if (m) horariosPorAnio[Number(m[1])] = mod.default;
}

/** Años que tienen horarios oficiales cargados (del más reciente al más antiguo). */
export const aniosConHorarios = anios.filter((a) => horariosPorAnio[a.anio]);
/** ¿Hay horarios para este año? */
export const hayHorarios = (anio) => !!horariosPorAnio[Number(anio)];

const PUNTOS = ['salida', 'campana', 'sierpes', 'plaza', 'catedral', 'ultimoPasoFuera', 'entrada'];
const aMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function construirHorarios(anio) {
  const lista = horariosPorAnio[anio];
  if (!lista) throw new Error(`[datos] No hay horarios (horarios-${anio}.json) para ${anio}.`);
  const nazPorId = new Map(getAnio(anio).registros.map((r) => [r.id_hdad, r]));

  const registros = lista.map((h) => {
    const hdad = hdadPorId.get(h.idHdad);
    if (!hdad) throw new Error(`[datos] horarios ${anio}: idHdad ${h.idHdad} no existe.`);
    const dia = diaPorSlug.get(hdad.dia);

    // Minutos absolutos monotónicos (suma 24 h cuando un punto cruza la medianoche).
    const min = {};
    let prev = -Infinity;
    for (const p of PUNTOS) {
      let v = aMin(h[p]);
      while (v < prev) v += 1440;
      min[p] = v;
      prev = v;
    }

    const duracionMin = min.entrada - min.salida;
    const carreraOficialMin = min.ultimoPasoFuera - min.campana; // la cofradía ocupa la Carrera Oficial
    const cruzCarreraMin = min.catedral - min.campana; // la cruz de guía recorre la Carrera Oficial
    const naz = nazPorId.get(h.idHdad) || null;
    const partPorHora = naz && duracionMin ? Math.round((naz.noTotal / (duracionMin / 60))) : null;

    return {
      anio,
      id_hdad: h.idHdad,
      nombre: hdad.nombre,
      slug: hdad.slug,
      diaSlug: hdad.dia,
      diaNombre: dia.nombre,
      diaOrden: dia.orden,
      horas: Object.fromEntries(PUNTOS.map((p) => [p, h[p]])),
      min,
      salidaMin: min.salida,
      entradaMin: min.entrada,
      duracionMin,
      carreraOficialMin,
      cruzCarreraMin,
      noNaz: naz ? naz.noNaz : null,
      noTotal: naz ? naz.noTotal : null,
      partPorHora,
    };
  });
  registros.sort((a, b) => a.diaOrden - b.diaOrden || a.salidaMin - b.salidaMin);

  const diasPresentes = [...new Map(registros.map((r) => [r.diaSlug, { slug: r.diaSlug, nombre: r.diaNombre, orden: r.diaOrden }])).values()]
    .sort((a, b) => a.orden - b.orden);

  return { anio, registros, diasPresentes };
}

const cacheHorarios = new Map();
/** Horarios de un año, enriquecidos (duración, carrera oficial, cruce con conteo). */
export function getHorariosAnio(anio) {
  const a = Number(anio);
  if (!cacheHorarios.has(a)) cacheHorarios.set(a, construirHorarios(a));
  return cacheHorarios.get(a);
}

// ---------- Formato ----------

/** Formatea un número entero al estilo español, agrupando siempre los miles (3.958). */
export function fmt(n) {
  return Number(n).toLocaleString('es-ES', { useGrouping: 'always' });
}

/** Formatea un porcentaje con un decimal (12,3 %). */
export function fmtPct(n) {
  return `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/** Formatea una duración en minutos como "11 h 45 min". */
export function fmtDur(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

/** Variación porcentual entre dos valores (para la comparativa). Devuelve null si no procede. */
export function variacion(actual, anterior) {
  if (actual == null || anterior == null || anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

// ---------- ANÁLISIS CRUZADO: NAZARENOS × HORARIOS ----------

/**
 * Cruce entre nazarenos y horarios de un año.
 * Devuelve una lista de hermandades con métricas derivadas de ambos datasets.
 * Las hermandades que Nazarenos indique que no salieron ese año aparecen con
 * `incidencia: 'sin_datos'` (posible lluvia o suspensión) y sus métricas a null.
 */
export function getCruceNazarenosHorarios(anio) {
  const horarios = getHorariosAnio(anio);
  const anioData = getAnio(anio);

  // Mapa de nazarenos por idHdad para búsqueda rápida
  const nazarenosPorHdad = new Map(anioData.registros.map(r => [r.id_hdad, r]));

  const registros = horarios.registros.map(h => {
    const nazarenos = nazarenosPorHdad.get(h.id_hdad);

    // Si no hay datos de nazarenos, marcar como posible suspensión/lluvia
    const incidencia = nazarenos ? null : 'sin_datos';

    // Métricas derivadas (solo si hay datos de nazarenos)
    const nazarenosPorMinuto = nazarenos && h.duracionMin ?
      Math.round((nazarenos.noNaz / h.duracionMin) * 10) / 10 : null;
    const totalPorMinuto = nazarenos && h.duracionMin ?
      Math.round((nazarenos.noTotal / h.duracionMin) * 10) / 10 : null;

    return {
      ...h,
      // Datos de nazarenos (null si no salió ese año)
      nazarenos: nazarenos ? nazarenos.nazarenos : null,
      penitentes: nazarenos ? nazarenos.penitentes : null,
      noNaz: nazarenos ? nazarenos.noNaz : null,
      acolitos: nazarenos ? nazarenos.acolitos : null,
      monaguillos: nazarenos ? nazarenos.monaguillos : null,
      acompCortejo: nazarenos ? nazarenos.acompCortejo : null,
      noTotal: nazarenos ? nazarenos.noTotal : null,

      // % respecto al día (solo si hay datos)
      pctNaz: nazarenos ? nazarenos.pctNaz : null,
      pctTotal: nazarenos ? nazarenos.pctTotal : null,

      // Métricas derivadas del cruce
      incidencia, // null = normal, 'sin_datos' = posible lluvia/suspensión
      nazarenosPorMinuto,
      totalPorMinuto,
    };
  });

  // Ordenar: primero por día litúrgico, luego por hermandades con datos (más grande primero),
  // finalmente las sin datos
  registros.sort((a, b) => {
    if (a.diaOrden !== b.diaOrden) return a.diaOrden - b.diaOrden;
    // Ambos tienen datos
    if (a.incidencia === null && b.incidencia === null)
      return (b.noTotal || 0) - (a.noTotal || 0);
    // a tiene datos, b no
    if (a.incidencia === null && b.incidencia !== null) return -1;
    // b tiene datos, a no
    if (a.incidencia !== null && b.incidencia === null) return 1;
    // Ambos sin datos: orden alfabético
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  return {
    anio: horarios.anio,
    registros,
    diasPresentes: horarios.diasPresentes,
  };
}

/**
 * Calcula cuántos nazarenos hay simultáneamente en la calle por cada minuto del día.
 * Útil para gráficas de área que muestren la concentración a lo largo de la jornada.
 * Excluye hermandades marcadas como 'sin_datos'.
 */
/**
 * Nazarenos simultáneos en la calle por minuto, segregados por día litúrgico.
 * Muestreado cada 5 minutos (288 puntos/día) para las gráficas de área.
 * Excluye hermandades sin datos (posible lluvia/suspensión).
 */
export function getHorariosEnCalle(anio) {
  const crucero = getCruceNazarenosHorarios(anio);

  const diasSlug = [...new Set(crucero.registros.map((r) => r.diaSlug))];
  const porDia = {};

  for (const diaSlug of diasSlug) {
    const concentracion = new Array(24 * 60).fill(0);
    for (const h of crucero.registros) {
      if (h.diaSlug !== diaSlug || h.incidencia === 'sin_datos' || !h.noNaz) continue;
      for (let m = h.salidaMin; m <= h.entradaMin; m++) {
        concentracion[m % (24 * 60)] += h.noNaz;
      }
    }
    const serieTiempo = [];
    for (let i = 0; i < 24 * 60; i += 5) {
      const hora = Math.floor(i / 60);
      const minuto = i % 60;
      serieTiempo.push({
        hhmm: `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`,
        nazarenos: concentracion[i],
      });
    }
    porDia[diaSlug] = { serieTiempo, maxNazarenos: Math.max(...concentracion) };
  }

  return { anio: crucero.anio, porDia };
}

// ---------- Exportación de datos para el análisis cruzado ----------

/** Dataset plano para exportar el análisis cruzado (CSV/JSON). */
export function getCruceExport(anio) {
  const cruzado = getCruceNazarenosHorarios(anio);
  return cruzado.registros.map(r => ({
    anio: r.anio,
    id_hermandad: r.id_hdad,
    hermandad: r.nombre,
    dia: r.diaNombre,
    dia_slug: r.diaSlug,
    salida: r.horas.salida,
    entrada: r.horas.entrada,
    duracion_min: r.duracionMin,
    nazarenos: r.nazarenos,
    penitentes: r.penitentes,
    total_nazarenos: r.noNaz,
    acolitos: r.acolitos,
    monaguillos: r.monaguillos,
    acompañamiento: r.acompCortejo,
    total_cortejo: r.noTotal,
    nazarenos_por_minuto: r.nazarenosPorMinuto,
    total_por_minuto: r.totalPorMinuto,
    pct_nazarenos_dia: r.pctNaz ? Math.round(r.pctNaz * 10) / 10 : null,
    pct_cortejo_dia: r.pctTotal ? Math.round(r.pctTotal * 10) / 10 : null,
    incidencia: r.incidencia, // null o 'sin_datos'
  }));
}
