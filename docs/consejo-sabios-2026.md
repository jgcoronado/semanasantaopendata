# Consejo de Sabios — Semana Santa Open Data (junio 2026)

_Convocado el 26 de junio de 2026 para analizar el estado del desarrollo de la web y
fijar los próximos pasos._

---

## 0. Documentación de contexto para los sabios

Antes de la deliberación, los sabios disponen de la siguiente información del proyecto:

### El proyecto en una frase
Web estática de datos abiertos del conteo de la Semana Santa de Sevilla —nazarenos y
participantes por hermandad y día— con tres años activos (2023, 2025, 2026), horarios
oficiales, paso real por La Campana y análisis cruzados.

### Estado técnico (a fecha de la reunión)

| Elemento                        | Estado |
|---------------------------------|--------|
| Años con datos de nazarenos     | 3 (2023, 2025, 2026) |
| Hermandades en el catálogo      | 61 |
| Horarios disponibles            | 2025, 2026 |
| Paso real (Campana/Catedral)    | Solo 2026 |
| Recorridos GPS (GeoJSON)        | 61 hermandades 2025, corregidos (0 duplicados) |
| `recorridos-2025.json` (metros) | 61 hermandades |
| `recorridos-2026.json` (metros) | **No existe** |
| Comparecencia 2025              | **4 de 44** registros completados |
| Dominio propio                  | ✅ **Registrado y activo** (`semanasantaopendata.org`, HTTP 200) |
| Tests automáticos               | Solo `npm run build` (integridad referencial) |
| Despliegue                      | Cloudflare Workers, auto-deploy en push a `main` |
| Entorno de pruebas              | `pre` branch → URL estable |

### Funcionalidad ya construida (y funcionando)

- Hub multi-año (`/`), portada por año, páginas de día, fichas de hermandad.
- Gráficas (Chart.js): Gantt de horarios, ocupación Carrera Oficial, dispersión,
  histogramas, scatter kmvsnazarenos, ranking de recorridos.
- Tablas ordenables/filtrables, buscador de hermandades.
- Comparativa entre años con selector de métrica y año base.
- Descargas open data CSV/JSON por año.
- SEO: JSON-LD, Open Graph, sitemap, robots.txt (≈125 páginas estáticas).
- Componente `RecorridosGraficas.astro` ya integrado en la portada del año.
- Sección `ComparecenciaSeccion.astro` para datos detallados por hermandad.
- Validador `scripts/validar-geojson.mjs` para los 34 GeoJSON no editados.

### Deuda técnica identificada

- **`baseNomina`** en `comparecencia-2025.json`: campo string `"nomina"/"papeletas"`
  que `datos.js` no lee — calcula la base independientemente vía `naz.nomina ?? c.papeletas`.
  Para los 4 registros actuales coincide, pero podría fallar si `baseNomina="papeletas"`
  y `naz.nomina` no es nulo.
- **GeoJSON 2026**: los recorridos GPS de 2026 no existen (la metodología para generarlos
  está documentada en `docs/metodologia-recorridos-2026.md`).
- **Sin tests de UI**: las gráficas y la interactividad solo se verifican manualmente.

---

## 1. El Optimista

**Papel:** Ve lo positivo, celebra los logros, propone expansión con entusiasmo.

---

Señores, lo que tenemos aquí es un logro extraordinario para un proyecto de software público
sin presupuesto ni equipo. En menos de tres años hemos construido una infraestructura que
ninguna fuente oficial ofrece de forma abierta:

**Los datos hablan solos.** Tres años, 61 hermandades, datos de 2023, 2025 y 2026. La
comparativa año a año es única en su género. El sistema auto-descubre los años con un
simple `import.meta.glob` —añadir 2027 será cuestión de dos archivos JSON y un push.

**La arquitectura es elegante.** Astro SSG puro: 125 páginas estáticas, tiempo de carga
cercano a cero, sin servidor, sin base de datos, sin mantenimiento. Todo el procesamiento
ocurre en build. Cloudflare Workers lo sirve con latencia global mínima.

**Los recorridos GPS son pioneros.** 61 archivos GeoJSON, uno por hermandad, con las rutas
reales de estación de penitencia calculadas pie a pie. Esto es dato único —el Consejo no
lo publica en formato reutilizable. Ya están integrados: kilómetros en la portada del año,
ranking, scatter km vs nazarenos. ¡Y ahora corregidos al 100%, 0 calles duplicadas!

