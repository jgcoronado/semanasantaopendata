# Editor de recorridos

Página `/recorridos/editor/` (noindex, fuera del sitemap). Convierte el itinerario de una
procesión escrito como lista de calles en una línea continua sobre el mapa, para cualquier
municipio de Andalucía. Todo ocurre en el navegador; no hay backend.

## Fuentes de datos

| Servicio | Qué aporta | Uso |
|----------|------------|-----|
| CDAU — Callejero Digital de Andalucía Unificado (IECA), WFS `https://www.callejerodeandalucia.es/servicios/cdau/wfs` | Vías con nombre oficial (`cdau:v_vial`, ejes de calle), tramos (`cdau:v_tramo`) | Nombres del municipio, geometría de las calles, municipio de la salida |
| DERA G13 (IECA), WFS `https://www.ideandalucia.es/services/DERA_g13_limites_administrativos/wfs` | Términos municipales | Lista de los 785 municipios y límite del elegido |
| OpenStreetMap vía Overpass (`overpass-api.de`) | Lugares de culto (`amenity=place_of_worship`) con nombre y alias | Índice local de templos del municipio para buscar la salida por nombre |
| Photon (`photon.komoot.io`, geocodificador sobre OSM) | Cualquier lugar con nombre | Búsqueda en vivo de la salida cuando el índice no está o no encuentra nada |

Licencia CC BY 4.0: la atribución va en el mapa (`ATRIBUCION_CDAU`). Ambos servicios
aceptan peticiones desde el navegador (CORS) y devuelven GeoJSON. Las respuestas se guardan
con la Cache API del navegador (7 días el callejero, 90 los municipios).

Medido en oct 2026: nombres de las ~5.000 vías de Sevilla en ~1 s (1,1 MB); geometría de
la zona Catedral–Arenal (329 vías) en ~1 s; lista de municipios 144 KB; templos de Sevilla en
Overpass, 170 dentro del término en ~3 s (70 KB, caché 30 días); Photon ~4,5 s por consulta.

El CDAU no tiene templos ni otros lugares. Se probaron también el Nomenclátor Geográfico de
Andalucía (`wfs-nga-inspire`, solo GML y 39 templos en Sevilla, sin la Magdalena) y
CartoCiudad y Nominatim (sin resultados para «parroquia de la magdalena»). Overpass da 504 en
horas de carga: el índice reintenta tres veces y, si falla, queda la búsqueda con Photon.

## Mapa de fondo

| Capa | Servicio | Notas |
|------|----------|-------|
| Callejero IGN (por defecto) | WMTS `https://www.ign.es/wmts/ign-base`, capa `IGNBaseTodo`, `GoogleMapsCompatible` | Teselas cacheadas, 100–200 ms, hasta z19. Callejero de CartoCiudad, cuyas direcciones en Andalucía proceden del CDAU: los ejes del recorrido caen sobre sus calles |
| OpenStreetMap | `tile.openstreetmap.org` | Alternativa |
| Ortofoto PNOA | TMS del IGN | Alternativa |
| Ejes del callejero (CDAU), superpuesta | Se dibujan en el navegador con las vías ya descargadas | Son exactamente los ejes que usa el grafo; panel propio bajo el trazado |
| Parcelas del Catastro, superpuesta | WMS `ovc.catastro.meh.es`, capa `Catastro`, desde z15 | Fachadas y parcelas, para ver ensanches |

El fondo y las capas elegidas se recuerdan en el navegador (`localStorage`). También se
probaron el WMS del CDAU (`/servicios/cdau/wms`: solo ejes, nombres y portales sobre blanco, sin
manzanas) y el Mapa de Andalucía del IECA (`/services/andalucia/wms`: no rotula calles a esa
escala y tarda ~2 s por imagen).

## Flujo

1. **Municipio**: se elige de la lista; se carga su catálogo de nombres oficiales.
2. **Salida**: por nombre del templo o de la hermandad (predictivo, `lugares.js`), por
   dirección (calle predictiva con el callejero del municipio y número predictivo con los
   portales de esa calle, capa `cdau:v_portalpk`) o pinchando la puerta del templo en el mapa.
   - El buscador por nombre ignora las palabras genéricas («parroquia», «iglesia», «capilla»,
     «basílica», «san», «santa»…) para decidir: «parroquia de la magdalena» encuentra «Iglesia
     de la Magdalena». Usa también `alt_name`, `official_name`, `old_name` y `short_name` de OSM.
   - En Sevilla incluye las hermandades con el primer punto de su recorrido de 2025 («El
     Baratillo» está en OSM como «Capilla de Nuestra Señora de la Piedad»).
   - La última opción, o Enter sin coincidencias, busca en Photon dentro del término.
   - El punto de un templo es el centro del edificio: hay que arrastrarlo a la puerta. El marcador se puede arrastrar. El municipio se comprueba con el CDAU en
   ese punto y se cambia solo si no coincide.
