/**
 * Del itinerario en texto a una línea continua sobre el grafo de calles.
 *
 * 1. leerItinerario: texto pegado → líneas (una calle por línea, o separadas por comas).
 * 2. resolverItinerario: cada línea → vía oficial del CDAU, Carrera Oficial, punto fijado
 *    en el mapa, salida/entrada al templo o no resuelta.
 * 3. componer: recorre los elementos en orden. Cada paso va desde donde terminó el anterior
 *    hasta la primera esquina de la calle siguiente, por el camino de coste mínimo en el que
 *    las calles de la lista (la actual y la siguiente) cuestan 1 y cualquier otra 3.
 *    La Carrera Oficial es un paso sin penalizaciones entre la calle anterior y la siguiente.
 *    Los puntos de paso que arrastra el usuario fuerzan el camino de su paso.
 * 4. atajarHorquillas + suavizar: en las plazas se quitan las idas y vueltas del eje (el
 *    cortejo cruza la plaza); después el trazado completo se limpia de picos en los cruces y
 *    escalones del eje y se redondean las esquinas (geo.js); se vuelve a cortar en pasos.
 */

import { clave, esCarreraOficial, esZonaAbierta, normalizar } from './nombres.js';
import {
  atajarHorquillas, concatenar, cortarEn, curvaSuave, distM, longitud, puntoA, puntoMasCercano, subPolilinea, suavizar,
} from './geo.js';

const PENALIZACION_OTRAS = 3;   // coste relativo de calles que no están en la lista
const ENGANCHE_PUNTO_M = 25;    // un punto de paso a menos de esto se pega a la calle
const SALIDA_MAX_M = 150;       // la salida debe estar a menos de esto de una calle
const ENLACE_MIN_M = 10;        // tramos por calles no listadas que se avisan
const PUNTO_LIBRE_CERCA_M = 80; // punto de paso de la Carrera Oficial que corrige su camino (si no, va por otra calle)
/** Restricción dura: una calle nunca se acepta a más de esto de la última reconocida. */
export const DISTANCIA_MAX_CALLE_M = 1000;

const RE_TEMPLO = /^(salida|entrada|recogida|regreso|templo|parroquia|iglesia|capilla|basilica|catedral|convento|santa iglesia|puerta del? )/;

/** Texto pegado → [{ texto, n }] (n = posición en la lista). */
export function leerItinerario(texto) {
  const lineas = String(texto)
    .split(/\r?\n/)
    .flatMap((l) => (l.includes(',') || l.includes(';') ? l.split(/[,;]/) : [l]))
    .flatMap((l) => l.split(/\s[–—-]\s/))
    .map((l) => l.replace(/\s+/g, ' ').replace(/^[\s.·•*\d)]+/, '').replace(/[.\s]+$/, '').trim())
    .filter((l) => l && !l.startsWith('#'));
  return lineas.map((t, n) => ({ texto: t, n }));
}

/** Texto sin paréntesis para buscarlo ("Plaza del Duque (lado derecho)" → "Plaza del Duque"). */
export const textoBusqueda = (t) => t.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Resuelve las líneas contra el catálogo del municipio.
 * `elecciones`: clave(texto) → { tipo: 'via', nombre } | { tipo: 'punto', coord } | { tipo: 'omitir' }
 * (elecciones manuales del usuario; se aplican a todas las apariciones del mismo texto).
 */
