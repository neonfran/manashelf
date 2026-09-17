import { ADJUDICATION, COVERAGE_STATUS, clamp01, uniq } from "./schema.mjs";
import { semanticFacts } from "./compiler.mjs";
import { evaluateRole } from "./role-contracts.mjs";

export const ARCHETYPE_CONTRACT_VERSION=4;
export const ARCHETYPE_CONTRACTS=["Spellslinger","Artifacts","Enchantments","Tokens","Reanimator","Aristocrats","Ramp","Lands","Equipment","Auras","Clones","Historic","Legends","Kindred"];
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const clauses=card=>semanticFacts(card,{includeEmbedded:false}).map(x=>x.fact);
const hasType=(card,type)=>(card.faces||[]).some(f=>(f.cardTypes||[]).some(x=>norm(x)===norm(type)));
const hasSubtype=(card,type)=>(card.faces||[]).some(f=>(f.subtypes||[]).some(x=>norm(x)===norm(type)));

function out(card,archetype,{score=0,evidence=[],negative=[],reason=null,gaps=[]}={}){
  const adjudication=evidence.length?ADJUDICATION.POSITIVE:negative.length?ADJUDICATION.EXPLICIT_NEGATIVE:ADJUDICATION.NO_EVIDENCE;
  const used=evidence.length?evidence:negative;
  const status=used.length?(used.some(x=>x.status===COVERAGE_STATUS.GAP)?COVERAGE_STATUS.GAP:used.some(x=>x.status===COVERAGE_STATUS.PARTIAL)?COVERAGE_STATUS.PARTIAL:COVERAGE_STATUS.SUPPORTED):(card.status===COVERAGE_STATUS.GAP?COVERAGE_STATUS.GAP:card.status===COVERAGE_STATUS.PARTIAL?COVERAGE_STATUS.PARTIAL:COVERAGE_STATUS.SUPPORTED);
  return {contract:"archetype",contractVersion:ARCHETYPE_CONTRACT_VERSION,archetype,status,adjudication,score:adjudication===ADJUDICATION.POSITIVE?clamp01(score):0,
    confidence:used.length?Math.min(...used.map(x=>Number(x.confidence||.5))):status===COVERAGE_STATUS.GAP?.2:.55,reason,
    dependencies:uniq(used.flatMap(x=>x.dependencies||[])),dependencyGroups:used.flatMap(x=>x.dependencyGroups||[]),
    evidence:used.map(x=>({action:x.action,rawText:x.rawText,actor:x.actor,spellScope:x.spellScope,costReductionScope:x.costReductionScope,dependencies:x.dependencies})),coverageGaps:uniq([...gaps,...(card.unsupportedPatterns||[])])};
}

function spellslinger(card){
  const cs=clauses(card),evidence=[],negative=[];let score=(hasType(card,"Instant")||hasType(card,"Sorcery"))?.38:0;
  for(const c of cs){
    const spellRelevant=["instant_sorcery","noncreature"].includes(c.spellScope)||c.dependencies?.includes("card:instant_sorcery");
    if(c.action==="copy_spell"&&spellRelevant){if(["you","source_controller"].includes(c.actor)){evidence.push(c);score=Math.max(score,.92);}else negative.push(c);}
    if(c.action==="reduce_cost"&&spellRelevant){evidence.push(c);score=Math.max(score,c.costReductionScope==="your_spells"?.9:.76);}
    if(["cast_from_zone","cast_referenced_cards"].includes(c.action)&&spellRelevant&&["you","source_controller"].includes(c.actor||"source_controller")){evidence.push(c);score=Math.max(score,.93);}
    if(c.trigger==="triggered"&&spellRelevant&&["draw","create_token","add_mana"].includes(c.action)){evidence.push(c);score=Math.max(score,.84);}
  }
  if(score>0 && !evidence.length){
    const synthetic={rawText:"card type is Instant/Sorcery",confidence:.99,dependencies:[],dependencyGroups:[],action:"card_type",actor:null,spellScope:"instant_sorcery",costReductionScope:null,status:COVERAGE_STATUS.SUPPORTED}; evidence.push(synthetic);
  }
  return out(card,"Spellslinger",{score,evidence,negative,reason:evidence.length?"semantic facts align with instant/sorcery spell flow":negative.length?"copy agency belongs to another player":null});
}

