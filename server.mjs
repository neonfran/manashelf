
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { partitionArchidektDeck } from "./lib/archidekt-size.mjs";
import { buildDeckMetrics, METRICS_ENGINE_VERSION, CLASSIFICATION_VERSION, SIMULATION_VERSION } from "./lib/deck-metrics.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const APP_VERSION = "2.5.26-beta";
const PUBLIC_DIR = path.join(__dirname, "public");
const ARCHIDEKT_BRIDGE = process.env.ARCHIDEKT_BRIDGE_URL || "https://akmcp.mtgate.cloud";

const send=(res,status,data)=>{res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...SECURITY_HEADERS});res.end(JSON.stringify(data));};
// v2.4.17 — límite de tamaño de body, a partir de la auditoría: sin esto, un cliente podía
// mandar un body enorme y el server lo acumulaba entero en memoria sin cortar. 1 MB alcanza
// de sobra para cualquier request real de la app (nombres de cartas, IDs, etc.).
const MAX_BODY_BYTES=1_000_000;
const body=req=>new Promise((ok,no)=>{
  let s="",bytes=0,tooLarge=false;
  req.on("data",c=>{
    if(tooLarge)return;
    bytes+=c.length;
    if(bytes>MAX_BODY_BYTES){tooLarge=true;no(Object.assign(new Error("El pedido es demasiado grande."),{code:"PAYLOAD_TOO_LARGE"}));return}
    s+=c;
  });
  req.on("end",()=>{if(tooLarge)return;try{ok(s?JSON.parse(s):{})}catch(e){no(Object.assign(new Error("El cuerpo del pedido no es JSON válido."),{code:"BAD_JSON"}))}});
  req.on("error",no);
});

// Diagnostic-only timing helper (v2.4.1 follow-up: measure connect/collection performance
// without asking the user to stopwatch anything by hand). Logs to the server terminal only;
// does not change any response shape or UX behavior.
async function timed(label, fn){
  const t0=Date.now();
  try{
    const result=await fn();
    console.log(`[timing] ${label}: ${Date.now()-t0}ms`);
    return result;
  }catch(e){
    console.log(`[timing] ${label}: FAILED after ${Date.now()-t0}ms (${String(e.message||e)})`);
    throw e;
  }
}
async function get(url,opt={},ms=20000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...opt,signal:c.signal,headers:{"User-Agent":`ManaShelf/${APP_VERSION}`,Accept:"application/json",...(opt.headers||{})}})}finally{clearTimeout(t)}}

// v2.4.11 — pacing global para pedidos directos a archidekt.com. Antes de v2.4.9 estos
// pedidos pasaban por el bridge; al ir directo, 5 pedidos concurrentes le pegan a Archidekt
// sin ningún espaciado, lo que puede disparar su rate-limit (429 con Retry-After de
// decenas de segundos) más fácil que antes. Este espaciado mínimo entre inicios de pedido
// reduce la chance de gatillarlo, sin volver a ser secuencial uno por uno.
// v2.4.17 — cola real en vez del pacing "ingenuo" anterior. Confirmado con la auditoría y
// verificado a mano: el mecanismo viejo leía lastArchidektRequestAt, esperaba, y RECIÉN
// DESPUÉS lo actualizaba — así que 5 workers concurrentes podían leer el mismo timestamp
// viejo antes de que ninguno lo actualizara, calcular la misma espera, y despertarse todos
// juntos (ráfaga, no espaciado real). Esta cola encadena cada pedido al anterior de forma
// síncrona (sin punto de interleaving entre "leer" y "actualizar"), así que si 5 llegan
// juntos, quedan genuinamente uno detrás del otro con el espaciado mínimo entre cada uno.
let archidektQueue=Promise.resolve();
let lastArchidektRequestAt=0;
const ARCHIDEKT_MIN_GAP_MS=850;
function archidektPace(){
  const next=archidektQueue.then(async()=>{
    const wait=Math.max(0,ARCHIDEKT_MIN_GAP_MS-(Date.now()-lastArchidektRequestAt));
    if(wait)await new Promise(r=>setTimeout(r,wait));
    lastArchidektRequestAt=Date.now();
  });
  archidektQueue=next.catch(()=>{}); // la cola sigue viva aunque un paso individual falle
  return next;
}
const slug=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

function firstArray(x){
  if(!x||typeof x!=="object") return [];
  for(const k of ["results","items","cards","records","data"]) if(Array.isArray(x[k])) return x[k];
  for(const v of Object.values(x)) if(Array.isArray(v)&&v.length&&typeof v[0]==="object") return v;
  for(const v of Object.values(x)){const r=firstArray(v);if(r.length)return r}
  return [];
}
function owned(r){
  const c=r.card||r.printing||r.oracle_card||{};
  return {
    name:String(r.name||r.card_name||c.name||c.card_name||c.oracle_name||"").trim(),
    quantity:Number(r.quantity??r.total_quantity??r.owned_quantity??r.count??1),
    image:r.image_uri||r.image||r.image_url||c.image_uri||c.image||c.image_url||null
  };
}

function parseCsv(text){
  const rows=[]; let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch === '"' && text[i+1] === '"'){ field+='"'; i++; }
      else if(ch === '"'){ quoted=false; }
      else field+=ch;
    }else{
      if(ch === '"') quoted=true;
      else if(ch === ','){ row.push(field); field=""; }
      else if(ch === '\n'){
        row.push(field); field="";
        if(row.some(v=>v!=="")) rows.push(row);
        row=[];
      }else if(ch !== '\r') field+=ch;
    }
  }
  if(field!=="" || row.length){ row.push(field); rows.push(row); }
  if(!rows.length) return [];
  const headers=rows[0].map(h=>String(h||"").trim());
  return rows.slice(1).map(cols=>{
    const obj={};
    headers.forEach((h,i)=>obj[h]=cols[i]??"");
    return obj;
  });
}

// v2.4.3 — campos de tipo/color/CMC del export de Archidekt, agregados a los ya validados.
// Nombres de columna confirmados contra una respuesta real de la cuenta del usuario
// (no son los mismos que los "fields" que se piden en el POST; Archidekt los renombra):
// Types, Sub-types, Super-types, Colors, Identities, Mana Value.
// Antes se pedían (público) o ni se pedían (privado) y se descartaban sin usar; ahora se
// usan para pre-filtrar candidatos a Commander localmente, sin pasar por Scryfall.
const TYPE_FIELDS=["card__types","card__subtypes","card__supertypes","card__color","card__colorIdentity","card__cmc"];
function typeLineFromRow(row){
  const types=String(row["Types"]||"").trim();
  const subtypes=String(row["Sub-types"]||"").trim();
  const supertypes=String(row["Super-types"]||"").trim();
  const typeLine=[supertypes,types].filter(Boolean).join(" ").trim()+(subtypes?` — ${subtypes}`:"");
  return {
    typeLine:typeLine||null,
    cmc:Number(row["Mana Value"]||0)||0,
    colorIdentity:String(row["Identities"]||"").split(",").map(s=>s.trim()).filter(Boolean)
  };
}

async function archidektRequest(url, options={}, attempts=4){
  let last=null,lastError=null;
  for(let attempt=0; attempt<attempts; attempt++){
    await archidektPace();
    let r;
    try{
      r=await get(url,options,30000);
      last=r;lastError=null;
    }catch(e){
      lastError=e;
      if(attempt+1>=attempts)throw e;
      const delay=Math.min(12000,900*(2**attempt));
      console.log(`[timing] archidekt:network retry ${attempt+1}/${attempts-1} en ${url.replace(/^https:\/\/archidekt\.com/,"")} · esperando ${delay}ms (${String(e.message||e)})`);
      await new Promise(resolve=>setTimeout(resolve,delay));
      continue;
    }
    if(r.status!==429 && r.status<500) return r;
    if(attempt+1<attempts){
      const retryHeader=Number(r.headers.get("retry-after"));
      const delay=Number.isFinite(retryHeader) && retryHeader>=0 ? Math.min(retryHeader*1000,45000) : (900*(2**attempt));
      if(r.status===429)console.log(`[timing] archidekt:429 en ${url.replace(/^https:\/\/archidekt\.com/,"")} · esperando ${delay}ms (Retry-After crudo: ${Number.isFinite(retryHeader)?retryHeader+"s":"no enviado"})`);
      await new Promise(resolve=>setTimeout(resolve,delay));
    }
  }
  if(last)return last;
  throw lastError||new Error("Archidekt no respondió.");
}

async function collection(collectionId, account){
  if(!account?.token) throw new Error("Falta el token de Archidekt para leer la colección privada.");

  const fields=[
    "quantity",
    "card__oracleCard__name",
    "card__oracle__uid",
    "card__uid",
    "card__edition__editioncode",
    ...TYPE_FIELDS
  ];
  const candidates=[collectionId];
  if(account.user_id && Number(account.user_id)!==Number(collectionId)) candidates.push(Number(account.user_id));

  let selectedId=null, firstPayload=null, firstContent=null, firstResponse=null;

  for(const candidate of candidates){
    const url=`https://archidekt.com/api/collection/export/v2/${candidate}/`;
    const r=await archidektRequest(url,{
      method:"POST",
      headers:{
        "Authorization":`JWT ${account.token}`,
        "Accept":"application/json",
        "Content-Type":"application/json"
      },
      body:JSON.stringify({fields,page:1,game:1,pageSize:2500})
    });
    firstResponse=r;
    const text=await r.text();
    let payload={}; try{payload=text?JSON.parse(text):{}}catch{}
    if(r.ok && typeof payload.content==="string"){
      selectedId=candidate; firstPayload=payload; firstContent=payload.content; break;
    }
    if(r.status!==404){
      const detail=payload.detail||payload.error||text.slice(0,220);
      if(r.status===401||r.status===403) throw new Error("Archidekt rechazó el token. Volvé a conectar la cuenta.");
      throw new Error(`Exportación de Archidekt ${r.status}: ${detail}`);
    }
  }

  if(selectedId===null){
    throw new Error(`Archidekt no encontró la colección privada para los identificadores autenticados (HTTP ${firstResponse?.status||404}).`);
  }

  const merged=new Map();
  const csvParts=[firstContent];
  let fetchedPages=1;
  let totalRows=Number(firstPayload?.totalRows||0);
  let payload=firstPayload;
  let page=1;

  while(Boolean(payload.moreContent)){
    page++;
    if(page>1000) throw new Error("La exportación superó 1000 páginas; se abortó por seguridad.");

    const r=await archidektRequest(`https://archidekt.com/api/collection/export/v2/${selectedId}/`,{
      method:"POST",
      headers:{
        "Authorization":`JWT ${account.token}`,
        "Accept":"application/json",
        "Content-Type":"application/json"
      },
      body:JSON.stringify({fields,page,game:1,pageSize:2500})
    });

    const text=await r.text();
    let next={}; try{next=text?JSON.parse(text):{}}catch{}
    if(!r.ok){
      const detail=next.detail||next.error||text.slice(0,220);
      throw new Error(`Exportación de Archidekt página ${page}: HTTP ${r.status} · ${detail}`);
    }
    if(typeof next.content!=="string"){
      throw new Error(`Archidekt devolvió una página ${page} sin contenido CSV.`);
    }

    csvParts.push(next.content);
    fetchedPages++;
    if(Number(next.totalRows||0)>0) totalRows=Number(next.totalRows);
    payload=next;
  }

  // Archidekt's own integration concatenates export page contents before parsing.
  // Later pages may continue CSV rows without repeating the header.
  const fullCsv=csvParts.join("");
  const rows=parseCsv(fullCsv);
  const observedHeaders=rows.length ? Object.keys(rows[0]) : [];

  const pick=(row, keys)=>{
    for(const key of keys){
      const value=row[key];
      if(value!==undefined && value!==null && String(value).trim()!=="") return value;
    }
    return "";
  };

  let acceptedRows=0;
  for(const row of rows){
    const name=String(pick(row,[
      "Name",
      "name",
      "card__oracleCard__name",
      "card__oracle__name"
    ])).trim();
    if(!name) continue;

    const quantity=Math.max(0,Number.parseInt(String(pick(row,[
      "Quantity",
      "quantity"
    ])||"0"),10)||0);
    if(quantity<=0) continue;

    acceptedRows++;
    const key=name.toLocaleLowerCase("en-US");
    const current=merged.get(key);
    const card={
      name,
      quantity,
      scryfallId:String(pick(row,["Scryfall ID","Scryfall Id","card__uid"])||"").trim()||null,
      oracleId:String(pick(row,["Scryfall Oracle ID","Oracle ID","Oracle Id","card__oracle__uid"])||"").trim()||null,
      set:String(pick(row,["Edition Code","Set Code","card__edition__editioncode"])||"").trim()||null,
      collectorNumber:String(pick(row,["Collector Number","card__collectorNumber"])||"").trim()||null,
      image:null,
      ...typeLineFromRow(row)
    };
    if(current) current.quantity+=quantity;
    else merged.set(key,card);
  }

  const rowDelta = totalRows > 0 ? Math.abs(acceptedRows-totalRows) : 0;
  if(totalRows>0 && rowDelta>1){
    const headers=observedHeaders.length ? observedHeaders.join(", ") : "(sin encabezados)";
    throw new Error(
      `Importación incompleta: Archidekt reportó ${totalRows} registros pero ManaShelf reconoció ${acceptedRows}. ` +
      `Páginas descargadas: ${fetchedPages}. Encabezados: ${headers}`
    );
  }

  const cards=[...merged.values()];
  if(!cards.length){
    const headers=observedHeaders.length ? observedHeaders.join(", ") : "(sin encabezados detectables)";
    if(totalRows>0){
      throw new Error(`Archidekt devolvió ${totalRows} registros, pero ManaShelf no pudo reconocerlos. Encabezados: ${headers}`);
    }
    throw new Error("Archidekt devolvió una exportación vacía para Paper (game=1).");
  }

  return {
    cards,
    totalRows: totalRows || acceptedRows,
    acceptedRows,
    fetchedPages
  };
}


async function publicCollection(username){
  const clean=String(username||"").trim();
  if(!clean)throw new Error("Ingresá un usuario de Archidekt.");

  // v2.4.1 — flujo público validado contra colección real:
  // username -> perfil público -> collection/v2/<id> -> export/v2 CSV completo.
  const profile=await get(`https://archidekt.com/u/${encodeURIComponent(clean)}`,{
    headers:{"Accept":"text/html,*/*","User-Agent":`ManaShelf/${APP_VERSION}`}
  },30000);
  if(!profile.ok)throw new Error(`No pude abrir el perfil público de Archidekt (HTTP ${profile.status}).`);
  const idMatch=(await profile.text()).match(/\/collection\/v2\/(\d+)/);
  if(!idMatch)throw new Error("No encontré una colección pública en ese perfil de Archidekt.");
  const collectionId=Number(idMatch[1]);
  const fields=["quantity","card__oracleCard__name","modifier","condition","createdAt","language","purchasePrice","tags","card__edition__editionname","card__edition__editioncode","card__multiverseid","card__uid","card__oracle__uid","card__mtgoNormalId","card__collectorNumber","card__color","card__colorIdentity","card__manaCost","card__types","card__subtypes","card__supertypes","card__rarity","card__prices__ck","card__prices__tcg","card__prices__scg","card__prices__mtgo","card__prices__cm","card__prices__mp","card__prices__tcg_land","card__cmc"];

  const parseCsv=text=>{
    const rows=[];let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
      if(c==='"'){if(quoted&&n==='"'){field+='"';i++}else quoted=!quoted}
      else if(c===","&&!quoted){row.push(field);field=""}
      else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&n==="\n")i++;row.push(field);field="";if(row.some(v=>v!==""))rows.push(row);row=[]}
      else field+=c;
    }
    if(field||row.length){row.push(field);rows.push(row)}
    if(rows.length<2)return[];
    const headers=rows[0].map(x=>x.trim());
    return rows.slice(1).map(cols=>Object.fromEntries(headers.map((h,k)=>[h,cols[k]??""])));
  };

  const merged=new Map();let page=1,totalRows=0;
  while(page<=1000){
    const endpoint=`https://archidekt.com/api/collection/export/v2/${collectionId}/`;
    const r=await get(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","User-Agent":`ManaShelf/${APP_VERSION}`},body:JSON.stringify({fields,page,game:1,pageSize:2500})},45000);
    const text=await r.text();
    if(!r.ok)throw new Error(`Archidekt export HTTP ${r.status}: ${text.slice(0,240)}`);
    let payload={};try{payload=JSON.parse(text)}catch{throw new Error("Archidekt export devolvió una respuesta inválida.")}
    if(typeof payload.content!=="string")throw new Error("Archidekt export no devolvió contenido CSV.");
    totalRows=Number(payload.totalRows||totalRows||0);
    for(const row of parseCsv(payload.content)){
      const name=String(row["Card Name"]||row["card__oracleCard__name"]||row.Name||"").trim();if(!name)continue;
      const quantity=Math.max(0,Number(row.Quantity||row.quantity||1)||1),key=name.toLocaleLowerCase("en-US"),current=merged.get(key);
      const card={name,quantity,scryfallId:row["Scryfall ID"]||null,oracleId:row["Scryfall Oracle ID"]||row["Oracle UID"]||row["card__oracle__uid"]||null,set:row["Edition Code"]||row["card__edition__editioncode"]||null,collectorNumber:row["Collector Number"]||row["card__collectorNumber"]||null,image:null,oracleText:null,edhrecRank:null,...typeLineFromRow(row)};
      if(current)current.quantity+=quantity;else merged.set(key,card);
    }
    if(payload.moreContent!==true)break;
    page++;
  }
  const cards=[...merged.values()];
  if(!cards.length)throw new Error("La colección pública no devolvió cartas.");
  return {cards,totalRows:totalRows||cards.length,acceptedRows:cards.length,fetchedPages:page,collectionId};
}

async function publicDecks(username){
  const decks=[];
  for(let page=1;page<=10;page++){
    const r=await archidektRequest(`https://archidekt.com/api/decks/v3/?ownerUsername=${encodeURIComponent(username)}&orderBy=-updatedAt&pageSize=100&page=${page}`,{},3);
    if(!r.ok)break;
    const d=await r.json().catch(()=>({}));
    const rows=Array.isArray(d.results)?d.results:[];
    for(const x of rows){
      if(!Number(x?.id)||!x?.name)continue;
      decks.push({
        id:Number(x.id),name:String(x.name),size:Number.isFinite(Number(x.size))?Number(x.size):null,private:false,unlisted:false,
        deckFormat:x.deckFormat??x.deck_format??null,edhBracket:x.edhBracket??x.edh_bracket??null,
        updatedAt:x.updatedAt??x.updated_at??null,url:`https://archidekt.com/decks/${Number(x.id)}`,
        publicDeck:true
      });
    }
    if(!d.next||!rows.length)break;
  }
  return decks;
}

