/**
 * Controlador de la página /recorridos/carrera-oficial/: definición de la Carrera Oficial de
 * una localidad (inicio, calles, paso por un templo con sus puntos interiores, fin y puntos de
 * paso), cálculo de su trazado y guardado. El editor de recorridos la usa después tal cual.
 */

import L from 'leaflet';
import * as cdau from './cdau.js';
import { clave } from './nombres.js';
import { componer, leerItinerario } from './componer.js';
import { confirmarContinuidad } from './continuidad.js';
import { puntoA, puntoMasCercano } from './geo.js';
import {
  SEVILLA, cargarCallejero, crearMapa, crearZona, esc, etiquetaMun, fmtM, guardarLocal, icono, leerLocal,
} from './base.js';
import {
  aEntradaProyecto, borrarCarrera, carreraCompleta, carreraVigente, guardarCarrera, normalizarCarrera,
  paraComponer, resolverCalles,
} from './carrera.js';

const CLAVE_BORRADOR = 'ssod-carrera-oficial-borrador-v1';
const FLECHA_CADA_M = 100;
const COLOR_CO = '#c8a24a';
const COLOR_INTERIOR = '#9f1853';
const COLOR_RECTA = '#fa4d56';
const ETIQUETA = { inicio: 'Inicio', entrada: 'Entrada en el templo', fin: 'Fin' };
const ITEM_CO = { n: 0, texto: 'Carrera Oficial', clave: 'carreraoficial', tipo: 'co', estado: 'ok' };
const vacia = () => normalizarCarrera({ calles: [] });
const hoy = () => new Date().toISOString().slice(0, 10);