export function resolverItinerario(lineas, catalogo, elecciones = {}, { templos = true } = {}) {
  const items = lineas.map(({ texto, n }) => {
    const k = clave(textoBusqueda(texto));
    const base = { n, texto, clave: k };
    if (esCarreraOficial(texto)) return { ...base, tipo: 'co', estado: 'ok' };
    const el = elecciones[k];
    if (el?.tipo === 'omitir') return { ...base, tipo: 'omitir', estado: 'manual' };
    if (el?.tipo === 'punto') return { ...base, tipo: 'punto', estado: 'manual', coord: el.coord };
    if (el?.tipo === 'via') {
      const e = catalogo.porNombre(el.nombre);
      if (e) return { ...base, tipo: 'via', estado: 'manual', nombre: e.nombre, ids: [...e.ids] };
    }
    const r = catalogo.resolver(textoBusqueda(texto));
    const candidatos = r.candidatos.map((c) => c.nombre);
    if (r.eleccion) {
      return { ...base, tipo: 'via', estado: r.estado, nombre: r.eleccion.nombre, ids: [...r.eleccion.ids], candidatos };
    }
    return { ...base, tipo: r.estado === 'ambigua' ? 'ambigua' : 'sin', estado: r.estado, candidatos };
  });

  // El templo de salida y de entrada no es una vía: si la primera línea no se resuelve
  // (o empieza por "Salida", "Parroquia", "Puerta del…"), es la salida; y la última, si es
  // el mismo texto o tampoco se resuelve, la entrada. Ambas se dibujan en el punto de salida.
  const esTemplo = (it) => it.estado !== 'manual' && it.tipo !== 'co' && (
    it.tipo === 'sin' || it.tipo === 'ambigua'
    || (it.estado !== 'ok' && RE_TEMPLO.test(normalizar(it.texto))));
  if (!templos) return items;
  if (items.length && (esTemplo(items[0]) || /^salida\b/.test(normalizar(items[0].texto)))) {
    items[0] = { ...items[0], tipo: 'salida', estado: 'ok' };
  }
  const u = items.length - 1;
  if (u > 0 && items[u].estado !== 'manual') {
    const ult = items[u];
    const esEntrada = esTemplo(ult)
      || (items[0].tipo === 'salida' && ult.clave === items[0].clave)
      || /^(entrada|recogida|regreso)\b/.test(normalizar(ult.texto));
    if (esEntrada) items[u] = { ...ult, tipo: 'entrada', estado: 'ok' };
  }
  return items;
}

/**
 * Compone el recorrido.
 * - items: salida de resolverItinerario.
 * - salida: [lon, lat] fijado en el mapa (puerta del templo).
 * - grafo: crearGrafo(...).
 * - puntosPaso: claveDePaso → [[lon, lat], …] arrastrados por el usuario.
 * - puertas: { salida: [id_vial…] | null, entrada: { punto: [lon, lat] | null, ids } | null }
 *   calle a la que da la puerta de salida y, si es otra, la puerta de entrada (punto y calle);
 *   sin ellas, la calle más cercana y la misma puerta.
 * - carrera: Carrera Oficial del municipio (carrera.js → paraComponer), o null para dejarla
 *   como tramo libre:
 *     { inicio: [lon, lat], calles: [items 'via' resueltos], entrada: [lon, lat] | null,
 *       interior: [[lon, lat], …], fin: [lon, lat], trazado: [[lon, lat], …] | null }
 *   Con `trazado` (calculado en su ventana) se llega hasta el inicio y se sigue su línea tal
 *   cual, sin recalcularla ni suavizarla (paso con `fija: true`). Sin él se calcula: inicio →
 *   calles → entrada; con `entrada` (puerta de un templo), de ella al fin se va en línea recta
 *   por los puntos `interior` (Catedral de Sevilla: Puerta de San Miguel → Puerta de Palos).
 *
 * Devuelve { pasos, coords, metros, avisos }.
 * Cada paso: { clave, hasta (índice en items), desde (índice o -1 = salida), tipo
 *   ('calle' | 'co' | 'manual' | 'recta'), etiqueta, coords, metros, enlaces: [{ nombre, metros }] }.
 * La Carrera Oficial definida genera varios pasos con el mismo `hasta`.
 */