function simpleType(card,archetype,type){
  const evidence=[]; if(hasType(card,type))evidence.push({rawText:`card type ${type}`,confidence:.99,dependencies:[],dependencyGroups:[],action:"card_type",actor:null,spellScope:null,costReductionScope:null,status:COVERAGE_STATUS.SUPPORTED});
  return out(card,archetype,{score:evidence.length?.82:0,evidence,reason:evidence.length?`is ${type}`:null});
}
function supportType(card,archetype,type,dependency,spellScope){
  const evidence=[];let score=0;
  if(hasType(card,type)){evidence.push({rawText:`card type ${type}`,confidence:.99,dependencies:[],dependencyGroups:[],action:"card_type",actor:null,spellScope:null,costReductionScope:null,status:COVERAGE_STATUS.SUPPORTED});score=.82;}
  for(const c of clauses(card)){
    if((c.dependencies||[]).includes(dependency)||c.spellScope===spellScope){evidence.push(c);score=Math.max(score,.86);}
    if(type==="Artifact"&&c.action==="create_token"&&String(c.object||"").toLowerCase().includes("artifact")){evidence.push(c);score=Math.max(score,.82);}
  }
  return out(card,archetype,{score,evidence,reason:evidence.length?`is or semantically supports ${type}`:null});
}
function equipment(card){const evidence=[];if(hasSubtype(card,"Equipment"))evidence.push({rawText:"Equipment subtype",confidence:.99,dependencies:[],dependencyGroups:[],action:"subtype",status:COVERAGE_STATUS.SUPPORTED});return out(card,"Equipment",{score:evidence.length?1:0,evidence});}
function auras(card){const evidence=[];if(hasSubtype(card,"Aura"))evidence.push({rawText:"Aura subtype",confidence:.99,dependencies:[],dependencyGroups:[],action:"subtype",status:COVERAGE_STATUS.SUPPORTED});return out(card,"Auras",{score:evidence.length?1:0,evidence});}
function tokens(card){const evidence=clauses(card).filter(c=>(c.action==="create_token"&&c.beneficiary==="you")||(c.action==="multiply_tokens"&&["you",null].includes(c.beneficiary)));return out(card,"Tokens",{score:evidence.length?.9:0,evidence});}
function reanimator(card){const r=evaluateRole(card,"recursion");const evidence=r.adjudication===ADJUDICATION.POSITIVE?clauses(card).filter(c=>c.sourceZone==="graveyard"&&c.owner==="you"&&["hand","battlefield"].includes(c.destinationZone)):[];return out(card,"Reanimator",{score:evidence.length?.95:0,evidence,negative:r.adjudication===ADJUDICATION.EXPLICIT_NEGATIVE?clauses(card).filter(c=>c.sourceZone==="graveyard"&&c.owner==="you"):[]});}
function ramp(card){const r=evaluateRole(card,"ramp");const evidence=r.adjudication===ADJUDICATION.POSITIVE?clauses(card).filter(c=>["add_mana","put_land_battlefield","additional_land","reduce_cost"].includes(c.action)):[];const negative=r.adjudication===ADJUDICATION.EXPLICIT_NEGATIVE?clauses(card).filter(c=>["add_mana","reduce_cost"].includes(c.action)):[];return out(card,"Ramp",{score:r.score,evidence,negative,reason:r.reason});}
function lands(card){const evidence=[];if(hasType(card,"Land"))evidence.push({rawText:"card type Land",confidence:.99,dependencies:[],dependencyGroups:[],action:"card_type",status:COVERAGE_STATUS.SUPPORTED});evidence.push(...clauses(card).filter(c=>["additional_land","put_land_battlefield"].includes(c.action)));return out(card,"Lands",{score:evidence.length?.82:0,evidence});}
function clones(card){const evidence=clauses(card).filter(c=>c.action==="copy_permanent"&&c.beneficiary==="you");return out(card,"Clones",{score:evidence.length?.9:0,evidence,reason:evidence.length?"copies permanents/tokens":null});}
function historic(card){const evidence=[];const historic=(card.faces||[]).some(f=>(f.cardTypes||[]).includes("Artifact")||(f.cardTypes||[]).includes("Legendary")||(f.subtypes||[]).includes("Saga"));if(historic)evidence.push({rawText:"historic card characteristic",confidence:.95,dependencies:[],dependencyGroups:[],action:"characteristic",status:COVERAGE_STATUS.SUPPORTED});return out(card,"Historic",{score:evidence.length?.82:0,evidence});}
function legends(card){const evidence=[];if((card.faces||[]).some(f=>(f.cardTypes||[]).includes("Legendary"))||(card.faces||[]).some(f=>/^Legendary\b/.test(f.typeLine)))evidence.push({rawText:"Legendary supertype",confidence:.99,dependencies:[],dependencyGroups:[],action:"supertype",status:COVERAGE_STATUS.SUPPORTED});return out(card,"Legends",{score:evidence.length?.85:0,evidence});}