**La comparecencia es el próximo gran hito.** Solo necesitamos completar los 40 registros
restantes de 2025. Los componentes ya están construidos: `ComparecenciaSeccion.astro`
espera los datos.

Mi conclusión: este proyecto está en el 80% del camino hacia ser la referencia de datos
procesionales de Sevilla. El 20% restante —más datos, dominio propio, visibilidad— es
asequible y emocionante.

---

## 2. El Pesimista

**Papel:** Identifica los riesgos, los puntos débiles y los obstáculos reales.

---

Agradezco el entusiasmo, pero me temo que estamos ignorando señales de alarma que, si no
se abordan, comprometerán la sostenibilidad del proyecto.

**Los datos están incompletos en lo más crítico.** `comparecencia-2025.json` tiene 4 de 44
registros. Llevamos más de un año desde la Semana Santa de 2025 y el 91% de esa sección
está en blanco. ¿Cuándo se completará? Si el patrón continúa, la comparecencia de 2026
también estará incompleta en junio de 2027.

**El proyecto es invisible.** Sin dominio propio, la URL es un string críptico de
Cloudflare Workers que nadie recordará ni compartirá. `semanasantaopendata.jaguerra27.workers.dev`
no es una dirección que genere confianza ni SEO duradero. El registro del dominio lleva
meses en el listado de "pendiente".

**La deuda técnica crece silenciosamente.** El campo `baseNomina` en `comparecencia-2025.json`
es una trampa: el código no lo lee, pero está ahí prometiendo una semántica que no cumple.
Cuando alguien intente usarlo para añadir el registro 5, habrá una inconsistencia difícil
de rastrear. Los GeoJSON de 2026 no existen. Los recorridos en metros de 2026 tampoco.

**El validador es insuficiente.** Tenemos `validar-geojson.mjs` para duplicados, pero no
hay tests de integridad entre los archivos JSON de datos. Si alguien añade un `idHdad`
incorrecto en `comparecencia-2025.json`, `npm run build` lo pillaría, pero solo en build.
No hay CI configurado.

**La dependencia del Consejo es total.** Todos los datos vienen de una fuente externa que
no tiene API, que publica en PDF o imágenes, y que podría cambiar su formato sin previo
aviso. La fragilidad es estructural.

Mi conclusión: el proyecto tiene valor, pero corre el riesgo de quedarse como una demostración
técnica incompleta si no se establece un ritmo de actualización sostenible y se resuelven
las deudas pendientes.

---

## 3. El Realista

**Papel:** Equilibra optimismo y pesimismo con datos concretos y estimaciones de esfuerzo.

---

Ambos tienen razón, en proporciones distintas. Voy a intentar poner cifras a lo que está
sobre la mesa.

**Lo que ya funciona y es valioso:** la arquitectura es sólida y mantenible. `datos.js`
tiene 718 líneas y gestiona todo el ciclo de vida de los datos. El sistema multi-año funciona.
La validación en build es robusta para los JSON de nazarenos. Las 125 páginas se generan
solas. Esto no es deuda: es capital.

**Lo que tiene coste real de completar:**

| Tarea | Esfuerzo estimado | Impacto |
|-------|-------------------|---------|
| Completar `comparecencia-2025.json` (40 registros) | 8–16 h (transcripción manual de boletines) | Alto |
| Registrar dominio propio | 10 minutos + 10–15 €/año | Medio-Alto |
| Generar `recorridos-2026.json` (61 registros) | 2–4 h (scripts ya disponibles) | Medio |
| Corregir `baseNomina` en `datos.js` | 30 min | Bajo-Medio (deuda técnica) |
| GeoJSON 2026 (rutas GPS) | 4–8 h (pipeline OSRM ya documentado) | Medio |
| CI básico (GitHub Actions) | 2–3 h | Bajo impacto visual, alto valor técnico |

**Lo que NO tiene coste asequible a corto plazo:**
- Tests de UI automatizados (Playwright/Cypress): 20+ horas, rendimiento marginal para
  un proyecto de esta escala.
- API pública propia: requiere servidor, coste, mantenimiento.
- Datos de años anteriores a 2023: depende de fuentes que puede que no existan en digital.

**La dependencia del Consejo** es real pero no nueva: es el mismo modelo que usan muchos
proyectos de datos abiertos (ONS, INE, data.gov). La resiliencia viene de documentar bien
el proceso de transcripción (ya hay `docs/guia-anadir-horarios-nuevo-anio.md`).

