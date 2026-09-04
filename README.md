# ManaShelf

> Beta vigente para testing: **v2.5.27-beta**.

ManaShelf es una herramienta local-first para explorar una colección de Archidekt, analizar mazos Commander y generar recomendaciones basadas en la colección, Scryfall y EDHREC.

## Acceso Archidekt
- Colección pública: solo usuario, sin contraseña.
- Colección privada: login de Archidekt. La contraseña se envía al bridge de autenticación configurado para obtener la sesión; ManaShelf no la persiste en su caché local.
- Logout local.
- Los datos privados requieren login; los públicos no.

## Privacidad y red
- En ejecución local, el servidor escucha únicamente en `127.0.0.1`; no se publica en la red local.
- En hosting con `NODE_ENV=production` (por ejemplo Render), escucha en `0.0.0.0` para que el proxy de la plataforma pueda alcanzarlo. El puerto siempre se toma de `PORT` cuando está definido.
- La colección pública se consulta sin contraseña.
- Para colección privada, la contraseña se envía al bridge de autenticación configurado para obtener una sesión de Archidekt. ManaShelf no persiste la contraseña en su caché local.
- La sesión/token de Archidekt se mantiene en memoria durante la ejecución.
- ManaShelf guarda localmente cachés de metadata de mazos y cartas para reducir llamadas repetidas a Archidekt y Scryfall.

## Explorar + Mejorar
Filtros estandarizados, todos con la forma “Mostrar …”:
- Mostrar disponibles
- Mostrar usadas / sin disponible
- Mostrar ya incluidas (solo Mejorar)
- Mostrar no poseídas
- Mostrar excluidas

Las no poseídas están ocultas por defecto y aparecen grisadas al mostrarlas.

## UX de cartas
- Una sola lectura de colección: `Tenés X · Y disponibles`.
- Se conserva `YA EN EL MAZO`.
- “libre” fue reemplazado por “disponible”.
- Vista Lista sin miniaturas.
- Commander clickeable para ampliar imagen + texto Oracle.

## Mazos
- Selector buscable y ordenable.
- Usa mainboard cacheado para mostrar conteos sin Sideboard/Maybeboard.
- Commander y arte en el selector cuando la sync ya lo identificó.
- Links directos a Archidekt.

## Nuevas herramientas
- Roles: Ramp, Draw, Removal, Board Wipes, Protection, Counterspells, Recursion, Finishers.
- Shortlist persistente.
- Exclusiones personales persistentes.
- Buscar alternativa disponible.
- ADD/CUT heurístico.
- Asistente para completar a 100.
- Exportar TXT.
- Ranking de hasta 20 Commanders que poseés.
- Comparar dos Commanders.
- Historial local de análisis.
- Dashboard inicial.
- Crear un deck de Commander en Archidekt con confirmación explícita.
- Agregar shortlist al deck seleccionado con confirmación explícita.

## Seguridad de escrituras
ManaShelf no modifica Archidekt silenciosamente. Antes de crear o agregar cartas se muestra confirmación en la UI y el backend exige además `CONFIRMAR`.

## Ejecutar
Linux:
```bash
./abrir-manashelf.sh
```

Windows:
doble click en `Abrir ManaShelf.bat`

Manual:
```bash
node server.mjs
```
y abrir http://127.0.0.1:3000

### Deploy en Render / hosting
ManaShelf usa `process.env.PORT` y, cuando `NODE_ENV=production`, se enlaza a `0.0.0.0`. Para otros entornos se puede definir `HOST` explícitamente. En local conserva `127.0.0.1` por defecto.

## Nota sobre datos públicos
Sin autenticación ManaShelf puede leer la colección y decks públicos, pero no conoce uso privado ni puede escribir en la cuenta.


## v2.0.1 — hotfix ranking
- `Rankear mis Commanders` ya no usa `/api/search-owned` del bridge como paso obligatorio.
- Toma la colección ya cargada en ManaShelf.
- Usa Scryfall para encontrar Commanders que realmente poseés, ordenados por popularidad EDHREC.
- Se detiene al encontrar 20 candidatos para limitar requests.
- EDHREC se consulta después para calcular el score.
- Si falla un Commander individual en EDHREC, se omite ese candidato en vez de abortar todo el ranking.
- Mensajes de error específicos: ya no dice “sincronizar mazos” para este problema.


