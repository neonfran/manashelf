## v2.5.27-beta — compatibilidad Render sin exponer la instalación local
- [x] El servidor ya no fuerza `127.0.0.1` en todos los entornos.
- [x] Local/dev: `127.0.0.1` por defecto.
- [x] Producción (`NODE_ENV=production`, como Render): `0.0.0.0`.
- [x] Respeta `PORT` del hosting y permite override explícito con `HOST`.
- [x] Se mantiene la protección loopback para los launchers locales.

# ManaShelf backlog — v2.0


## v2.5.27-beta — navegación LAB/Improve sin solaparse
- [x] La build vuelve a identificarse explícitamente como BETA; no es release candidate ni release pública.
- [x] Los menús sticky de Improve y LAB ya no se superponen con sus Deck Lists: cuando el ribbon está activo, el drawer se apila debajo con altura de viewport recalculada.
- [x] LAB: el tab flotante `Reglas` pasa a `Estructura`; la sección `Recomendaciones estructurales` pasa a `Estructura del mazo`, y el copy visible usa `criterios` para describir mejor qué se evalúa.

## v2.5.22-beta — preview method validation + LAB navigation

- Deck-search Commander thumbnails now hydrate through the validated full Archidekt deck payload → `isPremier` → Scryfall path.
- Preview hydration is on-demand, retryable, cached, and shared by Improve + LAB.
- Improve no longer changes the main content width when the Deck List opens.
- LAB selected-deck actions follow the production layout more closely.
- LAB Deck Health now has sticky section navigation: Resumen / Salud / Reglas / Identidad / IN-OUT / Métricas.

## v2.5.15-beta — pre-release UI / reliability audit

- Commander thumbnails now recover when older Scryfall cache entries stored null images; Deck Detail exposes Commander images directly.
- LAB selected-deck panel reuses the production deck-summary layout, including Commander preview, Archidekt link, Analyze and Export actions.
- Deck List sort is a single compact dropdown with ascending/descending choices; header spacing, size alignment and top accent were polished.
- Improve analysis tabs use a viewport-floating mode so Deck Check / IN-OUT / EDHREComendaciones remain available consistently.
- Segmented theme bars use a single child-width renderer and fill strictly left-to-right.
- Visible internal/project-note copy was removed or rewritten for end users; confidence/status pills were centered.


## v2.5.13-beta — Deck Metrics Engine en LAB

- Se agregó `lib/deck-metrics.mjs`, un motor sin dependencias externas para las métricas del Technical Spec.
- El nuevo motor se ejecuta **solo cuando LAB pide `includeMetrics:true`**; Mejorar mazo sigue usando el Deck Health existente sin pagar el costo de simulación.
- Clasificación semántica determinística y cacheada en memoria por carta/Oracle/version.
- Scryfall cache ampliado con `manaCost` y `producedMana` (`metaVersion:3`).
- 18 familias de métricas implementadas: mana reliability, early development, resource flow, interaction density/coverage/efficiency, threat/payoff, engines, functional density, setup/payoff, consistency, synergy, dependency/bottlenecks, dead-card proxy, structural resilience, effective MV, turn of relevance, closing power y goldfish development.
- Simulador de desarrollo limitado a opening hand/London mulligan/land drops/ramp/fixing/setup/disponibilidad/casteabilidad; **no** simula oponentes, combate ni win rate.
- 5.000 simulaciones en LAB por análisis; resultado cacheado por el `healthCache` de sesión/deck signature/version.
- Nueva sección `07 · Deck Metrics Engine` en LAB con cards, coverage, simulación T1–T7, clasificación semántica y debug de heurísticas.
- Métricas heurísticas exponen menor confidence; no se promocionaron todavía a Deck Analysis/Deck Improvement.
- Pendiente de validación funcional con mazos reales antes de promoción a producción.


## Implementado
- [x] Colección pública sin login.
- [x] Colección privada con login.
- [x] Logout local.
- [x] Explorar Commander.
- [x] Mejorar mazo.
- [x] No poseídas en ambos modos, grisadas y ocultas por defecto.
- [x] Filtros estandarizados con “Mostrar …”.
- [x] “Disponible” en lugar de “libre”.
- [x] Vista lista sin imágenes.
- [x] Conteo de mazo sin Sideboard/Maybeboard cuando hay cache detallado.
- [x] Commander ampliable con texto Oracle.
- [x] Roles funcionales.
- [x] Shortlist.
- [x] Filtros disponible/ocupada/incluida/no poseída/excluida.
- [x] Búsqueda y orden de decks.
- [x] Commander/thumbnail en selector de decks cuando está disponible.
- [x] ADD/CUT heurístico.
- [x] Buscar alternativa disponible.
- [x] Exclusiones personales.
- [x] Ranking de Commanders construibles.
- [x] Asistente para completar a 100.
- [x] Exportar shortlist / decklist / recomendaciones.
- [x] Crear deck en Archidekt con confirmación.
- [x] Agregar shortlist a deck Archidekt con confirmación.
- [x] Historial local de análisis.
- [x] Comparar dos Commanders.
- [x] Dashboard de colección.

## Próximas mejoras de calidad
- [ ] Ajustar los clasificadores de roles con feedback real.
- [ ] Mejorar algoritmo ADD/CUT con curva de maná y distribución de tipos.
- [ ] Ranking exhaustivo opcional de todos los Commanders propios (v2.0 limita a 20 por eficiencia).
- [ ] Pruebas automáticas con fixtures reales anonimizados de Archidekt/EDHREC.
- [ ] Import/export JSON de preferencias locales.

## Hotfix v2.0.1
- [x] Eliminar dependencia del bridge `/api/search-owned` en ranking.
- [x] Ranking tolerante a fallos individuales de EDHREC.
- [x] Error específico para Scryfall/ranking.

## v2.1
- [x] Restaurar como número principal el total de resultados informado por Archidekt.
- [x] Etiquetar por separado nombres agrupados y copias.
- [x] Buscar un Commander específico sin rankear todos.
- [x] Autocomplete en búsqueda específica.
- [x] Ranking de todos los Commanders poseídos sin límite arbitrario de 20.
- [x] Catálogo completo de Commanders legales de Scryfall cacheado 7 días.
- [x] Comparación explicada como “cuál aprovecha mejor tu colección”.
- [x] Autocomplete en ambos lados de Comparar.

## v2.2 LAB
- [x] Filtros Explorar: Todas / Las que tengo / Disponibles.
- [x] Remover exclusiones / No recomendar.
- [x] Alternativas disponibles.
- [x] Remover Comparar.
- [x] Autocomplete de mazos sin lista permanente.
- [x] LAB aislado y visualmente diferenciado.
- [x] Deck Health contextual experimental.
- [x] Theme Health experimental.
- [x] Tooltips `i` explicando cálculos y limitaciones.
- [x] LAB solo lectura.
- [ ] Validar Deck Health/Theme Health con mazos reales del usuario antes de integrar al flujo estable.
- [ ] Diseñar CUT contextual después de validar la clasificación funcional; no se automatiza en LAB v2.2.

## v2.2.1
- [x] Corregir análisis de Explorar tras retirar showMissing.
- [x] Estado/progreso visible durante análisis.
- [x] Evitar salto por scrollbar.
- [x] Dropdown de mazos moderno con búsqueda y scroll interno.
- [x] Conteo exacto visible desde detalle Archidekt.
- [x] Transición liviana login → sesión conectada.
- [x] Rediseño UX de Deck Health.
- [x] Health estructural reducido.
- [x] Huecos contextuales (graveyard hate/wipes/protección).
- [x] Theme inference con Commander + densidad funcional.
- [x] Sugerencias legibles con tipo de inclusión.
- [ ] Validar inferencia de themes con mazos reales antes de integrar fuera del LAB.

## v2.2.2
- [x] Usar Archidekt Size como tamaño canónico del deck.
- [x] No derivar Size desde Sideboard/Maybeboard/cache.
- [x] Todas / En stock / Disponibles como estados exclusivos.
- [x] Mantener YA EN EL MAZO.
- [x] Quitar duplicación de stock/uso bajo la carta.
- [x] Deck list lateral ordenable con preview hover.
- [x] Health Check auditable contra cartas concretas.
- [x] Corregir Ramp para no contar tierras normales.
- [x] Mostrar secciones/cartas poseídas en buildability de Commander.
- [ ] Validar clasificación de Health/Theme con mazos reales del usuario.
- [ ] Progreso real del ranking masivo de Commanders.

## v2.2.3
- [x] Corregir crash global por referencias DOM faltantes del inspector de Mejorar.
- [x] Verificar que Explorar conserva handler de análisis.
- [x] Verificar selección/búsqueda de mazo en Mejorar.
- [x] Verificar ranking específico y masivo.
- [x] Verificar búsqueda/análisis LAB.