function aristocrats(card){
  const cs=clauses(card),evidence=[];let score=0;
  for(const c of cs){
    const deathDep=(c.dependencies||[]).includes("event:creature_death");
    const sacrifice=Boolean(c.activationCost?.sacrifice)||c.action==="sacrifice";
    if(deathDep){evidence.push(c);score=Math.max(score,.92);}
    if(sacrifice){evidence.push(c);score=Math.max(score,.88);}
    if(c.action==="create_token"&&c.beneficiary==="you"){evidence.push(c);score=Math.max(score,.58);}
  }
  return out(card,"Aristocrats",{score,evidence,reason:evidence.length?"death/sacrifice/token semantics support an aristocrats engine":null});
}

function singular(s){const x=norm(s);return x.endsWith("ies")?x.slice(0,-3)+"y":x.endsWith("ses")?x.slice(0,-2):x.endsWith("s")?x.slice(0,-1):x;}
function kindred(card,archetype){
  const tokens=norm(archetype).split(/\s+/).filter(x=>x&&!['kindred','tribal','creature','creatures','theme'].includes(x));
  const wanted=new Set(tokens.flatMap(x=>[x,singular(x)]));
  const evidence=[];let score=0;
  for(const face of card.faces||[])for(const st of face.subtypes||[]){if(wanted.has(norm(st))||wanted.has(singular(st))){evidence.push({rawText:`subtype ${st}`,confidence:.99,dependencies:[],dependencyGroups:[],action:"subtype",status:COVERAGE_STATUS.SUPPORTED});score=Math.max(score,.9);}}
  for(const c of clauses(card)){
    const deps=c.dependencies||[];
    if(deps.some(d=>String(d).startsWith("subtype:")&&wanted.has(singular(String(d).slice(8))))){evidence.push(c);score=Math.max(score,.94);}
  }
  return out(card,"Kindred",{score,evidence,reason:evidence.length?"card subtype or semantic dependency matches the chosen kindred type":null,gaps:wanted.size?[]:[`KINDRED_TYPE_UNRESOLVED:${archetype}`]});
}

export function evaluateArchetype(card,archetype){
  const a=norm(archetype);
  if(/spell|instant|sorcery/.test(a))return spellslinger(card);
  if(a==="artifacts"||a==="artifact")return supportType(card,"Artifacts","Artifact","permanent:artifact","artifact");
  if(a==="enchantments"||a==="enchantment")return supportType(card,"Enchantments","Enchantment","permanent:enchantment","enchantment");
  if(/token/.test(a))return tokens(card);
  if(/reanim/.test(a))return reanimator(card);
  if(/aristocrat|sacrifice|death/.test(a))return aristocrats(card);
  if(/kindred|tribal/.test(a))return kindred(card,archetype);
  if(a==="ramp")return ramp(card);
  if(/lands?/.test(a))return lands(card);
  if(/equipment/.test(a))return equipment(card);
  if(/aura/.test(a))return auras(card);
  if(/clone|copy/.test(a))return clones(card);
  if(/historic/.test(a))return historic(card);
  if(/legend/.test(a))return legends(card);
  const subtypeTokens=new Set((card.faces||[]).flatMap(f=>f.subtypes||[]).map(x=>singular(x)));
  if([...subtypeTokens].some(st=>a.split(/\s+/).some(tok=>singular(tok)===st)))return kindred(card,archetype);
  return {contract:"archetype",contractVersion:ARCHETYPE_CONTRACT_VERSION,archetype,status:COVERAGE_STATUS.GAP,adjudication:ADJUDICATION.NO_EVIDENCE,score:0,confidence:0,reason:"unsupported archetype contract",dependencies:[],dependencyGroups:[],evidence:[],coverageGaps:[`ARCHETYPE_CONTRACT_UNSUPPORTED:${archetype}`]};
}

export function evaluateAllArchetypes(card,names=ARCHETYPE_CONTRACTS){return Object.fromEntries(names.map(name=>[name,evaluateArchetype(card,name)]));}