## v2.1 — buildability + collection count correction

### Collection count
The primary collection number is again the raw result count reported by Archidekt (`totalRows` on the private export).
ManaShelf still groups identical card names internally, but that secondary number is explicitly labeled `nombres de carta agrupados` and is no longer presented as the collection total.

Private imports still validate parsed CSV rows against Archidekt `totalRows`; if the export is incomplete ManaShelf aborts instead of silently showing a partial collection.

### ¿Qué Commander puedo armar?
Two paths:
1. Search one specific Commander with autocomplete and analyze only that one.
2. Explicitly rank every Commander ManaShelf detects in the owned Archidekt collection.

Ownership always comes from the already imported Archidekt collection. Scryfall is only used as a cached catalog of all legal Commander cards; it does not decide what the user owns.

### Comparar para construir
Both Commander selectors now use the same autocomplete as Explore.
The comparison explains own recommendations, available copies, occupied copies and missing cards, then states which option better uses the current collection. It is not a power-level comparison.

## v2.2 LAB
- Explorar: filtros simplificados a `Todas / Las que tengo / Disponibles`. Las no poseídas se ven grisadas dentro de Todas.
- Se eliminó la funcionalidad `No recomendar / Excluidas`.
- `Ver alternativa disponible` busca otra recomendación EDHREC disponible en la categoría.
- Se eliminó Comparar Commanders.
- Selector de mazos: autocomplete; ya no despliega todos los mazos permanentemente.
- Vista Lista sigue sin imágenes. El stock sobre la carta vuelve en vista visual/thumbnail. `YA EN EL MAZO` conserva su badge multicolor.
- Nuevo modo `LAB`, visualmente ámbar y solo lectura.
- LAB incluye Deck Health, Theme Health y sugerencias ADD candidatas disponibles.
- Cada cálculo/recomendación del LAB tiene un indicador `i`: no se hace click; hover/foco muestra metodología, consideraciones y limitaciones.
- El LAB no escribe ni modifica Archidekt.

## v2.2.1
- Corrige un error de JavaScript en Explorar Commander introducido al retirar el filtro `No tengo`.
- Análisis muestra etapa, tiempo transcurrido y progreso indeterminado honesto mientras espera EDHREC/Scryfall.
- Selector de mazos abre al foco/click, filtra al escribir y usa scroll interno.
- El conteo visible se hidrata desde `/api/deck-detail`, que respeta `includedInDeck` y excluye categorías fuera del mainboard.
- `scrollbar-gutter: stable` y transición CSS reducen saltos de layout al abrir listas/login.
- Deck Health reducido a Maná, Card Advantage, Interacción y Curva.
- Huecos contextuales separados (graveyard hate, wipes, protección) con explicación de por qué revisar cada ausencia.
- Theme inferido exige señales funcionales/densidad y pondera el texto del Commander; un tipo de permanente por sí solo no define theme.
- Sugerencias del LAB rediseñadas para legibilidad e indican tipo de inclusión, categoría EDHREC y sinergia.
- Tooltips `i` explican inputs, valor observado, rango/criterio y limitaciones.

## v2.2.2
- `Size` de Archidekt es la fuente canónica para el tamaño visible del mazo. Incluye Commander/s y no suma Sideboard/Maybeboard.
- El sync ya no reemplaza `Size` con un conteo derivado del cache de cartas.
- El uso cruzado ignora Sideboard/Maybeboard explícitos al calcular copias comprometidas.
- Filtros exclusivos: Todas / En stock / Disponibles. `YA EN EL MAZO` permanece visible.
- La disponibilidad en Mejorar se calcula contra otros mazos, sin tratar el deck actual como “otro mazo”.
- Stock/uso en otros decks se concentra sobre la carta en vista visual; se elimina la duplicación debajo.
- Selector de mazos muestra `Size` directamente.
- Al seleccionar un mazo aparece deck list lateral sin imágenes, ordenable por tipo, categoría, MV o nombre, con preview al hover.
- Deck Health permite auditar los grupos detectados filtrando esa deck list.
- Las tierras no cuentan como Ramp solo por producir maná.
- ¿Qué Commander puedo armar? ahora muestra las secciones EDHREC con las recomendaciones que ya están en la colección.

