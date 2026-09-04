
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const E={
u:$("#username"),pw:$("#password"),check:$("#checkUser"),status:$("#userStatus"),loginPanel:$("#loginPanel"),
accessPublic:$("#accessPublic"),accessPrivate:$("#accessPrivate"),accessLabel:$("#accessLabel"),passwordRow:$("#passwordRow"),
accountBar:$("#accountBar"),accountName:$("#accountName"),accountStats:$("#accountStats"),accountAvatar:$("#accountAvatar"),accessBadge:$("#accessBadge"),accountMetricDecks:$("#accountMetricDecks"),accountMetricUnique:$("#accountMetricUnique"),accountMetricCopies:$("#accountMetricCopies"),accountMetricRecords:$("#accountMetricRecords"),cacheBtn:$("#cacheBtn"),reconnect:$("#reconnect"),logout:$("#logout"),
syncMini:$("#syncMini"),syncMiniTitle:$("#syncMiniTitle"),syncMiniText:$("#syncMiniText"),syncMiniProgress:$("#syncMiniProgress"),syncCount:$("#syncCount"),syncTime:$("#syncTime"),
syncActions:$("#syncActions"),showSyncErrors:$("#showSyncErrors"),retrySync:$("#retrySync"),syncErrorPanel:$("#syncErrorPanel"),syncErrorList:$("#syncErrorList"),closeSyncErrors:$("#closeSyncErrors"),
dashboard:$("#dashboard"),dashText:$("#dashText"),
modeExplore:$("#modeExplore"),modeImprove:$("#modeImprove"),modeRank:$("#modeRank"),modeLab:$("#modeLab"),
exploreFlow:$("#exploreFlow"),improveFlow:$("#improveFlow"),rankFlow:$("#rankFlow"),labFlow:$("#labFlow"),
q:$("#commanderSearch"),dd:$("#dropdown"),chosen:$("#chosen"),chosenCard:$("#chosenCard"),analyzeExplore:$("#analyzeExplore"),
deckSearch:$("#deckSearch"),deckPicker:$("#deckPicker"),deckLoading:$("#deckLoading"),deckSummary:$("#deckSummary"),deckError:$("#deckError"),
deckName:$("#deckName"),deckCommander:$("#deckCommander"),mainCount:$("#mainCount"),sizeAudit:$("#sizeAudit"),deckCommanderArt:$("#deckCommanderArt"),openDeckLink:$("#openDeckLink"),analyzeImprove:$("#analyzeImprove"),exportDeckBtn:$("#exportDeckBtn"),improveTabs:$("#improveTabs"),improveHealthLoading:$("#improveHealthLoading"),improveHealthResults:$("#improveHealthResults"),
improveDeckInspector:$("#improveDeckInspector"),improveDeckInspectorTitle:$("#improveDeckInspectorTitle"),improveDeckInspectorCommander:$("#improveDeckInspectorCommander"),improveDeckInspectorCount:$("#improveDeckInspectorCount"),improveDeckSort:$("#improveDeckSort"),improveDeckFilter:$("#improveDeckFilter"),improveDeckList:$("#improveDeckList"),
rankBtn:$("#rankBtn"),rankResults:$("#rankResults"),rankCommanderSearch:$("#rankCommanderSearch"),rankCommanderDropdown:$("#rankCommanderDropdown"),rankCommanderChosen:$("#rankCommanderChosen"),rankCommanderCard:$("#rankCommanderCard"),rankOneBtn:$("#rankOneBtn"),rankOneResult:$("#rankOneResult"),discoverSearch:$("#discoverSearch"),discoverTagSearch:$("#discoverTagSearch"),discoverTagsToggle:$("#discoverTagsToggle"),discoverSelectedTags:$("#discoverSelectedTags"),discoverFilters:$("#discoverFilters"),discoverStatus:$("#discoverStatus"),discoverGalleryCount:$("#discoverGalleryCount"),discoverLoadProgress:$("#discoverLoadProgress"),discoverLoadProgressBar:$("#discoverLoadProgressBar"),discoverGrid:$("#discoverGrid"),discoverCollapse:$("#discoverCollapse"),compareCommanderSearch:$("#compareCommanderSearch"),compareCommanderDropdown:$("#compareCommanderDropdown"),compareChips:$("#compareChips"),compareBtn:$("#compareBtn"),floatingCompareWrap:$("#floatingCompareWrap"),compareProgressCaption:$("#compareProgressCaption"),hideInDeckToggle:$("#hideInDeckToggle"),
labTabs:$("#labTabs"),labDeckSearch:$("#labDeckSearch"),labDeckPicker:$("#labDeckPicker"),labDeckChosen:$("#labDeckChosen"),labDeckCommanderArt:$("#labDeckCommanderArt"),labDeckName:$("#labDeckName"),labDeckCommander:$("#labDeckCommander"),labMainCount:$("#labMainCount"),labSizeAudit:$("#labSizeAudit"),labOpenDeckLink:$("#labOpenDeckLink"),labAnalyze:$("#labAnalyze"),labExportDeckBtn:$("#labExportDeckBtn"),labLoading:$("#labLoading"),labResults:$("#labResults"),
labDeckInspector:$("#labDeckInspector"),labDeckInspectorTitle:$("#labDeckInspectorTitle"),labDeckInspectorCommander:$("#labDeckInspectorCommander"),labDeckInspectorCount:$("#labDeckInspectorCount"),labDeckSort:$("#labDeckSort"),labDeckFilter:$("#labDeckFilter"),labDeckList:$("#labDeckList"),
loading:$("#loading"),loadingTitle:$("#loadingTitle"),loadingText:$("#loadingText"),loadingElapsed:$("#loadingElapsed"),results:$("#results"),resultModeLabel:$("#resultModeLabel"),title:$("#title"),meta:$("#meta"),
sumTotal:$("#sumTotal"),sumOwned:$("#sumOwned"),sumAvailable:$("#sumAvailable"),sumOccupied:$("#sumOccupied"),sumUsed:$("#sumUsed"),sumMissing:$("#sumMissing"),
filterAll:$("#filterAll"),filterOwned:$("#filterOwned"),filterAvailable:$("#filterAvailable"),
roleFilter:$("#roleFilter"),themeFilter:$("#themeFilter"),themeFilterWrap:$("#themeFilterWrap"),sort:$("#sort"),viewCards:$("#viewCards"),viewList:$("#viewList"),cats:$("#categories"),ct:$("#categoryTitle"),cm:$("#categoryMeta"),grid:$("#grid"),listHeader:$("#listHeader"),empty:$("#empty"),
completeBtn:$("#completeBtn"),exportBtn:$("#exportBtn"),shortlistBtn:$("#shortlistBtn"),shortlistCount:$("#shortlistCount"),historyBtn:$("#historyBtn"),themeToggle:$("#themeToggle"),langToggle:$("#langToggle"),terminalStatus:$("#terminalStatus"),terminalText:$("#terminalText"),
modal:$("#modal"),modalBody:$("#modalBody"),modalClose:$("#modalClose"),drawer:$("#drawer"),drawerTitle:$("#drawerTitle"),drawerBody:$("#drawerBody"),drawerClose:$("#drawerClose"),error:$("#error")
};
let sessionId=null,accessMode="public",mode="explore",commander=null,deckDetail=null,data=null,active=null,view="cards",timer=null,syncTimer=null,lastSyncStatus=null,syncFinalizedAt=null,syncPollFailures=0,decks=[],selectedDeckId=null;
let rankCommander=null,labDeck=null,labDeckDetail=null,collectionFilter="all",labHealth=null,deckInspectorFilter={improve:null,lab:null};
let ownedCommanders=[],allOwnedCommanders=[],compareCommanders=[],discoverTags=[],tagCatalog=[],discoverCollapsed=false,discoverTagsExpanded=false,discoverTagQuery="",hideInDeck=true;
const modeState={
  explore:{data:null,commander:null,activeId:null,filter:"all",role:"",sort:"synergy",view:"cards"},
  improve:{data:null,commander:null,deckDetail:null,selectedDeckId:null,activeId:null,filter:"all",role:"",sort:"synergy",view:"cards"}
};
// v2.4.18 — tema claro/oscuro. Oscuro sigue siendo el default (diseño original); se guarda
// la preferencia en localStorage y se aplica antes de que se note el "flash" del tema viejo.
function applyTheme(theme){
  document.documentElement.setAttribute("data-theme",theme);
  if(E.themeToggle){E.themeToggle.textContent=theme==="light"?"☀":"☾";E.themeToggle.title=theme==="light"?"Cambiar a tema oscuro":"Cambiar a tema claro"}
  localStorage.setItem("ms-theme",theme);
}
let themeTransitionTimer=null,themeApplyTimer=null;
function switchTheme(theme){
  const root=document.documentElement;
  const reduceMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  clearTimeout(themeTransitionTimer);clearTimeout(themeApplyTimer);
  root.classList.remove("theme-transitioning","theme-to-light","theme-to-dark");
  if(reduceMotion){applyTheme(theme);return}
  // A very short neon flicker/sweep hides the abrupt palette swap without making the UI sluggish.
  void root.offsetWidth;
  root.classList.add("theme-transitioning",theme==="light"?"theme-to-light":"theme-to-dark");
  themeApplyTimer=setTimeout(()=>applyTheme(theme),70);
  themeTransitionTimer=setTimeout(()=>root.classList.remove("theme-transitioning","theme-to-light","theme-to-dark"),560);
}
applyTheme(localStorage.getItem("ms-theme")==="light"?"light":"dark");
E.themeToggle?.addEventListener("click",()=>switchTheme(document.documentElement.getAttribute("data-theme")==="light"?"dark":"light"));


// v2.5.8 — lightweight bilingual UI layer.
// Spanish remains the source copy used by the application; English is applied only to
// known UI strings/labels. Card names, deck names and arbitrary user content are never translated.
let uiLang=localStorage.getItem("ms-lang")==="en"?"en":"es";
const UI_EN={
  "Historial":"History","HERRAMIENTA COMMANDER BASADA EN TU COLECCIÓN":"COLLECTION-AWARE COMMANDER TOOL","Colección pública":"Public collection","Colección privada":"Private collection","COLECCIÓN PRIVADA":"PRIVATE COLLECTION","COLECCIÓN PÚBLICA":"PUBLIC COLLECTION",
  "LEER COLECCIÓN PÚBLICA":"READ PUBLIC COLLECTION","Abrir colección →":"Open collection →","No hace falta iniciar sesión si la colección es pública.":"You don't need to sign in for a public collection.",
  "Caché":"Cache","Actualizar / Borrar":"Refresh / Delete","Cambiar colección":"Switch collection","Cerrar sesión":"Sign out",
  "Mazos":"Decks","gestionados":"managed","Cartas únicas":"Unique cards","nombres de carta":"card names","Copias":"Copies","copias en total":"total copies","Registros Archidekt":"Archidekt records","filas informadas":"reported rows",
  "Sincronizando mazos":"Syncing decks","Preparando…":"Preparing…","Preparando cache…":"Preparing cache…","Uso en mazos listo":"Deck usage ready","Sincronización parcial":"Partial sync","Carga incompleta":"Incomplete load","Mazos cargados":"Decks loaded","Recuperando mazos":"Recovering decks","Ver errores":"View errors","Reintentar":"Retry","Recargar mazos":"Reload decks","↻ Recargar mazos":"↻ Reload decks","Recargando mazos":"Reloading decks","Comprobando carga de mazos…":"Checking deck load…","Ahora:":"Now:",
  "Explorar Commander":"Explore Commander","Cualquier leyenda":"Any legendary creature","Mejorar mi mazo":"Improve my deck","Deck existente":"Existing deck","¿Qué Commander puedo armar?":"What Commander can I build?","Uno específico o toda tu colección":"One specific commander or your whole collection","Experimental":"Experimental",
  "EXPLORAR COMMANDER":"EXPLORE COMMANDER","Buscá una criatura legendaria y cruzá EDHREC con tu colección.":"Search for a legendary creature and cross-reference EDHREC with your collection.","Analizar colección →":"Analyze collection →",
  "MEJORAR MI MAZO":"IMPROVE MY DECK","DECK SELECCIONADO":"SELECTED DECK","Analizar mazo →":"Analyze deck →","Exportar decklist ⇩":"Export decklist ⇩","Abrir en Archidekt ↗":"Open in Archidekt ↗","Identificando Commander…":"Identifying Commander…","Leyendo detalle exacto del mazo…":"Reading exact deck details…","Compará cada propuesta IN/OUT por función, curva y redundancia antes de aplicarla al mazo.":"Compare each IN/OUT proposal by function, curve and redundancy before applying it to the deck.","Revisá cada cambio según tu plan de juego, presupuesto y metajuego antes de aplicarlo.":"Review each change against your game plan, budget and metagame before applying it.",
  "Chequeo del mazo":"Deck Check","SALUD DEL MAZO + SALUD DE TEMÁTICAS":"DECK HEALTH + THEME HEALTH","SOLO LAB":"LAB ONLY","Solo LAB":"LAB only","SALUD DEL MAZO · EXPERIMENTAL":"DECK HEALTH · EXPERIMENTAL","EDHREComendaciones":"EDHREC Recommendations","Ordenar":"Sort","Ordenar…":"Sort…","Tipo":"Type","Categoría":"Category","Nombre":"Name","Tipo ↑":"Type ↑","Tipo ↓":"Type ↓","Categoría ↑":"Category ↑","Categoría ↓":"Category ↓","Nombre ↑":"Name ↑","Nombre ↓":"Name ↓",
  "LAB ONLY":"LAB ONLY","Cómo leerlo":"How to read it","Confianza":"Confidence","Alta":"High","Media":"Medium","Baja":"Low",
  "Métricas principales":"Core metrics","Estructura y balance":"Structure & balance","Experimental / heurística":"Experimental / heuristic","Cobertura de interacción":"Interaction coverage","Roles frágiles":"Fragile roles","Simulación de desarrollo":"Development simulation",
  "Turno":"Turn","Mana":"Mana","Productivo":"Productive","Engine":"Engine","Payoff":"Payoff","Threat":"Threat","Commander":"Commander","Carta":"Card","Primario":"Primary","Roles":"Roles","Dependencias":"Dependencies","Synergy tags":"Synergy tags","Func.":"Func.","Conf.":"Conf.",
  "Clasificación semántica":"Semantic classification","Detalles experimentales":"Experimental details","Sin datos.":"No data.","Sin alertas":"No alerts",
  "Resumen del mazo":"Deck overview","Identidad del mazo":"Deck identity","Cambios sugeridos · IN/OUT":"Suggested IN/OUT","No encuentro un corte claro.":"No clear cut found.",
  "Limpiar filtro":"Clear filter","DECK LIST":"DECK LIST","SIZE":"SIZE","cartas":"cards",
  "Actualizar todo ahora":"Refresh everything now","Borrar todo":"Delete everything","Caché local":"Local cache","Actualizar":"Refresh","Borrar":"Delete","Todo":"Everything",
  "Vaciar":"Clear","Agregar al deck actual":"Add to current deck","Quitar":"Remove","Exportar TXT":"Export TXT",
  "RESULTADOS":"RESULTS","Completar a 100":"Complete to 100","Exportar resultados":"Export results","TODAS":"ALL","Todas":"All","En Colección":"In Collection","Disponibles":"Available","Ya en el mazo":"Already in deck","ORDENAR POR":"SORT BY","Sinergia":"Synergy","Inclusión":"Inclusion",
  "SECCIONES EDHREC":"EDHREC SECTIONS","CARTA":"CARD","TIPO":"TYPE","CATEGORÍA":"CATEGORY","COLECCIÓN":"COLLECTION",
  "Tu colección.":"Your collection.","Tu próximo deck.":"Your next deck.",
  "↑ más alto = mejor":"↑ higher = better","↓ más bajo = mejor":"↓ lower = better","◎ mejor cerca de 1.0":"◎ best near 1.0","◌ lectura contextual":"◌ contextual reading","↓ más temprano = mejor":"↓ earlier = better","◌ no es score":"◌ not a score",
  "colores correctos en T3":"correct colors by T3","turnos productivos en T3":"productive turns by T3","densidad de recursos":"resource density","densidad de interacción":"interaction density","densidad de payoffs":"payoff density","densidad de engines":"engine density","roles ponderados por carta":"weighted roles per card","setup por payoff":"setup per payoff","consistencia estimada":"estimated consistency","densidad de sinergia":"synergy density","dependencia del commander":"commander dependency","función sin commander":"function without commander","mana value efectivo":"effective mana value","riesgo estructural":"structural risk","hito ≥50%":"≥50% milestone","capacidad de cierre":"closing ability","simulaciones":"simulations",
  "Cartas":"Cards","Acceso T5":"T5 access","Disponible T5":"Available T5","Fuerte":"Strong","Moderada":"Moderate","Redundancia":"Redundancy","Roles frágiles":"Fragile roles","Sin graveyard":"Without graveyard","Sin artifacts":"Without artifacts","Reducers":"Reducers","Señaladas":"Flagged","Finishers":"Finishers","Extra combats":"Extra combats","Avg mulligans":"Avg mulligans",
  "Todos usan una señal principal comparable y debajo muestran las variables que la explican. Tocá una tarjeta para ver exactamente qué cartas participan.":"Each metric uses a primary signal with the variables that explain it underneath. Click a card to see exactly which deck cards contribute.",
  "Cómo está construido el mazo: redundancia, roles, dependencia, resiliencia y curva real.":"How the deck is built: redundancy, roles, dependency, resilience and real curve.",
  "Señales útiles pero más dependientes de interpretación; permanecen plegadas para reducir ruido.":"Useful signals that depend more on interpretation; kept collapsed to reduce noise.",
  "Cada bloque es clickeable y la cantidad coincide con la deck list filtrada.":"Each block is clickable and its count matches the filtered deck list.",
  "No detecté roles sostenidos por una sola carta.":"No roles supported by a single card were detected.",
  "No encontré un rol crítico sostenido por una sola pieza.":"No critical role supported by a single piece was found.",
  "Lectura de T1–T7 · pasá por la i de cada columna para ver su definición.":"T1–T7 view · hover the info icon on each column for its definition.",
  "Estas métricas son experimentales y se muestran sólo en LAB. No alteran EDHREComendaciones ni los cambios IN/OUT.":"These metrics are validated here. They do not modify EDHREC Recommendations or IN/OUT.",
  "La cifra grande concentra el foco; los datos secundarios explican de dónde sale.":"The large number carries the focus; secondary data explains where it comes from.",
  "Leyendo Commander, Size y cartas del deck…":"Reading Commander, Size and deck cards…","Analizando recomendaciones, estructura, curva e identidad…":"Analyzing recommendations, structure, curve and identity…",
  "DESCUBRIR COMMANDERS":"DISCOVER COMMANDERS","Explorá únicamente criaturas legendarias Commander-legales de tu colección. EDHREC se consulta solo cuando elegís analizar o comparar.":"Explore only Commander-legal legendary creatures from your collection. EDHREC is queried only when you choose to analyze or compare.",
  "FILTRAR POR TAG EDHREC":"FILTER BY EDHREC TAG","Elegí uno o varios. No hace falta recorrer toda la lista.":"Choose one or more. You don't need to browse the whole list.","Ver todos los tags":"Show all tags","COMMANDERS DE TU COLECCIÓN":"COMMANDERS FROM YOUR COLLECTION","Cargando Commanders de tu colección…":"Loading Commanders from your collection…","Ocultar Commanders":"Hide Commanders",
  "COMPARAR SELECCIÓN · HASTA 10":"COMPARE SELECTION · UP TO 10","Elegí entre 2 y 10 criaturas legendarias de tu colección. ManaShelf consulta EDHREC solamente para esas cartas y las ordena por cantidad de recomendaciones que ya tenés.":"Choose 2 to 10 legendary creatures from your collection. ManaShelf queries EDHREC only for those cards and ranks them by how many recommendations you already own.","Comparar selección":"Compare selection","Analizando…":"Analyzing…","progreso de red no cuantificable":"network progress cannot be quantified",
  "⚗ MANASHELF LAB":"⚗ MANASHELF LAB","FUNCIÓN EXPERIMENTAL · SOLO LECTURA · NO MODIFICA ARCHIDEKT":"EXPERIMENTAL FEATURE · READ ONLY · DOES NOT MODIFY ARCHIDEKT","DECK HEALTH + THEME HEALTH":"DECK HEALTH + THEME HEALTH","Analizá un mazo con métricas experimentales sin modificar tu lista en Archidekt.":"Analyze a deck with experimental metrics without modifying your Archidekt list.","Analizar Deck Health →":"Analyze Deck Health →","Clasificando cartas y detectando el plan del mazo…":"Classifying cards and detecting the deck plan…",
  "RECOMENDACIONES EDHREC ÚNICAS":"UNIQUE EDHREC RECOMMENDATIONS","EN COLECCIÓN":"IN COLLECTION","CON COPIA DISPONIBLE":"WITH AN AVAILABLE COPY","SIN COPIA DISPONIBLE":"WITHOUT AN AVAILABLE COPY","NO POSEÍDAS":"NOT OWNED","ROL MANASHELF":"MANASHELF ROLE","Todos los roles ManaShelf":"All ManaShelf roles","TEMÁTICA":"THEME","Todas las temáticas":"All themes","Estas categorías vienen de EDHREC. Los roles del filtro de arriba los infiere ManaShelf.":"These categories come from EDHREC. ManaShelf infers the roles shown in the filter above.","No hay cartas para mostrar con estos filtros.":"No cards match these filters.","Mazos que no pudieron sincronizarse":"Decks that could not be synced","Cerrar":"Close","de las recomendadas que tenés aparecen en al menos un mazo. Ese dato puede superponerse con “disponible” si poseés más de una copia.":"of the recommended cards you own appear in at least one deck. This can overlap with ‘available’ if you own more than one copy.",
  "Resumen":"Summary","Salud":"Health","Estructura":"Structure","Reglas":"Rules","Identidad":"Identity","Métricas":"Metrics","Motor de métricas del mazo":"Deck Metrics Engine","Métricas principales":"Core metrics","Estructura y balance":"Structure & balance","Experimental / heurística":"Experimental / heuristic","Cobertura de interacción":"Interaction coverage","Roles frágiles":"Fragile roles","Simulación de desarrollo":"Development simulation",
  "Fiabilidad de maná":"Mana Reliability","Desarrollo temprano":"Early Development","Flujo de recursos":"Resource Flow","Interacción":"Interaction","Amenazas / Payoffs":"Threats / Payoffs","Densidad de engines":"Engine Density","Densidad funcional":"Functional Density","Consistencia":"Consistency","Densidad de sinergia":"Synergy Density","Dependencia":"Dependency","Resiliencia":"Resilience","MV efectivo":"Effective MV","Riesgo de carta muerta":"Dead-card Risk","Turno de relevancia":"Turn of Relevance","Capacidad de cierre":"Closing Power",
  "Proxy de cartas muertas":"Dead-card proxy","Evidencia de cierre":"Closing evidence","Resumen de resiliencia":"Resilience snapshot","Tocar para ampliar Commander":"Click to enlarge Commander"
};
Object.assign(UI_EN,{
  "Mazo":"Deck","Sin errores.":"No errors.","NO ESTÁ EN TU COLECCIÓN":"NOT IN YOUR COLLECTION","Sin categoría":"Uncategorized",
  "Seleccioná un mazo primero.":"Select a deck first.","No pude identificar el Commander del mazo.":"I couldn't identify the deck's Commander.","Conectá una colección primero.":"Connect a collection first.",
  "Consultando recomendaciones EDHREC…":"Fetching EDHREC recommendations…","Cruzando recomendaciones con tu colección…":"Cross-referencing recommendations with your collection…","Calculando copias disponibles y uso en otros mazos…":"Calculating available copies and use in other decks…","Preparando recomendaciones y disponibilidad…":"Preparing recommendations and availability…",
  "Analizando tu mazo…":"Analyzing your deck…","Analizando Commander…":"Analyzing Commander…","Las cartas más usadas.":"Most-used cards.","Clasificación publicada por EDHREC.":"Ranking published by EDHREC.","No está en tu colección":"Not in your collection",
  "Uso de cartas":"Card usage","No hay cartas poseídas en la shortlist.":"There are no owned cards in the shortlist.","Sinergia EDHREC alta, sin un rol prioritario pendiente":"High EDHREC synergy with no priority role still missing",
  "de tu colección para explorar":"from your collection to explore","Mostrar menos":"Show less","Podés seleccionar hasta 10 Commanders.":"You can select up to 10 Commanders.","Preparando Commanders de tu colección…":"Preparing Commanders from your collection…","Reintentando con carga directa…":"Retrying with direct loading…","No pude cargar Commanders.":"I couldn't load Commanders.","Cruzando con tu colección…":"Cross-referencing with your collection…",
  "La contraseña se envía al bridge de autenticación configurado para obtener una sesión de Archidekt; ManaShelf no la guarda en su caché local.":"The password is sent to the configured authentication bridge to obtain an Archidekt session; ManaShelf does not store it in its local cache.","Borrar texto":"Clear text","Tocá la carta para ampliarla":"Click the card to enlarge","Commander por identificar":"Commander not identified yet","Commander aún no identificado":"Commander not identified yet","Cargando Commander…":"Loading Commander…"
});
const UI_ATTR_EN={
  "usuario de Archidekt":"Archidekt username","contraseña":"password","Buscar criatura legendaria…":"Search legendary creature…","Escribí el nombre del mazo…":"Type the deck name…","Buscar mazo para analizar…":"Search deck to analyze…",
  "Cambiar entre tema oscuro y claro":"Switch between dark and light theme","Cambiar tema":"Change theme","Cambiar idioma":"Change language","Ocultar/mostrar la lista del mazo":"Hide/show deck list","Ordenar deck":"Sort deck","Ordenar deck del LAB":"Sort LAB deck","Información":"Information","Abrir deck list":"Open deck list","Ocultar deck list":"Hide deck list","Tocar para ampliar Commander":"Click to enlarge Commander","Vista grande del Commander":"Large Commander preview"
};
const uiTextOriginal=new WeakMap(),uiAttrOriginal=new WeakMap();
let uiTranslationBusy=false,uiTranslationQueued=false,uiObserver=null;
function translateUiCore(core){
  if(!core)return core;
  if(UI_EN[core])return UI_EN[core];
  let m;
  if((m=core.match(/^Carga incompleta · (\d+)\/(\d+)$/)))return `Incomplete load · ${m[1]}/${m[2]}`;
  if((m=core.match(/^Recuperando mazos · (\d+)\/(\d+)$/)))return `Recovering decks · ${m[1]}/${m[2]}`;
  if((m=core.match(/^Recargando mazos · (\d+)\/(\d+)$/)))return `Reloading decks · ${m[1]}/${m[2]}`;
  if((m=core.match(/^Cargando mazos · (\d+)\/(\d+)$/)))return `Loading decks · ${m[1]}/${m[2]}`;
  if((m=core.match(/^(\d+) mazo(?:s)? no (?:pudo|pudieron) cargarse después de los reintentos automáticos\.$/)))return `${m[1]} deck${Number(m[1])===1?"":"s"} could not be loaded after automatic retries.`;
  if((m=core.match(/^Reintento automático (\d+)\/(\d+)…$/)))return `Automatic retry ${m[1]}/${m[2]}…`;
  if((m=core.match(/^Reintento (\d+)\/(\d+) · (.+)$/)))return `Retry ${m[1]}/${m[2]} · ${m[3]}`;
  if((m=core.match(/^(\d+) desde caché · (\d+) actualizados · carga completa$/)))return `${m[1]} from cache · ${m[2]} refreshed · complete load`;
  if(core==="Reintentando los mazos que faltan…")return "Retrying the missing decks…";
  if(core==="Verificando el catálogo completo…")return "Checking the full deck catalog…";
  if(core==="Preparando caché y verificando mazos…")return "Preparing cache and checking decks…";
  if(core==="No pude consultar el progreso. Podés recargar los mazos manualmente.")return "I couldn't read sync progress. You can reload the decks manually.";
  if(core==="La conexión está demorando; vuelvo a intentar automáticamente…")return "The connection is taking longer; I'll check again automatically…";
  if((m=core.match(/^Commander · (.+)$/)))return `Commander · ${m[1]}`;
  if((m=core.match(/^Size · (\d+) cartas$/)))return `Size · ${m[1]} cards`;
  if((m=core.match(/^Size real del deck · (\d+) carta(?:s)? de Sideboard\/Maybeboard excluida(?:s)?$/)))return `Exact deck size · ${m[1]} Sideboard/Maybeboard card${Number(m[1])===1?"":"s"} excluded`;
  if((m=core.match(/^LAB · motor v(.+) · clasificación v(.+) · simulación v(.+)$/)))return `LAB · engine v${m[1]} · classification v${m[2]} · simulation v${m[3]}`;
  if((m=core.match(/^Filtro: (.+) · (\d+) cartas$/)))return `Filter: ${m[1]} · ${m[2]} cards`;
  if((m=core.match(/^(\d+) criterios evaluados$/)))return `${m[1]} criteria evaluated`;
  if((m=core.match(/^Criterio · (.+)$/)))return `Criterion · ${m[1]}`;
  if((m=core.match(/^Tocar filtra deck list$/)))return "Click to filter deck list";
  if((m=core.match(/^(\d+) cartas$/)))return `${m[1]} cards`;
  if((m=core.match(/^(.+) cartas señaladas · proxy estructural$/)))return `${m[1]} flagged cards · structural proxy`;
  if((m=core.match(/^(.+) con 2 roles · (.+) con 3\+$/)))return `${m[1]} with 2 roles · ${m[2]} with 3+`;
  if((m=core.match(/^Secuencia core (.+) · redundancia (.+)$/)))return `Core sequence ${m[1]} · redundancy ${m[2]}`;
  if((m=core.match(/^sin commander · graveyard (.+)$/)))return `without commander · graveyard ${m[1]}`;
  if((m=core.match(/^primer turno con ≥50% de milestone observable$/)))return "first turn with ≥50% observable milestone";
  if((m=core.match(/^simulaciones · avg mulligans (.+)$/)))return `simulations · avg mulligans ${m[1]}`;
  if((m=core.match(/^Detecté (\d+) roles con muy poca redundancia\.(.*)$/)))return `I found ${m[1]} roles with very little redundancy.${m[2]?" They are not automatically bad; they show where one piece carries a function.":""}`;
  if(core==="No detecté roles sostenidos por una sola carta.")return "No roles are supported by a single card.";
  if(core==="Cada bloque es clickeable y la cantidad coincide con la deck list filtrada.")return "Each block is clickable and its count matches the filtered deck list.";
  if(core==="Lectura de T1–T7 · pasá por la i de cada columna para ver su definición.")return "T1–T7 view · hover the info icon on each column to see its definition.";
  if(core.includes("iteraciones · no simula oponentes ni combate real"))return core.replace("iteraciones · no simula oponentes ni combate real","iterations · does not simulate opponents or real combat");
  if((m=core.match(/^Commander por identificar$/)))return "Commander not identified yet";
  if((m=core.match(/^Commander aún no identificado$/)))return "Commander not identified yet";
  if((m=core.match(/^Commander se identificará al analizar$/)))return "Commander will be identified during analysis";
  if(core==="No hay cartas para este filtro.")return "No cards match this filter.";
  if(core==="conteo no disponible")return "count unavailable";
  if(core==="Sin texto Oracle disponible.")return "No Oracle text available.";
  if(core==="Piso orientativo")return "Guideline floor";
  if(core==="Ver cartas por CMC")return "View cards by CMC";
  if(core==="A considerar")return "Worth considering";
  if(core==="A revisar")return "Review";
  if(core==="Faltan cartas")return "Cards missing";
  if(core==="Sobran cartas")return "Too many cards";
  if(core==="Salud estructural")return "Structural health";
  if(core==="Estructura del mazo")return "Deck structure";
  if(core==="Recomendaciones estructurales")return "Structural recommendations";
  if(core==="A considerar")return "Worth considering";
  if(core==="Criterios evaluados")return "Criteria evaluated";
  if(core==="Reglas evaluadas")return "Rules evaluated";
  if(core==="Identidad del mazo")return "Deck identity";
  if(core==="Curva de maná")return "Mana curve";
  if(core==="Temáticas")return "Themes";
  if(core==="Tipos de carta")return "Card types";
  if(core==="Temas inferidos")return "Inferred themes";
  if(core==="Tipo primario")return "Primary type";
  if(core==="Análisis local completo.")return "Local analysis complete.";
  return core;
}
function translateUiText(raw){
  const lead=raw.match(/^\s*/)?.[0]||"",trail=raw.match(/\s*$/)?.[0]||"",core=raw.trim();
  return lead+translateUiCore(core)+trail;
}
function walkUi(root,fn){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(n){const p=n.parentElement;if(!p||["SCRIPT","STYLE","CODE","PRE"].includes(p.tagName))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT}});
  let n;while((n=walker.nextNode()))fn(n);
}
function startUiObserver(){
  if(!uiObserver)return;
  uiObserver.observe(document.body,{subtree:true,childList:true,characterData:true});
}
function applyLanguage(lang=uiLang){
  uiLang=lang==="en"?"en":"es";
  localStorage.setItem("ms-lang",uiLang);
  document.documentElement.lang=uiLang;

  // Important: the observer must not see DOM writes made by the translator itself.
  // v2.5.8 observed those writes and recursively translated forever.
  uiTranslationBusy=true;
  uiObserver?.disconnect();
  try{
    if(E.langToggle){
      const label=uiLang.toUpperCase(),title=uiLang==="es"?"Cambiar a English":"Switch to Español";
      if(E.langToggle.textContent!==label)E.langToggle.textContent=label;
      if(E.langToggle.title!==title)E.langToggle.title=title;
      if(E.langToggle.getAttribute("aria-label")!==title)E.langToggle.setAttribute("aria-label",title);
    }
    walkUi(document.body,node=>{
      if(!uiTextOriginal.has(node))uiTextOriginal.set(node,node.nodeValue);
      const original=uiTextOriginal.get(node),next=uiLang==="en"?translateUiText(original):original;
      if(node.nodeValue!==next)node.nodeValue=next;
    });
    document.querySelectorAll("[placeholder],[title],[aria-label]").forEach(el=>{
      if(!uiAttrOriginal.has(el))uiAttrOriginal.set(el,{placeholder:el.getAttribute("placeholder"),title:el.getAttribute("title"),aria:el.getAttribute("aria-label")});
      const o=uiAttrOriginal.get(el);
      for(const [attr,val] of [["placeholder",o.placeholder],["title",o.title],["aria-label",o.aria]]){
        if(val===null)continue;
        const next=uiLang==="en"?(UI_ATTR_EN[val]||translateUiCore(val)):val;
        if(el.getAttribute(attr)!==next)el.setAttribute(attr,next);
      }
    });
  }finally{
    uiTranslationBusy=false;
    startUiObserver();
  }
}
function scheduleLanguageRefresh(){
  if(uiTranslationBusy||uiLang!=="en"||uiTranslationQueued)return;
  uiTranslationQueued=true;
  requestAnimationFrame(()=>{
    uiTranslationQueued=false;
    if(uiLang==="en")applyLanguage("en");
  });
}
E.langToggle?.addEventListener("click",()=>applyLanguage(uiLang==="es"?"en":"es"));
uiObserver=new MutationObserver(muts=>{
  if(uiTranslationBusy||uiLang!=="en")return;
  let needs=false;
  for(const m of muts){
    if(m.type==="characterData"){
      const node=m.target,stored=uiTextOriginal.get(node);
      // A dynamic renderer may reuse a text node with new Spanish source copy.
      // Store that new source only if it is not the translation we produced.
      if(stored!==undefined&&node.nodeValue!==translateUiText(stored))uiTextOriginal.set(node,node.nodeValue);
      needs=true;
    }else if(m.addedNodes.length){
      needs=true;
    }
  }
  if(needs)scheduleLanguageRefresh();
});
startUiObserver();
requestAnimationFrame(()=>applyLanguage(uiLang));
let shortlist=[],history=JSON.parse(localStorage.getItem("ms-history")||"[]");
localStorage.removeItem("ms-shortlist");
// v2.4.14 — deck inspector (lista de mazo a la derecha) colapsable: en monitores normales
// (no ultrawide) ocupaba ancho fijo todo el tiempo, incómodo con texto más grande. Se puede
// plegar a una pestaña angosta con un click; se recuerda la preferencia entre sesiones.
// Keep each sticky analysis ribbon physically outside its matching fixed Deck List.
// The reserve is measured from the real DOM rectangles, so it remains correct if drawer
// width, zoom, viewport size or the collapsed pill changes later.
let floatingNavGeometryRaf=0;
function syncFloatingNavGeometry(){
  cancelAnimationFrame(floatingNavGeometryRaf);
  floatingNavGeometryRaf=requestAnimationFrame(()=>{
    const main=document.querySelector("main");if(!main)return;
    const mainRect=main.getBoundingClientRect();
    for(const [tabs,panel,active] of [[E.improveTabs,E.improveDeckInspector,mode==="improve"],[E.labTabs,E.labDeckInspector,mode==="lab"]]){
      if(!tabs)continue;
      let reserve=0;
      if(active&&panel&&!panel.classList.contains("hidden")&&tabs.classList.contains("floating")&&!tabs.classList.contains("hidden")){
        const target=panel.classList.contains("collapsed")?panel.querySelector(".deck-inspector-toggle"):panel;
        if(target&&getComputedStyle(target).position==="fixed"){
          const r=target.getBoundingClientRect();
          if(r.width>0&&r.left<mainRect.right&&r.right>mainRect.left)reserve=Math.max(0,Math.ceil(mainRect.right-r.left+12));
        }
      }
      tabs.style.setProperty("--deck-list-reserve",`${reserve}px`);
    }
  });
}
window.addEventListener("resize",syncFloatingNavGeometry,{passive:true});

