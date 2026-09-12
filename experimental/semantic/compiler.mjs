import {
  SEMANTIC_SCHEMA,
  SEMANTIC_SCHEMA_VERSION,
  SEMANTIC_COMPILER_VERSION,
  COVERAGE_STATUS,
  uniq,
  clamp01
} from "./schema.mjs";

const NUMBER_WORDS={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
const KNOWN_KEYWORDS=new Set([
  "deathtouch","defender","double strike","enchant","equip","first strike","flash","flying","haste","hexproof",
  "indestructible","lifelink","menace","reach","trample","vigilance","ward","protection","shroud","affinity","convoke","delve","improvise",
  "storm","cascade","cycling","kicker","flashback","escape","toxic","infect","proliferate","goad","scry","surveil","explore","connive",
  "discover","investigate","venture","regenerate","phasing"
]);
const ROLE_RELEVANT_KEYWORDS=new Set(["hexproof","indestructible","ward","protection","shroud"]);

const lower=s=>String(s||"").toLowerCase();
const clean=s=>String(s||"").trim();
const numberFrom=s=>NUMBER_WORDS[lower(s)] ?? (Number.isFinite(Number(s)) ? Number(s) : null);
const typeParts=typeLine=>{
  const [left,right=""] = String(typeLine||"").split(/\s+[—-]\s+/);
  return {cardTypes:left.split(/\s+/).filter(Boolean),subtypes:right.split(/\s+/).filter(Boolean)};
};

function splitOracleAbilities(oracleText){
  return String(oracleText||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
}

// Oracle frequently prefixes an ability with an ability word ("Landfall —",
// "Magecraft —", etc.). Ability words are labels, not the trigger/effect itself.
// Strip only when the text after the dash clearly begins a rules construct so
// arbitrary prose with a dash is not reinterpreted.
function stripAbilityWordPrefix(text){
  let s=String(text||"").trim();
  for(let i=0;i<2;i++){
    const m=s.match(/^[^—\n]{1,80}\s+[—]\s+((?:when|whenever|at the beginning|at the end|as\b|if\b|until\b|you\b|target\b|each\b|draw\b|create\b|destroy\b|exile\b|return\b|put\b|choose\b|counter\b|add\b|this\b).*)$/i);
    if(!m)break;
    s=m[1].trim();
  }
  return s;
}

const EFFECT_START_RE=/^(?:you|target|each|that|this|it|its|they|the|an? opponent|players?|draw|create|add|destroy|exile|return|put|counter|copy|sacrifice|tap|untap|choose|gain|lose|mill|scry|surveil|proliferate|investigate|search|look|reveal|prevent|deal|roll|transform|manifest|amass|goad|suspect|open|take|instead|until|if|unless|for each)\b/i;

function splitAtRulesComma(text){
  const s=String(text||"");let depth=0;const candidates=[];
  for(let i=0;i<s.length;i++){
    const ch=s[i];if(ch==='(')depth++;else if(ch===')')depth=Math.max(0,depth-1);
    else if(ch===','&&depth===0){
      const rest=s.slice(i+1).trim();candidates.push(i);
      if(EFFECT_START_RE.test(rest))return {head:s.slice(0,i).trim(),body:rest};
    }
  }
  if(candidates.length){const i=candidates[candidates.length-1];return {head:s.slice(0,i).trim(),body:s.slice(i+1).trim()};}
  return {head:s.trim(),body:null};
}

function splitTopLevelClauses(text){
  const out=[]; let start=0, depth=0, quote=null;
  const push=end=>{const value=text.slice(start,end).trim(); if(value)out.push(value); start=end;};
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(ch===quote && text[i-1]!=="\\") quote=null;
      continue;
    }
    if(ch==='"'||ch==='“'||ch==='”'){quote=ch==='“'?'”':ch;continue;}
    if(ch==='(')depth++;
    else if(ch===')')depth=Math.max(0,depth-1);
    else if(depth===0 && ch===';'){push(i);start=i+1;}
    else if(depth===0 && ch==='.' && /\s|$/.test(text[i+1]||"")){push(i+1);start=i+1;}
  }
  push(text.length);
  return out.length?out:[text];
}

function parseManaCostText(text){
  const symbols=[...String(text||"").matchAll(/\{([^}]+)\}/g)].map(m=>m[1].toUpperCase());
  let generic=0,colored=0,variable=false;
  for(const symbol of symbols){
    if(/^\d+$/.test(symbol))generic+=Number(symbol);
    else if(symbol==="X")variable=true;
    else if(["T","Q","E"].includes(symbol))continue;
    else colored++;
  }
  return {raw:String(text||""),symbols,generic,coloredPips:colored,variable,minimumMana:generic+colored};
}

function manaOutputAmount(text){
  const t=lower(text);
  const explicitChoice=t.match(/adds?\s+(?:an? |one )?(?:mana of )?(?:any|one) (?:color|type)/);
  if(explicitChoice)return 1;
  const symbols=[...t.matchAll(/\{([wubrgc])\}/g)];
  if(symbols.length){
    if(/\bor\b/.test(t))return 1;
    return symbols.length;
  }
  const m=t.match(/adds?\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+mana/);
  if(m)return numberFrom(m[1])||0;
  if(/adds?\s+x\s+mana|adds? that much mana|adds? an amount of mana|adds? twice that much mana/.test(t))return null;
  return /\badds?\b[^.]{0,80}\bmana\b/.test(t)?1:0;
}

