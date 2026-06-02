# Guía: añadir horarios oficiales de un nuevo año

Esta guía recoge todo lo necesario para incorporar los horarios oficiales de un año nuevo
(p. ej. 2027) al proyecto, partiendo de que los datos de nazarenos de ese año ya existen
(`src/data/nazarenos-AAAA.json` y su entrada en `anios.json`).

---

## 1. Años con horarios ya integrados

| Año | Script | JSON | Notas |
|---|---|---|---|
| 2026 | `scripts/generar-horarios-2026.mjs` | `src/data/horarios-2026.json` | Referencia original |
| 2025 | `scripts/generar-horarios-2025.mjs` | `src/data/horarios-2025.json` | CSV del Consejo; alias "javieres" y acento en "jesús despojado" |

### Ficheros compartidos (creados para 2026, reutilizados por todos los años)

| Fichero | Función |
|---|---|
| `scripts/generar-horarios-AAAA.mjs` | Script Node que convierte el CSV del Consejo en el JSON final |
| `src/data/horarios-AAAA.json` | Datos normalizados: 61 registros × 7 puntos horarios ("HH:MM") |
| `src/pages/[anio]/horarios/index.astro` | Página `/AAAA/horarios/` con tabla + 4 gráficas |
| `src/components/HorariosGraficas.astro` | Las 4 gráficas (Gantt, Ocupación CO, Dispersión, Duración) |
| `src/components/HorariosTabla.astro` | Tabla ordenable/filtrable de la página de horarios |

### Ficheros modificados

| Fichero | Qué cambió |
|---|---|
| `src/lib/datos.js` | `getHorariosAnio()`, `hayHorarios()`, `aniosConHorarios`, `fmtDur()` |
| `src/layouts/Base.astro` | Nav: año con horarios = desplegable (Nazarenos / Horarios) |
| `src/pages/[anio]/hermandad/[slug].astro` | Sección "Horario oficial AAAA" + enlace a `/AAAA/horarios/` |
| `src/styles/global.css` | `.itinerario`, `.dia-sig`, `.nav-dd`, `.nav-dd__panel`, `.leyenda-dias` |

---

## 2. Formato del JSON de horarios

`src/data/horarios-AAAA.json` — array de 61 objetos (uno por hermandad), ordenado por `idHdad`:

```json
[
  {
    "idHdad": 1,
    "salida":           "14:15",
    "campana":          "15:35",
    "sierpes":          "15:42",
    "plaza":            "16:15",
    "catedral":         "16:41",
    "ultimoPasoFuera":  "17:20",
    "entrada":          "18:30"
  },
  ...
]
```

- **`idHdad`** — id del catálogo maestro (`src/data/hermandades.json`).
- **7 puntos** siempre presentes: `salida`, `campana` (La Campana), `sierpes`, `plaza`
  (Plaza San Francisco), `catedral`, `ultimoPasoFuera` (último paso sale de Catedral),
  `entrada` (vuelta al templo).
- **Horas en "HH:MM"**, 00:00–23:59. Las horas >24:00 (procesiones de madrugada que entran
  pasada la medianoche) se escriben igualmente como "HH:MM" del día siguiente en el reloj
  (p. ej. "01:30"). `datos.js` detecta el cruce de medianoche automáticamente: cuando un
  punto horario en minutos es menor que el anterior, le suma 1440 min, manteniendo una línea
  de tiempo monótona.

---

## 3. Cómo obtener los datos del Consejo

El Consejo publica los horarios en su web en una tabla (una fila por hermandad) con estas
columnas: nombre, salida, campana, sierpes, plaza, catedral, último paso fuera, entrada.

### Proceso recomendado

1. **Copiar la tabla oficial** (o el PDF/Excel si lo publican) y convertirla a CSV con
   separador `;`:
   ```
   nombre;salida;campana;sierpes;plaza;catedral;ultimoPasoFuera;entrada
   sagrada entrada;14:15;15:35;...
   ```
