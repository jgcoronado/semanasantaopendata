# Rehecho de GeoJSON Jueves Santo / Madrugá 2025 (no editados)

Reconstrucción **desde cero** de los recorridos de las hermandades de Jueves
Santo y Madrugá que **no** estaban editadas a mano, con el mismo método que
`docs/rehacer-martes-miercoles-2025.md`.

Script: `scripts/rehacer-jueves-madruga.mjs` (mismo motor que
`rehacer-martes-miercoles.mjs`: itinerario oficial → Points; fragmentos
verificados del índice + curados → LineString, con inversión de coords según
sentido, guardas anti-`mala`/anti-bucle, y barrio = interior OSRM limpio o recta
marcada). No toca Lunes/Martes/Miércoles.

## Estado por hermandad

| Archivo | Points | Coords | Canónico | Rectas a trazar | Salto máx |
|---|---|---|---|---|---|
| 36-los-negritos | 38 | 111 | 55% | 5 | 299 m |
| 37-la-exaltacion | 34 | 100 | 62% | 5 | 201 m |
| 38-las-cigarreras | 41 | 109 | 43% | 12 | 479 m |
| 39-montesion | 27 | 86 | 56% | 4 | 429 m |
| 41-el-valle | 24 | 92 | **100%** | 0 | 72 m |
| 42-pasion | 20 | 58 | 75% | 1 | 226 m |
| 43-el-silencio | 26 | 85 | 50% | 4 | 187 m |
| 44-el-gran-poder | 30 | 91 | 35% | 11 | 572 m |
| 45-la-macarena | 38 | 87 | 21% | 15 | 837 m |
| 46-el-calvario | 20 | 69 | 57% | 3 | 199 m |
| 48-los-gitanos | 39 | 102 | 37% | 12 | 1010 m |

La cobertura canónica es baja en las de mucho barrio (La Macarena, Los Gitanos,
El Gran Poder, Las Cigarreras): esos tramos no los recorre ninguna hermandad
editada, así que no hay fragmento verificado del que tirar.

## Correcciones de Points detectadas (vs. estado anterior)

- **36-los-negritos**: arranque desordenado (San Esteban/Pilatos/Águilas/Alfalfa
  insertados mal cerca del inicio) y `Guadalupe` duplicada → reordenado al
  itinerario oficial.
- **38-las-cigarreras**: faltaba `Plaza del Triunfo` (salida sur a Puerta de
  Jerez) → añadido.
- **44-el-gran-poder** y **46-el-calvario**: faltaban `Plaza del Triunfo` y
  `Calle Fray Ceferino González` (vuelta grupo B) → añadidos.
- **45-la-macarena**: `Relator` duplicado al inicio y faltaba `Relator` en la
  vuelta → corregido.

## Pendiente: tramos en RECTA (trazar a mano)

Tramos de barrio sin fragmento verificado ni trazado OSRM limpio (recta entre
Points, necesitan trazado manual):

- **36-los-negritos**: Recaredo→San Agustín y bucle interior San Esteban/
  Pilatos/Águilas; Muro de los Navarros→Guadalupe→Recaredo.
- **37-la-exaltacion**: Santa Catalina→Gerona; Cristo de Burgos→Almirante
  Apodaca→Alhóndiga→Santa Catalina.
- **38-las-cigarreras**: bucle sur San Fernando→Catalina de Ribera→Cano y Cueto
  →Santa María la Blanca→San José→Jesús de la Salud→Ramón Ybarra→Muñoz y Pabón→
  Cabeza del Rey Don Pedro→Candilejo; Los Terceros↔Sol.
- **39-montesion**: Feria→Correduría; Cuna→Laraña.
- **42-pasion**: Javier Lasso de la Vega→Amor de Dios.
- **43-el-silencio**: El Silencio→Alfonso XII (ida y vuelta), Orfila→Fernando de
  Herrera.
- **44-el-gran-poder**: Arfe→Adriano→López de Arenas→Santas Patronas→Puerta de
  Triana→Gravina; Museo→San Vicente; Cardenal Spínola→San Lorenzo.
- **45-la-macarena**: todo el casco norte Macarena (Esperanza Macarena→Resolana→
  Feria→Relator, y la vuelta Relator→Parras→Escoberos→Fray Luis Sotelo→Resolana→
  Arco de la Macarena); Cristo de Burgos→San Pedro.
- **46-el-calvario**: San Pablo→Murillo→Magdalena→O'Donnell.
- **48-los-gitanos**: casco San Román (Señor de la Salud→Valle→Puerta del Osario
  →Matahacas→San Román→Peñuelas→Doña María Coronel→Dueñas); vuelta Cristo de
  Burgos→Almirante Apodaca y Ponce de León→Escuelas Pías→Pinto→Valle.

## Reproducir

```bash
node scripts/rehacer-jueves-madruga.mjs --dry-run   # informe
node scripts/rehacer-jueves-madruga.mjs             # escribe los 11 GeoJSON
```

El trazado OSRM de barrio se lee del commit `6d4b56c` (configurable con
`ORIG_REF`/`ORIG_DIR`).