let deckInspectorCollapsed=localStorage.getItem("ms-inspector-collapsed")==="1";
function applyDeckInspectorCollapsed(){
  $$(".deck-inspector").forEach(el=>el.classList.toggle("collapsed",deckInspectorCollapsed));
  $$(".deck-inspector-toggle").forEach(b=>{
    b.innerHTML=deckInspectorCollapsed?`<span class="deck-toggle-triangle expand">◀</span><span class="deck-toggle-label">Deck List</span>`:`<span class="deck-toggle-triangle collapse">▶</span>`;
    b.title=deckInspectorCollapsed?(uiLang==="en"?"Open deck list":"Abrir deck list"):(uiLang==="en"?"Collapse deck list":"Colapsar deck list");
    b.setAttribute("aria-label",b.title);
  });
  document.body.classList.toggle("inspector-collapsed",deckInspectorCollapsed);
  syncFloatingNavGeometry();
}
$$(".deck-inspector-toggle").forEach(b=>b.onclick=()=>{deckInspectorCollapsed=!deckInspectorCollapsed;localStorage.setItem("ms-inspector-collapsed",deckInspectorCollapsed?"1":"0");applyDeckInspectorCollapsed()});
applyDeckInspectorCollapsed();

// EXPERIMENTAL / easy to remove: terminal-style sticky context indicator.
let terminalTypeTimer=null,terminalLastContext="",terminalScrollQueued=false;
function terminalDeckName(){
  if(mode==="lab")return labDeckDetail?.name||labDeck?.name||"";
  if(mode==="improve")return deckDetail?.name||"";
  if(mode==="explore")return commander?.name||"";
  return "";
}
function terminalSectionName(){
  const visibleSections=$$(".health-section").filter(el=>{const r=el.getBoundingClientRect(),st=getComputedStyle(el);return st.display!=="none"&&r.bottom>72&&r.top<innerHeight});
  const active=visibleSections.find(el=>{const r=el.getBoundingClientRect();return r.top<=105&&r.bottom>105})||visibleSections.sort((a,b)=>Math.abs(a.getBoundingClientRect().top-105)-Math.abs(b.getBoundingClientRect().top-105))[0];
  const h=active?.querySelector(".lab-section-title h3, h3");if(h?.textContent?.trim())return h.textContent.trim();
  if(mode==="improve"&&improveAnalysisReady){const tab=E.improveTabs?.querySelector("button.active");if(tab)return tab.textContent.trim()}
  const flow={explore:E.exploreFlow,improve:E.improveFlow,rank:E.rankFlow,lab:E.labFlow}[mode];
  return flow?.querySelector(".flow-head>span")?.textContent?.trim()||({explore:"Explorar Commander",improve:"Mejorar mi mazo",rank:"Descubrir Commanders",lab:"ManaShelf Lab"}[mode]||"");
}
function terminalWrite(text,{force=false}={}){
  if(!E.terminalText)return;
  const clean=String(text||"ready").replace(/\s+/g," ").trim();
  if(!force&&clean===terminalLastContext)return;
  terminalLastContext=clean;clearInterval(terminalTypeTimer);E.terminalText.textContent="";
  let i=0;terminalTypeTimer=setInterval(()=>{E.terminalText.textContent=clean.slice(0,++i);if(i>=clean.length){clearInterval(terminalTypeTimer);terminalTypeTimer=null}},22);
}
function terminalUpdateContext(force=false){
  const deck=terminalDeckName(),section=terminalSectionName();
  const text=deck?`${deck}  //  ${section||"deck"}`:(section||"ready");
  terminalWrite(text,{force});
}
addEventListener("scroll",()=>{if(terminalScrollQueued)return;terminalScrollQueued=true;requestAnimationFrame(()=>{terminalScrollQueued=false;terminalUpdateContext(false)})},{passive:true});
addEventListener("resize",()=>terminalUpdateContext(false));
// v2.4.4 — orden de "últimos accedidos" para el buscador de mazos. Prioridad: el updatedAt
// real de Archidekt (ahora que /api/login lo trae desde /api/decks/v3/?orderBy=-updatedAt,
// el mismo endpoint confiable que ya usaba la colección pública). Si a algún mazo le falta
// ese dato, se usa como respaldo el registro local de qué mazos abrió el usuario en ManaShelf.
let recentDecks=JSON.parse(localStorage.getItem("ms-recent-decks")||"{}");
function touchRecentDeck(id){recentDecks[String(id)]=Date.now();localStorage.setItem("ms-recent-decks",JSON.stringify(recentDecks))}
function sortByRecent(list){
  return [...list].sort((a,b)=>{
    const ua=Date.parse(a.updatedAt||"")||0,ub=Date.parse(b.updatedAt||"")||0;
    if(ua!==ub)return ub-ua; // updatedAt real de Archidekt, más reciente primero
    const ta=recentDecks[String(a.id)]||0,tb=recentDecks[String(b.id)]||0;
    if(ta!==tb)return tb-ta; // respaldo: último abierto en ManaShelf
    return 0; // sin ninguna señal: se mantiene el orden original (estable)
  });
}

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const key=s=>String(s||"").toLocaleLowerCase("en-US");
async function req(url,opt={}){const r=await fetch(url,opt),d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.error||"Error"),{detail:d.detail});return d}
const authHeaders=()=>({"Content-Type":"application/json","X-ManaShelf-Session":sessionId||""});
let errorToastTimer=null;
function showError(e){
  clearTimeout(errorToastTimer);
  E.error.innerHTML=`<button type="button" class="toast-close" aria-label="Cerrar">×</button><div><strong>${esc(e.message||e)}</strong>${e.detail?`<small>${esc(e.detail)}</small>`:""}</div>`;
  E.error.classList.add("error-toast");
  E.error.classList.remove("hidden","toast-leaving");
  const close=()=>{E.error.classList.add("toast-leaving");setTimeout(()=>E.error.classList.add("hidden"),180)};
  E.error.querySelector(".toast-close").onclick=close;
  errorToastTimer=setTimeout(close,6500);
}
function clearError(){clearTimeout(errorToastTimer);E.error.classList.add("hidden");E.error.classList.remove("toast-leaving")}
function elapsed(ms){if(!ms)return"";const s=Math.max(0,Math.round((Date.now()-ms)/1000));return s<60?`${s}s`:`${Math.floor(s/60)}m ${s%60}s`}
function saveLists(){localStorage.setItem("ms-shortlist",JSON.stringify(shortlist));E.shortlistCount.textContent=shortlist.length}
function download(name,text){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function openModal(html){E.modalBody.innerHTML=html;E.modal.classList.remove("hidden")}
E.modalClose.onclick=()=>E.modal.classList.add("hidden");E.modal.onclick=e=>{if(e.target===E.modal)E.modal.classList.add("hidden")};
E.drawerClose.onclick=()=>E.drawer.classList.add("hidden");

function setAccess(m){
  accessMode=m;const priv=m==="private";
  E.accessPublic.classList.toggle("active",!priv);E.accessPrivate.classList.toggle("active",priv);
  E.passwordRow.classList.toggle("hidden",!priv);
  E.accessLabel.textContent=priv?"CONECTAR CUENTA PRIVADA":"LEER COLECCIÓN PÚBLICA";
  E.status.textContent=priv?"La contraseña se envía al bridge de autenticación configurado para obtener una sesión de Archidekt; ManaShelf no la guarda en su caché local.":"No hace falta iniciar sesión si la colección es pública.";
  E.check.textContent=priv?"Conectar cuenta →":"Abrir colección →";
}
E.accessPublic.onclick=()=>setAccess("public");E.accessPrivate.onclick=()=>setAccess("private");

function mergeDeckCatalogRows(rows=[]){
  const byId=new Map((decks||[]).map(d=>[Number(d.id),d]));
  decks=(rows||[]).map(row=>{
    const current=byId.get(Number(row.id))||{};
    const keep={
      commander:current.commander||null,
      commanderImage:current.commanderImage||null,
      commanderImageLarge:current.commanderImageLarge||null,
      previewMethod:current.previewMethod||null
    };
    Object.assign(current,row);
    if(!row.commander&&keep.commander)current.commander=keep.commander;
    if(!row.commanderImage&&keep.commanderImage)current.commanderImage=keep.commanderImage;
    if(!row.commanderImageLarge&&keep.commanderImageLarge)current.commanderImageLarge=keep.commanderImageLarge;
    if(!row.previewMethod&&keep.previewMethod)current.previewMethod=keep.previewMethod;
    return current;
  });
}
async function loadDeckCatalog(){
  try{
    // First read is cheap. In a healthy/current cache every deck already has Commander
    // metadata because private sync now treats it as required.
    let d=await req("/api/deck-catalog",{headers:{"X-ManaShelf-Session":sessionId}});
    // One centralized fallback for legacy/public caches. Do not hydrate previews per row:
    // resolve missing Commander identity once, then batch Scryfall images for the catalog.
    if(Number(d.missingMetadata||0)>0||Number(d.missingImages||0)>0){
      if(E.syncMini&&!E.syncMini.classList.contains("hidden")){
        E.syncMiniTitle.textContent="Completando catálogo";
        E.syncMiniText.textContent=Number(d.missingMetadata||0)>0?`Identificando Commander en ${d.missingMetadata} mazo${Number(d.missingMetadata)===1?"":"s"}…`:`Recuperando ${d.missingImages} miniatura${Number(d.missingImages)===1?"":"s"}…`;
      }
      d=await req("/api/deck-catalog?hydrate=1",{headers:{"X-ManaShelf-Session":sessionId}});
    }
    mergeDeckCatalogRows(d.decks||[]);
    renderDeckPicker(!E.deckPicker.classList.contains("hidden"));
    renderLabDeckPicker?.(!E.labDeckPicker?.classList.contains("hidden"));
    if(Number(d.missingMetadata||0)>0||Number(d.missingImages||0)>0)console.warn(`[deck-catalog] hydration incomplete: ${d.missingMetadata||0} Commander metadata, ${d.missingImages||0} images`);
  }catch(e){console.warn("[deck-catalog] load failed",e)}
}
async function pollSync(){
  if(!sessionId||accessMode!=="private")return;
  try{
    const previousStatus=lastSyncStatus?.status;
    const s=await req("/api/sync-status",{headers:{"X-ManaShelf-Session":sessionId}});lastSyncStatus=s;syncPollFailures=0;
    const total=Math.max(0,Number(s.totalDecks||0)),done=Math.max(0,Number(s.completedDecks||0)),failed=Math.max(0,Number(s.failedDecks||0));
    E.syncMiniProgress.max=Math.max(1,total||1);E.syncMiniProgress.value=Math.min(total||1,done);E.syncCount.textContent=`${done} / ${total}`;E.syncTime.textContent=elapsed(s.startedAt);
    if(s.status==="done"||s.status==="done_with_errors"){
      if(failed){
        E.syncMiniTitle.textContent=`Carga incompleta · ${done}/${total}`;
        E.syncMiniText.textContent=`${failed} mazo${failed===1?"":"s"} no ${failed===1?"pudo":"pudieron"} cargarse después de los reintentos automáticos.`;
        E.syncActions.classList.remove("hidden");
      }else{
        E.syncMiniTitle.textContent="Mazos cargados";
        E.syncMiniText.textContent=`${s.cachedDecks||0} desde caché · ${s.fetchedDecks||0} actualizados · carga completa`;
        E.syncActions.classList.add("hidden");
      }
      if(syncTimer){clearInterval(syncTimer);syncTimer=null}
      const finalizedKey=Number(s.finishedAt||0)||`${s.status}:${done}:${failed}`;
      if(syncFinalizedAt!==finalizedKey){
        syncFinalizedAt=finalizedKey;
        await loadDeckCatalog();
        if(data)await runAnalysis(true);
      }
    }else{
      syncFinalizedAt=null;
      if(s.phase==="preview_hydration"){
        E.syncMiniTitle.textContent=`Preparando previews · ${done}/${total}`;
        E.syncMiniText.textContent=s.currentDeck||"Identificando Commanders de cachés anteriores…";
      }else if(s.phase==="auto_retry"){
        E.syncMiniTitle.textContent=`Recuperando mazos · ${done}/${total}`;
        E.syncMiniText.textContent=s.currentDeck||`Reintento automático ${s.retryRound||1}/${s.maxRetryRounds||3}…`;
      }else if(s.phase==="manual_retry"){
        E.syncMiniTitle.textContent=`Recargando mazos · ${done}/${total}`;
        E.syncMiniText.textContent=s.currentDeck?`Ahora: ${s.currentDeck}`:"Reintentando los mazos que faltan…";
      }else{
        E.syncMiniTitle.textContent=`Cargando mazos · ${done}/${total}`;
        E.syncMiniText.textContent=s.currentDeck?`Ahora: ${s.currentDeck}`:"Preparando caché y verificando mazos…";
      }
      E.syncActions.classList.add("hidden");
    }
    return s;
  }catch(e){
    syncPollFailures++;
    E.syncMiniTitle.textContent="Comprobando carga de mazos…";
    E.syncMiniText.textContent=syncPollFailures>=2?"No pude consultar el progreso. Podés recargar los mazos manualmente.":"La conexión está demorando; vuelvo a intentar automáticamente…";
    if(syncPollFailures>=2)E.syncActions.classList.remove("hidden");
    return null;
  }
}
E.showSyncErrors.onclick=()=>{const errors=lastSyncStatus?.errors||[];E.syncErrorList.innerHTML=errors.length?errors.map(e=>`<div class="sync-error-row"><strong>${esc(e.deckName)}</strong><span>${esc(e.error)}</span></div>`).join(""):"Sin errores.";E.syncErrorPanel.classList.remove("hidden")};
E.closeSyncErrors.onclick=()=>E.syncErrorPanel.classList.add("hidden");
E.retrySync.onclick=async()=>{
  try{
    E.retrySync.disabled=true;E.syncActions.classList.add("hidden");syncFinalizedAt=null;syncPollFailures=0;
    const hasFailures=Number(lastSyncStatus?.failedDecks||0)>0;
    await req(hasFailures?"/api/sync-retry":"/api/decks/sync",{method:"POST",headers:authHeaders(),body:"{}"});
    E.syncMiniTitle.textContent=hasFailures?"Recargando mazos":"Cargando mazos";
    E.syncMiniText.textContent=hasFailures?"Reintentando los mazos que faltan…":"Verificando el catálogo completo…";
    const s=await pollSync();
    if(s?.status!=="done"&&s?.status!=="done_with_errors"&&!syncTimer)syncTimer=setInterval(pollSync,1200);
  }catch(e){showError(e);E.syncActions.classList.remove("hidden")}
  finally{E.retrySync.disabled=false}
};

let deckSizePollTimer=null,deckSizePollAttempts=0;
async function pollDeckSizes(){
  if(!sessionId)return;
  deckSizePollAttempts++;
  try{
    const r=await req("/api/decks/sizes",{headers:authHeaders()});
    const sizes=r.sizes||{};
    let changed=false,pending=0;
    for(const d of decks){
      if(d.exactMainCount==null){
        if(sizes[d.id]!=null){d.exactMainCount=sizes[d.id];d.mainCount=sizes[d.id];changed=true}
        else pending++;
      }
    }
    if(changed){renderDeckPicker(!E.deckPicker.classList.contains("hidden"));renderLabDeckPicker(!E.labDeckPicker?.classList.contains("hidden"))}
    if((!pending||deckSizePollAttempts>=20)&&deckSizePollTimer){clearInterval(deckSizePollTimer);deckSizePollTimer=null}
  }catch{if(deckSizePollAttempts>=20&&deckSizePollTimer){clearInterval(deckSizePollTimer);deckSizePollTimer=null}}
}
E.check.onclick=async()=>{
  const username=E.u.value.trim();if(!username)return showError(new Error("Ingresá el usuario de Archidekt."));
  if(accessMode==="private"&&!E.pw.value)return showError(new Error("Ingresá la contraseña para una colección privada."));
  clearError();E.status.textContent=accessMode==="private"?"Autenticando e importando colección…":"Leyendo colección pública…";
  try{
    const endpoint=accessMode==="private"?"/api/login":"/api/public-login";
    const body=accessMode==="private"?{username,password:E.pw.value}:{username};
    const d=await req(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    sessionId=d.sessionId;E.pw.value="";decks=d.decks||[];
    E.accountName.textContent=d.username||username;
    E.accountStats.textContent=`Archidekt · ${Number(d.archidektRecords||0).toLocaleString("es-AR")} registros · ${d.totalDecks} mazos`;
    if(E.accountAvatar)E.accountAvatar.textContent=(d.username||username||"M").trim().charAt(0).toUpperCase();
    if(E.accountMetricDecks)E.accountMetricDecks.textContent=Number(d.totalDecks||0).toLocaleString("es-AR");
    if(E.accountMetricUnique)E.accountMetricUnique.textContent=Number(d.uniqueCards||0).toLocaleString("es-AR");
    if(E.accountMetricCopies)E.accountMetricCopies.textContent=Number(d.totalCopies||0).toLocaleString("es-AR");
    if(E.accountMetricRecords)E.accountMetricRecords.textContent=Number(d.archidektRecords||0).toLocaleString("es-AR");
    E.accessBadge.textContent=accessMode==="private"?(uiLang==="en"?"PRIVATE COLLECTION":"COLECCIÓN PRIVADA"):(uiLang==="en"?"PUBLIC COLLECTION":"COLECCIÓN PÚBLICA");
    E.loginPanel.classList.add("panel-leaving");
    await new Promise(r=>setTimeout(r,180));
    E.loginPanel.classList.add("hidden");E.loginPanel.classList.remove("panel-leaving");
    E.accountBar.classList.remove("hidden");E.dashboard.classList.remove("hidden");
    requestAnimationFrame(()=>{E.accountBar.classList.add("panel-entered");E.dashboard.classList.add("panel-entered")});
    E.dashText.innerHTML=`<span class="collection-chip collection-truth"><strong>${d.archidektRecords}</strong><small>registros de colección</small></span><span class="collection-chip"><strong>${d.uniqueCards}</strong><small>nombres únicos</small></span><span class="collection-chip"><strong>${d.totalCopies||0}</strong><small>copias totales</small></span><span class="collection-chip"><strong>${d.totalDecks}</strong><small>mazos</small></span>`;
    E.syncMini.classList.toggle("hidden",accessMode!=="private");localStorage.setItem("ms-user",username);
    renderDeckPicker();if(accessMode==="private"){const firstSync=await pollSync();if(firstSync?.status!=="done"&&firstSync?.status!=="done_with_errors")syncTimer=setInterval(pollSync,1200)}else await loadDeckCatalog();
    if(deckSizePollTimer)clearInterval(deckSizePollTimer);
    deckSizePollAttempts=0;deckSizePollTimer=setInterval(pollDeckSizes,3000);pollDeckSizes();
  }catch(e){showError(e);E.status.textContent="No pude abrir la colección."}
};
E.reconnect.onclick=async()=>{try{if(sessionId)await req("/api/logout",{method:"POST",headers:authHeaders(),body:"{}"})}catch{}location.reload()};
E.logout.onclick=async()=>{try{if(sessionId)await req("/api/logout",{method:"POST",headers:authHeaders(),body:"{}"})}catch{}if(syncTimer)clearInterval(syncTimer);sessionId=null;data=null;deckDetail=null;commander=null;E.results.classList.add("hidden");E.dashboard.classList.add("hidden");E.accountBar.classList.add("hidden");E.loginPanel.classList.remove("hidden");E.status.textContent="Sesión local cerrada. Archidekt.com no fue modificado."};

function saveModeState(name){
  if(!["explore","improve"].includes(name))return;
  const s=modeState[name];
  s.data=data;s.commander=commander;s.activeId=active?.id||null;s.filter=collectionFilter;s.role=E.roleFilter?.value||"";s.theme=E.themeFilter?.value||"";s.sort=E.sort?.value||"synergy";s.view=view;
  if(name==="improve"){s.deckDetail=deckDetail;s.selectedDeckId=selectedDeckId}
}
function restoreModeState(name){
  if(!["explore","improve"].includes(name)){E.results.classList.add("hidden");return}
  const s=modeState[name];
  data=s.data;commander=s.commander;collectionFilter=s.filter||"all";view=s.view||"cards";
  if(name==="improve"){deckDetail=s.deckDetail;selectedDeckId=s.selectedDeckId}
  if(!data){active=null;E.results.classList.add("hidden");return}
  buildRoleFilter();buildThemeFilter();
  E.roleFilter.value=[...E.roleFilter.options].some(o=>o.value===s.role)?s.role:"";
  if(E.themeFilter)E.themeFilter.value=[...E.themeFilter.options].some(o=>o.value===s.theme)?s.theme:"";
  E.sort.value=s.sort||"synergy";
  setCollectionFilter(collectionFilter,false);
  renderCats();
  active=data.categories.find(c=>c.id===s.activeId)||data.categories.find(c=>c.matches.length)||data.categories[0]||null;
  if(active){[...E.cats.children].forEach(b=>b.classList.toggle("active",b.dataset.id===active.id));render()}
  const ownedN=Number(data.summary?.recommendedOwned||0),availableN=Number(data.summary?.withFreeCopies||0),missingN=Number(data.summary?.missing||0);
  E.sumTotal.textContent=ownedN+missingN;E.sumOwned.textContent=ownedN;E.sumAvailable.textContent=availableN;E.sumOccupied.textContent=Math.max(0,ownedN-availableN);E.sumUsed.textContent=Number(data.summary?.usedInDecks||0);E.sumMissing.textContent=missingN;
  E.resultModeLabel.textContent=name==="improve"?"MEJORAR MI MAZO":"EXPLORAR COMMANDER";
  E.title.textContent=name==="improve"?`${deckDetail?.name||""} · ${commander?.name||""}`:commander?.name||"";
  const sync=data.deckSync||{};E.meta.textContent=accessMode==="private"?(sync.status==="done"?`Uso en mazos sincronizado: ${sync.syncedDecks||0}/${sync.totalDecks||0}`:`Resultados listos · uso en mazos ${sync.syncedDecks||0}/${sync.totalDecks||0}`):"Colección pública · uso cruzado entre mazos requiere login";
  E.results.classList.remove("hidden");
  E.viewCards.classList.toggle("active",view==="cards");E.viewList.classList.toggle("active",view==="list");
}
function setMode(m){
  if(m===mode)return;
  saveModeState(mode);
  mode=m;
  for(const [name,btn,flow] of [["explore",E.modeExplore,E.exploreFlow],["improve",E.modeImprove,E.improveFlow],["rank",E.modeRank,E.rankFlow],["lab",E.modeLab,E.labFlow]]){btn.classList.toggle("active",m===name);flow.classList.toggle("hidden",m!==name)}
  restoreModeState(m);
  if(E.hideInDeckToggle)E.hideInDeckToggle.classList.toggle("hidden",m!=="improve");
  document.body.classList.toggle("improve-with-inspector",m==="improve"&&!E.improveDeckInspector.classList.contains("hidden"));
  syncImproveRibbon();syncLabRibbon();syncFloatingNavGeometry();
  setTimeout(()=>terminalUpdateContext(true),0);
}

E.modeExplore.onclick=()=>setMode("explore");E.modeImprove.onclick=()=>setMode("improve");E.modeRank.onclick=()=>{setMode("rank");loadDiscovery()};E.modeLab.onclick=()=>setMode("lab");
$$("[data-go]").forEach(b=>b.onclick=()=>setMode(b.dataset.go));
function addClearButtons(){
  for(const input of [E.u,E.pw,E.q,E.deckSearch,E.rankCommanderSearch,E.labDeckSearch,E.discoverSearch,E.discoverTagSearch,E.compareCommanderSearch]){
    if(!input||input.parentElement?.querySelector(".input-clear"))continue;
    const b=document.createElement("button");b.type="button";b.className="input-clear";b.setAttribute("aria-label","Borrar texto");b.textContent="×";
    b.onclick=()=>{input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));input.focus()};
    input.parentElement.appendChild(b);
  }
}
addClearButtons();
terminalUpdateContext(true);