2. **Verificar que los nombres** coinciden con el mapeo `idPorNombre` del script (ver
   sección 4). Si hay nombres nuevos o variantes (p. ej. "Las Tres Caídas" vs "San
   Isidoro"), añadir alias en el diccionario.
3. **Ejecutar el script** para generar el JSON final.

### Formato de hora que admite el script de 2026

El script acepta `H,M` con el minuto abreviado: `"17,2"` = 17:20, `"16,3"` = 16:30,
`"0,45"` = 00:45, `"22"` = 22:00. Si el CSV ya viene en `HH:MM`, ajustar el parser
(función `toHHMM`) o escribir el JSON directamente.

---

## 4. Crear el script `scripts/generar-horarios-AAAA.mjs`

Copiar `scripts/generar-horarios-2026.mjs` y:

1. **Actualizar el diccionario `idPorNombre`** si ese año hay hermandades nuevas, nombres
   distintos o ausencias. El dict mapea nombre (minúsculas, sin tildes) → `idHdad` del
   catálogo maestro. Las claves deben coincidir exactamente con lo que aparezca en el CSV
   del año (normalizado a minúsculas).

   > **Precaución 2026:** en Martes Santo el CSV del Consejo tenía invertidos los-javieres
   > y dulce-nombre respecto al orden del catálogo. El mapeo por nombre (no por posición)
   > lo corrigió automáticamente.
   >
   > **Precaución 2025:** el CSV usaba "javieres" (sin "los") y "jesús despojado" (con tilde).
   > Ambos se resuelven con alias en `idPorNombre`. Además, una celda de cerro venía con punto
   > decimal ("16.47") en vez de coma; el parser normaliza `.` → `,` antes de parsear.

2. **Pegar el CSV** como template literal en la variable `datos`.

3. **Ajustar la validación final**: `if (registros.length !== 61)` — cambia 61 por el
   número total de hermandades del año (si ese año procesionan menos o hay nuevas).

4. **Cambiar el nombre del fichero de salida** (última línea del script):
   ```js
   writeFileSync(new URL('../src/data/horarios-AAAA.json', import.meta.url), ...)
   ```

5. Ejecutar:
   ```powershell
   node scripts/generar-horarios-AAAA.mjs
   ```
   Si no lanza error, el JSON está generado.

---

## 5. Integración automática en el código

Una vez existe `src/data/horarios-AAAA.json`, **no hay que tocar nada más en el código**:

- `datos.js` lo descubre con `import.meta.glob('../data/horarios-*.json')` al hacer build.
- `aniosConHorarios` incluirá el nuevo año automáticamente.
- El nav mostrará el desplegable (Nazarenos / Horarios) para ese año.
- La ficha de cada hermandad de ese año mostrará la sección "Horario oficial AAAA".
- La página `/AAAA/horarios/` se genera sola (la ruta dinámica `[anio]/horarios/` itera
  sobre `aniosConHorarios`).

> **Único requisito previo:** que `src/data/nazarenos-AAAA.json` exista y su año esté en
> `src/data/anios.json`. Sin datos de conteo no se pueden calcular los "participantes/hora"
> ni el cruce con el scatter.

---

## 6. Flujo de trabajo PRE → producción

```
┌──────────────────────────────────────────────────────────────────────┐
│  Rama `pre`  →  URL estable de pruebas                               │
│  https://pre-semanasantaopendata.jaguerra27.workers.dev              │
└──────────────────────────────────────────────────────────────────────┘
```

### Pasos en cada sesión

```powershell
# 1. Situarse en pre
git checkout pre

# 2. Trabajar (generar JSON, ajustar script, etc.)

# 3. Commit y push (Cloudflare despliega en la URL de PRE automáticamente)
git add src/data/horarios-AAAA.json scripts/generar-horarios-AAAA.mjs
git commit -m "Horarios AAAA: añadir datos oficiales" --author="jgcoronado <jgcoronado@users.noreply.github.com>"
git push origin pre
```

> **Email de autor:** siempre `jgcoronado@users.noreply.github.com`. El email real del
> usuario está en privado en GitHub y rechaza el push si se usa directamente.

### Validar en PRE

Abrir en el navegador:
- `/AAAA/horarios/` → tabla y 4 gráficas.
- `/AAAA/hermandad/la-macarena/` → sección "Horario oficial AAAA" con itinerario.
- Nav cabecera: el año debe aparecer como desplegable con Nazarenos y Horarios.

### Pasar a producción (merge manual)

```powershell
git checkout main
git pull origin main
git merge pre --no-ff -m "Merge pre: horarios AAAA"
git push origin main
```

Cloudflare redespliega producción automáticamente. URL de producción:
**https://semanasantaopendata.jaguerra27.workers.dev**

---

## 7. Posibles ajustes visuales en HorariosGraficas.astro

El componente está preparado para cualquier número de días (itera `datos.dias`), pero la
codificación visual usa exactamente 5 colores y 9 símbolos. Si el nuevo año tiene los
9 días, no hay nada que cambiar. Si tiene menos días, tampoco (simplemente no aparecen).

La única excepción sería si se añadiese un año con 10+ días (hipotético), en cuyo caso
habría que ampliar `COLORES_5` y `SIMBOLOS_9` en el componente y en el frontmatter.

---

## 8. Resumen de comandos para una sesión típica

```powershell
# Desde c:\Users\usuario\Documents\semanasantaopendata

# 1. Generar el JSON
node scripts/generar-horarios-AAAA.mjs

# 2. Verificar que el build pasa
npm run build

# 3. Push a PRE
git checkout pre
git add src/data/horarios-AAAA.json scripts/generar-horarios-AAAA.mjs
git commit -m "Horarios AAAA: datos oficiales" --author="jgcoronado <jgcoronado@users.noreply.github.com>"
git push origin pre

# 4. (Tras validar en PRE) Pasar a producción
git checkout main
git merge pre --no-ff -m "Merge pre: horarios AAAA"
git push origin main
```
