
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const E={
u:$("#username"),pw:$("#password"),check:$("#checkUser"),status:$("#userStatus"),loginPanel:$("#loginPanel"),
accessPublic:$("#accessPublic"),accessPrivate:$("#accessPrivate"),accessLabel:$("#accessLabel"),passwordRow:$("#passwordRow"),
accountBar:$("#accountBar"),accountName:$("#accountName"),accountStats:$("#accountStats"),accessBadge:$("#accessBadge"),cacheBtn:$("#cacheBtn"),reconnect:$("#reconnect"),logout:$("#logout"),
syncMini:$("#syncMini"),syncMiniTitle:$("#syncMiniTitle"),syncMiniText:$("#syncMiniText"),syncMiniProgress:$("#syncMiniProgress"),syncCount:$("#syncCount"),syncTime:$("#syncTime"),
syncActions:$("#syncActions"),showSyncErrors:$("#showSyncErrors"),retrySync:$("#retrySync"),syncErrorPanel:$("#syncErrorPanel"),syncErrorList:$("#syncErrorList"),closeSyncErrors:$("#closeSyncErrors"),
dashboard:$("#dashboard"),dashText:$("#dashText"),
modeExplore:$("#modeExplore"),modeImprove:$("#modeImprove"),modeRank:$("#modeRank"),modeLab:$("#modeLab"),
exploreFlow:$("#exploreFlow"),improveFlow:$("#improveFlow"),rankFlow:$("#rankFlow"),labFlow:$("#labFlow"),
q:$("#commanderSearch"),dd:$("#dropdown"),chosen:$("#chosen"),chosenCard:$("#chosenCard"),analyzeExplore:$("#analyzeExplore"),
deckSearch:$("#deckSearch"),deckPicker:$("#deckPicker"),deckLoading:$("#deckLoading"),deckSummary:$("#deckSummary"),deckError:$("#deckError"),
deckName:$("#deckName"),deckCommander:$("#deckCommander"),mainCount:$("#mainCount"),sizeAudit:$("#sizeAudit"),deckCommanderArt:$("#deckCommanderArt"),openDeckLink:$("#openDeckLink"),analyzeImprove:$("#analyzeImprove"),improveTabs:$("#improveTabs"),improveHealthLoading:$("#improveHealthLoading"),improveHealthResults:$("#improveHealthResults"),
improveDeckInspector:$("#improveDeckInspector"),improveDeckInspectorTitle:$("#improveDeckInspectorTitle"),improveDeckInspectorCount:$("#improveDeckInspectorCount"),improveDeckSort:$("#improveDeckSort"),improveDeckFilter:$("#improveDeckFilter"),improveDeckList:$("#improveDeckList"),
rankBtn:$("#rankBtn"),rankResults:$("#rankResults"),rankCommanderSearch:$("#rankCommanderSearch"),rankCommanderDropdown:$("#rankCommanderDropdown"),rankCommanderChosen:$("#rankCommanderChosen"),rankCommanderCard:$("#rankCommanderCard"),rankOneBtn:$("#rankOneBtn"),rankOneResult:$("#rankOneResult"),discoverSearch:$("#discoverSearch"),discoverTagSearch:$("#discoverTagSearch"),discoverTagsToggle:$("#discoverTagsToggle"),discoverSelectedTags:$("#discoverSelectedTags"),discoverFilters:$("#discoverFilters"),discoverStatus:$("#discoverStatus"),discoverGalleryCount:$("#discoverGalleryCount"),discoverLoadProgress:$("#discoverLoadProgress"),discoverLoadProgressBar:$("#discoverLoadProgressBar"),discoverGrid:$("#discoverGrid"),discoverCollapse:$("#discoverCollapse"),compareCommanderSearch:$("#compareCommanderSearch"),compareCommanderDropdown:$("#compareCommanderDropdown"),compareChips:$("#compareChips"),compareBtn:$("#compareBtn"),floatingCompareWrap:$("#floatingCompareWrap"),compareProgressCaption:$("#compareProgressCaption"),hideInDeckToggle:$("#hideInDeckToggle"),
labDeckSearch:$("#labDeckSearch"),labDeckPicker:$("#labDeckPicker"),labDeckChosen:$("#labDeckChosen"),labAnalyze:$("#labAnalyze"),labLoading:$("#labLoading"),labResults:$("#labResults"),
labDeckInspector:$("#labDeckInspector"),labDeckInspectorTitle:$("#labDeckInspectorTitle"),labDeckInspectorCount:$("#labDeckInspectorCount"),labDeckSort:$("#labDeckSort"),labDeckFilter:$("#labDeckFilter"),labDeckList:$("#labDeckList"),
loading:$("#loading"),loadingTitle:$("#loadingTitle"),loadingText:$("#loadingText"),loadingElapsed:$("#loadingElapsed"),results:$("#results"),resultModeLabel:$("#resultModeLabel"),title:$("#title"),meta:$("#meta"),
sumTotal:$("#sumTotal"),sumOwned:$("#sumOwned"),sumAvailable:$("#sumAvailable"),sumOccupied:$("#sumOccupied"),sumUsed:$("#sumUsed"),sumMissing:$("#sumMissing"),
filterAll:$("#filterAll"),filterOwned:$("#filterOwned"),filterAvailable:$("#filterAvailable"),
roleFilter:$("#roleFilter"),themeFilter:$("#themeFilter"),themeFilterWrap:$("#themeFilterWrap"),sort:$("#sort"),viewCards:$("#viewCards"),viewList:$("#viewList"),cats:$("#categories"),ct:$("#categoryTitle"),cm:$("#categoryMeta"),grid:$("#grid"),listHeader:$("#listHeader"),empty:$("#empty"),
completeBtn:$("#completeBtn"),exportBtn:$("#exportBtn"),shortlistBtn:$("#shortlistBtn"),shortlistCount:$("#shortlistCount"),historyBtn:$("#historyBtn"),
modal:$("#modal"),modalBody:$("#modalBody"),modalClose:$("#modalClose"),drawer:$("#drawer"),drawerTitle:$("#drawerTitle"),drawerBody:$("#drawerBody"),drawerClose:$("#drawerClose"),error:$("#error")
};
let sessionId=null,accessMode="public",mode="explore",commander=null,deckDetail=null,data=null,active=null,view="cards",timer=null,syncTimer=null,lastSyncStatus=null,decks=[],selectedDeckId=null;
let rankCommander=null,labDeck=null,labDeckDetail=null,collectionFilter="all",labHealth=null,deckInspectorFilter={improve:null,lab:null};
let ownedCommanders=[],allOwnedCommanders=[],compareCommanders=[],discoverTags=[],tagCatalog=[],discoverCollapsed=false,discoverTagsExpanded=false,discoverTagQuery="",hideInDeck=true;
const modeState={
  explore:{data:null,commander:null,activeId:null,filter:"all",role:"",sort:"synergy",view:"cards"},
  improve:{data:null,commander:null,deckDetail:null,selectedDeckId:null,activeId:null,filter:"all",role:"",sort:"synergy",view:"cards"}
};
let shortlist=JSON.parse(localStorage.getItem("ms-shortlist")||"[]"),history=JSON.parse(localStorage.getItem("ms-history")||"[]");
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
  E.status.textContent=priv?"La contraseña solo se usa para obtener la sesión de Archidekt y no se guarda.":"No hace falta iniciar sesión si la colección es pública.";
  E.check.textContent=priv?"Conectar cuenta →":"Abrir colección →";
}
E.accessPublic.onclick=()=>setAccess("public");E.accessPrivate.onclick=()=>setAccess("private");

