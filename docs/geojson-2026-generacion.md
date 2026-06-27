# Generación de los GeoJSON de recorridos 2026

Los recorridos 2026 se generan así (ver [metodología](metodologia-recorridos-2026.md)):

- **Idénticos a 2025** (30): el itinerario 2026 coincide calle a calle con 2025 → se **copia** el
  GeoJSON de 2025 (geometría exacta, dibujada a mano).
- **Compuestos** (31): el itinerario cambió → se **recompone** la traza encadenando fragmentos
  canónicos, priorizando la propia geometría 2025 de cada hermandad y, para los tramos nuevos,
  el índice canónico (`scripts/indice-tramos-canonicos.json`). Los pares de calles sin fragmento
  se trazan **en recta** y quedan marcados como pendientes de ajuste manual.

Salida: `scripts/geojson-2026/` (+ copia en `public/geojson/2026/`) y `src/data/recorridos-2026.json`.

> La columna **Δ long.** compara la longitud 2026 con la de 2025; en recorridos que cambiaron es
> normal que difiera. Un 🔴 indica que conviene revisar la geometría a mano (cambios mayores o
> varios tramos en recta).

| # | Hermandad | Tipo | Tramos en recta | Long. 2026 | Δ long. | Estado |
|---|-----------|------|:---:|---:|:---:|--------|
| 1 | La Borriquita | compuesto | 3 | 2600 m | -1% | 🟡 ok (3 tramo(s) en recta) |
| 2 | La Cena | compuesto | 4 | 3448 m | -5% | 🟡 ok (4 tramo(s) en recta) |
| 3 | Jesús Despojado | copiado | — | 3540 m | +0% | ✅ idéntico a 2025 |
| 4 | La Hiniesta | compuesto | 9 | 4484 m | -10% | 🟡 ok (9 tramo(s) en recta) |
| 5 | La Paz | compuesto | 29 | 5287 m | -18% | 🔴 revisar geometría |
| 6 | San Roque | compuesto | 3 | 4176 m | +0% | 🟡 ok (3 tramo(s) en recta) |
| 7 | La Estrella | compuesto | 9 | 4665 m | +11% | 🟡 ok (9 tramo(s) en recta) |
| 8 | La Amargura | compuesto | 4 | 3794 m | +5% | 🟡 ok (4 tramo(s) en recta) |
| 9 | El Amor | compuesto | 3 | 2613 m | -0% | 🟡 ok (3 tramo(s) en recta) |
| 10 | San Pablo | compuesto | 26 | 6343 m | -39% | 🔴 revisar geometría |
| 11 | Redención | compuesto | 9 | 3469 m | -9% | 🟡 ok (9 tramo(s) en recta) |
| 12 | Santa Genoveva | copiado | — | 8844 m | +0% | ✅ idéntico a 2025 |
| 13 | Santa Marta | copiado | — | 2700 m | +0% | ✅ idéntico a 2025 |
| 14 | San Gonzalo | compuesto | 13 | 5988 m | +4% | 🟡 ok (13 tramo(s) en recta) |
| 15 | Vera-Cruz | copiado | — | 3069 m | +0% | ✅ idéntico a 2025 |
| 16 | Las Penas | copiado | — | 3131 m | +0% | ✅ idéntico a 2025 |
| 17 | Las Aguas | copiado | — | 3247 m | +0% | ✅ idéntico a 2025 |
| 18 | El Museo | copiado | — | 3147 m | +0% | ✅ idéntico a 2025 |
| 19 | El Cerro | compuesto | 39 | 10372 m | -3% | 🟡 ok (39 tramo(s) en recta) |
| 20 | San Esteban | compuesto | 3 | 3842 m | +8% | 🟡 ok (3 tramo(s) en recta) |
| 21 | La Candelaria | compuesto | 10 | 3726 m | -10% | 🟡 ok (10 tramo(s) en recta) |
| 22 | San Benito | copiado | — | 4759 m | +0% | ✅ idéntico a 2025 |
| 23 | Dulce Nombre | compuesto | 6 | 3312 m | -6% | 🟡 ok (6 tramo(s) en recta) |
| 24 | Los Javieres | compuesto | 7 | 3395 m | -13% | 🟡 ok (7 tramo(s) en recta) |
| 25 | Los Estudiantes | compuesto | 10 | 4287 m | +12% | 🟡 ok (10 tramo(s) en recta) |
| 26 | Santa Cruz | compuesto | 3 | 3896 m | +16% | 🔴 revisar geometría |
| 27 | El Carmen Doloroso | copiado | — | 4132 m | +0% | ✅ idéntico a 2025 |
| 28 | El Buen Fin | copiado | — | 4267 m | +0% | ✅ idéntico a 2025 |
| 29 | La Sed | compuesto | 11 | 6407 m | -23% | 🔴 revisar geometría |
| 30 | San Bernardo | copiado | — | 5235 m | +0% | ✅ idéntico a 2025 |
| 31 | La Lanzada | compuesto | 3 | 3247 m | -9% | 🟡 ok (3 tramo(s) en recta) |
| 32 | El Baratillo | copiado | — | 3518 m | +0% | ✅ idéntico a 2025 |
| 33 | Los Panaderos | compuesto | 2 | 2496 m | +1% | 🟡 ok (2 tramo(s) en recta) |
| 34 | Cristo de Burgos | compuesto | 6 | 3122 m | +9% | 🟡 ok (6 tramo(s) en recta) |
| 35 | Siete Palabras | copiado | — | 3156 m | +0% | ✅ idéntico a 2025 |
| 36 | Los Negritos | copiado | — | 4264 m | +0% | ✅ idéntico a 2025 |
| 37 | La Exaltación | compuesto | 3 | 3653 m | +3% | 🟡 ok (3 tramo(s) en recta) |
| 38 | Las Cigarreras | copiado | — | 4945 m | +0% | ✅ idéntico a 2025 |
| 39 | Montesión | compuesto | 1 | 4402 m | +19% | 🔴 revisar geometría |
| 40 | La Quinta Angustia | copiado | — | 2755 m | +0% | ✅ idéntico a 2025 |
| 41 | El Valle | copiado | — | 2818 m | +0% | ✅ idéntico a 2025 |
| 42 | Pasión | copiado | — | 2539 m | +0% | ✅ idéntico a 2025 |
| 43 | El Silencio | copiado | — | 2813 m | +0% | ✅ idéntico a 2025 |
| 44 | El Gran Poder | copiado | — | 4162 m | +0% | ✅ idéntico a 2025 |
| 45 | La Macarena | compuesto | 12 | 5227 m | -6% | 🟡 ok (12 tramo(s) en recta) |
| 46 | El Calvario | copiado | — | 2726 m | +0% | ✅ idéntico a 2025 |
| 47 | Esperanza de Triana | compuesto | 12 | 5494 m | +6% | 🟡 ok (12 tramo(s) en recta) |
| 48 | Los Gitanos | compuesto | 3 | 4503 m | +2% | 🟡 ok (3 tramo(s) en recta) |
| 49 | La Carretería | copiado | — | 3258 m | +0% | ✅ idéntico a 2025 |
| 50 | Soledad de San Buenaventura | copiado | — | 3017 m | +0% | ✅ idéntico a 2025 |
| 51 | El Cachorro | copiado | — | 5426 m | +0% | ✅ idéntico a 2025 |
| 52 | La O | copiado | — | 4683 m | +0% | ✅ idéntico a 2025 |
| 53 | San Isidoro | copiado | — | 2519 m | +0% | ✅ idéntico a 2025 |
| 54 | Montserrat | compuesto | 2 | 3927 m | +30% | 🔴 revisar geometría |
| 55 | La Mortaja | copiado | — | 4334 m | +0% | ✅ idéntico a 2025 |
| 56 | El Sol | copiado | — | 7294 m | +0% | ✅ idéntico a 2025 |
| 57 | Los Servitas | compuesto | 3 | 3896 m | -0% | 🟡 ok (3 tramo(s) en recta) |
| 58 | La Trinidad | compuesto | 8 | 4783 m | -9% | 🟡 ok (8 tramo(s) en recta) |
| 59 | Santo Entierro | copiado | — | 2303 m | +0% | ✅ idéntico a 2025 |
| 60 | Soledad de San Lorenzo | copiado | — | 3422 m | +0% | ✅ idéntico a 2025 |
| 61 | La Resurrección | compuesto | 6 | 4806 m | +10% | 🟡 ok (6 tramo(s) en recta) |

**30** correctos (idénticos o compuestos limpios) · **25** ok con algún tramo en recta · **6** a revisar a mano.

## A revisar a mano

Recorridos con cambios mayores o varios tramos en recta; conviene repasarlos con el flujo
colaborativo de `componer-ruta.mjs` (como se hizo en 2025):

- **5. La Paz** — 29 tramo(s) en recta, Δ -18% vs 2025.
- **10. San Pablo** — 26 tramo(s) en recta, Δ -39% vs 2025.
- **26. Santa Cruz** — 3 tramo(s) en recta, Δ +16% vs 2025.
- **29. La Sed** — 11 tramo(s) en recta, Δ -23% vs 2025.
- **39. Montesión** — 1 tramo(s) en recta, Δ +19% vs 2025.
- **54. Montserrat** — 2 tramo(s) en recta, Δ +30% vs 2025.