3. **Itinerario**: una calle por línea (o separadas por comas, punto y coma o guiones con
   espacios). «Carrera Oficial» es palabra clave. Si la primera línea no es una vía
   (p. ej. «Puerta del Perdón»), es la salida; si la última repite la primera, la entrada.
4. **Trazar**: se descarga la geometría de las vías resueltas y la zona alrededor (+200 m,
   máx. 6 km de lado), se monta el grafo y se compone el recorrido.

## Algoritmo (`src/lib/recorridos/`)

| Módulo | Función |
|--------|---------|
| `nombres.js` | Normalización y resolución: la `clave` quita acentos, tipo de vía, artículos y espacios y unifica y/i («C/ Tomás de Ybarra» = «Calle Tomás de Ibarra», «Entre Cárceles» = «Calle entre Cárceles»). Exacta → `ok`; parecida (Levenshtein) → `aprox`; varias → `ambigua`; nada → `sin` |
| `continuidad.js` | Comprueba que cada vía resuelta está cerca de la anterior, ver «Continuidad» |
| `cdau.js` | Cliente WFS con caché (vías, nombres, portales, municipio de un punto, municipios) |
| `lugares.js` | Búsqueda de la salida por nombre: índice de templos (Overpass), puntuación con palabras genéricas, Photon |
| `grafo.js` | Grafo de ejes. Funde vértices a ≤ 3 m y cose extremos sueltos al segmento más cercano (≤ 3 m): el CDAU no siempre comparte el vértice en los cruces |
| `componer.js` | Cada paso va de donde acabó el anterior a la primera esquina de la calle siguiente por el camino de coste mínimo: calle actual y siguiente cuestan 1, el resto 3 (así se aceptan enlaces cortos no listados y se avisan). La Carrera Oficial es un paso sin penalizaciones entre la calle anterior y la siguiente. Los puntos de paso del usuario fuerzan el camino; si caen a más de 25 m de una calle se llega a ellos en recta |
| `geo.js` → `suavizar` | Limpieza del trazado final, ver «Suavizado» |
| `exportar.js` | GeoJSON en el formato de `scripts/geojson-AAAA/` más el estado del editor en `properties.editor` |
| `editor.js` | Interfaz (Leaflet) |

Prueba de referencia: itinerario de la salida por la Puerta del Perdón (32 líneas). Se
resuelven 31 (falta «Arco del Postigo», que en el CDAU es parte de Almirantazgo) y el
recorrido mide unos 2,4 km (2.506 m sin suavizar) frente a los ~2.440 m de las trazas GPS. De los 297 nombres de calle de
los GeoJSON de 2025, 291 se resuelven de forma exacta.

## Continuidad

El catálogo resuelve por nombre en todo el municipio, y en municipios con pedanías o
barriadas hay homónimas a kilómetros. En Jerez, «De la Rosa» (hoy Padre Hortas Cáliz, entre
la Encarnación y Manuel María González) coincidía con la Calle Rosa de una pedanía a 13 km.
Tras resolver los nombres, `continuidad.js` recorre la lista en orden con la geometría de
las candidatas y exige que cada vía esté a **≤ 300 m** de la última aceptada (la primera,
de la salida; tras la Carrera Oficial definida, de su fin):

1. De las vías con el nombre elegido se quedan las cercanas.
2. Si ninguna está cerca, o la línea tiene varias posibles («Encarnación»: Plaza o Cuesta),
   se busca entre las varias posibles y las de nombre parecido al **≥ 90 %** (1 − distancia
   de edición / longitud de la clave) las que estén cerca, y se elige la que menos dista de
   la anterior más la siguiente. La fila dice «Elegida por cercanía».
3. Si no hay ninguna cerca, la línea queda **«Lejos del recorrido»** y no se dibuja (como
   omitirla): el camino de la anterior a la siguiente sale solo y la fila de la siguiente
   dice por qué calles pasa. Se corrige eligiendo la vía o con 📍.