## v2.3.0 — completado
- [x] Contadores de categorías sensibles a filtros combinados.
- [x] Decklist lateral sin superposición, con tipo y CMC.
- [x] Persistencia de estado entre Explorar / Mejorar / Ranking / LAB.
- [x] Mejorar sin filtro inicial inesperado.
- [x] Diferenciar secciones EDHREC de roles heurísticos ManaShelf.
- [x] Ranking tolerante a caché viejo / Scryfall 429.
- [x] Ranking con progreso real.
- [x] “Qué tan cerca” con imágenes, counts por sección y hover grande.
- [x] Theme auditable y clickeable por cartas concretas.
- [x] Inclusiones sugeridas compactas con preview grande.
- [x] Botón × en campos de texto.
- [x] Información `i` orientada a método/criterio, no repetición.
- [x] Administración provisional de caché con recache selectivo y progreso.
- [ ] Validar clasificadores Theme/Roles contra más mazos reales.
- [ ] Sustituir panel manual de recache por política automática cuando el caché esté suficientemente maduro.

## v2.3.1
- [x] Auditar Size por categoría primaria Archidekt + includedInDeck.
- [x] Restaurar links de uso por mazo.
- [x] Disponible X/Y.
- [x] Alternativas funcionales basadas en EDHREC Similar.
- [x] Top 10 solo criaturas legendarias poseídas, ordenado por recomendaciones poseídas.
- [x] Toggle de cartas con copia disponible.
- [x] Actualizar/Borrar caché.
- [x] Tipo principal en decklist Health/Improve.
- [x] Mejorar variedad de motivos en inclusiones LAB.
- [ ] Enriquecer Theme con Tags/Themes/Kindred de EDHREC de forma estructurada cuando el JSON público exponga una interfaz estable.

## v2.3.2
- [x] Reemplazar ranking masivo por Descubrir Commanders.
- [x] Comparar 2–5 Commanders seleccionados.
- [x] Estado de propiedad en Explorar.
- [x] Ocultar cartas ya incluidas en Mejorar.
- [x] Corregir semántica de disponibilidad para cartas ya incluidas.
- [x] Buscar mazos por Commander además de nombre.
- [x] Cierre de dropdowns.
- [x] Deck Health lateral.
- [x] Theme principal / soporte / señales; ancla Infect/Poison.
- [ ] Generalizar anclas fuertes para más themes y contrastar con metadatos estructurados EDHREC.

## v2.3.3
- [x] Size canónico Archidekt, sin clamp a 100.
- [x] Regresión 100 + 17 Sideboard = Size 100.
- [x] Excluir Sideboard/Maybeboard aunque la categoría no sea primaria.
- [x] Theme restringido a Tags EDHREC del Commander y ordenado por evidencia local.
- [x] Catálogo completo de Tags EDHREC con fallback local.
- [x] Multi-tag en Descubrir.
- [x] Selector circular y comparación hasta 10.
- [x] Galería colapsable.
- [x] Cierre global de autocompletes.
- [ ] Seguir ampliando `edhrecTagEvidence` para tags raros; nunca promoverlos si no son Tags EDHREC del Commander.

## v2.3.4
- [x] Extraer motor de Size a módulo aislado.
- [x] Size por categoría primaria + includedInDeck.
- [x] No usar `payload.size`/catálogo como Size visible.
- [x] No mostrar conteos brutos en buscadores mientras se auditan.
- [x] Regresiones 100+17, 87+9, 103+4, fallback legacy.
- [x] Catálogo temático completo en filtros; eliminar `Theme`/`Typal` falsos.
- [x] Selector circular inferior derecho y más chico.
- [x] Vista enfocada al analizar con EDHREC.
- [x] Acción flotante de comparación y grilla comparativa.
- [x] Corregir borrado del cache Scryfall a `scryfall-images.json`.


## v2.4.1
- [x] Adoptar Método 6 de Archidekt Size validado con mazos reales (`categories[0]`).
- [x] Excluir Sideboard/Maybeboard y sumar `quantity` del resto.
- [x] Retirar `includedInDeck`, `payload.size` y tamaño de catálogo del cálculo visible.
- [x] Mover “Ocultar ya en el mazo” junto a los demás filtros de Mejorar.
- [x] Reducir ruido visual de Tags EDHREC: vista breve + búsqueda + expandir todos.
- [x] Mostrar tags seleccionados de forma separada y removible.
- [x] Dar jerarquía visual al bloque “Commanders de tu colección”.
- [x] Mantener galería colapsable con CTA claro y conteo visible.
- [x] Ampliar recomendaciones estructurales de 3 a 8 reglas evaluables.
- [x] Listar simultáneamente todas las recomendaciones estructurales aplicables.
- [ ] Live-test visual de v2.4.1 en navegador real con colección conectada.
- [ ] Validar Lord of Pain y Atraxa en Deck Health/Theme.
- [ ] Ampliar `edhrecTagEvidence` para tags raros sin salir del vocabulario EDHREC del Commander.
- [ ] Mejorar fallback del filtro multi-tag cuando EDHREC no está disponible.


## v2.4.1 follow-up
- Evaluar Cut Score contextual e interfaz IN → OUT para sugerir cartas a sacar sin romper roles estructurales.
- Validar visualmente el nuevo dashboard/jerarquía con mazos reales y ajustar o hacer rollback si corresponde.
- Considerar curva de maná gráfica detallada una vez validado el resumen compacto.


## v2.4.1 follow-up
- Validar visualmente toast global, progreso real de Commanders y comparación alineada.
- Si EDHREC sigue devolviendo 403 en LAB, agregar fallback/caché específico para que Deck Health no dependa de una única respuesta EDHREC.
- Cut Score / IN → OUT sigue pendiente.


## v2.4.1 follow-up
- Validar integración Deck Health dentro de Mejorar con mazos reales; mantener LAB hasta confirmar estabilidad.
- Validar fallback Health con EDHREC 403 real.
- Revisar visualmente el fondo de Descubrir al colapsar/expandir en Bazzite; rollback puntual si el navegador interpreta distinto `:has`.
- Evolucionar comparación a matriz de métricas perfectamente alineadas.
- Cut Score contextual e IN → OUT siguen pendientes.


## v2.4.1 follow-up
- Validar Cut Score / IN → OUT contra varios mazos reales y ajustar pesos antes de considerarlo estable.
- Mejorar el gráfico de tipos a segmentos proporcionales reales; v2.4.1 prioriza composición + leyenda auditable.
- Auditar clicks del gráfico de tipos contra la decklist lateral.
- Mantener rollback a v2.3.8 si Cut genera candidatos poco razonables.


## v2.4.1 follow-up
- Validar en cuenta real que `COMMANDERS DE TU COLECCIÓN` completa tanto por job como por fallback y medir tiempo en frío/caliente.
- Medir conexión inicial antes/después del catálogo barato y decidir TTL para una futura caché persistente de colección pública.
- Validar visualmente tabs, donut proporcional, histograma apilado y jerarquía de Salud en Bazzite/Firefox/Chromium.
- Validar Cut Score / IN → OUT con varios mazos reales; ajustar pesos sólo con evidencia.
- Evolucionar comparación de Commanders hacia una matriz de métricas si la comparación actual sigue siendo lenta de escanear.
- Mantener LAB independiente hasta confirmar estabilidad de Health integrado; luego retirarlo de navegación principal.

## v2.4.2 — medición real + fix de caché de mazos
- [x] Instrumentar `/api/login`, `/api/public-login`, sync de mazos y job de Commanders con `console.log("[timing] ...")` para medir sin depender de cronómetro manual del usuario.
- [x] Medido con cuenta real del usuario (55 mazos, 7432 filas de colección): login+export = 5023ms (no es el cuello de botella); deck-usage-sync en frío = 191046ms con `0 caché, 52 bajados, 3 fallidos`; deck-usage-sync repetido = 3161ms con `0 caché, 55 bajados, 0 fallidos`; owned-commanders en frío = 121260ms para 6243 nombres únicos.
- [x] Bug encontrado y corregido: `sameDeckVersion()` exigía `updatedAt` de Archidekt que la cuenta del usuario no siempre manda, por lo que la caché de mazos en disco nunca se usaba (0 caché en ambas corridas medidas). Ahora usa `size` como señal secundaria y confía en la caché existente si no hay ninguna señal comparable.
- [x] Guardado `size` en las 3 rutas que escriben `.manashelf-cache/decks-*.json`.
- [x] 7 casos unitarios aislados de `sameDeckVersion()` verificados (no requieren cuenta real).
- [ ] Validar con cuenta real que la 2ª conexión ahora muestra `caché` > 0 y tiempos menores.
- [ ] Investigar por qué 3 de 55 mazos fallaron en la corrida en frío — es probablemente el mayor contribuyente a los 191s por los reintentos con backoff; sin logs de error específicos todavía no se puede diagnosticar la causa.
- [ ] Evaluar pre-filtrar candidatos a Commander usando `card__types`/`card__supertypes` ya disponibles en el export de colección (pública) antes de consultar Scryfall para las 6000+ cartas, en vez de consultar Scryfall para toda la colección. Pendiente de decisión del usuario antes de implementar — afecta qué campos se piden en la exportación de colección privada, que hoy pide solo 5 campos mínimos.

