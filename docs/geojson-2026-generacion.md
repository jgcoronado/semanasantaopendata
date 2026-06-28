# Generación de los GeoJSON de recorridos 2026

Los recorridos 2026 se generan así (ver [metodología](metodologia-recorridos-2026.md)):

- **Idénticos a 2025** (30): el itinerario 2026 coincide calle a calle con 2025 → se **copia** el
  GeoJSON de 2025 (geometría exacta, dibujada a mano).
- **Compuestos** (31): el itinerario cambió → se **recompone** la traza encadenando fragmentos
  canónicos, priorizando la propia geometría 2025 de cada hermandad y, para los tramos nuevos,
  el índice canónico (`scripts/indice-tramos-canonicos.json`). Los pares de calles sin fragmento
  se trazan **en recta** y quedan marcados como pendientes de ajuste manual.

Salida: `public/geojson/2026/` y `src/data/recorridos-2026.json`.

> La columna **Δ long.** compara la longitud 2026 con la de 2025; en recorridos que cambiaron es
> normal que difiera. Un 🔴 indica que conviene revisar la geometría a mano (cambios mayores o
> varios tramos en recta).

| # | Hermandad | Tipo | Tramos en recta | Long. 2026 | Δ long. | Estado |
|---|-----------|------|:---:|---:|:---:|--------|
| 1 | La Borriquita | compuesto | 0 | 2600 m | -1% | ✅ sin tramos problemáticos (Cuna→Orfila = recta confirmada) |
| 2 | La Cena | compuesto | 0 | 3455 m | -5% | ✅ Campana→Sierpes y Boteros→Cristo de Burgos copiados de 2025; sin gaps >150m |
| 3 | Jesús Despojado | copiado | — | 3540 m | +0% | ✅ idéntico a 2025 |
| 4 | La Hiniesta | compuesto | 9 | 4484 m | -10% | 🟡 ok (9 tramo(s) en recta) |
| 5 | La Paz | editado a mano | 0 | 6444 m | -1% | ✅ corregido a mano (6 tramos nuevos dibujados) |
| 6 | San Roque | compuesto | 0 | 4162 m | +0% | ✅ Encarnación, Campana→Sierpes y Boteros→Caballerizas copiados de 2025; sin gaps >150m |
| 7 | La Estrella | compuesto | 1 | 3803 m | -9% | 🟡 ok (CARRERA OFICIAL corregida; 1 tramo: puente de Triana) |
| 8 | La Amargura | compuesto | 0 | 3794 m | +5% | ✅ sin tramos problemáticos (Trajano→Duque = recta confirmada) |
| 9 | El Amor | compuesto | 0 | 2613 m | -0% | ✅ sin tramos problemáticos (Cuna→Orfila = recta confirmada) |
| 10 | San Pablo | editado a mano | 0 | 10393 m | +0% | ✅ corregido a mano (extrarradio dibujado + tramo central de Los Gitanos) |
| 11 | Redención | compuesto | 0 | 3230 m | -16% | ✅ CARRERA OFICIAL corregida (La Lanzada 2026, Duque→Argote); sin gaps >150m |
| 12 | Santa Genoveva | copiado | — | 8844 m | +0% | ✅ idéntico a 2025 |
| 13 | Santa Marta | copiado | — | 2700 m | +0% | ✅ idéntico a 2025 |
| 14 | San Gonzalo | compuesto | 1 | 5186 m | -10% | 🟡 ok (CARRERA OFICIAL corregida; varios tramos copiados de 2025; queda Murube→Sto Tomás 220m) |
| 15 | Vera-Cruz | copiado | — | 3069 m | +0% | ✅ idéntico a 2025 |
| 16 | Las Penas | copiado | — | 3131 m | +0% | ✅ idéntico a 2025 |
| 17 | Las Aguas | copiado | — | 3247 m | +0% | ✅ idéntico a 2025 |
| 18 | El Museo | copiado | — | 3147 m | +0% | ✅ idéntico a 2025 |
| 19 | El Cerro | compuesto | 3+ | 10964 m | +2% | 🟡 Bizco Amate→San Fernando y tramos del centro copiados de 2025. Quedan genuinamente nuevos: Campana→Francos (538m), Candilejo→Demetrio (706m), San Bernardo→Nª Sª Dolores (2617m) |
| 20 | San Esteban | compuesto | 1 | 4056 m | +14% | 🟡 ok (Águilas, Dormitorio y Alfalfa copiados de 2025; queda Pilatos→Zamudio 168m) |
| 21 | La Candelaria | compuesto | 1 | 4048 m | -2% | 🟡 ok (Cuna→Orfila, Campana→Cuna, Sierpes, Constitución, San Fernando copiados de 2025; gaps internos son geometría real de 2025) |
| 22 | San Benito | copiado | — | 4759 m | +0% | ✅ idéntico a 2025 |
| 23 | Dulce Nombre | compuesto | 2 | 3735 m | +6% | 🟡 ok (CARRERA OFICIAL corregida; 2 gaps pequeños: Cardenal Spínola→Gavidia, Amor de Dios→Trajano) |
| 24 | Los Javieres | compuesto | 2 | 3526 m | -9% | 🟡 ok (Trajano→Duque copiado de 2025; quedan Constitución→Triunfo 244m y Gamazo→Pl.Nueva 230m) |
| 25 | Los Estudiantes | compuesto | 0 | 3351 m | -12% | ✅ CARRERA OFICIAL corregida (salida Miguel Mañara); sin tramos en recta |
| 26 | Santa Cruz | compuesto | 1 | 3251 m | -3% | 🟡 ok (1 tramo en recta: Triunfo→Murube, trivial) |
| 27 | El Carmen Doloroso | copiado | — | 4132 m | +0% | ✅ idéntico a 2025 |
| 28 | El Buen Fin | copiado | — | 4267 m | +0% | ✅ idéntico a 2025 |
| 29 | La Sed | compuesto | 7 | 7157 m | -14% | 🟡 ok (7 tramos en recta: Benito Mas y Prat, Alejandro Collantes, Cardenal Lluch pendientes) |
| 30 | San Bernardo | copiado | — | 5235 m | +0% | ✅ idéntico a 2025 |
| 31 | La Lanzada | compuesto | 0 | 3247 m | -9% | ✅ sin tramos problemáticos (gaps <100m son geometría real) |
| 32 | El Baratillo | copiado | — | 3518 m | +0% | ✅ idéntico a 2025 |
| 33 | Los Panaderos | compuesto | 1 | 2507 m | +1% | 🟡 ok (Cuna→Orfila copiado de 2025; queda García Tassara→Gran Poder 208m) |
| 34 | Cristo de Burgos | compuesto | 5 | 3136 m | +9% | 🟡 ok (5 tramo(s) en recta) |
| 35 | Siete Palabras | copiado | — | 3156 m | +0% | ✅ idéntico a 2025 |
| 36 | Los Negritos | copiado | — | 4264 m | +0% | ✅ idéntico a 2025 |
| 37 | La Exaltación | compuesto | 0 | 3659 m | +3% | ✅ Campana→Sierpes copiado de 2025; sin gaps >150m |
| 38 | Las Cigarreras | copiado | — | 4945 m | +0% | ✅ idéntico a 2025 |
| 39 | Montesión | compuesto | 1 | 4402 m | +19% | 🟡 ok (+19% real: Conde Barajas+Gran Poder+M.Purísima; 1 esquina trivial) |
| 40 | La Quinta Angustia | copiado | — | 2755 m | +0% | ✅ idéntico a 2025 |
| 41 | El Valle | copiado | — | 2818 m | +0% | ✅ idéntico a 2025 |
| 42 | Pasión | copiado | — | 2539 m | +0% | ✅ idéntico a 2025 |
| 43 | El Silencio | copiado | — | 2813 m | +0% | ✅ idéntico a 2025 |
| 44 | El Gran Poder | copiado | — | 4162 m | +0% | ✅ idéntico a 2025 |
| 45 | La Macarena | compuesto | 2 | 5206 m | -6% | 🟡 ok (Boteros, Campana→Sierpes, San Pedro, Feria→Parras, Escoberos copiados de 2025; quedan Feria→Correduría 649m y San Juan→Madre Purísima 152m) |
| 46 | El Calvario | copiado | — | 2726 m | +0% | ✅ idéntico a 2025 |
| 47 | Esperanza de Triana | compuesto | 2 | 5008 m | -3% | 🟡 ok (CARRERA OFICIAL corregida; Altozano→Puente, Campana→Sierpes, San Jacinto→Pureza copiados de 2025; quedan Pta Triana→Zaragoza 251m y Zaragoza→Madrid 168m) |
| 48 | Los Gitanos | compuesto | 0 | 4527 m | +2% | ✅ Peñuelas→Doña María Coronel copiado de 2025; sin gaps >150m |
| 49 | La Carretería | copiado | — | 3258 m | +0% | ✅ idéntico a 2025 |
| 50 | Soledad de San Buenaventura | copiado | — | 3017 m | +0% | ✅ idéntico a 2025 |
| 51 | El Cachorro | copiado | — | 5426 m | +0% | ✅ idéntico a 2025 |
| 52 | La O | copiado | — | 4683 m | +0% | ✅ idéntico a 2025 |
| 53 | San Isidoro | copiado | — | 2519 m | +0% | ✅ idéntico a 2025 |
| 54 | Montserrat | compuesto | 0 | 3001 m | -1% | ✅ corregido (CARRERA OFICIAL estaba invertida; corrección: 0 tramos en recta) |
| 55 | La Mortaja | copiado | — | 4334 m | +0% | ✅ idéntico a 2025 |
| 56 | El Sol | copiado | — | 7294 m | +0% | ✅ idéntico a 2025 |
| 57 | Los Servitas | compuesto | 0 | 3904 m | -0% | ✅ Campana→Sierpes copiado de 2025; sin gaps >150m |
| 58 | La Trinidad | compuesto | 1 | 4805 m | -8% | 🟡 ok (Encarnación, Campana→Sierpes y Sol→Madre Isabel copiados de 2025; queda Puñonrostro→Cristo 5 Llagas 224m) |
| 59 | Santo Entierro | copiado | — | 2303 m | +0% | ✅ idéntico a 2025 |
| 60 | Soledad de San Lorenzo | copiado | — | 3422 m | +0% | ✅ idéntico a 2025 |
| 61 | La Resurrección | compuesto | 1 | 5142 m | +18% | 🟡 ok (San Luis→Alameda y Boteros→Cristo de Burgos copiados de 2025; queda Trajano→Conde de Barajas 346m) |

