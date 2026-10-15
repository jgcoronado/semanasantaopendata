/**
 * Controlador de la página /recorridos/editor/ (Leaflet + núcleo de recorridos).
 *
 * Flujo: municipio → salida (templo, hermandad, dirección o mapa) → itinerario → «Trazar».
 * Correcciones: elegir otra vía en la tabla, fijar una línea en el mapa, omitirla, o
 * pinchar sobre la línea para añadir puntos de paso y arrastrarlos.
 */

import L from 'leaflet';
import * as cdau from './cdau.js';
import { clave, esCarreraOficial } from './nombres.js';
import { leerItinerario, resolverItinerario, componer } from './componer.js';
import { confirmarContinuidad } from './continuidad.js';
import { puntoA, puntoMasCercano } from './geo.js';
import { aGeoJSON, deGeoJSON, descargar } from './exportar.js';
import { ATRIBUCION_LUGARES, buscarLugares, buscarPhoton, templosMunicipio } from './lugares.js';
import {
  SEVILLA, cargarCallejero, crearMapa, crearZona, esc, etiquetaMun, fmtKm, fmtM, guardarLocal, icono, leerLocal,
} from './base.js';
import {
  CLAVE_CARRERAS, carreraCompleta, carreraVigente, carrerasGuardadas, guardarCarrera, normalizarCarrera,
  paraComponer, resolverCalles,
} from './carrera.js';

const CLAVE_LOCAL = 'ssod-editor-recorridos-v1';
const FLECHA_CADA_M = 150;
const COLOR_DEFECTO = '#5b2a86';
const COLORES = { co: '#c8a24a', manual: '#198038', recta: '#fa4d56' };