export function componer({ items, salida, grafo, puntosPaso = {}, carrera = null, puertas = {} }) {
  const avisos = [];
  const pasos = [];
  // La puerta se ancla al eje de la calle a la que da (puertas.salida: ids de esa vía) o, si
  // no se ha dicho, al de la calle más cercana. El cortejo arranca desde ese punto del eje
  // hacia el lado que lleve a la primera calle.
  const anclar = (punto, ids, cual) => {
    if (ids?.length) {
      const a = grafo.anclar(punto, ids, SALIDA_MAX_M);
      if (a) return a;
      avisos.push(`La calle de la puerta de ${cual} está a más de ${SALIDA_MAX_M} m de la puerta; se usa la calle más cercana.`);
    }
    return grafo.anclar(punto, null, SALIDA_MAX_M);
  };
  const anclaSalida = anclar(salida, puertas.salida, 'salida');
  if (!anclaSalida) {
    return { pasos, coords: [salida], metros: 0, avisos: [`La salida está a más de ${SALIDA_MAX_M} m de cualquier calle cargada.`] };
  }
  const puntoEntrada = puertas.entrada?.punto ?? salida;
  const anclaEntrada = puertas.entrada?.punto || puertas.entrada?.ids?.length
    // Otra puerta sin calle indicada: la más cercana a esa puerta; la misma puerta: su calle.
    ? anclar(puntoEntrada, puertas.entrada.ids?.length ? puertas.entrada.ids : puertas.entrada.punto ? null : puertas.salida, 'entrada') ?? anclaSalida
    : anclaSalida;

  let cursor = anclaSalida.a;
  let arranque = anclaSalida;  // el primer paso sale del punto del eje hacia a o hacia b
  const fijos = [];          // puntos de paso del usuario: el suavizado no los toca
  let previa = -1;           // índice del último elemento alcanzado (-1 = salida)
  let clavePrevia = 'salida';
  let idsPrevios = [];
  let ultimoPunto = null;    // si el paso anterior acabó en un punto fuera del grafo
  let coPendiente = false;
  const ocurrencias = new Map();

  /**
   * Un paso hasta `obj` ({ tipo: 'via' | 'punto' | 'entrada', ids, coord, texto, clave, recta }).
   * Devuelve false si no se pudo (y deja un aviso).
   */
  function avanzar(obj, i, { co = false, libre = false, etiqueta = null } = {}) {
    let destinos, puntoFinal = null, nodoFinal = null;
    if (obj.tipo === 'via') {
      const ids = obj.ids.filter((id) => grafo.tieneVia(id));
      if (!ids.length) { avisos.push(`«${obj.texto}» (${obj.nombre}) queda fuera de la zona cargada; se salta.`); return false; }
      // Restricción dura (además de continuidad.js): solo cuentan las esquinas a ≤ 1 km de la
      // última calle reconocida, o del punto donde acabó el paso anterior si no fue una calle.
      const previas = idsPrevios.filter((id) => grafo.tieneVia(id));
      const ancla = previas.length ? [...grafo.nodosDeVias(previas)].map(grafo.coord) : [grafo.coord(cursor)];
      destinos = new Set([...grafo.nodosDeVias(ids)].filter((n) => {
        const c = grafo.coord(n);
        return ancla.some((a) => distM(a, c) <= DISTANCIA_MAX_CALLE_M);
      }));
      if (!destinos.size) { avisos.push(`«${obj.texto}» (${obj.nombre}) está a más de 1 km de la última calle reconocida; se salta.`); return false; }
    } else {
      // 'punto' fijado en el mapa, o 'entrada' (vuelta al punto de salida)
      puntoFinal = obj.tipo === 'entrada' ? puntoEntrada : obj.coord;
      nodoFinal = obj.tipo === 'entrada' ? { nodo: anclaEntrada.a } : grafo.cercano(puntoFinal, SALIDA_MAX_M);
      // Por el interior de un templo (recta) no hace falta calle cerca.
      if (!nodoFinal && !obj.recta) { avisos.push(`«${obj.texto}»: el punto está lejos de cualquier calle; se salta.`); return false; }
      // A la puerta de entrada se llega por su calle: por cualquiera de los dos extremos del
      // segmento donde se ancla, y de ahí al punto del eje frente a la puerta.
      destinos = obj.tipo === 'entrada' ? new Set([anclaEntrada.a, anclaEntrada.b])
        : nodoFinal ? new Set([nodoFinal.nodo]) : new Set();
      fijos.push(puntoFinal);   // los puntos fijados no se mueven al suavizar
    }

    const base = `${clavePrevia}>${obj.clave}`;
    const occ = ocurrencias.get(base) ?? 0;
    ocurrencias.set(base, occ + 1);
    const clavePaso = `${base}#${occ}`;

    const permitidas = new Set([...idsPrevios, ...(obj.ids ?? [])]);
    const coste = libre ? () => 1 : (e) => (permitidas.has(grafo.viaDeArista(e).id) ? 1 : PENALIZACION_OTRAS);

    const partes = [];
    const aristas = [];
    let actual = cursor;
    let sinConexion = false;

    if (obj.recta) {
      // Por el interior de un edificio: recta desde donde acabó el paso anterior.
      partes.push([ultimoPunto ?? grafo.coord(actual), puntoFinal]);
      if (nodoFinal) actual = nodoFinal.nodo;
    } else {
      if (arranque) {
        // Primer paso: desde el punto del eje frente a la puerta, hacia el extremo del
        // segmento que dé el camino más corto (sin ir y volver por la calle de la puerta).
        const wps0 = puntosPaso[clavePaso] ?? [];
        const n0 = wps0.length ? grafo.cercano(wps0[0], 300) : null;
        const objetivo = n0 ? new Set([n0.nodo]) : destinos;
        let mejor = null;
        for (const n of [arranque.a, arranque.b]) {
          const r = grafo.ruta(n, objetivo, coste);
          const total = distM(arranque.coord, grafo.coord(n)) + (r ? r.metros : Infinity);
          if (!mejor || total < mejor.total) mejor = { n, total };
        }
        partes.push([arranque.coord, grafo.coord(mejor.n)]);
        actual = mejor.n;
        arranque = null;
      }
      // En la Carrera Oficial los puntos de paso no se pegan a los ejes: la línea sale de la
      // calle antes del primero, pasa por todos con una curva suave y vuelve después del último.
      const wps = puntosPaso[clavePaso] ?? [];
      const t = co && wps.length ? tramoLibre(actual, wps, destinos, coste) : null;
      if (t) {
        partes.push(...t.partes);
        aristas.push(...t.aristas);
        fijos.push(...t.curva);
        actual = t.fin;
      } else {
        for (const p of puntosPaso[clavePaso] ?? []) {
          const enganche = grafo.cercano(p, ENGANCHE_PUNTO_M);
          if (enganche) {
            const r = grafo.ruta(actual, new Set([enganche.nodo]));
            if (r) { partes.push(r.nodos.map(grafo.coord)); aristas.push(...r.aristas); actual = enganche.nodo; fijos.push(grafo.coord(enganche.nodo)); continue; }
          }
          // Punto fuera de las calles (p. ej. dentro de una plaza): se llega en línea recta.
          const vuelta = grafo.cercano(p, 300);
          partes.push([grafo.coord(actual), p]);
          fijos.push(p);
          if (vuelta) { partes.push([p, grafo.coord(vuelta.nodo)]); actual = vuelta.nodo; }
        }
        const r = grafo.ruta(actual, destinos, coste);
        if (r) {
          partes.push(r.nodos.map(grafo.coord));
          aristas.push(...r.aristas);
          actual = r.nodos[r.nodos.length - 1];
        } else {
          // Sin conexión en el grafo: recta al destino más cercano, marcada para revisar.
          let mejor = null;
          for (const n of destinos) {
            const d = distM(grafo.coord(actual), grafo.coord(n));
            if (!mejor || d < mejor.d) mejor = { n, d };
          }
          partes.push([grafo.coord(actual), grafo.coord(mejor.n)]);
          actual = mejor.n;
          sinConexion = true;
          avisos.push(`No hay conexión por calles hasta «${obj.texto}»; se ha unido en línea recta.`);
        }
      }
      if (obj.tipo === 'entrada') partes.push([grafo.coord(actual), anclaEntrada.coord, puntoFinal]);
      else if (puntoFinal) partes.push([grafo.coord(actual), puntoFinal]);
    }

    // Calles no listadas por las que pasa el paso (no en tramos libres).
    const enlaces = [];
    if (!libre && !obj.recta) {
      const porVia = new Map();
      for (const e of aristas) {
        const v = grafo.viaDeArista(e);
        if (permitidas.has(v.id)) continue;
        porVia.set(v.nombre, (porVia.get(v.nombre) ?? 0) + grafo.longitudArista(e));
      }
      for (const [nombre, m] of porVia) if (m >= ENLACE_MIN_M) enlaces.push({ nombre, metros: Math.round(m) });
      enlaces.sort((a, b) => b.metros - a.metros);
    }

    const coords = concatenar(partes);
    pasos.push({
      clave: clavePaso,
      desde: previa,
      hasta: i,
      tipo: sinConexion ? 'recta' : co ? 'co' : (puntosPaso[clavePaso]?.length ? 'manual' : 'calle'),
      etiqueta,
      coords,
      metros: longitud(coords),
      enlaces,
    });

    cursor = actual;
    clavePrevia = obj.clave;
    idsPrevios = obj.ids ?? [];
    ultimoPunto = puntoFinal;
    return true;
  }

  /**
   * Puntos de paso libres (Carrera Oficial): son correcciones locales del camino por calles.
   * La línea deja ese camino un poco antes del primer punto, pasa por todos con una curva
   * suave y vuelve a él un poco después del último. Si el primer o el último punto están
   * lejos del camino (> PUNTO_LIBRE_CERCA_M, el cortejo va por otra calle), ese extremo se
   * enlaza por calles con el cruce más cercano al punto. null si no hay camino.
   */
  function tramoLibre(origen, wps, destinos, coste) {
    const w1 = wps[0], wn = wps[wps.length - 1];
    const proy = (c, p) => (c.length > 1 ? puntoMasCercano(c, p) : { metros: 0, d: distM(c[0], p) });
    // Se deja la calle antes del punto (y se vuelve a ella después) tanto como se separe de
    // ella, entre 8 y 40 m, para que la curva entre y salga sin quiebros.
    const holgura = (d) => Math.min(40, Math.max(8, d));
    const R = grafo.ruta(origen, destinos, coste);
    const cR = R ? R.nodos.map(grafo.coord) : null;
    let p1 = cR ? proy(cR, w1) : null;
    let p2 = cR ? proy(cR, wn) : null;
    if (p1 && p2 && p2.metros < p1.metros - 1) p1 = p2 = null;   // al revés del camino
    const aristas = R ? [...R.aristas] : [];

    let ida, antes, vuelta, despues, fin;
    if (p1 && p1.d <= PUNTO_LIBRE_CERCA_M) {
      const sale = Math.max(0, p1.metros - holgura(p1.d));
      ida = subPolilinea(cR, 0, sale);
      antes = sale > 0.5 ? puntoA(cR, Math.max(0, sale - 5)).coord : null;
    } else {
      const n1 = grafo.cercano(w1, 300);
      const r1 = n1 && grafo.ruta(origen, new Set([n1.nodo]), coste);
      if (!r1) return null;
      const c1 = r1.nodos.map(grafo.coord);
      const q = proy(c1, w1);
      const sale = Math.max(0, q.metros - holgura(q.d));
      ida = c1.length > 1 ? subPolilinea(c1, 0, sale) : [c1[0]];
      antes = sale > 0.5 ? puntoA(c1, Math.max(0, sale - 5)).coord : null;
      aristas.push(...r1.aristas);
    }
    if (p2 && p2.d <= PUNTO_LIBRE_CERCA_M) {
      const l = longitud(cR);
      const entra = Math.min(l, p2.metros + holgura(p2.d));
      vuelta = cR.length > 1 ? subPolilinea(cR, entra, l) : [cR[0]];
      despues = entra < l - 0.5 ? puntoA(cR, Math.min(l, entra + 5)).coord : null;
      fin = R.nodos[R.nodos.length - 1];
    } else {
      const n2 = grafo.cercano(wn, 300);
      const r2 = n2 && grafo.ruta(n2.nodo, destinos, coste);
      if (!r2) return null;
      const c2 = r2.nodos.map(grafo.coord);
      const l = longitud(c2);
      const q = proy(c2, wn);
      const entra = Math.min(l, q.metros + holgura(q.d));
      vuelta = c2.length > 1 ? subPolilinea(c2, entra, l) : [c2[0]];
      despues = entra < l - 0.5 ? puntoA(c2, Math.min(l, entra + 5)).coord : null;
      fin = r2.nodos[r2.nodos.length - 1];
      aristas.push(...r2.aristas);
    }
    const curva = curvaSuave([ida[ida.length - 1], ...wps, vuelta[0]], { antes, despues });
    return { partes: [ida, curva, vuelta], aristas, curva, fin };
  }

  /** Carrera Oficial con trazado guardado: un paso con su línea, que no se toca. */
  function pasoFijo(c, i) {
    const base = `${clavePrevia}>co:trazado`;
    const occ = ocurrencias.get(base) ?? 0;
    ocurrencias.set(base, occ + 1);
    pasos.push({
      clave: `${base}#${occ}`, desde: previa, hasta: i, tipo: 'co', fija: true, etiqueta: 'Carrera Oficial',
      coords: c.trazado, metros: longitud(c.trazado), enlaces: [],
    });
    const fin = c.trazado[c.trazado.length - 1];
    const n = grafo.cercano(fin, SALIDA_MAX_M);
    if (n) cursor = n.nodo;
    clavePrevia = 'co:fin';
    idsPrevios = [];
    ultimoPunto = fin;
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (i === 0 && it.tipo === 'salida') continue;
    if (it.tipo === 'omitir') continue;
    if (it.tipo === 'co') {
      if (!carrera) { coPendiente = true; continue; }
      if (carrera.trazado) {
        // Trazado fijo: se llega al inicio y se sigue la línea guardada.
        if (avanzar({ tipo: 'punto', coord: carrera.inicio, texto: 'Inicio de la Carrera Oficial', clave: 'co:inicio' }, i, { etiqueta: 'Hasta el inicio de la Carrera Oficial' })) {
          pasoFijo(carrera, i);
          previa = i;
        }
        continue;
      }
      // Carrera Oficial sin trazado guardado: inicio → calles → [entrada → interior] → fin.
      const tramos = [
        { tipo: 'punto', coord: carrera.inicio, texto: 'Inicio de la Carrera Oficial', clave: 'co:inicio', etiqueta: 'Carrera Oficial: inicio' },
        ...carrera.calles.map((c, k) => ({ ...c, clave: `co:${k}:${c.clave}`, etiqueta: `Carrera Oficial: ${c.texto}` })),
        ...(carrera.entrada ? [
          { tipo: 'punto', coord: carrera.entrada, texto: 'Entrada en el templo', clave: 'co:entrada', etiqueta: 'Carrera Oficial: entrada en el templo' },
          ...(carrera.interior ?? []).map((coord, k) => ({ tipo: 'punto', coord, texto: 'Interior del templo', clave: `co:interior:${k}`, recta: true, etiqueta: `Carrera Oficial: punto interior ${k + 1}` })),
        ] : []),
        { tipo: 'punto', coord: carrera.fin, texto: 'Fin de la Carrera Oficial', clave: 'co:fin', recta: !!carrera.entrada, etiqueta: carrera.entrada ? 'Carrera Oficial: salida del templo' : 'Carrera Oficial: fin' },
      ];
      let alguno = false;
      tramos.forEach((t, k) => {
        // Si el recorrido empieza en el propio inicio (ventana de la Carrera Oficial), no hay
        // que llegar a él: se evita ir al eje y volver.
        if (k === 0 && !pasos.length && distM(salida, t.coord) < 1) return;
        // Hasta el inicio se llega como a cualquier punto (penalizando calles no listadas);
        // dentro de la Carrera Oficial cuentan sus propias calles.
        if (avanzar(t, i, { co: k > 0, etiqueta: t.etiqueta })) alguno = true;
      });
      if (alguno) previa = i;
      continue;
    }
    if (it.tipo === 'sin' || it.tipo === 'ambigua') {
      avisos.push(`«${it.texto}»: ${it.tipo === 'sin' ? 'no se encuentra en el callejero' : 'hay varias vías posibles'}; se salta.`);
      continue;
    }
    if (it.tipo === 'lejos') {
      const lejos = it.metros == null ? '' : ` (a ${it.metros >= 1000 ? `${(it.metros / 1000).toFixed(1).replace('.', ',')} km` : `${it.metros} m`})`;
      avisos.push(`«${it.texto}»: ${it.nombre} está lejos de la última calle reconocida${lejos} y no hay otra parecida a menos de ${it.limite ?? DISTANCIA_MAX_CALLE_M} m; se salta.`);
      continue;
    }
    const libre = coPendiente;
    if (avanzar(it, i, { co: libre, libre, etiqueta: libre ? 'Carrera Oficial (tramo libre)' : null })) {
      previa = i;
      coPendiente = false;
    }
  }

  if (coPendiente) avisos.push('La Carrera Oficial está al final de la lista y no tiene calle siguiente.');
  const anclas = { salida: anclaSalida, entrada: anclaEntrada };
  if (!pasos.length) return { pasos, coords: [salida], metros: 0, avisos, anclas };

  // Suavizado del trazado completo y nuevo reparto en pasos (el enlace salida → primera
  // calle es la pieza 0; cada paso empieza donde acaba el anterior).
  // Tramos consecutivos fijos (Carrera Oficial guardada) o no: solo se suavizan los otros.
  const grupos = [];
  for (const p of pasos) {
    const u = grupos[grupos.length - 1];
    if (u && u.fija === !!p.fija) u.partes.push(p.coords);
    else grupos.push({ fija: !!p.fija, partes: grupos.length ? [p.coords] : [[salida], p.coords] });
  }
  const cortes = [pasos[0].coords[0], ...pasos.slice(0, -1).map((p) => p.coords[p.coords.length - 1])];
  const metrosAprox = [];
  let m = distM(salida, pasos[0].coords[0]);
  metrosAprox.push(m);
  for (const p of pasos.slice(0, -1)) { m += p.metros; metrosAprox.push(m); }
  const suave = concatenar(grupos.map((g) => {
    const tramo = concatenar(g.partes);
    if (g.fija) return tramo;
    // Horquillas en plazas: segmento abierto si une dos nodos por una arista de una plaza.
    const nodos = tramo.map((c) => grafo.cercano(c, 0.3)?.nodo ?? -1);
    const abierto = (i) => {
      const a = nodos[i], b = nodos[i + 1];
      if (a < 0 || b < 0) return false;
      const e = grafo.aristaEntre(a, b);
      return e >= 0 && esZonaAbierta(grafo.viaDeArista(e).nombre);
    };
    return suavizar(atajarHorquillas(tramo, abierto, { fijos }), { fijos });
  }));
  const piezas = cortarEn(suave, cortes, metrosAprox);
  pasos.forEach((p, k) => {
    p.coords = piezas[k + 1];
    p.metros = longitud(p.coords);
  });
  const coords = concatenar(piezas);
  return { pasos, coords, metros: longitud(coords), avisos, anclas };
}
