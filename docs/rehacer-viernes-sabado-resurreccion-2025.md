# Rehecho de GeoJSON Viernes Santo (tarde) / Sábado Santo / Domingo de Resurrección 2025 (no editados)

Reconstrucción **desde cero** de los recorridos de las hermandades de Viernes
Santo (tarde), Sábado Santo y Domingo de Resurrección que **no** estaban editadas
a mano, con el mismo método que `docs/rehacer-martes-miercoles-2025.md` y
`docs/rehacer-jueves-madruga-2025.md`.

Script: `scripts/rehacer-viernes-sabado-resurreccion.mjs`. Mismo motor; añade dos
fragmentos curados (vuelta de La Carretería `Dos de Mayo→Rodo→Real Carretería→
Toneleros→Antonia Díaz` de 03; vuelta Arenal `Dos de Mayo→Arfe→…→Zaragoza` de
17) y dos mejoras de resolución de coords:

- **Colisión de nombre**: si una calle "compartida" (Calle Sol, Valle, Jáuregui…)
  resuelve a una coord a >350 m de la geocodificación local de esa hermandad, se
  usa la local (evita saltos de 1-2 km por homónimos en otra zona). Corrigió La
  Trinidad (Calle Sol/Jáuregui daban 2 km de salto).
- **COORD_OVERRIDES** para Points con sólo un placeholder erróneo y sin fuente
  fiable: `Compás de la Basílica de María Auxiliadora` y `Plaza Padre Jerónimo de
  Córdoba` (Trinidad).

No toca el resto de días.

## Estado por hermandad

| Archivo | Points | Coords | Canónico | Rectas | Salto máx |
|---|---|---|---|---|---|
| 49-la-carreteria | 25 | 74 | 64% | 4 | 132 m |
| 50-soledad-de-san-buenaventura | 23 | 70 | 56% | 4 | 168 m |
| 53-san-isidoro | 18 | 59 | 56% | 4 | 128 m |
| 54-montserrat | 23 | 77 | 71% | 2 | 132 m |
| 55-la-mortaja | 35 | 90 | 35% | 11 | 365 m |
| 56-el-sol | 43 | 108 | 32% | 15 | 841 m |
| 57-los-servitas | 35 | 111 | 58% | 5 | 124 m |
| 58-la-trinidad | 46 | 116 | 38% | 15 | 375 m |
| 59-santo-entierro | 17 | 58 | 44% | 5 | 134 m |
| 60-soledad-de-san-lorenzo | 29 | 86 | 50% | 5 | 410 m |
| 61-la-resurreccion | 36 | 102 | 28% | 13 | 712 m |

Cobertura baja en las de mucho barrio: **El Sol** (Cerro del Águila/Sur, casi
todo barrio: Aljarafe, Virgen del Sol, Ramón y Cajal, Enramadilla, glorietas) y
**La Resurrección** (casco norte Santa Marina/Macarena). Sus saltos grandes son
rectas de barrio largas (avenidas geocodificadas a una sección u otra), marcadas
para trazado manual.

## Correcciones de Points detectadas (vs. estado anterior)

- **49-la-carreteria**, **50-soledad-de-san-buenaventura**, **54-montserrat**:
  faltaba `Plaza del Triunfo` (y en 50/54 también `Fray Ceferino González`) en la
  salida/vuelta → añadidos.
- **57-los-servitas**: arranque desordenado (San Marcos/Doña María Coronel/Bustos
  Tavera duplicados al inicio) → reordenado al itinerario oficial.
- **58-la-trinidad**: arranque desordenado (Valle/Jáuregui/Padre Jerónimo/Ponce
  de León duplicados y mal colocados) → reordenado; coords de Sol/Jáuregui/Compás/
  Padre Jerónimo corregidas.
- **59-santo-entierro**: faltaba la 2ª `Plaza de San Francisco` (Alemanes→Hernando
  Colón→San Francisco→Plaza Nueva) → añadida.
- **60-soledad-de-san-lorenzo**: faltaba la 2ª `Jesús del Gran Poder`
  (Aponte→Gran Poder→Las Cortes) → añadida.

## Pendiente: tramos en RECTA (trazar a mano)

Tramos de barrio sin fragmento verificado ni trazado OSRM limpio (recta entre
Points). Resumen por hermandad:

- **49-la-carreteria**: Santander→Temprado→Dos de Mayo (vuelta).
- **50-soledad-de-san-buenaventura**: Carlos Cañal→Zaragoza→Madrid; Doña Guiomar→
  Zaragoza→Carlos Cañal.
- **53-san-isidoro**: Javier Lasso→Tarifa→Duque; Francos→Cuesta del Rosario→
  Luchana.
- **54-montserrat**: Cristo del Calvario→San Pablo.
- **55-la-mortaja**: casco San Martín (Feria→Castellar→Alberto Lista→Saavedras→
  San Martín→Cervantes→San Andrés).
- **56-el-sol**: el tramo Ramón y Cajal→Enramadilla→glorieta D.Mª de las
  Mercedes→Carlos V→Don Juan de Austria (ida) y su inverso (vuelta) ya usan la
  geometría verificada de 19-el-cerro. Quedan en recta: Aljarafe↔Virgen del Sol↔
  Ramón y Cajal (Cerro del Águila), Avión Cuatro Vientos (vuelta), y el casco de
  Santa Cruz (Catalina de Ribera→Cano y Cueto→Santa María la Blanca→San José→
  Jesús de la Salud→Ramón Ybarra→Muñoz y Pabón→Cabeza del Rey→Candilejo→Alfalfa).
- **57-los-servitas**: Siete Dolores→San Marcos; Vergara→Santa Isabel→Siete
  Dolores.
- **58-la-trinidad**: casco Basílica (Compás→María Auxiliadora→Mateos→Valle→
  Jáuregui→Padre Jerónimo→Ponce de León, ida; y la vuelta por Verónica→Cinco
  Llagas→Sol→Madre Isabel→María Auxiliadora). San Ildefonso→Zamudio→San Leandro.
- **59-santo-entierro**: Alemanes→Hernando Colón→Plaza de San Francisco (como
  Siete Palabras); Alfonso XII→Duque.
- **60-soledad-de-san-lorenzo**: San Lorenzo→Conde de Barajas→Gran Poder; Gavidia
  →Cardenal Spínola→San Lorenzo.
- **61-la-resurreccion**: todo el casco norte Santa Marina (Señor de la
  Resurrección→San Luis→Arrayán→Virgen del Carmen Dolorosa→Cronista→San Blas→
  Infantes→Almirante Espinosa→Monte Sión→Feria→Conde de Torrejón).

## Reproducir

```bash
node scripts/rehacer-viernes-sabado-resurreccion.mjs --dry-run   # informe
node scripts/rehacer-viernes-sabado-resurreccion.mjs             # escribe los 11 GeoJSON
```

Con esto quedan rehechos los **32 GeoJSON no editados** de toda la Semana Santa
(Martes a Domingo de Resurrección). Trazado OSRM de barrio del commit `6d4b56c`.