E.q.oninput=()=>{clearTimeout(timer);commander=null;E.chosen.classList.add("hidden");const q=E.q.value.trim();if(q.length<2){E.dd.classList.add("hidden");return}timer=setTimeout(async()=>{try{const d=await req(`/api/commanders?q=${encodeURIComponent(q)}`);E.dd.innerHTML="";for(const c of d.results||[]){const b=document.createElement("button");b.className="drop";b.innerHTML=`${c.image?`<img src="${esc(c.image)}">`:""}<span><strong>${esc(c.name)}</strong><small>${esc(c.typeLine)}</small></span>`;b.onclick=()=>chooseCommander(c);wireCommanderPreview(b.querySelector("img"),c,c.image||"");E.dd.appendChild(b)}E.dd.classList.remove("hidden")}catch(e){showError(e)}},220)};
const preloadedImages=new Set();
function preloadImage(src){
  if(!src||preloadedImages.has(src))return;
  preloadedImages.add(src);
  const img=new Image();img.decoding="async";img.src=src;
}
function ensureCardZoom(){
  let layer=document.querySelector(".card-zoom-layer");
  if(layer)return layer;
  layer=document.createElement("div");layer.className="card-zoom-layer hidden";layer.innerHTML=`<button type="button" class="card-zoom-close" aria-label="${uiLang==="en"?"Close":"Cerrar"}">×</button><img alt="">`;
  layer.onclick=e=>{if(e.target===layer||e.target.closest(".card-zoom-close"))layer.classList.add("hidden")};
  document.addEventListener("keydown",e=>{if(e.key==="Escape")layer.classList.add("hidden")});
  document.body.appendChild(layer);return layer;
}
function showCardZoom(src,alt="Card"){
  if(!src)return;
  const layer=ensureCardZoom(),img=layer.querySelector("img");img.src=src;img.alt=alt;layer.classList.remove("hidden");
}
function commanderModal(c={},options={}){
  const normal=c.image||c.imageLarge||c.largeImage||"",large=c.largeImage||c.imageLarge||normal;
  const name=c.name||"Commander",loading=Boolean(options.loading);
  openModal(`<div class="commander-modal commander-modal-preview" data-commander-preview-name="${esc(name)}">${normal?`<div class="commander-preview-image-wrap"><img class="commander-modal-image" src="${esc(normal)}" data-large-src="${esc(large)}" alt="${esc(name)}" decoding="async" fetchpriority="high"><small>${uiLang==="en"?"Click the card to enlarge":"Tocá la carta para ampliarla"}</small></div>`:"<div class=\"commander-preview-image-wrap commander-preview-placeholder\"><span>⌛</span></div>"}<div><div class="kicker">COMMANDER</div><h2 class="commander-preview-name">${esc(name)}</h2><p class="commander-preview-meta">${esc(c.manaCost||"")} ${c.typeLine?`· ${esc(c.typeLine)}`:""}</p><pre class="commander-preview-oracle">${esc(c.oracleText||(loading?(uiLang==="en"?"Loading card details…":"Cargando detalles de la carta…"):(uiLang==="en"?"No Oracle text available.":"Sin texto Oracle disponible.")))}</pre></div></div>`);
  wireCommanderModalImage(normal,large,name);
  preloadImage(large);
}
function wireCommanderModalImage(normal,large,name){
  const img=document.querySelector(".commander-modal-preview .commander-modal-image");
  if(!img)return;
  img.classList.add("commander-preview-trigger");
  img.onclick=e=>{e.preventDefault();e.stopPropagation();showCardZoom(img.dataset.largeSrc||img.src,name)};
  if(large&&large!==normal){const hi=new Image();hi.decoding="async";hi.onload=()=>{if(img.isConnected)img.dataset.largeSrc=large};hi.src=large;}
}
function hydrateCommanderModal(c={}){
  const modal=document.querySelector(".commander-modal-preview");if(!modal)return;
  const normal=c.image||c.imageLarge||c.largeImage||"",large=c.largeImage||c.imageLarge||normal,name=c.name||"Commander";
  modal.dataset.commanderPreviewName=name;
  const nameEl=modal.querySelector(".commander-preview-name"),meta=modal.querySelector(".commander-preview-meta"),oracle=modal.querySelector(".commander-preview-oracle");
  if(nameEl)nameEl.textContent=name;if(meta)meta.textContent=[c.manaCost,c.typeLine].filter(Boolean).join(" · ");if(oracle)oracle.textContent=c.oracleText||(uiLang==="en"?"No Oracle text available.":"Sin texto Oracle disponible.");
  let wrap=modal.querySelector(".commander-preview-image-wrap");
  if(normal){
    if(!wrap){wrap=document.createElement("div");wrap.className="commander-preview-image-wrap";modal.prepend(wrap)}
    wrap.classList.remove("commander-preview-placeholder");
    let img=wrap.querySelector("img");if(!img){img=document.createElement("img");img.className="commander-modal-image";img.decoding="async";wrap.innerHTML="";wrap.appendChild(img);const small=document.createElement("small");small.textContent=uiLang==="en"?"Click the card to enlarge":"Tocá la carta para ampliarla";wrap.appendChild(small)}
    img.src=normal;img.dataset.largeSrc=large;img.alt=name;wireCommanderModalImage(normal,large,name);preloadImage(large);
  }
}
async function previewCommander(nameOrCard,fallbackImage=""){
  if(nameOrCard&&typeof nameOrCard==="object"&&nameOrCard.oracleText){
    commanderModal(nameOrCard);return;
  }
  const obj=nameOrCard&&typeof nameOrCard==="object"?nameOrCard:null;
  const name=typeof nameOrCard==="string"?nameOrCard:obj?.name;
  const initialImage=obj?.image||obj?.imageLarge||fallbackImage||"";
  if(!name){if(initialImage)commanderModal({name:"Commander",image:initialImage,largeImage:initialImage});return}
  // Open immediately with what the deck catalog already has, then upgrade from Scryfall.
  commanderModal({name,image:initialImage,largeImage:initialImage,typeLine:obj?.typeLine||""},{loading:true});
  try{
    const d=await req(`/api/commanders?q=${encodeURIComponent(name)}`),exact=(d.results||[]).find(x=>key(x.name)===key(name))||d.results?.[0];
    if(exact&&document.querySelector(".commander-modal-preview"))hydrateCommanderModal(exact);
    else hydrateCommanderModal({name,image:initialImage,largeImage:initialImage});
  }catch{hydrateCommanderModal({name,image:initialImage,largeImage:initialImage})}
}
function wireCommanderPreview(img,cardOrName,fallbackImage=""){
  if(!img)return;
  img.classList.add("commander-preview-trigger");img.title=uiLang==="en"?"Click to enlarge Commander":"Tocar para ampliar Commander";img.setAttribute("aria-label",img.title);
  const large=typeof cardOrName==="object"?(cardOrName?.largeImage||cardOrName?.imageLarge||cardOrName?.image||fallbackImage):fallbackImage;
  img.addEventListener("pointerenter",()=>preloadImage(large),{passive:true});
  img.onclick=e=>{e.preventDefault();e.stopPropagation();previewCommander(cardOrName,fallbackImage)};
}
function renderCommanderArt(container,name,cardOrName=null,fallbackImage="",largeFallback=""){
  if(!container)return;
  const card=cardOrName&&typeof cardOrName==="object"?cardOrName:null;
  const image=card?.image||card?.imageLarge||fallbackImage||"";
  const large=card?.largeImage||card?.imageLarge||largeFallback||image;
  container.style.backgroundImage="none";
  container.innerHTML=image?`<img src="${esc(image)}" alt="${esc(name||card?.name||"Commander")}" decoding="async" fetchpriority="high">`:`<span class="deck-art-placeholder">♛</span>`;
  container.classList.toggle("has-commander-image",Boolean(image));
  container.onclick=e=>{e.preventDefault();previewCommander(card||name||"",image)};
  const img=container.querySelector("img");
  wireCommanderPreview(img,card||name||"",image);
  preloadImage(large);
}
async function chooseCommander(c){if(mode==="explore"){data=null;active=null;E.results.classList.add("hidden");modeState.explore.data=null}commander=c;E.q.value=c.name;E.dd.classList.add("hidden");E.chosenCard.innerHTML=`${c.image?`<img src="${esc(c.image)}">`:""}<div><h3>${esc(c.name)}</h3><p>${esc(c.manaCost)} · ${esc(c.typeLine)}</p><small class="owned-commander-status">Consultando colección…</small></div>`;E.chosenCard.onclick=()=>commanderModal(c);E.chosen.classList.remove("hidden");try{const own=await req(`/api/collection/lookup?name=${encodeURIComponent(c.name)}`,{headers:authHeaders()}),el=E.chosenCard.querySelector(".owned-commander-status");if(el)el.textContent=own.owned?`EN TU COLECCIÓN · Tenés ${own.quantity}`:"NO ESTÁ EN TU COLECCIÓN"}catch{}}

function setupCommanderAutocomplete(input,dropdown,onSelect){
  let localTimer=null;
  input.oninput=()=>{
    clearTimeout(localTimer);
    const q=input.value.trim();
    if(q.length<2){dropdown.classList.add("hidden");return}
    localTimer=setTimeout(async()=>{
      try{
        const d=await req(`/api/commanders?q=${encodeURIComponent(q)}`);
        dropdown.innerHTML="";
        for(const c of d.results||[]){
          const b=document.createElement("button");
          b.className="drop";
          b.innerHTML=`${c.image?`<img src="${esc(c.image)}" loading="lazy">`:""}<span><strong>${esc(c.name)}</strong><small>${esc(c.typeLine)}</small></span>`;
          b.onclick=()=>{input.value=c.name;dropdown.classList.add("hidden");onSelect(c)};
          wireCommanderPreview(b.querySelector("img"),c,c.image||"");
          dropdown.appendChild(b);
        }
        dropdown.classList.toggle("hidden",!(d.results||[]).length);
      }catch(e){showError(e)}
    },220);
  };
}


function deckCountLabel(d){return d.exactMainCount!=null?`Size · ${d.exactMainCount}`:"Size · …"}
async function hydrateVisibleDeckCounts(list,container){
  // v2.5.23: picker rows are render-only. Commander identity + images must already be
  // resolved by /api/deck-catalog, exactly like Discover Commander receives ready data.
  for(const d of list){
    container.querySelectorAll(`[data-id="${d.id}"]`).forEach(row=>{
      const count=row.querySelector('.deck-count');if(count)count.textContent=deckCountLabel(d);
      const sub=row.querySelector('span small');if(sub)sub.textContent=d.commander||'Commander por identificar';
      let img=row.querySelector('img'),thumb=row.querySelector('.deck-thumb');
      if(d.commanderImage&&!img){img=document.createElement('img');img.src=d.commanderImage;img.loading='eager';img.fetchPriority='high';img.decoding='async';img.alt=d.commander||'Commander';thumb?.replaceWith(img)}
      if(img&&d.commanderImage&&img.getAttribute('src')!==d.commanderImage)img.src=d.commanderImage;
      wireCommanderPreview(img,d.commander||'',d.commanderImageLarge||d.commanderImage||'');
    });
    if(d.commanderImageLarge||d.commanderImage)preloadImage(d.commanderImageLarge||d.commanderImage);
  }
}
let deckCatalogRepairPromise=null;
function requestDeckCatalogRepair(){
  if(deckCatalogRepairPromise)return deckCatalogRepairPromise;
  deckCatalogRepairPromise=loadDeckCatalog().finally(()=>{deckCatalogRepairPromise=null});
  return deckCatalogRepairPromise;
}
function renderDeckPicker(force=false){
  const q=key(E.deckSearch.value);
  if(!force&&q.length<1){E.deckPicker.innerHTML="";E.deckPicker.classList.add("hidden");return}
  const list=sortByRecent(decks.filter(d=>!q||key(d.name).includes(q)||key(d.commander).includes(q)));
  E.deckPicker.innerHTML=list.map(d=>`<button class="deck-option" data-id="${d.id}">${d.commanderImage?`<img src="${esc(d.commanderImage)}" loading="eager" fetchpriority="high" decoding="async">`:'<div class="deck-thumb"></div>'}<span><strong>${esc(d.name)}</strong><small>${esc(d.commander||"Commander por identificar")}</small></span><b class="deck-count">${deckCountLabel(d)}</b></button>`).join("");
  E.deckPicker.classList.toggle("hidden",!list.length);
  E.deckPicker.querySelectorAll(".deck-option").forEach(b=>{const d=decks.find(x=>x.id===Number(b.dataset.id));b.onclick=()=>{E.deckSearch.value=d?.name||"";E.deckPicker.classList.add("hidden");selectDeck(Number(b.dataset.id))};wireCommanderPreview(b.querySelector("img"),d?.commander||"",d?.commanderImage||"")});
  hydrateVisibleDeckCounts(list,E.deckPicker);
  if(list.some(d=>!d.commander||!d.commanderImage) && (!lastSyncStatus||["done","done_with_errors"].includes(lastSyncStatus.status)))requestDeckCatalogRepair();
}
E.deckSearch.oninput=()=>renderDeckPicker(true);
E.deckSearch.onfocus=()=>renderDeckPicker(true);
E.deckSearch.onclick=()=>renderDeckPicker(true);
document.addEventListener("pointerdown",e=>{
  const insideDeck=e.target.closest(".deck-autocomplete"),insideCommander=e.target.closest(".commander-search");
  if(!insideDeck){E.deckPicker.classList.add("hidden");E.labDeckPicker?.classList.add("hidden")}
  if(!insideCommander){E.dd.classList.add("hidden");E.compareCommanderDropdown?.classList.add("hidden")}
  // If the click is inside one autocomplete, close every other partial-result popup.
  if(insideDeck){const picker=insideDeck.querySelector?.(".deck-picker");if(picker!==E.deckPicker)E.deckPicker.classList.add("hidden");if(picker!==E.labDeckPicker)E.labDeckPicker?.classList.add("hidden")}
  if(insideCommander){const drop=insideCommander.querySelector?.(".dropdown");if(drop!==E.dd)E.dd.classList.add("hidden");if(drop!==E.compareCommanderDropdown)E.compareCommanderDropdown?.classList.add("hidden")}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){E.dd.classList.add("hidden");E.deckPicker.classList.add("hidden");E.compareCommanderDropdown?.classList.add("hidden");E.labDeckPicker?.classList.add("hidden")}});

