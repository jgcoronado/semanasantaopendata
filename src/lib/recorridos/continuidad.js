/**
 * Continuidad del itinerario: cada calle de la lista tiene que estar cerca de la anterior.
 *
 * El catálogo resuelve por nombre en todo el municipio, y en municipios con pedanías o
 * barriadas hay homónimas a kilómetros (Jerez: «De la Rosa», hoy Padre Hortas Cáliz, junto
 * a la Encarnación, frente a la Calle Rosa de una pedanía). Con la geometría de las
 * candidatas se comprueba, en orden, que cada vía esté a menos de `radio` m de la última
 * vía aceptada (o de la salida, o del fin de la Carrera Oficial):
 *
 *  1. De las vías con el nombre elegido se quedan las cercanas (homónimas en otro núcleo
 *     con el mismo nombre normalizado comparten entrada en el catálogo).
 *  2. Si ninguna está cerca, se busca una vía cercana con nombre parecido al menos al
 *     `umbral` (90 %) o con varias posibles («Encarnación»: Plaza o Cuesta), y se elige la
 *     más cercana a la anterior y a la siguiente.
 *  3. Si no hay ninguna cerca, la línea queda 'lejos' y no se dibuja (como omitirla): el
 *     camino entre la anterior y la siguiente sale solo y la lista dice por qué calles pasa.
 *
 * Cada línea que no se dibuja amplía el radio para la siguiente (la calle saltada tiene su
 * longitud). Tras una Carrera Oficial sin definir no se sabe dónde acaba: radio amplio.
 */

import { textoBusqueda } from './componer.js';
import { distM, proyectar } from './geo.js';

const RAD = Math.PI / 180;
const M_GRADO = 111320;
const RADIO_TRAS_CO_LIBRE_M = 2500;
const SALTOS_MAX = 3;

function bboxLineas(lineas) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const l of lineas) for (const [x, y] of l) {
    if (x < b[0]) b[0] = x;
    if (y < b[1]) b[1] = y;
    if (x > b[2]) b[2] = x;
    if (y > b[3]) b[3] = y;
  }
  return b;
}

function distBbox(a, b) {
  const k = Math.cos(((a[1] + a[3]) / 2) * RAD);
  const dx = Math.max(0, a[0] - b[2], b[0] - a[2]) * M_GRADO * k;
  const dy = Math.max(0, a[1] - b[3], b[1] - a[3]) * M_GRADO;
  return Math.hypot(dx, dy);
}

function distPuntoLineas(p, lineas) {
  let d = Infinity;
  for (const l of lineas) {
    if (l.length === 1) { d = Math.min(d, distM(p, l[0])); continue; }
    for (let i = 1; i < l.length; i++) d = Math.min(d, proyectar(p, l[i - 1], l[i]).d);
  }
  return d;
}

/** Distancia mínima entre dos conjuntos de líneas; si las cajas ya distan más de `tope`, esa. */
export function distLineas(a, b, tope = Infinity) {
  if (!a.length || !b.length) return Infinity;
  const db = distBbox(bboxLineas(a), bboxLineas(b));
  if (db > tope) return db;
  let d = Infinity;
  for (const l of a) for (const p of l) d = Math.min(d, distPuntoLineas(p, b));
  for (const l of b) for (const p of l) d = Math.min(d, distPuntoLineas(p, a));
  return d;
}

/**
 * items: salida de resolverItinerario.
 * catalogo: crearCatalogo() del municipio.
 * geometria(ids): async → Map id_vial → { lineas }.
 * inicio: [lon, lat] desde el que se mide la primera vía (la salida o el inicio de la CO).
 * finCarrera: [lon, lat] del fin de la Carrera Oficial definida, o null si es tramo libre.
 * Devuelve una copia de items con las vías ajustadas. Las líneas cambiadas llevan
 * `cercania`: { antes?, entre?, metros } y las descartadas tipo/estado 'lejos' con `metros`.
 */