Mi conclusión: el orden de prioridad debería ser (1) dominio, (2) completar comparecencia,
(3) recorridos 2026, (4) corregir baseNomina. Todo lo demás puede esperar sin que el
proyecto pierda valor.

---

## 4. El Idealista

**Papel:** Imagina lo que podría ser el proyecto en su versión máxima.

---

Permítanme salir por un momento del tablero de tareas y pensar en el horizonte.

**Este proyecto puede convertirse en la memoria digital de la Semana Santa de Sevilla.**
No solo datos de 2023–2026. Imaginemos una serie histórica desde los años 80, cuando el
Consejo comenzó a publicar estadísticas sistemáticas. Imaginemos que cada hermandad tiene
su propia ficha con evolución de décadas: cuándo fue su record de nazarenos, cuándo tuvo
que suspender por lluvia, cómo ha crecido o menguado su cortejo.

**La geolocalización cambia el juego.** Los GeoJSON que acabamos de corregir son el
primer paso. El siguiente es mostrarlos en un mapa interactivo: las 61 rutas de 2025
animadas sobre Sevilla, con los colores por día, con la posibilidad de comparar el
recorrido de La Macarena con el de La Trinidad. Ningún medio de comunicación ni el propio
Consejo ofrece esto.

**La comparecencia abre una dimensión nueva.** Cuando los 44 registros de 2025 estén
completos, podremos responder preguntas que nadie ha respondido públicamente: ¿cuántos
nazarenos quedan en Carrera Oficial respecto a la salida? ¿Cuál es la hermandad con mayor
retención? ¿Existe correlación entre la duración del recorrido y el desgaste del cortejo?

**La sostenibilidad viene de la comunidad.** Un dominio propio, una licencia abierta
explícita (actualmente no hay `LICENSE` en el repositorio), una invitación a contribuir
vía `CONTRIBUTING.md`... estos elementos convierten un proyecto personal en un bien común.
El Consejo podría eventualmente enlazarlo o colaborar.

**La accesibilidad es una deuda moral.** Las gráficas tienen `aria-hidden` pero los
textos alternativos son genéricos. Un proyecto de datos abiertos debería ser accesible
para todos.

Mi conclusión: cada mejora técnica que hagamos debe estar al servicio de esta visión más
amplia. No construimos tablas —construimos memoria colectiva.

---

## 5. El Programador

**Papel:** Analiza el código con mirada técnica: lo que está bien, lo que falla, lo que hay que arreglar.

---

Voy a ser directo. He revisado el código y tengo observaciones concretas.

### Lo que está bien construido

- **`datos.js` como capa única**: centralizar todo el procesamiento aquí es la decisión
  correcta. El auto-descubrimiento con `import.meta.glob` es limpio. El sistema de caché
  con `Map` es adecuado para SSG.
- **Validación en build**: lanzar errores claros en `construirAnio()` si `idHdad` no
  existe es la defensa correcta para un SSG sin tests de integración.
- **La pipeline de GeoJSON**: los scripts de corrección (`fix_geojson_v3.py`) y el nuevo
  validador (`validar-geojson.mjs`) son mantenibles. El resultado: 34 archivos no manuales,
  0 calles duplicadas.
- **El componente `RecorridosGraficas.astro`**: ya está integrado en la portada, recibe
  `registros` con `metros` del `getAnio()`. Funciona en 2025. Para 2026 solo falta el JSON.

### El bug de `baseNomina`

Este es el problema más urgente. En `comparecencia-2025.json`, el campo `baseNomina` puede
ser `"nomina"` o `"papeletas"`, indicando qué cifra es el 100% de referencia. Sin embargo,
`datos.js` no lee este campo en ningún punto. La función que consume comparecencia usa:

```javascript
naz.nomina ?? c.papeletas
```

Esto funciona casualmente para los 4 registros actuales, pero si existe un registro donde
`baseNomina = "papeletas"` y `naz.nomina` no es nulo (ej: hermandad con nómina conocida
que usa papeletas como base), el cálculo será incorrecto. Hay dos soluciones:
1. Leer `baseNomina` en `datos.js` y seleccionar el campo correcto.
2. Eliminar `baseNomina` del JSON y estandarizar que la base siempre es `nomina ?? papeletas`.

Recomiendo (2): menos campo, lógica más simple, retrocompatible.

### Recorridos 2026: el camino más corto

`recorridos-2025.json` tiene 61 entradas con `{id_hdad, metros, fuente, notas}`. Para 2026:
1. Los itinerarios oficiales 2026 están en `scripts/recorridos-calles-index.json` (si se
   generaron para 2026) o en los GeoJSON de 2026 cuando existan.