Cada línea que no se dibuja suma 300 m al radio de la siguiente, porque la calle saltada
tiene su longitud. **Restricción dura: nunca se acepta una vía a más de 1 km de la última
reconocida** (`DISTANCIA_MAX_CALLE_M` en `componer.js`): ni por saltos, ni elegida a mano, ni
tras una Carrera Oficial sin definir (si la calle siguiente queda a más de 1 km, hay que
definir la Carrera Oficial o fijar un punto con 📍). Los puntos fijados en el mapa, la salida
y el fin de la Carrera Oficial cuentan como referencia. `componer.js` lo vuelve a comprobar
sobre el grafo: solo usa esquinas de la calle a ≤ 1 km de la calle anterior. Las mismas
reglas se aplican a las calles de la Carrera Oficial, desde su inicio.

## Carrera Oficial

La línea «Carrera Oficial» del itinerario se sustituye por la definición del municipio:
**inicio** (punto) → **calles** en orden → **entrada en templo** (punto, opcional) → **fin**
(punto). Con entrada, de la entrada al fin se dibuja en línea recta por el interior (en
Sevilla, de la Puerta de San Miguel a la de Palos de la Catedral). Hasta el inicio se llega
como a cualquier punto; dentro de la Carrera Oficial cuentan sus propias calles. Sin inicio y
fin (o con «Dejar como tramo libre») es un tramo libre entre la calle anterior y la siguiente.

- **Predeterminadas**: `src/data/carreras-oficiales.json`, por código INE de municipio. Añadir
  otra localidad es añadir una entrada; el editor la carga sola. «Copiar definición» genera la
  entrada desde lo que se haya fijado en el editor. Sevilla (41091): inicio en La Campana
  (primer punto del tramo canónico de 2025), La Campana → Sierpes → Plaza de San Francisco →
  Avenida de la Constitución, Puerta de San Miguel y Puerta de Palos (OpenStreetMap).
- **Edición**: panel «Carrera Oficial» (📍 para fijar puntos, lista de calles con campo
  predictivo y estado de cada una) y marcadores I/E/F arrastrables en el mapa. Los cambios se
  guardan en el navegador por municipio y viajan en el GeoJSON exportado (`editor.carrera`).
- En la lista del recorrido la fila «Carrera Oficial» suma los metros de todos sus tramos.

## Suavizado

Los ejes del CDAU no siempre se cortan en un punto: una calle termina en el eje de la
transversal unos metros antes del cruce (Pastor y Landero acaba en López de Arenas, ~20 m
antes de Adriano) y el camino dibuja una V; en los ensanches el eje sigue las fachadas con
escalones de pocos metros (Almirantazgo). Tras componer, el trazado completo pasa por
`suavizar` y se vuelve a cortar en pasos (`cortarEn`).

Cada vértice que se quita se mide contra el trazado **original** entre los dos vértices que
quedan, no contra la línea ya simplificada: así los recortes no se acumulan a lo largo de una
calle. (La primera versión medía contra la línea simplificada y llegó a separarse 16 m del
eje en Arfe.)

| Regla | Desvío máximo respecto al eje original | Solo si el tramo afectado mide |
|-------|-----------------------------------------|--------------------------------|
| General | 2,5 m | — |
| Escalón | 6 m | ≤ 30 m |
| Pico en cruce (ángulo < 75°) | 18 m | ≤ 45 m |
| Redondeo de esquina | 2,5 m (corte ≤ 8 m) | — |

Comprobación (muestreo cada 2 m de la línea final frente a todos los ejes de la zona): fuera
del enlace entre el marcador de salida y la primera calle, la línea solo se separa más de
3 m de un eje en los cruces cortados en diagonal, en tramos de ≤ 10 m (máx. 8 m en la
Puerta del Arenal). Los puntos de paso del usuario, la salida y el final no se tocan.

### Plazas y zonas abiertas

En las plazas (y compases, explanadas, atrios, lonjas: `esZonaAbierta` en `nombres.js`) el
cortejo no va por el carril. El eje del CDAU de algunas plazas baja hasta un cruce y vuelve
por el otro lado: en la Plaza del Triunfo, rodeándola por el Archivo de Indias y la muralla
del Alcázar, el eje llega hasta Santo Tomás y sube de nuevo (un codo de 180°).
`atajarHorquillas` (en `geo.js`, antes de `suavizar`) sustituye esas idas y vueltas por la
recta que cruza la plaza cuando:

