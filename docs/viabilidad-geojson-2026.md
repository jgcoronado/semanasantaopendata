# Viabilidad de generar los GeoJSON de 2026 desde fragmentos canónicos de 2025

Para cada cofradía de 2026 se evalúa qué parte del recorrido puede componerse con
**fragmentos canónicos de 2025** (pares de calles consecutivas ya presentes en los 61
GeoJSON de 2025 / en el índice `scripts/indice-tramos-canonicos.json`) y qué parte
requiere **trazar a mano** (pares de calles nuevos, o calles que no existen en el
callejero canónico de 2025).

La **Carrera Oficial** se considera siempre cubierta (es inmutable). Un *par nuevo* es un
tramo entre dos calles que ninguna hermandad recorría en 2025; suele necesitar dibujo manual.

> Generado automáticamente. Metodología: ver [docs/metodologia-recorridos-2026.md](metodologia-recorridos-2026.md).

| # | Hermandad | Calles | Pares nuevos | Calles desconocidas | Viabilidad |
|---|-----------|:---:|:---:|---|------------|
| 1 | La Borriquita | 18 | 2 | conteros | 🔴 requiere tramos a mano |
| 2 | La Cena | 28 | 4 | — | 🔴 requiere tramos a mano |
| 3 | Jesús Despojado | 30 | 0 | — | ✅ 100% fragmentos |
| 4 | La Hiniesta | 29 | 3 | santa marina | 🔴 requiere tramos a mano |
| 5 | La Paz | 46 | 15 | borbolla, cid, harinas, jimios, parroquia san sebastian, parroquia san sebastian san salvador | 🔴 requiere tramos a mano |
| 6 | San Roque | 37 | 0 | — | ✅ 100% fragmentos |
| 7 | La Estrella | 25 | 3 | parroquia san jacinto | 🔴 requiere tramos a mano |
| 8 | La Amargura | 23 | 2 | contero | 🔴 requiere tramos a mano |
| 9 | El Amor | 18 | 2 | conteros | 🔴 requiere tramos a mano |
| 10 | San Pablo | 58 | 6 | jose laguillo, perez hervas | 🔴 requiere tramos a mano |
| 11 | Redención | 34 | 3 | cardenal cervantes | 🔴 requiere tramos a mano |
| 12 | Santa Genoveva | 52 | 0 | — | ✅ 100% fragmentos |
| 13 | Santa Marta | 20 | 0 | — | ✅ 100% fragmentos |
| 14 | San Gonzalo | 33 | 0 | — | ✅ 100% fragmentos |
| 15 | Vera-Cruz | 20 | 0 | — | ✅ 100% fragmentos |
| 16 | Las Penas | 20 | 0 | — | ✅ 100% fragmentos |
| 17 | Las Aguas | 21 | 0 | — | ✅ 100% fragmentos |
| 18 | El Museo | 16 | 0 | — | ✅ 100% fragmentos |
| 19 | El Cerro | 56 | 14 | almonacid, buhaira, campamento, cardenal amigo vallejo, clara campoamor, cuesta bacalao, smo cristo salud | 🔴 requiere tramos a mano |
| 20 | San Esteban | 32 | 0 | — | ✅ 100% fragmentos |
| 21 | La Candelaria | 28 | 2 | nuestro padre jesus pasion | 🔴 requiere tramos a mano |
| 22 | San Benito | 30 | 0 | — | ✅ 100% fragmentos |
| 23 | Dulce Nombre | 25 | 2 | delgado | 🔴 requiere tramos a mano |
| 24 | Los Javieres | 21 | 0 | — | ✅ 100% fragmentos |
| 25 | Los Estudiantes | 28 | 1 | — | 🟡 casi (1-2 tramos a mano) |
| 26 | Santa Cruz | 24 | 0 | — | ✅ 100% fragmentos |
| 27 | El Carmen Doloroso | 28 | 0 | — | ✅ 100% fragmentos |
| 28 | El Buen Fin | 26 | 0 | — | ✅ 100% fragmentos |
| 29 | La Sed | 41 | 5 | alejandro collantes, benito mas, prat | 🔴 requiere tramos a mano |
| 30 | San Bernardo | 44 | 0 | — | ✅ 100% fragmentos |
| 31 | La Lanzada | 27 | 2 | europa | 🔴 requiere tramos a mano |
| 32 | El Baratillo | 23 | 0 | — | ✅ 100% fragmentos |
| 33 | Los Panaderos | 20 | 0 | — | ✅ 100% fragmentos |
| 34 | Cristo de Burgos | 30 | 0 | — | ✅ 100% fragmentos |
| 35 | Siete Palabras | 22 | 0 | — | ✅ 100% fragmentos |
| 36 | Los Negritos | 33 | 0 | — | ✅ 100% fragmentos |
| 37 | La Exaltación | 32 | 0 | — | ✅ 100% fragmentos |
| 38 | Las Cigarreras | 41 | 0 | — | ✅ 100% fragmentos |
| 39 | Montesión | 24 | 0 | — | ✅ 100% fragmentos |
| 40 | La Quinta Angustia | 17 | 0 | — | ✅ 100% fragmentos |
| 41 | El Valle | 20 | 0 | — | ✅ 100% fragmentos |
| 42 | Pasión | 16 | 0 | — | ✅ 100% fragmentos |
| 43 | El Silencio | 22 | 0 | — | ✅ 100% fragmentos |
| 44 | El Gran Poder | 26 | 0 | — | ✅ 100% fragmentos |
| 45 | La Macarena | 36 | 4 | don fadrique, muro | 🔴 requiere tramos a mano |
| 46 | El Calvario | 16 | 0 | — | ✅ 100% fragmentos |
| 47 | Esperanza de Triana | 29 | 4 | plazuela santa ana, rodrigo triana, victoria | 🔴 requiere tramos a mano |
| 48 | Los Gitanos | 37 | 0 | — | ✅ 100% fragmentos |
| 49 | La Carretería | 22 | 0 | — | ✅ 100% fragmentos |
| 50 | Soledad de San Buenaventura | 19 | 0 | — | ✅ 100% fragmentos |
| 51 | El Cachorro | 25 | 0 | — | ✅ 100% fragmentos |
| 52 | La O | 31 | 0 | — | ✅ 100% fragmentos |
| 53 | San Isidoro | 14 | 0 | — | ✅ 100% fragmentos |
| 54 | Montserrat | 20 | 0 | — | ✅ 100% fragmentos |
| 55 | La Mortaja | 32 | 0 | — | ✅ 100% fragmentos |
| 56 | El Sol | 45 | 0 | — | ✅ 100% fragmentos |
| 57 | Los Servitas | 32 | 0 | — | ✅ 100% fragmentos |
| 58 | La Trinidad | 45 | 3 | — | 🔴 requiere tramos a mano |
| 59 | Santo Entierro | 13 | 0 | — | ✅ 100% fragmentos |
| 60 | Soledad de San Lorenzo | 25 | 0 | — | ✅ 100% fragmentos |
| 61 | La Resurrección | 26 | 0 | — | ✅ 100% fragmentos |