export async function confirmarContinuidad(items, {
  catalogo, geometria, inicio, finCarrera = null, radio = 300, umbral = 0.9,
}) {
  // Candidatas de cada línea: el nombre elegido, las varias posibles y las parecidas ≥ umbral.
  const opciones = items.map((it) => {
    if (it.tipo !== 'via' && it.tipo !== 'ambigua') return [];
    const nombres = new Set();
    if (it.tipo === 'via') nombres.add(it.nombre);
    if (it.estado !== 'manual') {
      for (const n of it.tipo === 'ambigua' ? it.candidatos ?? [] : []) nombres.add(n);
      for (const { entrada } of catalogo.similares(textoBusqueda(it.texto), umbral)) nombres.add(entrada.nombre);
    }
    return [...nombres].map((n) => catalogo.porNombre(n)).filter(Boolean);
  });
  const ids = new Set();
  for (const lista of opciones) for (const e of lista) for (const id of e.ids) ids.add(id);
  const geo = ids.size ? await geometria([...ids]) : new Map();
  const lineasDe = (lista) => lista.flatMap((id) => geo.get(id)?.lineas ?? []);

  const out = items.map((it) => ({ ...it }));
  let ancla = [[inicio]];
  let saltos = 0;
  let trasCoLibre = false;

  // Distancia de cada vía de una entrada al ancla; se queda con las que están en el límite.
  const cercanas = (entrada, limite) => {
    const r = [];
    for (const id of entrada.ids) {
      const d = distLineas(lineasDe([id]), ancla, limite);
      if (d <= limite) r.push({ id, d });
    }
    return r;
  };
  // Siguiente línea que es una vía, para desempatar entre candidatas igual de cerca.
  const siguienteVia = (i) => {
    for (let j = i + 1; j < out.length; j++) {
      if (out[j].tipo === 'via') return lineasDe(out[j].ids);
      if (out[j].tipo === 'punto') return [[out[j].coord]];
      if (out[j].tipo === 'co') return null;
    }
    return null;
  };
  const aceptar = (it, idsCerca) => {
    it.ids = idsCerca;
    ancla = lineasDe(idsCerca);
    saltos = 0;
    trasCoLibre = false;
  };

  out.forEach((it, i) => {
    switch (it.tipo) {
      case 'salida': ancla = [[inicio]]; return;
      case 'entrada': return;
      case 'punto': ancla = [[it.coord]]; saltos = 0; trasCoLibre = false; return;
      case 'co':
        if (finCarrera) { ancla = [[finCarrera]]; saltos = 0; trasCoLibre = false; } else trasCoLibre = true;
        return;
      case 'via': case 'ambigua': break;
      default: saltos += 1; return;   // sin resolver u omitida: su longitud separa la siguiente
    }

    const limite = trasCoLibre ? RADIO_TRAS_CO_LIBRE_M : radio * (1 + Math.min(saltos, SALTOS_MAX));

    if (it.tipo === 'via') {
      const propia = cercanas(catalogo.porNombre(it.nombre) ?? { ids: new Set(it.ids) }, limite);
      if (propia.length) { aceptar(it, propia.map((c) => c.id)); return; }
      if (it.estado === 'manual') {
        // Elegida a mano: se respeta aunque esté lejos.
        aceptar(it, it.ids);
        return;
      }
    }

    // Alternativas cercanas: varias posibles o nombres parecidos.
    const sig = siguienteVia(i);
    const alternativas = [];
    for (const e of opciones[i]) {
      if (it.tipo === 'via' && e.nombre === it.nombre) continue;
      const c = cercanas(e, limite);
      if (!c.length) continue;
      const d = Math.min(...c.map((x) => x.d));
      const dSig = sig ? Math.min(distLineas(lineasDe(c.map((x) => x.id)), sig, limite), limite) : 0;
      alternativas.push({ e, ids: c.map((x) => x.id), d, puntos: d + dSig });
    }
    alternativas.sort((a, b) => a.puntos - b.puntos || a.d - b.d);

    if (alternativas.length) {
      const mejor = alternativas[0];
      out[i] = {
        ...it,
        tipo: 'via',
        estado: 'aprox',
        nombre: mejor.e.nombre,
        cercania: {
          metros: Math.round(mejor.d),
          ...(it.tipo === 'via' ? { antes: it.nombre } : {}),
          ...(alternativas.length > 1 ? { entre: alternativas.map((a) => a.e.nombre) } : {}),
        },
      };
      aceptar(out[i], mejor.ids);
      return;
    }

    if (it.tipo === 'via') {
      const metros = distLineas(lineasDe(it.ids), ancla);
      out[i] = { ...it, tipo: 'lejos', estado: 'lejos', metros: Number.isFinite(metros) ? Math.round(metros) : null };
      delete out[i].ids;
    }
    saltos += 1;
  });
  return out;
}