export function iniciarEditor(datos) {
  const $ = (id) => document.getElementById(id);
  const ui = {
    municipio: $('ed-municipio'), municipios: $('ed-municipios'), munEstado: $('ed-mun-estado'),
    btnSalida: $('ed-btn-salida'), salidaTxt: $('ed-salida-txt'),
    lugar: $('ed-lugar'), lugarLista: $('ed-lugar-lista'), lugarEstado: $('ed-lugar-estado'),
    salidaCalle: $('ed-salida-calle'), salidaNum: $('ed-salida-num'), portales: $('ed-portales'),
    texto: $('ed-texto'), btnTrazar: $('ed-btn-trazar'), mensaje: $('ed-mensaje'),
    resultado: $('ed-resultado'), resumen: $('ed-resumen'), avisos: $('ed-avisos'), lista: $('ed-items'),
    calles: $('ed-calles'), hermandad: $('ed-hermandad'), bloqueHdad: $('ed-bloque-hdad'),
    btn2025: $('ed-btn-2025'), nombre: $('ed-nombre'), btnExportar: $('ed-btn-exportar'),
    importar: $('ed-importar'), btnBorrarPuntos: $('ed-btn-borrar-puntos'), btnRef: $('ed-btn-ref'),
    coResumen: $('ed-co-resumen'), coDetalle: $('ed-co-detalle'), coEnlace: $('ed-co-enlace'),
  };

  // ── Estado (persistido en el navegador) ──
  const estado = {
    municipio: SEVILLA, salida: null, texto: '', elecciones: {}, puntosPaso: {}, hermandad: null,
    ...leerLocal(CLAVE_LOCAL, {}),
  };
  // Versiones anteriores guardaban aquí la Carrera Oficial editada; pasa a su ventana.
  if (estado.carreras) {
    const guardadas = carrerasGuardadas();
    for (const [cod, c] of Object.entries(estado.carreras)) {
      if (c && !guardadas[cod]) guardarCarrera(cod, { ...normalizarCarrera(c), actualizado: null });
    }
    delete estado.carreras;
  }
  const guardar = () => guardarLocal(CLAVE_LOCAL, estado);

  let catalogo = null;
  let limiteMun = null;           // límite del término municipal (Feature DERA)
  let templos = null;             // [{ nombre, alias, coord, tipo, detalle }] o null si no hay
  let municipios = [];
  const zonaCalles = crearZona({ aviso: (t) => mensaje(t), alCargar: () => pintarEjes() });
  let grafo = null;
  let items = [];
  let resultado = null;
  let modo = null;                  // { tipo: 'salida' } | { tipo: 'punto', clave, texto }

  // Desde que se pulsa un marcador hasta que se suelta no se redibuja (el marcador se
  // sustituiría a medio arrastre, p. ej. si al pulsar pierde el foco un campo y su 'change'
  // vuelve a trazar). Al soltar: si hubo arrastre, su manejador vuelve a trazar; si no, se
  // aplica el redibujo pendiente.
  let arrastrando = false;
  let redibujoPendiente = false;
  const marcarArrastre = (mk) => mk
    .on('mousedown touchstart dragstart', () => { arrastrando = true; })
    .on('dragend', () => { arrastrando = false; redibujoPendiente = false; });
  const soltar = () => setTimeout(() => {
    if (!arrastrando) return;
    arrastrando = false;
    if (redibujoPendiente) { redibujoPendiente = false; recomponer(); }
  }, 0);
  document.addEventListener('mouseup', soltar);
  document.addEventListener('touchend', soltar);

  // ── Mapa ──
  const { mapa, pintarEjes } = crearMapa('ed-mapa', { vias: () => zonaCalles.vias(), atribuciones: [ATRIBUCION_LUGARES] });

  const capaLimite = L.layerGroup().addTo(mapa);
  const capaReferencia = L.layerGroup().addTo(mapa);
  const capaRuta = L.layerGroup().addTo(mapa);
  const capaPuntos = L.layerGroup().addTo(mapa);
  let marcadorSalida = null;
  const lineasPaso = new Map();     // índice de paso → polyline

  function mensaje(texto, tipo = 'info') {
    ui.mensaje.textContent = texto;
    ui.mensaje.dataset.tipo = tipo;
  }

  function colorRuta() {
    const h = datos.hermandades.find((x) => x.id_hdad === estado.hermandad);
    return h?.color ?? COLOR_DEFECTO;
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

  async function elegirMunicipio(mun, { encuadrar = true } = {}) {
    const cambia = estado.municipio?.cod !== mun.cod;
    estado.municipio = { cod: mun.cod, nombre: mun.nombre };
    const m = municipios.find((x) => x.cod === mun.cod);
    ui.municipio.value = m ? etiquetaMun(m) : mun.nombre;
    ui.bloqueHdad.hidden = mun.cod !== SEVILLA.cod;
    if (cambia) {
      catalogo = null;
      zonaCalles.reiniciar();
      estado.elecciones = {};
      ui.salidaCalle.value = '';
      ui.salidaNum.value = '';
      ui.salidaNum.disabled = true;
      ui.portales.innerHTML = '';
      ui.lugar.value = '';
    }
    guardar();
    limiteMun = null;
    templos = null;
    ui.munEstado.textContent = 'Cargando callejero…';
    try {
      const { limite, vias, catalogo: cat, nombres } = await cargarCallejero(mun.cod);
      capaLimite.clearLayers();
      if (limite) {
        const capa = L.geoJSON(limite, { style: { color: '#5b2a86', weight: 1.5, fill: false, dashArray: '4 4' }, interactive: false }).addTo(capaLimite);
        if (encuadrar) mapa.fitBounds(capa.getBounds());
      }
      limiteMun = limite;
      if (limite) cargarTemplos(mun);
      catalogo = cat;
      ui.calles.innerHTML = nombres.map((n) => `<option value="${esc(n)}"></option>`).join('');
      ui.munEstado.textContent = `${vias.length.toLocaleString('es-ES', { useGrouping: 'always' })} vías en el callejero oficial`;
      cargarCarrera();
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

  // ── Salida ──
  function pintarSalida() {
    if (marcadorSalida) { marcadorSalida.remove(); marcadorSalida = null; }
    if (!estado.salida) { ui.salidaTxt.textContent = 'Sin fijar'; return; }
    const [lon, lat] = estado.salida;
    marcadorSalida = L.marker([lat, lon], { icon: icono('ed-salida', '', 18), draggable: true, zIndexOffset: 1000 })
      .bindTooltip('Salida y entrada del templo').addTo(mapa);
    marcarArrastre(marcadorSalida);
    marcadorSalida.on('dragend', () => {
      const p = marcadorSalida.getLatLng();
      fijarSalida([p.lng, p.lat]);
    });
    ui.salidaTxt.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }

  async function fijarSalida(coord) {
    estado.salida = coord;
    guardar();
    pintarSalida();
    try {
      const mun = await cdau.municipioEnPunto(coord);
      if (!mun) mensaje('No hay calles del callejero cerca de ese punto. ¿Está en Andalucía?', 'error');
      else if (mun.cod !== estado.municipio?.cod) {
        mensaje(`La salida está en ${mun.nombre}: se cambia el municipio.`);
        await elegirMunicipio(mun, { encuadrar: false });
      }
    } catch (e) {
      mensaje(`No se pudo comprobar el municipio: ${e.message}`, 'error');
    }
    if (estado.texto.trim()) trazar();
  }

  // ── Búsqueda de la salida por nombre: templos del municipio (OSM) y hermandades (Sevilla) ──
  let opciones = [];             // resultados mostrados
  let activa = -1;

  async function cargarTemplos(mun) {
    ui.lugarEstado.textContent = 'Cargando templos del municipio…';
    try {
      const lista = await templosMunicipio(mun.cod, limiteMun);
      if (estado.municipio.cod !== mun.cod) return;
      templos = lista;
      ui.lugarEstado.textContent = `${lista.length.toLocaleString('es-ES')} templos de ${mun.nombre} en OpenStreetMap`;
    } catch {
      if (estado.municipio.cod !== mun.cod) return;
      templos = null;
      ui.lugarEstado.textContent = 'No se pudo cargar la lista de templos: la búsqueda se hará en OpenStreetMap al pulsar Enter.';
    }
  }

  /** Hermandades de Sevilla con su salida de 2025, como lugares buscables. */
  function lugaresHermandad() {
    if (estado.municipio?.cod !== SEVILLA.cod) return [];
    return datos.hermandades.filter((h) => h.salida2025).map((h) => ({
      nombre: `Hermandad de ${h.nombre}`, alias: [h.nombre], coord: h.salida2025, tipo: 'hermandad', detalle: 'Salida de su recorrido de 2025',
    }));
  }

  const ETIQUETA_TIPO = { templo: 'Templo', hermandad: 'Hermandad', osm: 'OpenStreetMap' };
  function pintarOpciones(texto, { buscando = false } = {}) {
    const items = opciones.map((o, i) => `<li id="ed-lugar-op-${i}" class="ed-buscador__op" role="option" data-i="${i}" aria-selected="${i === activa}">
        <strong>${esc(o.nombre)}</strong><small>${ETIQUETA_TIPO[o.tipo]}${o.detalle ? ' · ' + esc(o.detalle) : ''}</small></li>`);
    if (texto.trim().length >= 3) {
      items.push(`<li id="ed-lugar-op-${opciones.length}" class="ed-buscador__op ed-buscador__op--accion" role="option" data-i="${opciones.length}" aria-selected="${activa === opciones.length}">
        <strong>${buscando ? 'Buscando en OpenStreetMap…' : `Buscar «${esc(texto.trim())}» en OpenStreetMap`}</strong><small>Tarda unos segundos</small></li>`);
    }
    if (!items.length) { cerrarOpciones(); return; }
    ui.lugarLista.innerHTML = items.join('');
    ui.lugarLista.hidden = false;
    ui.lugar.setAttribute('aria-expanded', 'true');
    ui.lugar.setAttribute('aria-activedescendant', activa >= 0 ? `ed-lugar-op-${activa}` : '');
    ui.lugarLista.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  function cerrarOpciones() {
    ui.lugarLista.hidden = true;
    ui.lugar.setAttribute('aria-expanded', 'false');
    ui.lugar.removeAttribute('aria-activedescendant');
  }
  function sugerir() {
    const texto = ui.lugar.value;
    activa = -1;
    opciones = texto.trim().length >= 2 ? buscarLugares([...(templos ?? []), ...lugaresHermandad()], texto, 8) : [];
    pintarOpciones(texto);
  }
  let busquedaOsm = 0;
  async function buscarEnOsm() {
    const texto = ui.lugar.value.trim();
    if (texto.length < 3 || !limiteMun) return;
    const turno = ++busquedaOsm;
    pintarOpciones(texto, { buscando: true });
    try {
      const r = await buscarPhoton(texto, limiteMun, estado.salida ?? null);
      if (turno !== busquedaOsm) return;
      // Se mantienen arriba los resultados locales y se añaden los de OSM que no estén ya.
      const vistos = new Set(opciones.map((o) => o.nombre + '|' + o.coord.map((v) => v.toFixed(4))));
      opciones = [...opciones, ...r.filter((o) => !vistos.has(o.nombre + '|' + o.coord.map((v) => v.toFixed(4))))].slice(0, 12);
      activa = opciones.length ? 0 : -1;
      if (!opciones.length) {
        ui.lugarLista.innerHTML = `<li class="ed-buscador__vacio">Nada en ${esc(estado.municipio.nombre)} con «${esc(texto)}». Prueba con la calle y el número, o pincha en el mapa.</li>`;
        ui.lugarLista.hidden = false;
        return;
      }
      pintarOpciones(texto);
    } catch (e) {
      if (turno !== busquedaOsm) return;
      mensaje(`La búsqueda en OpenStreetMap falló: ${e.message}`, 'error');
      pintarOpciones(texto);
    }
  }
  function elegirLugar(i) {
    if (i === opciones.length) { buscarEnOsm(); return; }
    const o = opciones[i];
    if (!o) return;
    ui.lugar.value = o.nombre;
    cerrarOpciones();
    mapa.setView([o.coord[1], o.coord[0]], Math.max(mapa.getZoom(), 18));
    mensaje(`Salida en ${o.nombre}. Arrastra el marcador a la puerta por la que sale la cofradía.`);
    fijarSalida(o.coord);
  }

  ui.lugar.addEventListener('input', sugerir);
  ui.lugar.addEventListener('focus', () => { if (ui.lugar.value.trim().length >= 2) sugerir(); });
  ui.lugar.addEventListener('keydown', (e) => {
    const total = opciones.length + (ui.lugar.value.trim().length >= 3 ? 1 : 0);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (ui.lugarLista.hidden) sugerir();
      if (!total) return;
      activa = e.key === 'ArrowDown' ? (activa + 1) % total : (activa <= 0 ? total - 1 : activa - 1);
      pintarOpciones(ui.lugar.value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Enter sin opción marcada: la primera local, o buscar en OSM si no hay ninguna.
      elegirLugar(activa >= 0 ? activa : (opciones.length ? 0 : opciones.length));
    } else if (e.key === 'Escape') {
      cerrarOpciones();
    }
  });
  // mousedown (no click) para elegir antes de que el blur cierre la lista.
  ui.lugarLista.addEventListener('mousedown', (e) => {
    const li = e.target.closest('.ed-buscador__op');
    if (!li) return;
    e.preventDefault();
    elegirLugar(Number(li.dataset.i));
  });
  ui.lugar.addEventListener('blur', () => setTimeout(cerrarOpciones, 150));

  // Búsqueda de la salida por dirección: calle (predictivo con el callejero del municipio) y
  // número (predictivo con los portales de esa calle en el CDAU).
  let portalesCalle = [];
  const capaBusqueda = L.layerGroup().addTo(mapa);

  ui.salidaCalle.addEventListener('change', async () => {
    const v = ui.salidaCalle.value.trim();
    portalesCalle = [];
    ui.portales.innerHTML = '';
    ui.salidaNum.value = '';
    ui.salidaNum.disabled = true;
    capaBusqueda.clearLayers();
    if (!v) return;
    if (!catalogo) { mensaje('Espera a que cargue el callejero del municipio.', 'error'); return; }
    const r = catalogo.porNombre(v) ? { eleccion: catalogo.porNombre(v) } : catalogo.resolver(v);
    if (!r.eleccion) { mensaje(`«${v}» no está en el callejero de ${estado.municipio.nombre}. Elígela de la lista.`, 'error'); return; }
    ui.salidaCalle.value = r.eleccion.nombre;
    const ids = [...r.eleccion.ids];
    try {
      const [vias, portales] = await Promise.all([cdau.viasPorId(ids), cdau.portalesDeVias(ids)]);
      for (const via of vias) {
        if (!via.lineas.some((l) => l.length > 1)) continue;
        L.polyline(via.lineas.filter((l) => l.length > 1).map((l) => l.map(([x, y]) => [y, x])), { color: '#c8a24a', weight: 9, opacity: 0.45, interactive: false }).addTo(capaBusqueda);
      }
      if (capaBusqueda.getLayers().length) mapa.fitBounds(L.featureGroup(capaBusqueda.getLayers()).getBounds(), { padding: [40, 40], maxZoom: 18 });
      portalesCalle = portales;
      // Un número puede tener varios portales (accesorios): se ofrece cada etiqueta una vez.
      const vistas = new Set();
      ui.portales.innerHTML = portales
        .filter((p) => !vistas.has(p.etiqueta) && vistas.add(p.etiqueta))
        .map((p) => `<option value="${esc(p.etiqueta)}"></option>`).join('');
      ui.salidaNum.disabled = !portales.length;
      if (portales.length) {
        ui.salidaNum.focus();
        mensaje(`Elige el número del templo en ${r.eleccion.nombre} (${portales.length} portales), o pincha su puerta en el mapa.`);
      } else {
        modo = { tipo: 'salida' };
        mapa.getContainer().classList.add('ed-apuntando');
        mensaje(`${r.eleccion.nombre} no tiene números en el callejero: pincha la puerta del templo en el mapa (calle resaltada).`);
      }
    } catch (e) {
      mensaje(`No se pudo buscar la calle: ${e.message}`, 'error');
    }
  });

  ui.salidaNum.addEventListener('change', () => {
    const v = ui.salidaNum.value.trim().toUpperCase();
    if (!v) return;
    const p = portalesCalle.find((x) => x.etiqueta.toUpperCase() === v)
      ?? portalesCalle.find((x) => String(x.numero) === v.replace(/\D+$/, ''));
    if (!p) { mensaje(`No hay portal ${v} en ${ui.salidaCalle.value}.`, 'error'); return; }
    capaBusqueda.clearLayers();
    mapa.setView([p.coord[1], p.coord[0]], Math.max(mapa.getZoom(), 18));
    mensaje(`Salida fijada en ${ui.salidaCalle.value}, ${p.etiqueta}. Arrastra el marcador a la puerta si no coincide.`);
    fijarSalida(p.coord);
  });
  // Enter confirma: el blur dispara el 'change' nativo una sola vez (despacharlo a mano
  // haría que el navegador lo repitiera al perder el foco).
  ui.salidaNum.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ui.salidaNum.blur(); } });
  ui.salidaCalle.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ui.salidaCalle.blur(); } });

  ui.btnSalida.addEventListener('click', () => {
    modo = { tipo: 'salida' };
    mapa.getContainer().classList.add('ed-apuntando');
    mensaje('Pincha en el mapa la puerta del templo.');
  });

  // Con un modo activo («Fijar en el mapa», 📍) el siguiente clic es para él, también si cae
  // encima de la línea del recorrido o de un punto: si no, se añadía un punto de paso y el
  // modo seguía activo para el clic siguiente.
  mapa.on('click', (e) => aplicarModo(e));
  function aplicarModo(e) {
    if (!modo) return false;
    const coord = [e.latlng.lng, e.latlng.lat];
    const m = modo;
    modo = null;
    mapa.getContainer().classList.remove('ed-apuntando');
    if (m.tipo === 'salida') fijarSalida(coord);
    else if (m.tipo === 'punto') {
      estado.elecciones[m.clave] = { tipo: 'punto', coord };
      guardar();
      mensaje(`«${m.texto}» fijada en el mapa.`);
      trazar();
    }
    return true;
  }

  // ── Zona de calles y grafo ──
  async function asegurarGrafo(itemsResueltos, extra = []) {
    const ids = itemsResueltos.flatMap((it) => it.ids ?? []);
    const puntos = [estado.salida, ...extra];
    for (const it of itemsResueltos) if (it.tipo === 'punto') puntos.push(it.coord);
    for (const lista of Object.values(estado.puntosPaso)) puntos.push(...lista);
    grafo = await zonaCalles.asegurar(ids, puntos, estado.salida);
  }

  // ── Carrera Oficial ──
  // Se define en su ventana (/recorridos/carrera-oficial/) y aquí se usa tal cual: no se
  // puede modificar desde el editor de recorridos.
  const ETIQUETA_CO = { inicio: 'Inicio', entrada: 'Entrada en el templo', fin: 'Fin' };
  let co = { def: null, origen: null };   // vigente para el municipio (carrera.js)
  let coResuelta = null;                  // paraComponer(…) o null (tramo libre)
  let coLineas = [];                      // calles resueltas (sin trazado guardado)
  const carreraEnUso = () => !!coResuelta && items.some((it) => it.tipo === 'co');

  function cargarCarrera() {
    co = carreraVigente(estado.municipio?.cod, datos.carreras);
    coResuelta = null;
    coLineas = [];
    if (carreraCompleta(co.def)) {
      coLineas = co.def.trazado || !catalogo ? [] : resolverCalles(co.def, catalogo);
      coResuelta = paraComponer(co.def, coLineas);
    }
    pintarCarrera();
  }

  function pintarCarrera() {
    const cod = estado.municipio?.cod;
    ui.coEnlace.href = `${ui.coEnlace.pathname}?municipio=${encodeURIComponent(cod ?? '')}`;
    const d = co.def;
    if (!carreraCompleta(d)) {
      ui.coResumen.textContent = 'sin definir';
      ui.coDetalle.textContent = `${estado.municipio?.nombre ?? 'Este municipio'} no tiene Carrera Oficial definida: «Carrera Oficial» se traza como un tramo libre entre la calle anterior y la siguiente.`;
      ui.coEnlace.textContent = 'Definirla';
      return;
    }
    const n = d.calles.length;
    const metros = d.metros;
    ui.coResumen.textContent = `${n} ${n === 1 ? 'calle' : 'calles'}${d.entrada ? ' · paso por templo' : ''}${metros ? ` · ${fmtM(metros)}` : ''}`;
    ui.coDetalle.textContent = `${d.calles.join(' · ')}. `
      + (co.origen === 'navegador' ? 'Guardada en este navegador' : 'Definida en el proyecto')
      + (d.actualizado ? ` (${d.actualizado})` : '')
      + (d.trazado ? '.' : '; sin trazado revisado: se calcula a partir de su definición.');
    ui.coEnlace.textContent = 'Revisar o cambiar';
  }

  // Al guardar la Carrera Oficial en su ventana (otra pestaña), se vuelve a trazar.
  window.addEventListener('storage', (e) => {
    if (e.key !== CLAVE_CARRERAS) return;
    cargarCarrera();
    if (estado.salida && ui.texto.value.trim()) trazar();
  });

  // ── Trazar ──
  let enCurso = 0;
  async function trazar({ encuadrar = false } = {}) {
    estado.texto = ui.texto.value;
    guardar();
    if (!catalogo) { mensaje('Espera a que cargue el callejero del municipio.', 'error'); return; }
    if (!estado.salida) { mensaje('Fija primero la salida pinchando en el mapa.', 'error'); return; }
    const lineas = leerItinerario(estado.texto);
    if (lineas.length < 2) { mensaje('Escribe al menos dos calles.', 'error'); return; }
    const turno = ++enCurso;
    ui.btnTrazar.disabled = true;
    try {
      cargarCarrera();
      const usaCo = lineas.some((l) => esCarreraOficial(l.texto));
      // Sin trazado guardado, sus calles se comprueban como las del itinerario.
      if (coResuelta && !coResuelta.trazado && coLineas.length) {
        coLineas = await confirmarContinuidad(coLineas, { catalogo, geometria: zonaCalles.geometria, inicio: coResuelta.inicio });
        coResuelta = paraComponer(co.def, coLineas);
      }
      // Cada calle tiene que estar cerca de la anterior: descarta homónimas lejanas y elige
      // entre varias posibles por cercanía (continuidad.js).
      const resueltos = await confirmarContinuidad(resolverItinerario(lineas, catalogo, estado.elecciones), {
        catalogo, geometria: zonaCalles.geometria, inicio: estado.salida, finCarrera: usaCo && coResuelta ? coResuelta.fin : null,
      });
      if (turno !== enCurso) return;
      const extra = coResuelta && usaCo ? [
        coResuelta.inicio, coResuelta.fin, ...(coResuelta.entrada ? [coResuelta.entrada] : []),
        ...(coResuelta.trazado ?? []), ...Object.values(co.def.puntosPaso ?? {}).flat(),
      ] : [];
      await asegurarGrafo([...resueltos, ...(usaCo && coResuelta ? coResuelta.calles : [])], extra);
      if (turno !== enCurso) return;
      items = resueltos;
      recomponer();
      if (encuadrar && resultado?.coords.length > 1) {
        mapa.fitBounds(L.latLngBounds(resultado.coords.map(([x, y]) => [y, x])), { padding: [30, 30] });
      }
      const pendientes = items.filter((it) => it.tipo === 'sin' || it.tipo === 'ambigua').length;
      mensaje(pendientes
        ? `Recorrido trazado. ${pendientes} ${pendientes === 1 ? 'línea necesita' : 'líneas necesitan'} revisión en la lista.`
        : 'Recorrido trazado. Pincha sobre la línea para añadir puntos de paso y arrástralos para corregirla.');
    } catch (e) {
      mensaje(`No se pudo trazar: ${e.message}`, 'error');
    } finally {
      if (turno === enCurso) ui.btnTrazar.disabled = false;
    }
  }

  function recomponer() {
    if (arrastrando) { redibujoPendiente = true; return; }
    if (!grafo || !items.length) return;
    const usaCo = items.some((it) => it.tipo === 'co');
    // Sin trazado guardado, la Carrera Oficial se calcula con sus propios puntos de paso.
    const puntosPaso = usaCo && coResuelta && !coResuelta.trazado
      ? { ...estado.puntosPaso, ...(co.def.puntosPaso ?? {}) } : estado.puntosPaso;
    resultado = componer({ items, salida: estado.salida, grafo, puntosPaso, carrera: usaCo ? coResuelta : null });
    dibujar();
    pintarLista();
  }

  ui.btnTrazar.addEventListener('click', () => trazar({ encuadrar: true }));
  ui.texto.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) trazar({ encuadrar: true }); });

  /**
   * Puntos de paso de los pasos del trazado actual. Al reordenar o quitar calles, los de
   * pasos que ya no existen no se dibujan ni se cuentan, pero se conservan por si se deshace.
   */
  const puntosVigentes = () => {
    const claves = new Set(resultado?.pasos.map((p) => p.clave) ?? []);
    return Object.entries(estado.puntosPaso).filter(([k]) => claves.has(k));
  };

  // ── Dibujo ──
  function dibujar() {
    capaRuta.clearLayers();
    capaPuntos.clearLayers();
    lineasPaso.clear();
    if (!resultado) return;
    const color = colorRuta();

    // Unión de la salida con la primera calle.
    const primero = resultado.pasos[0]?.coords[0];
    if (primero) L.polyline([[estado.salida[1], estado.salida[0]], [primero[1], primero[0]]], { color, weight: 5, opacity: 0.9 }).addTo(capaRuta);

    resultado.pasos.forEach((p, k) => {
      const desde = p.desde >= 0 ? items[p.desde].texto : 'Salida';
      const hasta = p.etiqueta ?? items[p.hasta].texto;
      const c = COLORES[p.tipo] ?? color;
      const linea = L.polyline(p.coords.map(([x, y]) => [y, x]), {
        color: c, weight: 5, opacity: 0.9,
        dashArray: p.tipo === 'co' || p.tipo === 'recta' ? '8 6' : null,
      }).bindTooltip(p.etiqueta ? `${esc(p.etiqueta)} · ${fmtM(p.metros)}` : `${esc(desde)} → ${esc(hasta)} · ${fmtM(p.metros)}`, { sticky: true });
      // La Carrera Oficial definida no se corrige aquí, sino en su ventana.
      const fijaCo = p.tipo === 'co' && carreraEnUso();
      linea.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (aplicarModo(e)) return;
        if (fijaCo) mensaje('La Carrera Oficial se corrige en su ventana («Revisar o cambiar» en el panel).');
        else añadirPuntoPaso(p, [e.latlng.lng, e.latlng.lat]);
      });
      linea.addTo(capaRuta);
      lineasPaso.set(k, linea);
      if (p.tipo === 'co' && !carreraEnUso()) {
        L.marker([p.coords[0][1], p.coords[0][0]], { icon: icono('ed-co') }).bindTooltip('Entrada en Carrera Oficial').addTo(capaRuta);
        const f = p.coords[p.coords.length - 1];
        L.marker([f[1], f[0]], { icon: icono('ed-co') }).bindTooltip('Salida de Carrera Oficial').addTo(capaRuta);
      }
      if (p.tipo === 'recta') {
        const m = puntoA(p.coords, p.metros / 2).coord;
        L.marker([m[1], m[0]], { icon: icono('ed-aviso', '!', 18) }).bindTooltip(`Sin conexión por calles hasta «${esc(hasta)}»`).addTo(capaRuta);
      }
    });

    // Inicio, entrada y fin de la Carrera Oficial (fijos: se cambian en su ventana).
    if (carreraEnUso()) {
      for (const campo of ['inicio', 'entrada', 'fin']) {
        const pt = coResuelta[campo];
        if (!pt) continue;
        L.marker([pt[1], pt[0]], {
          icon: icono('ed-co ed-co--' + campo, campo === 'inicio' ? 'I' : campo === 'fin' ? 'F' : 'E', 18), zIndexOffset: 800,
        }).bindTooltip(`${ETIQUETA_CO[campo]} de la Carrera Oficial`).addTo(capaRuta);
      }
    }

    // Flechas de sentido de la marcha.
    for (let m = FLECHA_CADA_M / 2; m < resultado.metros; m += FLECHA_CADA_M) {
      const { coord, rumbo } = puntoA(resultado.coords, m);
      L.marker([coord[1], coord[0]], {
        icon: icono('ed-flecha', `<span style="transform:rotate(${(rumbo - 90).toFixed(0)}deg)">➤</span>`),
        interactive: false, keyboard: false,
      }).addTo(capaRuta);
    }

    // Puntos de paso arrastrables.
    for (const [claveP, lista] of puntosVigentes()) {
      lista.forEach((pt, i) => {
        const mk = L.marker([pt[1], pt[0]], { icon: icono('ed-punto'), draggable: true, zIndexOffset: 500 })
          .bindTooltip('Arrastra para corregir · doble clic para quitar')
          .addTo(capaPuntos);
        marcarArrastre(mk);
        mk.on('dragend', () => {
          const ll = mk.getLatLng();
          estado.puntosPaso[claveP][i] = [ll.lng, ll.lat];
          guardar();
          recomponerTrasCambio();
        });
        mk.on('dblclick contextmenu', (e) => {
          L.DomEvent.stop(e);
          estado.puntosPaso[claveP].splice(i, 1);
          if (!estado.puntosPaso[claveP].length) delete estado.puntosPaso[claveP];
          guardar();
          recomponerTrasCambio();
        });
      });
    }
    pintarSalida();
  }

  /** Un punto de paso fuera de la zona cargada obliga a ampliar el grafo. */
  async function recomponerTrasCambio() {
    const fuera = Object.values(estado.puntosPaso).flat().some((p) => !zonaCalles.contiene(p));
    if (fuera) await trazar();
    else recomponer();
  }

  function añadirPuntoPaso(paso, coord) {
    const lista = estado.puntosPaso[paso.clave] ?? [];
    lista.push(coord);
    // Orden a lo largo del paso, para que el camino los recorra en secuencia.
    const pos = (c) => puntoMasCercano(paso.coords, c).metros;
    lista.sort((a, b) => pos(a) - pos(b));
    estado.puntosPaso[paso.clave] = lista;
    guardar();
    recomponerTrasCambio();
  }

  // ── Lista de calles ──
  const ETIQUETA_ESTADO = {
    aprox: ['Parecida', 'aviso'], ambigua: ['Varias posibles', 'error'], sin: ['No encontrada', 'error'], manual: ['Elegida', 'ok'],
    lejos: ['Lejos del recorrido', 'error'],
  };

  // La lista edita el itinerario: cada fila es una línea del texto (items[i].n).
  const lineasTexto = () => leerItinerario(ui.texto.value).map((l) => l.texto);
  function escribirLineas(lineas, aviso) {
    ui.texto.value = lineas.join('\n');
    estado.texto = ui.texto.value;
    guardar();
    if (aviso) mensaje(aviso);
    trazar();
  }
  function moverLinea(desde, hasta) {
    const l = lineasTexto();
    if (desde === hasta || desde < 0 || hasta < 0 || desde >= l.length || hasta >= l.length) return;
    const [x] = l.splice(desde, 1);
    l.splice(hasta, 0, x);
    escribirLineas(l);
  }
  function insertarLinea(pos, texto) {
    const l = lineasTexto();
    l.splice(Math.max(0, Math.min(pos, l.length)), 0, texto);
    escribirLineas(l, `«${texto}» añadida al itinerario.`);
  }
  function quitarLinea(pos) {
    const l = lineasTexto();
    const [x] = l.splice(pos, 1);
    escribirLineas(l, `«${x}» quitada del itinerario.`);
  }

  function pintarLista() {
    ui.resultado.hidden = false;
    // Una línea puede tener varios pasos (la Carrera Oficial definida): se agregan.
    const pasoHasta = new Map();
    resultado.pasos.forEach((p, k) => {
      const a = pasoHasta.get(p.hasta) ?? { metros: 0, ks: [], enlaces: [] };
      a.metros += p.metros;
      a.ks.push(k);
      a.enlaces.push(...p.enlaces);
      pasoHasta.set(p.hasta, a);
    });
    const nVias = items.filter((it) => it.tipo === 'via').length;
    const nPuntos = puntosVigentes().reduce((s, [, l]) => s + l.length, 0);
    ui.resumen.innerHTML = `<strong>${fmtKm(resultado.metros)}</strong> · ${nVias} calles`
      + (nPuntos ? ` · ${nPuntos} ${nPuntos === 1 ? 'punto de paso' : 'puntos de paso'}` : '');
    ui.avisos.innerHTML = resultado.avisos.map((a) => `<li>${esc(a)}</li>`).join('');
    ui.btnBorrarPuntos.hidden = !nPuntos;

    const ultimo = items.length - 1;
    ui.lista.innerHTML = items.map((it, i) => {
      const paso = pasoHasta.get(i);
      const metros = paso ? `<span class="ed-item__m">${fmtM(paso.metros)}</span>` : '';
      let control;
      if (it.tipo === 'salida' || it.tipo === 'entrada') {
        control = `<span class="ed-chip">${it.tipo === 'salida' ? 'Salida del templo' : 'Entrada en el templo'}</span>`;
      } else if (it.tipo === 'co') {
        control = carreraEnUso()
          ? `<span class="ed-chip ed-chip--co">Carrera Oficial · ${co.def.calles.length} calles${co.def.entrada ? ' · paso por templo' : ''}</span>`
            + '<button type="button" class="ed-mini" data-accion="ver-co" title="Ver la definición">⚙</button>'
          : '<span class="ed-chip ed-chip--co">Carrera Oficial · tramo libre</span>'
            + '<button type="button" class="ed-mini" data-accion="ver-co" title="Definirla">⚙</button>';
      } else {
        const [txt, clase] = ETIQUETA_ESTADO[it.estado] ?? [];
        const valor = it.tipo === 'via' ? it.nombre : '';
        const placeholder = it.tipo === 'punto' ? 'Fijada en el mapa' : it.tipo === 'omitir' ? 'Omitida' : 'Elige una vía…';
        control = `<input class="ed-item__via" list="ed-calles" data-i="${i}" value="${esc(valor)}" placeholder="${placeholder}" aria-label="Vía para ${esc(it.texto)}">`
          + `<button type="button" class="ed-mini" data-accion="punto" data-i="${i}" title="Fijar en el mapa" aria-label="Fijar «${esc(it.texto)}» en el mapa">📍</button>`
          + `<button type="button" class="ed-mini" data-accion="omitir" data-i="${i}" title="${it.tipo === 'omitir' ? 'Volver a dibujar' : 'Omitir: no se dibuja pero sigue en la lista'}">${it.tipo === 'omitir' ? '↺' : '⊘'}</button>`
          + (txt ? `<span class="ed-chip ed-chip--${clase}">${txt}</span>` : '')
          + (it.tipo === 'ambigua' && it.candidatos?.length ? `<small class="ed-item__cand">¿${it.candidatos.slice(0, 4).map(esc).join('? ¿')}?</small>` : '')
          + (it.tipo === 'lejos' ? `<small class="ed-item__cand">${esc(it.nombre)} está ${it.metros != null ? `a ${fmtM(it.metros)} ` : ''}de la última calle reconocida (máximo ${fmtM(it.limite ?? 1000)}): no se dibuja. Elige otra vía cercana o fíjala en el mapa.</small>` : '')
          + (it.cercania ? `<small class="ed-item__cand">Elegida por cercanía${it.cercania.antes ? ` (${esc(it.cercania.antes)} está lejos)` : ''}${it.cercania.entre ? `; otras cerca: ${it.cercania.entre.slice(1, 4).map(esc).join(', ')}` : ''}</small>` : '');
      }
      const enlaces = paso?.enlaces.length
        ? `<small class="ed-item__enlace">Pasa por ${paso.enlaces.map((e) => `${esc(e.nombre)} (${fmtM(e.metros)})`).join(', ')}, que no está en la lista</small>`
        : '';
      const orden = `<span class="ed-item__orden">`
        + `<button type="button" class="ed-mini" data-accion="subir" data-i="${i}" title="Subir" aria-label="Subir «${esc(it.texto)}»"${i === 0 ? ' disabled' : ''}>↑</button>`
        + `<button type="button" class="ed-mini" data-accion="bajar" data-i="${i}" title="Bajar" aria-label="Bajar «${esc(it.texto)}»"${i === ultimo ? ' disabled' : ''}>↓</button>`
        + `<button type="button" class="ed-mini" data-accion="insertar" data-i="${i}" title="Añadir una calle debajo" aria-label="Añadir una calle debajo de «${esc(it.texto)}»">＋</button>`
        + `<button type="button" class="ed-mini ed-mini--quitar" data-accion="quitar" data-i="${i}" title="Quitar de la lista" aria-label="Quitar «${esc(it.texto)}»">🗑</button>`
        + `</span>`;
      return `<li class="ed-item ed-item--${it.tipo}" data-i="${i}" data-paso="${paso ? paso.ks.join(',') : ''}">
        <div class="ed-item__cab"><span class="ed-item__asa" title="Arrastra para cambiar el orden" aria-hidden="true">⋮⋮</span><span class="ed-item__txt">${esc(it.texto)}</span>${metros}${orden}</div>
        <div class="ed-item__ctl">${control}</div>${enlaces}</li>`;
    }).join('')
      // Se añade antes de la entrada en el templo si la lista termina en ella.
      + `<li class="ed-nueva ed-nueva--final"><input class="ed-item__via ed-nueva__input" list="ed-calles" data-pos="${items[ultimo]?.tipo === 'entrada' ? ultimo : items.length}" placeholder="Añadir una calle${items[ultimo]?.tipo === 'entrada' ? ' antes de la entrada' : ' al final'}…" aria-label="Añadir una calle"></li>`;
  }

  /** Fila temporal con un campo predictivo para insertar una calle en `pos`. */
  function abrirInsercion(li, pos) {
    ui.lista.querySelector('.ed-nueva--temporal')?.remove();
    const nueva = document.createElement('li');
    nueva.className = 'ed-nueva ed-nueva--temporal';
    nueva.innerHTML = `<input class="ed-item__via ed-nueva__input" list="ed-calles" data-pos="${pos}" placeholder="Calle o plaza…  (Esc para cancelar)" aria-label="Calle a añadir">`;
    li.after(nueva);
    nueva.querySelector('input').focus();
  }

  ui.lista.addEventListener('change', (e) => {
    const nueva = e.target.closest('.ed-nueva__input');
    if (nueva) {
      const v = nueva.value.trim();
      if (v) insertarLinea(Number(nueva.dataset.pos), v);
      return;
    }
    const el = e.target.closest('.ed-item__via');
    if (!el) return;
    const it = items[Number(el.dataset.i)];
    const v = el.value.trim();
    if (!v) delete estado.elecciones[it.clave];
    else if (catalogo?.porNombre(v)) estado.elecciones[it.clave] = { tipo: 'via', nombre: v };
    else { mensaje(`«${v}» no está en el callejero de ${estado.municipio.nombre}. Elígela de la lista.`, 'error'); return; }
    guardar();
    trazar();
  });

  ui.lista.addEventListener('keydown', (e) => {
    const nueva = e.target.closest('.ed-nueva__input');
    if (!nueva) return;
    if (e.key === 'Escape') nueva.closest('.ed-nueva--temporal')?.remove();
    if (e.key === 'Enter') { e.preventDefault(); nueva.blur(); }
  });

  ui.lista.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-accion]');
    if (!b) return;
    const i = Number(b.dataset.i);
    const it = items[i];
    switch (b.dataset.accion) {
      case 'subir': moverLinea(i, i - 1); break;
      case 'bajar': moverLinea(i, i + 1); break;
      case 'quitar': quitarLinea(it.n); break;
      case 'insertar': abrirInsercion(b.closest('.ed-item'), it.n + 1); break;
      case 'ver-co':
        ui.coEnlace.closest('section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'omitir':
        if (it.tipo === 'omitir') delete estado.elecciones[it.clave];
        else estado.elecciones[it.clave] = { tipo: 'omitir' };
        guardar();
        trazar();
        break;
      default:
        modo = { tipo: 'punto', clave: it.clave, texto: it.texto };
        mapa.getContainer().classList.add('ed-apuntando');
        mensaje(`Pincha en el mapa dónde está «${it.texto}».`);
    }
  });

  // Arrastrar filas para cambiar el orden (con ratón; en pantallas táctiles, ↑ y ↓).
  let arrastrada = null;
  ui.lista.addEventListener('pointerdown', (e) => {
    const asa = e.target.closest('.ed-item__asa');
    if (asa) asa.closest('.ed-item').draggable = true;
  });
  ui.lista.addEventListener('dragstart', (e) => {
    const li = e.target.closest('.ed-item');
    if (!li?.draggable) return;
    arrastrada = Number(li.dataset.i);
    li.classList.add('ed-item--arrastrando');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', items[arrastrada].texto);
  });
  const destinoArrastre = (e) => {
    const li = e.target.closest('.ed-item');
    if (!li || arrastrada == null) return null;
    const r = li.getBoundingClientRect();
    return { li, i: Number(li.dataset.i), debajo: e.clientY > r.top + r.height / 2 };
  };
  ui.lista.addEventListener('dragover', (e) => {
    const d = destinoArrastre(e);
    if (!d) return;
    e.preventDefault();
    ui.lista.querySelectorAll('.ed-item--antes, .ed-item--despues').forEach((x) => x.classList.remove('ed-item--antes', 'ed-item--despues'));
    d.li.classList.add(d.debajo ? 'ed-item--despues' : 'ed-item--antes');
  });
  ui.lista.addEventListener('drop', (e) => {
    const d = destinoArrastre(e);
    if (!d) return;
    e.preventDefault();
    // Cada fila es la línea i del itinerario (items[i].n === i). Posición final contando
    // que la fila arrastrada sale primero de su sitio.
    let pos = d.i + (d.debajo ? 1 : 0);
    if (arrastrada < pos) pos--;
    moverLinea(arrastrada, pos);
  });
  ui.lista.addEventListener('dragend', () => {
    arrastrada = null;
    ui.lista.querySelectorAll('.ed-item').forEach((x) => { x.draggable = false; x.classList.remove('ed-item--arrastrando', 'ed-item--antes', 'ed-item--despues'); });
  });

  // Resaltar en el mapa el paso de la fila sobre la que está el ratón o el foco.
  const resaltar = (e, on) => {
    const li = e.target.closest?.('.ed-item');
    const ks = li?.dataset.paso;
    if (!ks) return;
    for (const k of ks.split(',')) {
      const linea = lineasPaso.get(Number(k));
      if (!linea) continue;
      linea.setStyle({ weight: on ? 9 : 5 });
      if (on) linea.bringToFront();
    }
  };
  ui.lista.addEventListener('mouseover', (e) => resaltar(e, true));
  ui.lista.addEventListener('mouseout', (e) => resaltar(e, false));
  ui.lista.addEventListener('focusin', (e) => resaltar(e, true));
  ui.lista.addEventListener('focusout', (e) => resaltar(e, false));

  ui.btnBorrarPuntos.addEventListener('click', () => {
    estado.puntosPaso = {};
    guardar();
    recomponer();
  });

  // ── Hermandad (Sevilla), referencia 2025, importar y exportar ──
  ui.hermandad.innerHTML = '<option value="">— Ninguna —</option>'
    + datos.hermandades.map((h) => `<option value="${h.id_hdad}">${esc(h.nombre)}</option>`).join('');
  ui.hermandad.value = estado.hermandad ?? '';
  ui.hermandad.addEventListener('change', () => {
    estado.hermandad = ui.hermandad.value ? Number(ui.hermandad.value) : null;
    const h = datos.hermandades.find((x) => x.id_hdad === estado.hermandad);
    ui.btn2025.disabled = !h?.geojson2025;
    if (h && !ui.nombre.value) ui.nombre.value = h.nombre;
    guardar();
    dibujar();
  });
  ui.btn2025.disabled = !datos.hermandades.find((x) => x.id_hdad === estado.hermandad)?.geojson2025;

  function pintarReferencia(coords) {
    capaReferencia.clearLayers();
    if (!coords?.length) { ui.btnRef.hidden = true; return; }
    L.polyline(coords.map(([x, y]) => [y, x]), { color: '#6b6776', weight: 7, opacity: 0.35, interactive: false }).addTo(capaReferencia);
    ui.btnRef.hidden = false;
  }
  ui.btnRef.addEventListener('click', () => pintarReferencia(null));

  ui.btn2025.addEventListener('click', async () => {
    const h = datos.hermandades.find((x) => x.id_hdad === estado.hermandad);
    if (!h?.geojson2025) return;
    if (ui.texto.value.trim() && !window.confirm('Se sustituirá el itinerario escrito por el de 2025. ¿Continuar?')) return;
    try {
      const r = deGeoJSON(await (await fetch(h.geojson2025)).json());
      ui.texto.value = r.texto;
      estado.texto = r.texto;
      pintarReferencia(r.referencia);
      if (!estado.salida && r.referencia?.length) {
        await fijarSalida(r.referencia[0]);
        mensaje('Itinerario 2025 cargado. La salida se ha tomado del trazado de 2025; muévela a la puerta si no coincide.');
      } else {
        mensaje('Itinerario 2025 cargado (gris: trazado de 2025). Revísalo y pulsa «Trazar recorrido».');
      }
      guardar();
    } catch (e) {
      mensaje(`No se pudo cargar el recorrido de 2025: ${e.message}`, 'error');
    }
  });

  ui.btnExportar.addEventListener('click', () => {
    if (!resultado) { mensaje('Traza primero el recorrido.', 'error'); return; }
    const h = datos.hermandades.find((x) => x.id_hdad === estado.hermandad) ?? null;
    const nombre = ui.nombre.value.trim();
    // De la Carrera Oficial se anota solo su origen y fecha: es la del municipio, no del recorrido.
    const carrera = carreraEnUso() ? { origen: co.origen, actualizado: co.def.actualizado ?? null } : null;
    const geo = aGeoJSON({ items, resultado, salida: estado.salida, hermandad: h, nombre, municipio: estado.municipio, estado: { ...estado, carrera } });
    const archivo = h
      ? `${String(h.id_hdad).padStart(2, '0')}-${h.slug}.geojson`
      : `${(clave(nombre) || 'recorrido').slice(0, 60)}.geojson`;
    descargar(archivo, geo);
  });

  ui.importar.addEventListener('change', async () => {
    const f = ui.importar.files?.[0];
    if (!f) return;
    try {
      const r = deGeoJSON(JSON.parse(await f.text()));
      if (r.id_hdad && datos.hermandades.some((h) => h.id_hdad === r.id_hdad)) {
        estado.hermandad = r.id_hdad;
        ui.hermandad.value = String(r.id_hdad);
      }
      if (r.estado) {
        // La Carrera Oficial no se importa: se usa la del municipio.
        Object.assign(estado, { texto: r.estado.texto, salida: r.estado.salida, elecciones: r.estado.elecciones, puntosPaso: r.estado.puntosPaso });
        ui.texto.value = estado.texto;
        pintarReferencia(null);
        if (r.estado.municipio && r.estado.municipio.cod !== estado.municipio.cod) await elegirMunicipio(r.estado.municipio, { encuadrar: false });
        guardar();
        pintarSalida();
        await trazar({ encuadrar: true });
      } else {
        ui.texto.value = r.texto;
        estado.texto = r.texto;
        pintarReferencia(r.referencia);
        guardar();
        mensaje('Itinerario importado de los puntos del archivo; la línea del archivo se muestra en gris.');
      }
    } catch (e) {
      mensaje(`No se pudo leer el archivo: ${e.message}`, 'error');
    } finally {
      ui.importar.value = '';
    }
  });

  // ── Arranque ──
  cargarCarrera();
  ui.texto.value = estado.texto ?? '';
  pintarSalida();
  if (estado.salida) mapa.setView([estado.salida[1], estado.salida[0]], 16);
  cargarMunicipios().then(async () => {
    await elegirMunicipio(estado.municipio ?? SEVILLA, { encuadrar: !estado.salida });
    if (estado.salida && estado.texto.trim()) trazar({ encuadrar: true });
  });
}
