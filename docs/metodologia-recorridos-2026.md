# Metodología para construir GeoJSONs de 2026 a partir de 2025

Este documento recoge las reglas y experiencia acumulada al corregir los 61 GeoJSONs
de 2025. Su propósito es guiar la construcción de los recorridos de 2026, que el
usuario pasará en modo texto (lista de calles por hermandad).

---

## Fuente de verdad y prioridad

**El LineString manda.** En cualquier conflicto entre la posición de un Point
(nombre de calle) y la geometría del LineString, confía en el LineString.
Los Points son etiquetas aproximadas; el LineString es el trazado real.

---

## Reglas de cambio año a año

### Lo que NO cambia (salvo aviso explícito)

| Elemento | Regla |
|----------|-------|
| **Punto de salida e entrada** | Siempre el mismo. No lo muevas aunque el texto no lo mencione expresamente. |
| **Carrera Oficial** | Inmutable. Siempre el segmento canónico `La Campana → Sierpes → Plaza de San Francisco → Av. de la Constitución → Cardenal Carlos Amigo`. Nunca tocar. |
| **Tramos de barrio consolidados** | Si una hermandad recorrió en 2025 Peris Mencheta→Mata→Belén, en 2026 probablemente repite. Parte de ese tramo y ajusta solo lo que el texto de 2026 cambie. |

### Lo que SÍ puede cambiar (pero raramente más de 1-3 calles)

- Una calle puntual añadida o eliminada por obras, itinerario alternativo o decisión de la Junta.
- Un pequeño desvío en el barrio.
- Si el cambio parece grande (más de 3-4 calles nuevas), vuelve a preguntar antes de asumir.

---

## Tramos de calle: el contexto importa

Una misma calle puede tener secciones completamente distintas:

- **Calle Feria** entre San Juan de la Palma y Castellar (barrio norte, hermandades
  que suben desde Encarnación) ≠ **Calle Feria** entre Resolana y Relator (entrada
  a la Macarena desde el norte).
- **Calle Álvarez Quintero** sección sur (Alemanes → Argote, ida canónica) ≠
  sección norte (Chapineros → Salvador, vuelta canónica).

**Regla**: para decidir qué tramo usa una hermandad, mira las calles adyacentes en
el itinerario (la anterior y la siguiente). El índice de segmentos canónicos
(`indice-tramos-canonicos.json`) ya resuelve esto automáticamente por contexto.

---

## Plazas: cruzarlas bien

Las plazas tienen múltiples trazados posibles (diagonal, bordeando, por el centro).
Aprende del contexto:

- **Plaza del Duque de la Victoria** — dos variantes según la siguiente calle:
  - Vía Trajano ("lado derecho", lon ≈ −5.9956): hermandades que llegan por Trajano.
  - Vía Gran Poder (lon ≈ −5.9960): hermandades que llegan por San Miguel/Gran Poder.
- **Plaza de San Francisco** — puede cruzarse hacia Sierpes (ida CO) o hacia
  Hernando Colón (doble carrera de Siete Palabras / Santo Entierro).
- **Plaza del Triunfo** — depende de si la hermandad sale por Fray Ceferino González
  (hacia el Arenal) o por Miguel Mañara/La Contratación (hacia Puerta de Jerez).
- **Alameda de Hércules** — se puede entrar por el norte (Resolana/Feria vía Relator)
  o por el sur (desde Correduría/Amor de Dios). El tramo recorrido varía mucho.

Siempre consulta `componer-ruta.mjs` con las calles adyacentes para elegir la
variante correcta.

---

## Calles que pueden omitirse

Algunas calles aparecen en la Nómina oficial pero en la práctica son un punto
de paso sin recorrido real (la hermandad llega y sale de inmediato):

- **Plaza Fernando de Herrera** entre Orfila y Daoiz — se puede omitir; el índice
  encadena directamente Orfila → Daoiz.
- **Calles muy cortas** entre dos calles ya encadenadas — si el índice tiene el
  tramo directo con buena calidad, no hace falta añadir el intermedio.

**Regla**: si añadir una calle no mejora el trazado (el segmento existente ya la
atraviesa de camino), no la incluyas como Point.

---

## Tramos no usados por ninguna otra hermandad

Es muy raro que una hermandad recorra un tramo de calle que ninguna otra usa.
Si al componer una ruta aparece un segmento sin cobertura en el índice:

1. Primero comprueba si hay una hermandad cercana (misma zona, mismo día) que sí
   pasa por ahí — es probable que el tramo exista en el índice bajo otro nombre.
2. Si el tramo realmente no existe, trázalo como recta entre los dos Points y
   márcalo como pendiente de edición manual.
3. No inventes coords intermedias a ciegas.

---

## Proceso para construir un GeoJSON de 2026

1. **Carga el recorrido de 2025** del mismo número de hermandad.
2. **Identifica los cambios** entre el texto de 2025 y el de 2026 (normalmente 0-3 calles).
3. **Construye la lista de calles** para 2026 (en orden, con el punto de
   salida/entrada repetido al final).
4. **Ejecuta `componer-ruta.mjs`** con esa lista para obtener el LineString.
5. **Revisa los tramos en RECTA** (sin cobertura canónica) — decide si son
   aceptables o requieren edición manual.
6. **Verifica el punto de salida/entrada** — debe coincidir con 2025.
7. **Confirma la Carrera Oficial** — debe ser idéntica a todos los demás.

```bash
node scripts/componer-ruta.mjs "Calle A" "Calle B" "Calle C" ...
```

---

## Estadísticas del índice canónico (jun 2026 — base 61 GeoJSONs)

| Métrica | Valor |
|---------|-------|
| GeoJSONs fuente | 61 (todos los de 2025) |
| Segmentos totales | 3860 |
| Pares (2 calles) | 465 |
| Triples (3 calles) | 506 |
| Largos (4-8 calles) | 2889 |
| Calidad buena | 2230 |
| Calidad regular | 1313 |
| Calidad mala | 317 |
| Calles conocidas | 297 |

Con 297 calles indexadas y 2230 segmentos de buena calidad, prácticamente todo
el callejero de la Semana Santa sevillana está cubierto. Los segmentos de calidad
mala (317) no se usan al propagar — se sustituyen por línea recta entre Points.

---

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `scripts/indice-tramos-canonicos.json` | Índice de todos los segmentos canónicos |
| `scripts/componer-ruta.mjs` | Compone un LineString dado una lista de calles |
| `scripts/generar-indice-tramos.mjs` | Regenera el índice (ejecutar tras editar GeoJSONs) |
| `docs/geojson-editados-manualmente.md` | Qué aporta cada GeoJSON de 2025 |
| `scripts/geojson-2025/` | Los 61 GeoJSONs fuente verificados |