// v2.4.4 — el mismo endpoint que publicDecks() ya usaba para orden confiable por -updatedAt,
// ahora también para cuentas privadas (autenticado con el JWT, para incluir mazos privados
// y unlisted). El login embebía su propio catálogo (personal_decks.decks) pero ese updated_at
// viene vacío para buena parte de las cuentas — este endpoint es la fuente que Archidekt usa
// para ordenar de verdad, y es la que el usuario confirma que antes ordenaba por actualizado.
async function privateDecks(username,token){
  const decks=[];
  for(let page=1;page<=10;page++){
    const r=await archidektRequest(`https://archidekt.com/api/decks/v3/?ownerUsername=${encodeURIComponent(username)}&orderBy=-updatedAt&pageSize=100&page=${page}`,{
      headers:{"Authorization":`JWT ${token}`,"Accept":"application/json"}
    },3);
    if(!r.ok)break;
    const d=await r.json().catch(()=>({}));
    const rows=Array.isArray(d.results)?d.results:[];
    for(const x of rows){
      if(!Number(x?.id)||!x?.name)continue;
      decks.push({
        id:Number(x.id),name:String(x.name),size:Number.isFinite(Number(x.size))?Number(x.size):null,
        private:Boolean(x.private),unlisted:Boolean(x.unlisted),
        deckFormat:x.deckFormat??x.deck_format??null,edhBracket:x.edhBracket??x.edh_bracket??null,
        updatedAt:x.updatedAt??x.updated_at??null,url:`https://archidekt.com/decks/${Number(x.id)}`
      });
    }
    if(!d.next||!rows.length)break;
  }
  return decks;
}

function collectionCacheKeyFor(session){
  return session.collectionCacheKey || (session.collectionId?`collection:${session.collectionId}`:`public:${String(session.username||"").toLowerCase()}`);
}
function collectionLocatorFor(session){
  return session.collectionId?{collection_id:session.collectionId,game:1}:{username:session.username,game:1};
}
function isSideArea(categories){
  const xs=(Array.isArray(categories)?categories:[]).map(x=>String(typeof x==="string"?x:(x?.name||x?.category||"")).toLowerCase());
  return xs.includes("sideboard")||xs.includes("maybeboard");
}
function deckCachedMainCount(cards){
  // Legacy fallback only. UI uses Archidekt's deck.size as the canonical Size.
  return (cards||[]).reduce((n,c)=>n+(isSideArea(c.categories)?0:Math.max(0,Number(c.quantity||0))),0);
}
function deckCachedCommander(cards){
  const c=(cards||[]).find(x=>(x.categories||[]).some(y=>String(y).toLowerCase()==="commander"));
  return c?.name||c?.display_name||null;
}
function classifyRoles(meta){
  const text=String(meta?.oracleText||"").toLowerCase();
  const type=String(meta?.typeLine||"").toLowerCase();
  const roles=[];
  if(/counter target (spell|activated|triggered)/.test(text))roles.push("Counterspells");
  if(/destroy all|exile all|all creatures get -|each creature gets -|damage to each creature/.test(text))roles.push("Board Wipes");
  if(/destroy target|exile target|return target (creature|permanent|nonland)|deals? \d+ damage to target|target creature gets -/.test(text) && !roles.includes("Board Wipes"))roles.push("Removal");
  if(/draw (a|two|three|x|\d+) cards?|draw cards|investigate|impulse draw|you may play .* exile/.test(text))roles.push("Draw");
  if(!type.includes("land") && /add \{|add one mana|treasure token|search your library for (a|up to .*?) (basic )?land|search your library for .* land card/.test(text))roles.push("Ramp");
  if(/hexproof|indestructible|phases? out|protection from|regenerate/.test(text))roles.push("Protection");
  if(/from your graveyard to (your hand|the battlefield)|return target .* from your graveyard|cast .* from your graveyard|reanimate/.test(text))roles.push("Recursion");
  if(/each opponent loses|damage to each opponent|extra combat|double.*power|win the game|loses the game|combat damage.*player/.test(text))roles.push("Finishers");
  if(!roles.length){
    if(type.includes("land"))roles.push("Lands");
    else if(type.includes("creature"))roles.push("Creatures");
    else roles.push("Utility");
  }
  return roles;
}

function image(c){return c?.image_uris?.normal||c?.image_uris?.large||c?.card_faces?.[0]?.image_uris?.normal||null}
async function commanderSearch(q){
  if(q.trim().length<2)return [];
  const query=`t:legendary t:creature legal:commander name:${q.trim()}`;
  const r=await get(`https://api.scryfall.com/cards/search?unique=cards&order=edhrec&q=${encodeURIComponent(query)}`);
  if(r.status===404)return [];
  if(!r.ok)throw new Error(`Scryfall ${r.status}`);
  const d=await r.json();
  return (d.data||[]).slice(0,12).map(c=>({
    id:c.id,name:c.name,image:image(c),
    largeImage:c?.image_uris?.large||c?.image_uris?.normal||c?.card_faces?.[0]?.image_uris?.large||c?.card_faces?.[0]?.image_uris?.normal||image(c),
    manaCost:c.mana_cost||c.card_faces?.[0]?.mana_cost||"",
    typeLine:c.type_line||"",
    oracleText:c.oracle_text||c.card_faces?.map(f=>`${f.name}: ${f.oracle_text||""}`).join("\n\n")||"",
    colorIdentity:c.color_identity||[]
  }));
}
function parseEdhrecTags(p){
  const raw=Array.isArray(p?.panels?.taglinks)?p.panels.taglinks:[];
  return raw.filter(x=>x?.value).map(x=>({name:String(x.value),slug:String(x.slug||""),count:Number(x.count||0)})).sort((a,b)=>b.count-a.count);
}
function parseEdhrec(p){
  const root=p?.container?.json_dict||p?.json_dict||p, lists=root?.cardlists||[];
  return lists.map((l,i)=>({
    id:l.tag||`list-${i}`,
    label:l.header||l.label||String(l.tag||`Lista ${i+1}`).replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase()),
    cards:(l.cardviews||l.cards||[]).filter(c=>c?.name).map(c=>({
      name:c.name,synergy:Number(c.synergy||0),inclusion:Number(c.inclusion||0),
      numDecks:Number(c.num_decks??c.inclusion??0),potentialDecks:Number(c.potential_decks||0),
      image:c.image_uri||c.image||c.image_url||null
    }))
  }));
}
let edhrecDiskCache=null;
async function loadEdhrecDiskCache(){
  if(edhrecDiskCache)return edhrecDiskCache;
  edhrecDiskCache=await readJsonFile(path.join(CACHE_DIR,"edhrec.json"),{version:2,entries:{}});
  if(!edhrecDiskCache.entries)edhrecDiskCache.entries={};
  return edhrecDiskCache;
}
async function saveEdhrecDiskCache(){
  if(edhrecDiskCache)await writeJsonFile(path.join(CACHE_DIR,"edhrec.json"),edhrecDiskCache);
}
async function edhrec(commander,{force=false}={}){
  const name=String(commander||"").trim(),k=name.toLocaleLowerCase("en-US");
  if(!force&&cache.edhrec.has(k))return cache.edhrec.get(k);
  const disk=await loadEdhrecDiskCache(),saved=disk.entries[k];
  if(!force&&saved?.lists){
    cache.edhrec.set(k,saved.lists);
    return saved.lists;
  }
  const r=await get(`https://json.edhrec.com/pages/commanders/${slug(name)}.json`);
  if(!r.ok){
    if(saved?.lists){cache.edhrec.set(k,saved.lists);return saved.lists}
    throw new Error(`EDHREC ${r.status}`);
  }
  const payload=await r.json(),lists=parseEdhrec(payload),tags=parseEdhrecTags(payload);
  cache.edhrec.set(k,lists);
  disk.entries[k]={name,updatedAt:Date.now(),lists,tags};
  await saveEdhrecDiskCache();
  return lists;
}
async function edhrecTags(commander){
  const name=String(commander||"").trim(),k=name.toLocaleLowerCase("en-US"),disk=await loadEdhrecDiskCache();
  if(disk.entries[k]?.tags?.length)return disk.entries[k].tags;
  const r=await get(`https://json.edhrec.com/pages/commanders/${slug(name)}.json`);
  if(!r.ok)return[];
  const payload=await r.json(),tags=parseEdhrecTags(payload),lists=parseEdhrec(payload);
  disk.entries[k]={name,updatedAt:Date.now(),lists,tags};cache.edhrec.set(k,lists);await saveEdhrecDiskCache();return tags;
}
async function scryfallImage(name){
  const r=await get(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
  if(!r.ok)return null; const c=await r.json(); return image(c);
}

async function edhrecSimilar(cardName){
  const name=String(cardName||"").trim();if(!name)return[];
  const r=await get(`https://json.edhrec.com/pages/cards/${slug(name)}.json`);
  if(!r.ok)return[];
  const payload=await r.json(),root=payload?.container?.json_dict||payload?.json_dict||payload;
  const lists=root?.cardlists||[];
  const candidates=[];
  for(const l of lists){
    const label=String(l.header||l.label||l.tag||"").toLowerCase();
    if(!label.includes("similar"))continue;
    for(const c of (l.cardviews||l.cards||[]))if(c?.name&&c.name!==name)candidates.push({name:c.name,similarity:Number(c.synergy||c.inclusion||0)});
  }
  return candidates;
}

const cache={collections:new Map(),edhrec:new Map(),commanderCandidates:null,commanderCandidatesAt:0};
const sessions=new Map();
// v2.4.17 — TTL para sesiones y jobs viejos, a partir de la auditoría: hoy nada se borra
// salvo el logout explícito. En un proceso local esto no importa mucho, pero en un hosting
// compartido/prolongado (Render) es una fuga de memoria lenta. Se marca actividad en cada
// sesión y se limpia periódicamente lo que quedó inactivo.
function registerSession(id,session){session.lastSeen=Date.now();sessions.set(id,session);return session}



function deepFindTokenAccount(x){
  if(!x||typeof x!=="object") return null;
  if(typeof x.token==="string") return x;
  for(const v of Object.values(x)){
    if(v&&typeof v==="object"){
      const a=deepFindTokenAccount(v); if(a) return a;
    }
  }
  return null;
}
function deepFindCollection(x){
  if(!x||typeof x!=="object") return null;
  if(x.collection && typeof x.collection==="object"){
    const c=x.collection;
    if(c.collection_id || c.collectionId) return c;
  }
  if(x.collection_id || x.collectionId){
    return x;
  }
  for(const v of Object.values(x)){
    if(v&&typeof v==="object"){
      const c=deepFindCollection(v); if(c) return c;
    }
  }
  return null;
}
async function loginBridge(username,password){
  const r=await get(`${ARCHIDEKT_BRIDGE}/api/login`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({account:{username,password}})
  },25000);
  const text=await r.text();
  let payload={}; try{payload=text?JSON.parse(text):{}}catch{}
  if(!r.ok) throw new Error(payload.detail||payload.error||`Login Archidekt ${r.status}`);
  const account=deepFindTokenAccount(payload);
  const collection=deepFindCollection(payload);
  if(!account?.token) throw new Error("El login no devolvió un token reutilizable.");
  const collectionId=collection?.collection_id ?? collection?.collectionId ?? null;
  if(!collectionId) throw new Error("El login fue correcto pero no devolvió collection_id para la colección privada.");
  return {account, collectionId, raw: payload};
}

function normalizeDecksFromLogin(payload){
  const source=payload?.personal_decks?.decks;
  if(!Array.isArray(source)) return [];
  return source
    .filter(d=>Number(d?.id)>0 && d?.name)
    .map(d=>({
      id:Number(d.id),
      name:String(d.name),
      size:Number.isFinite(Number(d.size))?Number(d.size):null,
      private:Boolean(d.private),
      unlisted:Boolean(d.unlisted),
      deckFormat:d.deck_format??null,
      edhBracket:d.edh_bracket??null,
      updatedAt:d.updated_at??null,
      url:`https://archidekt.com/decks/${Number(d.id)}`
    }));
}

async function bridgePost(pathname, payload, attempts=5){
  let lastStatus=0, lastDetail="";
  for(let attempt=0; attempt<attempts; attempt++){
    const r=await get(`${ARCHIDEKT_BRIDGE}${pathname}`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    },30000);
    const text=await r.text();
    let data={}; try{data=text?JSON.parse(text):{}}catch{}
    if(r.ok) return data;

    lastStatus=r.status;
    lastDetail=data.detail||data.error||text.slice(0,240);

    if(r.status===401||r.status===403){
      throw new Error("La sesión de Archidekt necesita reconectarse.");
    }
    if(r.status!==429 && r.status<500){
      throw new Error(`Archidekt bridge ${r.status}: ${lastDetail}`);
    }

    if(attempt+1<attempts){
      const retry=Number(r.headers.get("retry-after"));
      const delay=Number.isFinite(retry)&&retry>0 ? retry*1000 : Math.min(12000,1000*(2**attempt));
      await new Promise(resolve=>setTimeout(resolve,delay));
    }
  }
  throw new Error(`No pude sincronizar mazos (HTTP ${lastStatus}): ${lastDetail}`);
}



const CACHE_DIR=path.join(__dirname,".manashelf-cache");
const CACHE_SCHEMA_VERSION=3;
let scryfallDiskCache=null;
let scryfallLastRequestAt=0;
async function scryfallRequest(url,opt={},ms=30000){
  const wait=Math.max(0,180-(Date.now()-scryfallLastRequestAt));
  if(wait)await new Promise(r=>setTimeout(r,wait));
  scryfallLastRequestAt=Date.now();
  let r=await get(url,opt,ms);
  if(r.status===429){
    // v2.4.11 — antes esperaba 60s por defecto (hasta 90s) si Scryfall no mandaba
    // Retry-After. Eso era el trabazo real de 40-50s reportado ("se traba en 574...600").
    // Se acorta el techo: mejor reintentar antes y, si vuelve a fallar, seguir con el
    // resto del lote (los datos ya cacheados no se pierden) que bloquear todo por un minuto.
    const retryHeader=Number(r.headers.get("retry-after"));
    const retry=Number.isFinite(retryHeader)&&retryHeader>0?Math.min(10,retryHeader):5;
    console.log(`[timing] scryfall:429 · esperando ${retry}s (Retry-After crudo: ${Number.isFinite(retryHeader)?retryHeader+"s":"no enviado"})`);
    await new Promise(resolve=>setTimeout(resolve,retry*1000));
    scryfallLastRequestAt=Date.now();
    r=await get(url,opt,ms);
  }
  return r;
}