## v2.4.3 — pre-filtro de Commanders + concurrencia en sync de mazos + correcciones
- [x] Validado en test lab aislado contra la cuenta real del usuario antes de tocar la app principal (ver ManaShelf-TestLab).
- [x] Headers reales de Archidekt confirmados contra respuesta real (no son los mismos que los campos que se piden en el POST): `Quantity, Name, Scryfall Oracle ID, Scryfall ID, Edition Code, Types, Sub-types, Super-types, Colors, Identities, Mana Value`.
- [x] `collection()` (privada) amplía los campos pedidos a Archidekt para incluir tipo/color/CMC (antes solo pedía 5 campos mínimos).
- [x] `publicCollection()` ya pedía estos campos pero los descartaba con `typeLine:null` hardcodeado; ahora los usa.
- [x] Nuevo helper compartido `typeLineFromRow()` reconstruye el typeLine estilo Scryfall a partir de las columnas separadas de Archidekt.
- [x] `ownedLegendaryCreatureCandidates()` pre-filtra localmente antes de llamar a Scryfall; las cartas sin tipo local (import viejo, dato faltante) van igual a Scryfall como red de seguridad, para no perder Commanders reales por un dato incompleto de Archidekt.
- [x] Bug encontrado de paso: `oracleId` buscaba el header `"Oracle ID"`, que no existe; el real es `"Scryfall Oracle ID"`. Corregido en `collection()` y `publicCollection()`. `scryfallId` en `publicCollection()` estaba hardcodeado a `null` pese a que la columna `"Scryfall ID"` ya viene en la respuesta; corregido.
- [x] `startDeckUsageSync()` (sync automático de mazos al conectar) cambia de secuencial (un mazo a la vez) a concurrencia acotada (5 en simultáneo), respaldado por medición real: 191s para 55 mazos secuenciales (ver v2.4.2). Probado de forma aislada con un pool simulado (20 tareas, algunas fallidas): procesa todas, respeta el límite de concurrencia, no corta por fallos individuales.
- [x] La escritura de `.manashelf-cache/decks-*.json` durante el sync automático pasa de "una vez por mazo" a "una vez al final del lote", para no multiplicar la escritura a disco.
- [ ] **NO se aplicó la misma concurrencia a `rebuildUsageFromDisk()` ni a `runCacheSection()` (recache manual)** — mismo patrón secuencial, pero el reporte de progreso está atado al índice del loop y cambiarlo requiere más cuidado. Queda pendiente, evaluar cuando haya evidencia de que también es lento en la práctica.
- [x] Revisión de código en busca de errores adicionales: no se encontraron otras instancias del mismo problema de nombres de columna fuera de las corregidas arriba.
- [ ] Revisión visual: NO se pudo hacer una validación visual real (sin navegador ni datos reales desde el entorno de desarrollo). Se hizo una revisión estática de CSS: 124 contenedores `flex`/`grid` contra solo 19 reglas `min-width:0`, y se mantiene el conteo de 247 `!important` ya señalado en v2.4.1/v2.4.2 sin resolver — no se tocó nada de esto sin evidencia de un bug visual concreto, sigue pendiente el P0-D del HANDOFF (capturas reales del usuario).
- [ ] Validar con cuenta real que el pre-filtro de Commanders reduce el tiempo de forma significativa y no pierde ningún Commander real (comparar cantidad encontrada antes/después).
- [ ] Validar con cuenta real que la sincronización de mazos concurrente no dispara más errores 429 que la versión secuencial.

## v2.4.5 — ribbon tabs, hover unificado, precálculo de Size, Salud visual, neón holístico
- [x] **Bug real confirmado por captura**: las tabs (antes Resumen/Salud/Recomendaciones/Cambios) flotaban rotas sobre el header. Causa: un bloque CSS entero ("v2.4.1 — alignment pass") las convertía a propósito en sidebar vertical (`grid-template-columns:1fr!important`) pensado para un contenedor que no existe donde se renderiza. Se eliminaron los 3 bloques `.improve-tabs` que competían entre sí y se reescribió desde cero en flujo normal (nunca `position:sticky`/`fixed`), estructuralmente imposible que vuelva a superponerse a algo.
- [x] Rediseño a 3 ribbons pedido por el usuario: **Deck Check** (Resumen + Salud combinados) → **SWAPS** (antes Cambios) → **EDHREComendaciones** (antes Recomendaciones). Tabs inactivas quedan atenuadas ("en otro plano"); la activa tiene el glow neón completo.
- [x] Gráfico de **Temáticas** agregado en el medio de Curva de maná y Tipos de carta dentro de Deck Check (barras horizontales por densidad %, clickeable, reutiliza el handler `data-theme-ref` ya existente).
- [x] **Sistema de hover unificado**: las 4 implementaciones distintas (deck list, EDHREComendaciones, construir, SWAPS) eran casi idénticas con posiciones distintas (`right:60px`, `right:325px`, `right:350px`...). Ahora es una sola clase `.hover-preview`, siempre centrada en pantalla (`left:50%;top:50%`), mismo tamaño y z-index en toda la app. Se sacó también el hover que se había agregado por error en v2.4.4 a las cartas de la grilla principal (ya son grandes, no tenía sentido — feedback directo del usuario).
- [x] **Precálculo de Size en el buscador de mazos.** Antes el tamaño real (Method 6) solo se calculaba bajo demanda por mazo. Ahora se precalcula en segundo plano apenas se conecta la cuenta (mismo endpoint validado de Archidekt, sin el enriquecido de Scryfall que no hace falta solo para el número), con un endpoint nuevo `/api/decks/sizes` que el frontend consulta cada 3s hasta completar.
- [x] Texto "Size se calcula con la categoría primaria de Archidekt…" eliminado de la UI (solo el texto; la lógica de Method 6 no se tocó).
- [x] Botón "Analizar mazo" ya no se mueve en hover (se había agregado un `transform` en v2.4.4 sin querer).
- [x] Progreso de "Commanders de tu colección" con mensajes más claros sobre qué se está midiendo en cada momento (antes mostraba números sin contexto que parecían contradictorios, ej. "x/451" durante la carga vs "600" al final — son métricas distintas: cartas nuevas a consultar en Scryfall vs. candidatos totales). Se sacó también la duplicación visual "600 600 Commanders".
- [x] **Salud estructural rediseñada**: medidores de barra reales con relleno degradado por nivel y marcador de "piso orientativo" (antes eran barras fijas de 4px sin relación visual con el valor real — se agregaron `refMin`/`refMax` al backend, aditivo, no toca ninguna lógica de decisión). Anillo visual para "Fundamentos X/8". Barras de densidad en las tarjetas de "Identidad del mazo", mismo estilo que el gráfico de Temáticas.
- [x] Pase de estética neón extendido a botones que habían quedado afuera en v2.4.4: `.dash-actions`, `.view-toggle`, `.discover-filters`/`.toggle-button`, `.discover-selected-tags`, `.deck-inspector-filter`, `.health-ref-row`, `.compare-chip`, más glow de foco en inputs/selects (`.control`, `.deck-tools input/select`, `.toolbar select`, `.compare-inputs`).
- [x] Limpieza de CSS muerto en el proceso: `!important` bajó de 255 (v2.4.4) a 216 tras consolidar tabs y hovers, y algo más tras el resto de los cambios — de 247 original a bien por debajo de 220.
- [ ] **Revisión visual real sigue pendiente** — todo lo de esta versión se verificó por lectura de código, pruebas aisladas (Node) y arranque real del servidor, no hay forma de renderizar ni ver la app desde este entorno. Necesita confirmación visual del usuario, especialmente el rediseño de tabs y Salud estructural.
- [ ] Pase estético "holístico" más profundo (mockup de referencia: la mini-tool de test) — se avanzó en botones e inputs; paneles/cards/badges quedan para una siguiente pasada si el usuario confirma que la dirección actual es la correcta.
- [ ] Alineación de "Comparar Commanders" — el bug de que no mostraba nada ya está resuelto (v2.4.4); la alineación visual en sí no se revisó todavía porque requiere verlo renderizado.