async function loadDeckCatalog(){
  try{const d=await req("/api/deck-catalog",{headers:{"X-ManaShelf-Session":sessionId}});decks=d.decks||decks;renderDeckPicker()}catch{}
}
async function pollSync(){
  if(!sessionId||accessMode!=="private")return;
  try{
    const s=await req("/api/sync-status",{headers:{"X-ManaShelf-Session":sessionId}});lastSyncStatus=s;
    E.syncMiniProgress.max=Math.max(1,s.totalDecks||1);E.syncMiniProgress.value=Math.min(s.totalDecks||1,s.completedDecks||0);E.syncCount.textContent=`${s.completedDecks||0} / ${s.totalDecks||0}`;E.syncTime.textContent=elapsed(s.startedAt);
    if(s.status==="done"||s.status==="done_with_errors"){
      E.syncMiniTitle.textContent=s.failedDecks?"Sincronización parcial":"Uso en mazos listo";
      E.syncMiniText.textContent=`${s.cachedDecks||0} desde cache · ${s.fetchedDecks||0} actualizados`;
      E.syncActions.classList.toggle("hidden",!s.failedDecks);if(syncTimer){clearInterval(syncTimer);syncTimer=null}
      await loadDeckCatalog();if(data)await runAnalysis(true);
    }else{E.syncMiniTitle.textContent="Sincronizando mazos";E.syncMiniText.textContent=s.currentDeck?`Ahora: ${s.currentDeck}`:"Preparando cache…";E.syncActions.classList.add("hidden")}
  }catch{}
}
E.showSyncErrors.onclick=()=>{const errors=lastSyncStatus?.errors||[];E.syncErrorList.innerHTML=errors.length?errors.map(e=>`<div class="sync-error-row"><strong>${esc(e.deckName)}</strong><span>${esc(e.error)}</span></div>`).join(""):"Sin errores.";E.syncErrorPanel.classList.remove("hidden")};
E.closeSyncErrors.onclick=()=>E.syncErrorPanel.classList.add("hidden");
E.retrySync.onclick=async()=>{try{await req("/api/sync-retry",{method:"POST",headers:authHeaders(),body:"{}"});E.syncActions.classList.add("hidden");await pollSync();syncTimer=setInterval(pollSync,1200)}catch(e){showError(e)}};

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
    E.accountStats.textContent=`Archidekt: ${d.archidektRecords} resultados · ${d.totalDecks} mazos`;
    E.accessBadge.textContent=accessMode==="private"?"PRIVADA / AUTENTICADA":"PÚBLICA";
    E.loginPanel.classList.add("panel-leaving");
    await new Promise(r=>setTimeout(r,180));
    E.loginPanel.classList.add("hidden");E.loginPanel.classList.remove("panel-leaving");
    E.accountBar.classList.remove("hidden");E.dashboard.classList.remove("hidden");
    requestAnimationFrame(()=>{E.accountBar.classList.add("panel-entered");E.dashboard.classList.add("panel-entered")});
    E.dashText.innerHTML=`<span class="collection-truth"><strong>${d.archidektRecords}</strong> resultados informados por Archidekt</span> · ${d.uniqueCards} nombres de carta agrupados · ${d.totalCopies||0} copias · ${d.totalDecks} mazos.`;
    E.syncMini.classList.toggle("hidden",accessMode!=="private");localStorage.setItem("ms-user",username);
    renderDeckPicker();if(accessMode==="private"){await pollSync();syncTimer=setInterval(pollSync,1200)}else await loadDeckCatalog();
    if(deckSizePollTimer)clearInterval(deckSizePollTimer);
    deckSizePollAttempts=0;deckSizePollTimer=setInterval(pollDeckSizes,3000);pollDeckSizes();
  }catch(e){showError(e);E.status.textContent="No pude abrir la colección."}
};
E.reconnect.onclick=()=>location.reload();
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