function deckPrimaryCategory(c){return (c.categories||[]).find(x=>!/^commander$/i.test(x))||(c.categories||[])[0]||"Sin categoría"}
function typeBucket(c){const t=String(c.typeLine||"");for(const x of ["Creature","Instant","Sorcery","Artifact","Enchantment","Planeswalker","Battle","Land"])if(t.includes(x))return x;return t.split("—")[0].trim()||"Otro"}
let deckCardPreviewPortal=null;
function ensureDeckCardPreviewPortal(){
  if(deckCardPreviewPortal)return deckCardPreviewPortal;
  deckCardPreviewPortal=document.createElement("div");deckCardPreviewPortal.className="deck-card-preview-portal";deckCardPreviewPortal.innerHTML='<img alt="">';document.body.appendChild(deckCardPreviewPortal);return deckCardPreviewPortal;
}
function showDeckCardPreview(el){
  const src=el?.dataset?.deckCardPreview;if(!src)return;
  const portal=ensureDeckCardPreviewPortal(),img=portal.querySelector("img");img.src=src;img.alt=el.textContent.trim();portal.classList.add("visible");
  const panel=el.closest(".deck-inspector"),r=panel?.getBoundingClientRect();
  if(r){portal.style.right=`${Math.max(16,innerWidth-r.left+16)}px`;portal.style.left="auto";}
}
function hideDeckCardPreview(){deckCardPreviewPortal?.classList.remove("visible")}
function wireDeckListPreviews(root){
  root?.querySelectorAll("[data-deck-card-preview]").forEach(el=>{
    el.addEventListener("mouseenter",()=>showDeckCardPreview(el));el.addEventListener("mouseleave",hideDeckCardPreview);
    el.addEventListener("focus",()=>showDeckCardPreview(el));el.addEventListener("blur",hideDeckCardPreview);
  });
}
function renderDeckInspector(kind,detail,filterNames=null,filterLabel=""){
  const prefix=kind==="lab"?"lab":"improve",panel=E[prefix+"DeckInspector"],listEl=E[prefix+"DeckList"],sortEl=E[prefix+"DeckSort"],filterEl=E[prefix+"DeckFilter"];
  if(!detail||!panel){panel?.classList.add("hidden");if(kind==="improve")document.body.classList.remove("improve-with-inspector");syncFloatingNavGeometry();return}
  panel.classList.remove("hidden");if(kind==="improve"&&mode==="improve")document.body.classList.add("improve-with-inspector");syncFloatingNavGeometry();E[prefix+"DeckInspectorTitle"].textContent=detail.name;const commanderEl=E[prefix+"DeckInspectorCommander"];if(commanderEl)commanderEl.textContent=`Commander · ${(detail.commanders||[detail.commander]).filter(Boolean).join(" + ")||"—"}`;E[prefix+"DeckInspectorCount"].textContent=`Size · ${detail.size} cartas`;
  deckInspectorFilter[kind]=filterNames?new Set(filterNames.map(key)):null;
  let cards=[...(detail.mainboard||[])];
  if(deckInspectorFilter[kind])cards=cards.filter(c=>deckInspectorFilter[kind].has(key(c.name)));
  const [sortKey,sortDir]=(sortEl?.value||"type:asc").split(":");
  const baseCompare=(a,b)=>sortKey==="cmc"?(Number(a.cmc||0)-Number(b.cmc||0)||a.name.localeCompare(b.name)):sortKey==="category"?(deckPrimaryCategory(a).localeCompare(deckPrimaryCategory(b))||a.name.localeCompare(b.name)):sortKey==="name"?a.name.localeCompare(b.name):(typeBucket(a).localeCompare(typeBucket(b))||a.name.localeCompare(b.name));
  cards.sort((a,b)=>(sortDir==="desc"?-1:1)*baseCompare(a,b));
  filterEl.classList.toggle("hidden",!filterNames);
  filterEl.innerHTML=filterNames?`<span>Filtro: ${esc(filterLabel)} · ${cards.reduce((n,c)=>n+Number(c.quantity||1),0)} cartas</span><button type="button">Limpiar filtro</button>`:"";
  if(filterNames)filterEl.querySelector("button").onclick=()=>renderDeckInspector(kind,detail,null,"");
  listEl.innerHTML=cards.map(c=>`<div class="deck-list-row"><span class="deck-qty">${c.quantity>1?`${c.quantity}×`:""}</span><span class="deck-list-name" title="${esc(c.name)}"${c.imageNormal?` data-deck-card-preview="${esc(c.imageNormal)}"`:""}>${esc(c.name)}</span><span class="deck-list-type">${esc(typeBucket(c))}</span><span class="deck-list-meta">CMC ${Number(c.cmc||0)}</span></div>`).join("")||'<p class="lab-muted">No hay cartas para este filtro.</p>';
  wireDeckListPreviews(listEl);
  syncFloatingNavGeometry();
}
if(E.improveDeckSort)E.improveDeckSort.onchange=()=>deckDetail&&renderDeckInspector("improve",deckDetail,deckInspectorFilter.improve?[...deckInspectorFilter.improve] : null,E.improveDeckFilter?.querySelector("span")?.textContent?.replace(/^Filtro: | · \d+$/g,"")||"");
if(E.labDeckSort)E.labDeckSort.onchange=()=>labDeckDetail&&renderDeckInspector("lab",labDeckDetail,deckInspectorFilter.lab?[...deckInspectorFilter.lab] : null,E.labDeckFilter?.querySelector("span")?.textContent?.replace(/^Filtro: | · \d+$/g,"")||"");

async function selectDeck(id){
  touchRecentDeck(id);
  improveAnalysisReady=false;E.improveTabs?.classList.add("hidden");syncImproveRibbon();E.improveHealthResults.innerHTML="";E.results.classList.add("hidden");
  data=null;active=null;E.results.classList.add("hidden");modeState.improve.data=null;selectedDeckId=id;collectionFilter="all";E.roleFilter.value="";if(E.themeFilter)E.themeFilter.value="";setCollectionFilter("all",false);E.deckPicker.classList.add("hidden");deckDetail=null;commander=null;E.deckSummary.classList.add("hidden");E.deckError.classList.add("hidden");E.deckLoading.classList.remove("hidden");
  try{
    const catalogDeck=decks.find(d=>d.id===Number(id));
    deckDetail=await req("/api/deck-detail",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:id})});
    if(!deckDetail.commander)throw new Error("No pude identificar el Commander del mazo.");
    const fallbackImage=deckDetail.commanderImage||catalogDeck?.commanderImage||"",fallbackLarge=deckDetail.commanderImageLarge||catalogDeck?.commanderImageLarge||fallbackImage,fallbackCommander={name:deckDetail.commander,image:fallbackImage,largeImage:fallbackLarge};
    if(catalogDeck){catalogDeck.commander=deckDetail.commander||catalogDeck.commander;catalogDeck.commanderImage=fallbackImage||catalogDeck.commanderImage;catalogDeck.commanderImageLarge=fallbackLarge||catalogDeck.commanderImageLarge}
    commander=fallbackCommander;
    E.deckName.textContent=deckDetail.name;E.deckCommander.textContent=(deckDetail.commanders||[deckDetail.commander]).filter(Boolean).join(" + ");E.mainCount.textContent=deckDetail.size;E.sizeAudit.textContent=`Size real del deck · ${deckDetail.excludedCount||0} carta${Number(deckDetail.excludedCount||0)===1?"":"s"} de Sideboard/Maybeboard excluida${Number(deckDetail.excludedCount||0)===1?"":"s"}`;E.openDeckLink.href=deckDetail.url;E.openDeckLink.classList.remove("hidden");renderDeckInspector("improve",deckDetail);
    renderCommanderArt(E.deckCommanderArt,deckDetail.commander,fallbackCommander,fallbackImage,fallbackLarge);E.deckSummary.classList.remove("hidden");terminalUpdateContext(true);
    // Upgrade the visible preview with exact Scryfall data, without delaying the deck summary.
    const search=await req(`/api/commanders?q=${encodeURIComponent(deckDetail.commander)}`).catch(()=>({results:[]}));
    const exact=(search.results||[]).find(x=>key(x.name)===key(deckDetail.commander))||search.results?.[0];
    if(exact){commander=exact;renderCommanderArt(E.deckCommanderArt,deckDetail.commander,exact,fallbackImage,fallbackLarge)}
  }catch(e){E.deckError.textContent=e.message;E.deckError.classList.remove("hidden")}finally{E.deckLoading.classList.add("hidden")}
}
E.analyzeExplore.onclick=()=>runAnalysis(false);
let improveAnalysisReady=false;
function syncImproveRibbon(){
  const on=mode==="improve"&&improveAnalysisReady;
  // The ribbon lives at main level (immediately above Improve), so it can stay sticky while
  // EDHREComendaciones is rendered in the global results section without leaving the viewport.
  E.improveTabs.classList.toggle("hidden",!on);
  E.improveTabs.classList.toggle("floating",on);
  syncFloatingNavGeometry();
}
function setImproveTab(tab){
  if(!improveAnalysisReady)return;
  E.improveTabs.querySelectorAll("[data-improve-tab]").forEach(b=>b.classList.toggle("active",b.dataset.improveTab===tab));
  E.improveHealthResults.dataset.view=tab;
  E.improveHealthResults.classList.toggle("hidden",tab==="recommendations");
  E.results.classList.toggle("hidden",tab!=="recommendations");
  syncImproveRibbon();
  const target=tab==="recommendations"?E.results:E.improveHealthResults;
  target?.scrollIntoView({behavior:"smooth",block:"start"});
  setTimeout(()=>terminalUpdateContext(true),0);
}
E.improveTabs?.querySelectorAll("[data-improve-tab]").forEach(b=>b.onclick=()=>setImproveTab(b.dataset.improveTab));
// v2.4.18 — exportar el mazo cargado en un formato estándar de texto plano ("N Nombre" por
// línea, más "Commander" aparte), el mismo formato que Archidekt/Moxfield/MTGGoldfish/Arena
// ya saben leer al pegar una decklist — no hace falta inventar nada nuevo.
function exportDeckDetail(detail){
  if(!detail)return showError(new Error("Seleccioná un mazo primero."));
  const commanders=(detail.commanders||[detail.commander]).filter(Boolean);
  const commanderKeys=new Set(commanders.map(c=>key(c)));
  const lines=(detail.mainboard||[]).filter(c=>!commanderKeys.has(key(c.name))).map(c=>`${Number(c.quantity||1)} ${c.name}`);
  const text=[...(commanders.length?["Commander",...commanders.map(c=>`1 ${c}`),""]:[]),"Deck",...lines].join("\n");
  download(`${key(detail.name).replace(/\s+/g,"-")||"manashelf-deck"}.txt`,text);
}
E.exportDeckBtn.onclick=()=>exportDeckDetail(deckDetail);
if(E.labExportDeckBtn)E.labExportDeckBtn.onclick=()=>exportDeckDetail(labDeckDetail);
E.analyzeImprove.onclick=async()=>{
  if(!deckDetail||!selectedDeckId)return showError(new Error("Seleccioná un mazo primero."));
  clearError();improveAnalysisReady=false;E.improveTabs.classList.add("hidden");syncImproveRibbon();E.results.classList.add("hidden");E.improveHealthResults.innerHTML="";
  E.improveHealthLoading.classList.remove("hidden");E.analyzeImprove.disabled=true;E.analyzeImprove.textContent="Analizando…";
  try{
    await runAnalysis(true);
    const d=await req("/api/lab/deck-health",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:selectedDeckId})});
    renderLabResult(d,E.improveHealthResults,"improve",deckDetail);
    improveAnalysisReady=true;E.improveTabs.classList.remove("hidden");syncImproveRibbon();setImproveTab("deckcheck");
  }catch(e){showError(e)}
  finally{E.improveHealthLoading.classList.add("hidden");E.analyzeImprove.disabled=false;E.analyzeImprove.textContent="Analizar mazo →"}
};

function addHistory(){
  if(!data)return;history.unshift({ts:Date.now(),mode,commander:commander?.name,deck:deckDetail?.name||null,summary:data.summary});history=history.slice(0,40);localStorage.setItem("ms-history",JSON.stringify(history));
}
async function runAnalysis(silent=false){
  if(!sessionId)return showError(new Error("Conectá una colección primero."));if(!commander?.name)return showError(new Error("Elegí un Commander."));
  let progressTimer=null,started=Date.now(),stage=0;
  const stages=mode==="improve"?["Consultando recomendaciones EDHREC…","Cruzando recomendaciones con tu colección…","Calculando copias disponibles y uso en otros mazos…","Consultando metadatos necesarios de Scryfall…","Preparando resultados…"]:["Consultando recomendaciones EDHREC…","Cruzando recomendaciones con tu colección…","Consultando metadatos necesarios de Scryfall…","Preparando recomendaciones y disponibilidad…"];
  if(!silent){
    clearError();E.loading.classList.remove("hidden");E.results.classList.add("hidden");E.loadingTitle.textContent=mode==="improve"?"Analizando tu mazo…":"Analizando Commander…";E.loadingText.textContent=stages[0];E.loadingElapsed.textContent="0s · esperando servicios externos";
    progressTimer=setInterval(()=>{const sec=Math.floor((Date.now()-started)/1000);const next=Math.min(stages.length-1,Math.floor(sec/3));if(next>stage){stage=next;E.loadingText.textContent=stages[stage]}E.loadingElapsed.textContent=`${sec}s · etapa ${stage+1}/${stages.length} · el porcentaje exacto depende de EDHREC/Scryfall`;},500);
  }
  try{
    data=await req("/api/analyze",{method:"POST",headers:authHeaders(),body:JSON.stringify({commander:commander.name,includeMissing:true})});
    if(!silent){stage=stages.length-1;E.loadingText.textContent="Resultados recibidos. Renderizando…"}
    E.resultModeLabel.textContent=mode==="improve"?"MEJORAR MI MAZO":"EXPLORAR COMMANDER";E.title.textContent=mode==="improve"?`${deckDetail.name} · ${commander.name}`:commander.name;
    const sync=data.deckSync;E.meta.textContent=accessMode==="private"?(sync.status==="done"?`Uso en mazos sincronizado: ${sync.syncedDecks}/${sync.totalDecks}`:`Resultados listos · uso en mazos ${sync.syncedDecks}/${sync.totalDecks}`):"Colección pública · uso cruzado entre mazos requiere login";
    const ownedN=Number(data.summary.recommendedOwned||0),availableN=Number(data.summary.withFreeCopies||0),missingN=Number(data.summary.missing||0);
    E.sumTotal.textContent=ownedN+missingN;E.sumOwned.textContent=ownedN;E.sumAvailable.textContent=availableN;E.sumOccupied.textContent=Math.max(0,ownedN-availableN);E.sumUsed.textContent=data.summary.usedInDecks;E.sumMissing.textContent=missingN;
    if(!silent){collectionFilter="all";E.roleFilter.value="";if(E.themeFilter)E.themeFilter.value="";E.sort.value="synergy";view="cards"}
    buildRoleFilter();buildThemeFilter();setCollectionFilter(collectionFilter,false);renderCats();const first=data.categories.find(c=>c.matches.length)||data.categories[0];if(first)setCat(first.id);E.results.classList.remove("hidden");
    saveModeState(mode);if(!silent){addHistory();E.results.scrollIntoView({behavior:"smooth",block:"start"})}
  }catch(e){if(!silent)showError(e)}finally{if(progressTimer)clearInterval(progressTimer);if(!silent)E.loading.classList.add("hidden")}
}
const desc={highsynergy:"Especialmente asociadas a este Commander.",topcards:"Las cartas más usadas.",gamechangers:"Game Changers relevantes.",newcards:"Incorporaciones recientes.",creatures:"Criaturas habituales.",instants:"Instantáneos habituales.",sorceries:"Conjuros habituales.",artifacts:"Artefactos habituales.",enchantments:"Encantamientos habituales.",lands:"Tierras habituales."};
function categoryDesc(c){return desc[String(c.id||c.label).toLowerCase().replace(/[^a-z]/g,"")]||"Clasificación publicada por EDHREC."}
function matchesCurrentFilters(c,mb=mainboardSet()){
  const st=statusOf(c,mb);
  if(collectionFilter==="owned"&&st==="missing")return false;
  if(collectionFilter==="available"&&!contextualAvailable(c))return false;
  if(E.roleFilter.value&&!(c.roles||[]).includes(E.roleFilter.value))return false;
  if(E.themeFilter?.value&&!(c.themeTags||[]).includes(E.themeFilter.value))return false;
  return true;
}
function renderCats(){
  E.cats.innerHTML="";const mb=mainboardSet();
  for(const c of data.categories){
    const visible=c.matches.filter(x=>matchesCurrentFilters(x,mb)).length;
    const b=document.createElement("button");b.className="cat";b.dataset.id=c.id;b.innerHTML=`<span>${esc(c.label)}</span><b>${visible}/${c.totalEdhrec}</b>`;b.onclick=()=>setCat(c.id);E.cats.appendChild(b)
  }
}
function setCat(id){active=data.categories.find(c=>c.id===id);[...E.cats.children].forEach(b=>b.classList.toggle("active",b.dataset.id===id));render()}
function mainboardSet(){return new Set((deckDetail?.mainboard||[]).map(c=>key(c.name)))}
function buildRoleFilter(){const roles=[...new Set(data.categories.flatMap(c=>c.matches.flatMap(x=>x.roles||[])))].sort();const old=E.roleFilter.value;E.roleFilter.innerHTML='<option value="">Todos los roles ManaShelf</option>'+roles.map(r=>`<option>${esc(r)}</option>`).join("");if(roles.includes(old))E.roleFilter.value=old}
function buildThemeFilter(){
  const themes=data.commanderThemes||[];
  if(E.themeFilterWrap)E.themeFilterWrap.classList.toggle("hidden",!themes.length);
  if(!E.themeFilter)return;
  const old=E.themeFilter.value;
  E.themeFilter.innerHTML='<option value="">Todas las temáticas</option>'+themes.map(t=>`<option>${esc(t)}</option>`).join("");
  if(themes.includes(old))E.themeFilter.value=old;
}
function usedOutsideCurrentDeck(c){return (c.usedInDecks||[]).filter(d=>!(mode==="improve"&&Number(d.deckId)===Number(selectedDeckId))).reduce((n,d)=>n+Number(d.quantity||0),0)}
function contextualAvailable(c){return c.ownedQuantity>0&&Math.max(0,Number(c.ownedQuantity||0)-usedOutsideCurrentDeck(c))>0}
function statusOf(c,mb){if(c.owned===false||!c.ownedQuantity)return"missing";if(mode==="improve"&&mb.has(key(c.name)))return"inDeck";if(contextualAvailable(c))return"available";return"occupied"}
function filtered(){
  if(!active)return[];let a=[...active.matches],mb=mainboardSet();
  a=a.filter(c=>matchesCurrentFilters(c,mb));
  if(mode==="improve"&&hideInDeck)a=a.filter(c=>!mb.has(key(c.name)));
  if(E.sort.value==="synergy")a.sort((x,y)=>y.synergy-x.synergy||y.inclusionPct-x.inclusionPct);
  if(E.sort.value==="inclusion")a.sort((x,y)=>y.inclusionPct-x.inclusionPct);
  if(E.sort.value==="availability")a.sort((x,y)=>y.availableQuantity-x.availableQuantity);
  if(E.sort.value==="name")a.sort((x,y)=>x.name.localeCompare(y.name));return a
}