**43** componibles al 100% · **1** casi (1-2 tramos) · **17** requieren trabajo manual.

---

## Detalle de tramos nuevos por cofradía

Solo se listan las hermandades que necesitan algún tramo manual.

### 1. La Borriquita — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - alvarez quintero ↔ conteros
  - argote molina ↔ conteros
- **Calles no vistas en 2025 (verificar nombre / geometría):** conteros

### 2. La Cena — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - almirante apodaca ↔ capataz manuel santiago
  - duque victoria ↔ javier lasso vega
  - angel maria camacho ↔ cuesta rosario
  - boteros ↔ cristo burgos

### 4. La Hiniesta — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - ferre ↔ san pedro
  - dona maria coronel ↔ san pedro
  - santa marina ↔ senor resurreccion
- **Calles no vistas en 2025 (verificar nombre / geometría):** santa marina

### 5. La Paz — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - parroquia san sebastian ↔ san salvador
  - borbolla ↔ brasil
  - borbolla ↔ covadonga
  - cid ↔ isabel catolica
  - cid ↔ palos frontera
  - ministro indalecio prieto ↔ santo tomas
  - harinas ↔ puerta arenal
  - harinas ↔ jimios
  - jimios ↔ joaquin guichot
  - joaquin romero murube ↔ miguel manara
  - cid ↔ palos frontera
  - cid ↔ isabel catolica
  - borbolla ↔ covadonga
  - borbolla ↔ brasil
  - parroquia san sebastian san salvador ↔ rio plata