async function readJsonFile(file,fallback){
  try{return JSON.parse(await fs.readFile(file,"utf-8"))}catch{return fallback}
}
async function writeJsonFile(file,data){
  await fs.mkdir(path.dirname(file),{recursive:true});
  // Unique temp files avoid collisions when sync/catalog/cache writes overlap.
  const tmp=`${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  try{
    await fs.writeFile(tmp,JSON.stringify(data),"utf-8");
    await fs.rename(tmp,file);
  }finally{
    try{await fs.unlink(tmp)}catch{}
  }
}
function userCacheKey(session){
  return String(session.account?.user_id||session.collectionId||session.account?.username||"default").replace(/[^a-zA-Z0-9._-]/g,"_");
}
async function loadDeckDiskCache(session){
  if(session.diskDeckCache)return session.diskDeckCache;
  const file=path.join(CACHE_DIR,`decks-${userCacheKey(session)}.json`);
  session.deckCacheFile=file;
  session.diskDeckCache=await readJsonFile(file,{version:1,decks:{}});
  return session.diskDeckCache;
}
async function saveDeckDiskCache(session){
  if(!session.diskDeckCache)return;
  const run=()=>writeJsonFile(session.deckCacheFile,session.diskDeckCache);
  const pending=(session.deckCacheSavePromise||Promise.resolve()).then(run,run);
  session.deckCacheSavePromise=pending.catch(()=>{});
  await pending;
}
async function loadScryfallDiskCache(){
  if(scryfallDiskCache)return scryfallDiskCache;
  scryfallDiskCache=await readJsonFile(path.join(CACHE_DIR,"scryfall-images.json"),{version:CACHE_SCHEMA_VERSION,cards:{}});
  if(!scryfallDiskCache.cards)scryfallDiskCache.cards={};
  scryfallDiskCache.version=CACHE_SCHEMA_VERSION;
  return scryfallDiskCache;
}
async function saveScryfallDiskCache(){
  if(!scryfallDiskCache)return;
  await writeJsonFile(path.join(CACHE_DIR,"scryfall-images.json"),scryfallDiskCache);
}
function smallImage(card){
  return card?.image_uris?.small||card?.card_faces?.[0]?.image_uris?.small||card?.image_uris?.normal||card?.card_faces?.[0]?.image_uris?.normal||null;
}
function normalImage(card){
  return card?.image_uris?.normal||card?.card_faces?.[0]?.image_uris?.normal||smallImage(card);
}
async function batchScryfallImagesUnlocked(names,{force=false,onProgress=null}={}){
  const disk=await loadScryfallDiskCache();
  const unique=[...new Set(names.map(n=>String(n).trim()).filter(Boolean))];
  const missing=unique.filter(n=>{
    const c=disk.cards[n.toLocaleLowerCase("en-US")];
    if(force || !c || Number(c.metaVersion||0)<3)return true;
    const hasImage=Boolean(c.small||c.normal||c.large);
    if(hasImage)return false;
    // Older builds could permanently cache a null image after a transient miss.
    // Only a confirmed Scryfall not_found result is allowed to stay negative, and
    // even that expires so renamed/fixed records can recover later.
    const negativeFresh=Boolean(c.notFound)&&Date.now()-Number(c.updatedAt||0)<24*60*60*1000;
    return !negativeFresh;
  });
  const total=Math.ceil(missing.length/75);
  for(let i=0,part=0;i<missing.length;i+=75,part++){
    const chunk=missing.slice(i,i+75);
    onProgress?.({current:part,total,message:`Scryfall: ${Math.min(i+75,missing.length)} / ${missing.length} cartas`});
    const r=await scryfallRequest("https://api.scryfall.com/cards/collection",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({identifiers:chunk.map(name=>({name}))})
    },30000);
    if(!r.ok){
      // Keep any older cache. Never destroy valid local metadata because a refresh failed.
      continue;
    }
    const payload=await r.json();
    for(const c of (payload.data||[])){
      const oracleText=c.oracle_text||c.card_faces?.map(f=>f.oracle_text||"").filter(Boolean).join("\n")||"";
      disk.cards[String(c.name).toLocaleLowerCase("en-US")]={
        small:smallImage(c),normal:normalImage(c),large:c?.image_uris?.large||c?.card_faces?.[0]?.image_uris?.large||normalImage(c),
        typeLine:c.type_line||"",oracleText,cmc:Number(c.cmc||0),manaCost:c.mana_cost||c.card_faces?.[0]?.mana_cost||"",producedMana:c.produced_mana||[],colorIdentity:c.color_identity||[],
        keywords:c.keywords||[],edhrecRank:c.edhrec_rank??null,legalities:c.legalities||{},notFound:false,metaVersion:3,updatedAt:Date.now()
      };
    }
    for(const nf of (payload.not_found||[])){
      const n=nf?.name;
      if(n)disk.cards[String(n).toLocaleLowerCase("en-US")]={small:null,normal:null,large:null,typeLine:"",oracleText:"",cmc:0,manaCost:"",producedMana:[],colorIdentity:[],keywords:[],legalities:{},notFound:true,metaVersion:3,updatedAt:Date.now()};
    }
    await saveScryfallDiskCache();
  }
  onProgress?.({current:total,total,message:`Scryfall: ${missing.length?missing.length+" actualizadas":"caché vigente"}`});
  const out=new Map();
  for(const name of unique){
    const c=disk.cards[name.toLocaleLowerCase("en-US")];
    if(c)out.set(name,{
      small:c.small||null,normal:c.normal||null,large:c.large||c.normal||null,
      typeLine:c.typeLine||"",oracleText:c.oracleText||"",cmc:Number(c.cmc||0),manaCost:c.manaCost||"",producedMana:c.producedMana||[],colorIdentity:c.colorIdentity||[],
      keywords:c.keywords||[],edhrecRank:c.edhrecRank??null,legalities:c.legalities||{}
    });
  }
  return out;
}
let scryfallBatchQueue=Promise.resolve();
async function batchScryfallImages(names,options={}){
  const run=()=>batchScryfallImagesUnlocked(names,options);
  const pending=scryfallBatchQueue.then(run,run);
  scryfallBatchQueue=pending.then(()=>undefined,()=>undefined);
  return pending;
}
function freshUsageState(session){
  return {
    decks:session.decks||[],
    usage:new Map(),
    totalDecks:(session.decks||[]).length,
    completedDecks:0,
    cachedDecks:0,
    fetchedDecks:0,
    failedDecks:0,
    currentDeck:null,
    status:"idle",
    phase:"idle",
    retryRound:0,
    maxRetryRounds:3,
    lastProgressAt:null,
    startedAt:null,
    finishedAt:null,
    errors:[]
  };
}
function removeDeckFromUsage(state,deckId){
  for(const [key,entries] of state.usage){
    const filtered=entries.filter(e=>e.deckId!==deckId);
    if(filtered.length)state.usage.set(key,filtered);else state.usage.delete(key);
  }
}
function addDeckCardsToUsage(state,deck,cards){
  removeDeckFromUsage(state,deck.id);
  for(const card of (cards||[])){
    if(isSideArea(card?.categories))continue;
    const name=String(card?.name||card?.display_name||"").trim();
    const quantity=Math.max(0,Number(card?.quantity||0));
    if(!name||quantity<=0)continue;
    const key=name.toLocaleLowerCase("en-US");
    if(!state.usage.has(key))state.usage.set(key,[]);
    state.usage.get(key).push({deckId:deck.id,deckName:deck.name,quantity,url:`https://archidekt.com/decks/${deck.id}`});
  }
}
function sameDeckVersion(cacheEntry,deck){
  if(!cacheEntry||!Array.isArray(cacheEntry.cards))return false;
  // Strongest signal: Archidekt's own updatedAt, when it actually sends one for this deck.
  if(deck.updatedAt&&cacheEntry.updatedAt)return String(deck.updatedAt)===String(cacheEntry.updatedAt);
  // Archidekt's login payload frequently omits updated_at per deck, which previously made
  // this always return false and forced a full re-download of every deck on every connect
  // (measured: ~191s for 55 decks with 0 cache hits). Fall back to comparing Archidekt's
  // reported Size as a second signal: if it hasn't moved, the deck almost certainly hasn't.
  if(Number.isFinite(Number(deck.size))&&Number.isFinite(Number(cacheEntry.size))){
    return Number(deck.size)===Number(cacheEntry.size);
  }
  // No comparable signal at all (older cache entries saved before this field existed):
  // trust the disk cache rather than re-fetching every deck on every connect. The manual
  // recache control in Admin de caché remains the way to force a full refresh.
  return true;
}
function startDeckUsageSync(session,{retryOnly=false}={}){
  if(!session.account){
    if(!session.deckUsage)session.deckUsage=freshUsageState(session);
    session.deckUsage.status="done";session.deckUsage.phase="done";session.deckUsage.completedDecks=0;session.deckUsage.totalDecks=0;
    return;
  }
  if(session.deckSyncPromise)return;
  if(!session.deckUsage)session.deckUsage=freshUsageState(session);

  session.deckSyncPromise=(async()=>{
    const state=session.deckUsage;
    const disk=await loadDeckDiskCache(session);
    const MAX_AUTO_RETRY_ROUNDS=3;
    const RETRY_DELAYS=[4000,8000,15000];

    if(!retryOnly){
      state.usage=new Map();state.completedDecks=0;state.cachedDecks=0;state.fetchedDecks=0;state.failedDecks=0;state.errors=[];
      state.startedAt=Date.now();
    }
    state.totalDecks=state.decks.length;
    state.finishedAt=null;
    state.status="running";
    state.phase=retryOnly?"manual_retry":"loading";
    state.retryRound=0;
    state.maxRetryRounds=MAX_AUTO_RETRY_ROUNDS;
    state.lastProgressAt=Date.now();

    const failedIds=retryOnly?new Set((state.errors||[]).map(e=>Number(e.deckId))) : null;
    if(retryOnly){
      // Preserve successful usage and only retry the decks that actually failed.
      state.completedDecks=Math.max(0,state.totalDecks-failedIds.size);
      state.failedDecks=failedIds.size;
    }

    const setError=(deck,error)=>{
      const msg=String(error?.message||error||"Error desconocido");
      const existing=state.errors.find(x=>Number(x.deckId)===Number(deck.id));
      if(existing)existing.error=msg;else state.errors.push({deckId:deck.id,deckName:deck.name,error:msg});
      state.failedDecks=state.errors.length;
      state.lastProgressAt=Date.now();
    };
    const clearError=(deck)=>{
      state.errors=state.errors.filter(x=>Number(x.deckId)!==Number(deck.id));
      state.failedDecks=state.errors.length;
      state.lastProgressAt=Date.now();
    };
    const saveSuccess=(deck,partition,{countAsFetched=true}={})=>{
      const cards=partition.mainboard;
      addDeckCardsToUsage(state,deck,cards);
      deck.mainCount=partition.size;deck.exactMainCount=partition.size;
      deck.commander=partition.commanders[0]||deckCachedCommander(cards);
      disk.decks[String(deck.id)]={updatedAt:deck.updatedAt||null,size:partition.size,commander:deck.commander||null,cards,savedAt:Date.now()};
      if(countAsFetched)state.fetchedDecks++;
      clearError(deck);
    };
    const fetchOne=async(deck)=>{
      state.currentDeck=deck.name;
      // Preview/Commander correctness requires the FULL endpoint. The previous helper could
      // silently fall back to /small and mark a deck successful even when /small omitted
      // the premier category. That is the root cause of "Commander por identificar".
      const partition=await fetchDeckPartitionFullOnly(session,deck.id);
      if(!partition)throw new Error("Archidekt no devolvió el mazo completo.");
      if(!partition.commanders?.length)throw new Error("El mazo completo no identificó una categoría premier para Commander.");
      saveSuccess(deck,partition);
    };

    const targets=[];
    for(const deck of state.decks){
      if(retryOnly){if(failedIds.has(Number(deck.id)))targets.push(deck);continue}
      const cached=disk.decks[String(deck.id)];
      const cachedCommander=String(cached?.commander||deck.commander||deckCachedCommander(cached?.cards)||"").trim()||null;
      // A legacy cache without Commander metadata is not complete enough for the deck
      // picker. Re-fetch that deck once with the validated full endpoint so Improve and
      // LAB receive the same ready-to-render Commander identity instead of hydrating rows.
      if(sameDeckVersion(cached,deck)&&Array.isArray(cached.cards)&&cachedCommander){
        addDeckCardsToUsage(state,deck,cached.cards);
        deck.mainCount=Number.isFinite(Number(cached.size))?Number(cached.size):deck.size;
        deck.exactMainCount=deck.mainCount;
        deck.commander=cachedCommander;
        cached.commander=cachedCommander;
        state.cachedDecks++;state.completedDecks++;state.lastProgressAt=Date.now();
      }else targets.push(deck);
    }

    // Requests are globally paced at the Archidekt layer. A few workers allow response
    // overlap without creating request bursts.
    const CONCURRENCY=4;
    let cursor=0;
    async function worker(){
      while(cursor<targets.length){
        const deck=targets[cursor++];
        try{
          await fetchOne(deck);
          state.completedDecks=Math.min(state.totalDecks,state.completedDecks+1);
        }catch(e){setError(deck,e)}
      }
    }
    await Promise.all(Array.from({length:Math.min(CONCURRENCY,targets.length)},worker));

    // Automatic recovery is not limited to N-1/N anymore: every failed deck gets up to
    // three additional passes, with a cooldown and lower concurrency. This is intentionally
    // conservative around Archidekt rate limiting.
    for(let round=1;round<=MAX_AUTO_RETRY_ROUNDS && state.errors.length;round++){
      state.retryRound=round;state.phase="auto_retry";
      state.currentDeck=`Esperando reintento automático ${round}/${MAX_AUTO_RETRY_ROUNDS}`;
      await new Promise(r=>setTimeout(r,RETRY_DELAYS[round-1]));
      const retryIds=new Set(state.errors.map(e=>Number(e.deckId)));
      const retryTargets=state.decks.filter(d=>retryIds.has(Number(d.id)));
      let retryCursor=0;
      async function retryWorker(){
        while(retryCursor<retryTargets.length){
          const deck=retryTargets[retryCursor++];
          state.currentDeck=`Reintento ${round}/${MAX_AUTO_RETRY_ROUNDS} · ${deck.name}`;
          try{
            await fetchOne(deck);
            state.completedDecks=Math.min(state.totalDecks,state.completedDecks+1);
          }catch(e){setError(deck,e)}
        }
      }
      await Promise.all(Array.from({length:Math.min(2,retryTargets.length)},retryWorker));
    }

    // Commander thumbnails are intentionally NOT bulk-hydrated here. Full-deck preview
    // requests are expensive and previously delayed/competed with initial deck loading.
    // The search UI now resolves only visible rows on demand with the validated full-deck
    // -> isPremier method, while this sync stays focused on deck usage/cards.
    if(targets.length||retryOnly)await saveDeckDiskCache(session);
    state.failedDecks=state.errors.length;
    state.completedDecks=Math.max(0,state.totalDecks-state.failedDecks);
    state.currentDeck=null;
    state.phase=state.failedDecks?"needs_manual_retry":"done";
    state.status=state.failedDecks?"done_with_errors":"done";
    state.finishedAt=Date.now();state.lastProgressAt=Date.now();
    console.log(`[timing] deck-usage-sync:TOTAL: ${Date.now()-state.startedAt}ms · ${state.completedDecks}/${state.totalDecks} mazos (${state.cachedDecks} caché, ${state.fetchedDecks} bajados, ${state.failedDecks} fallidos)`);
  })().catch(e=>{
    const state=session.deckUsage||freshUsageState(session);
    state.status="done_with_errors";state.phase="needs_manual_retry";state.finishedAt=Date.now();state.lastProgressAt=Date.now();
    if(!state.errors?.length)state.errors=[{deckId:null,deckName:"Sincronización",error:String(e.message||e)}];
    state.failedDecks=Math.max(1,state.errors.length);
    state.completedDecks=Math.max(0,state.totalDecks-state.failedDecks);
    console.error(`[deck-usage-sync] ${String(e.stack||e)}`);
  }).finally(()=>{session.deckSyncPromise=null});
}

async function fetchRawDeckDetail(session, deckId){
  const urls=[`https://archidekt.com/api/decks/${deckId}/`,`https://archidekt.com/api/decks/${deckId}/small/`];
  let lastStatus=0,lastText="";
  for(const url of urls){
    const r=await archidektRequest(url,{method:"GET",headers:{...(session.account?.token?{"Authorization":`JWT ${session.account.token}`}:{ }),"Accept":"application/json"}},2);
    lastStatus=r.status;lastText=await r.text();if(!r.ok)continue;
    let payload={};try{payload=JSON.parse(lastText)}catch{throw new Error("Archidekt devolvió un deck que no es JSON.")}
    const partition=partitionArchidektDeck(payload),{categories,mainboard,excluded,commanders}=partition;
    const calculatedSize=partition.size,excludedCount=partition.excludedCount;
    const summary=session.decks?.find(d=>d.id===Number(deckId));
    // Archidekt list/detail `size` fields are diagnostics only.
    // Visible Size uses the validated Method 6: categories[0] is the primary board;
    // Sideboard and Maybeboard are excluded, all other quantities are counted.
    const catalogSize=Number.isFinite(Number(summary?.size))?Number(summary.size):null;
    const payloadSize=Number.isFinite(Number(payload.size))?Number(payload.size):null;
    const reportedSize=payloadSize??catalogSize;
    const meta=await batchScryfallImages(mainboard.map(c=>c.name));
    const enriched=mainboard.map(c=>{const m=meta.get(c.name)||{};return {...c,typeLine:m.typeLine||"",cmc:Number(m.cmc||0),imageNormal:m.normal||m.large||null,roles:classifyRoles(m)}});
    const commanderImages=commanders.map(name=>{const m=meta.get(name)||{};return {name,image:m.small||m.normal||m.large||null,normal:m.normal||m.large||m.small||null,large:m.large||m.normal||m.small||null}});
    const primaryCommanderImage=commanderImages[0]||{};
    return {
      id:Number(deckId),name:String(payload.name||summary?.name||`Deck ${deckId}`),
      commander:commanders[0]||null,commanders,commanderImages,commanderImage:primaryCommanderImage.normal||primaryCommanderImage.image||null,commanderImageLarge:primaryCommanderImage.large||primaryCommanderImage.normal||null,
      mainboard:enriched,excluded,
      size:calculatedSize,mainboardCount:calculatedSize,calculatedIncludedCount:calculatedSize,
      reportedSize,excludedCount,
      sizeAudit:{calculated:calculatedSize,reported:reportedSize,catalog:catalogSize,payload:payloadSize,excluded:excludedCount,categories:categories.map(c=>({name:c.name,includedInDeck:Boolean(c.includedInDeck),isPremier:Boolean(c.isPremier)}))},
      categories:categories.map(c=>({name:c.name,includedInDeck:Boolean(c.includedInDeck),isPremier:Boolean(c.isPremier)})),
      url:`https://archidekt.com/decks/${Number(deckId)}`
    };
  }
  throw new Error(`No pude leer el detalle del mazo en Archidekt (HTTP ${lastStatus}). ${lastText.slice(0,180)}`);
}


async function fetchFullArchidektPayload(session,deckId,{attempts=3}={}){
  const id=Number(deckId);if(!id)throw new Error("deckId inválido.");
  const url=`https://archidekt.com/api/decks/${id}/`;
  const r=await archidektRequest(url,{method:"GET",headers:{...(session.account?.token?{"Authorization":`JWT ${session.account.token}`}:{ }),"Accept":"application/json"}},attempts);
  const raw=await r.text();
  if(!r.ok)throw new Error(`Archidekt full deck HTTP ${r.status}: ${raw.slice(0,180)}`);
  try{return JSON.parse(raw)}catch{throw new Error("Archidekt full deck devolvió una respuesta no JSON.")}
}
async function fetchDeckPartitionFullOnly(session,deckId){
  return partitionArchidektDeck(await fetchFullArchidektPayload(session,deckId,{attempts:3}));
}
function archidektCategoryName(x){return typeof x==="string"?x:String(x?.name||x?.category||"")}
// Commander identity fallback validated against the in-app five-method comparison:
// read the FULL Archidekt payload and identify cards whose primary category is premier.
// This intentionally stays separate from lib/archidekt-size.mjs / Method 6.
function detectPremierCommanders(payload){
  const categories=Array.isArray(payload?.categories)?payload.categories:[];
  const byName=new Map(categories.map(c=>[String(c?.name||"").toLocaleLowerCase("en-US"),c]));
  const commanders=[];
  for(const entry of payload?.cards||[]){
    const card=entry?.card||{},oracle=card?.oracleCard||card?.oracle_card||{};
    const name=String(oracle?.name||card?.name||entry?.name||"").trim();if(!name)continue;
    const cats=(entry?.categories||[]).map(archidektCategoryName).filter(Boolean),primary=cats[0]||"";
    const meta=byName.get(primary.toLocaleLowerCase("en-US"));
    if(Boolean(meta?.isPremier)||/^commander$/i.test(primary))commanders.push(name);
  }
  return [...new Set(commanders)];
}
async function discoverCommanderExact(name){
  if(!name)return null;
  const results=await commanderSearch(name);
  const wanted=String(name).toLocaleLowerCase("en-US");
  return (results||[]).find(x=>String(x.name||"").toLocaleLowerCase("en-US")===wanted)||(results||[])[0]||null;
}

// v2.4.5 — precálculo de Size en segundo plano, apenas se conecta la cuenta, en vez de
// esperar a que el usuario busque el mazo. Reusa exactamente el mismo endpoint y el mismo
// Method 6 ya validado (partitionArchidektDeck), sin el enriquecido de Scryfall que
// fetchRawDeckDetail hace para la vista de detalle completa — acá solo hace falta el número.
// v2.4.9 — ahora devuelve la partición completa (no solo .size), porque la misma llamada
// ya trae todo lo necesario para el "uso en otros mazos" (antes se pedía el mazo dos veces
// por dos caminos distintos: una vez acá para el número, otra por el bridge para las cartas).
async function fetchDeckPartition(session, deckId){
  const urls=[`https://archidekt.com/api/decks/${deckId}/`,`https://archidekt.com/api/decks/${deckId}/small/`];
  for(const url of urls){
    const r=await archidektRequest(url,{method:"GET",headers:{...(session.account?.token?{"Authorization":`JWT ${session.account.token}`}:{ }),"Accept":"application/json"}},2);
    if(!r.ok)continue;
    const text=await r.text();
    let payload={};try{payload=JSON.parse(text)}catch{continue}
    return partitionArchidektDeck(payload);
  }
  return null;
}

// Preview image fast path: reuse the local Scryfall cache first, then recover a missing
// exact image without changing the validated Size/Method 6 module.
async function fetchExactScryfallPreview(name){
  const fromCache=await batchScryfallImages([name]);
  let m=fromCache.get(name)||{};
  if(m.small||m.normal||m.large)return {image:m.small||m.normal||m.large||null,normal:m.normal||m.large||m.small||null,large:m.large||m.normal||m.small||null};
  const r=await scryfallRequest(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,{headers:{Accept:"application/json"}},20000);
  if(!r.ok)return {image:null,normal:null,large:null};
  const c=await r.json();
  const face=c.card_faces?.[0];
  const small=c.image_uris?.small||face?.image_uris?.small||c.image_uris?.normal||face?.image_uris?.normal||null;
  const normal=c.image_uris?.normal||face?.image_uris?.normal||small;
  const large=c.image_uris?.large||face?.image_uris?.large||normal;
  return {image:small,normal,large};
}
async function resolveDeckPreview(session,deckId){
  const id=Number(deckId),summary=(session.decks||[]).find(d=>Number(d.id)===id);
  if(!id)throw new Error("deckId inválido.");
  if(!session.deckPreviewCache)session.deckPreviewCache=new Map();
  const cacheKey=`${id}:${summary?.updatedAt||""}`;
  const memory=session.deckPreviewCache.get(cacheKey);
  if(memory?.commander&&memory?.commanderImage)return memory;

  const disk=await loadDeckDiskCache(session),previous=disk.decks?.[String(id)]||{};
  let commander=String(summary?.commander||previous.commander||deckCachedCommander(previous.cards)||"").trim()||null;
  let image=null,large=null,previewMethod="cache";

  // Fast path (validated Method 1): reuse Commander identity + Scryfall disk cache.
  if(commander){
    const sf=await fetchExactScryfallPreview(commander);
    image=sf.normal||sf.image||null;large=sf.large||image;
    if(!image){
      // Commander is already known, so use Discover's proven Scryfall pipeline without
      // needlessly downloading the Archidekt deck again.
      const hit=await discoverCommanderExact(commander);
      image=hit?.image||null;large=hit?.largeImage||image;previewMethod="cache-discover";
    }
  }

  // Fallback (validated Method 5): FULL Archidekt -> isPremier -> Discover pipeline.
  if(!commander||!image){
    const payload=await fetchFullArchidektPayload(session,id,{attempts:3});
    const commanders=detectPremierCommanders(payload);
    commander=commanders[0]||null;
    if(!commander)throw new Error("El deck completo no expuso una categoría premier para el Commander.");
    const hit=await discoverCommanderExact(commander);
    if(!hit?.image)throw new Error(`Discover no devolvió imagen para ${commander}.`);
    image=hit.image;large=hit.largeImage||hit.image;previewMethod="full-premier-discover";
  }

  const out={
    id,name:summary?.name||`Deck ${id}`,commander,
    commanderImage:image,commanderImageLarge:large||image,
    exactMainCount:Number.isFinite(Number(summary?.exactMainCount))?Number(summary.exactMainCount):Number.isFinite(Number(summary?.mainCount))?Number(summary.mainCount):Number.isFinite(Number(previous.size))?Number(previous.size):null,
    url:`https://archidekt.com/decks/${id}`,previewMethod
  };
  if(summary){
    summary.commander=commander;summary.commanderImage=image;summary.commanderImageLarge=large||image;summary.previewMethod=previewMethod;
  }
  disk.decks[String(id)]={...previous,updatedAt:summary?.updatedAt||previous.updatedAt||null,commander,previewMethod,savedAt:Date.now()};
  await saveDeckDiskCache(session);
  session.deckPreviewCache.set(cacheKey,out);
  return out;
}