## v2.4.6 — formato de botones calcado del test lab, scroll a tabs, temáticas compactas
- [x] **Formato de botones copiado literalmente de ManaShelf TEST LAB**: outline transparente por defecto (borde + texto del color del rol) → relleno sólido con ese color + texto oscuro + glow al hover. Aplicado a `.primary`, `.ghost`/`.ghost-link`, `.tiny`, `.state-choice`, `.dash-actions`, `.view-toggle`, `.discover-filters`/`.toggle-button`, `.discover-selected-tags`, `.deck-inspector-filter`, `.health-ref-row`, `.compare-chip`, `.type-legend`. Se mantuvo el padding/tamaño de fuente de cada botón (la mini-tool tenía pocos botones grandes; acá son muchos y densos) — se copió el mecanismo de interacción, no las medidas exactas en píxeles.
- [x] **Decisión deliberada, no aplicada a todo**: `button.dashboard-stat` y `button.structural-rule` quedaron con su glow sutil de borde, sin el relleno sólido completo — son tarjetas de datos (número + estado), no botones de acción; invertirlas a bloque de color las volvía ilegibles.
- [x] **Bug real encontrado**: `.in-deck-filter::before{content:"MAZO · "}` anteponía literalmente ese texto al botón "Ya en el mazo", haciendo que se leyera "MAZO · Ya en el mazo". Eliminado.
- [x] **Lógica de "Ya en el mazo" invertida a pedido**: antes "activo" (con glow) ocultaba esas cartas — contraintuitivo. Ahora "encendido" (con el mismo gradiente que el badge que aparece sobre las cartas ya incluidas) las muestra; "apagado" (tono neutro) las oculta.
- [x] **Duplicación real de "YA EN EL MAZO" en las cartas**: cuando una carta ya estaba en el mazo, se mostraban DOS badges distintos con el mismo texto (uno arriba, uno abajo). El de abajo ahora solo muestra la cantidad, sin repetir el texto que ya dice el de arriba.
- [x] Botón "Analizar mazo" ahora hace scroll a la altura de las tabs (Deck Check/SWAPS/EDHREComendaciones) en vez de más abajo.
- [x] Barras de Temáticas más compactas: el contenedor las estiraba con `justify-content:center` para llenar el alto completo de la columna, dejando mucho aire entre 4-5 barras. Ahora se agrupan arriba con espaciado ajustado.
- [x] Confirmado (no era un bug): el % de Temáticas es cardCount/deck.size — cantidad de cartas con evidencia de esa temática sobre el tamaño total del mazo (Method 6).
- [ ] **Revisión visual real sigue pendiente** — verificado por código, pruebas aisladas y arranque real, no por render. Especialmente el toggle "Ya en el mazo" y el nuevo formato de botones en conjunto.
- [ ] Pase estético holístico más profundo (paneles, badges, cards) — botones e inputs ya calcados del test lab; el resto de los componentes (paneles, tarjetas de resultado) queda para una siguiente pasada si se confirma que la dirección de botones es la correcta.

## v2.4.7 — SWAP y Comparar rediseñados, progreso en comparar, limpieza grande de CSS
- [x] Ícono de información suelto en Deck Check: flotaba solo por `justify-content:space-between` en `.lab-result-head`. Movido junto al label "DECK HEALTH · EXPERIMENTAL".
- [x] Temáticas más compactas: gap de contenedor, gap interno de fila y grosor de barra reducidos (6px→4px).
- [x] Ícono "i" agregado a los 3 paneles del dashboard (Curva de maná, Temáticas, Tipos de carta) con descripción breve.
- [x] Tabs principales (Explorar Commander / Mejorar mi mazo / Qué Commander / LAB) sin ningún `:hover` ni tratamiento neón — corregido con el mismo lenguaje visual que las ribbon-tabs (atenuadas inactivas, glow completo activa).
- [x] `.card-actions button` (Shortlist/Alternativas/ADD-CUT, usado en Explorar y EDHREComendaciones) actualizado al formato de botón nuevo; estado visual distinto para "En shortlist".
- [x] Botones de Descubrir Commander ya estaban cubiertos por `.ghost.tiny`/`.primary`; se sacó un override de color (`#discoverTagsToggle`) que interfería.
- [x] **"Ya en el mazo" invertido a pedido**: antes "activo" ocultaba esas cartas — ahora "encendido" (mismo gradiente que el badge de las cartas) las muestra, "apagado" las oculta.
- [x] **Bug real de texto duplicado**: `::before{content:"MAZO · "}` hacía que el botón leyera "MAZO · Ya en el mazo". Eliminado.
- [x] **Bug real de badge duplicado**: una carta ya en el mazo mostraba "YA EN EL MAZO" dos veces (arriba y abajo) en la misma tarjeta. El de abajo ahora solo muestra la cantidad.
- [x] **SWAP rediseñado de cero**: mismo patrón de deuda técnica que las tabs (`.swap-card` redefinido 3 veces). Consolidado en un bloque: tinte de fondo cyan/magenta por lado (IN/OUT), badge de confianza con color real por nivel (alta/media-alta=cyan, media=ámbar, baja=neutro), mejor jerarquía tipográfica.
- [x] **Bug real de imagen recortada en Comparar Commanders**: el contenedor forzaba `max-height:360px` con `object-fit:cover`, pero a un ancho de columna real la altura natural supera 900px — se veía solo el 35-40% superior de la carta. Sacado el `max-height`; ahora se ve la carta completa.
- [x] Comparar Commanders rediseñado: tarjetas con borde/glow magenta, jerarquía tipográfica clara (número hero más grande, stats en grilla con mejor padding), sin el bloque `#rankResults.compare-layout` duplicado que competía con la versión base.
- [x] **Progreso agregado a Comparar Commanders**: antes el overlay de carga quedaba estático todo el tiempo sin ninguna señal de avance. Ahora usa el mismo patrón de etapas + cronómetro que ya tenía el análisis normal (Consultando EDHREC → Cruzando con colección → Calculando cobertura → Preparando).
- [x] Limpieza de CSS acumulada: `!important` bajó de 216 (v2.4.6) a 135 tras consolidar SWAP y Comparar; se sacaron ~4 bloques de reglas fragmentadas/duplicadas.
- [ ] **Revisión visual real sigue pendiente** — todo verificado por código, no por render. Especialmente SWAP y Comparar Commanders, que fueron rediseños grandes esta vez.

## v2.4.8 — Temáticas compactas, Recomendaciones estructurales, Identidad con evidencia, SWAP con onda test lab
- [x] **Temáticas realmente compacta**: la causa no eran los gaps (ya ajustados en v2.4.6) sino que el panel se estiraba `height:100%!important` para igualar a Curva de maná, dejando aire vacío abajo. Ahora usa `align-self:start` y hugea su propio contenido.
- [x] Ícono "i" agregado a los 3 paneles del dashboard (ya estaba en v2.4.6, confirmado que sigue).
- [x] **Recomendaciones estructurales rediseñado**: mismo patrón de deuda técnica (3 bloques `.structural-rule` peleando). Consolidado: badge circular de ícono en vez de emoji inline, jerarquía tipográfica real (título + detalle en líneas separadas), glow consistente con el resto del dashboard.
- [x] **Identidad del mazo con más valor**: antes mostraba lo mismo que el gráfico de Temáticas de arriba (nombre + % + confianza), sin agregar nada nuevo. Ahora cada tarjeta muestra hasta 4 nombres de cartas concretas que sostienen esa temática (+N más si hay más), usando datos que el backend ya calculaba pero no se mostraban.
- [x] **SWAP con la estética de ManaShelf TEST LAB**: rediseño completo. Ahora son parejas IN→OUT como unidad visual (2 parejas por fila en pantallas anchas = 4 cartas visibles), imágenes más grandes (72px→112px), con tinte de fondo cyan/magenta por lado y borde sutil alrededor de la imagen del color correspondiente. La justificación de cada carta va debajo de ella (antes en una columna al costado); el "por qué esta pareja" compartido queda como pie de la pareja completa, no perdido.
- [x] Progreso de Comparar Commanders ya agregado en v2.4.7, confirmado que sigue andando con el nuevo rediseño de tarjetas.
- [ ] **Revisión visual real sigue pendiente** — verificado por código y pruebas aisladas, no por render.

### Sobre la pregunta de rendimiento público vs. privado (confirmado con el código, no es percepción)
Privado hace DOS pasadas de fondo por cada mazo después de conectar: `startDeckUsageSync` (trae el detalle completo de cada mazo vía el bridge, para saber en qué otros mazos está usada cada carta) + `prefetchDeckSizes` (Size real vía Method 6). Público solo hace la segunda — nunca llama a `startDeckUsageSync`, así que el "uso en otros mazos" para cuentas públicas simplemente no está implementado, no es una carga que también hace pero más rápido. Es más rápido porque hace menos, no porque esté mejor optimizado — ambas comparten el mismo precálculo de Size ya optimizado desde v2.4.4/v2.4.5.