- **Calles no vistas en 2025 (verificar nombre / geometría):** borbolla, cid, harinas, jimios, parroquia san sebastian, parroquia san sebastian san salvador

### 7. La Estrella — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - pages corro ↔ parroquia san jacinto
  - altozano ↔ pages corro
  - fray ceferino gonzalez ↔ muralla alcazar
- **Calles no vistas en 2025 (verificar nombre / geometría):** parroquia san jacinto

### 8. La Amargura — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - alvarez quintero ↔ contero
  - argote molina ↔ contero
- **Calles no vistas en 2025 (verificar nombre / geometría):** contero

### 9. El Amor — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - alvarez quintero ↔ conteros
  - argote molina ↔ conteros
- **Calles no vistas en 2025 (verificar nombre / geometría):** conteros

### 10. San Pablo — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - ferre ↔ san pedro
  - padre jeronimo cordoba ↔ punonrostro
  - punonrostro ↔ valle
  - jose laguillo ↔ maria auxiliadora
  - jose laguillo ↔ perez hervas
  - perez hervas ↔ venecia
- **Calles no vistas en 2025 (verificar nombre / geometría):** jose laguillo, perez hervas

### 11. Redención — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - aponte ↔ duque victoria
  - cardenal cervantes ↔ san leandro
  - cardenal cervantes ↔ santiago
- **Calles no vistas en 2025 (verificar nombre / geometría):** cardenal cervantes

### 19. El Cerro — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - cardenal amigo vallejo ↔ virgen reyes
  - alemanes ↔ cardenal amigo vallejo
  - alemanes ↔ cuesta bacalao
  - cuesta bacalao ↔ francos
  - candilejo ↔ munoz
  - pabon ↔ san jose
  - demetrio rios ↔ santa maria blanca
  - almonacid ↔ gallinato
  - almonacid ↔ smo cristo salud
  - campamento ↔ smo cristo salud
  - campamento ↔ clara campoamor
  - buhaira ↔ clara campoamor
  - buhaira ↔ ramon
  - cajal ↔ hytasa
- **Calles no vistas en 2025 (verificar nombre / geometría):** almonacid, buhaira, campamento, cardenal amigo vallejo, clara campoamor, cuesta bacalao, smo cristo salud

### 21. La Candelaria — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - alcaiceria loza ↔ nuestro padre jesus pasion
  - nuestro padre jesus pasion ↔ villegas
- **Calles no vistas en 2025 (verificar nombre / geometría):** nuestro padre jesus pasion

### 23. Dulce Nombre — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - amor dios ↔ delgado
  - delgado ↔ trajano
- **Calles no vistas en 2025 (verificar nombre / geometría):** delgado

### 25. Los Estudiantes — 🟡 casi (1-2 tramos a mano)

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - carlos canal ↔ mendez nunez

### 29. La Sed — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - benito mas ↔ luis montoto
  - benito mas ↔ prat
  - prat ↔ rico cejudo
  - alejandro collantes ↔ goya
  - alejandro collantes ↔ cardenal lluch
- **Calles no vistas en 2025 (verificar nombre / geometría):** alejandro collantes, benito mas, prat

### 31. La Lanzada — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - conde torrejon ↔ europa
  - amor dios ↔ europa
- **Calles no vistas en 2025 (verificar nombre / geometría):** europa

### 45. La Macarena — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - escoberos ↔ muro
  - muro ↔ resolana
  - don fadrique ↔ resolana
  - arco macarena ↔ don fadrique
- **Calles no vistas en 2025 (verificar nombre / geometría):** don fadrique, muro

### 47. Esperanza de Triana — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - san jacinto ↔ victoria
  - rodrigo triana ↔ victoria
  - plazuela santa ana ↔ rodrigo triana
  - parroco don eugenio ↔ plazuela santa ana
- **Calles no vistas en 2025 (verificar nombre / geometría):** plazuela santa ana, rodrigo triana, victoria

### 58. La Trinidad — 🔴 requiere tramos a mano

- **Pares de calles sin fragmento canónico (trazar a mano):**
  - punonrostro ↔ valle
  - escuelas pias ↔ padre jeronimo cordoba
  - punonrostro ↔ valle

