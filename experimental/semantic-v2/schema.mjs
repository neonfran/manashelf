export const SEMANTIC_V2_SCHEMA = "manashelf-semantic-card-v2";
export const SEMANTIC_V2_SCHEMA_VERSION = 2;
export const SEMANTIC_V2_COMPILER_VERSION = 5;

export const COVERAGE = Object.freeze({
  SUPPORTED:"supported",
  PARTIAL:"partial",
  GAP:"coverage_gap"
});

export const OPERATORS = new Set(["perform","prevent","prohibit","replace","modify","permit"]);
export const ACCESS_KINDS = new Set(["default","alternative_entry","state_transition","granted","conditional"]);
export const OPTION_POLICIES = new Set(["exclusive","combinable","repeatable","independent"]);
export const LOGIC_OPS = new Set(["predicate","and","or","not","at_least","at_most","exactly","true","false"]);
export const RELATION_TYPES = new Set(["replaces","result_of","requires_previous","sequence","state_transition","choice_contains","reference","grants","creates_with"]);

const isObj=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
const arr=x=>Array.isArray(x)?x:[];

export function predicate(kind, value=null, extra={}){
  return {op:"predicate",kind,value,...extra};
}
export const logicTrue=()=>({op:"true"});
export const logicFalse=()=>({op:"false"});
const isTrue=x=>x?.op==="true",isFalse=x=>x?.op==="false";
export function and(...args){const raw=args.flat().filter(Boolean);if(raw.some(isFalse))return logicFalse();const xs=raw.filter(x=>!isTrue(x));return xs.length===0?logicTrue():xs.length===1?xs[0]:{op:"and",args:xs};}
export function or(...args){const raw=args.flat().filter(Boolean);if(raw.some(isTrue))return logicTrue();const xs=raw.filter(x=>!isFalse(x));return xs.length===0?logicFalse():xs.length===1?xs[0]:{op:"or",args:xs};}
export function not(arg){if(isTrue(arg))return logicFalse();if(isFalse(arg))return logicTrue();return {op:"not",arg};}
export function cardinality(op,count,args){return {op,count,args:arr(args)};}

export function entityRef(kind, extra={}){
  return {kind,...extra};
}

export function amount(value=null, extra={}){
  return {kind:Number.isFinite(Number(value))?"fixed":"unknown",value:Number.isFinite(Number(value))?Number(value):null,...extra};
}

export function validateLogic(expr,path="expr",errors=[]){
  if(!expr)return errors;
  if(!isObj(expr)){errors.push(`${path}:not_object`);return errors;}
  if(!LOGIC_OPS.has(expr.op)){errors.push(`${path}.op:invalid`);return errors;}
  if(["and","or"].includes(expr.op))arr(expr.args).forEach((x,i)=>validateLogic(x,`${path}.args.${i}`,errors));
  if(expr.op==="not")validateLogic(expr.arg,`${path}.arg`,errors);
  if(["at_least","at_most","exactly"].includes(expr.op)){
    if(!Number.isFinite(Number(expr.count)))errors.push(`${path}.count:invalid`);
    arr(expr.args).forEach((x,i)=>validateLogic(x,`${path}.args.${i}`,errors));
  }
  if(expr.op==="predicate"&&!expr.kind)errors.push(`${path}.kind:missing`);
  return errors;
}

export function validateSemanticV2Card(card){
  const errors=[];
  if(!isObj(card))return ["record:not_object"];
  if(card.schema!==SEMANTIC_V2_SCHEMA)errors.push("schema:unexpected");
  if(card.schemaVersion!==SEMANTIC_V2_SCHEMA_VERSION)errors.push("schemaVersion:unexpected");
  if(card.compilerVersion!==SEMANTIC_V2_COMPILER_VERSION)errors.push("compilerVersion:unexpected");
  if(!card.oracleId)errors.push("oracleId:missing");
  if(!Array.isArray(card.faces)||!card.faces.length)errors.push("faces:missing");
  const faceIds=new Set();
  for(const [fi,face] of arr(card.faces).entries()){
    if(!face.id)errors.push(`faces.${fi}.id:missing`); else if(faceIds.has(face.id))errors.push(`faces.${fi}.id:duplicate`); else faceIds.add(face.id);
    if(!ACCESS_KINDS.has(face.access?.kind))errors.push(`faces.${fi}.access.kind:invalid`);
    validateLogic(face.access?.requirements,`faces.${fi}.access.requirements`,errors);
  }
  const capIds=new Set();
  for(const [ci,cap] of arr(card.capabilities).entries()){
    if(!cap.id)errors.push(`capabilities.${ci}.id:missing`); else if(capIds.has(cap.id))errors.push(`capabilities.${ci}.id:duplicate`); else capIds.add(cap.id);
    if(!OPERATORS.has(cap.operator))errors.push(`capabilities.${ci}.operator:invalid`);
    if(!cap.action)errors.push(`capabilities.${ci}.action:missing`);
    if(![COVERAGE.SUPPORTED,COVERAGE.PARTIAL,COVERAGE.GAP].includes(cap.coverage))errors.push(`capabilities.${ci}.coverage:invalid`);
    validateLogic(cap.requirements,`capabilities.${ci}.requirements`,errors);
    validateLogic(cap.conditions,`capabilities.${ci}.conditions`,errors);
  }
  for(const [gi,g] of arr(card.optionGroups).entries()){
    if(!g.id)errors.push(`optionGroups.${gi}.id:missing`);
    if(!OPTION_POLICIES.has(g.policy))errors.push(`optionGroups.${gi}.policy:invalid`);
    for(const id of arr(g.capabilityIds))if(!capIds.has(id))errors.push(`optionGroups.${gi}.capability:${id}:missing`);
  }
  for(const [ri,r] of arr(card.relations).entries()){
    if(!r.id)errors.push(`relations.${ri}.id:missing`);
    if(!RELATION_TYPES.has(r.type))errors.push(`relations.${ri}.type:invalid`);
    if(r.fromCapabilityId&&!capIds.has(r.fromCapabilityId))errors.push(`relations.${ri}.from:${r.fromCapabilityId}:missing`);
    if(r.toCapabilityId&&!capIds.has(r.toCapabilityId))errors.push(`relations.${ri}.to:${r.toCapabilityId}:missing`);
  }
  return errors;
}

export function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