## v2.4.9 — dos pasadas por mazo fusionadas en una
- [x] **Hallazgo real, a partir de una pregunta del usuario**: privado pedía cada uno de los 55 mazos DOS VECES por dos caminos distintos — una vez directo a Archidekt (`prefetchDeckSizes`, solo para el número de Size) y otra vez por el bridge (`startDeckUsageSync`, solo para las cartas). Era la misma información, pedida dos veces.
- [x] `fetchDeckSizeOnly` renombrada a `fetchDeckPartition` y devuelve la partición completa (`mainboard`, `commanders`, `size`) en vez de solo el número — mismo Method 6 ya validado, mismo endpoint directo a Archidekt.
- [x] `startDeckUsageSync` ya no pasa por el bridge (`/api/personal-deck-cards`): pide el mazo directo a Archidekt con el token obtenido una sola vez en el login, igual que ya hacía el cálculo de Size. Una sola pasada por mazo entrega Size real Y la lista de cartas para "uso en otros mazos" a la vez.
- [x] `prefetchDeckSizes(session)` sacado del login privado (ahora redundante, `startDeckUsageSync` ya calcula lo mismo de yapa); se mantiene sin cambios en el login público, que sigue siendo la única pasada que necesita.
- [x] Validado con una prueba aislada (mazo simulado con Commander + Sideboard): tamaño exacto, sideboard correctamente excluido de `mainboard`, commander detectado vía `partition.commanders`, tabla de uso armada correctamente — los 7 casos de borde pasan.
- [x] Resultado esperado: privado pasa de ~110 pedidos de red (55 + 55) a ~55 para esta parte del flujo de conexión — la mitad.
- [ ] Las 2 funciones de recache manual (`rebuildUsageFromDisk`, `runCacheSection`) siguen usando el bridge para esto mismo — no se tocaron esta vez, quedan con la misma redundancia si se usan. Evaluar si conviene unificarlas también.
- [ ] Validar con cuenta real que el tiempo de conexión bajó como se espera, y que no aparecen más fallos 429 al ir directo a Archidekt en vez de por el bridge.

## v2.4.10 — bug crítico de SWAP, Recomendaciones/Identidad rediseñados
- [x] **Bug crítico confirmado por captura: la carta OUT desaparecía en SWAP.** Causa real: `.swap-pair` usaba CSS Grid con `grid-template-areas` + `overflow:hidden`; el contenido de la columna IN no podía achicarse por debajo de su tamaño mínimo implícito (`min-width:auto` de Grid), así que el resto de las columnas (connector + OUT) quedaban recortadas fuera de vista. Reescrito con flexbox (`flex:1;min-width:0` en cada mitad), el patrón estándar para evitar exactamente este problema.
- [x] Estética SWAP reforzada más "test lab": glow de borde que se enciende en hover (antes solo oscurecía), contorno de color alrededor de la imagen según IN/OUT.
- [x] **Bug real encontrado: mismo problema de "se mueve al hover" que ya se había arreglado en el botón principal, pero seguía en `.theme-click`** (usado por Identidad del mazo) — `transform:translateY(-1px)` en hover/focus. Eliminado.
- [x] Recomendaciones estructurales: de grid rígido de 2 columnas (mucho espacio vacío en pills cortos) a `auto-fit` — cada regla ocupa solo lo que necesita, encajan más por fila en paneles anchos.
- [x] **Identidad del mazo con valor agregado real y nuevo**: se agregó "Cartas que atan varias temáticas" — cartas que sostienen 2+ temáticas a la vez, dato que no está visible en ningún otro gráfico de la app (ni en Temáticas de arriba, que muestra cada tema aislado). Probado con datos simulados. Legibilidad de las chips de ejemplo mejorada (más contraste, tipografía más grande).
- [ ] **Revisión visual real sigue pendiente** — especialmente crítico esta vez confirmar que la carta OUT ya aparece.

## v2.4.11 — rate-limit real detrás de los trabazos, progreso de Comparar donde se ve, más neón
- [x] **Causa real del trabazo de 40-50s confirmada con evidencia de código, en dos lugares distintos**:
  1. `archidektRequest` (pedidos directos a Archidekt desde v2.4.9): al recibir 429 con `Retry-After`, esperaba esa cantidad exacta sin límite. Con 5 pedidos directos en simultáneo (sin el amortiguador que daba el bridge antes), es más fácil gatillarlo. Agregado: espaciado mínimo de 120ms entre pedidos + tope de 8s a la espera + logueo de cuándo pasa.
  2. `scryfallRequest` (usado por "Commanders de tu colección"): al recibir 429 **sin** header `Retry-After`, esperaba **60 segundos por defecto**, hasta 90 como techo. Esto explica exactamente el patrón reportado ("se traba en 574... después aparece 600"). Acortado a máximo 10s (o 5s si Scryfall no manda el header), con logueo.
- [x] Curva de maná: aclarado en el subtítulo que arriba es cantidad de cartas y abajo es CMC.
- [x] **Recomendaciones estructurales rediseñado en 2 columnas**: izquierda = recomendaciones accionables ("A considerar"/"A revisar"), derecha = las 8 reglas evaluadas, apiladas verticalmente. Más neón: headers con glow por color de rol, bordes de regla más vívidos.
- [x] Hover-to-enlarge agregado a "Commanders de tu colección" (no lo tenía), usando el sistema unificado ya existente. Campo `imageLarge` agregado al backend para esto.
- [x] **Progreso de "Comparar" reubicado donde realmente se ve**: el botón es flotante (fixed, siempre visible sin importar el scroll) pero el indicador de carga general vivía arriba en el flujo normal de la página — invisible si estabas scrolleado. Ahora el propio botón se rellena de color mientras espera (relleno con curva que se frena cerca del final, nunca llega a 100% hasta terminar de verdad) más una leyenda chica debajo con la etapa actual, todo anclado al mismo lugar fijo que el botón.
- [ ] **Revisión visual real sigue pendiente** — especialmente el relleno del botón de Comparar y el layout de 2 columnas de Recomendaciones estructurales, que son cambios nuevos esta vez.
- [ ] Guía paso a paso de Cloudflare Tunnel entregada aparte (`COMO-PUBLICAR-MANASHELF-EN-INTERNET.txt`), fuera del ZIP de la app — no es código de ManaShelf, es documentación de despliegue.

## v2.4.12 — ejes de la curva, hover en temáticas, mazos Tribales, filtro por temas, Asistente a 100
- [x] Curva de maná: "Cartas" y "CMC" ahora son etiquetas fijas alineadas a la altura real de cada fila (vía flex + `justify-content:space-between`), no una línea de texto aparte como en el intento anterior.
- [x] Temáticas: subtítulo cambiado a "Temas inferidos".
- [x] Hover con carta grande agregado a "Cartas que atan varias temáticas" — nuevo lookup `cardImages` en el backend (nombre→imagen), reusando el meta de Scryfall ya cargado para el mazo, sin pedir nada de más.
- [x] **Mazos Tribales: gap real confirmado y corregido.** La detección de temáticas era 100% por patrón de texto por carta; ningún mazo se marcaba "Tribal" porque eso depende de contar subtipos de criatura acumulados, no de una frase en una sola carta. Esto explicaba por qué cartas de soporte tribal se sugerían para cortar ("sin evidencia clara a los themes"). Nueva función `detectTribalType()`: cuenta subtipos de criatura en el mazo, umbral de 6+ criaturas y ≥18% de las criaturas del mazo. Si detecta un tipo dominante, se agrega como theme propio y las cartas de soporte tribal (por tipo o por texto payoff) quedan protegidas por el mismo mecanismo que ya usan los demás themes. Probado con un mazo simulado de Elfos.
- [x] SWAP: badges de "+" (cyan) y "−" (magenta) sobre cada imagen para que IN/OUT se distinga de un vistazo, sin perder las 4 cartas por fila.
- [x] **Filtro por temáticas agregado a Explorar Commander y EDHREComendaciones** (comparten el mismo endpoint `/api/analyze`, así que un solo cambio cubre ambos). Trae los tags de EDHREC del Commander (mismo mecanismo que ya usaba Deck Health) y calcula qué cartas los sostienen; nuevo selector "TEMÁTICA" junto al de roles, oculto si el Commander no tiene temas con evidencia.
- [x] **Asistente a 100 rediseñado**: ahora cada carta muestra tipo, categoría/rol asignado y una explicación de qué suple (antes era una lista plana de nombres sin contexto). Agregado un toggle "Disponibles / En colección" en el propio modal, que recalcula la lista al cambiar — antes no había forma de saber cuál de las dos se estaba usando ni de cambiarla.
- [x] Guía nueva `FORMA-MAS-FACIL-Y-GRATIS-DE-PUBLICAR.txt` — documento de decisión (por qué Cloudflare Tunnel y no otra opción), distinto del paso a paso ya entregado.
- [ ] **Revisión visual real sigue pendiente** — especialmente el filtro de temáticas y el Asistente a 100 rediseñado, cambios grandes esta vez.