2. El script OSRM ya está documentado. Ejecutarlo produce el JSON.
3. Con el JSON en `src/data/recorridos-2026.json`, `datos.js` lo auto-descubre
   (ya hay lógica `getRecorridosAnio()`) y la sección de recorridos aparece en `/2026/`.

### GeoJSON 2026: esfuerzo estimado

La metodología está en `docs/metodologia-recorridos-2026.md`. El pipeline es:
1. Itinerarios oficiales → script de generación → rutas OSRM → 61 GeoJSON.
2. Ejecutar `fix_geojson_v3.py` (adaptado) para eliminar duplicados.
3. Ejecutar `validar-geojson.mjs` para confirmar 0 errores.

Esto es trabajo mecánico, no creativo. 4–8 horas.

### CI básico: GitHub Actions

Un workflow `.github/workflows/build.yml` con solo `npm run build` ya daría cobertura
continua. Coste: 2 horas. Beneficio: ningún push rompe producción en silencio.

Mi conclusión: prioridad técnica → (1) corregir o eliminar `baseNomina`, (2) generar
`recorridos-2026.json`, (3) crear CI básico. El mapa interactivo con los GeoJSON es el
feature más impactante pero también el más costoso.

---

## 6. El Juez — Veredicto y Plan de Actuación

**Papel:** Analiza las cinco posiciones, sintetiza, descarta lo irrelevante y produce un
plan priorizado con criterio independiente.

---

### Análisis de las posiciones

He escuchado a los cinco sabios con atención. Mis observaciones:

**El optimista** tiene razón en el fondo: la arquitectura es sólida, el auto-descubrimiento
es elegante, y los recorridos GPS corregidos son datos únicos. Sin embargo, tiende a
minimizar el riesgo de estancamiento si las tareas pendientes se siguen posponiendo.

**El pesimista** identifica correctamente los tres puntos débiles estructurales: datos
incompletos, invisibilidad sin dominio, y deuda técnica. Pero su tono sugiere que la
situación es más grave de lo que es. Los problemas son resoluble en semanas, no meses.

**El realista** ofrece el marco más útil: esfuerzo concreto por tarea, impacto medible.
Su tabla de prioridades es la más accionable de las cinco exposiciones.

**El idealista** dibuja una visión necesaria —sin ella, las decisiones tácticas pierden
dirección. La idea del mapa interactivo con las 61 rutas animadas es la más impactante
a corto plazo (alto impacto visual con los GeoJSON ya disponibles).

**El programador** aporta el diagnóstico técnico más preciso. El bug de `baseNomina`,
aunque latente hoy, es una trampa que se activará cuando se añadan más registros. La
solución (2) —estandarizar la base como `nomina ?? papeletas` y eliminar el campo— es
la correcta por su simplicidad.

---

### Veredicto

El proyecto está en un punto de inflexión. Ha completado su infraestructura técnica y
sus datos fundamentales. El riesgo actual no es técnico —es de acción diferida. Cada
semana sin dominio, sin comparecencia completa, sin recorridos 2026, es una semana en
que el proyecto pierde relevancia competitiva frente a fuentes alternativas.

**El umbral crítico es la Semana Santa 2027.** Si para entonces el proyecto tiene:
dominio propio, comparecencia 2025 completa, recorridos 2026 y el mapa interactivo,
se habrá consolidado como referencia. Si llega sin esas piezas, seguirá siendo un
proyecto técnicamente impresionante pero incompleto.

---

### Plan de actuación — Tres horizontes

#### Horizonte A — Inmediato (esta semana, < 1 día de trabajo total)

1. **Registrar el dominio** `semanasantaopendata.es` o `.org` en Cloudflare.
   - Costo: ~10–15 €/año. Impacto: la URL que comparte la gente es memorable y de marca.
   - Actualizar `site` en `astro.config.mjs` y `wrangler.jsonc` tras el registro.

2. **Corregir `baseNomina`** (eliminarlo del schema de `comparecencia-2025.json` o
   documentar explícitamente que `datos.js` no lo usa).
   - Opción recomendada: añadir comentario en `datos.js` aclarando que la base es siempre
     `nomina ?? papeletas`, y eliminar el campo `baseNomina` de los 4 registros existentes.

#### Horizonte B — Corto plazo (próximas semanas, 10–20 h de trabajo)

