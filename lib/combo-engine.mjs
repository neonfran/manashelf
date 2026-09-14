// ManaShelf LAB 2 — Commander Spellbook integration.
import { cardIdentityKey, getCardAlias, setCardAlias } from "./card-identity.mjs";

// External combo data is normalized here so the builder consumes a small, stable contract.
// Exact-card variants are intentionally preferred: template substitutions are not assumed
// until ManaShelf can prove a concrete replacement satisfies the upstream template.

export const COMBO_ENGINE_VERSION = 2;
export const SPELLBOOK_BASE_URL = "https://backend.commanderspellbook.com";

const key=cardIdentityKey;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));

export function normalizeComboPolicy(value){
  return ["off","synergistic","infinite"].includes(value)?value:"off";
}

export function spellbookCardQuery(commander,{infiniteOnly=false}={}){
  const safe=String(commander||"").replace(/"/g,"\\\"").trim();
  return [`card:"${safe}"`,`legal:commander`,...(infiniteOnly?[`result:infinite`]:[])].join(" ");
}
// Backwards-compatible export for older local callers. The old name used the wrong
// Spellbook semantic (commander: means the combo explicitly requires command-zone
// status), so it now intentionally delegates to card:.
export function spellbookCommanderQuery(commander,options={}){return spellbookCardQuery(commander,options)}

function firstArray(payload){
  if(Array.isArray(payload))return payload;
  if(!payload||typeof payload!=="object")return [];
  for(const k of ["results","items","data","variants"])if(Array.isArray(payload[k]))return payload[k];
  return [];
}

function featureName(x){return String(x?.feature?.name||x?.name||x?.feature_name||"").trim()}
function cardName(x){return String(x?.card?.name||x?.name||x?.card_name||"").trim()}

export function isInfiniteComboVariant(variant){
  const features=(variant?.produces||[]).map(featureName).filter(Boolean);
  const hay=features.join(" · ").toLowerCase();
  return /\binfinite\b/.test(hay)||/arbitrarily large|arbitrarily many|unbounded/.test(hay);
}

export function normalizeSpellbookVariant(raw,commanderName=""){
  if(!raw||typeof raw!=="object")return null;
  const uses=Array.isArray(raw.uses)?raw.uses:[],requires=Array.isArray(raw.requires)?raw.requires:[];
  const pieces=uses.map(u=>({
    name:cardName(u),
    quantity:Math.max(1,Number(u?.quantity||1)),
    mustBeCommander:Boolean(u?.must_be_commander??u?.mustBeCommander),
    zoneLocations:Array.isArray(u?.zoneLocations)?u.zoneLocations:Array.isArray(u?.zone_locations)?u.zone_locations:[]
  })).filter(x=>x.name);
  if(!pieces.length)return null;
  const produces=(Array.isArray(raw.produces)?raw.produces:[]).map(p=>({name:featureName(p),quantity:Number(p?.quantity||0)||null})).filter(x=>x.name);
  const legalities=raw.legalities&&typeof raw.legalities==="object"?raw.legalities:{};
  const commanderKey=key(commanderName),requiredCommanderPieces=pieces.filter(p=>p.mustBeCommander),commanderIncluded=pieces.some(p=>key(p.name)===commanderKey);
  const identityRaw=raw.identity??raw.color_identity??raw.colorIdentity??[];
  const identity=Array.isArray(identityRaw)?identityRaw.filter(Boolean):String(identityRaw||"").toUpperCase().split("").filter(c=>"WUBRG".includes(c));
  return {
    id:String(raw.id||raw.variant_id||""),
    status:String(raw.status||""),
    pieces,
    requiresTemplateCount:requires.length,
    hasTemplates:requires.length>0,
    commanderPieces:requiredCommanderPieces.map(p=>p.name),
    commanderIncluded,
    commanderRequired:requiredCommanderPieces.some(p=>key(p.name)===commanderKey),
    otherCommanderRequired:requiredCommanderPieces.some(p=>key(p.name)!==commanderKey),
    identity,
    manaNeeded:raw.manaNeeded??raw.mana_needed??null,
    manaValueNeeded:Number(raw.manaValueNeeded??raw.mana_value_needed??0)||null,
    easyPrerequisites:String(raw.easyPrerequisites??raw.easy_prerequisites??"").trim()||null,
    notablePrerequisites:String(raw.notablePrerequisites??raw.notable_prerequisites??"").trim()||null,
    description:String(raw.description||"").trim()||null,
    notes:String(raw.notes||"").trim()||null,
    popularity:Number(raw.popularity||0)||0,
    legalities,
    bracketTag:raw.bracketTag??raw.bracket_tag??null,
    produces,
    infinite:isInfiniteComboVariant({produces}),
    url:raw.id?`https://commanderspellbook.com/search/?q=${encodeURIComponent(`id:${raw.id}`)}`:null
  };
}