## v2.4.13 — listo para hostear gratis en Render
- [x] **Bug real de portabilidad encontrado y corregido**: el puerto estaba fijo en `3000` (`const PORT = 3000`) y el server solo escuchaba en `127.0.0.1`. En cualquier hosting real (Render, Railway, Fly.io, etc.) el puerto lo asigna la plataforma por la variable de entorno `PORT`, y escuchar solo en `127.0.0.1` hace que la app sea inalcanzable desde fuera del contenedor. Corregido: `PORT = process.env.PORT || 3000` (con fallback para seguir andando igual local) y `.listen(PORT,"0.0.0.0",...)`. Probado local con puerto por defecto y con `PORT` seteado a mano — los dos funcionan.
- [x] Agregado `.gitignore` (excluye `.manashelf-cache/`, no existía antes) para no subir caché local al repo que usa Render para el deploy.
- [ ] Pendiente: confirmar deploy real en Render con cuenta del usuario.

## v2.4.14 — legibilidad general, reestructuraciones grandes, rollback preparado
- [x] **Se guardó un checkpoint de respaldo** (`manashelf-v2.4.13-checkpoint1`) antes de los cambios más grandes de esta tanda, a pedido explícito del usuario de estar preparados para rollback.
- [x] Botones redundantes arriba de "Biblioteca conectada" (Explorar Commander/Mejorar mazo/Qué puedo construir) eliminados — quedaban duplicados con las 4 opciones numeradas de abajo.
- [x] Botón LAB achicado (columna más angosta, sin subtítulo) — se usa poco y no debía tener el mismo peso visual que las 3 opciones principales.
- [x] "Cerrar sesión" vs "Cambiar colección": ya no se distinguían solo por color (insuficiente a simple vista). Agregado separador visual, íconos (⇄/⎋), y el rojo de "Cerrar sesión" reforzado (antes muy sutil).
- [x] **Legibilidad de texto en toda la app**: extraídos todos los `font-size` del archivo (6px a 30px) y aplicado un mapeo de escalado — más generoso en los tamaños chicos (6→9, 7→10, 8→11, 9→12, 10→13, 11→14...) que eran la mayoría del texto de la app, casi sin tocar títulos ya grandes. Aplicado con una regex que toca únicamente la propiedad `font-size`, no otros valores en píxeles.
- [x] Deck list a la derecha (deck inspector): agregado botón para colapsar a una pestaña angosta (con memoria de preferencia entre sesiones vía localStorage), y ensanchado (300→340px) para el texto más grande.
- [x] **Temáticas — causa real encontrada y corregida de fondo**: no era el espaciado, era el diseño de barra en sí — con % bajos, el track quedaba mayormente vacío. Reemplazado por lista rankeada (punto de color + nombre + número), sin ese problema; el panel ahora sí puede volver a igualar la altura de sus vecinos.
- [x] **Recomendaciones estructurales reestructurado**: el layout de 2 columnas forzaba la misma altura a "A considerar" (0-3 tarjetas) y las 8 reglas (siempre 8) — nunca calzaban. Ahora es flujo vertical: primero lo que necesita atención (si hay), después las 8 reglas como grilla compacta que se ajusta al ancho disponible.
- [x] Ribbon tabs (Deck Check/SWAPS/EDHREComendaciones) vuelven a ser sticky, a pedido explícito — flotan debajo del header mientras se hace scroll. La versión anterior se había sacado por un bug distinto (grid vertical + z-index en conflicto); esta es un flex horizontal simple, sin esa causa.
- [x] Íconos de vista miniatura/lista cambiados de glifos Unicode a SVG inline — se ven consistentes sin depender de la fuente del sistema.
- [x] Modo lista rediseñado: antes ocultaba la imagen del todo, dejando filas con mucho espacio vacío. Ahora muestra una miniatura chica (36px) y centra el contenido verticalmente.
- [x] Texto de SWAP más claro, con la aclaración explícita de que son recomendaciones basadas en lo que ManaShelf puede ver (mazo + colección), no en el metajuego ni la estrategia real del usuario.
- [x] **"Analizar mazo" desalineado — causa real encontrada**: a diferencia de "Analizar colección" (bloque propio en Explorar), estaba metido como tercera columna del grid del resumen del mazo, empujado a la derecha con `align-self:end`. Ahora ocupa su propia fila completa, alineado a la izquierda, coherente con el patrón de "Analizar colección".
- [x] Dropdown de búsqueda de mazos: más padding interno, sombra propia para despegarse visualmente del fondo de la página, sin cambiar la cantidad de mazos mostrados.
- [ ] **Revisión visual real sigue pendiente** — esta fue la tanda más grande de cambios visuales hasta ahora; el checkpoint de respaldo queda disponible si algo necesita revertirse.

## v2.4.15 — correcciones sobre lo anterior, y primer avance real en la deuda de CSS
- [x] **Checkpoint guardado dos veces** (`manashelf-v2.4.14-checkpoint2`, antes de tocar la arquitectura del CSS) — a pedido explícito del usuario.
- [x] **"Analizar mazo" — error propio corregido**: había asumido mal el patrón de "Analizar colección" en v2.4.14 (creí que estaba en su propia fila a la izquierda; en realidad usa `flex + justify-content:space-between`, a la derecha, misma fila). Revertido y corregido bien esta vez.
- [x] **Neon en menú principal (01/02/03/LAB)**: `.mode.active` usaba un tinte sutil con glow, no la fórmula real ya usada en botones (outline transparente → relleno sólido + texto invertido + glow). Reescrito para calcar exactamente esa fórmula.
- [x] **Temáticas — barra segmentada implementada**: 10 bloques que se llenan según el % (a diferencia de la barra continua de antes, que dejaba espacio vacío con % bajos, y de la lista sin nada visual de la vuelta anterior). Probado con datos simulados.
- [x] "click para auditar" eliminado de las 4 ubicaciones donde aparecía.
- [x] **Íconos circulares mal alineados — causa real encontrada**: una regla pisaba el centrado flexbox del ícono "i" de información con `line-height` y `padding-bottom` fijos. Eliminada, y agregado `line-height:1` a todos los badges circulares con texto/glifos de la app (rule-icon, swap-badge, commander-select-circle, deck-inspector-toggle, dashboard-note-ring) para prevenir el mismo problema en cualquier otro lado.
- [x] **Lista rediseñada de cero, sin miniatura** (a pedido explícito, revirtiendo la miniatura agregada en v2.4.14): fila de texto densa — nombre, tipo, categoría, CMC, disponibilidad — blanco si la tenés, gris si no. Ya no se fuerza el HTML de la tarjeta grande por CSS; tiene su propia plantilla en `render()`.
- [x] **"Cambiar colección" ahora también llama a `/api/logout`** antes de recargar — antes dejaba la sesión vieja huérfana en memoria del servidor.
- [x] **Diferencia real entre "Cerrar sesión" y "Cambiar colección" confirmada y explicada al usuario** con evidencia de código exacta.
- [x] **Primer avance real en la auditoría de CSS duplicado** (con checkpoint de respaldo, análisis en profundidad antes de tocar nada): se escribió un script que separa duplicados legítimos (dentro de `@media`, responsive normal) de duplicados en el MISMO contexto con propiedades REALMENTE conflictivas entre sí — encontró 17 selectores con conflictos reales de 39 candidatos totales. Se consolidaron con verificación completa después de cada uno: `.deck-summary`, `.improve-actions`, `.health-cards`/`.health-card`/`.health-card-top`, y `.deck-dropdown` (este último tenía un `max-height:272px!important` ganando por encima del cambio de v2.4.13/14 que buscaba darle más aire al dropdown de mazos — quedó resuelto de fondo, no solo parcheado).
- [x] `!important` bajó de ~250 a un número más bajo tras esta consolidación (no recontado exacto esta vuelta, pero cada consolidación quitó al menos un `!important` innecesario).
- [ ] **Quedan 13 selectores con conflictos reales sin consolidar todavía** (verificados por el script, pendientes de revisión manual uno por uno antes de tocar — el script tuvo al menos un falso positivo con `.health-cards` inicialmente, así que no hay que confiar en la lista a ciegas): `.stock-badge`, `.deck-list-row`, `.discover-filters`, `.rank-results`, `.in-deck-badge`, `.lab-deck-chosen`, `.theme-grid-v2`, `#improveFlow`, `.deck-inspector-head`, `.health-ref-row`, `.build-owned-card`, `.commander-select-circle`, `.type-donut`. Se recomienda continuar con el mismo método (verificar conflicto real → merge cuidadoso → `node --check` + balance de llaves → smoke test) en una próxima sesión, no todos de una vez.
- [ ] **Clave de acceso compartida para probar en single-user mientras está publicada.** Objetivo del usuario: poner alguna clave para poder usarla con un usuario único mientras se prueba en internet (pero accedida en simultáneo desde donde sea), y más adelante pasar a usuarios distintos de verdad.
  - Nota de arquitectura: la app YA soporta acceso concurrente hoy (cada conexión tiene su propio `sessionId` en el Map de `sessions`, independiente entre sí) — lo que falta no es "soportar varias sesiones a la vez", eso ya existe. Lo que falta es una puerta de entrada: pedir una clave compartida (por variable de entorno, ej. `MANASHELF_ACCESS_KEY`) antes de dejar pasar a cualquier request, como paso liviano previo a un sistema real de usuarios.
  - Para usuarios distintos de verdad más adelante: hoy "usuario" = la cuenta de Archidekt con la que cada quien se loguea, no hay concepto de cuenta propia de ManaShelf. Evaluar si alcanza con eso (cada quien ya usa su propio login de Archidekt, aislado por sessionId) o si además se quiere un login propio de ManaShelf.