- todo el tramo va por ejes de plazas;
- la recta mide ≤ 25 m y el tramo que quita ≥ 20 m y ≥ 2,5 veces la recta (≤ 120 m);
- la ida y la vuelta van a ≤ 25 m una de otra (rodear algo más ancho, como un monumento o
  una fuente grande, es intencionado y se respeta);
- no hay puntos de paso del usuario dentro (un punto de paso en la horquilla la conserva).

## Correcciones en la interfaz

- **Orden de la lista**: ↑ y ↓ en cada fila, o arrastrar por el asa (⋮⋮). ＋ añade una calle
  debajo (campo predictivo) y 🗑 la quita; abajo hay un campo para añadir otra antes de la
  entrada en el templo. La lista y el cuadro de texto son la misma cosa: cada cambio reescribe
  el itinerario y se vuelve a trazar. Los puntos de paso de pasos que dejan de existir no se
  dibujan, pero se conservan por si se deshace el cambio.
- **Otra vía**: escribir o elegir en el campo de la línea (lista con todas las vías del
  municipio). Se aplica a todas las líneas con el mismo texto.
- **📍**: fijar la línea en el mapa (lugares que no son vías: arcos, compases, puertas).
- **⊘**: omitir la línea (sigue en la lista pero no se dibuja).
- **Puntos de paso**: pinchar sobre la línea añade uno a ese paso; se arrastran; doble clic
  o clic derecho lo quita. Con un «Fijar en el mapa» o 📍 pendiente, el clic es para eso
  aunque caiga sobre la línea. El trazado suavizado se reparte en pasos buscando cada corte
  a ±80 m de lo esperado desde el corte anterior (no desde la salida: en recorridos de
  varios km el acortamiento del suavizado se acumulaba y un paso de la Carrera Oficial
  podía quedarse con las calles siguientes, y los clics en ellas iban a la Carrera).

## Guardar

«Descargar GeoJSON» genera `NN-slug.geojson` si hay hermandad elegida (solo Sevilla) o
el nombre escrito. Para publicarlo en el sitio, el archivo va a `scripts/geojson-AAAA/` (y a
`public/geojson/AAAA/` si lo usa el mapa de la ficha). «Abrir GeoJSON» recupera un recorrido
del editor con sus correcciones, o carga el itinerario de un GeoJSON de 2025 y muestra su
línea en gris como referencia. El estado de trabajo se conserva en el navegador
(`localStorage`).

## Límites conocidos

- El CDAU solo tiene ejes de calle: no hay caminos por el interior de las plazas. Los cruces
  de plaza siguen los ejes y se corrigen con puntos de paso.
- Lo que no es una vía (puertas, arcos, compases) hay que fijarlo en el mapa.
- Depende de los servicios WFS de la Junta: sin ellos no se pueden trazar recorridos nuevos
  (lo ya cacheado sigue funcionando).
- Calles homónimas en un mismo municipio: solo se usan las que están a ≤ 300 m de la calle
  anterior (ver «Continuidad»). Un nombre antiguo que no está en el CDAU ni como
  sobrenombre (de la Rosa → Padre Hortas Cáliz) no se puede traducir: se salta y el camino
  pasa por la calle actual.
- Lugares que no son vías (el Reducto de la Catedral de Jerez) quedan «No encontrada» y la
  calle siguiente se busca desde la anterior: si el camino da un rodeo, fijarlos con 📍.

## Relación con el índice de tramos 2025

El editor no usa `scripts/indice-tramos-canonicos.json` ni `componer-ruta.mjs`. Una auditoría
(oct 2026) concluyó que el índice está desfasado (`21-la-candelaria` se editó después de
generarlo) y que, para un itinerario nuevo, solo el 55 % de los pares de calles sale correcto;
el 14 % de los pares de cada recorrido no aparece en ningún otro archivo. Los 61 GeoJSON de
2025 sí son una buena base, con fallos concentrados en `52-la-o` (la línea de vuelta sigue
por Santo Tomás → Temprado aunque los puntos se corrigieron), `55-la-mortaja` y
`23-dulce-nombre` (≈ 1/3 de rectas entre puntos) y los puntos de la Carrera Oficial en orden
inverso en 03, 05, 07, 14, 47, 51 y 52.