function prefetchDeckSizes(session){
  const initialTargets=(session.decks||[]).filter(d=>d.exactMainCount==null);
  if(!initialTargets.length)return;
  const t0=Date.now();
  (async()=>{
    let pending=initialTargets;
    const delays=[0,4000,9000];
    for(let round=0;round<delays.length && pending.length;round++){
      if(delays[round])await new Promise(r=>setTimeout(r,delays[round]));
      const next=[];let cursor=0;
      async function worker(){
        while(cursor<pending.length){
          const deck=pending[cursor++];
          try{
            const partition=await fetchDeckPartition(session,deck.id);
            if(partition){deck.exactMainCount=partition.size;deck.mainCount=partition.size;deck.commander=partition.commanders?.[0]||deck.commander||null;continue}
          }catch{}
          next.push(deck);
        }
      }
      await Promise.all(Array.from({length:Math.min(round?2:4,pending.length)},worker));
      pending=next;
    }
    console.log(`[timing] prefetch-deck-sizes:TOTAL: ${Date.now()-t0}ms · ${initialTargets.length-pending.length}/${initialTargets.length} mazos${pending.length?` · ${pending.length} pendientes`:""}`);
  })().catch(e=>console.log(`[timing] prefetch-deck-sizes:FAILED (${String(e.message||e)})`));
}

function getSession(req){
  const sid=req.headers["x-manashelf-session"];
  if(!sid)return null;
  const session=sessions.get(String(sid));
  if(session)session.lastSeen=Date.now();
  return session;
}


