# Rehecho de GeoJSON Martes/Miércoles Santo 2025 (no editados)

Reconstrucción **desde cero** de los recorridos de las hermandades de Martes y
Miércoles Santo que **no** estaban editadas a mano, a partir del itinerario
oficial (Nómina 2025) y de los fragmentos de recorrido ya verificados en los
GeoJSON editados manualmente.

Script: `scripts/rehacer-martes-miercoles.mjs`
(usa `scripts/indice-tramos-canonicos.json`, regenerado con
`scripts/generar-indice-tramos.mjs`, + fragmentos curados de fuentes editadas).

## Qué hace

1. **Points** = itinerario oficial completo, una calle por entrada, en orden
   (ida → Carrera Oficial → vuelta). Respeta los pasos repetidos exactos de la
   Nómina (una calle no aparece más veces de las que figura en su recorrido).
   - Coords de calles compartidas: curadas (lado norte/sur de Álvarez Quintero,
     variante de Plaza del Duque, etc.).
   - Coords de calles de barrio: geocodificación OSRM del fichero original.
2. **LineString** = fragmentos canónicos verificados encadenados en el sentido
   del itinerario (emparejamiento por ventana de 2-8 calles, con inversión de
   coords cuando el tramo se recorre en sentido contrario). Guardas:
   - se descartan fragmentos de calidad `mala`;
   - se descartan fragmentos que trazan **bucles** (artefacto de rutas
     circulares, p.ej. el `Constitución→Plaza del Triunfo` de 59 coords de El
     Cerro);
   - los tramos de barrio sin fragmento verificado usan el interior OSRM
     original si es limpio, o una **recta** (marcada) entre Points.
3. El LineString pasa exactamente por cada Point (continuidad garantizada).

## Estado por hermandad

| Archivo | Points | Coords | Canónico | Rectas a trazar | Salto máx |
|---|---|---|---|---|---|
| 23-dulce-nombre | 29 | 93 | 50% | 5 | 410 m |
| 26-santa-cruz | 30 | 80 | 41% | 10 | 178 m |
| 27-el-carmen-doloroso | 32 | 83 | 24% | 13 | 377 m |
| 28-el-buen-fin | 30 | 94 | 33% | 8 | 410 m |
| 29-la-sed | 40 | 125 | 38% | 6 | 1173 m |
| 31-la-lanzada | 32 | 94 | 31% | 11 | 435 m |
| 32-el-baratillo | 25 | 73 | 46% | 7 | 310 m |
| 33-los-panaderos | 23 | 69 | 83% | 1 | 187 m |
| 34-cristo-de-burgos | 26 | 72 | 50% | 4 | 202 m |
| 35-siete-palabras | 26 | 81 | 55% | 5 | 188 m |

La cobertura canónica es baja en las que son mayoritariamente ruta de barrio
(Santa Cruz, Carmen Doloroso, La Sed, La Lanzada): esos tramos no los recorre
ninguna hermandad editada, así que no hay fragmento verificado del que tirar.

## Pendiente: tramos en RECTA (trazar a mano)

Estos tramos no tienen ni fragmento verificado ni trazado OSRM limpio; se han
dejado como recta entre Points y **necesitan trazado manual** sobre la calle:

- **23-dulce-nombre**: San Lorenzo→Cardenal Spínola, Cardenal Spínola→Gavidia,
  Orfila→Daoiz, Gran Poder→Conde de Barajas, Conde de Barajas→San Lorenzo.
- **26-santa-cruz**: todo el bucle de barrio Mateos Gago↔Rodrigo Caro↔La
  Alianza↔Romero Murube↔Plaza del Triunfo (ida y vuelta), Santo Tomás→Santander
  →Tomás de Ibarra.
- **27-el-carmen-doloroso**: Feria→Peris Mencheta→Mata→Belén→Alameda; Salvador→
  Córdoba→Lineros→Puente y Pellón→Encarnación; San Juan de la Palma→Madre María
  Purísima→Feria→Guadiana→Peris Mencheta→Feria.
- **28-el-buen-fin**: San Vicente→San Antonio de Padua→Marqués de la Mina→Alcoy
  →Eslava→San Lorenzo→Conde de Barajas→Gran Poder; Museo→San Vicente.
- **29-la-sed**: Cristo de la Sed→Eduardo Dato (1,1 km en recta — el original no
  cubría el arranque en Nervión), Eduardo Dato→Jiménez Aranda, Jiménez Aranda→
  Luis Montoto, Luis Montoto→José Luis de Casso, José Luis de Casso→Rico Cejudo.
  Points **omitidos** por no existir coord: Cardenal Lluch, Hospital de San Juan
  de Dios (bucle de salida).
- **31-la-lanzada**: San Martín→Saavedras→Alberto Lista→Conde de Torrejón→Marco
  Sancho→Correduría→Amor de Dios→Alameda; Trajano→Santa Bárbara→Gran Poder;
  San Andrés→Cervantes→San Martín.
- **32-el-baratillo**: Adriano→Pastor y Landero→Reyes Católicos→Puerta de Triana
  →San Pablo; Magdalena→Méndez Núñez→Plaza Nueva.
- **33-los-panaderos**: San Miguel→Trajano.
- **34-cristo-de-burgos**: Francos→Jesús de la Pasión→Alcaicería de la Loza→
  Alfalfa; Cristo de Burgos→San Pedro.
- **35-siete-palabras**: Cardenal Cisneros→Vera-Cruz; Alemanes→Hernando Colón→
  Plaza de San Francisco→Plaza Nueva; Duque→Alfonso XII.

## Reproducir

```bash
node scripts/generar-indice-tramos.mjs        # regenera el índice de fragmentos
node scripts/rehacer-martes-miercoles.mjs --dry-run   # informe
node scripts/rehacer-martes-miercoles.mjs             # escribe los 10 GeoJSON
```

El trazado OSRM de barrio se lee del commit `6d4b56c` (configurable con
`ORIG_REF`/`ORIG_DIR`).
