/**
 * Normalización y resolución de nombres de calles para el editor de recorridos.
 *
 * Los itinerarios de las hermandades usan nombres abreviados o populares
 * ("Alemanes", "Pza. Virgen de los Reyes", "Entre Cárceles") y OpenStreetMap
 * y los GeoJSON de 2025 usan el nombre completo ("Calle Alemanes",
 * "Plaza Virgen de los Reyes", "Calle Entrecárceles"). La `clave` reduce
 * ambos a la misma forma: sin acentos, sin tipo de vía, sin artículos ni
 * preposiciones y sin espacios.
 */

/** Primera palabra que indica el tipo de vía (se descarta en la clave). */
const TIPOS_VIA = {
  calle: 'calle', c: 'calle', cl: 'calle', cll: 'calle',
  plaza: 'plaza', pza: 'plaza', pl: 'plaza', plz: 'plaza', plza: 'plaza',
  plazuela: 'plaza',
  avenida: 'avenida', avda: 'avenida', av: 'avenida', avd: 'avenida',
  paseo: 'paseo', pso: 'paseo', po: 'paseo',
  glorieta: 'glorieta', gta: 'glorieta',
  pasaje: 'pasaje', psje: 'pasaje', pje: 'pasaje',
  callejon: 'callejon', cjon: 'callejon',
  ronda: 'ronda', costanilla: 'costanilla', compas: 'compas',
};

/** Abreviaturas habituales en los itinerarios. */
const ABREVIATURAS = {
  sta: 'santa', sto: 'santo', ntra: 'nuestra', ntro: 'nuestro', sra: 'senora', sr: 'senor',
  dr: 'doctor', dra: 'doctora', gral: 'general', cdal: 'cardenal', card: 'cardenal',
  hno: 'hermano', hna: 'hermana', pdre: 'padre', ma: 'maria', fco: 'francisco',
};

const ARTICULOS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'a', 'al']);

/** Minúsculas, sin acentos ni signos, palabras separadas por un espacio. */
export function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Tipo de vía con el que empieza el texto ('calle', 'plaza'…) o null. */
export function tipoVia(texto) {
  const p = normalizar(texto).split(' ')[0];
  return TIPOS_VIA[p] ?? null;
}

/**
 * Clave de comparación. "C/ Tomás de Ybarra" y "Calle Tomás de Ibarra" dan
 * la misma clave ("tomasibarra"): la y/i se unifica en ambos lados.
 */
export function clave(texto) {
  let palabras = normalizar(texto).split(' ').filter(Boolean);
  // Hasta dos tipos seguidos ("Calle Paseo de Catalina de Ribera").
  for (let k = 0; k < 2 && palabras.length > 1 && TIPOS_VIA[palabras[0]]; k++) palabras = palabras.slice(1);
  palabras = palabras.map((w) => ABREVIATURAS[w] ?? w).filter((w) => !ARTICULOS.has(w));
  return palabras.join('').replace(/y/g, 'i');
}

/** ¿La línea del itinerario es la Carrera Oficial? */
export const esCarreraOficial = (texto) => /^carrera oficial\b/.test(normalizar(texto));