- [x] **Confirmado, ya funciona correctamente — no hacía falta arreglar nada**: la caché de cartas de Scryfall (`.manashelf-cache/scryfall-images.json`) ya es un único archivo GLOBAL, compartido entre todas las sesiones y cuentas — si una sesión ya pidió "Sol Ring", cualquier otra sesión reusa esa entrada sin volver a pedirla. La caché de mazos (`decks-<usuario>.json`) ya está indexada por cuenta de Archidekt, no por sesión — si la misma cuenta entra desde dos pestañas o dos personas, comparten esa caché también.
- [ ] Otras sugerencias para cuando esté expuesta a internet (a definir con el usuario, no implementadas):
  - Las sesiones viven en memoria (`Map` en RAM) — si el proceso de Node se reinicia (redeploy, crash, se apaga la compu con Cloudflare Tunnel), TODAS las sesiones activas se pierden de golpe, sin aviso al usuario conectado en ese momento. Vale la pena decidir si esto necesita algún manejo (ej. detectar sesión inválida y pedir reconectar con un mensaje claro, en vez de que la app quede en un estado raro).
  - Sin la clave de acceso, cualquiera con el link de Cloudflare puede usar el server (y, si se conecta con usuario/contraseña de Archidekt ahí, esa sesión queda activa en el server mientras dure) — la clave de acceso cubre esto, pero vale la pena tenerlo explícito como motivo, no solo como control de acceso genérico.
  - Si más adelante hay uso real de varias personas a la vez, la concurrencia ya definida en `startDeckUsageSync`/`prefetchDeckSizes` (CONCURRENCY=5 cada una) es POR SESIÓN — dos personas conectándose al mismo tiempo pueden sumar 10 pedidos concurrentes a Archidekt entre las dos, acercándose más rápido al rate-limit que ya vimos. Con pocos usuarios no debería ser un problema, pero si crece, conviene un límite global compartido entre sesiones, no solo por sesión.

## v2.4.4 — bugs de Mejorar, orden por actualizado, hover y estilo neón
- [x] **Bug real: tabs tapando el dropdown de mazos.** `.improve-tabs` terminaba en z-index 32 (por una regla `!important` posterior en el archivo) y `.deck-dropdown` estaba en 20. Subido a 36.
- [x] **Orden "últimos accedidos" en el buscador de mazos.** El usuario confirmó que antes SÍ ordenaba por actualizado en Archidekt. Encontrado: `publicDecks()` ya usaba `/api/decks/v3/?orderBy=-updatedAt` (confiable), pero el login privado arma su lista desde `personal_decks.decks` del payload de login, cuyo `updated_at` viene vacío. Nueva función `privateDecks()` reusa el mismo endpoint confiable, autenticado con JWT, para cuentas privadas. Fallback a `normalizeDecksFromLogin` si falla. Frontend ordena por ese `updatedAt` real primero, con un registro local (localStorage) de qué mazos abrió el usuario en ManaShelf como respaldo secundario si a algún mazo le falta el dato.
- [x] **Bug real: clic en leyenda de Curva de maná no filtraba.** Los `<span>` de la leyenda de tipos no tenían ningún handler; solo los segmentos de barra filtraban. Convertidos a `<button>` con `data-curve-type-ref`, agregando el handler que agrupa cartas de ese tipo en toda la curva.
- [x] **Bug real: sin hover-enlarge en "Cambios sugeridos".** El backend nunca mandaba `imageNormal` para el lado OUT (`cutCandidates`); el frontend no tenía el `<img>` compañero de hover en ningún lado (IN ni OUT). Corregidos ambos.
- [x] **Bug real: grilla principal de cartas (Explorar/Mejorar → Recomendaciones) sin hover-enlarge**, pese a que el backend ya mandaba `c.imageLarge`/`c.imageNormal` sin usar. Agregado.
- [x] **Bug real y grave: "Comparar Commanders" no mostraba nada.** Error de precedencia de operadores en JS: `A+B+C+D?E:F` se evalúa como `(A+B+C+D)?E:F` porque `+` tiene más precedencia que `?:`. El HTML de resultados completo se descartaba siempre; `innerHTML` terminaba siendo solo el aviso de fallos (o "" nunca, porque un string no vacío siempre es truthy). Confirmado con una prueba aislada antes y después del fix. Corregido con paréntesis explícitos.
- [x] Auditoría de miniaturas sin hover en el resto de la app: quedan sin hover los íconos pequeños de identificación en dropdowns/pickers (buscador de Commander, buscador de mazos, deck picker, LAB) — se dejaron así a propósito por ahora: son íconos de 34-54px para identificar qué elegís, no cartas para inspeccionar, y un hover-preview en una lista que se filtra mientras escribís puede ser más ruido que ayuda. Pendiente confirmar con el usuario si también los quiere.
- [x] Pase de estética neón sobre `.primary`, `.ghost`/`.ghost-link` y `.tiny` (los tres arquetipos de botón usados en toda la app): glow más marcado en hover, inversión a fondo cyan/magenta con texto oscuro (antes solo cambiaba borde/color de texto), transiciones consistentes. Aplicado a la base para que herede en toda la app sin duplicar reglas.
- [ ] **Revisión visual real sigue pendiente** — todo lo de arriba se verificó por lectura de código y pruebas aisladas (Node), no hay forma de renderizar ni ver la app desde este entorno. Necesita confirmación visual del usuario.
- [ ] Extender el pase de estética neón a otros componentes (chips, badges, tabs, inputs) si el usuario confirma que el pase actual va en la dirección correcta.

### Notas de arquitectura (pedido explícito de revisión)
- `server.mjs` (1922 líneas), `app.js` (660 líneas) y `styles.css` (790 líneas) siguen siendo archivos monolíticos únicos — no hay separación por módulo/feature. Funciona porque el proyecto es de un tamaño manejable, pero cada cambio puntual (como los de hoy) requiere leer mucho contexto para no romper algo en otro lado.
- **`!important` subió de 247 a 255** (algunos de los fixes de hoy lo necesitaron para ganarle a reglas `!important` previas ya existentes). Sigue siendo la señal de deuda técnica más clara del proyecto: clases como `.swap-grid`, `.swap-side`, `.swap-card`, `.improve-tabs`, `.visual-dashboard` y `.curve-col` están **redefinidas 3 veces cada una** en distintos puntos del archivo, señal de parches acumulados en vez de ediciones integradas — esto fue la causa directa del bug de z-index de hoy.
- Hay lógica de "traer detalle de mazo uno por uno desde el bridge" duplicada en 3 lugares (`startDeckUsageSync`, `rebuildUsageFromDisk`, `runCacheSection`). Solo el primero tiene la optimización de concurrencia de v2.4.3; los otros dos siguen secuenciales y con su propia copia casi idéntica del mismo bloque try/catch.
- Ninguno de estos puntos es urgente por sí solo, pero si se sigue creciendo sin consolidar, el costo de cada cambio puntual va a seguir subiendo.