function shortlistHas(name){return shortlist.some(x=>key(x.name)===key(name))}
function toggleShortlist(c){if(shortlistHas(c.name))shortlist=shortlist.filter(x=>key(x.name)!==key(c.name));else shortlist.push({name:c.name,commander:commander?.name||"",role:(c.roles||[])[0]||"Utility",owned:c.owned!==false,available:c.availableQuantity||0});saveLists();render()}
async function freeAlternative(c){
  openModal(`<div class="kicker">ALTERNATIVAS FUNCIONALES</div><h2>${esc(c.name)}</h2><p class="status">Buscando cartas “Similar” de EDHREC que además estén disponibles en tu colección…</p>`);
  try{
    const d=await req("/api/alternatives",{method:"POST",headers:authHeaders(),body:JSON.stringify({card:c.name})});
    const rows=d.results||[];
    E.modalBody.innerHTML=`<div class="kicker">ALTERNATIVAS FUNCIONALES · EDHREC</div><h2>${esc(c.name)}</h2>${rows.length?`<p>Estas cartas aparecen como similares en EDHREC y tienen copia disponible en tu colección. Scryfall se usa para validar metadatos.</p><div class="alt-grid">${rows.map(x=>`<article class="alt-card">${x.image?`<img src="${esc(x.image)}" loading="lazy">`:""}<div><strong>${esc(x.name)}</strong><small>${esc(typeBucket(x))} · CMC ${x.cmc}</small><small>Disponible ${x.availableQuantity}/${x.ownedQuantity}</small></div></article>`).join("")}</div>`:`<p>No encontré una alternativa funcional de EDHREC con copia disponible en tu colección. No voy a sugerir una carta solo por compartir categoría.</p>`}`;
  }catch(e){E.modalBody.innerHTML=`<h2>No pude consultar alternativas</h2><p>${esc(e.message||e)}</p>`}
}
function addCut(c){
  if(!deckDetail)return;
  const recNames=new Set(data.categories.flatMap(cat=>cat.matches.map(x=>key(x.name))));
  const basics=new Set(["plains","island","swamp","mountain","forest","wastes"]);
  const cuts=(deckDetail.mainboard||[]).filter(x=>key(x.name)!==key(deckDetail.commander)&&!basics.has(key(x.name))&&!recNames.has(key(x.name))).slice(0,8);
  openModal(`<div class="kicker">ADD / CUT</div><h2>Agregar ${esc(c.name)}</h2><p>Candidatos a CUT: cartas del mainboard que no aparecen entre las recomendaciones actuales de EDHREC. Es una heurística, no una orden automática.</p><div class="modal-list">${cuts.length?cuts.map(x=>`<div class="modal-row"><span>${esc(x.name)}</span><b>CUT candidato</b></div>`).join(""):"<div>No encontré un CUT obvio.</div>"}</div>`)
}
function render(){
  if(!active)return;const a=filtered(),mb=mainboardSet();renderCats();[...E.cats.children].forEach(b=>b.classList.toggle("active",b.dataset.id===active.id));E.ct.textContent=active.label;E.cm.textContent=`${categoryDesc(active)} ${a.length} visibles de ${active.totalEdhrec} recomendaciones.`;E.grid.className=`grid${view==="list"?" list-view":""}`;E.listHeader.classList.toggle("hidden",view!=="list");E.grid.innerHTML="";E.empty.classList.toggle("hidden",a.length>0);
  for(const c of a){
    const inDeck=mode==="improve"&&mb.has(key(c.name)),used=c.usedInDecks||[],missing=c.owned===false||!c.ownedQuantity,availableNow=contextualAvailable(c),outside=used.filter(d=>!(mode==="improve"&&Number(d.deckId)===Number(selectedDeckId)));
    const art=document.createElement("article");
    const availableQty=Math.max(0,Number(c.ownedQuantity||0)-usedOutsideCurrentDeck(c));
    if(view==="list"){
      // v2.4.15 — modo lista rediseñado de cero: antes era la misma tarjeta de "cards"
      // reordenada por CSS (con miniatura chica agregada en v2.4.14, que el usuario no
      // quería ahí). Ahora es una fila de texto densa, sin imagen: nombre, tipo, categoría,
      // CMC y disponibilidad — más blanco si la tenés, más gris si no.
      art.className=`list-row${missing?" not-owned":""}${inDeck?" in-deck":""}`;
      const stockText=missing?"No está en tu colección":inDeck?`Tenés ${c.ownedQuantity} · ya en este mazo`:`Disponible ${availableQty}/${c.ownedQuantity}`;
      art.innerHTML=`<span class="lr-name">${esc(c.name)}${inDeck?'<b class="lr-indeck">YA EN EL MAZO</b>':""}</span><span class="lr-type">${esc(typeBucket(c))}</span><span class="lr-role">${esc((c.roles||[])[0]||"—")}</span><span class="lr-cmc">${Number.isFinite(Number(c.cmc))?Number(c.cmc):"—"}</span><span class="lr-stock">${esc(stockText)}</span>`;
      E.grid.appendChild(art);
      continue;
    }
    const stockBadge=missing?'<span class="stock-badge missing-stock">NO ESTÁ EN TU COLECCIÓN</span>':inDeck?`<span class="stock-badge in-deck-stock"><b>Tenés ${c.ownedQuantity}</b><small>${availableQty>0?`+${availableQty} sin usar`:"Todas usadas en este mazo"}</small></span>`:`<span class="stock-badge"><b>Disponible ${availableQty}/${c.ownedQuantity}</b><small>Tenés ${c.ownedQuantity} · ${availableQty} sin usar</small></span>`;
    const usageLinks=outside.length?outside.map(d=>`<a href="https://archidekt.com/decks/${Number(d.deckId)}" target="_blank" rel="noreferrer">${esc(d.deckName)} ×${Number(d.quantity||0)}</a>`).join(""):"<span>No está usada en otro mazo</span>";
    const usageBadge=!missing?`<span class="usage-overlay" tabindex="0">${outside.length?`EN ${outside.length} MAZO${outside.length===1?"":"S"}`:"NO USADA FUERA"}<em>${usageLinks}</em></span>`:"";
    art.className=`card${missing?" not-owned":""}`;
    art.innerHTML=`<div class="pic">${c.image?`<img src="${esc(c.image)}" loading="lazy" decoding="async">`:""}${stockBadge}${usageBadge}${inDeck?'<span class="in-deck-badge">YA EN EL MAZO</span>':""}</div>
    <div class="card-body"><h4>${esc(c.name)}</h4><div class="metrics"><span class="syn">${c.synergy>=0?"+":""}${Math.round(c.synergy*100)}% sinergia</span><span>${c.inclusionPct}% inclusión</span></div><div class="role-line">${(c.roles||[]).map(r=>`<span class="role">${esc(r)}</span>`).join("")}</div>
    <div class="card-actions"><button data-act="short" class="${shortlistHas(c.name)?"shortlisted":""}">${shortlistHas(c.name)?"★ En shortlist":"☆ Shortlist"}</button>${(!availableNow||missing)?'<button data-act="alt">Alternativas funcionales</button>':""}${mode==="improve"&&!inDeck?'<button data-act="cut">ADD / CUT</button>':""}</div></div>`;
    art.querySelector('[data-act="short"]').onclick=()=>toggleShortlist(c);const alt=art.querySelector('[data-act="alt"]');if(alt)alt.onclick=()=>freeAlternative(c);const cut=art.querySelector('[data-act="cut"]');if(cut)cut.onclick=()=>addCut(c);E.grid.appendChild(art)
  }
}
function setCollectionFilter(value,doRender=true){
  collectionFilter=value;
  for(const b of [E.filterAll,E.filterOwned,E.filterAvailable]){const on=b.dataset.state===value;b.classList.toggle("active",on);b.setAttribute("aria-pressed",String(on))}
  if(doRender&&data){render();saveModeState(mode)}
}
for(const b of [E.filterAll,E.filterOwned,E.filterAvailable])b.onclick=()=>setCollectionFilter(b.dataset.state);
if(E.hideInDeckToggle)E.hideInDeckToggle.onclick=()=>{hideInDeck=!hideInDeck;E.hideInDeckToggle.classList.toggle("active",!hideInDeck);E.hideInDeckToggle.setAttribute("aria-pressed",String(!hideInDeck));if(mode==="improve"&&active)render()};
for(const x of [E.roleFilter,E.themeFilter,E.sort])x.onchange=()=>{render();saveModeState(mode)};
E.viewCards.onclick=()=>{view="cards";E.viewCards.classList.add("active");E.viewList.classList.remove("active");render()};E.viewList.onclick=()=>{view="list";E.viewList.classList.add("active");E.viewCards.classList.remove("active");render()};


function ago(ts){if(!ts)return"sin fecha";const sec=Math.max(0,Math.round((Date.now()-ts)/1000));if(sec<60)return"hace segundos";if(sec<3600)return`hace ${Math.round(sec/60)} min`;if(sec<86400)return`hace ${Math.round(sec/3600)} h`;return`hace ${Math.round(sec/86400)} días`}
async function openCacheAdmin(){
  openModal(`<div class="kicker">ADMINISTRAR CACHÉ</div><h2>Caché local</h2><p>Usá <strong>Actualizar</strong> para refrescar datos conservando el caché válido anterior, o <strong>Borrar</strong> para eliminar una sección. Podés copiar <code>.manashelf-cache</code> desde la versión anterior. ManaShelf reutiliza lo compatible y nunca borra un caché válido si una actualización falla.</p><div class="drawer-actions cache-admin-top"><button id="cacheRefreshAllNow" class="primary">Actualizar todo ahora</button><button id="cacheDeleteAllNow" class="ghost danger-ghost">Borrar todo</button></div><div id="cacheRows" class="cache-rows"><p class="status">Leyendo estado…</p></div><div id="cacheProgress" class="cache-progress hidden"></div>`);
  const rows=$("#cacheRows"),prog=$("#cacheProgress");
  async function refresh(){
    const d=await req("/api/cache/status",{headers:authHeaders()}),labels={decks:"Decks Archidekt",usage:"Uso de cartas",scryfall:"Scryfall / metadatos",commanders:"Catálogo de Commanders",edhrec:"EDHREC"};
    rows.innerHTML=Object.entries(d.sections).map(([k,v])=>`<div class="cache-row"><div><strong>${labels[k]}</strong><small>${v.count} entradas · ${ago(v.updatedAt)}</small></div><div class="cache-actions"><button class="ghost tiny" data-cache="${k}">Actualizar</button><button class="ghost tiny danger-action" data-delete-cache="${k}">Borrar</button></div></div>`).join("")+`<div class="cache-row all-cache"><div><strong>Todo</strong><small>Actualiza o elimina todas las secciones</small></div><div class="cache-actions"><button class="ghost tiny" data-cache="all">Actualizar todo</button><button class="ghost tiny danger-action" data-delete-cache="all">Borrar todo</button></div></div>`;
    rows.querySelectorAll("[data-cache]").forEach(b=>b.onclick=()=>start(b.dataset.cache));
    rows.querySelectorAll("[data-delete-cache]").forEach(b=>b.onclick=async()=>{const section=b.dataset.deleteCache;if(!confirm(`¿Borrar caché de ${section==="all"?"todas las secciones":labels[section]}? Se reconstruirá cuando vuelva a hacer falta.`))return;await req("/api/cache/delete",{method:"POST",headers:authHeaders(),body:JSON.stringify({section})});await refresh()});
  }
  async function start(section){
    rows.querySelectorAll("button").forEach(b=>b.disabled=true);prog.classList.remove("hidden");prog.innerHTML="<strong>Iniciando…</strong><progress max='1' value='0'></progress><small></small>";
    try{
      let job=(await req("/api/cache/recache",{method:"POST",headers:authHeaders(),body:JSON.stringify({section})})).job;
      while(job.status==="running"){
        const bar=prog.querySelector("progress");bar.max=Math.max(1,job.total||1);bar.value=Math.min(bar.max,job.current||0);prog.querySelector("strong").textContent=job.message||"Actualizando…";prog.querySelector("small").textContent=job.total?`${job.current||0} / ${job.total}`:"Progreso en curso";
        await new Promise(r=>setTimeout(r,650));job=(await req(`/api/cache/job?id=${encodeURIComponent(job.id)}`,{headers:authHeaders()})).job;
      }
      prog.querySelector("strong").textContent=job.message||"Listo";prog.querySelector("small").textContent=job.errors?.length?`${job.errors.length} error(es); se conservó el caché anterior cuando fue posible.`:"Completado.";
      await refresh();
    }catch(e){prog.innerHTML=`<strong>${esc(e.message||e)}</strong>`;rows.querySelectorAll("button").forEach(b=>b.disabled=false)}
  }
  const refreshAllBtn=$("#cacheRefreshAllNow"),deleteAllBtn=$("#cacheDeleteAllNow");
  if(refreshAllBtn)refreshAllBtn.onclick=()=>start("all");
  if(deleteAllBtn)deleteAllBtn.onclick=async()=>{if(!confirm("¿Borrar todo el caché? Se volverá a construir cuando haga falta."))return;await req("/api/cache/delete",{method:"POST",headers:authHeaders(),body:JSON.stringify({section:"all"})});await refresh()};
  try{await refresh()}catch(e){rows.innerHTML=`<p class="status bad">${esc(e.message||e)}</p>`}
}
if(E.cacheBtn)E.cacheBtn.onclick=openCacheAdmin;

E.shortlistBtn.onclick=()=>{E.drawerTitle.textContent=`Shortlist · ${shortlist.length}`;E.drawerBody.innerHTML=`<div class="drawer-actions"><button id="shortExport" class="ghost">Exportar TXT</button><button id="shortClear" class="ghost">Vaciar</button>${accessMode==="private"&&deckDetail?'<button id="shortApply" class="primary">Agregar al deck actual</button>':""}</div>`+shortlist.map(x=>`<div class="drawer-item"><div><strong>${esc(x.name)}</strong><small>${esc(x.role)} · ${x.owned?`${x.available} disponible${x.available===1?"":"s"}`:"no poseída"}</small></div><button class="tiny" data-remove="${esc(x.name)}">Quitar</button></div>`).join("");E.drawer.classList.remove("hidden");
  $("#shortExport").onclick=()=>download("manashelf-shortlist.txt",shortlist.map(x=>`1 ${x.name}`).join("\n"));$("#shortClear").onclick=()=>{shortlist=[];saveLists();E.shortlistBtn.click()};E.drawerBody.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{shortlist=shortlist.filter(x=>x.name!==b.dataset.remove);saveLists();E.shortlistBtn.click()});
  const apply=$("#shortApply");if(apply)apply.onclick=async()=>{const names=shortlist.filter(x=>x.owned).map(x=>x.name);if(!names.length)return alert("No hay cartas poseídas en la shortlist.");if(!confirm(`¿Agregar ${names.length} cartas a "${deckDetail.name}" en Archidekt? Esta acción modifica el deck real.`))return;try{const d=await req("/api/archidekt/add-cards",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:deckDetail.id,names,confirm:"CONFIRMAR"})});alert(`Archidekt actualizado: ${d.affected} cartas agregadas.`)}catch(e){showError(e)}}
};
E.historyBtn.onclick=()=>{E.drawerTitle.textContent="Historial";E.drawerBody.innerHTML=history.length?history.map(h=>`<div class="drawer-item"><div><strong>${esc(h.commander||"")}</strong><small>${new Date(h.ts).toLocaleString()} · ${esc(h.mode)}${h.deck?` · ${esc(h.deck)}`:""}</small></div><span>${h.summary?.recommendedOwned||0} propias</span></div>`).join(""):"<p class='status'>Todavía no hay análisis guardados.</p>";E.drawer.classList.remove("hidden")};

let assistAvailability="available"; // "available" (default, hoy) o "owned" (en colección, aunque esté usada en otro mazo)
function buildAssistPool(){
  if(!data)return null;
  const existing=new Set((deckDetail?.mainboard||[]).map(x=>key(x.name))),target=mode==="improve"?Math.max(0,100-(deckDetail?.size||0)):99;
  const pool=new Map();
  for(const cat of data.categories)for(const c of cat.matches){
    if(existing.has(key(c.name))||c.ownedQuantity<=0)continue;
    if(assistAvailability==="available"&&c.availableQuantity<=0)continue;
    const old=pool.get(key(c.name));if(!old||c.synergy>old.synergy)pool.set(key(c.name),c);
  }
  const quotas={"Ramp":10,"Draw":10,"Removal":10,"Board Wipes":3,"Protection":5,"Counterspells":3,"Recursion":4,"Finishers":5},chosen=[];
  const vals=[...pool.values()].sort((a,b)=>b.synergy-a.synergy);
  for(const [role,n] of Object.entries(quotas))for(const c of vals.filter(x=>(x.roles||[]).includes(role))){
    if(chosen.length>=target)break;if(chosen.some(x=>key(x.name)===key(c.name)))continue;
    if(chosen.filter(x=>x._fillRole===role).length<n){c._fillRole=role;c._fillWhy=`Cubre el rol ${role}`;chosen.push(c)}
  }
  for(const c of vals){if(chosen.length>=target)break;if(!chosen.some(x=>key(x.name)===key(c.name))){c._fillRole=(c.roles||[])[0]||"Utility";c._fillWhy="Sinergia EDHREC alta, sin un rol prioritario pendiente";chosen.push(c)}}
  return {target,chosen:chosen.slice(0,target)};
}
function renderAssistModal(){
  const built=buildAssistPool();if(!built)return;
  const {target,chosen}=built;
  const lines=chosen.map(c=>`1 ${c.name}`);
  const rows=chosen.map(c=>`<div class="modal-row assist-row"><span class="assist-name">${esc(c.name)}</span><span class="assist-type">${esc(typeBucket(c))}</span><span class="assist-role">${esc(c._fillRole||"")}</span><span class="assist-why">${esc(c._fillWhy||"")}</span></div>`).join("");
  openModal(`<div class="kicker">ASISTENTE A 100</div><h2>${mode==="improve"?`Faltan ${target} slots para 100`:"Borrador de 99 + Commander"}</h2><p>Prioriza cartas propias con copia disponible, roles funcionales y sinergia EDHREC. Revisá tierras y curva antes de aplicarlo.</p>
  <div class="assist-toggle"><span>Mostrando:</span><button type="button" class="tiny ${assistAvailability==="available"?"accent":""}" data-assist-mode="available">Disponibles (no usadas en otro mazo)</button><button type="button" class="tiny ${assistAvailability==="owned"?"accent":""}" data-assist-mode="owned">En colección (aunque estén usadas)</button></div>
  <div class="drawer-actions"><button id="planExport" class="ghost">Exportar decklist</button>${accessMode==="private"&&mode==="explore"?'<button id="planCreate" class="primary">Crear en Archidekt</button>':""}</div>
  <div class="modal-list assist-list"><div class="modal-row assist-row assist-head"><span>Carta</span><span>Tipo</span><span>Categoría</span><span>Qué suple</span></div>${rows}</div>`);
  $$("[data-assist-mode]").forEach(b=>b.onclick=()=>{assistAvailability=b.dataset.assistMode;renderAssistModal()});
  $("#planExport").onclick=()=>download(`manashelf-${key(commander.name).replace(/\s+/g,"-")}.txt`,`1 ${commander.name}\n${lines.join("\n")}`);
  const create=$("#planCreate");if(create)create.onclick=async()=>{const name=prompt("Nombre para el nuevo deck:",`${commander.name} · ManaShelf`);if(!name)return;if(!confirm(`Crear "${name}" en Archidekt con este borrador?`))return;try{const d=await req("/api/archidekt/create-deck",{method:"POST",headers:authHeaders(),body:JSON.stringify({name,commander:commander.name,cards:chosen.map(x=>x.name),confirm:"CONFIRMAR"})});alert("Deck creado.");window.open(d.url,"_blank")}catch(e){showError(e)}};
}
E.completeBtn.onclick=()=>renderAssistModal();;
E.exportBtn.onclick=()=>{if(!data)return;const unique=new Map();for(const cat of data.categories)for(const c of cat.matches)if(!unique.has(key(c.name)))unique.set(key(c.name),c);download(`manashelf-${key(commander.name).replace(/\s+/g,"-")}-recomendaciones.txt`,[...unique.values()].map(c=>`1 ${c.name}`).join("\n"))};

function buildabilityHtml(x){
  const sections=(x.ownedSections||[]).map((s,si)=>`<details class="build-section" data-build-section="${si}"><summary><span>${esc(s.label)}</span><b>${s.cards.length} en colección</b></summary><div class="build-owned-grid">${s.cards.map(c=>`<article class="build-owned-card" data-available="${c.availableQuantity>0?1:0}">${c.image?`<div class="build-card-img"><img src="${esc(c.imageNormal||c.image)}" loading="lazy">${c.imageNormal?`<img class="hover-preview" src="${esc(c.imageNormal)}" loading="lazy">`:""}</div>`:""}<div><strong>${esc(c.name)}</strong><small>${esc(typeBucket(c))} · CMC ${Number(c.cmc||0)}</small><small>Disponible ${c.availableQuantity}/${c.ownedQuantity} · ${Math.round(Number(c.synergy||0)*100)}% sinergia</small></div></article>`).join("")}</div></details>`).join("");
  return `<div class="build-card"><div class="kicker">QUÉ COMMANDER PUEDO ARMAR</div><h3>${esc(x.name)}</h3><span class="owned-flag">Commander en tu colección</span>
    <p class="build-lead">Tenés ${x.owned} de ${x.recommendations} recomendaciones EDHREC. El ranking usa esta cantidad absoluta.</p>
    <div class="build-controls"><label class="switch-line"><input type="checkbox" data-only-available> <span>Mostrar solo cartas con copia disponible</span></label></div>
    <div class="build-metrics"><div class="build-metric"><span>EN COLECCIÓN</span><strong>${x.owned}</strong></div><div class="build-metric"><span>CON COPIA DISPONIBLE</span><strong>${x.available}</strong></div><div class="build-metric"><span>SIN COPIA DISPONIBLE</span><strong>${x.occupied}</strong></div></div>
    <div class="build-owned-sections"><h4>Secciones EDHREC · solo cartas de tu colección</h4>${sections||"<p class='status'>No encontré coincidencias poseídas.</p>"}</div>
  </div>`;
}
function wireBuildability(container){
  const toggle=container.querySelector("[data-only-available]");if(!toggle)return;
  toggle.onchange=()=>container.querySelectorAll(".build-owned-card").forEach(c=>c.classList.toggle("hidden",toggle.checked&&c.dataset.available!=="1"));
}