## v2.2.3
- Hotfix de runtime: se agregan las referencias DOM faltantes del inspector lateral de `Mejorar mi mazo`.
- Ese error abortaba `app.js` al iniciar y dejaba sin handlers a Explorar, ranking y LAB.
- Los bindings de los selectores laterales ahora son defensivos para que un panel opcional faltante no detenga toda la aplicación.
- Validación adicional: ejecución completa de `app.js` contra un DOM simulado basado en los IDs reales y smoke tests de los flujos Explorar, selección de mazo, ranking específico/masivo y LAB.

## v2.3.0 — General
- Explorar/Mejorar conservan estado, filtros, resultados y selección al cambiar de modo; solo se reinician al elegir explícitamente otro Commander/deck.
- Los contadores de secciones EDHREC ahora reflejan la intersección de filtros activos (`visibles / total EDHREC`).
- Resumen de recomendaciones reorganizado para distinguir total, en stock, disponibles, sin copia disponible y no poseídas; “usadas en mazos” queda como dato superpuesto y explicado.
- Mejorar inicia sin filtro de rol ni estado preseleccionado más allá de `Todas`.
- La decklist lateral reserva espacio real a la derecha y deja de superponerse al contenido; muestra tipo de carta y CMC.
- `MV` fue reemplazado por `CMC` en la interfaz.
- Roles como Ramp/Draw/Removal/Finisher quedan identificados como inferencias de ManaShelf basadas en tipo/texto Oracle de Scryfall; las secciones del catálogo se etiquetan como EDHREC.
- LAB: Theme muestra “N cartas detectadas”, permite click para filtrar exactamente esas cartas y usa explicaciones metodológicas en la `i`.
- LAB: inclusiones sugeridas más compactas y con preview grande al hover.
- “Qué tan cerca estás”: secciones EDHREC muestran miniaturas, cantidad que tenés, disponibilidad, tipo, CMC y preview grande.
- Todos los campos principales de texto incorporan botón circular `×` para limpiar.
- Ranking masivo usa un job con progreso real (`actual / total`) y reutiliza caché local.
- El catálogo de Commanders es offline-first: un caché existente se usa aunque tenga antigüedad; ante 429/error de Scryfall se conserva el último catálogo válido.
- Scryfall usa throttling, respeta `Retry-After` y conserva datos válidos si un refresh falla.
- EDHREC ahora también tiene caché persistente en disco.
- Panel “Administrar caché” con recache selectivo de Decks Archidekt, Uso de cartas, Scryfall, Catálogo de Commanders, EDHREC o Todo; cada trabajo muestra progreso.
- `.manashelf-cache` sigue siendo portable entre versiones. Los formatos compatibles se reutilizan.

## v2.3.1 — Correcciones de datos y UX
- Size ya no confía en el `size` bruto del endpoint: se calcula con la categoría primaria de cada carta y `includedInDeck`, incluyendo Commander/s y excluyendo Sideboard/Maybeboard.
- El detalle del deck muestra un pequeño audit de cartas excluidas y, si difiere, el valor bruto informado por la API.
- `En stock` pasa a `En Colección`; `Rol ManaShelf` y `Ordenar por` quedan visualmente separados.
- Stock se expresa como `Disponible X/Y` y vuelve el detalle de mazos que usan cada carta, con links directos a Archidekt.
- Alternativas funcionales: solo usa candidatos de `Similar` de EDHREC que además estén disponibles en tu colección. Si EDHREC no ofrece una coincidencia útil, no inventa una.
- ¿Qué Commander puedo armar?: universo limitado a criaturas legendarias Commander-legales de tu colección; Top 10 por cantidad absoluta de recomendaciones EDHREC que ya poseés.
- Detalle de buildability: toggle `Mostrar solo cartas con copia disponible`.
- Imágenes principales/previews usan Scryfall `normal` cuando está cacheado.
- Decklist lateral usa solo tipo principal (Creature, Artifact, Instant, Sorcery, Land, etc.), sin Legendary ni subtipos.
- Recomendaciones LAB ahora distinguen motivos: corregir carencia, alta sinergia EDHREC, reforzar rol o recomendación EDHREC general.
- Administración de caché usa `Actualizar` / `Borrar` por sección y para todo.
- Fix bloqueante del ranking: el job usa un helper de Commanders poseídos definido en scope global.