## v2.4.16 — PARCHE DE SEGURIDAD URGENTE (path traversal) — a partir de auditoría externa
- [x] **P0 confirmado y corregido: path traversal en el servidor de archivos estáticos.** Una auditoría externa reportó que `path.join(PUBLIC_DIR, p)` no evita que `p` (con `..` decodificado) escape del directorio público. Verificado en vivo antes de tocar nada: `GET /..%2Fserver.mjs` devolvía HTTP 200 con el código fuente real de `server.mjs`. Grave desde v2.4.13 (el server pasó a escuchar en `0.0.0.0` para poder hostear en Render), dejando de estar limitado a localhost.
- [x] Corregido resolviendo la ruta final con `path.resolve()` y rechazando con 403 cualquier resultado que caiga fuera de `PUBLIC_DIR`.
- [x] Probado con 5 variantes del ataque (simple, múltiples `../` hacia `/etc/passwd`, sin encodear, apuntando a `package.json`, doble-encodeado) — las 5 bloqueadas. Pedidos legítimos (`/`, `/app.js`, `/styles.css`) siguen respondiendo 200 sin cambios.
- [ ] El resto de la auditoría (concurrencia de Archidekt con condición de carrera real en `archidektPace`, exageración matemática en la barra segmentada de Temáticas, inconsistencia donut/tierras, memory lifecycle de sesiones, modularización, accesibilidad, tests) queda pendiente de trabajo — ver informe de auditoría completo para el detalle punto por punto. Se verificaron 3 hallazgos de alto impacto contra el código real (path traversal, race condition de pacing, y matemática de segmentos) y los 3 resultaron precisos, por lo que el resto del informe se considera confiable como punto de partida, no una lista para aplicar a ciegas.

## v2.4.17 — resto del hardening P1 de la auditoría
- [x] **Límite de tamaño de body (1MB)**: implementado. En el primer intento usé `req.destroy()` al detectar el exceso, lo que cortaba la conexión antes de poder mandar una respuesta 413 clara — el cliente veía un corte abrupto. Corregido para dejar que la promesa se rechace normalmente; probado con un payload real de 2MB contra `/api/login` (endpoint que lee el body sin gate de sesión previo): ahora da 413 limpio con mensaje. Pedidos normales sin cambios.
- [x] **Cola real para el pacing de Archidekt** (arregla la condición de carrera confirmada la vez pasada). Probado de forma comparativa: la versión vieja hacía que 4 de 5 workers "concurrentes" pasaran en la misma ventana de 5ms (ráfaga real); la cola nueva los escalona genuinamente cada ~120ms.
- [x] **Limpieza periódica de sesiones y jobs viejos**: TTL de 24h para sesiones inactivas (se actualiza `lastSeen` en cada uso vía `getSession`), 1h para jobs terminados, corre cada 30 min. Probada en aislado con casos mixtos (vieja/fresca/corriendo).
- [x] **Donut de tipos incluía tierras pese al texto** ("sin contar tierras"): confirmado el bug de datos, corregido reusando `nonlands` (la misma lista que ya usa Curva de maná) para consistencia entre gráficos y con la copy.
- [x] **Segmentos de Temáticas exagerando densidades chicas** (1% se veía como 10%, confirmado con matemática): corregido con relleno proporcional real por segmento (ej. 15% = 1 segmento completo + 50% del siguiente), en vez de "mínimo 1 segmento entero".
- [x] **Security headers básicos**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, y un `Content-Security-Policy` moderado (estricto en `script-src 'self'`, que es el mayor valor contra XSS y de bajo riesgo porque solo hay un `<script>` legítimo; permisivo en estilos/imágenes/fuentes porque no pude verificar visualmente en un navegador real que restringirlos no rompiera algo — la app usa mucho `style=""` inline para colores dinámicos). Aplicados a las dos vías de respuesta (`send()` y el servidor de archivos estáticos). Confirmado con `curl -D -` que los headers realmente llegan en ambas.
- [x] **README.md, HANDOFF.md y START-HERE.txt actualizados**: quedaban con título/baseline en v2.4.1 pese a que la app ya estaba en v2.4.16+. No se reescribió el contenido técnico (sigue siendo válido en su mayoría), solo se corrigió el título/baseline y se agregó un aviso explícito de que `BACKLOG.md` es la fuente de verdad para el estado más reciente.
- [ ] Pendiente del plan de hardening original: nada más marcado como P0/P1 crítico — lo que sigue (modularización, tests, accesibilidad, consolidación de CSS restante) es P1/P2 de mejora continua, no urgencias de seguridad.

## v2.4.18-beta — botón X, alineación, chequeo de 100, exportar, tema claro
- [x] **Etiqueta BETA agregada** (título, pill visual en el header, footer, `package.json`) — versión ahora `v2.4.18-beta`, a pedido explícito del usuario.
- [x] Botón "×" descentrado dentro del círculo (`.input-clear`, "Borrar texto"): corregido el centrado (era `place-items:center` sin compensar el desplazamiento típico del glifo × en la mayoría de las fuentes). Mismo tratamiento aplicado a `.toast-close` (Cerrar del toast de error) para consistencia.
- [x] **"Analizar mazo" — tercera vuelta, con diagnóstico distinto esta vez**: el mecanismo (`justify-content:space-between` / `margin-left:auto`) SÍ calcaba a "Analizar colección", pero el contenido a la izquierda es más angosto en "Mejorar mi mazo", haciendo que el mismo mecanismo deje un hueco mucho más grande y visible. Cambiado de "empujar al borde" a "pegado al contenido con gap normal".
- [x] **Chequeo de 100 cartas**: nueva tarjeta en el sistema de Recomendaciones existente (mismo componente reusado), en rojo en vez de ámbar para diferenciarla de las heurísticas "A considerar" — es una regla de formato dura, no una sugerencia. Solo aparece si el mazo no tiene exactamente 100. Probada la lógica con varios casos (100/99/101/60/0).
- [x] **Botón de exportar decklist**: junto a "Analizar mazo", en el formato de texto estándar que ya leen Archidekt/Moxfield/MTGGoldfish/Arena. Probada la construcción del texto con datos simulados — el Commander queda separado y no se duplica en la lista principal.
- [x] **Tema claro/oscuro agregado**, con una advertencia honesta documentada: el archivo tiene ~245 colores hardcodeados contra 133 usos de variables CSS. Se consolidaron los patrones más repetidos (fondos de panel, texto principal/secundario — 48 reemplazos) en variables nuevas (`--panel-alt`, `--text-soft`, `--muted2`) antes de armar el tema claro, para que la cobertura sea real y no solo las 6 variables originales. **Bug propio encontrado y corregido en el camino**: el script de consolidación tocó por accidente la propia definición de `:root`, dejando variables auto-referenciadas sin valor real — corregido antes de seguir. No es cobertura 100% de cada color de la app; puede necesitar ajustes puntuales.
- [x] **Explicación de carga de datos entregada al usuario** (investigada en el código, no supuesta): confirmado que el connect inicial solo trae Size + nombres (liviano), y recién al seleccionar un mazo puntual se trae el detalle enriquecido con Scryfall (imágenes, tipos) — por diseño, para no pagar ese costo en los 55 mazos de una sola vez.
- [ ] **Especificación técnica "Deck Metrics Engine" recibida, NO implementada**: es un roadmap de 6 fases (clasificación semántica de cartas, métricas deterministas, simulación Monte Carlo de desarrollo temprano, motor de recomendación IN/OUT basado en evidencia). Se le propuso al usuario arrancar por la Fase 1 exacta que el propio documento indica ("Card Classification Lab, sin recomendaciones todavía"), no una implementación completa de una sola vez. Guardar el .md original como referencia para cuando se decida arrancar.

### v2.5.13 UX / reliability pass
- Archidekt direct-request pacing increased to 850 ms between request starts (~70/min max before retries), below the ~80 requests/60s limit discussed by Archidekt staff; `Retry-After` is now honored up to 45s and the request helper gets 4 attempts.
- Deck-usage sync now performs one automatic recovery pass for up to 5 transiently failed decks, so the common N-1/N state should not require manual Retry.
- Commander theme ordering now prioritizes EDHREC Commander association; locally inferred Tribal can no longer displace a Commander-backed primary theme.
- Deck Metrics card layout fixed at the root cause: metric cards no longer use the global `<header>` element styling.
- Metric cards, Interaction Coverage and Fragile Roles can filter the right-hand deck list.
- "Bottlenecks" renamed/reframed as Fragile Roles with human-readable explanations.
- Development Simulation column definitions added via info controls.
- All metric tables are sortable by clicking column headers.
- Deck inspector now shows Commander under deck name, labels its select as Ordenar, removes “Auditoría”, and uses “Limpiar filtro”.
- Shortlist begins empty on every app start.
- Light theme received explicit surface/contrast overrides across Lab, inspectors, cards, tables, overlays, controls and tabs; Lab amber uses a darker orange in light mode for contrast.

## Planned: Build From Collection
- LAB-first Commander deck generator using owned cards, selected EDHREC theme/tags, semantic roles, dynamic structural targets, mana-base calculation, existing Deck Metrics validation, and explicit shortage/backfill reporting.
- Detailed concept: `docs/Collection_Deck_Builder_Concept.md`.