E.q.oninput=()=>{clearTimeout(timer);commander=null;E.chosen.classList.add("hidden");const q=E.q.value.trim();if(q.length<2){E.dd.classList.add("hidden");return}timer=setTimeout(async()=>{try{const d=await req(`/api/commanders?q=${encodeURIComponent(q)}`);E.dd.innerHTML="";for(const c of d.results||[]){const b=document.createElement("button");b.className="drop";b.innerHTML=`${c.image?`<img src="${esc(c.image)}">`:""}<span><strong>${esc(c.name)}</strong><small>${esc(c.typeLine)}</small></span>`;b.onclick=()=>chooseCommander(c);E.dd.appendChild(b)}E.dd.classList.remove("hidden")}catch(e){showError(e)}},220)};
function commanderModal(c){openModal(`<div class="commander-modal">${c.largeImage||c.image?`<img src="${esc(c.largeImage||c.image)}">`:""}<div><div class="kicker">COMMANDER</div><h2>${esc(c.name)}</h2><p>${esc(c.manaCost||"")} · ${esc(c.typeLine||"")}</p><pre>${esc(c.oracleText||"Sin texto Oracle disponible.")}</pre></div></div>`)}
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
          dropdown.appendChild(b);
        }
        dropdown.classList.toggle("hidden",!(d.results||[]).length);
      }catch(e){showError(e)}
    },220);
  };
}