## v2.3.2 — Descubrimiento y comparación acotada
- El ranking masivo fue reemplazado por Descubrir Commanders, limitado a criaturas legendarias Commander-legales de la colección.
- Comparación manual de 2 a 5 Commanders: EDHREC se consulta solo para los seleccionados.
- Explorar muestra si el Commander está en colección y cantidad poseída.
- Mejorar puede ocultar cartas ya incluidas (activo por defecto); una carta ya incluida no se etiqueta como "disponible" para el mismo mazo.
- Selector de mazos hidrata Commander cuando falta para permitir buscar por nombre de Commander.
- Dropdowns se cierran con click afuera/Escape.
- Deck Health usa inspector fijo a la derecha como Mejorar.
- Theme distingue Theme principal, Mecánica de soporte y Señal secundaria; Infect/Poison tiene anclas propias y Proliferate se trata como soporte cuando corresponde.

## v2.3.3 — Size canónico + EDHREC Tags
- Size visible usa primero `session.decks[].size`, el valor canónico del catálogo de Archidekt. Puede ser 87, 100, 103, etc.; Sideboard/Maybeboard no se suman.
- El particionado de cartas excluye Sideboard/Maybeboard aunque esa categoría sea secundaria, no solo la primera.
- Deck Health solo propone themes que EDHREC etiqueta para ese Commander; ManaShelf ordena esos tags según evidencia del deck real.
- Catálogo completo de Tags EDHREC en Descubrir, con multi-selección AND.
- Selección visual circular en las tarjetas; comparación de 2 a 10.
- Galería colapsable y se colapsa automáticamente al terminar una comparación.
- Cierre uniforme de resultados parciales con click afuera o Escape.

## v2.4.1 — Size aislado y UX de descubrimiento
- El cálculo de Size vive en `lib/archidekt-size.mjs` y usa únicamente la categoría primaria de cada carta + `includedInDeck`.
- `payload.size` y el size del catálogo quedan solo como diagnóstico; nunca gobiernan el Size visible.
- Los selectores de mazo muestran `Size · …` hasta recibir el conteo auditado; no muestran un valor bruto potencialmente contaminado por Sideboard.
- Suite aislada cubre 100+17 Sideboard, mazos de 87, mazos de 103, Maybeboard y respuestas sin `category`.
- El filtro de Tags usa el catálogo temático completo incluido en ManaShelf; no muestra las etiquetas de navegación `Theme`/`Typal`.
- Selector circular más chico abajo a la derecha.
- Análisis EDHREC entra en vista enfocada y oculta la galería.
- Comparar aparece flotante solo con 2–10 seleccionados y el resultado es una grilla comparativa detallada.
- El botón de caché ahora dice `Caché · Actualizar / Borrar`.


## v2.4.1 — Size validado + Discovery más claro
- **Deck Size usa exclusivamente el Método 6 validado con mazos reales:** `categories[0]` es la categoría primaria; `Sideboard` y `Maybeboard` no se cuentan; el resto suma `quantity`.
- `payload.size`, el tamaño de catálogo y `includedInDeck` ya no deciden el Size visible.
- “Ocultar ya en el mazo” está junto a los demás filtros y sigue activo por defecto en Mejorar.
- Descubrir Commanders muestra pocos tags por defecto, incorpora buscador de tags, chips de tags activos y `Ver todos los tags`.
- La galería de Commanders tiene encabezado y acción de mostrar/ocultar mucho más visibles.
- Deck Health evalúa 8 reglas estructurales y muestra todas las recomendaciones que apliquen: Ramp, Card Advantage, Interacción, Graveyard hate, Board wipe, Protección/resiliencia, Tierras/base de maná y Recursión.