function renderDiscover(){
  const q=key(E.discoverSearch.value);
  const rows=ownedCommanders.filter(c=>!q||key(c.name).includes(q)||(c.colorIdentity||[]).join("").toLowerCase().includes(q)||(c.signals||[]).some(s=>key(s).includes(q)));
  E.discoverStatus.textContent=discoverTags.length?`${discoverTags.map(x=>x.name).join(" + ")} · ${rows.length} resultado${rows.length===1?"":"s"}`:`de tu colección para explorar`;
  if(E.discoverGalleryCount)E.discoverGalleryCount.textContent=rows.length;
  E.discoverGrid.classList.toggle("hidden",discoverCollapsed);
  E.discoverCollapse.innerHTML=discoverCollapsed?`Ver ${rows.length} Commander${rows.length===1?"":"s"} <span>↓</span>`:`Ocultar Commanders <span>↑</span>`;
  E.discoverGrid.innerHTML=rows.map(c=>`<article class="discover-card ${compareCommanders.some(x=>key(x.name)===key(c.name))?"selected":""}">${c.image?`<div class="discover-card-img"><img src="${esc(c.image)}" loading="lazy">${c.imageLarge?`<img class="hover-preview" src="${esc(c.imageLarge)}" loading="lazy">`:""}</div>`:""}<div><h3>${esc(c.name)}</h3><p>${(c.colorIdentity||[]).join("")||"C"} · Tenés ${c.ownedQuantity}</p><button class="ghost tiny" data-analyze="${esc(c.name)}">Analizar con EDHREC</button></div><button class="commander-select-circle ${compareCommanders.some(x=>key(x.name)===key(c.name))?"active":""}" data-select="${esc(c.name)}" aria-label="Seleccionar ${esc(c.name)}">${compareCommanders.some(x=>key(x.name)===key(c.name))?"✓":""}</button></article>`).join("")||"<p class='status discover-empty'>No hay Commanders de tu colección que coincidan con estos filtros.</p>";
  E.discoverGrid.querySelectorAll("[data-analyze]").forEach(b=>b.onclick=async()=>{
    const c=ownedCommanders.find(x=>x.name===b.dataset.analyze);
    E.loading.classList.remove("hidden");E.loadingTitle.textContent=`Analizando ${c.name}…`;
    try{
      const d=await req("/api/buildability",{method:"POST",headers:authHeaders(),body:JSON.stringify({commander:c.name})});
      E.rankFlow.classList.add("analysis-focus");discoverCollapsed=true;renderDiscover();
      E.rankOneResult.innerHTML=`<button class="ghost discovery-back" id="discoveryBack">← Volver a mis Commanders</button>`+buildabilityHtml(d.result);
      wireBuildability(E.rankOneResult);
      $("#discoveryBack").onclick=()=>{E.rankFlow.classList.remove("analysis-focus");E.rankOneResult.innerHTML="";discoverCollapsed=false;renderDiscover();E.rankFlow.scrollIntoView({behavior:"smooth"})};
      E.rankOneResult.scrollIntoView({behavior:"smooth",block:"start"});
    }catch(e){showError(e)}finally{E.loading.classList.add("hidden")}
  });
  E.discoverGrid.querySelectorAll("[data-select]").forEach(b=>b.onclick=()=>toggleCompare(ownedCommanders.find(x=>x.name===b.dataset.select)));
}
async function toggleDiscoveryTag(slug){
  const tag=tagCatalog.find(x=>x.slug===slug);if(!tag)return;
  discoverTags=discoverTags.some(x=>x.slug===tag.slug)?discoverTags.filter(x=>x.slug!==tag.slug):[...discoverTags,tag];
  renderDiscoverFilters();
  await applyDiscoveryTags();
}
function renderDiscoverFilters(){
  const q=key(discoverTagQuery);
  const selectedSlugs=new Set(discoverTags.map(x=>x.slug));
  let visible;
  if(q){
    visible=tagCatalog.filter(x=>key(x.name).includes(q)||key(x.slug).includes(q)).slice(0,50);
  }else if(discoverTagsExpanded){
    visible=tagCatalog;
  }else{
    visible=tagCatalog.slice(0,14);
    for(const t of discoverTags)if(!visible.some(x=>x.slug===t.slug))visible.push(t);
  }
  E.discoverSelectedTags.innerHTML=discoverTags.length
    ? `<span class="selected-label">ACTIVOS</span>${discoverTags.map(x=>`<button type="button" data-remove-tag="${esc(x.slug)}">${esc(x.name)} ×</button>`).join("")}`
    : `<small>Sin tags activos</small>`;
  E.discoverFilters.classList.toggle("expanded",discoverTagsExpanded||Boolean(q));
  E.discoverFilters.innerHTML=visible.map(x=>`<button class="${selectedSlugs.has(x.slug)?"active":""}" data-tag="${esc(x.slug)}">${esc(x.name)}</button>`).join("")||(tagCatalog.length?"<small class='status'>No encontré tags con ese texto.</small>":"<small class='status'>Cargando tags EDHREC…</small>");
  E.discoverTagsToggle.textContent=discoverTagsExpanded?`Mostrar menos`:`Ver todos los tags (${tagCatalog.length||"…" })`;
  E.discoverTagsToggle.setAttribute("aria-expanded",String(discoverTagsExpanded));
  E.discoverFilters.querySelectorAll("[data-tag]").forEach(b=>b.onclick=()=>toggleDiscoveryTag(b.dataset.tag));
  E.discoverSelectedTags.querySelectorAll("[data-remove-tag]").forEach(b=>b.onclick=()=>toggleDiscoveryTag(b.dataset.removeTag));
}
async function applyDiscoveryTags(){
  try{
    if(!discoverTags.length){ownedCommanders=[...allOwnedCommanders];renderDiscover();return}
    E.discoverStatus.textContent="Aplicando tags EDHREC…";
    ownedCommanders=(await req("/api/edhrec/tag-commanders",{method:"POST",headers:authHeaders(),body:JSON.stringify({tags:discoverTags.map(x=>x.slug)})})).results||[];
    renderDiscover();
  }catch(e){showError(e)}
}
function renderCompare(){
  E.compareChips.innerHTML=compareCommanders.map(c=>`<button class="compare-chip" data-remove="${esc(c.name)}">${esc(c.name)} ×</button>`).join("");
  const ready=compareCommanders.length>=2;
  E.compareBtn.disabled=!ready;E.floatingCompareWrap.classList.toggle("hidden",!ready);
  E.compareBtn.textContent=`Comparar ${compareCommanders.length} seleccionados`;
  E.compareChips.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{compareCommanders=compareCommanders.filter(c=>c.name!==b.dataset.remove);renderCompare();renderDiscover()});
}
function toggleCompare(c){if(!c)return;const exists=compareCommanders.some(x=>key(x.name)===key(c.name));if(exists)compareCommanders=compareCommanders.filter(x=>key(x.name)!==key(c.name));else{if(compareCommanders.length>=10)return showError(new Error("Podés seleccionar hasta 10 Commanders."));compareCommanders.push(c)}renderCompare();renderDiscover()}
function addCompare(c){if(c&&!compareCommanders.some(x=>key(x.name)===key(c.name)))toggleCompare(c)}
async function loadDiscovery(){
  try{
    if(!tagCatalog.length){const t=await req("/api/edhrec/tag-catalog");tagCatalog=t.tags||[];renderDiscoverFilters()}
    if(!allOwnedCommanders.length){
      E.discoverStatus.textContent="Preparando Commanders de tu colección…";
      E.discoverLoadProgress?.classList.remove("hidden");
      if(E.discoverLoadProgressBar)E.discoverLoadProgressBar.style.width="8%";
      const started=await req("/api/owned-commanders/start",{method:"POST",headers:authHeaders()});
      let job=started.job;
      while(job&&job.status==="running"){
        const pct=job.total>0?Math.max(6,Math.min(96,Math.round((Number(job.current||0)/Number(job.total))*100))):12;
        E.discoverStatus.textContent=job.message||"Cargando Commanders…";
        if(E.discoverLoadProgressBar)E.discoverLoadProgressBar.style.width=`${pct}%`;
        await new Promise(r=>setTimeout(r,350));
        job=(await req(`/api/owned-commanders/status?jobId=${encodeURIComponent(job.id)}`,{headers:authHeaders()})).job;
      }
      if(!job||job.status!=="done"){
        E.discoverStatus.textContent="Reintentando con carga directa…";
        const fallback=await req("/api/owned-commanders",{headers:authHeaders()});
        allOwnedCommanders=fallback.results||[];
      }else allOwnedCommanders=job.results||[];
      if(E.discoverLoadProgressBar)E.discoverLoadProgressBar.style.width="100%";
      E.discoverStatus.textContent=`${allOwnedCommanders.length} Commanders listos`;
      await new Promise(r=>setTimeout(r,220));
      E.discoverLoadProgress?.classList.add("hidden");
    }
    if(!discoverTags.length)ownedCommanders=[...allOwnedCommanders];
    renderDiscoverFilters();renderCompare();renderDiscover();
  }catch(e){
    E.discoverLoadProgress?.classList.add("hidden");
    showError(e);
    E.discoverStatus.textContent="No pude cargar Commanders.";
  }
}
E.discoverSearch.oninput=renderDiscover;
E.discoverTagSearch.oninput=()=>{discoverTagQuery=E.discoverTagSearch.value.trim();renderDiscoverFilters()};
E.discoverTagsToggle.onclick=()=>{discoverTagsExpanded=!discoverTagsExpanded;renderDiscoverFilters()};
E.discoverCollapse.onclick=()=>{discoverCollapsed=!discoverCollapsed;renderDiscover()};
E.compareCommanderSearch.oninput=()=>{const q=key(E.compareCommanderSearch.value),pool=allOwnedCommanders,rows=pool.filter(c=>!q||key(c.name).includes(q)).filter(c=>!compareCommanders.some(x=>key(x.name)===key(c.name))).slice(0,10);E.compareCommanderDropdown.innerHTML=rows.map(c=>`<button class="drop" data-name="${esc(c.name)}">${c.image?`<img src="${esc(c.image)}">`:""}<span><strong>${esc(c.name)}</strong><small>En tu colección</small></span></button>`).join("");E.compareCommanderDropdown.classList.toggle("hidden",!rows.length);E.compareCommanderDropdown.querySelectorAll("[data-name]").forEach(b=>b.onclick=()=>{addCompare(pool.find(c=>c.name===b.dataset.name));E.compareCommanderSearch.value="";E.compareCommanderDropdown.classList.add("hidden")})};
E.compareCommanderSearch.onfocus=()=>E.compareCommanderSearch.oninput();
E.compareBtn.onclick=async()=>{
  if(compareCommanders.length<2||compareCommanders.length>10)return;
  let progressTimer=null,started=Date.now(),stage=0;
  const stages=["Consultando EDHREC…","Cruzando con tu colección…","Calculando cobertura…","Preparando comparación…"];
  const total=compareCommanders.length;
  const originalLabel=E.compareBtn.textContent;
  E.compareBtn.disabled=true;E.compareBtn.classList.add("in-progress");
  E.compareProgressCaption.classList.remove("hidden");
  E.loading.classList.remove("hidden");E.loadingTitle.textContent=`Comparando ${total} Commanders…`;E.loadingText.textContent=stages[0];E.loadingElapsed.textContent="0s · esperando EDHREC";
  const tick=()=>{
    const sec=Math.floor((Date.now()-started)/1000);
    const next=Math.min(stages.length-1,Math.floor(sec/Math.max(1,total)));
    if(next>stage)stage=next;
    // relleno aproximado: crece rápido al principio y se frena cerca del final, nunca llega a 100% hasta terminar de verdad.
    const pct=Math.min(92,Math.round(100*(1-Math.exp(-sec/(total*1.6)))));
    E.compareBtn.style.setProperty("--fill",pct+"%");
    E.compareBtn.textContent=`Comparando… ${sec}s`;
    E.compareProgressCaption.textContent=`${stages[stage]} · ${sec}s`;
    E.loadingText.textContent=stages[stage];
    E.loadingElapsed.textContent=`${sec}s · ${total} Commander${total===1?"":"s"} en cola · el tiempo depende de EDHREC`;
  };
  tick();progressTimer=setInterval(tick,400);
  try{
    const d=await req("/api/compare-commanders",{method:"POST",headers:authHeaders(),body:JSON.stringify({commanders:compareCommanders.map(c=>c.name)})});
    E.compareBtn.style.setProperty("--fill","100%");
    E.compareProgressCaption.textContent="Listo. Renderizando…";
    const rows=d.results||[];
    E.rankResults.classList.add("compare-layout");
    E.rankResults.innerHTML=`<div class="compare-result-head"><div><span>COMPARACIÓN EDHREC</span><h3>${rows.length} Commanders evaluados</h3></div><small>Orden: recomendaciones EDHREC que ya tenés</small></div><div class="compare-result-grid">`+rows.map((x,i)=>`<article class="compare-result-card">${x.image?`<img src="${esc(x.image)}" loading="lazy">`:""}<div class="compare-rank">#${i+1}</div><h3>${esc(x.name)}</h3><div class="compare-metric hero"><span>EN TU COLECCIÓN</span><strong>${x.owned}</strong><small>de ${x.recommendations} recomendaciones</small></div><div class="compare-meter"><i style="width:${Math.max(0,Math.min(100,x.coveragePct||0))}%"></i></div><div class="compare-stats"><div><span>Cobertura</span><b>${x.coveragePct}%</b></div><div><span>Disponibles</span><b>${x.available}</b></div><div><span>Ocupadas</span><b>${x.occupied}</b></div><div><span>No poseídas</span><b>${x.missing}</b></div></div></article>`).join("")+`</div>`+((d.failures||[]).length?`<div class="compare-partial-note">${d.failures.length} análisis no pudieron completarse.</div>`:"");
    if((d.failures||[]).length)showError(new Error(`${d.failures.length} Commander${d.failures.length===1?"":"s"} no pudieron consultarse en EDHREC.`));
    discoverCollapsed=true;renderDiscover();E.rankResults.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){showError(e)}
  finally{
    if(progressTimer)clearInterval(progressTimer);
    E.loading.classList.add("hidden");
    E.compareBtn.disabled=false;E.compareBtn.classList.remove("in-progress");
    E.compareBtn.style.removeProperty("--fill");
    E.compareBtn.textContent=originalLabel;
    E.compareProgressCaption.classList.add("hidden");E.compareProgressCaption.textContent="";
  }
};

function labInfo(text){const en=translateLabInfo(text);return `<span class="info-dot" tabindex="0" role="button" aria-label="${uiLang==="en"?"Information":"Información"}" data-info-es="${esc(text)}" data-info-en="${esc(en)}"><span>i</span></span>`}
let infoPopover=null,activeInfoDot=null;
function ensureInfoPopover(){
  if(infoPopover)return infoPopover;
  infoPopover=document.createElement("div");infoPopover.className="info-popover";infoPopover.setAttribute("role","tooltip");document.body.appendChild(infoPopover);return infoPopover;
}
function positionInfoPopover(dot){
  const pop=ensureInfoPopover(),r=dot.getBoundingClientRect(),pad=12;
  pop.style.left="0px";pop.style.top="0px";
  const w=pop.offsetWidth,h=pop.offsetHeight;
  let left=r.left+r.width/2-w/2;left=Math.max(pad,Math.min(left,innerWidth-w-pad));
  let top=r.bottom+9;if(top+h>innerHeight-pad)top=Math.max(pad,r.top-h-9);
  pop.style.left=`${Math.round(left)}px`;pop.style.top=`${Math.round(top)}px`;
}
function showInfoPopover(dot){
  if(!dot)return;activeInfoDot=dot;const pop=ensureInfoPopover();pop.textContent=uiLang==="en"?(dot.dataset.infoEn||dot.dataset.infoEs||""):(dot.dataset.infoEs||"");pop.classList.add("visible");requestAnimationFrame(()=>positionInfoPopover(dot));
}
function hideInfoPopover(dot=null){if(dot&&activeInfoDot!==dot)return;activeInfoDot=null;infoPopover?.classList.remove("visible")}
document.addEventListener("mouseover",e=>{const dot=e.target.closest?.(".info-dot");if(dot)showInfoPopover(dot)});
document.addEventListener("mouseout",e=>{const dot=e.target.closest?.(".info-dot");if(dot&&!dot.contains(e.relatedTarget))hideInfoPopover(dot)});
document.addEventListener("focusin",e=>{const dot=e.target.closest?.(".info-dot");if(dot)showInfoPopover(dot)});
document.addEventListener("focusout",e=>{const dot=e.target.closest?.(".info-dot");if(dot)hideInfoPopover(dot)});
document.addEventListener("click",e=>{const dot=e.target.closest?.(".info-dot");if(!dot)return;e.preventDefault();e.stopPropagation();activeInfoDot===dot&&infoPopover?.classList.contains("visible")?hideInfoPopover(dot):showInfoPopover(dot)});
window.addEventListener("scroll",()=>activeInfoDot&&positionInfoPopover(activeInfoDot),true);window.addEventListener("resize",()=>activeInfoDot&&positionInfoPopover(activeInfoDot));
const MTG_TYPE_COLORS={Creature:"#ff3ed1",Instant:"#34e7ff",Sorcery:"#ffb020",Artifact:"#8f70ff",Enchantment:"#55f0a5",Planeswalker:"#ff668f",Battle:"#b7a4d6",Other:"#f3efff",Land:"#6f7b8a"};
const THEME_BAR_COLORS=["#ff3ed1","#34e7ff","#8f70ff","#ffb020","#55f0a5"];
const MTG_CURVE_TYPES=["Creature","Instant","Sorcery","Artifact","Enchantment","Planeswalker","Battle","Other"];
function donutGradient(dist){
  const colors=(dist||[]).map(x=>MTG_TYPE_COLORS[x.type]||MTG_TYPE_COLORS.Other);
  const total=Math.max(1,(dist||[]).reduce((n,x)=>n+Number(x.count||0),0));let at=0,parts=[];
  (dist||[]).forEach((x,i)=>{const from=at/total*360;at+=Number(x.count||0);const to=at/total*360;parts.push(`${colors[i]||MTG_TYPE_COLORS.Other} ${from}deg ${to}deg`)});
  return `conic-gradient(${parts.join(",")||"#332744 0deg 360deg"})`;
}
function segmentedFillHtml(value,color,segments=10){
  const raw=typeof value==="string"?value.replace(/%/g,""):value;
  const pctValue=Math.max(0,Math.min(100,Number(raw)||0));
  return Array.from({length:segments},(_,i)=>{
    const segmentStart=i*(100/segments),segmentSize=100/segments;
    const localFill=Math.max(0,Math.min(100,((pctValue-segmentStart)/segmentSize)*100));
    return `<i class="segmented-fill"><b style="width:${localFill}%;background:${color}"></b></i>`;
  }).join("");
}
function pct(v){return `${Math.round(Number(v||0)*100)}%`}
function confidenceLabel(v){const n=Number(v||0);return n>=.85?"Alta":n>=.65?"Media":"Baja"}
function fmtNum(v,d=2){const n=Number(v);if(!Number.isFinite(n))return "—";return Number.isInteger(n)?String(n):n.toFixed(d)}
const METRIC_HELP={
  manaReliability:"Qué mide: si tu base de maná acompaña el plan temprano del mazo. Cómo leerlo: más alto suele ser mejor. Cómo lo calcula: mezcla probabilidad de land drops, fixing y acceso a los colores correctos hacia T3.",
  earlyDevelopment:"Qué mide: con qué frecuencia el mazo arranca haciendo algo útil en los primeros turnos. Cómo leerlo: más alto es mejor. Cómo lo calcula: simula aperturas y cuenta land drops, ramp, fixing y jugadas productivas entre T1 y T3.",
  resourceFlow:"Qué mide: cuánto acceso sostenido a recursos tiene el mazo. Cómo leerlo: más alto suele ser mejor. Cómo lo calcula: identifica draw, selection, tutors, recursion y engines, y estima qué tan seguido aparecen a tiempo.",
  interaction:"Qué mide: cuánta interacción real lleva el mazo. Cómo leerlo: más alto suele significar mejor cobertura. Cómo lo calcula: cuenta removal, wipes, protección y counters, y pondera eficiencia, coste y flexibilidad.",
  threatPayoff:"Qué mide: si el mazo tiene suficientes piezas que conviertan setup en presión. Cómo leerlo: más alto implica más acceso a payoffs; conviene leerlo junto con el detalle de threats/payoffs. Cómo lo calcula: clasifica amenazas y payoffs y estima su disponibilidad.",
  engineDensity:"Qué mide: cuántos motores repetibles de valor tiene el mazo. Cómo leerlo: más alto suele ser mejor. Cómo lo calcula: detecta cartas que generan ventaja repetible y estima su acceso hacia T5.",
  functionalDensity:"Qué mide: cuántos trabajos útiles cumple cada carta en promedio. Cómo leerlo: más alto significa mayor versatilidad. Cómo lo calcula: asigna roles primarios y secundarios y obtiene una densidad funcional ponderada.",
  setupPayoffBalance:"Qué mide: el equilibrio entre cartas que preparan el plan y cartas que lo capitalizan. Cómo leerlo: cuanto más cerca de 1.0, más balanceado. Muy por debajo o por encima suele indicar desequilibrio. Cómo lo calcula: compara enablers contra payoffs.",
  consistency:"Qué mide: qué tan seguido el mazo consigue encadenar su plan base. Cómo leerlo: más alto es mejor. Cómo lo calcula: combina cobertura de roles, redundancia y probabilidad de secuencia core en la simulación.",
  synergyDensity:"Qué mide: cuánto dialogan las cartas entre sí y con el plan del commander. Cómo leerlo: más alto es mejor, pero es una señal heurística. Cómo lo calcula: synergy tags, dependencias y coincidencias funcionales.",
  dependency:"Qué mide: si el mazo depende demasiado del commander o de piezas puntuales. Cómo leerlo: más bajo es mejor. Cómo lo calcula: estima cuánto cae la estructura sin commander, cementerio, criaturas o artefactos y detecta roles con poca redundancia.",
  deadCardRisk:"Qué mide: el riesgo de robar cartas que frecuentemente quedan sin contexto. Cómo leerlo: más bajo es mejor. Cómo lo calcula: proxy estructural basado en dependencias, usabilidad esperada y cuellos de botella. Es experimental.",
  resilience:"Qué mide: cuánto aguanta el mazo cuando pierde una parte importante de su plan. Cómo leerlo: más alto es mejor. Cómo lo calcula: compara cobertura funcional base contra escenarios sin commander, sin graveyard, sin artefactos o sin criaturas.",
  effectiveManaValue:"Qué mide: el coste real aproximado del mazo, más allá del MV impreso. Cómo leerlo: es contextual; en general más bajo implica un mazo más liviano, pero no es un score de calidad por sí solo. Cómo lo calcula: parte del MV impreso y descuenta reducers/rebajas detectadas.",
  turnOfRelevance:"Qué mide: en qué turno el mazo suele empezar a presentar algo realmente relevante. Cómo leerlo: cuanto antes, mejor; T1-T3 es más rápido que T5-T6. Cómo lo calcula: observa hitos como commander castable, engine online, payoff o threat disponible.",
  closingPower:"Qué mide: la capacidad de transformar ventaja en cierre real. Cómo leerlo: más alto es mejor, con menor certeza que una métrica puramente numérica. Cómo lo calcula: busca evidencia de finishers, multiplicadores, evasión, extra combats o líneas de combo.",
  goldfish:"Qué mide: el bloque de simulación temprana del mazo. Cómo leerlo: la cifra principal acá no es 'mejor o peor'; indica cuántas simulaciones se corrieron. El valor analítico está en la tabla T1-T7. Cómo lo calcula: ejecuta miles de aperturas sin oponentes ni combate real."
};
const METRIC_LABELS={creature:"Creatures",artifact:"Artifacts",enchantment:"Enchantments",planeswalker:"Planeswalkers",land:"Lands",graveyard:"Graveyard",stack:"Stack",wipes:"Board wipes",protection:"Protection"};
const METRIC_HELP_EN={
  manaReliability:"What it measures: whether your mana base supports the deck's early plan. How to read it: higher is generally better. How it works: combines land-drop probability, fixing, ramp and access to the correct colors by turn 3.",
  earlyDevelopment:"What it measures: how often the deck starts by doing something useful in the first turns. How to read it: higher is better. How it works: simulates opening hands and tracks land drops, ramp, fixing and productive plays from turns 1 to 3.",
  resourceFlow:"What it measures: how much sustained access to resources the deck has. How to read it: higher is generally better. How it works: identifies draw, selection, tutors, recursion and engines, then estimates how often they are available on time.",
  interaction:"What it measures: how much real interaction the deck plays. How to read it: higher usually means better coverage. How it works: counts removal, wipes, protection and counters, while considering efficiency, mana cost and flexibility.",
  threatPayoff:"What it measures: whether the deck has enough cards that turn setup into pressure. How to read it: higher means greater payoff access; read it together with the threat/payoff breakdown. How it works: classifies threats and payoffs and estimates their availability.",
  engineDensity:"What it measures: how many repeatable value engines the deck contains. How to read it: higher is generally better. How it works: detects cards that repeatedly generate advantage and estimates access by turn 5.",
  functionalDensity:"What it measures: how many useful jobs each card performs on average. How to read it: higher means more versatility. How it works: assigns primary and secondary roles and calculates weighted functional density.",
  setupPayoffBalance:"What it measures: the balance between cards that set up the plan and cards that capitalize on it. How to read it: values closer to 1.0 are more balanced; much lower or higher may indicate an imbalance. How it works: compares enablers against payoffs.",
  consistency:"What it measures: how often the deck can assemble its basic game plan. How to read it: higher is better. How it works: combines role coverage, redundancy and the simulated probability of its core sequence.",
  synergyDensity:"What it measures: how strongly cards connect with one another and with the commander's plan. How to read it: higher is better, but this is a heuristic signal. How it works: uses synergy tags, dependencies and functional matches.",
  dependency:"What it measures: whether the deck depends too heavily on the commander or specific pieces. How to read it: lower is better. How it works: estimates how much functionality drops without the commander, graveyard, creatures or artifacts, and detects low-redundancy roles.",
  deadCardRisk:"What it measures: the risk of drawing cards that often lack the context they need. How to read it: lower is better. How it works: uses a structural proxy based on dependencies, expected usability and bottlenecks. Experimental.",
  resilience:"What it measures: how much of the deck still works after losing an important part of its plan. How to read it: higher is better. How it works: compares baseline functional coverage against scenarios without the commander, graveyard, artifacts or creatures.",
  effectiveManaValue:"What it measures: the deck's approximate real casting cost beyond printed mana value. How to read it: contextual; lower generally means a lighter deck, but it is not a quality score by itself. How it works: starts from printed mana value and applies detected reliable cost reductions.",
  turnOfRelevance:"What it measures: when the deck usually begins presenting something opponents must care about. How to read it: earlier is better. How it works: tracks milestones such as commander castability, an engine online, a payoff or a threat being available.",
  closingPower:"What it measures: the deck's ability to convert an advantage into an actual finish. How to read it: higher is better, with less certainty than purely numeric metrics. How it works: looks for finishers, damage multipliers, evasion, extra combats and combo evidence.",
  goldfish:"What it measures: the deck's early-development simulation. How to read it: the headline number is not good or bad; it is the number of simulations. The useful analysis is in the turn-by-turn table. How it works: runs thousands of opening sequences without opponents or real combat."
};
function translateLabInfo(text){
  for(const [k,v] of Object.entries(METRIC_HELP))if(v===text)return METRIC_HELP_EN[k]||text;
  const exact={
    "Turno simulado, de T1 a T7.":"Simulated turn, from T1 to T7.",
    "Probabilidad de poder hacer el land drop correspondiente a ese turno.":"Probability of being able to make the land drop for that turn.",
    "Maná utilizable promedio estimado en ese turno.":"Estimated average usable mana on that turn.",
    "Probabilidad de poder usar el turno en una jugada temprana funcional: ramp, fixing, draw/selection, engine o cost reduction de MV 3 o menos.":"Probability of having a functional early play: ramp, fixing, draw/selection, engine or mana-value-3-or-less cost reduction.",
    "Probabilidad de tener disponible al menos un motor repetible de valor.":"Probability of having at least one repeatable value engine available.",
    "Probabilidad de tener disponible una carta que capitaliza el setup del mazo.":"Probability of having a card available that capitalizes on the deck's setup.",
    "Probabilidad de tener disponible una amenaza o finisher según la clasificación semántica.":"Probability of having a threat or finisher available according to the semantic classification.",
    "Probabilidad de poder pagar el coste y colores del Commander en ese turno.":"Probability of being able to pay the commander's mana cost and color requirements on that turn.",
    "Roles con una sola carta o muy poca redundancia. No son errores automáticos: son puntos de dependencia que conviene conocer.":"Roles supported by a single card or very little redundancy. They are not automatic errors; they are dependency points worth knowing.",
    "La cifra grande es la señal principal. Debajo aparecen las variables que la explican. El pie 'Filtra N cartas' coincide con la cantidad que vas a ver en la deck list al tocar la tarjeta.":"The large number is the primary signal. The variables underneath explain it. The card count at the bottom matches what the deck list will show when you click the metric.",
    "Alta: datos y cálculos directos. Media: mezcla de datos y heurísticas. Baja: señal experimental muy dependiente del contexto.":"High: mostly direct data and calculations. Medium: a mix of data and heuristics. Low: an experimental signal that depends heavily on context.",
    "Cartas no-tierra agrupadas por coste de maná convertido (CMC), coloreadas por tipo primario.":"Nonland cards grouped by converted mana cost (CMC), colored by primary card type.",
    "Temas detectados por evidencia EDHREC/Oracle. % = cartas que sostienen ese tema sobre el tamaño total del mazo (Size).":"Themes detected from EDHREC/Oracle evidence. % = cards supporting that theme divided by total deck size.",
    "Distribución del mazo por tipo primario de carta (Creature, Instant, etc.), sin contar tierras.":"Deck distribution by primary card type (Creature, Instant, etc.), excluding lands."
  };
  let m;
  if((m=String(text).match(/^Método: cuatro ejes estructurales, clasificación heurística por texto Oracle y CMC medio (.+)\. No conoce tu metajuego ni intención exacta\.$/)))return `Method: four structural axes, heuristic Oracle-text classification and average CMC ${m[1]}. It does not know your metagame or exact intent.`;
  return exact[text]||translateUiCore(text);
}