export function normalizeSpellbookResponse(payload,commanderName=""){
  return firstArray(payload).map(v=>normalizeSpellbookVariant(v,commanderName)).filter(Boolean);
}

export function normalizeFindMyCombosResponse(payload,commanderName=""){
  const normalizeList=value=>firstArray(value).map(x=>normalizeSpellbookVariant(x?.variant||x?.combo||x,commanderName)).filter(Boolean);
  return {
    included:normalizeList(payload?.included),
    almostIncluded:normalizeList(payload?.almostIncluded??payload?.almost_included),
    almostIncludedByAddingColors:normalizeList(payload?.almostIncludedByAddingColors??payload?.almost_included_by_adding_colors)
  };
}

function quantityAvailable(card,protect){
  if(!card)return 0;
  return Math.max(0,Number(protect?(card.availableQuantity??card.ownedQuantity??0):(card.ownedQuantity??card.quantity??0))||0);
}

// Rank only exact-card packages whose full contents can be proven available. The builder
// may add semantic/theme scoring on top, but availability/completeness is decided here.
export function availableComboPackages(variants,cards,{commander="",commanderColors=[],policy="off",protectExistingDecks=true,maxPieces=6}={}){
  policy=normalizeComboPolicy(policy);if(policy==="off")return [];
  const byName=new Map();for(const c of (cards||[]))setCardAlias(byName,c.name,c,{overwrite:false});const commanderKey=key(commander),allowed=new Set(commanderColors||[]),out=[];
  for(const v of variants||[]){
    if(!v||v.hasTemplates||!Array.isArray(v.pieces)||!v.pieces.length||v.pieces.length>maxPieces)continue;
    if(!v.commanderIncluded||v.otherCommanderRequired)continue;
    if((v.identity||[]).some(c=>allowed.size&&!allowed.has(c)))continue;
    if(v.legalities?.commander===false||v.legalities?.commander==="banned"||v.legalities?.commander==="illegal")continue;
    if(policy==="infinite"&&!v.infinite)continue;
    let complete=true,nonCommanderPieces=[];
    for(const p of v.pieces){
      if(p.mustBeCommander&&key(p.name)!==commanderKey){complete=false;break}
      if(key(p.name)===commanderKey)continue;
      const c=getCardAlias(byName,p.name);if(!c||quantityAvailable(c,protectExistingDecks)<p.quantity){complete=false;break}
      nonCommanderPieces.push({...p,card:c});
    }
    if(!complete||!nonCommanderPieces.length)continue;
    out.push({...v,nonCommanderPieces,completeAvailable:true});
  }
  return out;
}

export function comboAvailabilitySummary(variants,cards,{commander="",commanderColors=[],protectExistingDecks=true,maxPieces=6}={}){
  const commanderKey=key(commander),allowed=new Set(commanderColors||[]),all=variants||[];
  const compatible=all.filter(v=>v?.commanderIncluded&&!v?.otherCommanderRequired&&!(v?.identity||[]).some(c=>allowed.size&&!allowed.has(c))&&v?.legalities?.commander!==false&&v?.legalities?.commander!=="banned"&&v?.legalities?.commander!=="illegal");
  const exact=compatible.filter(v=>!v.hasTemplates&&Array.isArray(v.pieces)&&v.pieces.length>0&&v.pieces.length<=maxPieces&&!v.pieces.some(p=>p.mustBeCommander&&key(p.name)!==commanderKey));
  const complete=availableComboPackages(exact,cards,{commander,commanderColors,policy:"synergistic",protectExistingDecks,maxPieces});
  const infiniteComplete=complete.filter(v=>v.infinite);
  return {apiVariantsFetched:all.length,commanderCompatible:compatible.length,exactVariants:exact.length,collectionComplete:complete.length,infiniteComplete:infiniteComplete.length};
}

export function comboPackageBaseScore(pkg,{policy="synergistic"}={}){
  const pieceCount=Math.max(1,Number(pkg?.pieces?.length||0)),pop=Math.log10(1+Math.max(0,Number(pkg?.popularity||0)))/4;
  let score=.35+Math.max(0,.32-(pieceCount-2)*.075)+Math.min(.18,pop);
  if(pkg?.commanderIncluded)score+=.12;if(pkg?.infinite)score+=policy==="infinite"?.32:.12;
  if(pkg?.notablePrerequisites)score-=.05;if(pkg?.hasTemplates)score-=1;
  return clamp(score,0,1.4);
}
