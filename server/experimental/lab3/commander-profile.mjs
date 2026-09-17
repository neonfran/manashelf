import { cardNameMatches } from "../../lib/card-identity.mjs";
import { decorateEdhrecThemesForLab3, themeModeForCard } from "./deck-context.mjs";

export const LAB3_COMMANDER_PROFILE_VERSION=1;

const slug=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export function runtimeTypeLine(card){return (card?.faces||[]).map(f=>f.typeLine).filter(Boolean).join(" // ")}
export function runtimeManaCost(card){return (card?.faces||[]).map(f=>f.manaCost).filter(Boolean).join(" // ")}
export function runtimeManaValue(card){return Math.max(0,...(card?.faces||[]).map(f=>Number(f.manaValue||0)))}
export function isLegendaryCreature(card){const line=runtimeTypeLine(card);return /legendary/i.test(line)&&/creature/i.test(line)}
export function localThemes(card){
  const out=[];
  for(const [name,r] of Object.entries(card?.archetypes||{}))if(r?.adjudication==="positive"&&Number(r.score||0)>=.45)out.push({name,slug:slug(name),count:0,localSemantic:true,score:Number(r.score||0)});
  const common=new Set(["human","wizard","warrior","soldier","rogue","cleric","shaman","advisor"]),subs=[...new Set((card?.faces||[]).flatMap(f=>f.subtypes||[]))];
  for(const st of subs)if(st&&!common.has(String(st).toLowerCase()))out.push({name:`${st} Kindred`,slug:slug(`${st} Kindred`),count:0,localSemantic:true,score:.65});
  return [...new Map(out.sort((a,b)=>(b.score||0)-(a.score||0)).map(x=>[x.name.toLowerCase(),x])).values()].slice(0,10);
}

export async function prepareLab3CommanderProfile({catalog,commander,ownedCards=[],getTags=async()=>[],getPreview=async()=>({}),onProgress=()=>{}}={}){
  if(!catalog||typeof catalog.get!=="function")throw new Error("LAB3 runtime catalog is required.");
  const started=performance.now(),name=String(commander||"").trim();if(!name)throw new Error("Elegí una criatura legendaria.");
  onProgress("profile_semantic","Validando Commander en Semantic DB…",{commander:name});
  const semanticStarted=performance.now(),semantic=await catalog.get(name),semanticMs=Math.round(performance.now()-semanticStarted);if(!semantic)throw new Error("Ese Commander no está en el índice semántico de LAB 3.");
  if(semantic.status==="coverage_gap")throw new Error("LAB 3 todavía no tiene cobertura semántica suficiente para ese Commander.");
  if(!isLegendaryCreature(semantic))throw new Error("La carta elegida no es una criatura legendaria.");
  if(semantic.legalities?.commander!=="legal")throw new Error("La carta elegida no es legal como Commander.");
  onProgress("profile_themes","Commander validado · cargando themes…",{commander:name,semanticMs});
  const externalStarted=performance.now(),[tagsRaw,previewRaw]=await Promise.all([Promise.resolve().then(()=>getTags(name)).catch(()=>[]),Promise.resolve().then(()=>getPreview(name)).catch(()=>({}))]),externalMs=Math.round(performance.now()-externalStarted),tags=Array.isArray(tagsRaw)?tagsRaw:[],preview=previewRaw&&typeof previewRaw==="object"?previewRaw:{},owned=(ownedCards||[]).find(c=>cardNameMatches(c?.name,name));
  const local=localThemes(semantic),fallback={name:"Balanced / Good Stuff",slug:"balanced-good-stuff",count:0,fallback:true,semanticSupported:true,semanticContractKey:"Balanced",mode:"semantic",themeContractMode:"semantic",themeSource:"structural-fallback"};
  const edhrecThemes=decorateEdhrecThemesForLab3(semantic,tags,{limit:18}).map(t=>({...t,themeContractMode:t.mode}));
  const localThemesDecorated=local.map(t=>({...t,semanticSupported:true,semanticContractKey:themeModeForCard(semantic,t.name).semanticContractKey,mode:"semantic",themeContractMode:"semantic",themeSource:"semantic-local"}));
  const themes=edhrecThemes.length?edhrecThemes:[...new Map([...localThemesDecorated,fallback].map(t=>[String(t.name||"").toLowerCase(),t])).values()].slice(0,18);
  const externalFallbackCount=edhrecThemes.filter(t=>t.themeContractMode==="external_fallback").length,totalMs=Math.round(performance.now()-started);onProgress("done",`Commander listo · ${themes.length} themes · ${(totalMs/1000).toFixed(1)}s`,{commander:name,semanticMs,externalMs,totalMs});
  return {commander:{name:semantic.name,typeLine:runtimeTypeLine(semantic),manaCost:runtimeManaCost(semantic),cmc:runtimeManaValue(semantic),colorIdentity:semantic.colorIdentity||[],image:preview.normal||preview.image||null,imageLarge:preview.large||preview.normal||null,ownedQuantity:Number(owned?.quantity||0),semanticStatus:semantic.status},themes,themeFilter:{edhrecTotal:tags.length,edhrecShown:edhrecThemes.length,semanticContracts:edhrecThemes.length-externalFallbackCount,externalFallback:externalFallbackCount,unsupportedOmitted:0},runtime:await catalog.status(),timing:{semanticMs,externalMs,totalMs}};
}
