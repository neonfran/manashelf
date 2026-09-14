export const THEME_FEATURE_VIEW_VERSION=1;
const arr=x=>Array.isArray(x)?x:[];
const clamp01=x=>Math.max(0,Math.min(1,Number(x)||0));
const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
const refKind=x=>x?.kind?norm(x.kind):null;
const add=(map,key,value=1)=>{if(!key)return;const v=clamp01(value);if(v<=0)return;map.set(key,Math.max(Number(map.get(key)||0),v));};
const capWeight=cap=>{
  const coverage=cap?.coverage==="supported"?1:cap?.coverage==="partial"?.72:.35;
  return clamp01(Number(cap?.confidence??.5)*coverage);
};
const simpleObject=x=>{const n=norm(x);return n&&n.length<=48&&n.split("_").length<=4?n:null;};

/**
 * Generic, theme-agnostic semantic fingerprint.
 * No theme names or card names are encoded here.  The features describe only
 * structured semantics already emitted by Semantic v2.
 */
export function deriveThemeFeatures(card,{roles=null,dependency=null,theme=null}={}){
  const f=new Map();
  for(const row of arr(theme?.ranked))add(f,`facet:${row.facet}`,row.strength);
  for(const [role,row] of Object.entries(roles||{}))add(f,`role:${norm(role)}`,row?.potentialScore??row?.score??0);
  for(const kw of arr(card?.keywords))add(f,`keyword:${norm(kw)}`,1);
  for(const face of arr(card?.faces)){
    if(!["default","alternative_entry"].includes(face?.access?.kind||"default"))continue;
    for(const type of arr(face?.cardTypes))add(f,`type:${norm(type)}`,.9);
    for(const st of arr(face?.subtypes))add(f,`subtype:${norm(st)}`,.82);
  }
  for(const signal of arr(dependency?.produces))add(f,`produce:${norm(signal)}`,.78);
  for(const signal of arr(dependency?.externalNeeds))add(f,`need:${norm(signal)}`,.72);
  for(const cap of arr(card?.capabilities)){
    const w=capWeight(cap);if(w<=0)continue;
    const action=norm(cap?.action);if(action==="cast_face")continue;
    const operator=norm(cap?.operator),trigger=norm(cap?.trigger),target=refKind(cap?.target),beneficiary=refKind(cap?.beneficiary),actor=refKind(cap?.actor),object=simpleObject(cap?.object),polarity=norm(cap?.polarity),source=norm(cap?.zones?.source),destination=norm(cap?.zones?.destination);
    add(f,`action:${action}`,w);
    if(operator)add(f,`action_operator:${action}:${operator}`,w*.9);
    if(trigger)add(f,`action_trigger:${action}:${trigger}`,w*.92);
    if(target)add(f,`action_target:${action}:${target}`,w);
    if(beneficiary)add(f,`action_beneficiary:${action}:${beneficiary}`,w*.92);
    if(actor)add(f,`action_actor:${action}:${actor}`,w*.82);
    if(object)add(f,`action_object:${action}:${object}`,w*.86);
    if(polarity)add(f,`action_polarity:${action}:${polarity}`,w*.9);
    if(source)add(f,`zone_source:${source}`,w*.7);
    if(destination)add(f,`zone_destination:${destination}`,w*.7);
    if(source&&destination)add(f,`zone_move:${source}:${destination}`,w*.82);
    if(cap?.magnitude?.sweeperStrength)add(f,"shape:mass_effect",clamp01(Number(cap.magnitude.sweeperStrength)));
  }
  const features=Object.fromEntries([...f.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
  return {version:THEME_FEATURE_VIEW_VERSION,features,featureCount:Object.keys(features).length};
}