function humanizeToken(v){return String(v||"").split("_").filter(Boolean).map(x=>x.length<=2?x.toUpperCase():x.charAt(0).toUpperCase()+x.slice(1)).join(" ")||"—"}
function classificationQty(c){return Math.max(1,Number(c?.quantity||1))}
function classificationIsLand(c){return /\bland\b/i.test(String(c?.typeLine||""))}
function classifiedNames(dm,predicate){return (dm?.classifications||[]).filter(predicate).map(c=>c.name)}
function filteredQuantity(dm,names){const wanted=new Set((names||[]).map(key));return (dm?.classifications||[]).filter(c=>wanted.has(key(c.name))).reduce((n,c)=>n+classificationQty(c),0)}
function metricReadingLabel(metricKey){
  const map={
    manaReliability:"↑ más alto = mejor",
    earlyDevelopment:"↑ más alto = mejor",
    resourceFlow:"↑ más alto = mejor",
    interaction:"↑ más alto = mejor",
    threatPayoff:"↑ más alto = mejor",
    engineDensity:"↑ más alto = mejor",
    functionalDensity:"↑ más alto = mejor",
    setupPayoffBalance:"◎ mejor cerca de 1.0",
    consistency:"↑ más alto = mejor",
    synergyDensity:"↑ más alto = mejor",
    dependency:"↓ más bajo = mejor",
    deadCardRisk:"↓ más bajo = mejor",
    resilience:"↑ más alto = mejor",
    effectiveManaValue:"◌ lectura contextual",
    turnOfRelevance:"↓ más temprano = mejor",
    closingPower:"↑ más alto = mejor",
    goldfish:"◌ no es score"
  };
  return map[metricKey]||"◌ lectura contextual";
}
function metricFilterCards(dm,keyName){
  const cls=dm?.classifications||[],has=(c,...roles)=>roles.some(r=>(c.roles||[]).includes(r));
  if(keyName==="manaReliability")return cls.filter(c=>classificationIsLand(c)||has(c,"ramp","mana_fixing","cost_reduction")).map(c=>c.name);
  if(keyName==="earlyDevelopment")return cls.filter(c=>!classificationIsLand(c)&&Number(c.manaValue||0)<=3&&has(c,"ramp","mana_fixing","card_selection","card_draw","engine","cost_reduction")).map(c=>c.name);
  if(keyName==="resourceFlow")return cls.filter(c=>has(c,"card_draw","impulse_draw","tutor","recursion","card_advantage")).map(c=>c.name);
  if(keyName==="interaction")return cls.filter(c=>has(c,"removal","counterspell","board_wipe","graveyard_interaction")).map(c=>c.name);
  if(keyName==="threatPayoff")return cls.filter(c=>has(c,"threat","payoff")).map(c=>c.name);
  if(keyName==="engineDensity")return cls.filter(c=>has(c,"engine")).map(c=>c.name);
  if(keyName==="functionalDensity")return cls.filter(c=>!classificationIsLand(c)&&(c.roles||[]).length>=2).map(c=>c.name);
  if(keyName==="setupPayoffBalance")return cls.filter(c=>c.setup||c.payoff).map(c=>c.name);
  if(keyName==="consistency")return cls.filter(c=>has(c,"ramp","card_draw","engine","payoff","removal","counterspell","board_wipe")).map(c=>c.name);
  if(keyName==="synergyDensity"){
    const details=new Map((dm?.metrics?.synergyDensity?.details||[]).map(x=>[key(x.name),x]));
    return cls.filter(c=>["strong","moderate"].includes(details.get(key(c.name))?.band)).map(c=>c.name);
  }
  if(keyName==="dependency")return cls.filter(c=>(c.dependencies||[]).length).map(c=>c.name);
  if(keyName==="resilience")return cls.filter(c=>has(c,"protection","recursion","engine")).map(c=>c.name);
  if(keyName==="effectiveManaValue")return cls.filter(c=>has(c,"cost_reduction")).map(c=>c.name);
  if(keyName==="deadCardRisk"){
    const names=new Set((dm?.metrics?.deadCardRisk?.riskyCards||[]).map(x=>key(x.name)));return cls.filter(c=>names.has(key(c.name))).map(c=>c.name);
  }
  if(keyName==="turnOfRelevance")return cls.filter(c=>has(c,"engine","payoff","threat","finisher")).map(c=>c.name);
  if(keyName==="closingPower")return cls.filter(c=>has(c,"finisher","damage_engine","threat")).map(c=>c.name);
  if(keyName==="goldfish")return cls.map(c=>c.name);
  return [];
}
function coverageFilterCards(dm,coverageKey){
  const fromMetric=dm?.metrics?.interactionDensity?.coverage?.[coverageKey]?.cards;
  if(Array.isArray(fromMetric))return fromMetric;
  const map={creature:["creature_removal","removal"],artifact:["artifact_removal"],enchantment:["enchantment_removal"],planeswalker:["planeswalker_removal"],land:["land_interaction"],graveyard:["graveyard_interaction"],stack:["counterspell"],wipes:["board_wipe"],protection:["protection"]};
  const wanted=new Set(map[coverageKey]||[]);return (dm?.classifications||[]).filter(c=>(c.roles||[]).some(r=>wanted.has(r))).map(c=>c.name);
}
function renderMetricStats(stats=[]){return `<div class="metric-mini-stats">${stats.map(x=>`<span><b>${esc(x.value)}</b><small>${esc(x.label)}</small></span>`).join("")}</div>`}
function renderDeckMetricsLab(dm){
  if(!dm?.metrics)return "";
  const m=dm.metrics,e=dm.engine||{},sim=m.goldfishDevelopment||{},rows=sim.byTurn||[],cls=dm.classifications||[];
  const nonlandCount=cls.filter(c=>!classificationIsLand(c)).reduce((n,c)=>n+classificationQty(c),0)||1;
  const core=[
    {key:"manaReliability",title:"Fiabilidad de maná",eyebrow:"Base de maná",value:pct(m.manaReliability?.requiredColorsT3),valueLabel:"colores correctos en T3",confidence:m.manaReliability?.confidence,stats:[{value:pct(m.manaReliability?.landDropT3),label:"Land T3"},{value:pct(m.manaReliability?.rampByT3),label:"Ramp T3"}]},
    {key:"earlyDevelopment",title:"Desarrollo temprano",eyebrow:"Turns T1–T3",value:pct(m.earlyDevelopment?.productiveT3),valueLabel:"turnos productivos en T3",confidence:m.earlyDevelopment?.confidence,stats:[{value:pct(m.earlyDevelopment?.productiveT2),label:"Productivo T2"},{value:fmtNum(m.earlyDevelopment?.averageManaT3,1),label:"Mana T3"}]},
    {key:"resourceFlow",title:"Flujo de recursos",eyebrow:"Recursos",value:pct((m.resourceFlow?.resourceEffects||0)/nonlandCount),valueLabel:"densidad de recursos",confidence:m.resourceFlow?.confidence,stats:[{value:fmtNum(m.resourceFlow?.resourceEffects,0),label:"Cartas"},{value:pct(m.resourceFlow?.resourceAvailableT5),label:"Acceso T5"},{value:fmtNum(m.resourceFlow?.repeatableEngines,0),label:"Engines"}]},
    {key:"interaction",title:"Interacción",eyebrow:"Cantidad + calidad",value:pct(m.interactionDensity?.density),valueLabel:"densidad de interacción",confidence:m.interactionDensity?.confidence,stats:[{value:fmtNum(m.interactionDensity?.count,0),label:"Cartas"},{value:pct(m.interactionEfficiency?.score),label:"Eficiencia"}]},
    {key:"threatPayoff",title:"Amenazas / Payoffs",eyebrow:"Presión",value:pct(m.threatPayoffDensity?.payoffDensity),valueLabel:"densidad de payoffs",confidence:m.threatPayoffDensity?.confidence,stats:[{value:fmtNum(m.threatPayoffDensity?.payoffs,0),label:"Payoffs"},{value:fmtNum(m.threatPayoffDensity?.threats,0),label:"Threats"},{value:pct(m.threatPayoffDensity?.payoffAvailableT5),label:"Payoff T5"}]},
    {key:"engineDensity",title:"Densidad de engines",eyebrow:"Motores",value:pct(m.engineDensity?.density),valueLabel:"densidad de engines",confidence:m.engineDensity?.confidence,stats:[{value:fmtNum(m.engineDensity?.count,0),label:"Engines"},{value:pct(m.engineDensity?.availableT5),label:"Disponible T5"}]}
  ];
  const structure=[
    {key:"functionalDensity",title:"Densidad funcional",eyebrow:"Versatilidad",value:fmtNum(m.functionalDensity?.value,2),valueLabel:"roles ponderados por carta",confidence:m.functionalDensity?.confidence,stats:[{value:fmtNum(m.functionalDensity?.twoRoles,0),label:"2 roles"},{value:fmtNum(m.functionalDensity?.threePlusRoles,0),label:"3+ roles"}]},
    {key:"setupPayoffBalance",title:"Setup / Payoff",eyebrow:"Balance",value:fmtNum(m.setupPayoffBalance?.ratio,2),valueLabel:"setup por payoff",confidence:m.setupPayoffBalance?.confidence,stats:[{value:fmtNum(m.setupPayoffBalance?.enablers,0),label:"Setup"},{value:fmtNum(m.setupPayoffBalance?.payoffs,0),label:"Payoffs"}]},
    {key:"consistency",title:"Consistencia",eyebrow:"Plan de juego",value:pct(m.gameplanConsistency?.value),valueLabel:"consistencia estimada",confidence:m.gameplanConsistency?.confidence,stats:[{value:pct(m.gameplanConsistency?.coreSequenceProbability),label:"Secuencia core"},{value:pct(m.gameplanConsistency?.roleRedundancy),label:"Redundancia"}]},
    {key:"synergyDensity",title:"Densidad de sinergia",eyebrow:"Sinergia",value:pct(m.synergyDensity?.density),valueLabel:"densidad de sinergia",confidence:m.synergyDensity?.confidence,stats:[{value:fmtNum(m.synergyDensity?.strong,0),label:"Fuerte"},{value:fmtNum(m.synergyDensity?.moderate,0),label:"Moderada"}]},
    {key:"dependency",title:"Dependencia",eyebrow:"Fragilidad",value:m.dependencyRisk?.dependencies?.commander?.level||"LOW",valueLabel:"dependencia del commander",confidence:m.dependencyRisk?.confidence,stats:[{value:pct(m.dependencyRisk?.dependencies?.commander?.ratio),label:"Commander"},{value:String((m.dependencyRisk?.bottlenecks||[]).length),label:"Roles frágiles"}]},
    {key:"resilience",title:"Resiliencia",eyebrow:"Recuperación",value:pct(m.resilience?.withoutCommander),valueLabel:"función sin commander",confidence:m.resilience?.confidence,stats:[{value:pct(m.resilience?.withoutGraveyard),label:"Sin graveyard"},{value:pct(m.resilience?.withoutArtifacts),label:"Sin artifacts"}]},
    {key:"effectiveManaValue",title:"MV efectivo",eyebrow:"Curva ajustada",value:fmtNum(m.effectiveManaValue?.adjustedAverage,2),valueLabel:"mana value efectivo",confidence:m.effectiveManaValue?.confidence,stats:[{value:fmtNum(m.effectiveManaValue?.printedAverage,2),label:"Printed MV"},{value:String((m.effectiveManaValue?.reducers||[]).length),label:"Reducers"}]}
  ];
  const experimental=[
    {key:"deadCardRisk",title:"Riesgo de carta muerta",eyebrow:"Experimental",value:pct(m.deadCardRisk?.rate),valueLabel:"riesgo estructural",confidence:m.deadCardRisk?.confidence,stats:[{value:String((m.deadCardRisk?.riskyCards||[]).length),label:"Señaladas"}]},
    {key:"turnOfRelevance",title:"Turno de relevancia",eyebrow:"Timing",value:m.speed?.medianTurn?`T${m.speed.medianTurn}`:"—",valueLabel:"hito ≥50%",confidence:m.speed?.confidence,stats:[]},
    {key:"closingPower",title:"Capacidad de cierre",eyebrow:"Cierre",value:m.closingPower?.level||"—",valueLabel:"capacidad de cierre",confidence:m.closingPower?.confidence,stats:[{value:String(m.closingPower?.evidence?.finishers??0),label:"Finishers"},{value:String(m.closingPower?.evidence?.extraCombat??0),label:"Extra combats"}]},
    {key:"goldfish",title:"Goldfish",eyebrow:"Simulador",value:String(sim.iterations||e.simulationCount||0),valueLabel:"simulaciones",confidence:sim.confidence,stats:[{value:fmtNum(sim.averageMulligans,2),label:"Avg mulligans"}]}
  ];
  const card=metric=>{const names=metricFilterCards(dm,metric.key),qty=filteredQuantity(dm,names);return `<article class="metrics-lab-card metrics-tone-${confidenceLabel(metric.confidence).toLowerCase()}" data-metric-filter="${esc(metric.key)}" tabindex="0"><div class="metrics-card-header"><div class="metrics-card-head-copy"><small>${esc(metric.eyebrow)}</small><h4>${esc(metric.title)} ${labInfo(METRIC_HELP[metric.key]||"")}</h4><span class="metric-reading">${esc(metricReadingLabel(metric.key))}</span></div><b class="metrics-confidence-pill">${esc(confidenceLabel(metric.confidence))}</b></div><div class="metric-primary"><strong>${esc(metric.value)}</strong><span>${esc(metric.valueLabel)}</span></div>${renderMetricStats(metric.stats)}<div class="metric-filter-note"><span>Tocar filtra deck list</span><b>${qty} cartas</b></div></article>`};
  const group=(title,desc,items)=>`<section class="metrics-cluster"><div class="metrics-cluster-head"><div><h4>${esc(title)}</h4><p>${esc(desc)}</p></div></div><div class="metrics-overview-grid">${items.map(card).join("")}</div></section>`;
  const coreHtml=group("Métricas principales","Todos usan una señal principal comparable y debajo muestran las variables que la explican. Tocá una tarjeta para ver exactamente qué cartas participan.",core);
  const structureHtml=group("Estructura y balance","Cómo está construido el mazo: redundancia, roles, dependencia, resiliencia y curva real.",structure);
  const experimentalHtml=`<details class="metrics-details metrics-group-details"><summary>Experimental / heurística</summary><div class="metrics-group-panel"><div class="metrics-cluster-head"><div><h4>Experimental / heurística</h4><p>Señales útiles pero más dependientes de interpretación; permanecen plegadas para reducir ruido.</p></div></div><div class="metrics-overview-grid">${experimental.map(card).join("")}</div></div></details>`;
  const cov=m.interactionDensity?.coverage||{},coverageOrder=["creature","artifact","enchantment","graveyard","stack","wipes","protection","planeswalker","land"];
  const coverage=coverageOrder.filter(k=>cov[k]).map(k=>`<button type="button" class="coverage-item" data-coverage-filter="${esc(k)}"><span>${esc(METRIC_LABELS[k]||k)}</span><b>${cov[k].count??0}</b><small>cartas</small></button>`).join("");
  const simRows=rows.map(r=>`<tr><th>T${r.turn}</th><td>${pct(r.landDrop)}</td><td>${fmtNum(r.averageMana,2)}</td><td>${pct(r.productive)}</td><td>${pct(r.engineAvailable)}</td><td>${pct(r.payoffAvailable)}</td><td>${pct(r.threatAvailable)}</td><td>${pct(r.commanderCastable)}</td></tr>`).join("");
  const classifications=cls.map((c,i)=>`<tr><td><button type="button" class="metric-card-link" data-metric-card="${i}">${esc(c.name)}</button></td><td>${esc(c.primaryRole||"—")}</td><td>${esc((c.roles||[]).join(", ")||"—")}</td><td>${esc((c.dependencies||[]).join(", ")||"—")}</td><td>${esc((c.synergyTags||[]).slice(0,5).join(", ")||"—")}</td><td>${fmtNum(c.functionalWeight,2)}</td><td>${pct(c.confidence)}</td></tr>`).join("");
  const bottlenecksData=(m.dependencyRisk?.bottlenecks||[]).slice(0,8),bottlenecks=bottlenecksData.map(x=>`<button type="button" class="bottleneck-item" data-fragile-cards="${encodeURIComponent(JSON.stringify(x.cards||[]))}"><strong>${esc(humanizeToken(x.role))}</strong><p>Este rol depende de <b>${esc((x.cards||[]).join(", ")||"—")}</b>. Si esa pieza falta, hay poca o ninguna redundancia.</p></button>`).join("");
  const bottleneckSummary=bottlenecksData.length?`Detecté ${bottlenecksData.length} roles con muy poca redundancia. No significa que estén mal: marca dónde una sola pieza sostiene una función.`:`No detecté roles sostenidos por una sola carta.`;
  const risky=(m.deadCardRisk?.riskyCards||[]).map(x=>`<span>${esc(x.name)} · ${pct(x.risk)} · ${esc((x.dependencies||[]).join(", "))}</span>`).join("");
  return `<section class="health-section metrics-lab-section" data-lab-section="metrics"><div class="lab-section-title"><div><span>06</span><h3>Motor de métricas del mazo</h3></div><p>LAB · motor v${e.metricsVersion||1} · clasificación v${e.classificationVersion||1} · simulación v${e.simulationVersion||1}</p></div><div class="metrics-engine-banner"><strong>SOLO LAB</strong><span>Estas métricas son experimentales y se muestran sólo en LAB. No alteran EDHREComendaciones ni los cambios IN/OUT.</span></div><div class="metrics-intro-grid"><article class="metrics-intro-card"><h4>Cómo leerlo ${labInfo("La cifra grande es la señal principal. Debajo aparecen las variables que la explican. El pie 'Filtra N cartas' coincide con la cantidad que vas a ver en la deck list al tocar la tarjeta.")}</h4><p>La cifra grande concentra el foco; los datos secundarios explican de dónde sale.</p></article><article class="metrics-intro-card"><h4>Confianza ${labInfo("Alta: datos y cálculos directos. Media: mezcla de datos y heurísticas. Baja: señal experimental muy dependiente del contexto.")}</h4><p><span class="metrics-mini-pill high">Alta</span><span class="metrics-mini-pill medium">Media</span><span class="metrics-mini-pill low">Baja</span></p></article></div>${coreHtml}${structureHtml}${experimentalHtml}<div class="metrics-support-grid"><article><h4>Cobertura de interacción ${labInfo(METRIC_HELP.interaction)}</h4><p class="support-copy">Cada bloque es clickeable y la cantidad coincide con la deck list filtrada.</p><div class="coverage-mini-grid">${coverage||"<span class='lab-muted'>Sin datos.</span>"}</div></article><article><h4>Roles frágiles ${labInfo("Roles con una sola carta o muy poca redundancia. No son errores automáticos: son puntos de dependencia que conviene conocer.")}</h4><p class="bottleneck-lead">${esc(bottleneckSummary)}</p><div class="bottleneck-list">${bottlenecks||"<div class='bottleneck-item static'><strong>Sin alertas</strong><p>No encontré un rol crítico sostenido por una sola pieza.</p></div>"}</div></article></div><div class="metrics-table-wrap"><div class="metrics-table-head"><div><h4>Simulación de desarrollo ${labInfo(METRIC_HELP.goldfish)}</h4><small>Lectura de T1–T7 · pasá por la i de cada columna para ver su definición.</small></div><small>${sim.iterations||0} iteraciones · no simula oponentes ni combate real</small></div><table class="metrics-table simulation-table sortable-table"><thead><tr><th>Turno ${labInfo("Turno simulado, de T1 a T7.")}</th><th>Land ${labInfo("Probabilidad de poder hacer el land drop correspondiente a ese turno.")}</th><th>Mana ${labInfo("Maná utilizable promedio estimado en ese turno.")}</th><th>Productivo ${labInfo("Probabilidad de poder usar el turno en una jugada temprana funcional: ramp, fixing, draw/selection, engine o cost reduction de MV 3 o menos.")}</th><th>Engine ${labInfo("Probabilidad de tener disponible al menos un motor repetible de valor.")}</th><th>Payoff ${labInfo("Probabilidad de tener disponible una carta que capitaliza el setup del mazo.")}</th><th>Threat ${labInfo("Probabilidad de tener disponible una amenaza o finisher según la clasificación semántica.")}</th><th>Commander ${labInfo("Probabilidad de poder pagar el coste y colores del Commander en ese turno.")}</th></tr></thead><tbody>${simRows}</tbody></table></div><details class="metrics-details"><summary>Clasificación semántica · ${cls.length} entradas</summary><div class="metrics-table-wrap semantic-table-wrap"><table class="metrics-table semantic-table semantic-compact-table sortable-table"><thead><tr><th>Carta</th><th>Primario</th><th>Roles</th><th>Dependencias</th><th>Synergy tags</th><th>Func.</th><th>Conf.</th></tr></thead><tbody>${classifications}</tbody></table></div></details><details class="metrics-details"><summary>Detalles experimentales</summary><div class="metrics-debug-grid"><article><h4>Proxy de cartas muertas ${labInfo(METRIC_HELP.deadCardRisk)}</h4><div class="metric-chip-list">${risky||"<span>Sin riesgos estructurales altos detectados</span>"}</div></article><article><h4>Evidencia de cierre ${labInfo(METRIC_HELP.closingPower)}</h4><pre>${esc(JSON.stringify(m.closingPower?.evidence||{},null,2))}</pre></article><article><h4>Resumen de resiliencia ${labInfo(METRIC_HELP.resilience)}</h4><pre>${esc(JSON.stringify({withoutCommander:m.resilience?.withoutCommander,withoutGraveyard:m.resilience?.withoutGraveyard,withoutArtifacts:m.resilience?.withoutArtifacts,withoutCreatures:m.resilience?.withoutCreatures},null,2))}</pre></article></div></details><div class="metrics-caveats">${(dm.caveats||[]).map(x=>`<span>• ${esc(x)}</span>`).join("")}</div></section>`;
}
function makeTablesSortable(root){
  root.querySelectorAll("table.sortable-table").forEach(table=>{
    table.querySelectorAll("thead th").forEach((th,index)=>{
      th.classList.add("sortable-col");th.tabIndex=0;th.setAttribute("role","button");
      const run=()=>{
        const body=table.tBodies[0];if(!body)return;
        const asc=th.dataset.dir!=="asc";table.querySelectorAll("thead th").forEach(x=>{delete x.dataset.dir});th.dataset.dir=asc?"asc":"desc";
        const value=cell=>{const raw=cell.textContent.trim().replace(/%/g,"").replace(/^T/i,"");const n=Number(raw);return Number.isFinite(n)&&raw!==""?n:cell.textContent.trim().toLocaleLowerCase("es")};
        [...body.rows].sort((a,b)=>{const av=value(a.cells[index]),bv=value(b.cells[index]);const cmp=typeof av==="number"&&typeof bv==="number"?av-bv:String(av).localeCompare(String(bv),"es",{numeric:true});return asc?cmp:-cmp}).forEach(r=>body.appendChild(r));
      };
      th.onclick=e=>{if(e.target.closest(".info-dot"))return;run()};th.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();run()}};
    });
  });
}
function renderLabResult(d,target=E.labResults,inspectorMode="lab",detail=labDeckDetail){
  labHealth=d;
  const health=d.health.map((h,hi)=>{
    const max=Math.max(Number(h.refMax||0),Number(h.value||0),1);
    const pct=Math.min(100,Math.round(Number(h.value||0)/max*100));
    const markerPct=h.refMin!=null?Math.min(100,Math.round(Number(h.refMin)/max*100)):null;
    const valueLabel=typeof h.value==="number"?(Number.isInteger(h.value)?h.value:h.value.toFixed(1)):esc(h.value);
    return `<article class="health-card"><div class="health-card-top"><div><span>${esc(h.label)}</span><strong>${esc(h.level)}</strong></div>${labInfo(h.basis)}</div><div class="health-value-row"><b>${valueLabel}</b><small>${esc(h.display||"")}</small></div><div class="health-meter ${key(h.level)}">${markerPct!=null?`<span class="health-meter-marker" style="left:${markerPct}%" title="Piso orientativo"></span>`:""}<i class="${key(h.level)}" style="width:${pct}%"></i></div><div class="health-ref-row">${(h.refs||[]).map((r,ri)=>`<button type="button" data-health-ref="${hi}:${ri}" ${r.cards?.length?"":"disabled"}>${esc(r.label)}${r.cards?.length?" ↗":""}</button>`).join("")}</div></article>`;
  }).join("");
  const gaps=(d.gaps||[]).length?d.gaps.map(g=>`<article class="gap-card${g.severity!=="A considerar"?" critical":""}"><div><b>${esc(g.type)}</b><span>${esc(g.severity)}</span>${labInfo(g.basis)}</div><p>${esc(g.why)}</p></article>`).join(""):'<div class="health-ok">No detecté ausencias estructurales obvias con las reglas actuales.</div>';
  const structuralRules=(d.structuralRules||[]).map((r,ri)=>`<button type="button" data-rule-ref="${ri}" class="structural-rule ${r.triggered?"triggered":"ok"}" ${r.cards?.length?"":"disabled"}><i class="rule-icon">${r.triggered?"⚠":"✓"}</i><span><b>${esc(r.type)}</b><small>${esc(r.summary||"")}</small></span></button>`).join("");
  const rulesOk=(d.structuralRules||[]).filter(r=>!r.triggered).length,rulesTotal=(d.structuralRules||[]).length,rulesTriggered=rulesTotal-rulesOk;
  const rulesRingPct=rulesTotal?Math.round(rulesOk/rulesTotal*360):0;
  const rulesRingGradient=`conic-gradient(#55f0a5 0deg ${rulesRingPct}deg,#ffb020 ${rulesRingPct}deg 360deg)`;
  const themes=d.themes.length?d.themes.map((t,ti)=>{
    const sample=(t.cards||[]).slice(0,4);
    const rest=(t.cards||[]).length-sample.length;
    return `<article class="theme-card theme-click" data-theme-ref="${ti}" tabindex="0"><div><b>${esc(t.name)}</b><span class="theme-tier">${esc(t.tier||"Theme")}</span><span>Confianza ${esc(t.confidence)}</span>${labInfo(t.explanation)}</div><div class="theme-card-track"><i style="width:${Math.min(100,Math.max(2,t.density))}%;background:${THEME_BAR_COLORS[ti%THEME_BAR_COLORS.length]}"></i></div><p><strong>${t.cardCount||t.cards?.length||0} cartas detectadas</strong> que apoyan ${esc(t.name)} · ~${t.density}% del deck${t.commanderEvidence?" · Commander compatible":""}</p>${sample.length?`<div class="theme-card-sample">${sample.map(n=>`<span>${esc(n)}</span>`).join("")}${rest>0?`<span class="more">+${rest} más</span>`:""}</div>`:""}</article>`;
  }).join(""):'<p class="lab-muted">No hay evidencia suficiente para inferir un tema dominante. ManaShelf prefiere no inventarlo.</p>';
  // v2.4.10 — valor agregado real en "Identidad del mazo": qué cartas sostienen VARIAS
  // temáticas a la vez (no visible en el gráfico de arriba, que muestra cada tema aislado).
  // Son las cartas que más "atan" la identidad del mazo entre sí.
  const themeCoreCount=new Map();
  for(const t of d.themes)for(const name of (t.cards||[]))themeCoreCount.set(name,(themeCoreCount.get(name)||0)+1);
  const themeCore=[...themeCoreCount.entries()].filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const themeCoreHtml=themeCore.length?`<div class="theme-core"><div><b>Cartas que atan varias temáticas</b><span>Sostienen 2 o más de las temáticas de arriba a la vez — suelen ser el corazón funcional del mazo.</span></div><div class="theme-core-list">${themeCore.map(([name,n])=>{const img=d.cardImages?.[name];return `<span class="${img?.image?"has-preview":""}">${esc(name)} <b>×${n}</b>${img?.image?`<img class="hover-preview" src="${esc(img.imageLarge||img.image)}" loading="lazy">`:""}</span>`}).join("")}</div></div>`:"";
  target.innerHTML=`<div class="lab-result-head"><div><span>SALUD DEL MAZO · EXPERIMENTAL ${labInfo(`Método: cuatro ejes estructurales, clasificación heurística por texto Oracle y CMC medio ${d.context.avgCmc}. No conoce tu metajuego ni intención exacta.`)}</span><h2>${esc(d.deck.name)}</h2><p>${esc(d.deck.commander||"Commander no detectado")} · Size ${d.deck.size}</p></div></div>
  <section class="health-section dashboard-section" data-health-section="summary" data-lab-section="summary"><div class="lab-section-title"><div><span>01</span><h3>Resumen del mazo</h3></div><p>Lectura rápida antes de entrar al diagnóstico.</p></div>
    <div class="deck-dashboard">
      <button class="dashboard-stat" data-dashboard-role="lands"><b>${d.context.lands??"—"}</b><span>Tierras</span></button>
      <button class="dashboard-stat" data-dashboard-role="ramp"><b>${d.context.ramp??"—"}</b><span>Ramp</span></button>
      <button class="dashboard-stat" data-dashboard-role="draw"><b>${d.context.draw??"—"}</b><span>Card Advantage</span></button>
      <button class="dashboard-stat" data-dashboard-role="interaction"><b>${d.context.interaction??"—"}</b><span>Interacción</span></button>
      <button class="dashboard-stat" data-dashboard-role="wipes"><b>${d.context.wipes??"—"}</b><span>Board wipes</span></button>
      <div class="dashboard-stat"><b>${Number(d.context.avgCmc||0).toFixed(1)}</b><span>CMC medio</span></div>
    </div>
    <button type="button" class="dashboard-note" data-rules-all><span class="dashboard-note-ring" style="background:${rulesRingGradient}"><em>${rulesOk}/${rulesTotal}</em></span><span class="dashboard-note-copy"><strong>Fundamentos</strong><span>${rulesOk}/${rulesTotal} sin alertas</span><small>${rulesTotal} criterios evaluados</small></span></button>
    <div class="visual-dashboard">
      <div class="mana-curve compact"><div class="mana-curve-head"><strong>Curva de maná ${labInfo("Cartas no-tierra agrupadas por coste de maná convertido (CMC), coloreadas por tipo primario.")}</strong><small>Cartas según Mana Value (CMC)</small></div><div class="curve-type-legend">${MTG_CURVE_TYPES.map(t=>`<button type="button" data-curve-type-ref="${esc(t)}"><i style="background:${MTG_TYPE_COLORS[t]}"></i>${esc(t)}</button>`).join("")}</div><div class="mana-curve-plot"><div class="curve-axis-labels"><span>Cartas</span><span>CMC</span></div><div class="mana-curve-bars">${(d.context.curve||[]).map((x,ci)=>{const max=Math.max(1,...(d.context.curve||[]).map(y=>y.count)),h=Math.max(7,Math.round(x.count/max*100));return `<div class="curve-col" data-curve-ref="${ci}"><strong>${x.count}</strong><i class="curve-stack" style="height:${h}%">${MTG_CURVE_TYPES.map(t=>{const n=Number(x.types?.[t]||0),pct=x.count?n/x.count*100:0;return n?`<button type="button" class="curve-segment" data-curve-type="${esc(t)}" data-curve-index="${ci}" style="height:${pct}%;background:${MTG_TYPE_COLORS[t]}" title="CMC ${esc(x.cmc)} · ${esc(t)} · ${n}"></button>`:""}).join("")}</i><button type="button" class="curve-all" data-curve-index="${ci}" title="Ver todas las cartas de CMC ${esc(x.cmc)}">${esc(x.cmc)}</button></div>`}).join("")}</div></div></div>
      <div class="theme-chart"><div class="mana-curve-head"><strong>Temáticas ${labInfo("Temas detectados por evidencia EDHREC/Oracle. % = cartas que sostienen ese tema sobre el tamaño total del mazo (Size).")}</strong><small>Temas inferidos</small></div><div class="theme-chart-body">${d.themes.length?d.themes.map((t,ti)=>{
        // v2.4.17 — relleno proporcional real, no "mínimo 1 segmento entero": antes cualquier
        // % (incluso 1%) se veía como 1/10 = 10% relleno, exagerando temáticas chicas.
        // Confirmado por auditoría con la matemática exacta. Ahora el segmento parcial se
        // rellena solo la fracción que corresponde (ej. 15% = 1 segmento entero + 50% del 2°).
        const color=THEME_BAR_COLORS[ti%THEME_BAR_COLORS.length];
        const density=Math.max(0,Math.min(100,Number(String(t.density??0).replace(/%/g,""))||0));
        const segs=segmentedFillHtml(density,color,10);
        return `<button type="button" class="theme-bar-row" data-theme-ref="${ti}"><span class="theme-bar-name">${esc(t.name)}</span><span class="theme-segments">${segs}</span><b class="theme-bar-pct">${Math.round(density)}%</b></button>`;
      }).join(""):'<p class="lab-muted">Sin temáticas con evidencia suficiente.</p>'}</div></div>
      <div class="type-chart"><div class="mana-curve-head"><strong>Tipos de carta ${labInfo("Distribución del mazo por tipo primario de carta (Creature, Instant, etc.), sin contar tierras.")}</strong><small>Tipo primario</small></div><div class="type-chart-body"><button type="button" class="type-donut" data-type-all style="background:${donutGradient(d.context.typeDistribution||[])}"><span>${(d.context.typeDistribution||[]).reduce((n,x)=>n+x.count,0)}</span><small>cartas</small></button><div class="type-legend">${(d.context.typeDistribution||[]).map(x=>`<button data-type-ref="${esc(x.type)}"><i class="type-dot" style="background:${MTG_TYPE_COLORS[x.type]||MTG_TYPE_COLORS.Other}"></i><span>${esc(x.type)}</span><b>${x.count}</b></button>`).join("")}</div></div></div>
    </div>
    ${d.edhrecWarning?`<div class="health-degraded"><strong>Análisis local completo.</strong><span>${esc(d.edhrecWarning)} Themes e inclusiones pueden quedar vacíos hasta que EDHREC responda.</span></div>`:""}
  </section>
  <section class="health-section structural-health-section" data-health-section="health" data-lab-section="health"><div class="lab-section-title"><div><span>02</span><h3>Salud estructural</h3></div><p>Los valores auditan las cartas detectadas en la lista lateral.</p></div><div class="health-cards">${health}</div></section>
  <section class="health-section rules-section" data-health-section="health" data-lab-section="rules"><div class="lab-section-title"><div><span>03</span><h3>Estructura del mazo</h3></div><p>Se evalúan los criterios estructurales del mazo y se señalan los puntos que merecen atención.</p></div>${gaps.trim()?`<div class="rules-callouts"><h4>A considerar</h4><div class="gap-grid">${gaps}</div></div>`:""}<div class="rules-strip-head"><h4>${(d.structuralRules||[]).length} criterios evaluados</h4><small>Referencia completa, no solo lo que necesita atención</small></div><div class="structural-rule-list">${structuralRules}</div></section>
  <section class="health-section identity-section" data-health-section="health" data-lab-section="identity"><div class="lab-section-title"><div><span>04</span><h3>Identidad del mazo</h3></div><p>Cada resultado muestra cuántas cartas concretas lo sostienen.</p></div><div class="theme-grid-v2">${themes}</div>${themeCoreHtml}</section>
  <section class="health-section cut-section" data-health-section="changes" data-lab-section="changes"><div class="lab-section-title"><div><span>05</span><h3>Cambios sugeridos · IN/OUT</h3></div><p>Compará cada propuesta IN/OUT por función, curva y redundancia antes de aplicarla al mazo.</p></div><div class="swap-grid">${(d.swaps||[]).length?(d.swaps||[]).map((x,si)=>`<article class="swap-pair"><div class="swap-pair-row"><div class="swap-mini in"><div class="swap-img"><span class="swap-badge plus">+</span>${x.include.image?`<img class="swap-mini-image" src="${esc(x.include.image)}" loading="lazy" alt="">${x.include.imageNormal?`<img class="hover-preview" src="${esc(x.include.imageNormal)}" loading="lazy">`:""}`:""}</div><small>IN</small><strong>${esc(x.include.name)}</strong><p>${esc(x.include.reason||x.include.inclusionType||"Recomendación contextual")}</p></div><div class="swap-connector" data-confidence="${key(x.confidence)}"><span class="swap-arrow">→</span><b>${esc(x.confidence)}</b><small>confianza</small></div><div class="swap-mini out"><div class="swap-img"><span class="swap-badge minus">−</span>${x.cut?.image?`<img class="swap-mini-image" src="${esc(x.cut.image)}" loading="lazy" alt="">${x.cut.imageNormal?`<img class="hover-preview" src="${esc(x.cut.imageNormal)}" loading="lazy">`:""}`:""}</div><small>OUT</small>${x.cut?`<strong>${esc(x.cut.name)}</strong><p>${esc((x.cut.reasons||[]).slice(0,2).join(" · "))}</p>`:`<strong>Sin corte claro</strong><p>Prefiero no proponer un cambio sin evidencia suficiente.</p>`}</div></div><footer><span>${esc((x.pairReasons||[]).join(" · ")||"Mejor combinación contextual disponible.")}</span>${x.impact?`<div class="swap-impact"><span>CMC ${x.impact.avgCmcDelta>0?"+":""}${x.impact.avgCmcDelta}</span><span>Roles críticos protegidos ✓</span></div>`:""}</footer></article>`).join(""):`<div class="empty-cut"><strong>No encuentro un corte claro.</strong><span>No hay suficiente evidencia para recomendar una salida sin arriesgar la estructura del mazo.</span></div>`}</div><p class="lab-confidence">Revisá cada cambio según tu plan de juego, presupuesto y metajuego antes de aplicarlo.</p></section>${inspectorMode==="lab"?renderDeckMetricsLab(d.deckMetrics):""}`;
  const audit=(names,label)=>detail&&renderDeckInspector(inspectorMode,detail,[...new Set((names||[]).filter(Boolean))],label);
  makeTablesSortable(target);
  target.querySelectorAll("[data-metric-filter]").forEach(el=>{const run=()=>{const names=metricFilterCards(d.deckMetrics,el.dataset.metricFilter);audit(names,el.querySelector("h4")?.childNodes?.[0]?.textContent?.trim()||"Deck metric")};el.onclick=e=>{if(e.target.closest(".info-dot"))return;run()};el.onkeydown=e=>{if((e.key==="Enter"||e.key===" ")&&!e.target.closest(".info-dot")){e.preventDefault();run()}}});
  target.querySelectorAll("[data-coverage-filter]").forEach(el=>el.onclick=()=>audit(coverageFilterCards(d.deckMetrics,el.dataset.coverageFilter),`Interaction · ${el.querySelector("span")?.textContent||"coverage"}`));
  target.querySelectorAll("[data-fragile-cards]").forEach(el=>el.onclick=()=>{let names=[];try{names=JSON.parse(decodeURIComponent(el.dataset.fragileCards||"%5B%5D"))}catch{}audit(names,`Rol frágil · ${el.querySelector("strong")?.textContent||""}`)});
  target.querySelectorAll("[data-metric-card]").forEach(b=>b.onclick=()=>{const c=d.deckMetrics?.classifications?.[Number(b.dataset.metricCard)];if(c&&detail)renderDeckInspector(inspectorMode,detail,[c.name],`Métrica · ${c.name}`)});
  target.querySelectorAll("[data-dashboard-role]").forEach(b=>b.onclick=()=>{
    const role=b.dataset.dashboardRole;
    const map={lands:d.health?.[0]?.refs?.[0]?.cards||[],ramp:d.health?.[0]?.refs?.[1]?.cards||[],draw:d.health?.[1]?.refs?.[0]?.cards||[],interaction:(d.health?.[2]?.refs||[]).flatMap(r=>r.cards||[]),wipes:d.health?.[2]?.refs?.[2]?.cards||[]};
    audit(map[role]||[],b.querySelector("span")?.textContent||role);
  });
  target.querySelectorAll(".curve-all").forEach(b=>b.onclick=()=>{const x=d.context.curve?.[Number(b.dataset.curveIndex)];audit(x?.cards||[],`CMC ${x?.cmc||""}`)});
  target.querySelectorAll(".curve-segment").forEach(b=>b.onclick=e=>{e.stopPropagation();const x=d.context.curve?.[Number(b.dataset.curveIndex)],type=b.dataset.curveType;audit(x?.cardsByType?.[type]||[],`CMC ${x?.cmc||""} · ${type}`)});
  target.querySelectorAll("[data-curve-type-ref]").forEach(b=>b.onclick=()=>{
    const type=b.dataset.curveTypeRef;
    const cards=(d.context.curve||[]).flatMap(x=>x.cardsByType?.[type]||[]);
    audit(cards,`Curva · ${type}`);
  });
  target.querySelector("[data-type-all]")?.addEventListener("click",()=>renderDeckInspector(inspectorMode,detail,null,""));
  target.querySelectorAll("[data-rule-ref]").forEach(b=>b.onclick=()=>{const r=d.structuralRules?.[Number(b.dataset.ruleRef)];audit(r?.cards||[],`Criterio · ${r?.type||""}`)});
  target.querySelector("[data-rules-all]")?.addEventListener("click",()=>audit((d.structuralRules||[]).flatMap(r=>r.cards||[]),"Criterios evaluados"));
  target.querySelectorAll("[data-health-ref]").forEach(b=>b.onclick=()=>{const [hi,ri]=b.dataset.healthRef.split(":").map(Number),r=d.health[hi]?.refs?.[ri];if(r&&detail)renderDeckInspector(inspectorMode,detail,r.cards,`${d.health[hi].label} · ${r.label}`)});
  target.querySelectorAll("[data-type-ref]").forEach(b=>b.onclick=()=>{
    if(!detail)return;
    const wanted=b.dataset.typeRef;
    const cards=(detail.mainboard||[]).filter(c=>{const t=String(c.typeLine||c.meta?.typeLine||"").split("—")[0].toLowerCase();return wanted==="Land"?t.includes("land"):wanted==="Creature"?t.includes("creature"):wanted==="Instant"?t.includes("instant"):wanted==="Sorcery"?t.includes("sorcery"):wanted==="Artifact"?t.includes("artifact"):wanted==="Enchantment"?t.includes("enchantment"):wanted==="Planeswalker"?t.includes("planeswalker"):wanted==="Battle"?t.includes("battle"):true}).map(c=>c.name);
    renderDeckInspector(inspectorMode,detail,cards,`Tipo · ${wanted}`);
  });
  target.querySelectorAll("[data-theme-ref]").forEach(b=>{const run=()=>{const t=d.themes[Number(b.dataset.themeRef)];if(t&&detail)renderDeckInspector(inspectorMode,detail,t.cards||[],`${t.name} · ${t.cardCount||t.cards?.length||0} cartas detectadas`)};b.onclick=run;b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();run()}}});  terminalUpdateContext(true);
}