/** Distancia de Levenshtein con corte (devuelve max+1 si la supera). */
export function levenshtein(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let minFila = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < minFila) minFila = cur[j];
    }
    if (minFila > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Catálogo de nombres de vía de un municipio. Cada entrada:
 *   { nombre, ids: Set<id_vial> }
 * Un mismo nombre puede tener varios id_vial (vías homónimas en distintos núcleos, o una
 * calle partida en varios registros): se agrupan y al componer el recorrido se usa la
 * más cercana. El sobrenombre del CDAU ("Puente El Cachorro") se indexa como alias.
 */
export function crearCatalogo() {
  const porClave = new Map();
  const porNombre = new Map();

  function indexar(k, entrada) {
    if (!k) return;
    const lista = porClave.get(k) ?? porClave.set(k, []).get(k);
    if (!lista.includes(entrada)) lista.push(entrada);
  }

  function añadir({ nombre, id, alias = null }) {
    if (!nombre) return;
    let e = porNombre.get(nombre);
    if (!e) {
      e = { nombre, ids: new Set() };
      porNombre.set(nombre, e);
      indexar(clave(nombre), e);
    }
    if (id != null) e.ids.add(id);
    if (alias) indexar(clave(alias), e);
  }

  /** Elige entre varios nombres con la misma clave usando el tipo de vía escrito. */
  function elegir(lista, texto) {
    if (lista.length === 1) return { eleccion: lista[0] };
    const tipo = tipoVia(texto);
    const mismoTipo = lista.filter((e) => tipoVia(e.nombre) === tipo);
    if (tipo && mismoTipo.length === 1) return { eleccion: mismoTipo[0] };
    // Sin tipo escrito ("Alfalfa"), se toma la calle si solo hay una, pero queda como dudosa.
    const calles = lista.filter((e) => tipoVia(e.nombre) === 'calle');
    if (!tipo && calles.length === 1) return { eleccion: calles[0], dudosa: true };
    return { eleccion: null };
  }

  /**
   * Resuelve un texto del itinerario.
   * estado: 'ok' (exacta), 'aprox' (por parecido o elección dudosa),
   *         'ambigua' (varios candidatos sin criterio), 'sin' (nada parecido).
   */
  function resolver(texto) {
    const k = clave(texto);
    if (!k) return { estado: 'sin', eleccion: null, candidatos: [] };
    const exacta = porClave.get(k);
    if (exacta) {
      const r = elegir(exacta, texto);
      if (r.eleccion) return { estado: r.dudosa ? 'aprox' : 'ok', eleccion: r.eleccion, candidatos: exacta };
      return { estado: 'ambigua', eleccion: null, candidatos: exacta };
    }
    // Parecido: tolerancia proporcional a la longitud de la clave.
    const max = k.length <= 5 ? 1 : k.length <= 12 ? 2 : 3;
    const parecidos = [];
    for (const [k2, lista] of porClave) {
      const d = levenshtein(k, k2, max);
      if (d <= max) parecidos.push({ d, lista });
      else if (k.length >= 6 && (k2.startsWith(k) || k2.endsWith(k))) parecidos.push({ d: max + 0.5, lista });
    }
    parecidos.sort((a, b) => a.d - b.d);
    const candidatos = [...new Set(parecidos.slice(0, 8).flatMap((p) => p.lista))];
    if (!candidatos.length) return { estado: 'sin', eleccion: null, candidatos: [] };
    const mejores = parecidos.filter((p) => p.d === parecidos[0].d);
    if (mejores.length === 1) {
      const r = elegir(mejores[0].lista, texto);
      if (r.eleccion) return { estado: 'aprox', eleccion: r.eleccion, candidatos };
    }
    return { estado: 'ambigua', eleccion: null, candidatos };
  }

  /**
   * Nombres cuya clave se parece a la del texto al menos `umbral` (1 − distancia de
   * edición / longitud de la clave más larga). Incluye los de clave idéntica (parecido 1).
   * Devuelve [{ entrada, parecido }] de más a menos parecido.
   */
  function similares(texto, umbral = 0.9) {
    const k = clave(texto);
    if (!k) return [];
    const out = [];
    for (const [k2, lista] of porClave) {
      const largo = Math.max(k.length, k2.length);
      const max = Math.floor((1 - umbral) * largo + 1e-9);
      if (Math.abs(k.length - k2.length) > max) continue;
      const d = k === k2 ? 0 : levenshtein(k, k2, max);
      if (d > max) continue;
      for (const entrada of lista) out.push({ entrada, parecido: 1 - d / largo });
    }
    return out.sort((a, b) => b.parecido - a.parecido);
  }

  return {
    añadir,
    resolver,
    similares,
    porNombre: (nombre) => porNombre.get(nombre) ?? null,
    get tamaño() { return porNombre.size; },
  };
}