// v2.4.12 — detección de mazo Tribal: la detección de temáticas anterior era 100% por
// patrón de texto por carta, sin ningún conteo agregado de subtipos de criatura del mazo.
// Un mazo Tribal (ej. Elfos) nunca aparecía como tema porque ninguna carta individual
// "dice" que el mazo es tribal — es la ACUMULACIÓN de un mismo subtipo lo que lo define.
// Esto también explica por qué las cartas de soporte tribal se sugerían para cortar:
// sin theme detectado, themeHits daba 0 y sumaban puntaje de corte por "sin evidencia clara".
function detectTribalType(expanded){
  const counts={};
  let totalCreatures=0;
  for(const c of expanded){
    const tl=String(c.meta?.typeLine||"");
    if(!/creature/i.test(tl))continue;
    const qty=Number(c.quantity||1);
    totalCreatures+=qty;
    const subtypesPart=tl.split(/—|-/).slice(1).join(" ");
    for(const sub of subtypesPart.trim().split(/\s+/)){
      const clean=sub.trim();
      if(!clean||clean.length<3)continue;
      counts[clean]=(counts[clean]||0)+qty;
    }
  }
  const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  if(!entries.length||!totalCreatures)return null;
  const [type,count]=entries[0];
  // Umbral: al menos 6 criaturas del mismo subtipo Y que sea ~18% o más de las criaturas del mazo.
  if(count<6||count/totalCreatures<0.18)return null;
  return {type,count,totalCreatures};
}
function themeSignals(meta){  const text=String(meta?.oracleText||"").toLowerCase(),type=String(meta?.typeLine||"").toLowerCase(),out=[];
  const add=(name,weight,why)=>out.push({name,weight,why});
  if(/\+1\/\+1 counter/.test(text))add("+1/+1 Counters",2,"+1/+1 counters");
  if(/\binfect\b|\btoxic\b|poison counter|poisoned/.test(text))add("Infect / Poison",4,"infect/toxic/poison");
  if(/\bproliferate\b/.test(text))add("Proliferate",3,"proliferate");
  if(/\bdeathtouch\b/.test(text))add("Deathtouch",2,"deathtouch");
  if(/\bsacrifice\b|whenever .* dies|when .* dies/.test(text))add("Sacrifice / Aristocrats",2,"sacrifice/death triggers");
  if(/return .*graveyard.*battlefield|put .*graveyard.*battlefield|reanimate/.test(text))add("Reanimator",3,"reanimation effect");
  else if(/\bgraveyard\b|\bmill\b/.test(text))add("Graveyard",1.5,"graveyard interaction");
  if(/create .* token|tokens? you control|populate/.test(text))add("Tokens",2,"token production/payoff");
  if(/artifact(s)? you control|whenever .*artifact|sacrifice an artifact|artifact spell|artifact card/.test(text))add("Artifacts",2.5,"explicit artifact payoff/enabler");
  if(/enchantment(s)? you control|whenever .*enchantment|enchantment spell|enchantment card/.test(text))add("Enchantments",2.5,"explicit enchantment payoff/enabler");
  if(/instant or sorcery|instant and sorcery|noncreature spell|magecraft|whenever you cast .*spell/.test(text))add("Spellslinger",2.5,"spell payoff/enabler");
  if(/choose a creature type|creatures? you control of the chosen type|creature cards? of the chosen type/.test(text))add("Kindred",3,"explicit creature-type payoff");
  if(/equipment you control|equipped creature|attach .*equipment|equipment spell/.test(text))add("Equipment",2.5,"equipment payoff/enabler");
  if(/\blandfall\b|whenever a land enters|lands? you control.*(graveyard|battlefield)|play an additional land/.test(text))add("Lands Matter",2.5,"land payoff/enabler");
  if(/whenever you gain life|if you gained life|life you gained/.test(text))add("Lifegain",2.5,"lifegain payoff");
  if(/\bblink\b|exile .* then return|exile .* return .* battlefield/.test(text))add("Blink / ETB",2.5,"blink/ETB engine");
  return out;
}
function edhrecTagEvidence(tag,meta){
  const t=String(tag||"").toLowerCase(),text=String(meta?.oracleText||"").toLowerCase(),type=String(meta?.typeLine||"").toLowerCase();
  const local=new Set(themeSignals(meta).map(x=>x.name.toLowerCase()));
  if(local.has(t))return 3;
  if(t==="burn"&&/(deals? .*damage to (any target|target player|target opponent|each opponent)|damage can't be prevented)/.test(text))return 4;
  if(t==="group slug"&&/(each opponent (loses|takes)|deals? .*damage to each opponent|whenever an opponent|at the beginning of each opponent|players can't gain life)/.test(text))return 4;
  if(t==="group hug"&&/(each player draws|each player may|each player.*add|opponents? .*draw|another player|target opponent.*draw)/.test(text))return 3;
  if(t==="chaos"&&/(at random|coin flip|flip a coin|randomly|exchange control|choose .* at random)/.test(text))return 4;
  if(t==="infect"&&/\binfect\b|\btoxic\b|poison counter|poisoned/.test(text))return 5;
  if(t==="aristocrats"&&(/whenever .* dies|when .* dies/.test(text)||(/sacrifice/.test(text)&&/creature/.test(text))))return 3;
  if(t==="sacrifice"&&/sacrifice/.test(text))return 3;
  if(t==="spellslinger"&&/instant or sorcery|instant and sorcery|magecraft|whenever you cast .*spell/.test(text))return 3;
  if(t==="proliferate"&&/\bproliferate\b/.test(text))return 4;
  if(t==="+1/+1 counters"&&/\+1\/\+1 counter/.test(text))return 4;
  if(t==="lifegain"&&/gain .*life|whenever you gain life/.test(text))return 3;
  if(t==="lifedrain"&&/(opponent loses .*life|each opponent loses).*gain/.test(text))return 4;
  if(t==="artifacts"&&(type.includes("artifact")||/artifact/.test(text)))return 2;
  if(t==="enchantress"&&(type.includes("enchantment")||/enchantment/.test(text)))return 2;
  if(t==="tokens"&&/create .*token|tokens? you control/.test(text))return 3;
  if(t==="graveyard"&&/\bgraveyard\b/.test(text))return 2;
  if(t==="reanimator"&&/graveyard.*battlefield|return .* from .*graveyard/.test(text))return 4;
  if(t==="landfall"&&/\blandfall\b|whenever a land enters/.test(text))return 4;
  if(t==="lands matter"&&(/land/.test(text)&&/(graveyard|battlefield|additional land|land card)/.test(text)))return 2;
  if(t==="equipment"&&(type.includes("equipment")||/equipped creature|equipment/.test(text)))return 3;
  if(t==="auras"&&(type.includes("aura")||/\baura\b/.test(text)))return 3;
  if(t==="wheels"&&/(each player.*discard|each player.*draw|discard your hand.*draw)/.test(text))return 4;
  if(t==="discard"&&/discard/.test(text))return 2;
  if(t==="card draw"&&/draw .*card/.test(text))return 2;
  if(t==="forced combat"&&/(goad|attacks each combat|must attack|can't attack you)/.test(text))return 4;
  if(t==="politics"&&/(opponent chooses|player of your choice|choose an opponent|vote|votes)/.test(text))return 3;
  return 0;
}
function roleQty(cards,role){return cards.filter(c=>c.roles.includes(role)).reduce((n,c)=>n+Number(c.quantity||1),0)}
function healthBand(value,low,high){return value<low?"Bajo":value>high?"Alto":"Adecuado"}
async function buildDeckHealth(session,deckId,{includeDeckMetrics=false}={}){
  if(!session.deckDetails)session.deckDetails=new Map();
  let deck=session.deckDetails.get(Number(deckId));
  if(!deck){deck=await fetchRawDeckDetail(session,deckId);session.deckDetails.set(Number(deckId),deck)}
  if(!session.healthCache)session.healthCache=new Map();
  const deckSignature=JSON.stringify({cards:(deck.mainboard||[]).map(c=>[c.name,c.quantity,c.primaryCategory]),metricsVersion:METRICS_ENGINE_VERSION,classificationVersion:CLASSIFICATION_VERSION,simulationVersion:SIMULATION_VERSION});
  const cachedHealth=session.healthCache.get(Number(deckId));
  if(cachedHealth?.deckSignature===deckSignature && (!includeDeckMetrics||cachedHealth.data?.deckMetrics))return cachedHealth.data;
  const names=[...new Set((deck.mainboard||[]).map(c=>c.name).concat(deck.commander?[deck.commander]:[]))];
  const meta=await batchScryfallImages(names),expanded=[];
  for(const entry of deck.mainboard||[]){const m=meta.get(entry.name)||{typeLine:"",oracleText:"",cmc:0};expanded.push({...entry,meta:m,roles:classifyRoles(m),themes:themeSignals(m)})}
  // v2.4.12 — si hay un subtipo tribal dominante, etiquetar cartas de soporte tribal
  // (texto que menciona ese tipo como payoff) como evidencia del theme "Tribal: X", para
  // que dejen de verse como "sin evidencia clara" en el corte de cartas.
  const tribal=detectTribalType(expanded);
  if(tribal){
    const tribalRe=new RegExp(`\\b${tribal.type.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}s?\\b`,"i");
    for(const c of expanded){
      const text=String(c.meta?.oracleText||""),tl=String(c.meta?.typeLine||"");
      const isThatType=/creature/i.test(tl)&&tribalRe.test(tl);
      const mentionsAsPayoff=tribalRe.test(text)&&/you control|get \+|gets \+|other |whenever (a|another)/i.test(text);
      if(isThatType||mentionsAsPayoff)c.themes.push({name:`Tribal: ${tribal.type}`,weight:isThatType?1:3,why:isThatType?`es ${tribal.type}`:"soporte tribal explícito"});
    }
  }
  const commanderMeta=meta.get(deck.commander)||{}, commanderText=String(commanderMeta.oracleText||"").toLowerCase(), commanderCmc=Number(commanderMeta.cmc||0);
  const nonlands=expanded.filter(c=>!String(c.meta.typeLine||"").toLowerCase().includes("land")), nonlandQty=nonlands.reduce((n,c)=>n+Number(c.quantity||1),0);
  const avgCmc=nonlandQty?nonlands.reduce((n,c)=>n+Number(c.meta.cmc||0)*Number(c.quantity||1),0)/nonlandQty:0;
  const lands=expanded.filter(c=>String(c.meta.typeLine||"").toLowerCase().includes("land")).reduce((n,c)=>n+Number(c.quantity||1),0);
  const rampCards=expanded.filter(c=>c.roles.includes("Ramp")),drawCards=expanded.filter(c=>c.roles.includes("Draw")),removalCards=expanded.filter(c=>c.roles.includes("Removal")),counterCards=expanded.filter(c=>c.roles.includes("Counterspells")),wipeCards=expanded.filter(c=>c.roles.includes("Board Wipes")),landCards=expanded.filter(c=>String(c.meta.typeLine||"").toLowerCase().includes("land"));
  const ramp=roleQty(expanded,"Ramp"),draw=roleQty(expanded,"Draw"),removal=roleQty(expanded,"Removal"),counters=roleQty(expanded,"Counterspells"),wipes=roleQty(expanded,"Board Wipes");
  const interaction=removal+counters+wipes;
  const commanderDraws=/draw|exile .*you may (play|cast)|look at .*top.*(play|cast)/.test(commanderText);
  const rampLow=(avgCmc>=3.5?9:avgCmc<=2.5?6:8)+(commanderCmc>=6?1:0);
  const drawLow=commanderDraws?6:8;
  const interactionLow=8;
  const health=[
    {key:"mana",label:"Maná",value:ramp,refMin:rampLow,refMax:rampLow+5,level:healthBand(ramp,rampLow,rampLow+5),display:`${lands} tierras · ${ramp} ramp`,refs:[{label:`${lands} tierras`,cards:landCards.map(c=>c.name)},{label:`${ramp} ramp`,cards:rampCards.map(c=>c.name)}],basis:`Se detectaron ${lands} tierras y ${ramp} fuentes de aceleración no-tierra. Las tierras que simplemente producen maná NO cuentan como ramp. CMC medio no-tierra ${avgCmc.toFixed(1)}; Commander CMC ${commanderCmc||"?"}. Rango orientativo de ramp ${rampLow}–${rampLow+5}; el coste del Commander solo modifica levemente el piso.`},
    {key:"advantage",label:"Card Advantage",value:draw,refMin:drawLow,refMax:drawLow+5,level:healthBand(draw,drawLow,drawLow+5),display:`${draw} fuentes detectadas`,refs:[{label:`${draw} fuentes`,cards:drawCards.map(c=>c.name)}],basis:`Se detectaron ${draw} fuentes de robo/ventaja. Rango orientativo ${drawLow}–${drawLow+5}. ${commanderDraws?"El Commander parece generar ventaja de cartas, por eso el piso se reduce.":"El Commander no parece aportar robo repetible de forma clara, por eso no se reduce el piso."}`},
    {key:"interaction",label:"Interacción",value:interaction,refMin:interactionLow,refMax:15,level:healthBand(interaction,interactionLow,15),display:`${removal} removal · ${counters} counters · ${wipes} wipes`,refs:[{label:`${removal} removal`,cards:removalCards.map(c=>c.name)},{label:`${counters} counters`,cards:counterCards.map(c=>c.name)},{label:`${wipes} wipes`,cards:wipeCards.map(c=>c.name)}],basis:`Interacción agrupa respuestas puntuales, counters y wipes: ${removal} + ${counters} + ${wipes} = ${interaction}. Rango orientativo 8–15. El número no presupone un metajuego concreto; sirve para señalar extremos.`},
    {key:"curve",label:"Curva",value:avgCmc,refMin:2,refMax:4,level:avgCmc>4?"Alta":avgCmc<2?"Muy baja":"Adecuada",display:`CMC medio ${avgCmc.toFixed(1)}`,refs:[{label:"Ver cartas por CMC",cards:nonlands.map(c=>c.name)}],basis:`CMC medio calculado sobre cartas no-tierra: ${avgCmc.toFixed(1)}. No se marca como “mala” por sí sola: se usa para interpretar el maná y detectar curvas excepcionalmente altas o bajas.`}
  ];

  // Structural recommendations: every rule is evaluated independently.
  // Multiple recommendations may be returned for the same deck.
  const graveHateCards=expanded.filter(c=>/exile .*graveyard|exile all cards from .*graveyard|cards in graveyards can't|graveyard.*exile/.test(String(c.meta.oracleText||"").toLowerCase()));
  const graveHate=graveHateCards.reduce((n,c)=>n+Number(c.quantity||1),0);
  const protectionCards=expanded.filter(c=>c.roles.includes("Protection")),recursionCards=expanded.filter(c=>c.roles.includes("Recursion"));
  const protection=roleQty(expanded,"Protection");
  const recursion=roleQty(expanded,"Recursion");
  const graveyardPlan=expanded.filter(c=>/from your graveyard|in your graveyard|cards? in your graveyard|mill (a|two|three|four|five|\d+|cards?)/.test(String(c.meta.oracleText||"").toLowerCase())).reduce((n,c)=>n+Number(c.quantity||1),0);
  const landLow=(avgCmc>=3.8?36:avgCmc<=2.5?32:34)+(commanderCmc>=6?1:0);
  const gaps=[];
  const structuralRules=[
    {type:"Ramp",triggered:ramp<rampLow,summary:`${ramp} detectadas · referencia ${rampLow}+`,cards:rampCards.map(c=>c.name)},
    {type:"Card Advantage",triggered:draw<drawLow,summary:`${draw} fuentes · referencia ${drawLow}+`,cards:drawCards.map(c=>c.name)},
    {type:"Interacción",triggered:interaction<interactionLow,summary:`${interaction} piezas · referencia ${interactionLow}+`,cards:[...removalCards,...counterCards,...wipeCards].map(c=>c.name)},
    {type:"Graveyard hate",triggered:graveHate===0,summary:`${graveHate} respuestas detectadas`,cards:graveHateCards.map(c=>c.name)},
    {type:"Board wipe",triggered:wipes===0,summary:`${wipes} wipes detectados`,cards:wipeCards.map(c=>c.name)},
    {type:"Protección / resiliencia",triggered:protection===0&&commanderCmc>=5,summary:`${protection} protección · Commander CMC ${commanderCmc||"?"}`,cards:protectionCards.map(c=>c.name)},
    {type:"Tierras / base de maná",triggered:lands<landLow,summary:`${lands} tierras · referencia contextual ${landLow}+`,cards:landCards.map(c=>c.name)},
    {type:"Recursión",triggered:graveyardPlan>=5&&recursion===0,summary:`${recursion} recursión · ${graveyardPlan} cartas con plan de cementerio`,cards:recursionCards.map(c=>c.name)}
  ];

  if(ramp<rampLow)gaps.push({type:"Ramp",severity:"A considerar",why:`Detecté ${ramp} fuentes de ramp y, por la curva/Commander de este mazo, el piso orientativo es ${rampLow}. Si el mazo se siente lento, sumar aceleración barata es una mejora estructural posible.`,basis:`Ramp detectado: ${ramp}. CMC medio no-tierra ${avgCmc.toFixed(1)}; Commander CMC ${commanderCmc||"?"}. El piso contextual calculado es ${rampLow}.`});
  if(draw<drawLow)gaps.push({type:"Card Advantage",severity:"A considerar",why:`Detecté ${draw} fuentes de robo o ventaja de cartas, por debajo del piso orientativo ${drawLow}. El mazo puede quedarse sin recursos en partidas largas.`,basis:`Fuentes detectadas: ${draw}. ${commanderDraws?"El Commander parece aportar ventaja, por eso el piso ya está reducido.":"El Commander no parece aportar robo repetible claro."}`});
  if(interaction<interactionLow)gaps.push({type:"Interacción",severity:"A considerar",why:`Detecté ${interaction} piezas de interacción entre removal, counters y wipes. Es un volumen bajo para responder a permanentes o jugadas rivales de forma consistente.`,basis:`Removal ${removal} + counters ${counters} + wipes ${wipes} = ${interaction}. Piso orientativo actual: ${interactionLow}.`});
  if(graveHate===0)gaps.push({type:"Graveyard hate",severity:"A considerar",why:"No detecté respuestas directas a cementerios. Muchos mazos Commander usan el cementerio como recurso; tener al menos alguna respuesta puede evitar que una estrategia rival opere sin oposición.",basis:"Se buscó texto Oracle que exile cartas/cementerios o limite el uso del cementerio. Resultado: 0 detectadas. No se impone una cuota fija porque depende mucho de tu mesa."});
  if(wipes===0)gaps.push({type:"Board wipe",severity:"A considerar",why:"No detecté limpiezas amplias. Una respuesta global puede ser importante cuando un rival desarrolla una mesa que el removal uno-a-uno no alcanza a controlar.",basis:"Se detectaron 0 wipes mediante patrones de efectos globales. No significa que el deck esté mal: estrategias muy rápidas, proactivas o asimétricas pueden elegir no usarlos."});
  if(protection===0 && commanderCmc>=5)gaps.push({type:"Protección / resiliencia",severity:"A considerar",why:"El Commander es relativamente costoso y no detecté protección directa. Si el plan depende de mantenerlo en mesa, recastearlo repetidamente puede ser caro.",basis:`Commander CMC ${commanderCmc}; protección detectada: ${protection}. Esta advertencia es contextual y no se usa si el Commander es barato.`});
  // v2.4.18 — chequeo de tamaño reglamentario (100 cartas exactas, formato Commander). A
  // diferencia de las demás recomendaciones (heurísticas, "a considerar"), esto es una
  // regla de formato dura: se muestra solo si el mazo NO tiene exactamente 100, con
  // severidad distinta (roja, no ámbar) para que se note que no es una sugerencia opcional.
  if(Number(deck.size)!==100){
    const diff=100-Number(deck.size||0);
    gaps.push({type:"Tamaño del mazo",severity:diff>0?"Faltan cartas":"Sobran cartas",why:diff>0?`El mazo tiene ${deck.size} cartas — le faltan ${diff} para llegar a las 100 que exige el formato Commander (99 + Commander).`:`El mazo tiene ${deck.size} cartas — le sobran ${Math.abs(diff)} para el límite de 100 que exige el formato Commander (99 + Commander).`,basis:`Size real calculado por Method 6 (excluye Sideboard/Maybeboard): ${deck.size}. El formato Commander exige exactamente 100 cartas totales, incluyendo el Commander.`});
  }
  if(lands<landLow)gaps.push({type:"Tierras / base de maná",severity:"A revisar",why:`Detecté ${lands} tierras, por debajo de la referencia contextual ${landLow} para esta curva. Si el mazo falla land drops, revisaría primero la base de maná antes de agregar más cartas de coste alto.`,basis:`Tierras detectadas: ${lands}. CMC medio no-tierra ${avgCmc.toFixed(1)}; Commander CMC ${commanderCmc||"?"}. La referencia no cuenta MDFC/hechizos que funcionen como tierra si Scryfall no los clasifica como Land.`});
  if(graveyardPlan>=5&&recursion===0)gaps.push({type:"Recursión",severity:"A considerar",why:`Detecté ${graveyardPlan} cartas que usan o alimentan tu cementerio, pero ninguna pieza clara de recursión. Si el cementerio forma parte del plan, recuperar amenazas o recursos puede mejorar la resiliencia.`,basis:`Se detectaron ${graveyardPlan} cartas con señales de plan de cementerio y ${recursion} piezas clasificadas como Recursion.`});

  // Theme inference is constrained to EDHREC's own tags for this Commander.
  // ManaShelf only decides which of those tags the user's concrete deck supports.
  let edhrecWarning=null,commanderTags=[];
  if(deck.commander){try{commanderTags=await edhrecTags(deck.commander)}catch(e){edhrecWarning=`EDHREC tags no disponibles: ${String(e.message||e)}`}}
  const scoredTags=commanderTags.map(tag=>{
    const cards=[],weights=[];
    for(const c of expanded){const w=edhrecTagEvidence(tag.name,c.meta);if(w>0){cards.push(c.name);weights.push(w*Number(c.quantity||1))}}
    const unique=[...new Set(cards)],score=weights.reduce((n,x)=>n+x,0);
    return {...tag,cards:unique,cardCount:unique.length,score};
  }).filter(x=>x.cardCount>=2).sort((a,b)=>Number(b.count||0)-Number(a.count||0)||b.score-a.score);
  const themes=scoredTags.slice(0,5).map((t,idx)=>{
    const density=deck.size?Math.round(t.cardCount/deck.size*100):0;
    const confidence=t.cardCount>=8?"Alta":t.cardCount>=4?"Media":"Baja";
    return {name:t.name,confidence,density,cardCount:t.cardCount,cards:t.cards,commanderEvidence:true,
      tier:idx===0?"Theme principal":"Theme secundario",edhrecCount:t.count,
      explanation:`EDHREC etiqueta a ${deck.commander} con “${t.name}” (${t.count} decks). ManaShelf encontró ${t.cardCount} cartas de tu lista con evidencia compatible y usa esa evidencia local para ordenar los tags del Commander.`};
  });
  // v2.4.12 — si se detectó un subtipo tribal dominante y ningún tag de EDHREC ya lo cubre
  // (ej. "Elves"), se agrega como theme propio, con evidencia local, no de EDHREC.
  if(tribal&&!themes.some(t=>t.name.toLowerCase().includes(tribal.type.toLowerCase()))){
    const tribalCards=expanded.filter(c=>(c.themes||[]).some(t=>t.name===`Tribal: ${tribal.type}`));
    const tribalCardCount=tribalCards.length;
    const density=deck.size?Math.round(tribalCardCount/deck.size*100):0;
    // A local-only tribal signal is useful context, but it must not outrank themes that
    // EDHREC explicitly associates with this Commander. Keep it as a secondary fallback.
    if(themes.length<5)themes.push({name:`Tribal: ${tribal.type}`,confidence:tribal.count>=12?"Alta":"Media",density,cardCount:tribalCardCount,
      cards:tribalCards.map(c=>c.name),commanderEvidence:false,tier:"Theme secundario",edhrecCount:null,
      explanation:`ManaShelf detectó ${tribal.count} criaturas de subtipo ${tribal.type} (${Math.round(tribal.count/tribal.totalCreatures*100)}% de las criaturas del mazo). Es evidencia local útil, pero no desplaza temáticas que EDHREC relaciona directamente con ${deck.commander}. ${tribalCardCount} cartas totales cuentan como evidencia tribal.`});
  }

  let lists=[];if(deck.commander){const k=deck.commander.toLocaleLowerCase("en-US");try{lists=cache.edhrec.get(k)||await edhrec(deck.commander);cache.edhrec.set(k,lists)}catch(e){edhrecWarning=edhrecWarning||`EDHREC recomendaciones no disponibles: ${String(e.message||e)}`}}
  const collection=cache.collections.get(collectionCacheKeyFor(session))||[],mine=new Map(collection.map(c=>[c.name.toLocaleLowerCase("en-US"),c])),usage=session.deckUsage?.usage||new Map(),mainNames=new Set((deck.mainboard||[]).map(c=>c.name.toLocaleLowerCase("en-US"))),recMap=new Map();
  for(const l of lists)for(const c of l.cards){const k=c.name.toLocaleLowerCase("en-US");if(!recMap.has(k)||c.synergy>recMap.get(k).synergy)recMap.set(k,{...c,category:l.label})}
  const candidates=[...recMap.values()].filter(c=>{const k=c.name.toLocaleLowerCase("en-US"),o=mine.get(k);if(!o||mainNames.has(k))return false;const used=(usage.get(k)||[]).reduce((n,d)=>n+Number(d.quantity||0),0);return Number(o.quantity||0)-used>0}).sort((a,b)=>b.synergy-a.synergy).slice(0,50);
  const candMeta=await batchScryfallImages(candidates.map(c=>c.name));
  const lowKeys=new Set(health.filter(h=>h.level==="Bajo").map(h=>h.key));
  const suggestions=candidates.map(c=>{const m=candMeta.get(c.name)||{},roles=classifyRoles(m);let inclusionType="",reason="";
    if(lowKeys.has("mana")&&roles.includes("Ramp")){inclusionType="Corrige carencia · Ramp";reason="Aporta ramp y el eje Maná quedó bajo en este análisis."}
    else if(lowKeys.has("advantage")&&roles.includes("Draw")){inclusionType="Corrige carencia · Draw";reason="Aporta robo/ventaja y Card Advantage quedó bajo."}
    else if(lowKeys.has("interaction")&&(roles.includes("Removal")||roles.includes("Counterspells")||roles.includes("Board Wipes"))){inclusionType="Corrige carencia · Interacción";reason=`Aporta ${roles.find(r=>["Removal","Counterspells","Board Wipes"].includes(r))||"interacción"} y ese eje quedó bajo.`}
    else if(Number(c.synergy||0)>=.12){inclusionType="Alta sinergia EDHREC";reason="Tiene sinergia EDHREC alta para este Commander y hay copia disponible."}
    else if((roles||[]).some(r=>!["Utility","Creatures","Lands"].includes(r))){const role=roles.find(r=>!["Utility","Creatures","Lands"].includes(r));inclusionType=`Refuerza rol · ${role}`;reason=`EDHREC la recomienda y ManaShelf detecta el rol ${role}.`}
    else {inclusionType="Recomendación EDHREC";reason="Aparece en las recomendaciones EDHREC del Commander y hay copia disponible."}
    return {...c,roles,inclusionType,typeLine:m.typeLine||"",image:m.normal||m.small||null,imageNormal:m.normal||m.large||m.small||null,reason}}).sort((a,b)=>b.synergy-a.synergy).slice(0,8);
  const primaryType=typeLine=>{
    const left=String(typeLine||"").split("—")[0].toLowerCase();
    if(left.includes("land"))return "Land";
    if(left.includes("creature"))return "Creature";
    if(left.includes("instant"))return "Instant";
    if(left.includes("sorcery"))return "Sorcery";
    if(left.includes("artifact"))return "Artifact";
    if(left.includes("enchantment"))return "Enchantment";
    if(left.includes("planeswalker"))return "Planeswalker";
    if(left.includes("battle"))return "Battle";
    return "Other";
  };
  const curveTypes=["Creature","Instant","Sorcery","Artifact","Enchantment","Planeswalker","Battle","Other"];
  const curve=[0,1,2,3,4,5,6].map(cmc=>{
    const bucket=nonlands.filter(c=>cmc===6?Number(c.meta.cmc||0)>=6:Math.floor(Number(c.meta.cmc||0))===cmc);
    const count=bucket.reduce((n,c)=>n+Number(c.quantity||1),0),types={},cardsByType={};
    for(const type of curveTypes){types[type]=0;cardsByType[type]=[]}
    for(const c of bucket){
      const type=primaryType(c.meta.typeLine),q=Number(c.quantity||1);
      types[type]=(types[type]||0)+q;
      cardsByType[type].push(c.name);
    }
    return {cmc:cmc===6?"6+":String(cmc),count,types,cardsByType,cards:bucket.map(c=>c.name)};
  });
  // v2.4.17 — el donut incluía tierras pese a que el texto de ayuda dice "sin contar
  // tierras" (confirmado por auditoría: el dato y la copy se contradecían). Se usa `nonlands`
  // (la misma lista que ya excluye tierras para la Curva de maná) para que los dos gráficos
  // sean consistentes entre sí y con lo que dicen mostrar.
  const typeMap=new Map();
  for(const c of nonlands){const t=primaryType(c.meta.typeLine),q=Number(c.quantity||1);typeMap.set(t,(typeMap.get(t)||0)+q)}
  const typeDistribution=[...typeMap].map(([type,count])=>({type,count})).sort((a,b)=>b.count-a.count);

  // Initial contextual CUT model. It protects scarce structural roles and rewards
  // cuts that are expensive, redundant or weakly connected to the inferred plan.
  const protectedRole=r=>{
    if(r==="Ramp")return ramp<=rampLow+1;
    if(r==="Draw")return draw<=drawLow+1;
    if(["Removal","Counterspells","Board Wipes"].includes(r))return interaction<=interactionLow+2;
    return ["Graveyard Hate","Protection","Recursion"].includes(r);
  };
  const themeNames=new Set(themes.slice(0,3).map(t=>String(t.name||"").toLowerCase()));
  const cutCandidates=expanded.filter(c=>{
    const name=String(c.name||"");
    return name&&name.toLowerCase()!==String(deck.commander||"").toLowerCase()&&!String(c.meta.typeLine||"").toLowerCase().includes("land");
  }).map(c=>{
    const roles=c.roles||[],cmc=Number(c.meta.cmc||0);
    const protectedRoles=roles.filter(protectedRole);
    const themeHits=(c.themes||[]).filter(t=>themeNames.has(String(t).toLowerCase())).length;
    let score=0,reasons=[];
    if(cmc>=6){score+=3;reasons.push(`CMC ${cmc}: ocupa el tramo alto de la curva`)}
    else if(cmc>=5){score+=2;reasons.push(`CMC ${cmc}: coste relativamente alto`)}
    if(!themeHits){score+=3;reasons.push("no aporta evidencia clara a los themes principales")}
    if(!roles.length||roles.every(r=>["Utility","Creatures"].includes(r))){score+=2;reasons.push("no cubre un rol estructural prioritario")}
    if(protectedRoles.length){score-=7;reasons.push(`protege un rol ajustado: ${protectedRoles.join(", ")}`)}
    if(roles.includes("Board Wipes")&&wipes<=2)score-=4;
    return {name:c.name,quantity:Number(c.quantity||1),score,cmc,roles,protectedRoles,themeHits,typeLine:c.meta.typeLine||"",image:c.meta.normal||c.meta.small||null,imageNormal:c.meta.normal||c.meta.large||c.meta.small||null,reasons};
  }).filter(c=>c.score>0&&!c.protectedRoles.length).sort((a,b)=>b.score-a.score||b.cmc-a.cmc).slice(0,8);

  // Pair each IN with the most defensible unused OUT. This is not positional:
  // the pair score rewards a strong CUT candidate, curve improvement and keeping
  // the role that the incoming card is meant to add. Scarce roles were already
  // removed from cutCandidates above.
  const usedCuts=new Set();
  const swaps=suggestions.slice(0,5).map(inc=>{
    const incRoles=inc.roles||[],fixesGap=String(inc.inclusionType||"").startsWith("Corrige carencia");
    let best=null;
    for(const cut of cutCandidates){
      if(usedCuts.has(cut.name))continue;
      const overlapping=(cut.roles||[]).filter(r=>incRoles.includes(r));
      let pairScore=Number(cut.score||0);
      const cmcDelta=Number(cut.cmc||0)-Number(inc.cmc||0);
      if(cmcDelta>0)pairScore+=Math.min(3,cmcDelta*.75);
      if(fixesGap&&overlapping.length)pairScore-=4*overlapping.length;
      if(!cut.themeHits)pairScore+=1;
      if(!(cut.roles||[]).length)pairScore+=1;
      if(!best||pairScore>best.pairScore)best={cut,pairScore,overlapping,cmcDelta};
    }
    const cut=best?.cut||null;
    if(cut)usedCuts.add(cut.name);
    const pairReasons=[];
    if(cut){
      if(best.cmcDelta>0)pairReasons.push(`baja la curva: ${cut.cmc} → ${Number(inc.cmc||0)}`);
      if(!cut.themeHits)pairReasons.push("el OUT tiene baja evidencia de theme");
      if(!(cut.roles||[]).length)pairReasons.push("el OUT no cubre un rol estructural prioritario");
      if(fixesGap&&!best.overlapping.length)pairReasons.push("preserva el rol que el IN viene a reforzar");
      if(!pairReasons.length)pairReasons.push("es el corte disponible con mejor Cut Score contextual");
    }
    const confidence=cut?(best.pairScore>=7?"Media-alta":best.pairScore>=4?"Media":"Baja"):"Baja";
    return {include:inc,cut,confidence,pairScore:best?Math.round(best.pairScore*10)/10:0,pairReasons,
      impact:cut?{avgCmcDelta:Math.round((Number(inc.cmc||0)-Number(cut.cmc||0))*10)/10,protectedRolesIntact:true}:null};
  });
  // v2.4.12 — lookup liviano nombre→imagen para hover en "Cartas que atan varias temáticas"
  // (Identidad del mazo). Reusa el meta de Scryfall ya cargado en `expanded`, sin pedir nada de más.
  const cardImages={};
  for(const c of expanded){if(!cardImages[c.name])cardImages[c.name]={image:c.meta?.small||c.meta?.normal||null,imageLarge:c.meta?.large||c.meta?.normal||null}}
  // v2.5 Lab metrics engine — deterministic semantic metrics + cached lightweight development simulation.
  // It deliberately does not simulate opponents/combat and advanced outputs expose lower confidence.
  const deckMetrics=includeDeckMetrics?buildDeckMetrics(expanded,{
    commanderName:deck.commander||"",
    tribalType:tribal?.type||null,
    iterations:5000,
    deckSignature
  }):null;
  const healthResult={experimental:true,readOnly:true,edhrecWarning,deck:{id:deck.id,name:deck.name,commander:deck.commander,size:deck.size,mainboardCount:deck.size,url:deck.url},context:{
    commanderCmc,
    avgCmc:Math.round(avgCmc*10)/10,
    lands,ramp,draw,removal,counters,wipes,interaction,
    graveHate,protection,recursion,
    landLow,rampLow,drawLow,interactionLow,curve,typeDistribution
  },health,gaps,structuralRules,themes,suggestions,cutCandidates,swaps,cardImages,deckMetrics,caveats:["Theme es inferido por evidencia del Commander y densidad funcional del mazo.","Los rangos estructurales son orientativos; no conocen tu metajuego ni intención exacta.","La clasificación usa Oracle text y puede omitir funciones implícitas, combos o interacciones complejas."]};
  session.healthCache.set(Number(deckId),{deckSignature,data:healthResult,savedAt:Date.now()});
  return healthResult;
}


function isLegendaryCreatureTypeLine(typeLine){
  const tl=String(typeLine||"").toLowerCase();
  return tl.includes("legendary")&&tl.includes("creature");
}
async function ownedLegendaryCreatureCandidates(cards,onProgress=null){
  const names=[...new Set((cards||[]).map(c=>String(c.name||"").trim()).filter(Boolean))];
  // v2.4.3 — pre-filtro local: Archidekt ya manda el tipo de carta en el export (Types/Super-types),
  // validado contra una cuenta real (ver BACKLOG v2.4.3). Antes se consultaba Scryfall para el
  // total de la colección (6000+ cartas) solo para saber esto; ahora se consulta Scryfall
  // únicamente para los candidatos ya filtrados localmente, más una red de seguridad para
  // las cartas sin tipo local (nombres agrupados de más de una fila, importaciones viejas, etc.).
  const byName=new Map();
  for(const c of (cards||[])){
    const key=String(c.name||"").trim();
    if(key && !byName.has(key)) byName.set(key,c);
  }
  const toQuery=names.filter(name=>{
    const local=byName.get(name);
    return !local?.typeLine || isLegendaryCreatureTypeLine(local.typeLine);
  });
  const meta=await batchScryfallImages(toQuery,{onProgress});
  const out=[];
  for(const name of toQuery){
    const m=meta.get(name);if(!m)continue;
    const tl=String(m.typeLine||"").toLowerCase();
    if(tl.includes("legendary")&&tl.includes("creature")&&String(m.legalities?.commander||"")==="legal"){
      const owned=(cards||[]).filter(c=>String(c.name||"").toLocaleLowerCase("en-US")===name.toLocaleLowerCase("en-US")).reduce((n,c)=>n+Number(c.quantity||0),0);
      const signals=[...new Set(themeSignals(m).map(x=>x.name))];
      out.push({name,image:m.normal||m.small||null,imageLarge:m.large||m.normal||null,colorIdentity:m.colorIdentity||[],edhrecRank:m.edhrecRank??null,ownedQuantity:owned,typeLine:m.typeLine||"",signals,cmc:Number(m.cmc||0)});
    }
  }
  return out;
}
const jobs=new Map();
function startRankJob(session){
  const job={id:crypto.randomUUID(),type:"rank",section:"commanders",status:"running",current:0,total:0,message:"Identificando Commanders de tu colección…",errors:[],startedAt:Date.now(),finishedAt:null,ranked:[],failures:[]};
  jobs.set(job.id,job);
  (async()=>{
    try{
      const cards=cache.collections.get(collectionCacheKeyFor(session))||[];
      if(!cards.length)throw new Error("La colección todavía no está cargada.");
      const candidates=await ownedLegendaryCreatureCandidates(cards,p=>{job.message=p.message||job.message});
      job.total=candidates.length;
      if(!candidates.length)throw new Error("No pude identificar Commanders poseídos usando el catálogo cacheado ni los metadatos locales.");
      for(let i=0;i<candidates.length;i++){
        const candidate=candidates[i];
        job.current=i;job.message=`EDHREC · ${i+1}/${candidates.length} · ${candidate.name}`;
        try{
          const result=await commanderBuildability(session,candidate.name);
          job.ranked.push({...result,image:candidate.image||null,colorIdentity:candidate.colorIdentity||[],edhrecRank:candidate.edhrecRank??null});
        }catch(e){job.failures.push({name:candidate.name,error:String(e.message||e)})}
      }
      job.ranked.sort((a,b)=>b.owned-a.owned||b.available-a.available||b.coveragePct-a.coveragePct);job.ranked=job.ranked.slice(0,10);
      job.current=job.total;job.status=job.failures.length?"done_with_errors":"done";
      job.message=`Ranking listo · ${job.ranked.length}/${job.total} Commanders`;
    }catch(e){job.status="error";job.errors.push(String(e.message||e));job.message=String(e.message||e)}
    finally{job.finishedAt=Date.now()}
  })();
  return job;
}
function publicRankJob(j){return {id:j.id,status:j.status,current:j.current,total:j.total,message:j.message,errors:j.errors,failures:j.failures,ranked:(j.status==="done"||j.status==="done_with_errors")?j.ranked:[],startedAt:j.startedAt,finishedAt:j.finishedAt}}
function startOwnedCommandersJob(session){
  const job={id:crypto.randomUUID(),type:"owned-commanders",status:"running",current:0,total:0,message:"Preparando colección…",errors:[],startedAt:Date.now(),finishedAt:null,results:[]};
  jobs.set(job.id,job);
  if(Array.isArray(session.ownedCommandersCache)){
    job.status="done";job.current=1;job.total=1;job.results=session.ownedCommandersCache;job.message=`${job.results.length} Commanders listos · caché`;job.finishedAt=Date.now();return job;
  }
  (async()=>{
    const jobStart=Date.now();
    try{
      const cards=cache.collections.get(collectionCacheKeyFor(session))||[];
      if(!cards.length)throw new Error("La colección todavía no está cargada.");
      const unique=[...new Set(cards.map(c=>String(c.name||"").trim()).filter(Boolean))];
      job.total=Math.max(1,Math.ceil(unique.length/75));
      job.message=`Scryfall · preparando ${unique.length} cartas de tu colección…`;
      const results=await ownedLegendaryCreatureCandidates(cards,p=>{
        job.current=Math.max(0,Number(p.current||0));
        job.total=Math.max(1,Number(p.total||job.total||1));
        job.message=p.message?`Filtrando candidatos a Commander · ${p.message}`:job.message;
      });
      job.results=results.sort((a,b)=>a.name.localeCompare(b.name));
      session.ownedCommandersCache=job.results;
      job.current=job.total;
      job.status="done";
      job.message=`${job.results.length} Commanders listos`;
      console.log(`[timing] owned-commanders:TOTAL: ${Date.now()-jobStart}ms · ${unique.length} nombres únicos · ${job.results.length} Commanders`);
    }catch(e){
      job.status="error";job.errors.push(String(e.message||e));job.message=String(e.message||e);
      console.log(`[timing] owned-commanders:FAILED after ${Date.now()-jobStart}ms (${String(e.message||e)})`);
    }finally{job.finishedAt=Date.now()}
  })();
  return job;
}
function publicOwnedCommandersJob(j){
  return {id:j.id,status:j.status,current:j.current,total:j.total,message:j.message,errors:j.errors,results:j.status==="done"?j.results:[],startedAt:j.startedAt,finishedAt:j.finishedAt};
}

function newJob(type,section){
  const id=crypto.randomUUID(),job={id,type,section,status:"running",current:0,total:0,message:"Preparando…",errors:[],startedAt:Date.now(),finishedAt:null};
  jobs.set(id,job);return job;
}
function publicJob(j){return {id:j.id,type:j.type,section:j.section,status:j.status,current:j.current,total:j.total,message:j.message,errors:j.errors,startedAt:j.startedAt,finishedAt:j.finishedAt}}
function progress(job,current,total,message){job.current=current;job.total=total;job.message=message}
async function rebuildUsageFromDisk(session,job,{force=false}={}){
  if(!session.account){progress(job,1,1,"Uso entre mazos requiere cuenta privada.");return}
  const state=freshUsageState(session),disk=await loadDeckDiskCache(session);
  session.deckUsage=state;state.status="running";state.startedAt=Date.now();
  const decks=session.decks||[];progress(job,0,decks.length,"Preparando mazos…");
  for(let i=0;i<decks.length;i++){
    const deck=decks[i];progress(job,i,decks.length,`${force?"Recacheando":"Reconstruyendo"} uso · ${deck.name}`);
    try{
      let cards=disk.decks?.[String(deck.id)]?.cards;
      if(force||!Array.isArray(cards)){
        const response=await bridgePost("/api/personal-deck-cards",{account:session.account,deck_id:deck.id,include_deleted:false});
        cards=response.cards||[];
        disk.decks[String(deck.id)]={updatedAt:deck.updatedAt||null,size:Number.isFinite(Number(deck.size))?Number(deck.size):null,commander:deck.commander||deckCachedCommander(cards||[])||null,cards,savedAt:Date.now()};
      }
      addDeckCardsToUsage(state,deck,cards||[]);
      deck.commander=deckCachedCommander(cards||[])||deck.commander;
      state.completedDecks++;
    }catch(e){state.failedDecks++;state.errors.push({deckId:deck.id,deckName:deck.name,error:String(e.message||e)})}
  }
  await saveDeckDiskCache(session);
  state.totalDecks=decks.length;state.status=state.failedDecks?"done_with_errors":"done";state.finishedAt=Date.now();
  progress(job,decks.length,decks.length,`Uso reconstruido · ${decks.length-state.failedDecks}/${decks.length} mazos`);
}
async function deleteCacheSection(session,section){
  const rm=async f=>{try{await fs.rm(path.join(CACHE_DIR,f),{force:true})}catch{}};
  if(section==="decks"||section==="all"){if(session?.account){const disk=await loadDeckDiskCache(session);disk.decks={};await saveDeckDiskCache(session)}if(session){session.deckDetails?.clear();session.healthCache?.clear();session.ownedCommandersCache=null}}
  if(section==="usage"||section==="all"){if(session)session.deckUsage=freshUsageState(session)}
  if(section==="scryfall"||section==="all"){await rm("scryfall-images.json");scryfallDiskCache=null}
  if(section==="commanders"||section==="all"){await rm("commander-catalog.json");commanderCatalogDiskCache=null}
  if(section==="edhrec"||section==="all"){await rm("edhrec.json");edhrecDiskCache=null;cache.edhrec.clear()}
}
async function cacheStatus(session){
  const sf=await loadScryfallDiskCache(),ed=await loadEdhrecDiskCache();
  if(commanderCatalogDiskCache===null)commanderCatalogDiskCache=await readJsonFile(path.join(CACHE_DIR,"commander-catalog.json"),{version:2,updatedAt:0,cards:[]});
  const deckDisk=session?.account?await loadDeckDiskCache(session):{decks:{}};
  const deckEntries=Object.values(deckDisk.decks||{});
  return {
    schema:CACHE_SCHEMA_VERSION,
    path:".manashelf-cache",
    sections:{
      decks:{count:deckEntries.length,updatedAt:Math.max(0,...deckEntries.map(x=>Number(x.savedAt||0)))},
      usage:{count:session?.deckUsage?.usage?.size||0,updatedAt:Number(session?.deckUsage?.finishedAt||0)},
      scryfall:{count:Object.keys(sf.cards||{}).length,updatedAt:Math.max(0,...Object.values(sf.cards||{}).map(x=>Number(x.updatedAt||0)))},
      commanders:{count:(commanderCatalogDiskCache.cards||[]).length,updatedAt:Number(commanderCatalogDiskCache.updatedAt||0)},
      edhrec:{count:Object.keys(ed.entries||{}).length,updatedAt:Math.max(0,...Object.values(ed.entries||{}).map(x=>Number(x.updatedAt||0)))}
    }
  };
}
async function runCacheSection(session,section,job){
  if(section==="decks"){
    if(!session?.account)throw new Error("Recachear decks requiere cuenta privada.");
    const disk=await loadDeckDiskCache(session),decks=session.decks||[];
    progress(job,0,decks.length,"Preparando decks…");
    for(let i=0;i<decks.length;i++){
      const deck=decks[i];progress(job,i,decks.length,`Decks Archidekt · ${deck.name}`);
      try{
        const response=await bridgePost("/api/personal-deck-cards",{account:session.account,deck_id:deck.id,include_deleted:false});
        const cards=response.cards||[];
        disk.decks[String(deck.id)]={updatedAt:deck.updatedAt||null,size:Number.isFinite(Number(deck.size))?Number(deck.size):null,commander:deck.commander||deckCachedCommander(cards||[])||null,cards,savedAt:Date.now()};
        session.deckDetails?.delete(deck.id);
        session.healthCache?.delete(Number(deck.id));
        // Pull raw detail too; Size remains the Archidekt summary value.
        const detail=await fetchRawDeckDetail(session,deck.id);
        session.deckDetails?.set(deck.id,detail);
        deck.commander=detail.commander||deck.commander;
        const cacheEntry=disk.decks[String(deck.id)]||{};
        disk.decks[String(deck.id)]={...cacheEntry,size:detail.size,commander:deck.commander||cacheEntry.commander||null,savedAt:Date.now()};
      }catch(e){job.errors.push(`${deck.name}: ${String(e.message||e)}`)}
    }
    await saveDeckDiskCache(session);
    progress(job,decks.length,decks.length,`Decks actualizados · ${decks.length-job.errors.length}/${decks.length}`);
    return;
  }
  if(section==="usage"){await rebuildUsageFromDisk(session,job,{force:false});return}
  if(section==="scryfall"){
    const disk=await loadScryfallDiskCache();
    const collection=cache.collections.get(collectionCacheKeyFor(session))||[];
    const names=[...new Set([...Object.keys(disk.cards||{}),...collection.map(c=>c.name)])];
    progress(job,0,Math.ceil(names.length/75),`Scryfall · ${names.length} cartas a revisar`);
    await batchScryfallImages(names,{force:true,onProgress:p=>progress(job,p.current,p.total,p.message)});
    return;
  }
  if(section==="commanders"){
    await loadCommanderCatalog({force:true,onProgress:p=>progress(job,p.current,p.total,p.message)});
    progress(job,1,1,`Catálogo de Commanders · ${(commanderCatalogDiskCache?.cards||[]).length} cartas`);
    return;
  }
  if(section==="edhrec"){
    const disk=await loadEdhrecDiskCache(),entries=Object.values(disk.entries||{}),names=entries.map(x=>x.name).filter(Boolean);
    progress(job,0,names.length,`EDHREC · ${names.length} Commanders cacheados`);
    for(let i=0;i<names.length;i++){
      progress(job,i,names.length,`EDHREC · ${names[i]}`);
      try{await edhrec(names[i],{force:true})}catch(e){job.errors.push(`${names[i]}: ${String(e.message||e)}`)}
    }
    progress(job,names.length,names.length,`EDHREC actualizado · ${names.length-job.errors.length}/${names.length}`);
    return;
  }
  throw new Error("Sección de caché desconocida.");
}
function startCacheJob(session,section){
  const job=newJob("cache",section);
  (async()=>{
    try{
      const sections=section==="all"?["decks","usage","scryfall","commanders","edhrec"]:[section];
      for(let i=0;i<sections.length;i++){
        job.section=sections[i];job.message=`${i+1}/${sections.length} · ${sections[i]}`;
        await runCacheSection(session,sections[i],job);
      }
      job.status=job.errors.length?"done_with_errors":"done";
    }catch(e){job.status="error";job.errors.push(String(e.message||e));job.message=String(e.message||e)}
    finally{job.finishedAt=Date.now()}
  })();
  return job;
}
async function api(req,res,p){
  // Parse the request URL once for every API route. Several preview/catalog routes
  // read query parameters; keeping this at API scope prevents a route from
  // accidentally referencing an undefined `u` while routes with their own local
  // URL object may still shadow it safely.
  const u=new URL(req.url,`http://${req.headers.host}`);
  try{
    if(p==="/api/cache/status"&&req.method==="GET"){
      const session=getSession(req);if(!session)return send(res,401,{error:"Conectá una colección primero."});
      return send(res,200,await cacheStatus(session));
    }
    if(p==="/api/cache/delete"&&req.method==="POST"){
      const session=getSession(req);if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const {section=""}=await body(req);if(!["decks","usage","scryfall","commanders","edhrec","all"].includes(section))return send(res,400,{error:"Sección de caché inválida."});
      await deleteCacheSection(session,section);return send(res,200,{ok:true,status:await cacheStatus(session)});
    }
    if(p==="/api/cache/recache"&&req.method==="POST"){
      const session=getSession(req);if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const {section=""}=await body(req);
      if(!["decks","usage","scryfall","commanders","edhrec","all"].includes(section))return send(res,400,{error:"Sección de caché inválida."});
      const job=startCacheJob(session,section);return send(res,202,{job:publicJob(job)});
    }
    if(p==="/api/cache/job"&&req.method==="GET"){
      const u=new URL(req.url,`http://${req.headers.host}`),job=jobs.get(u.searchParams.get("id"));
      if(!job)return send(res,404,{error:"Trabajo no encontrado."});
      return send(res,200,{job:publicJob(job)});
    }
    if(p==="/api/login"&&req.method==="POST"){
      const {username="",password=""}=await body(req);
      if(!String(username).trim()||!String(password)) return send(res,400,{error:"Ingresá usuario y contraseña."});
      const connectStart=Date.now();
      const auth=await timed("login:bridge",()=>loginBridge(String(username).trim(),String(password)));
      const imported=await timed("login:collection-export",()=>collection(auth.collectionId,auth.account));
      console.log(`[timing] login:TOTAL (bridge+collection): ${Date.now()-connectStart}ms · ${imported.acceptedRows} filas`);
      const cards=imported.cards;
      const cacheKey=`collection:${auth.collectionId}`;
      cache.collections.set(cacheKey,cards);
      const sessionId=crypto.randomUUID();
      let decks;
      try{
        decks=await timed("login:decks-v3-updatedAt",()=>privateDecks(auth.account.username||String(username).trim(),auth.account.token));
        if(!decks.length)decks=normalizeDecksFromLogin(auth.raw);
      }catch(e){
        console.log(`[timing] login:decks-v3-updatedAt: FAILED, usando catálogo del login (${String(e.message||e)})`);
        decks=normalizeDecksFromLogin(auth.raw);
      }
      registerSession(sessionId,{
        account:auth.account,
        collectionId:auth.collectionId,
        collectionCacheKey:`collection:${auth.collectionId}`,
        username:auth.account.username||String(username).trim(),
        accessMode:"private",
        collectionStats:{
          archidektRecords:imported.totalRows,
          acceptedRows:imported.acceptedRows,
          uniqueCards:cards.length,
          totalCopies:cards.reduce((n,c)=>n+c.quantity,0)
        },
        decks,
        deckUsage:freshUsageState({decks}),
        deckSyncPromise:null,
        deckDetails:new Map()
      });
      startDeckUsageSync(sessions.get(sessionId));
      return send(res,200,{
        ok:true,
        sessionId,
        username:auth.account.username||String(username).trim(),
        collectionId:auth.collectionId,
        archidektRecords:imported.totalRows,
        fetchedPages:imported.fetchedPages,
        uniqueCards:cards.length,
        totalCopies:cards.reduce((n,c)=>n+c.quantity,0),
        totalDecks:decks.length,
        decks
      });
    }
    if(p==="/api/public-login"&&req.method==="POST"){
      const {username=""}=await body(req);
      const user=String(username).trim();
      if(!user)return send(res,400,{error:"Ingresá el usuario público de Archidekt."});
      const connectStart=Date.now();
      const imported=await timed("public-login:collection-export",()=>publicCollection(user));
      const collectionKey=`public:${user.toLocaleLowerCase("en-US")}`;
      cache.collections.set(collectionKey,imported.cards);
      const decks=await timed("public-login:decks-catalog",()=>publicDecks(user).catch(()=>[]));
      console.log(`[timing] public-login:TOTAL: ${Date.now()-connectStart}ms · ${imported.acceptedRows} filas · ${decks.length} mazos`);
      const sessionId=crypto.randomUUID();
      const session={
        account:null,collectionId:null,collectionCacheKey:collectionKey,username:user,accessMode:"public",
        collectionStats:{
          archidektRecords:imported.totalRows,
          acceptedRows:imported.acceptedRows,
          uniqueCards:imported.cards.length,
          totalCopies:imported.cards.reduce((n,c)=>n+c.quantity,0)
        },
        decks,deckUsage:null,deckSyncPromise:null,deckDetails:new Map()
      };
      session.deckUsage=freshUsageState(session);session.deckUsage.status="done";
      registerSession(sessionId,session);
      prefetchDeckSizes(session);
      return send(res,200,{
        ok:true,sessionId,username:user,accessMode:"public",
        archidektRecords:imported.totalRows,uniqueCards:imported.cards.length,
        totalCopies:imported.cards.reduce((n,c)=>n+c.quantity,0),totalDecks:decks.length,decks
      });
    }

    if(p==="/api/decks/sizes"&&req.method==="GET"){
      const session=getSession(req);if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const sizes={};
      for(const d of session.decks||[])if(d.exactMainCount!=null)sizes[d.id]=d.exactMainCount;
      return send(res,200,{sizes});
    }
    if(p==="/api/lab/deck-health"&&req.method==="POST"){
      const session=getSession(req);
      if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const {deckId,includeMetrics=false}=await body(req);
      const id=Number(deckId);
      if(!id)return send(res,400,{error:"Elegí un mazo."});
      try{return send(res,200,await buildDeckHealth(session,id,{includeDeckMetrics:Boolean(includeMetrics)}))}
      catch(e){return send(res,502,{error:"El LAB no pudo completar Deck Health.",detail:String(e.message||e)})}
    }

    if(p==="/api/deck-detail"&&req.method==="POST"){
      const session=getSession(req);
      if(!session) return send(res,401,{error:"Primero conectate con Archidekt."});
      const {deckId}=await body(req);
      const id=Number(deckId);
      if(!id) return send(res,400,{error:"deckId inválido."});
      if(!session.deckDetails) session.deckDetails=new Map();
      if(!session.deckDetails.has(id)){
        session.deckDetails.set(id,await fetchRawDeckDetail(session,id));
      }
      return send(res,200,session.deckDetails.get(id));
    }


    if(p==="/api/deck-catalog"&&req.method==="GET"){
      const session=getSession(req);
      if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const hydrateMissing=u.searchParams.get("hydrate")==="1";
      // The deck cache is useful for public sessions too: userCacheKey already falls back to
      // collectionId/username. This keeps Commander previews consistent in every mode.
      const disk=await loadDeckDiskCache(session);
      if(hydrateMissing){
        const missing=(session.decks||[]).filter(deck=>{
          const cached=disk.decks?.[String(deck.id)],cards=Array.isArray(cached?.cards)?cached.cards:null;
          return !String(deck.commander||cached?.commander||(cards?deckCachedCommander(cards):null)||"").trim();
        });
        let cursor=0,dirty=false;
        async function hydrateWorker(){
          while(cursor<missing.length){
            const deck=missing[cursor++];
            try{
              const preview=await resolveDeckPreview(session,deck.id);
              deck.commander=preview.commander||deck.commander||null;
              deck.commanderImage=preview.commanderImage||deck.commanderImage||null;
              deck.commanderImageLarge=preview.commanderImageLarge||deck.commanderImageLarge||null;
              deck.mainCount=preview.exactMainCount;deck.exactMainCount=preview.exactMainCount;
              dirty=true;
            }catch(e){console.warn(`[deck-catalog] preview metadata failed for ${deck.id}: ${String(e.message||e)}`)}
          }
        }
        await Promise.all(Array.from({length:Math.min(2,missing.length)},hydrateWorker));
        if(dirty)await saveDeckDiskCache(session);
      }
      const commanderNames=[];
      const rows=[];
      let missingMetadata=0;
      for(const deck of session.decks||[]){
        const cached=disk.decks?.[String(deck.id)],cards=Array.isArray(cached?.cards)?cached.cards:null;
        const commander=String(deck.commander||cached?.commander||(cards?deckCachedCommander(cards):null)||"").trim()||null;
        const exactMainCount=Number.isFinite(Number(deck.exactMainCount))?Number(deck.exactMainCount):Number.isFinite(Number(deck.mainCount))?Number(deck.mainCount):Number.isFinite(Number(cached?.size))?Number(cached.size):Number.isFinite(Number(deck.size))?Number(deck.size):null;
        if(commander){commanderNames.push(commander);deck.commander=commander;if(cached&&!cached.commander)cached.commander=commander}
        else missingMetadata++;
        rows.push({...deck,commander,mainCount:exactMainCount,exactMainCount,size:exactMainCount,previewMethod:cached?.previewMethod||deck.previewMethod||null});
      }
      const images=await batchScryfallImages(commanderNames);
      let missingImages=0;
      for(const d of rows)if(d.commander){
        const m=images.get(d.commander)||{};d.commanderImage=m.small||m.normal||m.large||null;d.commanderImageLarge=m.large||m.normal||m.small||null;
        if(!d.commanderImage&&hydrateMissing){
          try{const hit=await discoverCommanderExact(d.commander);d.commanderImage=hit?.image||null;d.commanderImageLarge=hit?.largeImage||hit?.image||null;}catch{}
        }
        if(!d.commanderImage)missingImages++;
      }
      return send(res,200,{decks:rows,missingMetadata,missingImages});
    }

    if(p==="/api/logout"&&req.method==="POST"){
      const sid=req.headers["x-manashelf-session"];
      if(sid)sessions.delete(String(sid));
      return send(res,200,{ok:true});
    }

    if(p==="/api/sync-status"&&req.method==="GET"){
      const session=getSession(req);
      if(!session) return send(res,401,{error:"Primero conectate con Archidekt."});
      const s=session.deckUsage||freshUsageState(session);
      return send(res,200,{
        status:s.status,
        totalDecks:s.totalDecks,
        completedDecks:s.completedDecks,
        failedDecks:s.failedDecks,
        cachedDecks:s.cachedDecks||0,
        fetchedDecks:s.fetchedDecks||0,
        errors:(s.errors||[]).map(e=>({deckId:e.deckId,deckName:e.deckName,error:e.error})),
        currentDeck:s.currentDeck,
        phase:s.phase||"idle",
        retryRound:s.retryRound||0,
        maxRetryRounds:s.maxRetryRounds||3,
        lastProgressAt:s.lastProgressAt||null,
        startedAt:s.startedAt,
        finishedAt:s.finishedAt
      });
    }

    if(p==="/api/sync-retry"&&req.method==="POST"){
      const session=getSession(req);
      if(!session)return send(res,401,{error:"Primero conectate con Archidekt."});
      const errors=session.deckUsage?.errors||[];
      const hasSpecificFailures=errors.some(e=>Number(e.deckId)>0);
      if(session.deckUsage?.failedDecks>0)startDeckUsageSync(session,{retryOnly:hasSpecificFailures});
      else startDeckUsageSync(session);
      const s=session.deckUsage;
      return send(res,200,{status:s.status,totalDecks:s.totalDecks,completedDecks:s.completedDecks,failedDecks:s.failedDecks});
    }

    if(p==="/api/decks/sync"&&req.method==="POST"){
      const session=getSession(req);
      if(!session) return send(res,401,{error:"Primero conectate con Archidekt."});
      startDeckUsageSync(session);
      const s=session.deckUsage;
      return send(res,200,{status:s.status,totalDecks:s.totalDecks,completedDecks:s.completedDecks});
    }
    if(p==="/api/commanders"&&req.method==="GET"){
      const u=new URL(req.url,`http://${req.headers.host}`);
      return send(res,200,{results:await commanderSearch(u.searchParams.get("q")||"")});
    }
    if(p==="/api/collection/lookup"&&req.method==="GET"){
      const session=getSession(req);if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const u=new URL(req.url,`http://${req.headers.host}`),name=String(u.searchParams.get("name")||"").trim(),cards=cache.collections.get(collectionCacheKeyFor(session))||[];
      const row=cards.find(c=>String(c.name||"").toLocaleLowerCase("en-US")===name.toLocaleLowerCase("en-US"));
      return send(res,200,{owned:Boolean(row),quantity:Number(row?.quantity||0)});
    }
    if(p==="/api/collection"&&req.method==="POST"){
      const {username=""}=await body(req); if(!String(username).trim())return send(res,400,{error:"Ingresá tu usuario de Archidekt."});
      const session=getSession(req); if(!session)return send(res,401,{error:"Primero conectate con Archidekt."});
      const {account,collectionId}=session;
      const k=collectionCacheKeyFor(session); let cards=cache.collections.get(k);
      if(!cards){
        const imported=session.account?await collection(collectionId,account):await publicCollection(session.username);
        cards=imported.cards;cache.collections.set(k,cards)
      }
      const stats=session.collectionStats||{
        archidektRecords:cards.length,
        acceptedRows:cards.length,
        uniqueCards:cards.length,
        totalCopies:cards.reduce((n,c)=>n+c.quantity,0)
      };
      return send(res,200,{...stats});
    }
    if(p==="/api/analyze"&&req.method==="POST"){
      const {username="",commander="",includeMissing=false}=await body(req);
      if(!String(commander).trim())return send(res,400,{error:"Falta el Commander."});
      const session=getSession(req); if(!session)return send(res,401,{error:"Conectá una colección de Archidekt primero."});
      const {account,collectionId}=session;
      const uk=collectionCacheKeyFor(session), ck=String(commander).trim().toLowerCase();
      let cards=cache.collections.get(uk);
      if(!cards){
        const imported=session.account?await collection(collectionId,account):await publicCollection(session.username);
        cards=imported.cards;cache.collections.set(uk,cards)
      }
      let lists=cache.edhrec.get(ck); if(!lists){lists=await edhrec(String(commander).trim());cache.edhrec.set(ck,lists)}
      const mine=new Map(cards.map(c=>[c.name.toLocaleLowerCase("en-US"),c]));
      const deckUsage=session.deckUsage||freshUsageState(session);
      startDeckUsageSync(session);

      const categories=lists.map(l=>({
        id:l.id,
        label:l.label,
        totalEdhrec:l.cards.length,
        matches:l.cards
          .filter(c=>includeMissing || mine.has(c.name.toLocaleLowerCase("en-US")))
          .map(c=>{
            const key=c.name.toLocaleLowerCase("en-US");
            const o=mine.get(key)||null;
            const usedInDecks=deckUsage.usage.get(key)||[];
            const usedQuantity=o ? usedInDecks.reduce((n,d)=>n+d.quantity,0) : 0;
            const availableQuantity=o ? Math.max(0,o.quantity-usedQuantity) : 0;
            return {
              ...c,
              owned:Boolean(o),
              ownedQuantity:o?.quantity||0,
              usedQuantity,
              availableQuantity,
              usedInDecks,
              image:c.image||o?.image||null,
              inclusionPct:c.potentialDecks?Math.round((c.numDecks/c.potentialDecks)*1000)/10:c.inclusion
            };
          })
      }));

      const imageNames=[];
      for(const cat of categories)for(const c of cat.matches)imageNames.push(c.name);
      const imageMap=await batchScryfallImages(imageNames);
      for(const cat of categories){
        for(const c of cat.matches){
          const img=imageMap.get(c.name);
          if(img){
            c.image=img.normal||img.small||c.image||null;
            c.imageNormal=img.normal||c.image||null;
            c.imageLarge=img.large||img.normal||c.image||null;
            c.typeLine=img.typeLine||c.typeLine||"";
            c.oracleText=img.oracleText||"";
            c.cmc=img.cmc||0;
            c.colorIdentity=img.colorIdentity||[];
            c.roles=classifyRoles(img);
          }else c.roles=["Utility"];
        }
      }
      // v2.4.12 — filtro por temáticas disponibles para el Commander, en Explorar y
      // EDHREComendaciones. Reusa exactamente el mismo mecanismo que ya usa Deck Health
      // (edhrecTags + edhrecTagEvidence), que hasta ahora solo corría en ese otro flujo.
      let commanderThemeTags=[];
      try{commanderThemeTags=await edhrecTags(String(commander).trim())}catch{ /* opcional: si falla, simplemente no hay filtro de temas */ }
      for(const cat of categories){
        for(const c of cat.matches){
          const cardMeta={typeLine:c.typeLine||"",oracleText:c.oracleText||""};
          c.themeTags=commanderThemeTags.filter(t=>edhrecTagEvidence(t.name,cardMeta)>0).map(t=>t.name);
        }
      }
      const uniqueRecommended=new Map();
      for(const cat of categories){
        for(const c of cat.matches){
          const key=c.name.toLocaleLowerCase("en-US");
          if(!uniqueRecommended.has(key)) uniqueRecommended.set(key,c);
        }
      }
      const uniqueCards=[...uniqueRecommended.values()];
      const ownedRecommended=uniqueCards.filter(c=>c.owned!==false && c.ownedQuantity>0);
      const summary={
        recommendedOwned:ownedRecommended.length,
        withFreeCopies:ownedRecommended.filter(c=>c.availableQuantity>0).length,
        usedInDecks:ownedRecommended.filter(c=>c.usedQuantity>0).length,
        noFreeCopies:ownedRecommended.filter(c=>c.availableQuantity<=0).length,
        missing:uniqueCards.filter(c=>c.owned===false || c.ownedQuantity===0).length
      };
      const roleCounts={};
      for(const c of uniqueCards)for(const role of (c.roles||[]))roleCounts[role]=(roleCounts[role]||0)+1;
      const themeCounts={};
      for(const c of uniqueCards)for(const t of (c.themeTags||[]))themeCounts[t]=(themeCounts[t]||0)+1;
      const commanderThemes=commanderThemeTags.map(t=>t.name).filter(n=>themeCounts[n]>0);
      return send(res,200,{
        commander:String(commander).trim(),
        commanderThemes,
        collection:{uniqueCards:cards.length,totalCopies:cards.reduce((n,c)=>n+c.quantity,0)},
        deckSync:{
          status:deckUsage.status,
          totalDecks:deckUsage.totalDecks,
          syncedDecks:deckUsage.completedDecks,
          failedDecks:deckUsage.failedDecks,
          cachedDecks:deckUsage.cachedDecks||0,
          fetchedDecks:deckUsage.fetchedDecks||0,
          currentDeck:deckUsage.currentDeck
        },
        summary,
        roleCounts,
        authenticated:Boolean(session.account),
        categories
      });
    }

let commanderCatalogDiskCache=null;

async function loadCommanderCatalog({force=false,onProgress=null}={}){
  const cacheFile=path.join(CACHE_DIR,"commander-catalog.json");
  if(commanderCatalogDiskCache===null){
    commanderCatalogDiskCache=await readJsonFile(cacheFile,{version:2,updatedAt:0,cards:[]});
  }
  const previous=Array.isArray(commanderCatalogDiskCache.cards)?commanderCatalogDiskCache.cards:[];
  // Normal use is offline-first: if a copied catalog exists, use it regardless of age.
  if(!force&&previous.length)return previous;

  const all=[];
  let url=`https://api.scryfall.com/cards/search?q=${encodeURIComponent("is:commander game:paper")}&unique=cards&order=edhrec&dir=asc`;
  let page=0;
  try{
    while(url && page<100){
      page++;
      onProgress?.({current:page-1,total:0,message:`Catálogo de Commanders · página ${page}`});
      const r=await scryfallRequest(url,{
        headers:{"Accept":"application/json;q=0.9,*/*;q=0.8","User-Agent":`ManaShelf/${APP_VERSION}`}
      },30000);
      if(r.status===404)break;
      if(!r.ok){
        const text=await r.text().catch(()=>"");
        throw new Error(`Scryfall HTTP ${r.status}${text?`: ${text.slice(0,120)}`:""}`);
      }
      const payload=await r.json();
      for(const c of (payload.data||[])){
        all.push({name:c.name,image:image(c),colorIdentity:c.color_identity||[],edhrecRank:c.edhrec_rank??null,oracleId:c.oracle_id||null});
      }
      url=payload.has_more&&payload.next_page?payload.next_page:null;
      onProgress?.({current:page,total:0,message:`Catálogo de Commanders · ${all.length} cartas`});
    }
    if(all.length){
      commanderCatalogDiskCache={version:2,updatedAt:Date.now(),cards:all};
      await writeJsonFile(cacheFile,commanderCatalogDiskCache);
      return all;
    }
  }catch(e){
    if(previous.length)return previous;
    throw e;
  }
  return previous;
}

async function commanderCandidatesFromOwnedMetadata(cards,onProgress=null){
  const names=[...new Set(cards.map(c=>String(c.name||"").trim()).filter(Boolean))];
  const meta=await batchScryfallImages(names,{onProgress});
  const out=[];
  for(const name of names){
    const m=meta.get(name);if(!m)continue;
    const tl=String(m.typeLine||"").toLowerCase();
    const legal=String(m.legalities?.commander||"")==="legal";
    const commanderType=(tl.includes("legendary")&&tl.includes("creature")) || tl.includes("background");
    if(legal&&commanderType)out.push({name,image:m.small||m.normal||null,colorIdentity:m.colorIdentity||[],edhrecRank:m.edhrecRank??null});
  }
  return out;
}
async function ownedCommanderCandidates(cards,onProgress=null){
  const owned=new Set(cards.map(c=>String(c.name||"").toLocaleLowerCase("en-US")).filter(Boolean));
  let catalog=[];
  try{catalog=await loadCommanderCatalog()}catch{}
  const hits=catalog.filter(c=>owned.has(String(c.name||"").toLocaleLowerCase("en-US")));
  if(hits.length)return hits;
  return commanderCandidatesFromOwnedMetadata(cards,onProgress);
}

async function commanderBuildability(session,name){
  const commanderName=String(name||"").trim();if(!commanderName)throw new Error("Falta el Commander.");
  const cards=cache.collections.get(collectionCacheKeyFor(session))||[];
  const mine=new Map(cards.map(c=>[String(c.name||"").toLocaleLowerCase("en-US"),c]));
  const usage=session.deckUsage?.usage||new Map(), commanderOwned=mine.has(commanderName.toLocaleLowerCase("en-US"));
  if(!commanderOwned)throw new Error("¿Qué Commander puedo armar? solo analiza criaturas legendarias que tenés en tu colección.");
  const ownMeta=await batchScryfallImages([commanderName]),cm=ownMeta.get(commanderName)||{};
  if(!(String(cm.typeLine||"").toLowerCase().includes("legendary")&&String(cm.typeLine||"").toLowerCase().includes("creature")))throw new Error("La carta elegida no es una criatura legendaria de tu colección.");
  const commanderKey=commanderName.toLocaleLowerCase("en-US");
  let lists=cache.edhrec.get(commanderKey);if(!lists){lists=await edhrec(commanderName);cache.edhrec.set(commanderKey,lists)}
  const rec=new Map();
  for(const l of lists)for(const c of l.cards){const k=c.name.toLocaleLowerCase("en-US");if(!rec.has(k)||c.synergy>rec.get(k).synergy)rec.set(k,c)}
  const vals=[...rec.values()];let owned=0,available=0,occupied=0,synergy=0;
  for(const c of vals){const k=c.name.toLocaleLowerCase("en-US"),o=mine.get(k);if(!o)continue;owned++;synergy+=Number(c.synergy||0);const used=(usage.get(k)||[]).reduce((n,d)=>n+Number(d.quantity||0),0);if(Number(o.quantity||0)-used>0)available++;else occupied++}
  const ownedSections=[];
  for(const l of lists){
    const seen=new Set(),sectionCards=[];
    for(const c of l.cards){
      const k=c.name.toLocaleLowerCase("en-US");if(seen.has(k))continue;seen.add(k);
      const o=mine.get(k);if(!o)continue;
      const usedInDecks=usage.get(k)||[],usedQty=usedInDecks.reduce((n,d)=>n+Number(d.quantity||0),0);
      sectionCards.push({name:c.name,ownedQuantity:Number(o.quantity||0),availableQuantity:Math.max(0,Number(o.quantity||0)-usedQty),synergy:Number(c.synergy||0),inclusionPct:c.potentialDecks?Math.round((c.numDecks/c.potentialDecks)*1000)/10:c.inclusion,usedInDecks});
    }
    if(sectionCards.length)ownedSections.push({id:l.id,label:l.label,cards:sectionCards.sort((a,b)=>b.synergy-a.synergy)});
  }
  const sectionNames=[...new Set(ownedSections.flatMap(s=>s.cards.map(c=>c.name)))];
  const sectionMeta=await batchScryfallImages(sectionNames);
  for(const section of ownedSections)for(const c of section.cards){
    const m=sectionMeta.get(c.name)||{};
    c.image=m.small||null;c.imageNormal=m.normal||m.large||null;c.typeLine=m.typeLine||"";c.cmc=Number(m.cmc||0);
  }
  const missing=Math.max(0,vals.length-owned),avg=owned?synergy/owned:0,coveragePct=vals.length?Math.round((owned/vals.length)*100):0,availablePct=vals.length?Math.round((available/vals.length)*100):0;
  return {name:commanderName,commanderOwned,recommendations:vals.length,owned,available,occupied,missing,coveragePct,availablePct,avgSynergy:avg,score:Math.round((owned*2+available*3+avg*100)*10)/10,ownedSections};
}


    const EDHREC_THEME_FALLBACK=`Tokens|+1/+1 Counters|Artifacts|Combo|Aggro|Spellslinger|Lifegain|Reanimator|Aristocrats|Control|Lands Matter|Burn|Ramp|Equipment|Enchantress|Voltron|Midrange|Mill|Treasure|cEDH|Sacrifice|Blink|Auras|Legends|Wheels|Discard|Graveyard|Clones|Flying|Card Draw|Landfall|Group Slug|Historic|Storm|Stax|Infect|Extra Combats|Self-Mill|Theft|Big Mana|Good Stuff|Group Hug|Chaos|Forced Combat|Planeswalkers|Birthing Pod|Vehicles|X Spells|Commander Matters|Toolbox|Exile|Lifedrain|Cascade|Cantrips|-1/-1 Counters|Pillow Fort|Hatebears|Tempo|Topdeck|Extra Turns|Toughness Matters|Stompy|Spell Copy|Dredge|ETB|Self-Damage|Energy|Populate|Proliferate|Ninjutsu|Land Destruction|Sagas|Attack Triggers|Affinity|Food|Monarch|Defenders|Clues|Morph|Cycling|Counterspells|Anthems|Deathtouch|Devotion|Pingers|Tap / Untap|Activated Abilities|Snow|Politics|Modified Creatures|Mutate|Unnatural|Unblockable|Dungeon|Prowess|Triggered Abilities|Ad Nauseam|Zoo|Discover|Fight|Flash|Flashback|Rat Colony|Donate|Self-Discard|Sea Creatures|Power|Eggs|Counters Matter|Aikido|Haste|Bounce|Prison|Party|Dragon's Approach|Multicolor Matters|Impulse Draw|Foretell|Keywords|Sunforger|Curses|Cheerios|Earthbending|Coin Flip|Modular|Scry|Guildgates|Rock|Shadowborn Apostles|Amass|Die Roll|Persistent Petitioners|Weenies|Madness|Tron|Convoke|Land Animation|The Ring|Fling|Attractions|Power Matters|Experience Counters|Polymorph|Primal Surge|Firebending|Surveil|Connive|Shrines|Sneak Attack|Glass Cannon|Outlaws|Rad Counters|Devoid|Charge Counters|Crime|Annihilator|Suspend|Blood|Explore|Myriad|Delver|Adventures|Time Counters|Deserts|Enrage|Relentless Rats|Hand Size|Extra Upkeeps|Looting|Lessons|Life Exchange|Slime Against Humanity|Airbending|Exalted|Indestructible|Hare Apparent|Rooms|Evoke|Waterbending|Vanilla|Freerunning|Creatureless|Blue Moon|Stoneblade|Landwalk|Mana Dorks|Villainous Choice|Transform|Speed|Voting|Delirium|Old School|LTB Effects|Turbo Fog|Offspring|Reach|Saboteurs|Color Hack|Spore Counters|Type Hack|Day / Night|Self-Destruct|Warp|Lure|Heroic|Mayhem|Plot|Sneak|Hellbent|Paradox|Battles|Banding|Descend|Phasing|Stun|Web-slinging|Rube Goldberg|Kicker|Turbo|Improvise|All Spells|Towns|Skulk|Tempest Hawk|Oil Counters|Stickers|Bobbleheads|Templar Knights|Mana Rocks|Summons|Craft|Incubate|Menace|Bloodthirst|Clash`.split("|").map(name=>({name,slug:slug(name)}));
    if(p==="/api/edhrec/tag-catalog"&&req.method==="GET"){
      return send(res,200,{tags:EDHREC_THEME_FALLBACK,source:"bundled-edhrec-tags"});
    }
    if(p==="/api/edhrec/tag-commanders"&&req.method==="POST"){
      const session=getSession(req);if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const {tags=[]}=await body(req),slugs=[...new Set((Array.isArray(tags)?tags:[]).map(x=>String(x).trim()).filter(Boolean))].slice(0,6);
      const cards=cache.collections.get(collectionCacheKeyFor(session))||[],owned=await ownedLegendaryCreatureCandidates(cards),ownedMap=new Map(owned.map(x=>[x.name.toLocaleLowerCase("en-US"),x]));
      if(!slugs.length)return send(res,200,{results:owned});
      let allowed=null;
      for(const tag of slugs){
        const r=await get(`https://json.edhrec.com/pages/tags/${encodeURIComponent(tag)}.json`);if(!r.ok)continue;
        const payload=await r.json(),root=payload?.container?.json_dict||payload?.json_dict||payload,lists=root?.cardlists||[],names=new Set();
        for(const l of lists){const label=String(l.tag||l.header||"").toLowerCase();if(!label.includes("commander"))continue;for(const c of (l.cardviews||l.cards||[]))if(c?.name)names.add(c.name.toLocaleLowerCase("en-US"))}
        allowed=allowed===null?names:new Set([...allowed].filter(x=>names.has(x)));
      }
      return send(res,200,{results:allowed===null?owned:owned.filter(x=>allowed.has(x.name.toLocaleLowerCase("en-US")))});
    }
    if(p==="/api/owned-commanders/start"&&req.method==="POST"){
      const session=getSession(req);if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const job=startOwnedCommandersJob(session);
      return send(res,202,{job:publicOwnedCommandersJob(job)});
    }
    if(p==="/api/owned-commanders/status"&&req.method==="GET"){
      const u=new URL(req.url,`http://${req.headers.host}`),job=jobs.get(u.searchParams.get("jobId"));
      if(!job||job.type!=="owned-commanders")return send(res,404,{error:"Carga de Commanders no encontrada."});
      return send(res,200,{job:publicOwnedCommandersJob(job)});
    }
    if(p==="/api/owned-commanders"&&req.method==="GET"){
      const session=getSession(req);if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const cards=cache.collections.get(collectionCacheKeyFor(session))||[];
      const results=await ownedLegendaryCreatureCandidates(cards);
      return send(res,200,{results:results.sort((a,b)=>a.name.localeCompare(b.name))});
    }
    if(p==="/api/compare-commanders"&&req.method==="POST"){
      const session=getSession(req);if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const {commanders=[]}=await body(req),names=[...new Set((Array.isArray(commanders)?commanders:[]).map(x=>String(x).trim()).filter(Boolean))];
      if(names.length<2||names.length>10)return send(res,400,{error:"Elegí entre 2 y 10 Commanders."});
      const cards=cache.collections.get(collectionCacheKeyFor(session))||[],owned=await ownedLegendaryCreatureCandidates(cards),allowed=new Map(owned.map(x=>[x.name.toLocaleLowerCase("en-US"),x]));
      if(names.some(n=>!allowed.has(n.toLocaleLowerCase("en-US"))))return send(res,400,{error:"Todos los Commanders deben ser criaturas legendarias Commander-legales de tu colección."});
      const results=[],failures=[];
      for(const name of names){try{const result=await commanderBuildability(session,name);results.push({...result,...allowed.get(name.toLocaleLowerCase("en-US"))})}catch(e){failures.push({name,error:String(e.message||e)})}}
      results.sort((a,b)=>b.owned-a.owned||b.available-a.available||b.coveragePct-a.coveragePct);
      return send(res,200,{results,failures});
    }
    if(p==="/api/alternatives"&&req.method==="POST"){
      const session=getSession(req);if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const {card=""}=await body(req),cards=cache.collections.get(collectionCacheKeyFor(session))||[],mine=new Map(cards.map(c=>[String(c.name||"").toLocaleLowerCase("en-US"),c]));
      const similar=await edhrecSimilar(card),usage=session.deckUsage?.usage||new Map();
      const owned=similar.filter(x=>mine.has(x.name.toLocaleLowerCase("en-US"))).map(x=>{const o=mine.get(x.name.toLocaleLowerCase("en-US")),used=(usage.get(x.name.toLocaleLowerCase("en-US"))||[]).reduce((n,d)=>n+Number(d.quantity||0),0);return {...x,ownedQuantity:Number(o.quantity||0),availableQuantity:Math.max(0,Number(o.quantity||0)-used)}}).filter(x=>x.availableQuantity>0);
      const meta=await batchScryfallImages(owned.map(x=>x.name));
      return send(res,200,{results:owned.slice(0,6).map(x=>{const m=meta.get(x.name)||{};return {...x,image:m.normal||m.small||null,typeLine:m.typeLine||"",cmc:Number(m.cmc||0)}})});
    }
    if(p==="/api/buildability"&&req.method==="POST"){
      const session=getSession(req);
      if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const {commander=""}=await body(req);
      try{
        const result=await commanderBuildability(session,commander);
        return send(res,200,{result});
      }catch(e){
        return send(res,502,{error:"No pude analizar ese Commander.",detail:String(e.message||e)});
      }
    }

    if(p==="/api/rank-commanders/start"&&req.method==="POST"){
      const session=getSession(req);if(!session)return send(res,401,{error:"Conectá una colección primero."});
      const job=startRankJob(session);return send(res,202,{job:publicRankJob(job)});
    }
    if(p==="/api/rank-commanders/status"&&req.method==="GET"){
      const u=new URL(req.url,`http://${req.headers.host}`),job=jobs.get(u.searchParams.get("jobId"));
      if(!job||job.type!=="rank")return send(res,404,{error:"Ranking no encontrado."});
      return send(res,200,{job:publicRankJob(job)});
    }

    if(p==="/api/rank-commanders"&&req.method==="POST"){
      const session=getSession(req);
      if(!session)return send(res,401,{error:"Conectá una colección primero."});

      const cards=cache.collections.get(collectionCacheKeyFor(session))||[];
      if(!cards.length)return send(res,400,{error:"La colección todavía no está cargada."});

      let candidates;
      try{
        candidates=await ownedCommanderCandidates(cards);
      }catch(e){
        return send(res,502,{
          error:"No pude identificar los Commanders de tu colección.",
          detail:String(e.message||e)
        });
      }

      const ranked=[];
      const failures=[];
      for(const candidate of candidates){
        try{
          const result=await commanderBuildability(session,candidate.name);
          ranked.push({
            ...result,
            image:candidate.image||null,
            colorIdentity:candidate.colorIdentity||[],
            edhrecRank:candidate.edhrecRank??null
          });
        }catch(e){
          failures.push({name:candidate.name,error:String(e.message||e)});
        }
      }

      ranked.sort((a,b)=>b.score-a.score || b.available-a.available || b.owned-a.owned);
      return send(res,200,{
        ranked,
        totalOwnedCommanders:candidates.length,
        failures,
        source:"archidekt-ownership+scryfall-commander-catalog+edhrec"
      });
    }

    if(p==="/api/archidekt/add-cards"&&req.method==="POST"){
      const session=getSession(req);if(!session?.account)return send(res,401,{error:"Esta acción requiere iniciar sesión en Archidekt."});
      const {deckId,names=[],confirm=""}=await body(req);
      if(confirm!=="CONFIRMAR")return send(res,400,{error:"Falta confirmación explícita."});
      const id=Number(deckId);if(!id||!Array.isArray(names)||!names.length)return send(res,400,{error:"Faltan deck y cartas."});
      const current=await bridgePost("/api/personal-deck-cards",{account:session.account,deck_id:id,include_deleted:false});
      const existing=new Set((current.cards||[]).map(c=>String(c.name||"").toLocaleLowerCase("en-US")));
      const wanted=[...new Set(names.map(n=>String(n).trim()).filter(Boolean))].filter(n=>!existing.has(n.toLocaleLowerCase("en-US")));
      if(!wanted.length)return send(res,200,{ok:true,affected:0,notes:["Todas las cartas ya estaban en el mazo."]});
      const lookup=await bridgePost("/api/cards/search",{filters:{exact_name:wanted,game:1,all_editions:false,page:1}},3);
      const refs=new Map();
      for(const r of (lookup.results||[])){
        const requested=String(r.requested_exact_name||r.name||"").toLocaleLowerCase("en-US");
        if(!refs.has(requested))refs.set(requested,r);
      }
      const mutations=[];
      const unresolved=[];
      for(const name of wanted){
        const ref=refs.get(name.toLocaleLowerCase("en-US"));
        if(!ref?.card_id){unresolved.push(name);continue}
        mutations.push({action:"add",card_id:Number(ref.card_id),categories:[],modifications:{quantity:1}});
      }
      if(!mutations.length)return send(res,400,{error:"No pude resolver IDs de cartas en Archidekt.",detail:unresolved.join(", ")});
      const result=await bridgePost("/api/personal-decks/modify-cards",{account:session.account,deck_id:id,cards:mutations},3);
      session.deckDetails?.delete(id);
      if(session.diskDeckCache?.decks)delete session.diskDeckCache.decks[String(id)];
      return send(res,200,{ok:true,affected:mutations.length,unresolved,result});
    }

    if(p==="/api/archidekt/create-deck"&&req.method==="POST"){
      const session=getSession(req);if(!session?.account)return send(res,401,{error:"Esta acción requiere iniciar sesión en Archidekt."});
      const {name="",commander="",cards=[],confirm=""}=await body(req);
      if(confirm!=="CONFIRMAR")return send(res,400,{error:"Falta confirmación explícita."});
      if(!String(name).trim()||!String(commander).trim())return send(res,400,{error:"Faltan nombre y Commander."});
      const created=await bridgePost("/api/personal-decks/create",{account:session.account,deck:{
        name:String(name).trim(),deck_format:3,private:false,unlisted:false,theorycrafted:false,game:1
      }},3);
      const deckId=Number(created.deck_id||created.deck?.id);
      if(!deckId)return send(res,502,{error:"Archidekt creó el mazo pero no devolvió deck_id."});
      const wanted=[...new Set([String(commander).trim(),...(cards||[]).map(String)].filter(Boolean))];
      const lookup=await bridgePost("/api/cards/search",{filters:{exact_name:wanted,game:1,all_editions:false,page:1}},3);
      const refs=new Map();
      for(const r of (lookup.results||[])){
        const requested=String(r.requested_exact_name||r.name||"").toLocaleLowerCase("en-US");
        if(!refs.has(requested))refs.set(requested,r);
      }
      const mutations=[];
      for(const cardName of wanted){
        const ref=refs.get(cardName.toLocaleLowerCase("en-US"));if(!ref?.card_id)continue;
        mutations.push({action:"add",card_id:Number(ref.card_id),
          categories:cardName.toLocaleLowerCase("en-US")===String(commander).trim().toLocaleLowerCase("en-US")?["Commander"]:[],
          modifications:{quantity:1}});
      }
      if(mutations.length)await bridgePost("/api/personal-decks/modify-cards",{account:session.account,deck_id:deckId,cards:mutations},3);
      return send(res,200,{ok:true,deckId,url:`https://archidekt.com/decks/${deckId}`,affected:mutations.length});
    }

    send(res,404,{error:"No encontrado"});
  }catch(e){
    if(e.code==="PAYLOAD_TOO_LARGE")return send(res,413,{error:e.message});
    if(e.code==="BAD_JSON")return send(res,400,{error:e.message});
    send(res,502,{error:"No pude completar la consulta.",detail:e.message})
  }
}

const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8"};
// v2.4.16 — P0 de seguridad confirmado por auditoría externa y verificado en vivo antes de
// corregir: path.join(PUBLIC_DIR, p) no evita que p contenga "..", así que un pedido como
// "/..%2Fserver.mjs" devolvía el código fuente del servidor (confirmado con curl: HTTP 200
// y el contenido real de server.mjs). Grave desde v2.4.13, que empezó a escuchar en 0.0.0.0
// para poder hostear en Render — deja de estar limitado a localhost. Corregido resolviendo
// la ruta final y rechazando cualquier resultado que caiga fuera de PUBLIC_DIR.
// v2.4.17 — limpieza periódica de sesiones inactivas (>24h sin actividad) y jobs terminados
// hace más de 1h. Corre cada 30 minutos; no bloquea nada, es solo higiene de memoria.
const SESSION_TTL_MS=24*60*60*1000;
const JOB_TTL_MS=60*60*1000;
setInterval(()=>{
  const now=Date.now();
  let removedSessions=0,removedJobs=0;
  for(const [id,session] of sessions){
    if(now-(session.lastSeen||0)>SESSION_TTL_MS){sessions.delete(id);removedSessions++}
  }
  for(const [id,job] of jobs){
    if(job.finishedAt && now-job.finishedAt>JOB_TTL_MS){jobs.delete(id);removedJobs++}
  }
  if(removedSessions||removedJobs)console.log(`[timing] limpieza periódica: ${removedSessions} sesiones inactivas, ${removedJobs} jobs viejos removidos`);
},30*60*1000);

// v2.4.17 — security headers básicos, a partir de la auditoría. CSP moderado: estricto en
// script-src (el mayor valor de defensa contra XSS, y bajo riesgo de romper algo, porque
// solo hay un <script> legítimo, /app.js) pero permisivo en estilos/imágenes/fuentes, que
// no pude verificar visualmente en un navegador real — preferí no arriesgar romper algo que
// no puedo comprobar (la app usa mucho style="" inline para colores dinámicos, y carga
// imágenes de Scryfall/EDHREC desde múltiples hosts).
const SECURITY_HEADERS={
  "X-Content-Type-Options":"nosniff",
  "X-Frame-Options":"DENY",
  "Referrer-Policy":"no-referrer",
  "Content-Security-Policy":[
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' https: data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'"
  ].join("; ")
};

const PUBLIC_ROOT=path.resolve(PUBLIC_DIR)+path.sep;
http.createServer(async(req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host}`),p=decodeURIComponent(u.pathname);
  if(p.startsWith("/api/"))return api(req,res,p);
  try{
    const f=path.resolve(PUBLIC_DIR,"."+(p==="/"?"/index.html":p));
    if(f!==path.resolve(PUBLIC_DIR,"index.html") && !f.startsWith(PUBLIC_ROOT)){res.writeHead(403,SECURITY_HEADERS);return res.end("Forbidden")}
    const data=await fs.readFile(f);
    res.writeHead(200,{"Content-Type":mime[path.extname(f)]||"application/octet-stream","Cache-Control":"no-cache",...SECURITY_HEADERS});res.end(data);
  }catch{res.writeHead(404,SECURITY_HEADERS);res.end("No encontrado")}
}).listen(PORT,"127.0.0.1",()=>console.log(`ManaShelf v${APP_VERSION} → http://127.0.0.1:${PORT}`));