export function iniciarCarreraOficial(datos) {
  const $ = (id) => document.getElementById(id);
  const ui = {
    municipio: $('co-municipio'), municipios: $('co-municipios'), munEstado: $('co-mun-estado'), origen: $('co-origen'),
    puntos: { inicio: $('co-inicio'), entrada: $('co-entrada'), fin: $('co-fin') },
    calles: $('co-calles'), nueva: $('co-nueva'), lineas: $('co-lineas'), nombresCalles: $('co-nombres-calles'),
    interior: $('co-interior'), btnVaciarInterior: $('co-vaciar-interior'),
    mensaje: $('co-mensaje'), resultado: $('co-resultado'), resumen: $('co-resumen'), avisos: $('co-avisos'),
    pasos: $('co-pasos'), btnQuitarPuntos: $('co-quitar-puntos'),
    btnGuardar: $('co-guardar'), cambios: $('co-cambios'), btnCopiar: $('co-copiar'), btnProyecto: $('co-proyecto'),
    json: $('co-json'), panel: document.querySelector('.ed__panel'),
  };

  // ── Estado: borrador por municipio (se conserva al recargar) ──
  const borrador = { municipio: null, defs: {}, cambios: {}, ...leerLocal(CLAVE_BORRADOR, {}) };
  const guardarBorrador = () => guardarLocal(CLAVE_BORRADOR, borrador);
  const params = new URLSearchParams(location.search);
  let municipio = borrador.municipio ?? SEVILLA;
  let def = vacia();
  let origen = null;

  let catalogo = null;
  let municipios = [];
  let grafo = null;
  let lineas = [];          // calles resueltas
  let resultado = null;
  let modo = null;          // { campo: 'inicio' | 'entrada' | 'fin' }
  let arrastrando = false;
  const zonaCalles = crearZona({ aviso: (t) => mensaje(t), alCargar: () => pintarEjes() });

  // ── Mapa ──
  const { mapa, pintarEjes } = crearMapa('co-mapa', { vias: () => zonaCalles.vias() });
  const capaLimite = L.layerGroup().addTo(mapa);
  const capaRuta = L.layerGroup().addTo(mapa);
  const capaPuntos = L.layerGroup().addTo(mapa);

  function mensaje(texto, tipo = 'info') {
    ui.mensaje.textContent = texto;
    ui.mensaje.dataset.tipo = tipo;
  }

  // ── Municipio ──
  async function cargarMunicipios() {
    try {
      municipios = await cdau.municipios();
      ui.municipios.innerHTML = municipios.map((m) => `<option value="${esc(etiquetaMun(m))}"></option>`).join('');
    } catch (e) {
      mensaje(`No se pudo cargar la lista de municipios: ${e.message}`, 'error');
    }
  }

  async function elegirMunicipio(mun) {
    municipio = { cod: mun.cod, nombre: mun.nombre };
    borrador.municipio = municipio;
    guardarBorrador();
    const m = municipios.find((x) => x.cod === mun.cod);
    ui.municipio.value = m ? etiquetaMun(m) : mun.nombre;
    history.replaceState(null, '', `?municipio=${encodeURIComponent(mun.cod)}`);
    zonaCalles.reiniciar();
    grafo = null;
    resultado = null;
    catalogo = null;
    const vig = carreraVigente(mun.cod, datos.carreras);
    origen = vig.origen;
    def = normalizarCarrera(borrador.defs[mun.cod]) ?? vig.def ?? vacia();
    def.municipio = mun.nombre;
    pintarDefinicion();
    capaRuta.clearLayers();
    capaPuntos.clearLayers();
    ui.munEstado.textContent = 'Cargando callejero…';
    try {
      const r = await cargarCallejero(mun.cod);
      catalogo = r.catalogo;
      ui.nombresCalles.innerHTML = r.nombres.map((n) => `<option value="${esc(n)}"></option>`).join('');
      ui.munEstado.textContent = `${r.vias.length.toLocaleString('es-ES', { useGrouping: 'always' })} vías en el callejero oficial`;
      capaLimite.clearLayers();
      if (r.limite) {
        const capa = L.geoJSON(r.limite, { style: { color: '#5b2a86', weight: 1.5, fill: false, dashArray: '4 4' }, interactive: false }).addTo(capaLimite);
        if (!def.inicio) mapa.fitBounds(capa.getBounds());
      }
      await recalcular({ encuadrar: true });
    } catch (e) {
      ui.munEstado.textContent = '';
      mensaje(`No se pudo cargar el callejero de ${mun.nombre}: ${e.message}`, 'error');
    }
  }

  ui.municipio.addEventListener('change', () => {
    const m = municipios.find((x) => etiquetaMun(x) === ui.municipio.value)
      ?? municipios.find((x) => x.nombre.toLowerCase() === ui.municipio.value.trim().toLowerCase());
    if (m) elegirMunicipio(m);
    else mensaje('Elige el municipio de la lista.', 'error');
  });

  // ── Cambios en la definición ──
  function cambiar(fn, { encuadrar = false } = {}) {
    fn(def);
    if (!def.entrada) def.interior = [];
    def.trazado = null;
    def.metros = null;
    borrador.defs[municipio.cod] = def;
    borrador.cambios[municipio.cod] = true;
    guardarBorrador();
    pintarDefinicion();
    recalcular({ encuadrar });
  }

  const fmtPunto = (p) => (p ? `${p[1].toFixed(6)}, ${p[0].toFixed(6)}` : null);
  function pintarDefinicion() {
    if (document.activeElement !== ui.calles) ui.calles.value = def.calles.join('\n');
    ui.puntos.inicio.textContent = fmtPunto(def.inicio) ?? 'Sin fijar';
    ui.puntos.entrada.textContent = fmtPunto(def.entrada) ?? 'No pasa por un templo';
    ui.puntos.fin.textContent = fmtPunto(def.fin) ?? 'Sin fijar';
    const n = def.interior?.length ?? 0;
    ui.interior.textContent = !def.entrada ? 'Fija primero la entrada.'
      : n ? `${n} ${n === 1 ? 'punto' : 'puntos'} por el interior.` : 'De la entrada al fin en línea recta.';
    ui.btnVaciarInterior.hidden = !n;
    const cambios = !!borrador.cambios[municipio.cod];
    ui.cambios.hidden = !cambios;
    ui.btnProyecto.hidden = !(cambios || origen === 'navegador');
    ui.btnProyecto.textContent = datos.carreras[municipio.cod] ? 'Volver a la del proyecto' : 'Descartar';
    ui.origen.textContent = cambios ? 'Cambios sin guardar.'
      : origen === 'navegador' ? `Guardada en este navegador${def.actualizado ? ` el ${def.actualizado}` : ''}.`
      : origen === 'proyecto' ? `Definida en el proyecto${def.trazado ? '' : ' (sin trazado revisado)'}.`
      : 'Sin definir.';
  }

  ui.calles.addEventListener('change', () => cambiar((d) => { d.calles = leerItinerario(ui.calles.value).map((l) => l.texto); }));
  ui.nueva.addEventListener('change', () => {
    const v = ui.nueva.value.trim();
    if (!v) return;
    ui.nueva.value = '';
    cambiar((d) => { d.calles = [...d.calles, v]; });
  });
  ui.nueva.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ui.nueva.blur(); } });
  ui.panel.addEventListener('click', (e) => {
    const fijar = e.target.closest('[data-fijar]')?.dataset.fijar;
    const quitar = e.target.closest('[data-quitar]')?.dataset.quitar;
    if (fijar) {
      modo = { campo: fijar };
      mapa.getContainer().classList.add('ed-apuntando');
      mensaje(`Pincha en el mapa: ${ETIQUETA[fijar].toLowerCase()} de la Carrera Oficial.`);
    } else if (quitar) {
      cambiar((d) => { d[quitar] = null; });
    }
  });
  ui.btnVaciarInterior.addEventListener('click', () => cambiar((d) => { d.interior = []; }));
  ui.btnQuitarPuntos.addEventListener('click', () => cambiar((d) => { d.puntosPaso = {}; }));

  // Elección de la vía de cada calle.
  ui.lineas.addEventListener('change', (e) => {
    const el = e.target.closest('input[data-i]');
    if (!el) return;
    const it = lineas[Number(el.dataset.i)];
    const v = el.value.trim();
    if (v && !catalogo?.porNombre(v)) { mensaje(`«${v}» no está en el callejero de ${municipio.nombre}. Elígela de la lista.`, 'error'); return; }
    cambiar((d) => {
      d.elecciones = { ...d.elecciones };
      if (v) d.elecciones[it.clave] = { tipo: 'via', nombre: v };
      else delete d.elecciones[it.clave];
    });
  });

  mapa.on('click', (e) => aplicarModo(e));
  function aplicarModo(e) {
    if (!modo) return false;
    const { campo } = modo;
    modo = null;
    mapa.getContainer().classList.remove('ed-apuntando');
    cambiar((d) => { d[campo] = [e.latlng.lng, e.latlng.lat]; });
    mensaje(`${ETIQUETA[campo]} fijado.`);
    return true;
  }

  // ── Cálculo ──
  let turno = 0;
  async function recalcular({ encuadrar = false } = {}) {
    const t = ++turno;
    pintarLineas();
    if (!catalogo) return;
    if (!carreraCompleta(def)) {
      resultado = null;
      dibujar();
      ui.resultado.hidden = true;
      mensaje('Fija el inicio y el fin de la Carrera Oficial y escribe sus calles.');
      return;
    }
    try {
      lineas = await confirmarContinuidad(resolverCalles(def, catalogo), { catalogo, geometria: zonaCalles.geometria, inicio: def.inicio });
      if (t !== turno) return;
      pintarLineas();
      const puntos = [def.inicio, def.fin, ...(def.entrada ? [def.entrada] : []), ...(def.interior ?? []), ...Object.values(def.puntosPaso).flat()];
      grafo = await zonaCalles.asegurar(lineas.flatMap((it) => (it.tipo === 'via' ? it.ids : [])), puntos, def.inicio);
      if (t !== turno) return;
      recomponer();
      if (encuadrar && resultado?.coords.length > 1) mapa.fitBounds(L.latLngBounds(resultado.coords.map(([x, y]) => [y, x])), { padding: [40, 40] });
      const pendientes = lineas.filter((it) => it.tipo !== 'via').length;
      mensaje(pendientes
        ? `${pendientes} ${pendientes === 1 ? 'calle no se reconoce' : 'calles no se reconocen'}: revísalas arriba.`
        : 'Revisa la línea: pincha en ella para añadir puntos de paso (o puntos por el interior del templo) y arrástralos.');
    } catch (e) {
      mensaje(`No se pudo calcular: ${e.message}`, 'error');
    }
  }

  function recomponer() {
    if (arrastrando || !grafo || !carreraCompleta(def)) return;
    const carrera = paraComponer({ ...def, trazado: null }, lineas);
    resultado = componer({ items: [ITEM_CO], salida: def.inicio, grafo, puntosPaso: def.puntosPaso, carrera });
    def.trazado = resultado.coords.length > 1 ? resultado.coords : null;
    def.metros = Math.round(resultado.metros);
    dibujar();
    pintarResultado();
  }

  // ── Dibujo ──
  /** Destino de un paso ('co:interior:2', 'co:fin', …) a partir de su clave. */
  const destino = (p) => p.clave.split('>').pop().replace(/#\d+$/, '');
  const esInterior = (p) => destino(p).startsWith('co:interior:') || (!!def.entrada && destino(p) === 'co:fin');

  function dibujar() {
    capaRuta.clearLayers();
    capaPuntos.clearLayers();
    for (const campo of ['inicio', 'entrada', 'fin']) {
      const pt = def[campo];
      if (!pt) continue;
      const mk = L.marker([pt[1], pt[0]], {
        icon: icono('ed-co ed-co--' + campo, campo === 'inicio' ? 'I' : campo === 'fin' ? 'F' : 'E', 18), draggable: true, zIndexOffset: 800,
      }).bindTooltip(`${ETIQUETA[campo]} · arrastra para moverlo`).addTo(capaPuntos);
      arrastrable(mk, (ll) => cambiar((d) => { d[campo] = ll; }));
    }
    if (!resultado) return;
    resultado.pasos.forEach((p) => {
      if (p.coords.length < 2 || p.metros < 0.5) return;
      const interior = esInterior(p);
      const color = p.tipo === 'recta' ? COLOR_RECTA : interior ? COLOR_INTERIOR : COLOR_CO;
      const linea = L.polyline(p.coords.map(([x, y]) => [y, x]), { color, weight: 6, opacity: 0.9, dashArray: interior || p.tipo === 'recta' ? '8 6' : null })
        .bindTooltip(`${esc(p.etiqueta ?? '')} · ${fmtM(p.metros)}`, { sticky: true })
        .addTo(capaRuta);
      linea.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (aplicarModo(e)) return;
        const c = [e.latlng.lng, e.latlng.lat];
        if (interior) {
          // Punto por el interior del templo, en su sitio de la secuencia.
          const d = destino(p);
          const k = d === 'co:fin' ? def.interior.length : Number(d.split(':')[2]);
          cambiar((x) => { x.interior = [...x.interior.slice(0, k), c, ...x.interior.slice(k)]; });
        } else {
          cambiar((x) => {
            const lista = [...(x.puntosPaso[p.clave] ?? []), c];
            const pos = (q) => puntoMasCercano(p.coords, q).metros;
            lista.sort((a, b) => pos(a) - pos(b));
            x.puntosPaso = { ...x.puntosPaso, [p.clave]: lista };
          });
        }
      });
      if (p.tipo === 'recta' && !interior) {
        const m = puntoA(p.coords, p.metros / 2).coord;
        L.marker([m[1], m[0]], { icon: icono('ed-aviso', '!', 18) }).bindTooltip('Sin conexión por calles').addTo(capaRuta);
      }
    });
    for (let m = FLECHA_CADA_M / 2; m < resultado.metros; m += FLECHA_CADA_M) {
      const { coord, rumbo } = puntoA(resultado.coords, m);
      L.marker([coord[1], coord[0]], {
        icon: icono('ed-flecha', `<span style="transform:rotate(${(rumbo - 90).toFixed(0)}deg)">➤</span>`), interactive: false, keyboard: false,
      }).addTo(capaRuta);
    }
    // Puntos interiores y puntos de paso: arrastrables; doble clic o clic derecho los quita.
    (def.interior ?? []).forEach((pt, i) => {
      const mk = L.marker([pt[1], pt[0]], { icon: icono('ed-punto ed-punto--interior'), draggable: true, zIndexOffset: 600 })
        .bindTooltip('Interior del templo · arrastra · doble clic para quitar').addTo(capaPuntos);
      arrastrable(mk, (ll) => cambiar((d) => { d.interior = d.interior.map((q, j) => (j === i ? ll : q)); }));
      mk.on('dblclick contextmenu', (e) => { L.DomEvent.stop(e); cambiar((d) => { d.interior = d.interior.filter((_, j) => j !== i); }); });
    });
    const claves = new Set(resultado.pasos.map((p) => p.clave));
    for (const [k, lista] of Object.entries(def.puntosPaso)) {
      if (!claves.has(k)) continue;
      lista.forEach((pt, i) => {
        const mk = L.marker([pt[1], pt[0]], { icon: icono('ed-punto'), draggable: true, zIndexOffset: 500 })
          .bindTooltip('Arrastra para corregir · doble clic para quitar').addTo(capaPuntos);
        arrastrable(mk, (ll) => cambiar((d) => { d.puntosPaso = { ...d.puntosPaso, [k]: d.puntosPaso[k].map((q, j) => (j === i ? ll : q)) }; }));
        mk.on('dblclick contextmenu', (e) => {
          L.DomEvent.stop(e);
          cambiar((d) => {
            const resto = d.puntosPaso[k].filter((_, j) => j !== i);
            d.puntosPaso = { ...d.puntosPaso };
            if (resto.length) d.puntosPaso[k] = resto; else delete d.puntosPaso[k];
          });
        });
      });
    }
  }

  /** Marcador arrastrable: no se redibuja a medio arrastre. */
  function arrastrable(mk, alSoltar) {
    mk.on('dragstart', () => { arrastrando = true; });
    mk.on('dragend', () => {
      arrastrando = false;
      const ll = mk.getLatLng();
      alSoltar([ll.lng, ll.lat]);
    });
  }

  // ── Panel ──
  const ETIQUETA_ESTADO = { aprox: ['Parecida', 'aviso'], manual: ['Elegida', 'ok'], ambigua: ['Varias posibles', 'error'], sin: ['No encontrada', 'error'], lejos: ['Lejos de la anterior', 'error'] };
  function pintarLineas() {
    const res = lineas.length === def.calles.length ? lineas : def.calles.map((texto) => ({ texto, clave: clave(texto), tipo: 'sin', estado: '' }));
    ui.lineas.innerHTML = res.map((it, i) => {
      const [txt, cls] = ETIQUETA_ESTADO[it.estado] ?? [];
      return `<li class="co-linea"><span class="co-linea__txt">${esc(it.texto)}</span>`
        + `<input class="ed-item__via" list="co-nombres-calles" data-i="${i}" value="${esc(it.tipo === 'via' ? it.nombre : '')}" placeholder="Elige la vía…" aria-label="Vía para ${esc(it.texto)}">`
        + (txt ? `<span class="ed-chip ed-chip--${cls}">${txt}</span>` : '')
        + (it.tipo === 'ambigua' && it.candidatos?.length ? `<small class="ed-item__cand">¿${it.candidatos.slice(0, 4).map(esc).join('? ¿')}?</small>` : '')
        + '</li>';
    }).join('');
  }

  function pintarResultado() {
    ui.resultado.hidden = false;
    ui.resumen.innerHTML = `<strong>${fmtM(resultado.metros)}</strong> de Carrera Oficial`;
    ui.avisos.innerHTML = resultado.avisos.map((a) => `<li>${esc(a)}</li>`).join('');
    const nombre = (p) => (p.etiqueta ?? '').replace(/^Carrera Oficial: (.)/, (_, c) => c.toUpperCase());
    // Cada tramo, de dónde a dónde (la etiqueta de un paso es la de su destino).
    const desde = new Map(resultado.pasos.map((p, k) => [p, k ? nombre(resultado.pasos[k - 1]) : 'Inicio']));
    ui.pasos.innerHTML = resultado.pasos.filter((p) => p.metros >= 0.5).map((p) => {
      const enlaces = p.enlaces.length ? `<small class="ed-item__enlace">Pasa por ${p.enlaces.map((e) => `${esc(e.nombre)} (${fmtM(e.metros)})`).join(', ')}, que no está en la lista</small>` : '';
      return `<li class="co-paso${esInterior(p) ? ' co-paso--interior' : ''}"><span>${esc(desde.get(p))} → ${esc(nombre(p))}</span><span class="ed-item__m">${fmtM(p.metros)}</span>${enlaces}</li>`;
    }).join('');
    ui.btnQuitarPuntos.hidden = !Object.keys(def.puntosPaso).length;
  }

  // ── Guardar ──
  ui.btnGuardar.addEventListener('click', () => {
    if (!carreraCompleta(def) || !def.trazado) { mensaje('Falta fijar el inicio y el fin, o no se ha podido calcular la línea.', 'error'); return; }
    const sinResolver = lineas.filter((it) => it.tipo !== 'via').map((it) => it.texto);
    if (sinResolver.length && !window.confirm(`No se reconocen: ${sinResolver.join(', ')}. ¿Guardar igualmente?`)) return;
    def.actualizado = hoy();
    def.municipio = municipio.nombre;
    guardarCarrera(municipio.cod, def);
    origen = 'navegador';
    delete borrador.defs[municipio.cod];
    delete borrador.cambios[municipio.cod];
    guardarBorrador();
    pintarDefinicion();
    mensaje(`Carrera Oficial de ${municipio.nombre} guardada: el editor de recorridos la usará tal cual. Para publicarla en el proyecto, «Copiar para el proyecto».`);
  });

  ui.btnCopiar.addEventListener('click', async () => {
    if (!carreraCompleta(def) || !def.trazado) { mensaje('Primero tiene que haber una línea calculada.', 'error'); return; }
    const texto = aEntradaProyecto(municipio.cod, { ...def, municipio: municipio.nombre, actualizado: def.actualizado ?? hoy() });
    ui.json.hidden = false;
    ui.json.value = texto;
    try {
      await navigator.clipboard.writeText(texto);
      mensaje('Copiada: pégala en src/data/carreras-oficiales.json (sustituye la entrada del municipio si ya existe).');
    } catch {
      ui.json.select();
      mensaje('Selecciona y copia el texto de abajo para src/data/carreras-oficiales.json.');
    }
  });

  ui.btnProyecto.addEventListener('click', () => {
    if (!window.confirm(datos.carreras[municipio.cod]
      ? `Se descartan los cambios y la versión guardada en este navegador; se usará la del proyecto para ${municipio.nombre}. ¿Continuar?`
      : `Se descarta la Carrera Oficial de ${municipio.nombre} guardada en este navegador. ¿Continuar?`)) return;
    borrarCarrera(municipio.cod);
    delete borrador.defs[municipio.cod];
    delete borrador.cambios[municipio.cod];
    guardarBorrador();
    elegirMunicipio(municipio);
  });

  // ── Arranque ──
  cargarMunicipios().then(() => {
    const cod = params.get('municipio');
    const desdeUrl = cod && municipios.find((m) => m.cod === cod);
    elegirMunicipio(desdeUrl ?? municipio);
  });
}
