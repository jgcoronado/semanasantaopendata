/**
 * Carrera Oficial de cada localidad.
 *
 * Es la misma para todas las cofradías del municipio y casi no cambia de un año a otro: se
 * define en su propia ventana (/recorridos/carrera-oficial/) y el editor de recorridos la usa
 * tal cual, sin poder modificarla. Definición:
 *
 *   { municipio, inicio: [lon, lat], calles: ['La Campana', …], elecciones, puntosPaso,
 *     entrada: [lon, lat] | null,   // puerta por la que entra en un templo (opcional)
 *     interior: [[lon, lat], …],     // puntos por dentro del templo, en orden
 *     fin: [lon, lat],               // con entrada: la puerta por la que sale
 *     trazado: [[lon, lat], …],      // línea calculada y revisada en su ventana
 *     metros, actualizado, fuente }
 *
 * Origen: la guardada en este navegador desde su ventana o, si no hay, la del proyecto
 * (src/data/carreras-oficiales.json). Con `trazado`, el editor la dibuja sin recalcularla.
 */

import { guardarLocal, leerLocal } from './almacen.js';
import { leerItinerario, resolverItinerario } from './componer.js';
import { redondear } from './geo.js';

export const CLAVE_CARRERAS = 'ssod-carreras-oficiales-v1';

export function normalizarCarrera(d) {
  if (!d) return null;
  const calles = Array.isArray(d.calles) ? d.calles : leerItinerario(d.calles ?? '').map((l) => l.texto);
  return {
    municipio: d.municipio ?? null,
    inicio: d.inicio ?? null,
    calles,
    elecciones: d.elecciones ?? {},
    puntosPaso: d.puntosPaso ?? {},
    entrada: d.entrada ?? null,
    interior: d.entrada ? (d.interior ?? []) : [],
    fin: d.fin ?? null,
    trazado: Array.isArray(d.trazado) && d.trazado.length > 1 ? d.trazado : null,
    metros: d.metros ?? null,
    actualizado: d.actualizado ?? null,
    fuente: d.fuente ?? null,
  };
}

export const carreraCompleta = (def) => !!(def?.inicio && def?.fin);

export const carrerasGuardadas = () => leerLocal(CLAVE_CARRERAS, {});

/** Vigente para el municipio: { def, origen: 'navegador' | 'proyecto' | null }. */
export function carreraVigente(cod, proyecto = {}) {
  const local = carrerasGuardadas()[cod];
  if (local) return { def: normalizarCarrera(local), origen: 'navegador' };
  if (proyecto[cod]) return { def: normalizarCarrera(proyecto[cod]), origen: 'proyecto' };
  return { def: null, origen: null };
}

export function guardarCarrera(cod, def) {
  guardarLocal(CLAVE_CARRERAS, { ...carrerasGuardadas(), [cod]: def });
}

export function borrarCarrera(cod) {
  const t = carrerasGuardadas();
  delete t[cod];
  guardarLocal(CLAVE_CARRERAS, t);
}

/** Resolución de las calles contra el catálogo del municipio (items de componer). */
export function resolverCalles(def, catalogo) {
  return resolverItinerario(def.calles.map((texto, n) => ({ texto, n })), catalogo, def.elecciones, { templos: false });
}

/** Lo que necesita componer: calles ya resueltas (solo las vías). */
export function paraComponer(def, lineas) {
  return {
    inicio: def.inicio,
    calles: lineas.filter((it) => it.tipo === 'via'),
    entrada: def.entrada,
    interior: def.interior ?? [],
    fin: def.fin,
    trazado: def.trazado,
  };
}

/** Entrada para src/data/carreras-oficiales.json (texto `"cod": {…}`). */
export function aEntradaProyecto(cod, def) {
  const r = (p) => (p ? redondear(p) : null);
  const vacio = (o) => !o || !Object.keys(o).length;
  const entrada = {
    municipio: def.municipio,
    inicio: r(def.inicio),
    calles: def.calles,
    ...(vacio(def.elecciones) ? {} : { elecciones: def.elecciones }),
    ...(vacio(def.puntosPaso) ? {} : { puntosPaso: Object.fromEntries(Object.entries(def.puntosPaso).map(([k, l]) => [k, l.map(r)])) }),
    ...(def.entrada ? { entrada: r(def.entrada), interior: (def.interior ?? []).map(r) } : {}),
    fin: r(def.fin),
    ...(def.trazado ? { trazado: def.trazado.map((c) => [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6]), metros: def.metros } : {}),
    actualizado: def.actualizado,
    ...(def.fuente ? { fuente: def.fuente } : {}),
  };
  // Coordenadas en una línea cada una, para que el JSON se pueda revisar en un diff.
  const texto = JSON.stringify(entrada, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]');
  return `"${cod}": ${texto.replace(/\n/g, '\n  ')}`;
}