let deckCountRequests=new Set();
function deckCountLabel(d){return d.exactMainCount!=null?`Size · ${d.exactMainCount}`:"Size · …"}
async function hydrateVisibleDeckCounts(list,container){
  for(const d of list){
    if(d.exactMainCount!=null||deckCountRequests.has(d.id))continue;
    deckCountRequests.add(d.id);
    req("/api/deck-detail",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:d.id})}).then(detail=>{
      d.exactMainCount=detail.mainboardCount;d.mainCount=detail.mainboardCount;d.size=detail.mainboardCount;d.commander=detail.commander||d.commander;
      container.querySelectorAll(`[data-id="${d.id}"] .deck-count`).forEach(x=>x.textContent=`Size · ${detail.mainboardCount}`);
    }).catch(()=>{container.querySelectorAll(`[data-id="${d.id}"] .deck-count`).forEach(x=>x.textContent="conteo no disponible")}).finally(()=>deckCountRequests.delete(d.id));
  }
}
function renderDeckPicker(force=false){
  const q=key(E.deckSearch.value);
  if(!force&&q.length<1){E.deckPicker.innerHTML="";E.deckPicker.classList.add("hidden");return}
  const list=sortByRecent(decks.filter(d=>!q||key(d.name).includes(q)||key(d.commander).includes(q)));
  E.deckPicker.innerHTML=list.map(d=>`<button class="deck-option" data-id="${d.id}">${d.commanderImage?`<img src="${esc(d.commanderImage)}" loading="lazy">`:'<div class="deck-thumb"></div>'}<span><strong>${esc(d.name)}</strong><small>${esc(d.commander||"Commander por identificar")}</small></span><b class="deck-count">${deckCountLabel(d)}</b></button>`).join("");
  E.deckPicker.classList.toggle("hidden",!list.length);
  E.deckPicker.querySelectorAll(".deck-option").forEach(b=>b.onclick=()=>{const d=decks.find(x=>x.id===Number(b.dataset.id));E.deckSearch.value=d?.name||"";E.deckPicker.classList.add("hidden");selectDeck(Number(b.dataset.id))});
  hydrateVisibleDeckCounts(list,E.deckPicker);
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
function renderDeckInspector(kind,detail,filterNames=null,filterLabel=""){
  const prefix=kind==="lab"?"lab":"improve",panel=E[prefix+"DeckInspector"],listEl=E[prefix+"DeckList"],sortEl=E[prefix+"DeckSort"],filterEl=E[prefix+"DeckFilter"];
  if(!detail||!panel){panel?.classList.add("hidden");if(kind==="improve")document.body.classList.remove("improve-with-inspector");return}
  panel.classList.remove("hidden");if(kind==="improve"&&mode==="improve")document.body.classList.add("improve-with-inspector");E[prefix+"DeckInspectorTitle"].textContent=detail.name;E[prefix+"DeckInspectorCount"].textContent=`Size · ${detail.size} cartas`;
  deckInspectorFilter[kind]=filterNames?new Set(filterNames.map(key)):null;
  let cards=[...(detail.mainboard||[])];
  if(deckInspectorFilter[kind])cards=cards.filter(c=>deckInspectorFilter[kind].has(key(c.name)));
  const sort=sortEl?.value||"type";
  cards.sort((a,b)=>sort==="cmc"?(Number(a.cmc||0)-Number(b.cmc||0)||a.name.localeCompare(b.name)):sort==="category"?deckPrimaryCategory(a).localeCompare(deckPrimaryCategory(b))||a.name.localeCompare(b.name):sort==="name"?a.name.localeCompare(b.name):typeBucket(a).localeCompare(typeBucket(b))||a.name.localeCompare(b.name));
  filterEl.classList.toggle("hidden",!filterNames);
  filterEl.innerHTML=filterNames?`<span>Filtro: ${esc(filterLabel)} · ${cards.reduce((n,c)=>n+Number(c.quantity||1),0)} cartas</span><button type="button">Mostrar todo</button>`:"";
  if(filterNames)filterEl.querySelector("button").onclick=()=>renderDeckInspector(kind,detail,null,"");
  listEl.innerHTML=cards.map(c=>`<div class="deck-list-row"><span class="deck-qty">${c.quantity>1?`${c.quantity}×`:""}</span><span class="deck-list-name">${esc(c.name)}${c.imageNormal?`<img class="hover-preview" src="${esc(c.imageNormal)}" loading="lazy">`:""}</span><span class="deck-list-type">${esc(typeBucket(c))}</span><span class="deck-list-meta">CMC ${Number(c.cmc||0)}</span></div>`).join("")||'<p class="lab-muted">No hay cartas para este filtro.</p>';
}
if(E.improveDeckSort)E.improveDeckSort.onchange=()=>deckDetail&&renderDeckInspector("improve",deckDetail,deckInspectorFilter.improve?[...deckInspectorFilter.improve] : null,E.improveDeckFilter?.querySelector("span")?.textContent?.replace(/^Filtro: | · \d+$/g,"")||"");
if(E.labDeckSort)E.labDeckSort.onchange=()=>labDeckDetail&&renderDeckInspector("lab",labDeckDetail,deckInspectorFilter.lab?[...deckInspectorFilter.lab] : null,E.labDeckFilter?.querySelector("span")?.textContent?.replace(/^Filtro: | · \d+$/g,"")||"");

async function selectDeck(id){
  touchRecentDeck(id);
  improveAnalysisReady=false;E.improveTabs?.classList.add("hidden");E.improveHealthResults.innerHTML="";E.results.classList.add("hidden");
  data=null;active=null;E.results.classList.add("hidden");modeState.improve.data=null;selectedDeckId=id;collectionFilter="all";E.roleFilter.value="";if(E.themeFilter)E.themeFilter.value="";setCollectionFilter("all",false);E.deckPicker.classList.add("hidden");deckDetail=null;commander=null;E.deckSummary.classList.add("hidden");E.deckError.classList.add("hidden");E.deckLoading.classList.remove("hidden");
  try{
    deckDetail=await req("/api/deck-detail",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:id})});
    if(!deckDetail.commander)throw new Error("No pude identificar el Commander del mazo.");
    const s=await req(`/api/commanders?q=${encodeURIComponent(deckDetail.commander)}`).catch(()=>({results:[]}));
    const exact=(s.results||[]).find(x=>key(x.name)===key(deckDetail.commander))||s.results?.[0]||{name:deckDetail.commander};
    commander=exact;E.deckName.textContent=deckDetail.name;E.deckCommander.textContent=(deckDetail.commanders||[deckDetail.commander]).filter(Boolean).join(" + ");E.mainCount.textContent=deckDetail.size;E.sizeAudit.textContent=`Size real del deck · ${deckDetail.excludedCount||0} carta${Number(deckDetail.excludedCount||0)===1?"":"s"} de Sideboard/Maybeboard excluida${Number(deckDetail.excludedCount||0)===1?"":"s"}`;E.openDeckLink.href=deckDetail.url;E.openDeckLink.classList.remove("hidden");renderDeckInspector("improve",deckDetail);
    if(exact.image){E.deckCommanderArt.style.backgroundImage=`url("${exact.image}")`;E.deckCommanderArt.onclick=()=>commanderModal(exact)}
    E.deckSummary.classList.remove("hidden");
  }catch(e){E.deckError.textContent=e.message;E.deckError.classList.remove("hidden")}finally{E.deckLoading.classList.add("hidden")}
}
E.analyzeExplore.onclick=()=>runAnalysis(false);
let improveAnalysisReady=false;
function setImproveTab(tab){
  if(!improveAnalysisReady)return;
  E.improveTabs.querySelectorAll("[data-improve-tab]").forEach(b=>b.classList.toggle("active",b.dataset.improveTab===tab));
  E.improveHealthResults.dataset.view=tab;
  E.improveHealthResults.classList.toggle("hidden",tab==="recommendations");
  E.results.classList.toggle("hidden",tab!=="recommendations");
  if(tab==="recommendations")E.results.scrollIntoView({behavior:"smooth",block:"start"});
  else E.improveTabs.scrollIntoView({behavior:"smooth",block:"start"});
}
E.improveTabs?.querySelectorAll("[data-improve-tab]").forEach(b=>b.onclick=()=>setImproveTab(b.dataset.improveTab));
E.analyzeImprove.onclick=async()=>{
  if(!deckDetail||!selectedDeckId)return showError(new Error("Seleccioná un mazo primero."));
  clearError();improveAnalysisReady=false;E.improveTabs.classList.add("hidden");E.results.classList.add("hidden");E.improveHealthResults.innerHTML="";
  E.improveHealthLoading.classList.remove("hidden");E.analyzeImprove.disabled=true;E.analyzeImprove.textContent="Analizando…";
  try{
    await runAnalysis(true);
    const d=await req("/api/lab/deck-health",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:selectedDeckId})});
    renderLabResult(d,E.improveHealthResults,"improve",deckDetail);
    improveAnalysisReady=true;E.improveTabs.classList.remove("hidden");setImproveTab("deckcheck");
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
    const art=document.createElement("article");art.className=`card${missing?" not-owned":""}`;
    const availableQty=Math.max(0,Number(c.ownedQuantity||0)-usedOutsideCurrentDeck(c));
    const stockBadge=missing?'<span class="stock-badge missing-stock">NO ESTÁ EN TU COLECCIÓN</span>':inDeck?`<span class="stock-badge in-deck-stock"><b>Tenés ${c.ownedQuantity}</b><small>${availableQty>0?`+${availableQty} sin usar`:"Todas usadas en este mazo"}</small></span>`:`<span class="stock-badge"><b>Disponible ${availableQty}/${c.ownedQuantity}</b><small>Tenés ${c.ownedQuantity} · ${availableQty} sin usar</small></span>`;
    const usageLinks=outside.length?outside.map(d=>`<a href="https://archidekt.com/decks/${Number(d.deckId)}" target="_blank" rel="noreferrer">${esc(d.deckName)} ×${Number(d.quantity||0)}</a>`).join(""):"<span>No está usada en otro mazo</span>";
    const usageBadge=!missing?`<span class="usage-overlay" tabindex="0">${outside.length?`EN ${outside.length} MAZO${outside.length===1?"":"S"}`:"NO USADA FUERA"}<em>${usageLinks}</em></span>`:"";
    const listStock=missing?"No está en tu colección":`Disponible ${availableQty}/${c.ownedQuantity}${inDeck?" · ya en este mazo":""}`;
    art.innerHTML=`<div class="pic">${c.image?`<img src="${esc(c.image)}" loading="lazy" decoding="async">`:""}${view==="cards"?stockBadge+usageBadge:""}${inDeck?'<span class="in-deck-badge">YA EN EL MAZO</span>':""}</div>
    <div class="card-body"><h4>${esc(c.name)}${view==="list"&&inDeck?'<span class="in-deck-badge in-deck-inline">YA EN EL MAZO</span>':""}</h4><div class="metrics"><span class="syn">${c.synergy>=0?"+":""}${Math.round(c.synergy*100)}% sinergia</span><span>${c.inclusionPct}% inclusión</span></div><div class="role-line">${(c.roles||[]).map(r=>`<span class="role">${esc(r)}</span>`).join("")}</div>${view==="list"?`<div class="collection-line">${esc(listStock)}</div>`:""}
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
  openModal(`<div class="kicker">ADMINISTRAR CACHÉ · PROVISORIO</div><h2>Caché local</h2><p>Usá <strong>Actualizar</strong> para refrescar datos conservando el caché válido anterior, o <strong>Borrar</strong> para eliminar una sección. Podés copiar <code>.manashelf-cache</code> desde la versión anterior. ManaShelf reutiliza lo compatible y nunca borra un caché válido si una actualización falla.</p><div id="cacheRows" class="cache-rows"><p class="status">Leyendo estado…</p></div><div id="cacheProgress" class="cache-progress hidden"></div>`);
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

function labInfo(text){return `<span class="info-dot" tabindex="0" aria-label="Información"><span>i</span><em>${esc(text)}</em></span>`}
const MTG_TYPE_COLORS={Creature:"#ff3ed1",Instant:"#34e7ff",Sorcery:"#ffb020",Artifact:"#8f70ff",Enchantment:"#55f0a5",Planeswalker:"#ff668f",Battle:"#b7a4d6",Other:"#f3efff",Land:"#6f7b8a"};
const THEME_BAR_COLORS=["#ff3ed1","#34e7ff","#8f70ff","#ffb020","#55f0a5"];
const MTG_CURVE_TYPES=["Creature","Instant","Sorcery","Artifact","Enchantment","Planeswalker","Battle","Other"];
function donutGradient(dist){
  const colors=(dist||[]).map(x=>MTG_TYPE_COLORS[x.type]||MTG_TYPE_COLORS.Other);
  const total=Math.max(1,(dist||[]).reduce((n,x)=>n+Number(x.count||0),0));let at=0,parts=[];
  (dist||[]).forEach((x,i)=>{const from=at/total*360;at+=Number(x.count||0);const to=at/total*360;parts.push(`${colors[i]||MTG_TYPE_COLORS.Other} ${from}deg ${to}deg`)});
  return `conic-gradient(${parts.join(",")||"#332744 0deg 360deg"})`;
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
  const gaps=(d.gaps||[]).length?d.gaps.map(g=>`<article class="gap-card"><div><b>${esc(g.type)}</b><span>${esc(g.severity)}</span>${labInfo(g.basis)}</div><p>${esc(g.why)}</p></article>`).join(""):'<div class="health-ok">No detecté ausencias estructurales obvias con las reglas actuales.</div>';
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
  const suggestions=d.suggestions.length?d.suggestions.map(s=>`<article class="suggest-card">${s.image?`<div class="suggest-img"><img src="${esc(s.image)}" loading="lazy">${s.imageNormal?`<img class="hover-preview" src="${esc(s.imageNormal)}" loading="lazy">`:""}</div>`:""}<div class="suggest-main"><div class="suggest-title"><b>${esc(s.name)}</b>${labInfo(`Por qué aparece: ${s.reason} Rol ManaShelf detectado: ${(s.roles||[]).join(", ")||"sin clasificar"}.`)}</div><span class="include-type">${esc(s.inclusionType)}</span><p>${esc(s.typeLine||"")}</p><small>${esc(s.reason)}</small></div><div class="suggest-stats"><b>${Math.round(Number(s.synergy||0)*100)}%</b><span>sinergia</span><small>${esc(s.category||"EDHREC")}</small></div></article>`).join(""):'<p class="lab-muted">No encontré recomendaciones EDHREC con copia disponible fuera del mazo.</p>';
  target.innerHTML=`<div class="lab-result-head"><div><span>DECK HEALTH · EXPERIMENTAL ${labInfo(`Método: cuatro ejes estructurales, clasificación heurística por texto Oracle y CMC medio ${d.context.avgCmc}. No conoce tu metajuego ni intención exacta.`)}</span><h2>${esc(d.deck.name)}</h2><p>${esc(d.deck.commander||"Commander no detectado")} · Size ${d.deck.size}</p></div></div>
  <section class="health-section dashboard-section" data-health-section="summary"><div class="lab-section-title"><div><span>01</span><h3>Resumen del mazo</h3></div><p>Lectura rápida antes de entrar al diagnóstico.</p></div>
    <div class="deck-dashboard">
      <button class="dashboard-stat" data-dashboard-role="lands"><b>${d.context.lands??"—"}</b><span>Tierras</span></button>
      <button class="dashboard-stat" data-dashboard-role="ramp"><b>${d.context.ramp??"—"}</b><span>Ramp</span></button>
      <button class="dashboard-stat" data-dashboard-role="draw"><b>${d.context.draw??"—"}</b><span>Card Advantage</span></button>
      <button class="dashboard-stat" data-dashboard-role="interaction"><b>${d.context.interaction??"—"}</b><span>Interacción</span></button>
      <button class="dashboard-stat" data-dashboard-role="wipes"><b>${d.context.wipes??"—"}</b><span>Board wipes</span></button>
      <div class="dashboard-stat"><b>${Number(d.context.avgCmc||0).toFixed(1)}</b><span>CMC medio</span></div>
    </div>
    <button type="button" class="dashboard-note" data-rules-all><span class="dashboard-note-ring" style="background:${rulesRingGradient}"><em>${rulesOk}/${rulesTotal}</em></span><span class="dashboard-note-copy"><strong>Fundamentos</strong><span>${rulesOk}/${rulesTotal} sin alertas</span><small>${rulesTotal} reglas evaluadas · click para auditar cartas detectadas</small></span></button>
    <div class="visual-dashboard">
      <div class="mana-curve compact"><div class="mana-curve-head"><strong>Curva de maná ${labInfo("Cartas no-tierra agrupadas por coste de maná convertido (CMC), coloreadas por tipo primario.")}</strong><small>Cartas según Mana Value (CMC) · click para auditar</small></div><div class="curve-type-legend">${MTG_CURVE_TYPES.map(t=>`<button type="button" data-curve-type-ref="${esc(t)}"><i style="background:${MTG_TYPE_COLORS[t]}"></i>${esc(t)}</button>`).join("")}</div><div class="mana-curve-plot"><div class="curve-axis-labels"><span>Cartas</span><span>CMC</span></div><div class="mana-curve-bars">${(d.context.curve||[]).map((x,ci)=>{const max=Math.max(1,...(d.context.curve||[]).map(y=>y.count)),h=Math.max(7,Math.round(x.count/max*100));return `<div class="curve-col" data-curve-ref="${ci}"><strong>${x.count}</strong><i class="curve-stack" style="height:${h}%">${MTG_CURVE_TYPES.map(t=>{const n=Number(x.types?.[t]||0),pct=x.count?n/x.count*100:0;return n?`<button type="button" class="curve-segment" data-curve-type="${esc(t)}" data-curve-index="${ci}" style="height:${pct}%;background:${MTG_TYPE_COLORS[t]}" title="CMC ${esc(x.cmc)} · ${esc(t)} · ${n}"></button>`:""}).join("")}</i><button type="button" class="curve-all" data-curve-index="${ci}" title="Ver todas las cartas de CMC ${esc(x.cmc)}">${esc(x.cmc)}</button></div>`}).join("")}</div></div></div>
      <div class="theme-chart"><div class="mana-curve-head"><strong>Temáticas ${labInfo("Temas detectados por evidencia EDHREC/Oracle. % = cartas que sostienen ese tema sobre el tamaño total del mazo (Size).")}</strong><small>Temas inferidos · click para auditar</small></div><div class="theme-chart-body">${d.themes.length?d.themes.map((t,ti)=>`<button type="button" class="theme-bar-row" data-theme-ref="${ti}"><div class="theme-bar-label"><span>${esc(t.name)}</span><b>${t.density}%</b></div><div class="theme-bar-track"><i style="width:${Math.min(100,Math.max(2,t.density))}%;background:${THEME_BAR_COLORS[ti%THEME_BAR_COLORS.length]}"></i></div></button>`).join(""):'<p class="lab-muted">Sin temáticas con evidencia suficiente.</p>'}</div></div>
      <div class="type-chart"><div class="mana-curve-head"><strong>Tipos de carta ${labInfo("Distribución del mazo por tipo primario de carta (Creature, Instant, etc.), sin contar tierras.")}</strong><small>Tipo primario</small></div><div class="type-chart-body"><button type="button" class="type-donut" data-type-all style="background:${donutGradient(d.context.typeDistribution||[])}"><span>${(d.context.typeDistribution||[]).reduce((n,x)=>n+x.count,0)}</span><small>cartas</small></button><div class="type-legend">${(d.context.typeDistribution||[]).map(x=>`<button data-type-ref="${esc(x.type)}"><i class="type-dot" style="background:${MTG_TYPE_COLORS[x.type]||MTG_TYPE_COLORS.Other}"></i><span>${esc(x.type)}</span><b>${x.count}</b></button>`).join("")}</div></div></div>
    </div>
    ${d.edhrecWarning?`<div class="health-degraded"><strong>Análisis local completo.</strong><span>${esc(d.edhrecWarning)} Themes e inclusiones pueden quedar vacíos hasta que EDHREC responda.</span></div>`:""}
  </section>
  <section class="health-section structural-health-section" data-health-section="health"><div class="lab-section-title"><div><span>02</span><h3>Salud estructural</h3></div><p>Hacé click en un valor para auditar las cartas en la lista lateral.</p></div><div class="health-cards">${health}</div></section>
  <section class="health-section rules-section" data-health-section="health"><div class="lab-section-title"><div><span>03</span><h3>Recomendaciones estructurales</h3></div><p>Se evalúan todas las reglas y, si aplican varias, se muestran todas.</p></div><div class="rules-columns"><div class="rules-col-left"><h4>Recomendaciones</h4><div class="gap-grid">${gaps}</div></div><div class="rules-col-right"><h4>${(d.structuralRules||[]).length} reglas evaluadas</h4><div class="structural-rule-list">${structuralRules}</div></div></div></section>
  <section class="health-section identity-section" data-health-section="health"><div class="lab-section-title"><div><span>04</span><h3>Identidad del mazo</h3></div><p>Cada resultado muestra cuántas cartas concretas lo sostienen; hacé click para auditarlas.</p></div><div class="theme-grid-v2">${themes}</div>${themeCoreHtml}</section>
  <section class="health-section suggestions-section" data-health-section="recommendations"><div class="lab-section-title"><div><span>05</span><h3>Inclusiones sugeridas</h3></div><p>EDHREC + disponibilidad + rol ManaShelf. Hover sobre la imagen para verla grande.</p></div><div class="suggest-list">${suggestions}</div></section>
  <section class="health-section cut-section" data-health-section="changes"><div class="lab-section-title"><div><span>06</span><h3>Cambios sugeridos · IN → OUT</h3></div><p>Cada pareja se calcula contextualizando el Cut Score: evita roles escasos, intenta mejorar curva y no sacrifica el rol que el IN viene a reforzar.</p></div><div class="swap-grid">${(d.swaps||[]).length?(d.swaps||[]).map((x,si)=>`<article class="swap-pair"><div class="swap-pair-row"><div class="swap-mini in"><div class="swap-img"><span class="swap-badge plus">+</span>${x.include.image?`<img class="swap-mini-image" src="${esc(x.include.image)}" loading="lazy" alt="">${x.include.imageNormal?`<img class="hover-preview" src="${esc(x.include.imageNormal)}" loading="lazy">`:""}`:""}</div><small>IN</small><strong>${esc(x.include.name)}</strong><p>${esc(x.include.reason||x.include.inclusionType||"Recomendación contextual")}</p></div><div class="swap-connector" data-confidence="${key(x.confidence)}"><span class="swap-arrow">→</span><b>${esc(x.confidence)}</b><small>confianza</small></div><div class="swap-mini out"><div class="swap-img"><span class="swap-badge minus">−</span>${x.cut?.image?`<img class="swap-mini-image" src="${esc(x.cut.image)}" loading="lazy" alt="">${x.cut.imageNormal?`<img class="hover-preview" src="${esc(x.cut.imageNormal)}" loading="lazy">`:""}`:""}</div><small>OUT</small>${x.cut?`<strong>${esc(x.cut.name)}</strong><p>${esc((x.cut.reasons||[]).slice(0,2).join(" · "))}</p>`:`<strong>Sin corte claro</strong><p>Prefiero no proponer un cambio sin evidencia suficiente.</p>`}</div></div><footer><span>${esc((x.pairReasons||[]).join(" · ")||"Mejor combinación contextual disponible.")}</span>${x.impact?`<div class="swap-impact"><span>CMC ${x.impact.avgCmcDelta>0?"+":""}${x.impact.avgCmcDelta}</span><span>Roles críticos protegidos ✓</span></div>`:""}</footer></article>`).join(""):`<div class="empty-cut"><strong>No encuentro un corte claro.</strong><span>No hay suficiente evidencia para recomendar una salida sin arriesgar la estructura del mazo.</span></div>`}</div><p class="lab-confidence">Diagnóstico experimental · cada corte es una sugerencia auditable, no una orden.</p></section>`;
  const audit=(names,label)=>detail&&renderDeckInspector(inspectorMode,detail,[...new Set((names||[]).filter(Boolean))],label);
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
  target.querySelectorAll("[data-rule-ref]").forEach(b=>b.onclick=()=>{const r=d.structuralRules?.[Number(b.dataset.ruleRef)];audit(r?.cards||[],`Regla · ${r?.type||""}`)});
  target.querySelector("[data-rules-all]")?.addEventListener("click",()=>audit((d.structuralRules||[]).flatMap(r=>r.cards||[]),"Reglas evaluadas"));
  target.querySelectorAll("[data-health-ref]").forEach(b=>b.onclick=()=>{const [hi,ri]=b.dataset.healthRef.split(":").map(Number),r=d.health[hi]?.refs?.[ri];if(r&&detail)renderDeckInspector(inspectorMode,detail,r.cards,`${d.health[hi].label} · ${r.label}`)});
  target.querySelectorAll("[data-type-ref]").forEach(b=>b.onclick=()=>{
    if(!detail)return;
    const wanted=b.dataset.typeRef;
    const cards=(detail.mainboard||[]).filter(c=>{const t=String(c.typeLine||c.meta?.typeLine||"").split("—")[0].toLowerCase();return wanted==="Land"?t.includes("land"):wanted==="Creature"?t.includes("creature"):wanted==="Instant"?t.includes("instant"):wanted==="Sorcery"?t.includes("sorcery"):wanted==="Artifact"?t.includes("artifact"):wanted==="Enchantment"?t.includes("enchantment"):wanted==="Planeswalker"?t.includes("planeswalker"):wanted==="Battle"?t.includes("battle"):true}).map(c=>c.name);
    renderDeckInspector(inspectorMode,detail,cards,`Tipo · ${wanted}`);
  });
  target.querySelectorAll("[data-theme-ref]").forEach(b=>{const run=()=>{const t=d.themes[Number(b.dataset.themeRef)];if(t&&detail)renderDeckInspector(inspectorMode,detail,t.cards||[],`${t.name} · ${t.cardCount||t.cards?.length||0} cartas detectadas`)};b.onclick=run;b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();run()}}});
}
function renderLabDeckPicker(force=false){
  const q=key(E.labDeckSearch.value);
  if(!force&&q.length<1){E.labDeckPicker.classList.add("hidden");return}
  const list=sortByRecent(decks.filter(d=>!q||key(d.name).includes(q)||key(d.commander).includes(q)));
  E.labDeckPicker.innerHTML=list.map(d=>`<button class="deck-option" data-id="${d.id}">${d.commanderImage?`<img src="${esc(d.commanderImage)}" loading="lazy">`:'<div class="deck-thumb"></div>'}<span><strong>${esc(d.name)}</strong><small>${esc(d.commander||"Commander aún no identificado")}</small></span><b class="deck-count">${deckCountLabel(d)}</b></button>`).join("");
  E.labDeckPicker.classList.toggle("hidden",!list.length);
  E.labDeckPicker.querySelectorAll(".deck-option").forEach(b=>b.onclick=async()=>{
    touchRecentDeck(Number(b.dataset.id));
    labDeck=decks.find(d=>d.id===Number(b.dataset.id));E.labDeckSearch.value=labDeck.name;E.labDeckPicker.classList.add("hidden");
    E.labDeckChosen.innerHTML=`<div class="lab-selected-deck"><div class="lab-selected-art">${labDeck.commanderImage?`<img src="${esc(labDeck.commanderImage)}">`:""}</div><div class="lab-selected-info"><small>DECK SELECCIONADO</small><strong>${esc(labDeck.name)}</strong><div class="lab-selected-commander"><span>${esc(labDeck.commander||"Commander se identificará al analizar")}</span><b>SIZE · …</b></div></div></div>`;E.labDeckChosen.classList.remove("hidden");E.labAnalyze.classList.remove("hidden");E.labResults.innerHTML="";
    try{labDeckDetail=await req("/api/deck-detail",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:labDeck.id})});labDeck.exactMainCount=labDeckDetail.size;labDeck.size=labDeckDetail.size;E.labDeckChosen.innerHTML=`<div class="lab-selected-deck"><div class="lab-selected-art">${labDeck.commanderImage?`<img src="${esc(labDeck.commanderImage)}">`:""}</div><div class="lab-selected-info"><small>DECK SELECCIONADO</small><strong>${esc(labDeck.name)}</strong><div class="lab-selected-commander"><span>${esc(labDeckDetail.commander||labDeck.commander||"Commander")}</span><b>SIZE · ${labDeckDetail.size}</b></div></div></div>`;renderDeckInspector("lab",labDeckDetail)}catch(e){showError(e)}
  });
  hydrateVisibleDeckCounts(list,E.labDeckPicker);
}
E.labDeckSearch.oninput=()=>renderLabDeckPicker(true);E.labDeckSearch.onfocus=()=>renderLabDeckPicker(true);E.labDeckSearch.onclick=()=>renderLabDeckPicker(true);
E.labAnalyze.onclick=async()=>{E.labResults.innerHTML="";clearError();
  if(!labDeck)return;
  E.labLoading.classList.remove("hidden");E.labAnalyze.disabled=true;E.labResults.innerHTML="";
  try{if(!labDeckDetail||labDeckDetail.id!==labDeck.id)labDeckDetail=await req("/api/deck-detail",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:labDeck.id})});renderDeckInspector("lab",labDeckDetail);renderLabResult(await req("/api/lab/deck-health",{method:"POST",headers:authHeaders(),body:JSON.stringify({deckId:labDeck.id})}))}catch(e){showError(e)}
  finally{E.labLoading.classList.add("hidden");E.labAnalyze.disabled=false}
};


const saved=localStorage.getItem("ms-user");if(saved)E.u.value=saved;saveLists();setAccess("public");
