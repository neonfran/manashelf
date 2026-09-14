export const MANA_VIEW_VERSION=2;
const arr=x=>Array.isArray(x)?x:[];
const COLORS=["W","U","B","R","G","C"];

function parseSymbol(sym){
  const s=String(sym||"").replace(/[{}]/g,"").toUpperCase();
  if(!s)return null;
  if(/^\d+$/.test(s))return {kind:"generic",amount:Number(s),raw:s};
  if(s==="X")return {kind:"variable",raw:s};
  if(s.includes("/")){
    const parts=s.split("/");
    const colors=parts.filter(x=>COLORS.includes(x));
    const phyrexian=parts.includes("P"),genericAlternative=parts.find(x=>/^\d+$/.test(x));
    return {kind:"choice",colors,phyrexian,genericAlternative:genericAlternative?Number(genericAlternative):null,raw:s};
  }
  if(COLORS.includes(s))return {kind:"colored",colors:[s],raw:s};
  return {kind:"other",raw:s};
}
export function parseManaCost(cost=""){
  const symbols=[...String(cost||"").matchAll(/\{([^}]+)\}/g)].map(m=>parseSymbol(m[1])).filter(Boolean);
  const requiredColors={W:0,U:0,B:0,R:0,G:0,C:0};let generic=0,variable=false;
  for(const s of symbols){if(s.kind==="generic")generic+=s.amount;else if(s.kind==="colored"&&s.colors.length===1)requiredColors[s.colors[0]]++;else if(s.kind==="variable")variable=true;}
  return {raw:cost,symbols,requiredColors,generic,variable};
}
function face(card,id){return arr(card.faces).find(f=>f.id===id)||null;}
function sameAbility(card,cap,action){return arr(card.capabilities).filter(x=>x.id!==cap.id&&x.faceId===cap.faceId&&x.abilityId===cap.abilityId&&x.action===action);}
function trueLogic(x){return !x||x.op==="true";}
function sourceClass(card,cap,restrictions){
  const access=face(card,cap.faceId)?.access?.kind||"default",m=cap.details?.mana||{},activation=m.activationCost||{};
  if(access==="state_transition")return "state_dependent";
  if(m.requiresOtherPermanent||Number(activation.minimumMana||0)>0)return "dependent_filter";
  if(restrictions.length)return "restricted";
  if(m.isLand)return "land_unrestricted";
  if(m.structuralAcceleration)return "accelerator";
  return "mana_source";
}
function etbProfile(card,faceId){
  const taps=arr(card.capabilities).filter(c=>c.faceId===faceId&&["enters_tapped","enter_tapped"].includes(c.action)&&c.operator==="perform");
  if(!taps.length)return {mode:"untapped_by_default",conditions:[]};
  const unconditional=taps.some(c=>trueLogic(c.conditions));
  return {mode:unconditional?"always_tapped":"conditionally_tapped",conditions:taps.map(c=>c.conditions)};
}
function directSource(card,cap){
  const m=cap.details?.mana||{},restrictions=sameAbility(card,cap,"mana_restriction").map(x=>x.details?.manaRestriction).filter(Boolean),f=face(card,cap.faceId);
  return {capabilityId:cap.id,faceId:cap.faceId,access:f?.access?.kind||"default",sourceClass:sourceClass(card,cap,restrictions),colors:arr(m.colors),anyColor:Boolean(m.anyColor),commanderIdentity:Boolean(m.commanderIdentity),anyLandProduced:Boolean(m.anyLandProduced),chosenColor:Boolean(m.chosenColor),output:m.output??cap.magnitude?.manaOutput??null,activationNet:m.activationNet??cap.magnitude?.activationNet??null,tap:Boolean(m.tap),sacrifice:Boolean(m.sacrifice),requiresOtherPermanent:Boolean(m.requiresOtherPermanent),restrictions,etb:etbProfile(card,cap.faceId),requirements:cap.requirements,conditions:cap.conditions,coverage:cap.coverage,confidence:cap.confidence};
}
function proxySources(card){
  const out=[];for(const cap of arr(card.capabilities)){
    if(cap.action!=="search_library"||cap.operator!=="perform")continue;const q=cap.details?.searchConstraint;if(!q||q.destination!=="battlefield"||!arr(q.cardTypes).includes("Land"))continue;
    out.push({capabilityId:cap.id,kind:"land_search_proxy",subtypesAny:arr(q.subtypesAny),basic:q.basic,destinationTapped:Boolean(q.destinationTapped),quantity:q.quantity??1,costs:arr(cap.costs),requirements:cap.requirements,conditions:cap.conditions,coverage:cap.coverage,confidence:cap.confidence});
  }return out;
}
export function deriveManaView(card){
  const castFaces=[];for(const f of arr(card.faces)){
    const cast=arr(card.capabilities).find(c=>c.faceId===f.id&&c.action==="cast_face"&&c.operator==="perform");
    if(cast)castFaces.push({faceId:f.id,name:f.name,access:f.access?.kind||"default",manaValue:Number(f.manaValue||0),manaCost:parseManaCost(f.manaCost||""),requirements:cast.requirements,coverage:cast.coverage});
  }
  const landFaces=arr(card.capabilities).filter(c=>c.action==="play_as_land"&&c.operator==="perform").map(c=>({faceId:c.faceId,name:face(card,c.faceId)?.name||null,access:face(card,c.faceId)?.access?.kind||"default",etb:etbProfile(card,c.faceId)}));
  const sources=arr(card.capabilities).filter(c=>c.action==="add_mana"&&c.operator==="perform").map(c=>directSource(card,c));
  return {version:MANA_VIEW_VERSION,oracleId:card.oracleId,name:card.name,castFaces,landFaces,sources,proxySources:proxySources(card),isPlayableLand:landFaces.length>0};
}