3. **Completar `comparecencia-2025.json`** (los 40 registros restantes).
   - Fuente: boletines de las hermandades (algunos disponibles en PDF). Trabajo de
     transcripción. El componente `ComparecenciaSeccion.astro` ya está listo.

4. **Generar `recorridos-2026.json`** (61 hermandades, metros calculados con OSRM).
   - Con este JSON, la sección de recorridos aparece automáticamente en `/2026/`.
   - Seguir la metodología documentada en `docs/metodologia-recorridos-2026.md`.

5. **CI básico con GitHub Actions**.
   - Un workflow que ejecute `npm run build` en cada PR y push a `main`/`pre`.
   - Protección contra regresiones sin esfuerzo humano.

#### Horizonte C — Medio plazo (próximos meses, trabajo creativo)

6. **Mapa interactivo de recorridos GeoJSON**.
   - Los 61 GeoJSON de 2025 están corregidos y listos. Integrar Leaflet o MapLibre en
     una página `/2025/recorridos/mapa/` con las rutas animadas por día.
   - Este es el feature más visualmente impactante y diferenciador.

7. **GeoJSON 2026** (rutas GPS de las 61 hermandades del año más reciente).
   - Ejecutar pipeline OSRM, corregir duplicados con script adaptado, validar.

8. **Licencia abierta y `CONTRIBUTING.md`**.
   - Añadir `LICENSE` (CC BY 4.0 para los datos, MIT para el código) y una guía de
     contribución. Baja barrera para colaboradores externos.

9. **Datos históricos** (si las fuentes lo permiten).
   - Rastrear publicaciones del Consejo de años anteriores a 2023.

---

### Resolución final del Juez

El Juez declara que los tres primeros puntos del Horizonte A deben completarse antes de
cualquier otro trabajo nuevo. No requieren más deliberación —son decisiones ya tomadas
que solo necesitan ejecución.

El punto (3) —completar la comparecencia— es el que más valor aporta a los usuarios y
el que más tiempo ha estado pospuesto. Debe tener prioridad sobre cualquier nueva feature
técnica.

El mapa interactivo (Horizonte C, punto 6) es el feature con mayor impacto potencial
y puede desarrollarse en paralelo con la transcripción de comparecencia, ya que son
tareas independientes.

Se levanta la sesión.

---

_Documento generado el 26 de junio de 2026._
_Participantes: Optimista, Pesimista, Realista, Idealista, Programador, Juez._

---

## 7. Actualización de estado — 27 de junio de 2026

_Revisión del estado real de las tareas en las ramas `main`, `pre` y `comparecencia-2025`._

### Ya resuelto (no figuraba como hecho en la deliberación)

- ✅ **Horizonte A.1 — Dominio propio: HECHO.** `semanasantaopendata.org` está registrado y
  activo (resuelve a Cloudflare, responde HTTP 200). `site` en `astro.config.mjs` ya apunta
  al dominio real (commit `a3c09e0`, 4-jun-2026). _Pendiente menor:_ `wrangler.jsonc` no
  declara la ruta de dominio personalizado (se gestiona desde el panel de Cloudflare).
- ✅ **Validador GeoJSON: HECHO.** `scripts/validar-geojson.mjs` operativo sobre los 34
  GeoJSON no editados (commit `1f826b7`).
- ⚠️ **Horizonte C.6 — Mapa interactivo: PARCIAL.** Existe `RecorridoMapa.astro` (Leaflet)
  integrado en la ficha de hermandad (`/[anio]/hermandad/[slug]`), que pinta el recorrido
  GeoJSON de esa hermandad. **Falta** el mapa global que muestre las 61 rutas juntas
  coloreadas por día (la visión del Idealista).

### Aún pendiente (sin cambios desde la deliberación)

- ❌ **A.2 — `baseNomina`:** `datos.js:601` sigue calculando `naz.nomina ?? c.papeletas` e
  ignora el campo `baseNomina`. Hay ya 2 registros con `baseNomina:"papeletas"` (idHdad 5 y
  12); hoy el resultado coincide por casualidad, pero la deuda sigue viva.
- ❌ **B.3 — Comparecencia 2025:** sigue en 4 de 44 registros en las tres ramas.
- ❌ **B.4 — `recorridos-2026.json`:** no existe.
- ❌ **B.5 — CI GitHub Actions:** no hay `.github/workflows/`.
- ❌ **C.7 — GeoJSON 2026:** no existe.
- ❌ **C.8 — `LICENSE` / `CONTRIBUTING.md`:** no existen en el repositorio.
