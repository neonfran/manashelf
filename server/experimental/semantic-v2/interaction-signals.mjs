export const INTERACTION_SIGNAL_VERSION=2;
const arr=x=>Array.isArray(x)?x:[];
const uniq=x=>[...new Set(arr(x).filter(Boolean))];
const PERMANENT_TYPES=new Set(["Creature","Artifact","Enchantment","Planeswalker","Battle","Land"]);
const typeSignal=x=>String(x||"").toLowerCase().replace(/\s+/g,"_");

export function predicateSignal(p){
  const v=p.value;
  switch(p.kind){
    case "zone_requirement": return `zone:${typeof v==="string"?v:JSON.stringify(v)}`;
    case "controls_permanent": return `permanent:${typeof v==="string"?typeSignal(v):typeSignal(v?.type||"any")}`;
    case "controlled_permanent": {
      if(v?.token===true)return "permanent:token";
      if(v?.excludedCardType==="Land"&&v?.token===false)return "permanent:nonland_nontoken";
      if(v?.basic&&v?.cardType==="Land")return "permanent:basic_land";
      if(v?.supertype&&!v?.subtype&&!v?.cardType)return `permanent:supertype:${typeSignal(v.supertype)}`;
      if(v?.keyword)return `permanent:keyword:${typeSignal(v.keyword)}`;
      if(v?.legendary&&v?.cardType)return `permanent:legendary_${typeSignal(v.cardType)}`;
      if(v?.subtype)return `permanent:subtype:${typeSignal(v.subtype)}`;
      if(v?.cardType&&v.cardType!=="Permanent")return `permanent:${typeSignal(v.cardType)}`;
      if(v?.colorDiversity)return "state:permanent_color_diversity";
      return "permanent:any";
    }
    case "card_characteristic": {
      if(typeof v!=="string")return `card:${JSON.stringify(v)}`;
      const raw=String(v).toLowerCase().trim();
      if(raw.startsWith("subtype:"))return `card:subtype:${typeSignal(raw.slice("subtype:".length))}`;
      if(["creature","artifact","enchantment","land","planeswalker","instant","sorcery","battle","kindred"].includes(raw))return `card:type:${typeSignal(raw)}`;
      if(raw==="instant_sorcery")return "card:instant_sorcery";
      if(raw==="artifact_creature")return "card:artifact_creature";
      if(raw==="permanent")return "card:permanent";
      if(raw==="noncreature_nonland")return "card:noncreature_nonland";
      return `card:${typeSignal(raw)}`;
    }
    case "event_occurred": return `event:${typeof v==="string"?typeSignal(v):JSON.stringify(v)}`;
    case "commander_state": return `commander:${typeof v==="string"?typeSignal(v):JSON.stringify(v)}`;
    case "available_counter_pool": return `counter_pool:${typeSignal(v?.counter||"any")}`;
    case "source_counter_count": return `source_counter:${typeSignal(v?.counter||"any")}`;
    case "replacement_event_available": return `event:${typeSignal(v?.event||"replacement")}`;
    case "outlaw_permanent": return "package:outlaw";
    case "historic_permanent": return "package:historic";
    case "familiar_permanent": return "package:familiar";
    case "named_permanent": return `permanent:name:${typeSignal(v?.name||"unknown")}`;
    case "decorated_permanent": return "condition:decorated_permanent";
    case "permanent_color_coverage": return "state:permanent_color_coverage";
    case "controlled_count_limit": return "state:controlled_count_limit";
    case "board_state_requirement": return "state:board_requirement";
    case "opponent_count": return "environment:opponents";
    case "zone_card_count": return v?.zone==="graveyard"?"zone:your_graveyard":`state:zone_count:${typeSignal(v?.zone||"zone")}`;
    case "zone_card_type_diversity": return v?.zone==="graveyard"?"zone:your_graveyard:card_type_diversity":`state:zone_card_type_diversity:${typeSignal(v?.zone||"zone")}`;
    case "zone_mana_value_diversity": return v?.zone==="graveyard"?"zone:your_graveyard:mana_value_diversity":`state:zone_mana_value_diversity:${typeSignal(v?.zone||"zone")}`;
    case "basic_land_type_diversity": return "permanent:basic_land_type_diversity";
    case "shared_creature_type": return "package:shared_creature_type";
    case "state_transition_required": return `state:${typeof v==="string"?typeSignal(v):JSON.stringify(v)}`;
    case "granted_capability_active": return `capability:${v?.viaCapabilityId||"granted"}`;
    case "distinct_names": return "constraint:distinct_names";
    case "variable_value": return `internal:variable:${typeSignal(v?.variable||"value")}`;
    case "tiered_option_selected": return "internal:tiered_option";
    case "die_result": case "die_result_range": return "internal:die_result";
    case "alternate_cost_paid": return "internal:alternate_cost_paid";
    case "source_state": return `state:source:${typeSignal(typeof v==="string"?v:"state")}`;
    case "life_total_comparison": return "state:life_total";
    case "target_characteristic": return "environment:target_characteristic";
    case "unless_payment": return "environment:opponent_payment";
    case "mana_spent_condition": return "internal:mana_spent";
    case "trigger_event": return "internal:trigger_event";
    case "condition": return "internal:condition_context";
    case "craft_material": {
      const raw=typeSignal(v?.raw||v||"material");
      if(raw.includes("artifact"))return "card:type:artifact";
      if(raw.includes("creature"))return "card:type:creature";
      return `card:craft_material:${raw}`;
    }
    case "case_solve": return "state:case_progress";
    case "loss_condition": case "win_condition": return "state:game_condition";
    case "raw_condition": return "condition:unresolved";
    default:return `predicate:${p.kind}`;
  }
}
export function predicateDependencyClass(p){
  const v=p?.value;
  switch(p?.kind){
    case "zone_requirement": {
      const z=typeof v==="string"?v:String(v?.zone||"");
      return /opponent|their_graveyard/.test(z)?"environment":"package";
    }
    case "event_occurred": return v==="opponent_action"?"environment":"package";
    case "controlled_permanent": {
      if(v?.colorDiversity)return "state";
      if((v?.color||v?.colorless||v?.multicolored)&&!v?.cardType&&!v?.subtype&&!v?.token)return "state";
      if(["tapped","untapped","attacking","modified","equipped","enchanted","goaded","transformed","stickered","faceDown"].some(k=>v?.[k]))return "state";
      return "package";
    }
    case "controls_permanent": case "card_characteristic": case "commander_state": case "available_counter_pool": case "replacement_event_available": case "craft_material": return "package";
    case "outlaw_permanent": case "historic_permanent": case "familiar_permanent": case "named_permanent": return "package";
    case "decorated_permanent": return "unresolved";
    case "permanent_color_coverage": case "controlled_count_limit": return "state";
    case "board_state_requirement": return "state";
    case "opponent_count": case "target_characteristic": case "unless_payment": return "environment";
    case "zone_card_count": return p?.value?.zone==="graveyard"?"package":"state";
    case "zone_card_type_diversity": case "zone_mana_value_diversity": return p?.value?.zone==="graveyard"?"package":"state";
    case "basic_land_type_diversity": case "shared_creature_type": return "package";
    case "source_counter_count": case "state_transition_required": case "source_state": case "life_total_comparison": case "case_solve": case "loss_condition": case "win_condition": return "state";
    case "raw_condition": return "unresolved";
    case "distinct_names": return "constraint";
    case "granted_capability_active": case "variable_value": case "tiered_option_selected": case "die_result": case "die_result_range": case "alternate_cost_paid": case "trigger_event": case "condition": case "mana_spent_condition": return "internal";
    default:return "unclassified";
  }
}
function needAtoms(expr,{count=null,negated=false,logic="and",path="0"}={},out=[]){
  if(!expr||typeof expr!=="object"||expr.op==="true")return out;
  if(expr.op==="false"){out.push({signal:"logic:false",count,negated,logic,path});return out;}
  if(expr.op==="predicate"){out.push({signal:predicateSignal(expr),dependencyClass:predicateDependencyClass(expr),predicate:expr,count,negated,logic,path});return out;}
  if(expr.op==="not")return needAtoms(expr.arg,{count,negated:!negated,logic,path:`${path}.0`},out);
  const nextCount=["at_least","at_most","exactly"].includes(expr.op)?Number(expr.count):count,nextLogic=expr.op==="or"?"or":logic;
  arr(expr.args).forEach((x,i)=>needAtoms(x,{count:nextCount,negated,logic:nextLogic,path:`${path}.${i}`},out));return out;
}
function capProduced(cap){
  const out=[];for(const r of arr(cap.resources))if(r.direction==="produce")out.push(`resource:${r.resource}`);else if(r.direction==="move"&&r.to)out.push(`zone:${r.to}`);
  const map={create_token:["event:token_created","permanent:token"],sacrifice:["event:sacrifice","event:creature_death"],discard:["event:discard"],gain_life:["event:life_gain"],lose_life:["event:life_loss"],deal_damage:["event:damage"],mill:["event:mill","zone:graveyard"],add_counter:["event:counter_added"],modify_counter:["event:counter_changed"],draw:["event:draw"],cast_spell:["event:spell_cast"],copy_spell:["event:spell_copy"],copy:["event:copy"],put_land_battlefield:["permanent:land","event:land_enter"],additional_land:["resource:land_play"]};
  if(cap.operator==="perform")out.push(...(map[cap.action]||[]));
  if(cap.operator==="perform"&&cap.action==="create_token"){
    if(cap.details?.tokenName)out.push(`permanent:name:${typeSignal(cap.details.tokenName)}`);
    for(const t of arr(cap.details?.tokenCardTypes))out.push(`permanent:${typeSignal(t)}`);
    for(const st of arr(cap.details?.tokenSubtypes))out.push(`permanent:subtype:${typeSignal(st)}`);
  }
  return out;
}
function costNeeds(cap){const out=[];for(const c of arr(cap.costs))if(c.from?.kind==="controlled_permanent"){const types=arr(c.filter?.cardTypes);if(types.length)for(const t of types)out.push({signal:`permanent:${typeSignal(t)}`,count:typeof c.amount==="number"?c.amount:null,source:"cost"});else out.push({signal:"permanent:any",count:typeof c.amount==="number"?c.amount:null,source:"cost"});}return out;}
export function deriveInteractionSignals(card){
  const produces=[],needs=[],environmentNeeds=[],stateNeeds=[],internalConstraints=[],unresolvedConditions=[],capabilities=[];
  const familiarSubtypes=new Set(["Bat","Bird","Cat","Dragon","Faerie","Fox","Frog","Imp","Lizard","Spider"]);
  for(const face of arr(card.faces)){
    const accessible=["default","alternative_entry"].includes(face.access?.kind);if(!accessible)continue;
    const permanentFace=arr(face.cardTypes).some(t=>PERMANENT_TYPES.has(t)||t==="Kindred");
    for(const t of arr(face.cardTypes)){produces.push(`card:type:${typeSignal(t)}`);if(PERMANENT_TYPES.has(t))produces.push(`permanent:${typeSignal(t)}`);}if(arr(face.cardTypes).includes("Legendary")){for(const t of arr(face.cardTypes))if(PERMANENT_TYPES.has(t))produces.push(`permanent:legendary_${typeSignal(t)}`);}if(arr(face.cardTypes).includes("Basic")&&arr(face.cardTypes).includes("Land"))produces.push("permanent:basic_land");if(arr(face.cardTypes).includes("Snow")&&permanentFace)produces.push("permanent:supertype:snow");if(permanentFace){produces.push(`permanent:name:${typeSignal(face.name||card.name)}`);if(!arr(face.cardTypes).includes("Land"))produces.push("permanent:nonland_nontoken");for(const kw of arr(card.keywords))produces.push(`permanent:keyword:${typeSignal(kw)}`);}if(!arr(face.cardTypes).includes("Land")){produces.push("event:spell_cast");if(!arr(face.cardTypes).includes("Creature"))produces.push("event:noncreature_spell_cast");if(arr(face.cardTypes).includes("Instant")||arr(face.cardTypes).includes("Sorcery"))produces.push("event:instant_sorcery_spell_cast");}for(const st of arr(face.subtypes)){produces.push(`card:subtype:${typeSignal(st)}`);if(permanentFace)produces.push(`permanent:subtype:${typeSignal(st)}`);}
    if(permanentFace&&arr(face.subtypes).some(st=>["Assassin","Mercenary","Pirate","Rogue","Warlock"].includes(st)))produces.push("package:outlaw");
    if(permanentFace&&(arr(face.cardTypes).includes("Artifact")||arr(face.cardTypes).includes("Legendary")||arr(face.subtypes).includes("Saga")))produces.push("package:historic");
    if(permanentFace&&(arr(face.subtypes).some(st=>familiarSubtypes.has(st))||/familiar/i.test(face.name||card.name)))produces.push("package:familiar");
  }
  for(const cap of arr(card.capabilities)){
    const p=uniq(capProduced(cap)),reqAtoms=needAtoms(cap.requirements),rawCondAtoms=needAtoms(cap.conditions),condAtoms=rawCondAtoms.map(x=>["enters_tapped","enter_tapped"].includes(cap.action)&&x.dependencyClass==="package"&&!x.negated?{...x,dependencyClass:"state",signal:`state:etb_condition:${x.signal}`} : x),costAtoms=costNeeds(cap).map(x=>({...x,dependencyClass:"package"})),atoms=[...reqAtoms,...condAtoms,...costAtoms];
    const positive=atoms.filter(x=>!x.negated),n=uniq(positive.filter(x=>x.dependencyClass==="package").map(x=>x.signal)),env=uniq(positive.filter(x=>x.dependencyClass==="environment").map(x=>x.signal)),state=uniq(positive.filter(x=>x.dependencyClass==="state").map(x=>x.signal)),internal=uniq(positive.filter(x=>["internal","constraint"].includes(x.dependencyClass)).map(x=>x.signal)),unresolved=uniq(positive.filter(x=>["unresolved","unclassified"].includes(x.dependencyClass)).map(x=>x.signal));
    produces.push(...p);needs.push(...n);environmentNeeds.push(...env);stateNeeds.push(...state);internalConstraints.push(...internal);unresolvedConditions.push(...unresolved);capabilities.push({capabilityId:cap.id,produces:p,needs:n,environmentNeeds:env,stateNeeds:state,internalConstraints:internal,unresolvedConditions:unresolved,needAtoms:atoms,requirementLogic:cap.requirements,conditionLogic:cap.conditions,action:cap.action,operator:cap.operator,access:arr(card.faces).find(f=>f.id===cap.faceId)?.access?.kind||cap.access?.kind||"default"});
  }
  return {version:INTERACTION_SIGNAL_VERSION,oracleId:card.oracleId,name:card.name,produces:uniq(produces),needs:uniq(needs),environmentNeeds:uniq(environmentNeeds),stateNeeds:uniq(stateNeeds),internalConstraints:uniq(internalConstraints),unresolvedConditions:uniq(unresolvedConditions),capabilities};
}