## v2.4.1
- Lectura pública de colección por username mediante perfil público + export v2 validado.
- LAB con secciones visualmente encapsuladas y numeración 01–05.
- Nuevo resumen visual de tierras, ramp, card advantage, interacción, board wipes, CMC y fundamentos sin alertas.
- Mantiene las 8 reglas estructurales existentes, incluyendo graveyard hate, board wipe, protección, base de maná y recursión.
- Method 6 de Size permanece sin cambios.


## v2.4.1
- Errores globales convertidos en toast superior temporal con cierre manual y auto-dismiss.
- LAB limpia resultados viejos antes de un nuevo análisis para evitar datos stale detrás de un error.
- Dashboard LAB corregido: Tierras, Ramp, Card Advantage, Interacción, Board Wipes y CMC reciben datos reales del backend.
- `Commanders de tu colección` muestra progreso real durante la carga de metadatos Scryfall.
- Comparación de Commanders usa todo el ancho disponible y alinea imagen, nombre, métrica principal y bloques estadísticos.


## v2.4.1
- Deck Health integrado dentro de Mejorar mi mazo usando el mismo deck seleccionado; el LAB independiente se conserva como fallback.
- Health estructural local ya no cae completo si EDHREC responde 403: Themes/Inclusiones degradan de forma explícita mientras estructura y curva siguen disponibles.
- Curva de maná visual agregada al resumen de Health.
- Selector del LAB rediseñado para seguir la jerarquía visual de Mejorar, con Commander y Size alineados.
- Autocomplete de mazos muestra todos los matches dentro de un viewport de cuatro filas con scroll.
- `Ocultar ya en el mazo` pasa a `Ya en el mazo`.
- Ajustes para mantener estable la superficie visual al mostrar/ocultar Commanders.


## v2.4.1
- Dashboard Health compactado: curva de maná más baja y composición por tipo primario lado a lado.
- Tipografía de Salud estructural rejerarquizada: el eje es el título y Bajo/Adecuado pasa a estado secundario.
- Primera versión de Cut Score contextual e IN → OUT.
- Los cortes protegen roles estructurales ajustados y priorizan cartas caras, con baja evidencia temática o sin rol prioritario.
- Si no existe evidencia suficiente, ManaShelf muestra `No encuentro un corte claro`.


## v2.4.1 — consolidación UX + performance

- **Mejorar mi mazo** vuelve a tener una sola acción explícita: `Analizar mazo`. Seleccionar un deck no dispara Health/EDHREC automáticamente.
- Después del análisis se navega con tabs: `Resumen`, `Salud`, `Recomendaciones`, `Cambios`.
- El catálogo inicial de mazos deja de hidratar uno por uno los Commanders faltantes. El detalle completo se carga sólo al seleccionar un mazo.
- Deck Detail y Deck Health se reutilizan dentro de la sesión; Health se invalida si cambia la firma del deck.
- Scryfall serializa los batches compartidos para evitar requests duplicadas entre pantallas concurrentes.
- Discovery reutiliza Commanders ya calculados en la sesión y tiene fallback al endpoint directo si falla el job de progreso.
- Curva de maná rehecha como histograma compacto apilado `Creature / Otras`, con click para auditar ese CMC.
- Donut de tipos proporcional real, con segmentos según cantidades reales y click por tipo para filtrar la decklist.
- KPIs de Resumen y reglas estructurales son auditables desde la decklist lateral.
- `Ordenar por` queda visible en la decklist lateral: Tipo, Categoría, CMC o Nombre.
- Salud estructural rejerarquizada: el nombre de la métrica domina y el estado es un badge secundario.
- IN → OUT usa una fila de decisión a ancho completo en lugar de cards paralelas.
- Se eliminó el cambio de fondo ligado al colapso de `COMMANDERS DE TU COLECCIÓN`.
- Method 6 de Size permanece sin cambios.