let labAnalysisReady=false;
function syncLabRibbon(){
  if(!E.labTabs)return;
  E.labTabs.classList.toggle("hidden",!(mode==="lab"&&labAnalysisReady));
  E.labTabs.classList.toggle("floating",mode==="lab"&&labAnalysisReady);
  syncFloatingNavGeometry();
}
function setLabSection(section){
  if(!labAnalysisReady||!E.labResults)return;
  E.labTabs?.querySelectorAll("[data-lab-tab]").forEach(b=>b.classList.toggle("active",b.dataset.labTab===section));
  const target=E.labResults.querySelector(`[data-lab-section="${section}"]`);
  target?.scrollIntoView({behavior:"smooth",block:"start"});
  setTimeout(()=>terminalUpdateContext(true),0);
}
E.labTabs?.querySelectorAll("[data-lab-tab]").forEach(b=>b.onclick=()=>setLabSection(b.dataset.labTab));
function renderLabDeckPicker(force=false){
  const q=key(E.labDeckSearch.value);
  if(!force&&q.length<1){E.labDeckPicker.classList.add("hidden");return}
  const list=sortByRecent(decks.filter(d=>!q||key(d.name).includes(q)||key(d.commander).includes(q)));
  E.labDeckPicker.innerHTML=list.map(d=>`<button class="deck-option" data-id="${d.id}">${d.commanderImage?`<img src="${esc(d.commanderImage)}" loading="eager" fetchpriority="high" decoding="async" alt="${esc(d.commander||"Commander")}">`:'<div class="deck-thumb"></div>'}<span><strong>${esc(d.name)}</strong><small>${esc(d.commander||"Commander aún no identificado")}</small></span><b class="deck-count">${deckCountLabel(d)}</b></button>`).join("");
  E.labDeckPicker.classList.toggle("hidden",!list.length);
  E.labDeckPicker.querySelectorAll(".deck-option").forEach(b=>{
    const previewDeck=decks.find(d=>d.id===Number(b.dataset.id));
    wireCommanderPreview(b.querySelector("img"),previewDeck?.commander||"",previewDeck?.commanderImage||"");
    b.onclick=async()=>{
      touchRecentDeck(Number(b.dataset.id));
      labDeck=decks.find(d=>d.id===Number(b.dataset.id));labDeckDetail=null;labAnalysisReady=false;syncLabRibbon();
      E.labDeckSearch.value=labDeck.name;E.labDeckPicker.classList.add("hidden");E.labResults.innerHTML="";E.labAnalyze.disabled=true;E.labExportDeckBtn.disabled=true;
      E.labDeckName.textContent=labDeck.name;E.labDeckCommander.textContent=labDeck.commander||"Identificando Commander…";E.labMainCount.textContent=labDeck.exactMainCount??labDeck.size??"…";E.labSizeAudit.textContent="Leyendo detalle exacto del mazo…";
      E.labOpenDeckLink.href=labDeck.url||`https://archidekt.com/decks/${labDeck.id}`;E.labOpenDeckLink.classList.remove("hidden");
      renderCommanderArt(E.labDeckCommanderArt,labDeck.commander||"Commander",labDeck.commander||"",labDeck.commanderImage||"",labDeck.commanderImageLarge||labDeck.commanderImage||"");
      E.labDeckChosen.classList.remove("hidden");
      try{
        labDeckDetail=await req("/api/deck-detail",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:labDeck.id})});
        labDeck.exactMainCount=labDeckDetail.size;labDeck.size=labDeckDetail.size;labDeck.commander=labDeckDetail.commander||labDeck.commander;labDeck.commanderImage=labDeckDetail.commanderImage||labDeck.commanderImage||null;labDeck.commanderImageLarge=labDeckDetail.commanderImageLarge||labDeck.commanderImageLarge||labDeck.commanderImage||null;
        const commanderName=(labDeckDetail.commanders||[labDeckDetail.commander]).filter(Boolean).join(" + ")||"Commander";
        E.labDeckName.textContent=labDeckDetail.name;E.labDeckCommander.textContent=commanderName;E.labMainCount.textContent=labDeckDetail.size;E.labSizeAudit.textContent=`Size real del deck · ${labDeckDetail.excludedCount||0} carta${Number(labDeckDetail.excludedCount||0)===1?"":"s"} de Sideboard/Maybeboard excluida${Number(labDeckDetail.excludedCount||0)===1?"":"s"}`;
        E.labOpenDeckLink.href=labDeckDetail.url||labDeck.url||`https://archidekt.com/decks/${labDeck.id}`;
        renderCommanderArt(E.labDeckCommanderArt,labDeckDetail.commander||labDeck.commander||"Commander",labDeckDetail.commander||labDeck.commander||"",labDeckDetail.commanderImage||labDeck.commanderImage||"",labDeckDetail.commanderImageLarge||labDeck.commanderImageLarge||"");
        E.labAnalyze.disabled=false;E.labExportDeckBtn.disabled=false;renderDeckInspector("lab",labDeckDetail);terminalUpdateContext(true);
      }catch(e){showError(e)}
    };
  });
  hydrateVisibleDeckCounts(list,E.labDeckPicker);
  if(list.some(d=>!d.commander||!d.commanderImage) && (!lastSyncStatus||["done","done_with_errors"].includes(lastSyncStatus.status)))requestDeckCatalogRepair();
}
E.labDeckSearch.oninput=()=>renderLabDeckPicker(true);E.labDeckSearch.onfocus=()=>renderLabDeckPicker(true);E.labDeckSearch.onclick=()=>renderLabDeckPicker(true);
E.labAnalyze.onclick=async()=>{E.labResults.innerHTML="";clearError();
  if(!labDeck)return;
  E.labLoading.classList.remove("hidden");E.labAnalyze.disabled=true;E.labResults.innerHTML="";
  try{if(!labDeckDetail||labDeckDetail.id!==labDeck.id)labDeckDetail=await req("/api/deck-detail",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:labDeck.id})});renderDeckInspector("lab",labDeckDetail);renderLabResult(await req("/api/lab/deck-health",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:labDeck.id,includeMetrics:true})}));labAnalysisReady=true;E.labTabs?.querySelectorAll("[data-lab-tab]").forEach(b=>b.classList.toggle("active",b.dataset.labTab==="summary"));syncLabRibbon()}catch(e){showError(e)}
  finally{E.labLoading.classList.add("hidden");E.labAnalyze.disabled=false}
};


const saved=localStorage.getItem("ms-user");if(saved)E.u.value=saved;saveLists();setAccess("public");