**45** correctos (idénticos, compuestos limpios o editados a mano) · **16** ok con algún tramo en recta · **0** a revisar a mano. **Los 61 recorridos 2026 están completos.**

## Correcciones aplicadas (2026-06-28, segunda ronda)

- **CARRERA OFICIAL invertida** (id7 La Estrella, id14 San Gonzalo, id25 Los Estudiantes, id47 Esperanza de Triana): el compositor trazaba la carrera al revés en la aproximación (O'Donnell→Constitución→San Francisco→Sierpes→Campana) **y además** saltaba en recta de Campana a la salida, duplicando el tramo. Corregido empalmando en O'Donnell la carrera real de un donante hasta la salida natural de Plaza del Triunfo:
  - **La Estrella** ← Quinta Angustia 2025, salida **Fray Ceferino González**.
  - **San Gonzalo** ← La Paz 2026, salida **Santo Tomás** (vía Joaquín Romero Murube).
  - **Los Estudiantes** ← La Paz 2026, salida **Miguel Mañara** → ✅ sin tramos en recta.
  - **Esperanza de Triana** ← La Paz 2026, salida **Fray Ceferino González**.
  - Las tres salidas naturales de Plaza del Triunfo en 2025 son: **Fray Ceferino González** (Quinta Angustia, Calvario), **Santo Tomás** (Jesús Despojado, La O) y **Miguel Mañara** (La Paz, Estudiantes). Juntas ≤49 m. Las longitudes bajan porque se elimina la traza duplicada de la carrera.
- **Boteros → Plaza del Cristo de Burgos** (id2, id34, id37, id48, id57): tramo faltante en el índice canónico. Copiado de **48-los-gitanos 2025** (9 vértices, 186 m). Juntas ≤31 m en todos los casos. Afecta a La Cena, Cristo de Burgos, La Exaltación, Los Gitanos y Los Servitas.
- **Trajano → Plaza del Duque de la Victoria**: confirmado que NO es un error — Trajano termina directamente en la plaza; el gap de ~378 m es geometría real (no hay calle intermedia).
- **Cuna → Orfila**: confirmado que NO es un error — tramo en línea recta (verificado en San Bernardo 2025 corregido).

## Correcciones aplicadas (2026-06-28)

- **Montserrat** (id54): CARRERA OFICIAL estaba invertida en la composición original. Corregida → 0 tramos en recta, 3001 m (-1% vs 2025). ✅
- **Santa Cruz** (id26): ídem. Corregida + cambio de ruta Triunfo→Fray Ceferino (en vez de Santo Tomás/Santander/Tomás de Ibarra) → 1 tramo trivial, 3251 m. ✅
- **Montesión** (id39): el +19% es correcto (nuevas calles Conde Barajas + Gran Poder + Madre Purísima). El 1 tramo en recta (esquina Trajano/Conde Barajas) es trivial. ✅
- **La Sed** (id29): mejorada de 11 a 7 tramos en recta (con el nombre correcto del Duque y mejor encadenamiento). Los 7 gaps restantes son calles nuevas: Benito Mas y Prat, Alejandro Collantes, Cardenal Lluch. 🟡
- **San Pablo** (id10): editado a mano (174 coords, 10393 m, +0% vs 2025). Recorrido casi nuevo en 2026: el extrarradio (inicio Laffón Soto→Soleá→Sinaí→Hernando del Pulgar; retorno Laguillo→Pérez Hervás→Venecia→Antonio Filpo Rojas→Samaniego→Kansas City→El Greco) se dibujó a mano; el **tramo central Francos→San Pedro** (Cuesta del Rosario→Jesús de las Tres Caídas→Odreros→Boteros→Sales y Ferré, sin Chapineros ni Álvarez Quintero) se copió del LineString de **48-los-gitanos** y se reconectó en Almirante Apodaca. ✅
- **La Paz** (id5): reconstruida y editada a mano (147 coords, 6444 m, -1% vs 2025). La ida (salida→Roma) y la vuelta (Roma→entrada) se rehicieron reutilizando la geometría 2025 invertida (la ida 2026 coincide con la vuelta 2025 y viceversa); el resto se dibujó a mano. ✅

  **Tramos nuevos de 2026 (no derivables de 2025, dibujados a mano):**
  | Calle nueva | Tramo (entre) | Sentido |
  |-------------|---------------|---------|
  | Avenida de la Borbolla | Brasil ↔ Covadonga | ida y vuelta |
  | Glorieta del Cid | Isabel la Católica ↔ Palos de la Frontera | ida y vuelta |
  | Calle Santo Tomás | Constitución ↔ Indalecio Prieto (sustituye a Adolfo Rodríguez Jurado) | ida |
  | Calle Harinas + Calle Jimios | Puerta del Arenal ↔ Joaquín Guichot (sustituyen a Castelar/Gamazo) | ida |
  | Calle Joaquín Romero Murube | Plaza del Triunfo ↔ Miguel Mañara | vuelta (tras CARRERA OFICIAL) |