function manaOutputIdentity(text){
  const t=lower(text),colors=uniq([...t.matchAll(/\{([wubrgc])\}/g)].map(m=>m[1].toUpperCase()));
  return {
    colors,
    anyColor:/\bany color\b/.test(t),
    commanderIdentity:/commander(?:['’]s|s)? color identity/.test(t),
    anyLandProduced:/any type that a land you control could produce/.test(t),
    chosenColor:/chosen color/.test(t)
  };
}

function detectSpellScope(text){
  const t=lower(text);
  if(/instant (?:or|and) sorcery|instant and\/or sorcery|instant\/sorcery/.test(t))return "instant_sorcery";
  if(/noncreature spell/.test(t))return "noncreature";
  if(/creature spell/.test(t))return "creature";
  if(/artifact spell/.test(t))return "artifact";
  if(/enchantment spell/.test(t))return "enchantment";
  if(/legendary spell/.test(t))return "legendary";
  if(/historic spell/.test(t))return "historic";
  if(/spell you cast|spells you cast|target spell|this spell|that spell|copy .* spell/.test(t))return "any";
  return null;
}

function detectActor(text){
  const t=lower(text);
  if(/^you\b|\byou may\b|\byou (?:cast|copy|create|draw|add|return|exile|destroy|gain|lose|discard|sacrifice|search|scry|surveil|mill|investigate|proliferate)\b/.test(t))return "you";
  if(/\beach opponent\b|\btarget opponent\b|\ban opponent\b/.test(t))return "opponent";
  if(/\bthat player\b/.test(t))return "referenced_player";
  if(/\bits controller\b|\bthat spell(?:'|’)s controller\b|\bthat creature(?:'|’)s controller\b/.test(t))return "object_controller";
  if(/\btarget player\b|\beach player\b/.test(t))return "player";
  return "source_controller";
}

function subjectBeneficiary(text,verb){
  const t=lower(text), forms={draw:"draws?",gain:"gains?",lose:"los(?:e|es|t)",discard:"discards?",search:"search(?:es)?"};
  const v=forms[verb]||String(verb||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  if(new RegExp(`\\b(?:target|each) opponent\\b[^.;]{0,80}\\b${v}`).test(t))return "opponent";
  if(new RegExp(`\\bthat player\\b[^.;]{0,80}\\b${v}`).test(t))return "referenced_player";
  if(new RegExp(`\\bits controller\\b[^.;]{0,80}\\b${v}`).test(t))return "object_controller";
  if(new RegExp(`\\btarget player\\b[^.;]{0,80}\\b${v}`).test(t))return "target_player";
  if(new RegExp(`\\beach player\\b[^.;]{0,80}\\b${v}`).test(t))return "all_players";
  if(new RegExp(`\\byou\\b[^.;]{0,80}\\b${v}`).test(t)||new RegExp(`^you\\s+${v}`).test(t))return "you";
  return "source_controller";
}

function detectTrigger(text){
  const t=lower(stripAbilityWordPrefix(text)).trim();
  let kind=null,event=null,frequency="once";
  if(/^whenever\b/.test(t)){kind="triggered";frequency="repeatable";event=splitAtRulesComma(t).head;}
  else if(/^when\b/.test(t)){kind="triggered";event=splitAtRulesComma(t).head;}
  else if(/^at the beginning of\b|^at the end of\b/.test(t)){kind="triggered";frequency="repeatable";event=splitAtRulesComma(t).head;}
  else if(/^as [^,]{1,220} enters\b/.test(t)){kind="replacement";event=splitAtRulesComma(t).head;}
  else if(/^[^:]{1,220}:/.test(t)){kind="activated";frequency=/sacrifice/.test(t.split(":")[0])?"one_shot":"repeatable";}
  else kind="static";
  return {kind,event,frequency};
}

function detectCondition(text){
  const t=clean(text);
  const m=t.match(/\b(if|unless|as long as|for each|where x is|where x equals|provided that|only if)\b([^.;]*)/i);
  return m?clean(`${m[1]}${m[2]}`):null;
}

function dependencyFacts(text){
  const t=lower(text), deps=[];
  if(/your graveyard|from your graveyard|in your graveyard/.test(t))deps.push("zone:your_graveyard");
  if(/opponent(?:'|’)s graveyard|target opponent(?:'|’)s graveyard/.test(t))deps.push("zone:opponent_graveyard");
  if(/instant (?:or|and) sorcery|instant and\/or sorcery/.test(t))deps.push("card:instant_sorcery");
  if(/artifacts? you control|artifact spells? you cast|if you control an? artifact/.test(t))deps.push("permanent:artifact");
  if(/enchantments? you control|enchantment spells? you cast|if you control an? enchantment/.test(t))deps.push("permanent:enchantment");
  if(/creatures? you control|if you control a creature/.test(t))deps.push("permanent:creature");
  if(/tokens? you control|if you control a token/.test(t))deps.push("permanent:token");
  if(/if you control your commander|commander you control|as long as you control your commander/.test(t))deps.push("commander:controlled");
  if(/whenever an opponent|whenever a player|each opponent/.test(t))deps.push("event:opponent_action");
  if(/if you gained life|whenever you gain life/.test(t))deps.push("event:life_gain");
  if(/if a creature died|whenever .* dies|creature card.*graveyard/.test(t))deps.push("event:creature_death");
  if(/if you discarded|whenever you discard/.test(t))deps.push("event:discard");
  return uniq(deps);
}

function zoneOwner(text){
  const t=lower(text);
  if(/your graveyard|from your graveyard|in your graveyard|your hand|to your hand/.test(t))return "you";
  if(/opponent(?:'|’)s graveyard|target opponent(?:'|’)s graveyard/.test(t))return "opponent";
  if(/each player[^.]{0,120}their graveyard/.test(t))return "all_players";
  if(/target player(?:'|’)s graveyard|a player(?:'|’)s graveyard/.test(t))return "target_player";
  if(/their graveyard/.test(t))return "referenced_player";
  if(/a graveyard|from graveyard|from any graveyard/.test(t))return "any";
  return null;
}

function targetDescriptor(text){
  const t=lower(text);
  const m=t.match(/target\s+([^,.;]{1,110})/);
  if(m)return clean(m[1]);
  if(/all creatures/.test(t))return "all_creatures";
  if(/all nonland permanents/.test(t))return "all_nonland_permanents";
  if(/all permanents/.test(t))return "all_permanents";
  if(/each creature/.test(t))return "each_creature";
  if(/each opponent/.test(t))return "each_opponent";
  if(/each player/.test(t))return "each_player";
  return null;
}

function detectGrantedRules(text){
  const found=[];
  for(const m of String(text||"").matchAll(/["“]([^"”]{3,700})["”]/g)){
    if(/:|whenever|when |at the beginning|add \{|draw |create |destroy |exile |return |sacrifice |counter /i.test(m[1]))found.push(m[1].trim());
  }
  return found;
}

function parseMassEffect(text){
  const t=lower(text);
  if(/(?:destroy|exile) all (?:other )?(?:creatures|nonland permanents|permanents)\b/.test(t))return {strength:1,scope:targetDescriptor(text),mode:/exile all/.test(t)?"exile":"destroy"};
  // Qualified permanent sweeps include subtype/type/color restrictions and lands.
  // Keep strength continuous: destroying every permanent is stronger than clearing
  // a named class such as lands, Goblins, Islands, artifacts, etc.
  if(/(?:destroy|exile) all [^.]{0,120}\b(?:creatures|artifacts|enchantments|planeswalkers|permanents|lands|islands|swamps|mountains|forests|plains)\b/.test(t))return {strength:.78,scope:"qualified_permanent_set",mode:/exile all/.test(t)?"exile":"destroy"};
  if(/(?:destroy|exile) all [^.]{0,80}\b(?:goblins?|elves?|zombies?|dragons?|angels?|demons?|slivers?|merfolk|vampires?|humans?|soldiers?|warriors?|wizards?)\b/.test(t))return {strength:.74,scope:"qualified_creature_set",mode:/exile all/.test(t)?"exile":"destroy"};
  if(/return all [^.]{0,100}\bcreatures?\b[^.]{0,80}\bhand/.test(t)||/return each [^.]{0,100}\bcreature\b[^.]{0,80}\bhand/.test(t))return {strength:.86,scope:"qualified_creature_set",mode:"return"};
  if(/return all (?:other )?nonland permanents\b[^.]{0,100}\bhands?\b/.test(t))return {strength:.96,scope:"all_nonland_permanents",mode:"return"};
  if(/return all [^.]{0,100}\bpermanents\b[^.]{0,100}\bhands?\b/.test(t))return {strength:.88,scope:"qualified_permanent_set",mode:"return"};
  if(/destroy each [^.]{0,100}\bpermanent\b|exile each [^.]{0,100}\bpermanent\b/.test(t))return {strength:.78,scope:"conditional_permanents",mode:/exile/.test(t)?"exile":"destroy"};
  if(/each player sacrifices (?:all|each|two|three|\d+) creatures/.test(t)||/each opponent sacrifices (?:all|each|two|three|\d+) creatures/.test(t))return {strength:.92,scope:"all_players_creatures",mode:"sacrifice"};
  const dmg=t.match(/(?:deals?|deal)\s+(\d+)\s+damage to each creature/);
  if(dmg)return {strength:clamp01(Number(dmg[1])/6),scope:"each_creature",mode:"damage"};
  if(/all creatures get -x\/-x|each creature gets -x\/-x/.test(t))return {strength:.92,scope:"all_creatures",mode:"minus_x"};
  const minus=t.match(/(?:all|each) creatures? get(?:s)? -(\d+)\/-\1/);
  if(minus)return {strength:clamp01(Number(minus[1])/6),scope:"all_creatures",mode:"minus"};
  if(/destroy each [^.]{0,80}creature|exile each [^.]{0,80}creature/.test(t))return {strength:.72,scope:"conditional_creatures",mode:/exile/.test(t)?"exile":"destroy"};
  return null;
}

function manaSemantics({text,abilityText,typeLine,manaValue}){
  const t=lower(text);
  if(!/\badds?\b/.test(t) || !/(\{[wubrgc]\}|\bmana\b)/.test(t))return null;
  const colon=abilityText.indexOf(":");
  const costText=colon>=0?abilityText.slice(0,colon):"";
  const activation=parseManaCostText(costText);
  const output=manaOutputAmount(text);
  const identity=manaOutputIdentity(text);
  const tap=/\{t\}|\btap\b/i.test(costText);
  const sacrifice=/\bsacrifice\b/i.test(costText);
  const requiresOtherPermanent=/tap an untapped|tap another|tap two|tap three|remove .* counter/i.test(costText);
  const isLand=/\bland\b/i.test(typeLine.split("//")[0]);
  const directSpell=colon<0 && /instant|sorcery/i.test(typeLine);
  const activationNet=output===null?null:output-activation.minimumMana;
  const multiplier=/adds? (?:twice|double)|adds? an additional|instead adds?/.test(t);
  let structuralAcceleration=false, reason="mana_capability_only";
  if(multiplier){structuralAcceleration=true;reason="mana_multiplication";}
  else if(isLand){reason="baseline_land_mana";}
  else if(output===null){reason="variable_output_unresolved";}
  else if(activationNet<=0){reason="mana_filter_or_nonpositive_activation";}
  else if(requiresOtherPermanent){reason="dependent_mana_conversion";}
  else if(directSpell){structuralAcceleration=output>Number(manaValue||0);reason=structuralAcceleration?"positive_ritual_net":"ritual_nonpositive_total_net";}
  else {structuralAcceleration=true;reason=sacrifice?"one_shot_positive_mana":"repeatable_positive_mana";}
  return {output,activationCost:activation,tap,sacrifice,requiresOtherPermanent,activationNet,isLand,directSpell,multiplier,structuralAcceleration,reason,...identity};
}

function mark(base,{action,object=null,target,beneficiary,polarity="neutral",confidence=.9,status=COVERAGE_STATUS.SUPPORTED,details=null,magnitude=null,sourceZone,destinationZone,owner,force=false}={}){
  if(action){
    if(base.action && base.action!==action && !force){
      const secondary={action,object,target,beneficiary,polarity,confidence,status,details:details||{},magnitude,sourceZone,destinationZone,owner};
      base.details.secondaryActions=uniq([...(base.details.secondaryActions||[]),action]);
      base.details.secondaryFacts=[...(base.details.secondaryFacts||[]),secondary];
      if(status===COVERAGE_STATUS.GAP)base.status=COVERAGE_STATUS.GAP;
      else if(status===COVERAGE_STATUS.PARTIAL&&base.status===COVERAGE_STATUS.SUPPORTED)base.status=COVERAGE_STATUS.PARTIAL;
      base.confidence=Math.min(base.confidence||confidence,confidence);
      return base;
    }
    base.action=action;
  }
  if(object!==null)base.object=object;
  if(target!==undefined)base.target=target;
  if(beneficiary!==undefined)base.beneficiary=beneficiary;
  if(sourceZone!==undefined)base.sourceZone=sourceZone;
  if(destinationZone!==undefined)base.destinationZone=destinationZone;
  if(owner!==undefined)base.owner=owner;
  base.polarity=polarity;base.confidence=Math.max(base.confidence,confidence);base.status=status;
  if(details)Object.assign(base.details,details);
  if(magnitude!==null)base.magnitude=magnitude;
}

function addGap(base,pattern){
  base.unsupportedPatterns=uniq([...base.unsupportedPatterns,pattern]);
  if(base.action)base.status=COVERAGE_STATUS.PARTIAL;
}

function keywordFromText(t){
  return [...KNOWN_KEYWORDS].filter(k=>new RegExp(`\\b${k.replace(/ /g,"\\s+")}\\b`,`i`).test(t));
}

function effectBody(rawText,trigger){
  let text=stripAbilityWordPrefix(String(rawText||"").trim().replace(/^[•]+\s*/,""));
  const lowerText=lower(text);
  if(["triggered","replacement"].includes(trigger.kind) && /^(when|whenever|at the beginning|at the end|as )/.test(lowerText) && text.includes(",")) text=splitAtRulesComma(text).body||text;
  for(let i=0;i<2;i++){
    if(/^if\b/i.test(text)&&text.includes(",")) text=splitAtRulesComma(text).body||text;
    else if(/^until [^,]{1,160},/i.test(text)) text=text.slice(text.indexOf(",")+1).trim();
    else if(/^otherwise,\s*/i.test(text)) text=text.replace(/^otherwise,\s*/i,"");
    else break;
  }
  text=text.replace(/^(?:visit|[ivxlcdm]+)\s+[—-]\s+/i,"");
  // Some Sagas/rooms use a chapter marker followed by a short flavor/ability
  // label before the actual rules instruction ("III — Hall of Sorrow — Draw …").
  if(/^[^—]{1,70}\s+[—]\s+(?:draw|create|destroy|exile|return|put|target|each|you|counter|add|choose)\b/i.test(text))
    text=text.replace(/^[^—]{1,70}\s+[—]\s+/i,"");
  if(/^\d+[—-]\d+\s*\|\s*/.test(text)||/^\d+\+?\s*\|\s*/.test(text))text=text.replace(/^\d+(?:[—-]\d+|\+)?\s*\|\s*/,"");
  return text.replace(/^[•]+\s*/,"");
}

function compileClause(rawText,ctx){
  const trigger=detectTrigger(ctx.abilityText), colon=trigger.kind==="activated"?rawText.indexOf(":"):-1;
  const effectText=effectBody(colon>=0?rawText.slice(colon+1).trim():rawText,trigger);
  const t=lower(effectText), deps=dependencyFacts(rawText);
  const base={
    rawText,
    actor:detectActor(effectText),action:null,object:null,target:targetDescriptor(effectText),sourceZone:null,destinationZone:null,
    owner:zoneOwner(effectText),controller:null,beneficiary:null,trigger:trigger.kind,event:trigger.event,spellScope:detectSpellScope(rawText),
    cardType:ctx.cardTypes,subtype:ctx.subtypes,colorRestriction:null,cost:ctx.cardCost,activationCost:null,alternateCost:null,
    costReductionScope:null,condition:detectCondition(rawText),magnitude:null,frequency:trigger.frequency,timing:null,polarity:"neutral",
    dependencies:deps,dependencyGroups:deps.length?[deps]:[],confidence:.55,unsupportedPatterns:[],status:COVERAGE_STATUS.GAP,details:{}
  };
  if(/^until (?:the )?end of /i.test(rawText))base.timing=rawText.split(",")[0].trim();
  if(trigger.kind==="replacement")base.details.replacementEvent=trigger.event;
  if(trigger.kind==="activated" && colon>=0){
    const costText=rawText.slice(0,colon).trim();
    base.activationCost={...parseManaCostText(costText),raw:costText,sacrifice:/\bsacrifice\b/i.test(costText),tap:/\{T\}|\btap\b/i.test(costText),discard:/\bdiscard\b/i.test(costText),life:/\bpay\b[^:]{0,40}\blife\b/i.test(costText)};
  }

  // Reminder/rules glosses are not semantic gaps by themselves.
  if(/^\s*\([^)]*\)\s*$/.test(rawText)){
    mark(base,{action:"reminder_text",object:"rules_gloss",confidence:.99});
    return base;
  }

  if(/<GRANTED_RULES>/.test(rawText) && !/\bcreate\b[^.]{0,140}\btoken/i.test(rawText))mark(base,{action:"grant_ability",object:"ability",beneficiary:/opponent/.test(t)?"opponent":"you",polarity:"positive",confidence:.9});

  if(/\bdestroy the rest\b/.test(t))mark(base,{action:"destroy",object:"permanent_set",target:"all_except_chosen",magnitude:{sweeperStrength:.9},polarity:"hostile_capable",confidence:.9});
  const mass=parseMassEffect(effectText);
  if(mass)mark(base,{action:mass.mode,object:"permanent_set",target:mass.scope,magnitude:{sweeperStrength:mass.strength},polarity:"hostile_capable",confidence:.94,details:{massEffect:mass}});

  const selfReduction=/\bthis spell costs?\b[^.]{0,140}\bless to cast\b/.test(t);
  const yourSpellReduction=/\bspells?\b[^.]{0,140}\byou cast\b[^.]{0,140}\bcosts?\b[^.]{0,80}\bless to cast\b|\bspells? you cast cost\b[^.]{0,80}\bless/.test(t);
  const commanderReduction=/\byour commander costs?\b[^.]{0,120}\bless to cast\b/.test(t);
  if(selfReduction||yourSpellReduction||commanderReduction){
    mark(base,{action:"reduce_cost",object:"spell_cost",beneficiary:selfReduction?"self_spell":"you",polarity:"positive",confidence:.98});
    base.costReductionScope=selfReduction?"self_spell":commanderReduction?"your_commander":"your_spells";base.spellScope=detectSpellScope(rawText)||(selfReduction?"this_spell":"any");
    const m=rawText.match(/costs?\s+(\{[^}]+\}|\d+)\s+less/i); if(m)base.magnitude={reduction:m[1]};
  }
  if(/\bspells?[^.]{0,120}\bcosts?\b[^.]{0,80}\bmore to cast\b|\bthis spell costs?\b[^.]{0,100}\bmore to cast\b/.test(t)){
    mark(base,{action:"increase_cost",object:"spell_cost",polarity:/opponent/.test(t)?"hostile_capable":"negative",confidence:.94});
  }

  if(/\bcopy\b[^.]{0,120}\bspell\b|\bcopy this spell\b|\bcopy that spell\b/.test(t)){
    mark(base,{action:"copy_spell",object:"spell",beneficiary:base.actor==="you"?"you":base.actor,polarity:"positive",confidence:.94});
    base.controller=base.actor;
  } else if(/\b(?:becomes?|create|creates?|enter|enters)\b[^.]{0,180}\b(?:as )?a copy of\b|\bcopy of target (?:creature|permanent|artifact|enchantment)/.test(t)){
    mark(base,{action:"copy_permanent",object:/token/.test(t)?"token":"permanent",beneficiary:"you",polarity:"positive",confidence:.9});
  }
  if(/\bcopy it\b/.test(t)&&/\bwhen you cast this spell\b/i.test(rawText))mark(base,{action:"copy_spell",object:"self_spell",beneficiary:"you",polarity:"positive",confidence:.96});
  if(/\b(?:when|whenever) you cast\b[^.]{0,180}\bspell\b[^.]{0,100}\b(?:you may )?copy it\b/i.test(rawText)){
    mark(base,{action:"copy_spell",object:"referenced_spell",beneficiary:"you",polarity:"positive",confidence:.97,force:true});base.actor="source_controller";base.controller="source_controller";
  }
  if(/^copy it\.?$/i.test(effectText)){mark(base,{action:"copy_referenced",object:"referenced_object",beneficiary:"you",polarity:"positive",confidence:.72,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}
  if(/\b(?:you may )?copy that ability\b/.test(t)){mark(base,{action:"copy_ability",object:"referenced_ability",beneficiary:"you",polarity:"positive",confidence:.8,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}
  if(/\b(?:controller|owner) of target (?:instant or sorcery|instant|sorcery|spell)[^.]{0,80}\bcopies? it\b/.test(t)){
    mark(base,{action:"copy_spell",object:"spell",beneficiary:"object_controller",polarity:"positive",confidence:.95,force:true});base.actor="object_controller";base.controller="object_controller";
  }
  if(/\byou may choose new targets?\b|\bchange the target of\b/.test(t)){
    mark(base,{action:"retarget",object:/spell/.test(t)?"spell":"spell_or_ability",beneficiary:"you",polarity:"positive",confidence:.92});
  }

  // A graveyard mention in a condition/magnitude ("cards in its controller's
  // graveyard") must not turn an otherwise normal battlefield effect into a
  // graveyard-zone move. Require the moved object itself to be located in a
  // graveyard.
  const graveyardObjectMove=/\b(?:return|exile|put)\b[^.;]{0,150}\b(?:card|cards|creature card|creature cards|artifact card|enchantment card|permanent card)s?\b[^.;]{0,100}\b(?:from|in|of|put into)\b[^.;]{0,70}\bgraveyard\b|\b(?:return|exile|put)\b[^.;]{0,180}\bfrom\b[^.;]{0,70}\bgraveyard\b/.test(t);
  const zoneMove=graveyardObjectMove?/\b(return|exile|put)\b/.exec(t):null;
  if(zoneMove){
    const action=zoneMove[1];
    let destinationZone=null;
    if(/to (?:your |the )?hand/.test(t))destinationZone="hand";
    else if(/onto|to the battlefield|return .* battlefield/.test(t))destinationZone="battlefield";
    else if(action==="exile")destinationZone="exile";
    const owner=zoneOwner(effectText)||zoneOwner(rawText);
    mark(base,{action,object:/\bcard\b/.test(t)?"card":"object",sourceZone:"graveyard",destinationZone,owner,beneficiary:owner==="you"?"you":null,
      polarity:owner==="you"?((destinationZone==="hand"||destinationZone==="battlefield")?"positive":"self_resource_cost"):(action==="exile"?"hostile_capable":"neutral"),confidence:.92});
  }
  // The zone can be established by a condition on the same ability even when
  // the effect says only "return this card". This is a scoped inference: it
  // applies to self/referenced return effects, not to unrelated effects that
  // merely use graveyard size as a condition or magnitude.
  if(/\breturn this card\b/.test(t)&&deps.includes("zone:your_graveyard")){
    const destinationZone=/battlefield/.test(t)?"battlefield":/hand/.test(t)?"hand":null;
    if(destinationZone)mark(base,{action:"return",object:"self_card",sourceZone:"graveyard",destinationZone,owner:"you",beneficiary:"you",polarity:"positive",confidence:.94});
  }

  if(/\bcounter target\b[^.]{0,100}\b(?:spell|activated ability|triggered ability)\b/.test(t))mark(base,{action:"counter",object:/ability/.test(t)?"ability":"spell",polarity:"hostile_capable",confidence:.99});
  if(/\bcounter (?:that|it|the) spell\b/.test(t))mark(base,{action:"counter",object:"spell",polarity:"hostile_capable",confidence:.96});
  if(/\bcounter (?:all|each) (?:activated |triggered )?abilities\b[^.]{0,100}\bopponents? control\b/.test(t))mark(base,{action:"counter",object:"ability_set",polarity:"hostile_capable",confidence:.97});

  if(/\b(?:destroy|exile|return) (?:up to (?:one|two|three|x|\d+) |up to one other |one or two |two |three |another )?target\b/.test(t) && !graveyardObjectMove){
    const action=t.match(/\b(destroy|exile|return) (?:up to (?:one|two|three|x|\d+) |up to one other |one or two |two |three |another )?target\b/)?.[1]||base.action;
    const ownOnly=/target [^.]{0,90} you control|target permanent you control|target creature you control/.test(t);
    mark(base,{action,object:base.target||"permanent",owner:ownOnly?"you":base.owner,polarity:ownOnly?"self_resource":"hostile_capable",confidence:.92});
  }

  if(/\breturn\b[^.]{0,130}\byou control\b[^.]{0,100}\bowner(?:'|’)s hand\b/.test(t))mark(base,{action:"return",object:/land/.test(t)?"land":/artifact/.test(t)?"artifact":"permanent",owner:"you",destinationZone:"hand",beneficiary:"you",polarity:"self_resource",confidence:.94});
  if(/\breturn (?:this|enchanted) (?:creature|artifact|enchantment|permanent|aura|land)\b[^.]{0,100}\bowner(?:'|’)s hand\b/.test(t))mark(base,{action:"return",object:/aura/.test(t)?"aura":/land/.test(t)?"land":"permanent",owner:"you",destinationZone:"hand",beneficiary:"you",polarity:"self_resource",confidence:.97});
  if(/\breturn this (?:creature|artifact|enchantment|permanent|aura|land) to (?:its|your) owner(?:'|’)s hand\b/.test(t))mark(base,{action:"return",object:"permanent",owner:"you",destinationZone:"hand",beneficiary:"you",polarity:"self_resource",confidence:.97});
  if(/\breturn\b(?: up to [^ ]+ | one or two | two | three )?target\b[^.]{0,130}\bowner(?:'|’)s hand\b/.test(t))mark(base,{action:"return",object:base.target||"permanent",destinationZone:"hand",polarity:/you control/.test(t)?"self_resource":"hostile_capable",confidence:.94});
  if(/\b(?:destroy|exile) both creatures\b/.test(t))mark(base,{action:/exile/.test(t)?"exile":"destroy",object:"creatures",polarity:"hostile_capable",confidence:.92});
  if(/\b(?:destroy|exile) (?:that|it|them|those) (?:creature|permanent|artifact|enchantment|creatures|permanents)?\b/.test(t)){mark(base,{action:/\bexile\b/.test(t)?"exile_referenced":"destroy_referenced",object:"referenced_object",polarity:"hostile_capable",confidence:.78,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}
  if(/\b(?:those|they|them) [^.]{0,60}fight|\bfight each other\b/.test(t)){mark(base,{action:"fight_referenced",object:"referenced_creatures",polarity:"hostile_capable",confidence:.76,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}

  if(/\b(?:target opponent|target player|each opponent|each player) exiles?\b[^.]{0,100}\b(?:creature|permanent|artifact|enchantment)\b/.test(t))mark(base,{action:"exile",object:/creature/.test(t)?"creature":"permanent",beneficiary:"opponent",polarity:"hostile_capable",confidence:.93});
  if(/\bexile all graveyards\b/.test(t))mark(base,{action:"graveyard_hate",object:"all_graveyards",sourceZone:"graveyard",destinationZone:"exile",polarity:"hostile_capable",confidence:.99});
  if(/^exile (?:this card|this spell|[a-z0-9 ,.'’:-]+)\.?$/i.test(effectText) && !/target|opponent|graveyard/i.test(effectText))mark(base,{action:"self_exile",object:"self",owner:"you",destinationZone:"exile",beneficiary:"you",polarity:"self_resource_cost",confidence:.88});
  if(/\bowner of target\b[^.]{0,120}\bshuffles? it into (?:their|his or her) library\b|\btarget [^.]{0,100}\bowner puts? it on (?:the )?(?:top|bottom) of (?:their|his or her) library\b/.test(t))mark(base,{action:"tuck",object:"permanent",destinationZone:"library",polarity:"hostile_capable",confidence:.92});
  if(/\btarget [^.]{0,90}(?:'|’)s owner puts? it on (?:their choice of )?(?:the )?(?:top|bottom) of (?:their|his or her) library\b/.test(t))mark(base,{action:"tuck",object:"permanent",destinationZone:"library",polarity:"hostile_capable",confidence:.94});
  if(/\b(?:its|their) owner shuffles? (?:it|them) into (?:their|his or her) library\b/.test(t)){mark(base,{action:"tuck_referenced",object:"referenced_object",destinationZone:"library",polarity:"hostile_capable",confidence:.76,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}

  // General tuck / graveyard-to-library movement. These are zone moves, not
  // battlefield destruction, and ownership stays explicit so recursion/hate
  // contracts can reason about direction without reading Oracle again.
  if(/\b(?:the )?(?:owner of )?target (?:spell|nonland permanent|permanent|creature|artifact|enchantment|land)[^.]{0,100}\bputs? (?:it|that card|that permanent) on (?:their choice of )?(?:the )?(?:top|bottom|top or bottom) of (?:their|its) library\b/.test(t))
    mark(base,{action:"tuck",object:/spell/.test(t)?"spell":"permanent",destinationZone:"library",polarity:"hostile_capable",confidence:.95});
  if(/\bput (?:one|two|three|x|\d+) target (?:lands?|creatures?|permanents?|artifacts?|enchantments?) on top of their owners?['’] libraries\b/.test(t))
    mark(base,{action:"tuck",object:/land/.test(t)?"land":"permanent",destinationZone:"library",polarity:"hostile_capable",confidence:.96});
  if(/\bput all (?:enchantments?|artifacts?|creatures?|lands?|nonland permanents?|permanents?) on top of their owners?['’] libraries\b/.test(t))
    mark(base,{action:"tuck",object:"permanent_set",destinationZone:"library",polarity:"hostile_capable",confidence:.95,magnitude:{sweeperStrength:.78}});
  if(/\btarget player shuffles?(?: up to [^.]{0,40})? target cards? from (?:their|his or her) graveyard into (?:their|his or her) library\b|\btarget player shuffles? (?:their|his or her) graveyard into (?:their|his or her) library\b/.test(t))
    mark(base,{action:"shuffle_graveyard",object:"card_set",sourceZone:"graveyard",destinationZone:"library",owner:"target_player",beneficiary:"target_player",polarity:"neutral",confidence:.94});
  if(/\b(?:each player|all players) returns? (?:all|any number of|each) [^.]{0,120}cards?[^.]{0,80}from (?:their|his or her) graveyards? to (?:their|his or her) hands?\b/.test(t))
    mark(base,{action:"return",object:"card_set",sourceZone:"graveyard",destinationZone:"hand",owner:"all_players",beneficiary:"all_players",polarity:"positive",confidence:.94});
  if(/\b(?:each player|all players) returns? (?:all|any number of|each) [^.]{0,120}cards?[^.]{0,80}from (?:their|his or her) graveyards? to the battlefield\b/.test(t))
    mark(base,{action:"return",object:"card_set",sourceZone:"graveyard",destinationZone:"battlefield",owner:"all_players",beneficiary:"all_players",polarity:"positive",confidence:.94});
  if(/\bput onto the battlefield under your control all [^.]{0,120}cards? in all graveyards\b/.test(t))
    mark(base,{action:"return",object:"card_set",sourceZone:"graveyard",destinationZone:"battlefield",owner:"any",beneficiary:"you",polarity:"positive",confidence:.96});

  const mana=manaSemantics({text:effectText,abilityText:ctx.abilityText,typeLine:ctx.typeLine,manaValue:ctx.manaValue});
  if(mana){
    mark(base,{action:"add_mana",object:"mana",beneficiary:"you",polarity:"positive",confidence:mana.output===null?.72:.96,status:mana.output===null?COVERAGE_STATUS.PARTIAL:COVERAGE_STATUS.SUPPORTED,
      magnitude:{manaOutput:mana.output,activationNet:mana.activationNet},details:{mana}});
    base.activationCost=mana.activationCost;
    if(mana.output===null)addGap(base,"DYNAMIC_MANA_OUTPUT");
    if(mana.requiresOtherPermanent){base.dependencies=uniq([...base.dependencies,"permanent:other"]);base.dependencyGroups=[base.dependencies];}
  }
  if(/spend this mana only|this mana can(?:'t|not) be spent|this mana doesn(?:'t| not) empty/.test(t))mark(base,{action:"mana_restriction",object:"mana",beneficiary:"you",polarity:"neutral",confidence:.94});

  if(/search your library[^.]{0,200}\b(?:basic )?land\b[^.]{0,120}(?:onto|to) the battlefield/.test(t) || /put [^.]{0,120}\bland card\b[^.]{0,120}onto the battlefield/.test(t)){
    mark(base,{action:"put_land_battlefield",object:"land",sourceZone:"library",destinationZone:"battlefield",beneficiary:"you",polarity:"positive",confidence:.95,details:{structuralAcceleration:true}});
  } else if(/\bsearch (?:your|target player(?:'|’)s|that player(?:'|’)s|their) library\b/.test(t)){
    mark(base,{action:"search_library",object:"card",sourceZone:"library",beneficiary:/search your library/.test(t)?"you":subjectBeneficiary(rawText,"search"),polarity:"positive",confidence:.88});
    if(!/\b(?:card|land|creature|artifact|enchantment|instant|sorcery|planeswalker|battle)\b/.test(t))addGap(base,"SEARCH_CONSTRAINT_UNRESOLVED");
  }
  if(/play an additional land|play (?:up to )?(?:one|two|three|\d+) additional lands?/.test(t))mark(base,{action:"additional_land",object:"land_play",beneficiary:"you",polarity:"positive",confidence:.96,details:{structuralAcceleration:true}});

  if(/\b(?:you|target player|target opponent|each player|each opponent|that player|they|its controller)\b[^.;]{0,100}\bdraws?\b|^(?:then )?draw\b|\bthen draw\b|\byou draw\b|\bto draw a card\b/.test(t)){
    const beneficiary=subjectBeneficiary(effectText,"draw");
    mark(base,{action:"draw",object:"card",beneficiary,polarity:beneficiary==="opponent"?"opponent_benefit":"positive",confidence:.95});
  }
  if(/\bcreate\b[^.]{0,140}\btoken/.test(t))mark(base,{action:"create_token",object:"token",beneficiary:/opponent|that player|its controller/.test(t)?detectActor(rawText):"you",polarity:"positive",confidence:.92});

  // Replacement/multiplier engines are distinct semantic facts from ordinary
  // one-shot creation. They are especially important for Tokens/Counters themes.
  if(/\bif (?:an effect would create|one or more tokens would be created)\b[^.]{0,180}\b(?:twice|double|that many plus|additional|those tokens plus)\b/.test(t)||/\b(?:creates?|created) (?:twice|double) that many (?:of those )?tokens\b/.test(t))
    mark(base,{action:"multiply_tokens",object:"token_creation",beneficiary:/under your control/.test(t)?"you":null,polarity:"positive",confidence:.97});
  if(/\bif one or more [^.]*(?:counters?) would be put\b[^.]{0,180}\b(?:twice|double|that many plus|additional)\b/.test(t)||/\bputs? (?:twice|double) that many (?:of those )?counters\b/.test(t))
    mark(base,{action:"multiply_counters",object:"counter_placement",beneficiary:/you control/.test(t)?"you":null,polarity:"positive",confidence:.96});
  if(/\bif (?:a|one or more) [^.]{0,100}\bwould (?:explore|investigate|proliferate|connive)\b[^.]{0,160}\binstead\b[^.]{0,120}\b(?:again|additional)\b/.test(t))
    mark(base,{action:"multiply_action",object:"game_action",beneficiary:/you control/.test(t)?"you":null,polarity:"positive",confidence:.91});

  if(/\btriggers? an additional time\b|\btriggers? (?:twice|two additional times)\b/.test(t))mark(base,{action:"multiply_trigger",object:"triggered_ability",beneficiary:/opponent/.test(t)?"opponent":"you",polarity:"positive",confidence:.95});
  if(/\btarget player gains control of target permanent you control\b/.test(t))mark(base,{action:"transfer_control",object:"permanent",beneficiary:"target_player",polarity:"negative",confidence:.97});
  if(/\byou control enchanted creature\b/.test(t))mark(base,{action:"gain_control",object:"enchanted_creature",beneficiary:"you",polarity:"hostile_capable",confidence:.98});
  if(/\b(?:target |this |all |other )?[^.]{0,100}\b(?:becomes?|are|is)\b[^.]{0,120}\b(?:creatures?|artifacts?|enchantments?|lands?|colorless|swamp|island|mountain|forest|plains)\b/.test(t))mark(base,{action:"change_characteristics",object:"permanent",polarity:"neutral",confidence:.84});
  if(/\b(?:has|have) base power and toughness\b|\bpower and toughness (?:are|is|each equal)\b|\bpower is equal to\b|\btoughness is equal to\b|\bswitch target creature(?:'|’)s power and toughness\b/.test(t))mark(base,{action:"set_power_toughness",object:"creature",polarity:"neutral",confidence:.88});

  // Power/toughness, counters and characteristic changes.
  if(/\benters (?:the battlefield )?with\b[^.]{0,100}\bcounters?\b/.test(t))mark(base,{action:"add_counter",object:"counter",beneficiary:"you",polarity:"positive",confidence:.94});
  const pt=t.match(/\b(?:gets?|get)\s+([+-](?:\d+|x|\*))\/([+-](?:\d+|x|\*))/i);
  if(pt){
    const dynamic=/x|\*/i.test(pt[1]+pt[2]);
    mark(base,{action:"modify_power_toughness",object:"creature",beneficiary:/target .* opponent controls|creature an opponent controls/.test(t)?"opponent":"you",polarity:/\-/.test(pt[1]+pt[2])?"hostile_capable":"positive",confidence:dynamic?.78:.96,
      status:dynamic?COVERAGE_STATUS.PARTIAL:COVERAGE_STATUS.SUPPORTED,magnitude:{power:pt[1],toughness:pt[2]}});
    if(dynamic)addGap(base,"DYNAMIC_PT_EXPRESSION");
  }
  const ptAdditional=t.match(/\b(?:gets?|get)\s+(?:an?\s+)?additional\s+([+-](?:\d+|x|\*))\/([+-](?:\d+|x|\*))/i);
  if(ptAdditional){
    const dynamic=/x|\*/i.test(ptAdditional[1]+ptAdditional[2]);
    mark(base,{action:"modify_power_toughness",object:"creature",beneficiary:/opponent controls/.test(t)?"opponent":"you",polarity:/\-/.test(ptAdditional[1]+ptAdditional[2])?"hostile_capable":"positive",confidence:dynamic?.78:.96,status:dynamic?COVERAGE_STATUS.PARTIAL:COVERAGE_STATUS.SUPPORTED,magnitude:{power:ptAdditional[1],toughness:ptAdditional[2]}});
    if(dynamic)addGap(base,"DYNAMIC_PT_EXPRESSION");
  }
  if(/\b(?:you|that player|they) get(?:s)? \{E\}/i.test(effectText))mark(base,{action:"gain_energy",object:"energy_counter",beneficiary:/that player|they/.test(t)?"referenced_player":"you",polarity:"positive",confidence:.98});
  if(/\broll (?:a|one|two|three|\d+) (?:d\d+|six-sided dice|die|dice)\b/.test(t))mark(base,{action:"roll_dice",object:"die",beneficiary:"you",polarity:"neutral",confidence:.96});
  if(/\bput\b[^.]{0,100}\b(?:\+1\/\+1|-1\/-1|[a-z0-9 -]+) counters?\b|\bremove\b[^.]{0,100}\bcounters?\b|\bdouble the number of\b[^.]{0,80}\bcounters?\b/.test(t)){
    const action=/\bremove\b/.test(t)?"remove_counter":/\bdouble\b/.test(t)?"multiply_counters":"add_counter";
    mark(base,{action,object:"counter",beneficiary:/opponent/.test(t)?"opponent":"you",polarity:/-1\/-1/.test(t)?"hostile_capable":"positive",confidence:.9});
  }

  // Damage and fight.
  if(/\b(?:deals?|deal)\b[^.]{0,180}\bdamage\b/.test(t)){
    const m=t.match(/\b(?:deals?|deal)\s+(\d+)\s+damage\b/);
    const dynamic=!m;
    mark(base,{action:"deal_damage",object:base.target||(/each creature/.test(t)?"each_creature":"damage_target"),polarity:/to you|to its controller/.test(t)?"self_harm":"hostile_capable",confidence:dynamic?.78:.96,status:dynamic?COVERAGE_STATUS.PARTIAL:COVERAGE_STATUS.SUPPORTED,magnitude:{damage:m?Number(m[1]):null}});
    if(dynamic)addGap(base,"DYNAMIC_DAMAGE_MAGNITUDE");
  }
  if(/\b(?:target |this |another )?creature\b[^.]{0,120}\bfights?\b|\bfights? target creature\b/.test(t))mark(base,{action:"fight",object:"creature",polarity:"hostile_capable",confidence:.94});
  if(/^(?:it|that creature|this creature) fights?\b[^.]{0,120}\btarget creature\b/.test(t))mark(base,{action:"fight",object:"creature",polarity:"hostile_capable",confidence:.94});
  if(/\bdamage that would be dealt\b[^.]{0,160}\bis dealt to\b|\binstead (?:it|they) deals? that damage to\b/.test(t))mark(base,{action:"redirect_damage",object:"damage",beneficiary:/dealt to you/.test(t)?"opponent":"you",polarity:"protective",confidence:.9});
  if(/\bprevent\b[^.]{0,160}\bdamage\b/.test(t))mark(base,{action:"prevent_damage",object:"damage",beneficiary:/you|creature you control|permanent you control/.test(t)?"you":null,polarity:"positive",confidence:.94});

  // Life, discard, mill and library manipulation.
  if(/\b(?:gain|gains)\b[^.]{0,90}\blife\b/.test(t))mark(base,{action:"gain_life",object:"life",beneficiary:subjectBeneficiary(effectText,"gain"),polarity:"positive",confidence:.94});
  if(/\b(?:lose|loses|lost)\b[^.]{0,90}\blife\b/.test(t))mark(base,{action:"lose_life",object:"life",beneficiary:subjectBeneficiary(effectText,"lose"),polarity:/opponent/.test(t)?"hostile_capable":"negative",confidence:.94});
  if(/\byou win the game\b/.test(t))mark(base,{action:"win_game",object:"game",beneficiary:"you",polarity:"positive",confidence:.99});
  if(/\b(?:target opponent|target player|each opponent|that player|defending player|each player this [^.]{0,80}) loses? the game\b/.test(t))mark(base,{action:"lose_game",object:"game",beneficiary:/each opponent/.test(t)?"all_opponents":/target opponent/.test(t)?"opponent":/target player/.test(t)?"target_player":/that player|defending player/.test(t)?"referenced_player":"opponent",polarity:"hostile_capable",confidence:.98});
  if(/\bdiscard(?:s|ed)?\b/.test(t))mark(base,{action:"discard",object:"card",beneficiary:subjectBeneficiary(effectText,"discard"),polarity:/opponent|target player/.test(t)?"hostile_capable":"self_resource_cost",confidence:.9});
  if(/\bmill(?:s|ed)?\b|\bput\b[^.]{0,140}\bcards? from\b[^.]{0,80}\blibrary into\b[^.]{0,80}\bgraveyard/.test(t))mark(base,{action:"mill",object:"card",sourceZone:"library",destinationZone:"graveyard",beneficiary:/opponent|target player/.test(t)?"opponent":"you",polarity:/opponent|target player/.test(t)?"hostile_capable":"neutral",confidence:.88});
  if(/\bplayers? can(?:'t|not) search librar(?:y|ies)\b/.test(t))mark(base,{action:"search_restriction",object:"library",polarity:"hostile_capable",confidence:.98});
  if(/\bplayers? can(?:'t|not) draw cards?\b|\bskip (?:your|their|that player(?:'|’)s) draw step\b/.test(t))mark(base,{action:"draw_restriction",object:"draw",polarity:"hostile_capable",confidence:.98});
  if(/\blook at (?:target |defending )?player(?:'|’)s hand\b/.test(t))mark(base,{action:"look_hand",object:"hand",beneficiary:"you",polarity:"positive",confidence:.95});
  if(/\blook at target face-down (?:creature|permanent)\b/.test(t))mark(base,{action:"inspect_permanent",object:"permanent",beneficiary:"you",polarity:"positive",confidence:.94});
  if(/\blook at\b[^.]{0,160}\b(?:card|cards|top)\b/.test(t))mark(base,{action:"look_library",object:"card",beneficiary:"you",polarity:"positive",confidence:.9});
  if(/\breveal\b[^.]{0,160}\b(?:card|cards|hand|top)\b/.test(t))mark(base,{action:"reveal",object:"card",beneficiary:/you may reveal|reveal the top/.test(t)?"you":null,polarity:"neutral",confidence:.86});
  if(/\bput the rest (?:on|at) the bottom|\bput .* on the bottom of .* library|\bput .* on top of .* library/.test(t))mark(base,{action:"reorder_library",object:"card",beneficiary:"you",polarity:"positive",confidence:.88});

  if(/\bexiles? (?:the )?top\b[^.]{0,100}\bcards?\b[^.]{0,80}\blibrary\b|\bexile the top\b[^.]{0,100}\bcards?\b[^.]{0,80}\blibrary\b/.test(t))mark(base,{action:"exile_from_library",object:"card",sourceZone:"library",destinationZone:"exile",beneficiary:/opponent|that player|they/.test(t)?"opponent":"you",polarity:"neutral",confidence:.91});
  if(/\bput\b[^.]{0,120}\bcard\b[^.]{0,80}\bfrom (?:your|their) hand\b[^.]{0,80}\b(?:top|bottom) of\b[^.]{0,60}\blibrary\b/.test(t))mark(base,{action:"hand_to_library",object:"card",sourceZone:"hand",destinationZone:"library",beneficiary:/opponent|their hand/.test(t)?"opponent":"you",polarity:/opponent|their hand/.test(t)?"hostile_capable":"neutral",confidence:.9});
  if(/\byou may put\b[^.]{0,120}\b(?:creature|artifact|enchantment|permanent) card\b[^.]{0,80}\bfrom your hand onto the battlefield\b/.test(t))mark(base,{action:"put_from_hand_battlefield",object:"permanent",sourceZone:"hand",destinationZone:"battlefield",beneficiary:"you",polarity:"positive",confidence:.95});
  if(/\bshuffle (?:your|their|that player(?:'|’)s|target player(?:'|’)s)?\s*(?:graveyard|library)|\bthen (?:that player )?shuffles\b|^(?:then )?shuffle\b/.test(t))mark(base,{action:"shuffle",object:/graveyard/.test(t)?"graveyard":"library",polarity:"neutral",confidence:.94});

  // Tap/untap, control, combat and targeting restrictions.
  if(/\buntap\b/.test(t))mark(base,{action:"untap",object:base.target||"permanent",beneficiary:"you",polarity:"positive",confidence:.93});
  else if(/\btap target\b|\btap (?:x|\d+) target\b|\btap (?:one or two|two|three) target\b|\btap up to\b|\btap all\b|\btap enchanted\b|^tap it\b|^tap [^.]{0,80}creature\b/.test(t))mark(base,{action:"tap",object:base.target||(/enchanted creature/.test(t)?"enchanted_creature":"permanent"),beneficiary:/you control/.test(t)?"you":null,polarity:/you control/.test(t)?"neutral":"hostile_capable",confidence:.93});
  if(/\bgain control of\b/.test(t))mark(base,{action:"gain_control",object:base.target||"permanent",beneficiary:"you",polarity:"hostile_capable",confidence:.96});
  if(/\bcan(?:'t|not) attack|\bcan(?:'t|not) block|\bmust attack|\bmust be blocked|\bcan(?:'t|not) be blocked|\bcan block only|\battacks each combat if able/.test(t))mark(base,{action:"combat_restriction",object:"creature",polarity:/opponent|target creature/.test(t)?"hostile_capable":"neutral",confidence:.91});
  if(/\bcan(?:'t|not) be the target|\bcan(?:'t|not) target\b|\btargets? only\b/.test(t))mark(base,{action:"targeting_restriction",object:"targeting",polarity:"protective",confidence:.9});
  if(/\byou don(?:'t| not) lose unspent mana\b|\bunspent mana you have doesn(?:'t| not) empty\b/.test(t))mark(base,{action:"retain_mana",object:"mana",beneficiary:"you",polarity:"positive",confidence:.97});
  if(/\byou don(?:'t| not) lose unspent (?:white|blue|black|red|green|colorless) mana\b/.test(t))mark(base,{action:"retain_mana",object:"mana",beneficiary:"you",polarity:"positive",confidence:.97});
  if(/\byou may spend mana as though it were mana of any color\b/.test(t))mark(base,{action:"mana_spending_flexibility",object:"mana",beneficiary:"you",polarity:"positive",confidence:.97});
  if(/\b(?:each player|players|your opponents|opponents) can(?:'t|not) cast more than\b|\bcan(?:'t|not) cast more than [^.]{0,40}spells?\b/.test(t))mark(base,{action:"spell_limit",object:"spell",polarity:"hostile_capable",confidence:.95});
  if(/\b(?:players|your opponents|opponents) can(?:'t|not) cast\b|\bspells with [^.]{0,100} can(?:'t|not) be cast\b/.test(t))mark(base,{action:"casting_restriction",object:"spell",polarity:"hostile_capable",confidence:.94});
  if(/\bthis spell can(?:'t|not) be countered\b|\bcan(?:'t|not) be countered\b/.test(t))mark(base,{action:"uncounterable",object:"spell",beneficiary:"you",polarity:"protective",confidence:.98});
  if(/\bthis land enters tapped\b|\bthis (?:artifact|creature|permanent) enters tapped\b|\benters the battlefield tapped\b/.test(t))mark(base,{action:"enters_tapped",object:"permanent",polarity:"negative",confidence:.98});
  if(/^it enters tapped\b/.test(t)){mark(base,{action:"enters_tapped",object:"referenced_permanent",polarity:"negative",confidence:.82,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}
  if(/^if you don(?:'t| not),? (?:it|this (?:land|permanent|creature|artifact|enchantment)) enters tapped\b/.test(t)){mark(base,{action:"enters_tapped",object:"referenced_permanent",polarity:"negative",confidence:.8,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}
  if(/\bcan(?:'t|not) be regenerated\b/.test(t))mark(base,{action:"regeneration_restriction",object:"permanent",polarity:"hostile_capable",confidence:.94});
  if(/\bdamage can(?:'t|not) be prevented\b/.test(t))mark(base,{action:"damage_prevention_restriction",object:"damage",polarity:"hostile_capable",confidence:.97});
  if(/\bcast this spell only during\b|\byou may cast this spell only\b/.test(t))mark(base,{action:"casting_restriction",object:"spell",polarity:"negative",confidence:.96});
  if(/\bany player may activate this ability\b/.test(t))mark(base,{action:"activation_permission",object:"ability",beneficiary:"all_players",polarity:"neutral",confidence:.95});
  if(/\byou have no maximum hand size\b/.test(t))mark(base,{action:"hand_size_rule",object:"hand",beneficiary:"you",polarity:"positive",confidence:.99});
  if(/\b(?:it(?:'s| is)|they(?:'re| are)) still (?:a )?lands?\b/.test(t))mark(base,{action:"retain_characteristic",object:"land",polarity:"neutral",confidence:.96});
  if(/\bthat creature can(?:'t|not) become untapped\b/.test(t))mark(base,{action:"untap_restriction",object:"referenced_creature",polarity:"hostile_capable",confidence:.86,status:COVERAGE_STATUS.PARTIAL});
  if(/\bactivated abilities?\b[^.]{0,120}\bcan(?:'t|not) be activated\b/.test(t))mark(base,{action:"activation_restriction",object:"ability",polarity:"hostile_capable",confidence:.94});
  if(/\bthis creature can block (?:an additional creature|any number of creatures)\b/.test(t))mark(base,{action:"combat_permission",object:"block",beneficiary:"you",polarity:"positive",confidence:.95});
  if(/\ball creatures able to block\b[^.]{0,100}\bdo so\b/.test(t))mark(base,{action:"combat_restriction",object:"block",polarity:"hostile_capable",confidence:.94});

  // Additional/alternate casting costs are costs, not the effect they pay for.
  if(/\bas an additional cost\b/.test(t))mark(base,{action:"additional_cost",object:"cost",beneficiary:"self_spell",polarity:"negative",confidence:.95,force:true});

  // Sacrifice and forced sacrifice.
  if(/\bsacrifices?\b/.test(t) && !/\bas an additional cost\b/.test(t)){
    const forced=/\b(?:target|each) opponent\b[^.]{0,100}\bsacrifices?\b|\b(?:target|each) player\b[^.]{0,100}\bsacrifices?\b|\bthat player\b[^.]{0,100}\bsacrifices?\b/.test(t);
    mark(base,{action:"sacrifice",object:/creature/.test(t)?"creature":"permanent",beneficiary:forced?"opponent":"you",polarity:forced?"hostile_capable":"self_resource_cost",confidence:.9});
  }

  // Referenced-object continuations remain explicit partial semantics until cross-clause references are linked.
  if(/\byou may (?:play|cast) (?:that|those|it|them)\b/.test(t)){mark(base,{action:"play_referenced_card",object:"referenced_card",beneficiary:"you",polarity:"positive",confidence:.75,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}
  if(/\b(?:return|exile|put) (?:it|that card|those cards|them)\b/.test(t)){mark(base,{action:/^exile|\bexile\b/.test(t)?"exile_referenced":"move_referenced",object:"referenced_object",confidence:.72,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}
  if(/\bput (?:this card|target card) from exile onto the battlefield\b/.test(t))mark(base,{action:"return_from_exile",object:"card",sourceZone:"exile",destinationZone:"battlefield",owner:/this card/.test(t)?"you":null,beneficiary:"you",polarity:"positive",confidence:.95});
  if(/\bput your commander into your hand from the command zone\b/.test(t))mark(base,{action:"move_zone",object:"commander",sourceZone:"command",destinationZone:"hand",owner:"you",beneficiary:"you",polarity:"positive",confidence:.97});
  if(/\bput\b[^.]{0,140}\b(?:creature|artifact|enchantment|land|card)\b[^.]{0,100}\bfrom among (?:them|those cards)\b[^.]{0,100}\b(?:into your hand|onto the battlefield)\b/.test(t)){
    mark(base,{action:/battlefield/.test(t)?"put_referenced_battlefield":"select_referenced_to_hand",object:"referenced_card",destinationZone:/battlefield/.test(t)?"battlefield":"hand",beneficiary:"you",polarity:"positive",confidence:.8,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");
  }
  if(/\bcopy target (?:activated|triggered) ability\b/.test(t)||/\bcopy target activated or triggered ability\b/.test(t))mark(base,{action:"copy_ability",object:"ability",beneficiary:"you",polarity:"positive",confidence:.97});

  // Casting/play permissions, costs and restrictions.
  if(/\byou may cast this spell as though it had flash\b|\byou may cast [^.]{0,100} as though (?:it|they) had flash\b/.test(t))mark(base,{action:"timing_permission",object:"spell",beneficiary:"you",polarity:"positive",confidence:.96});
  if(/\byou may cast target [^.]{0,120}\bcard in a graveyard\b/.test(t))mark(base,{action:"cast_from_zone",object:"card",sourceZone:"graveyard",owner:"any",beneficiary:"you",polarity:"positive",confidence:.94});
  if(/\b(?:you may|you can) (?:cast|play)\b[^.]{0,180}\b(?:from|out of) (?:your )?(graveyard|exile|library|the top of your library)\b|\bcast\b[^.]{0,120}\bfrom your graveyard\b/.test(t)){
    const zone=/graveyard/.test(t)?"graveyard":/exile/.test(t)?"exile":/library/.test(t)?"library":null;
    mark(base,{action:"cast_from_zone",object:"card",sourceZone:zone,beneficiary:"you",polarity:"positive",confidence:.93});
  }
  if(/\byou may cast\b[^.]{0,160}\bfrom (?:the top of )?(?:your|any|another player(?:'|’)s|that player(?:'|’)s) graveyard\b/.test(t)){
    mark(base,{action:"cast_from_zone",object:"card",sourceZone:"graveyard",owner:/your graveyard/.test(t)?"you":/any graveyard/.test(t)?"any":"referenced_player",beneficiary:"you",polarity:"positive",confidence:.94});
  }
  if(/\byou may cast target\b[^.]{0,140}\bcard from (?:that player(?:'|’)s|target player(?:'|’)s|an opponent(?:'|’)s) graveyard\b/.test(t)){
    mark(base,{action:"cast_from_zone",object:"card",sourceZone:"graveyard",owner:"opponent",beneficiary:"you",polarity:"positive",confidence:.95});
  }
  if(/\byou may (?:cast|play) (?:this card|the exiled card|cards? exiled this way|the exiled cards?)\b[^.]{0,140}\b(?:remains? exiled|until|this turn|your next turn|end of)\b/.test(t)){
    mark(base,{action:"cast_from_zone",object:"card",sourceZone:"exile",beneficiary:"you",polarity:"positive",confidence:.9});
  }
  if(/\b(?:its owner|that card(?:'|’)s owner) may (?:play|cast) it\b/.test(t)&&/\bremains? exiled\b|\bexiled\b/.test(lower(rawText)))
    mark(base,{action:"play_from_exile",object:"referenced_card",sourceZone:"exile",beneficiary:"object_owner",polarity:"neutral",confidence:.84,status:COVERAGE_STATUS.PARTIAL});
  if(/\byou may (?:play|cast) lands? and cast spells? from among cards in your graveyard\b|\byou may play lands? and cast spells? from (?:your|among cards in your) graveyard\b/.test(t)){
    mark(base,{action:"cast_from_zone",object:"card",sourceZone:"graveyard",owner:"you",beneficiary:"you",polarity:"positive",confidence:.95});
  }
  if(/\bplay with the top card of your library revealed\b|\byou may (?:play|cast) (?:the top card|cards? from the top) of your library\b/.test(t))
    mark(base,{action:"play_from_top",object:"card",sourceZone:"library",beneficiary:"you",polarity:"positive",confidence:.93});
  if(/\byou may (?:cast|play) (?:any number of )?(?:spells?|cards?) from among (?:them|those cards|cards exiled this way)\b/.test(t)){
    mark(base,{action:"cast_referenced_cards",object:"referenced_card",beneficiary:"you",polarity:"positive",confidence:.78,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");
  }
  // Free-cast permissions often reference cards selected/exiled by a previous
  // clause. Preserve the alternate-cost fact even before reference linkage.
  if(/\byou may cast [^.]{0,160}\bwithout paying (?:their|its) mana costs?\b|\byou may cast the other cards? without paying (?:their|its) mana costs?\b/.test(t)){
    mark(base,{action:"cast_referenced_cards",object:"referenced_card",beneficiary:"you",polarity:"positive",confidence:.84,status:COVERAGE_STATUS.PARTIAL,details:{alternateCost:"without_paying_mana_cost"}});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");
  }
  if(/\bspend only mana produced by [^.]{0,100} to cast this spell\b/.test(t))
    mark(base,{action:"mana_spending_restriction",object:"spell_cost",beneficiary:"you",polarity:"negative",confidence:.98,details:{restriction:clean(rawText)}});
  if(/\byou can cast spells only during your turn\b|\byou can cast no more than [^.]{0,40} spells each turn\b/.test(t))
    mark(base,{action:"casting_restriction",object:"spell",beneficiary:"you",polarity:"negative",confidence:.97,details:{restriction:clean(rawText)}});
  if(/\byou may cast spells with mana value [^.]{0,120} without paying their mana costs\b/.test(t))
    mark(base,{action:"alternate_cost",object:"spell_cost",beneficiary:"you",polarity:"positive",confidence:.95,details:{scope:"qualified_spells"}});
  if(/\brather than pay (?:this spell(?:'|’)s|its) mana cost|\byou may pay\b[^.]{0,120}\brather than\b|\bwithout paying (?:its|their) mana cost\b/.test(t)){
    mark(base,{action:"alternate_cost",object:"spell_cost",beneficiary:"you",polarity:"positive",confidence:.9});base.alternateCost=clean(rawText);
  }
  if(/\bflashback cost is equal to\b/.test(t))mark(base,{action:"alternate_cost_definition",object:"flashback_cost",beneficiary:"you",polarity:"neutral",confidence:.92});
  if(/\b(?:foretell|harmonize|encore|escape) cost is equal to\b/.test(t))mark(base,{action:"alternate_cost_definition",object:"alternate_cost",beneficiary:"you",polarity:"neutral",confidence:.9});
  if(/\bcast this spell only if\b/.test(t))mark(base,{action:"casting_restriction",object:"spell",polarity:"negative",confidence:.97});
  if(/\bthis spell can(?:'t|not) be copied\b/.test(t))mark(base,{action:"copy_restriction",object:"spell",polarity:"protective",confidence:.98});
  if(/\bspend only\b[^.]{0,100}\bmana\b[^.]{0,80}\bon x\b/.test(t))mark(base,{action:"mana_spending_restriction",object:"mana_cost",polarity:"negative",confidence:.9});
  if(/\bthis effect reduces only the amount of\b[^.]{0,100}\bmana you pay\b/.test(t)){mark(base,{action:"cost_reduction_constraint",object:"spell_cost",beneficiary:"you",polarity:"neutral",confidence:.78,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}
  if(/\bthose spells cost\b[^.]{0,80}\bless to cast\b/.test(t)){mark(base,{action:"reduce_cost_referenced",object:"spell_cost",beneficiary:"you",polarity:"positive",confidence:.78,status:COVERAGE_STATUS.PARTIAL});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}
  if(/\bthis ability costs?\b[^.]{0,100}\bless to activate\b/.test(t))mark(base,{action:"reduce_activation_cost",object:"activation_cost",beneficiary:"you",polarity:"positive",confidence:.95});
  if(/\babilities?\b[^.]{0,140}\bopponents? activate\b[^.]{0,120}\bcosts?\b[^.]{0,80}\bmore to activate\b/.test(t))mark(base,{action:"increase_activation_cost",object:"activation_cost",beneficiary:"you",polarity:"hostile_capable",confidence:.95});
  if(/\bactivate only\b|\bactivate this ability only\b/.test(t))mark(base,{action:"activation_restriction",object:"ability",polarity:"neutral",confidence:.96,details:{restriction:clean(rawText)}});
  if(/\bthis ability triggers only\b/.test(t))mark(base,{action:"trigger_restriction",object:"ability",polarity:"neutral",confidence:.96,details:{restriction:clean(rawText)}});

  if(/^level \d+/i.test(t)||/^\d+\/\d+$/.test(t)||/^[−-]\d+:?\s*you get an emblem\b/.test(t))mark(base,{action:/emblem/.test(t)?"create_emblem":"level_characteristic",object:/emblem/.test(t)?"emblem":"level",beneficiary:"you",polarity:"positive",confidence:.96});
  if(/\bthe ring tempts you\b/.test(t))mark(base,{action:"ring_tempts",object:"ring",beneficiary:"you",polarity:"positive",confidence:.99});
  if(/\bbecome the monarch\b/.test(t))mark(base,{action:"become_monarch",object:"monarch",beneficiary:"you",polarity:"positive",confidence:.99});
  if(/\bafter this phase, there is an additional combat phase\b/.test(t))mark(base,{action:"extra_combat",object:"combat_phase",beneficiary:"you",polarity:"positive",confidence:.98});

  // Keyword-like game actions.
  const simpleActions=[
    ["scr(?:y|ies)","scry"],["surveil(?:s)?","surveil"],["proliferate(?:s)?","proliferate"],["investigate(?:s)?","investigate"],["explore(?:s)?","explore"],["connive(?:s)?","connive"],
    ["discover(?:s)?","discover"],["venture(?:s)? into","venture"],["transform(?:s)?","transform"],["attach(?:es)?","attach"],["phase(?:s)? out","phase_out"],["regenerate(?:s)?","regenerate"],
    ["goad(?:s|ed)?","goad"],["suspect(?:s|ed)?","suspect"],["manifest(?:s|ed)?","manifest"],["adapt(?:s|ed)?","adapt"],["monstrosity","monstrosity"],["support","support"],["exert(?:s|ed)?","exert"]
  ];
  for(const [pattern,action] of simpleActions){if(new RegExp(`\\b${pattern}\\b`).test(t))mark(base,{action,object:action==="phase_out"?"permanent":null,beneficiary:"you",polarity:["phase_out","regenerate"].includes(action)?"protective":"positive",confidence:.9});}
  if(/\b(?:take|takes) the initiative\b/.test(t))mark(base,{action:"take_initiative",object:"initiative",beneficiary:"you",polarity:"positive",confidence:.97});
  if(/\bopen(?:s)? an attraction\b/.test(t))mark(base,{action:"open_attraction",object:"attraction",beneficiary:"you",polarity:"positive",confidence:.96});
  if(/\bbecomes? foretold\b/.test(t))mark(base,{action:"foretell",object:"card",beneficiary:"you",polarity:"positive",confidence:.93});
  if(/\bextra turn\b/.test(t))mark(base,{action:"extra_turn",object:"turn",beneficiary:/target player/.test(t)?"target_player":"you",polarity:"positive",confidence:.98});

  const bareProtective=keywordFromText(effectText).filter(k=>ROLE_RELEVANT_KEYWORDS.has(k));
  if(!base.action&&bareProtective.length){mark(base,{action:"keyword_option",object:"keyword",polarity:"protective",confidence:.7,status:COVERAGE_STATUS.PARTIAL,details:{keywords:bareProtective}});addGap(base,"REFERENCE_RESOLUTION_REQUIRED");}

  // Keyword grants/removals are semantic facts, but preserve the specific keyword set.
  const keywordHits=keywordFromText(rawText).filter(k=>ROLE_RELEVANT_KEYWORDS.has(k)||/\b(?:gains?|loses?|have|has|with)\b/.test(t));
  if(keywordHits.length && /\b(?:gains?|loses?|have|has|with)\b/.test(t)){
    const removing=/\bloses?\b/.test(t);
    mark(base,{action:removing?"remove_keyword":"grant_keyword",object:"keyword",beneficiary:/opponent/.test(t)?"opponent":"you",polarity:removing?"hostile_capable":"protective",confidence:.93,details:{keywords:keywordHits}});
  }
  if(/\b(?:target|this|equipped|enchanted|other) [^.]{0,90}\b(?:gains?|has|have)\b[^.]{1,80}(?:until end of turn|as long as|\.)?$/.test(t) && !base.action){
    const m=effectText.match(/\b(?:gains?|has|have)\s+([^.;]{1,80}?)(?:\s+until end of turn|\s+as long as|\.)?$/i);
    if(m)mark(base,{action:"grant_named_ability",object:"ability",beneficiary:/opponent controls/.test(t)?"opponent":"you",polarity:"positive",confidence:.78,status:COVERAGE_STATUS.PARTIAL,details:{abilityText:clean(m[1])}});
  }

  // Pure payment/choice prompts often gate a later clause in the same Oracle
  // ability. Preserve them as explicit partial semantics instead of treating
  // the prompt itself as an unknown effect.
  if(!base.action && /\byou may pay\b[^.]*\.?$/.test(t)){
    mark(base,{action:"payment_option",object:"cost",beneficiary:"you",polarity:"neutral",confidence:.78,status:COVERAGE_STATUS.PARTIAL,details:{paymentText:clean(effectText)}});
    addGap(base,"REFERENCE_RESOLUTION_REQUIRED");
  }

  if(/^choose (?:target |a player\b|a creature type\b|a nonland card name\b|a card name\b|left or right\b|friend or foe\b)/.test(t))mark(base,{action:"choose",object:"choice",beneficiary:"you",polarity:"neutral",confidence:.88});
  if(/^choose (?:a )?color\b/.test(t))mark(base,{action:"choose_color",object:"color",beneficiary:"you",polarity:"neutral",confidence:.96});
  if(/^choose (?:one|two|three|x|one or both)\.?$/.test(t)||/^choose one or both\s*[—-]?$/.test(t)||/\byou may choose the same mode more than once\b/.test(t)){
    mark(base,{action:"modal_instruction",object:"options",beneficiary:"you",polarity:"neutral",confidence:.9,status:COVERAGE_STATUS.PARTIAL});addGap(base,"MODAL_OPTIONS_UNLINKED");
  }
  if(/\bchoose a creature type\b/.test(t))mark(base,{action:"choose_creature_type",object:"creature_type",beneficiary:"you",polarity:"neutral",confidence:.98});
  if(/\b(?:target opponent|target player) reveals? (?:their|his or her) hand\b/.test(t))mark(base,{action:"reveal_hand",object:"hand",beneficiary:/opponent/.test(t)?"opponent":"target_player",polarity:"neutral",confidence:.95});

  // Modal text is preserved as partial until individual option linkage is modeled.
  if(/\bchoose (?:one|two|three|a|an|x|\d+)(?: or more)?\s*[—-]/.test(t)||/^choose one or more\b/.test(t)){
    if(!base.action)mark(base,{action:"modal_choice",object:"options",confidence:.74,status:COVERAGE_STATUS.PARTIAL});
    addGap(base,"MODAL_OPTIONS_UNLINKED");
  }

  const authoritativeKeywords=new Set((ctx.keywords||[]).map(lower));
  const keywordHit=[...authoritativeKeywords,...KNOWN_KEYWORDS].find(k=>new RegExp(`^${String(k).replace(/ /g,"\\s+")}\\b`,`i`).test(rawText));
  if(!base.action && keywordHit)mark(base,{action:"keyword",object:keywordHit,confidence:.98});

  if(!base.action)base.unsupportedPatterns.push("UNPARSED_CLAUSE");
  else if(base.unsupportedPatterns.length && base.status===COVERAGE_STATUS.SUPPORTED)base.status=COVERAGE_STATUS.PARTIAL;
  return base;
}

function compileAbility(rawText,ctx,index){
  const granted=detectGrantedRules(rawText);
  const topLevelText=granted.length?granted.reduce((s,q)=>s.replace(q,"<GRANTED_RULES>"),rawText):rawText;
  const clauses=splitTopLevelClauses(topLevelText).map((text,i)=>compileClause(text,{...ctx,abilityText:topLevelText,clauseIndex:i}));
  const embeddedAbilities=granted.map((text,i)=>({
    index:i,rawText:text,embedded:true,grantedByAbility:index,
    clauses:splitTopLevelClauses(text).map((clause,j)=>({...compileClause(clause,{...ctx,abilityText:text,clauseIndex:j}),embedded:true}))
  }));
  if(granted.length){
    for(const clause of clauses){
      clause.details.grantedRulesCount=granted.length;
      clause.unsupportedPatterns=uniq([...clause.unsupportedPatterns,"EMBEDDED_GRANTED_RULES"]);
      if(clause.status===COVERAGE_STATUS.SUPPORTED)clause.status=COVERAGE_STATUS.PARTIAL;
    }
  }
  const statuses=clauses.map(c=>c.status);
  const status=statuses.every(x=>x===COVERAGE_STATUS.SUPPORTED)?COVERAGE_STATUS.SUPPORTED:statuses.some(x=>x!==COVERAGE_STATUS.GAP)?COVERAGE_STATUS.PARTIAL:COVERAGE_STATUS.GAP;
  return {index,rawText,kind:detectTrigger(rawText).kind,status,clauses,embeddedAbilities};
}

function normalizeFaces(raw){
  if(Array.isArray(raw?.card_faces)&&raw.card_faces.length)return raw.card_faces.map((face,index)=>({...face,index}));
  return [{...raw,index:0}];
}

export function compileCard(raw,{source="scryfall"}={}){
  if(!raw || typeof raw!=="object")throw new TypeError("compileCard expects a Scryfall-like card object");
  const oracleId=String(raw.oracle_id||raw.oracleId||raw.id||"").trim();
  if(!oracleId)throw new Error("semantic compiler requires oracle_id (or stable id for synthetic fixtures)");
  const faces=normalizeFaces(raw).map(face=>{
    const typeLine=String(face.type_line??raw.type_line??"");
    const parts=typeParts(typeLine);
    const oracleText=String(face.oracle_text??raw.oracle_text??"");
    const cardCost=parseManaCostText(face.mana_cost??raw.mana_cost??"");
    const ctx={typeLine,cardTypes:parts.cardTypes,subtypes:parts.subtypes,cardCost,manaValue:Number(face.cmc??raw.cmc??0)||0,keywords:uniq(face.keywords??raw.keywords??[])};
    const abilities=splitOracleAbilities(oracleText).map((text,index)=>compileAbility(text,ctx,index));
    // Basic land types carry intrinsic mana abilities through the Comprehensive Rules even
    // when Oracle text does not print them (dual/shock lands, Dryad Arbor, etc.).
    // Derive this once in the Semantic Compiler so downstream roles/builders never need
    // to reinterpret type lines independently.
    const basicTypeColor={Plains:"W",Island:"U",Swamp:"B",Mountain:"R",Forest:"G"};
    const intrinsicColors=uniq(parts.subtypes.map(st=>basicTypeColor[st]).filter(Boolean));
    const alreadyHasMana=abilities.some(a=>a.clauses?.some(c=>c.action==="add_mana"));
    if(parts.cardTypes.includes("Land")&&intrinsicColors.length&&!alreadyHasMana){
      const intrinsicText=`{T}: Add ${intrinsicColors.map(c=>`{${c}}`).join(" or ")}.`;
      const intrinsic=compileAbility(intrinsicText,ctx,abilities.length);
      intrinsic.intrinsic=true;intrinsic.source="basic_land_type";
      for(const c of intrinsic.clauses||[]){c.details={...(c.details||{}),intrinsic:true,derivedFrom:"type_line_basic_land_type"};}
      abilities.push(intrinsic);
    }
    const unsupportedPatterns=uniq(abilities.flatMap(a=>[...a.clauses.flatMap(c=>c.unsupportedPatterns),...a.embeddedAbilities.flatMap(e=>e.clauses.flatMap(c=>c.unsupportedPatterns))]));
    const statuses=abilities.map(a=>a.status);
    const status=!abilities.length?COVERAGE_STATUS.SUPPORTED:statuses.every(x=>x===COVERAGE_STATUS.SUPPORTED)?COVERAGE_STATUS.SUPPORTED:statuses.some(x=>x!==COVERAGE_STATUS.GAP)?COVERAGE_STATUS.PARTIAL:COVERAGE_STATUS.GAP;
    return {index:face.index,name:String(face.name??raw.name??""),typeLine,cardTypes:parts.cardTypes,subtypes:parts.subtypes,manaCost:String(face.mana_cost??raw.mana_cost??""),manaValue:ctx.manaValue,oracleText,abilities,status,unsupportedPatterns};
  });
  const statuses=faces.map(f=>f.status);
  const status=statuses.every(x=>x===COVERAGE_STATUS.SUPPORTED)?COVERAGE_STATUS.SUPPORTED:statuses.some(x=>x!==COVERAGE_STATUS.GAP)?COVERAGE_STATUS.PARTIAL:COVERAGE_STATUS.GAP;
  const unsupportedPatterns=uniq(faces.flatMap(f=>f.unsupportedPatterns));
  return {schema:SEMANTIC_SCHEMA,schemaVersion:SEMANTIC_SCHEMA_VERSION,compilerVersion:SEMANTIC_COMPILER_VERSION,source,oracleId,name:String(raw.name||faces.map(f=>f.name).join(" // ")),layout:String(raw.layout||"normal"),keywords:uniq(raw.keywords||[]),colorIdentity:uniq(raw.color_identity||raw.colorIdentity||[]),legalities:raw.legalities||null,faces,status,unsupportedPatterns,provenance:{scryfallId:raw.id||null,lastUpdated:raw.updated_at||null}};
}

export function semanticClauses(card,{includeEmbedded=false}={}){
  const out=[];
  for(const face of card?.faces||[])for(const ability of face.abilities||[]){
    for(const clause of ability.clauses||[])out.push({card,face,ability,clause,embedded:false});
    if(includeEmbedded)for(const embedded of ability.embeddedAbilities||[])for(const clause of embedded.clauses||[])out.push({card,face,ability:embedded,clause,embedded:true});
  }
  return out;
}

export function semanticFacts(card,{includeEmbedded=false}={}){
  const out=[];
  for(const entry of semanticClauses(card,{includeEmbedded})){
    const {clause}=entry;
    out.push({...entry,fact:clause,secondary:false});
    for(const sf of clause?.details?.secondaryFacts||[]){
      out.push({...entry,fact:{...clause,...sf,rawText:clause.rawText,details:{...(sf.details||{}),parentAction:clause.action},dependencies:clause.dependencies||[],dependencyGroups:clause.dependencyGroups||[],unsupportedPatterns:sf.status===COVERAGE_STATUS.PARTIAL?(clause.unsupportedPatterns||[]):[]},secondary:true});
    }
  }
  return out;
}

export function cardManaProfile(card){
  const costs=(card?.faces||[]).map(f=>parseManaCostText(f.manaCost));
  return {faces:costs,minTotalMana:costs.length?Math.min(...costs.map(c=>c.minimumMana)):0,colorPips:costs.map(c=>c.coloredPips),variable:costs.some(c=>c.variable)};
}

export const compilerInternals={splitOracleAbilities,splitTopLevelClauses,parseManaCostText,detectSpellScope,detectActor,detectTrigger,dependencyFacts,parseMassEffect,manaSemantics};
