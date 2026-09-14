// ManaShelf archetype contract engine.
// Card classification is intentionally theme-agnostic. This module is the only place that
// interprets canonical card semantics against a requested deck archetype/theme.

const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 +/’-]+/g," ").replace(/\s+/g," ").trim();
const roleIds=card=>(card?.semantic?.roles||[]).map(r=>r?.id||r);
const roleConfidence=(card,id)=>Math.max(0,...(card?.semantic?.roles||[]).filter(r=>(r?.id||r)===id).map(r=>Number(r?.confidence??1)));
const typeOf=card=>String(card?.meta?.typeLine??card?.typeLine??"").toLowerCase();
const oracleOf=card=>String(card?.meta?.oracleText??card?.oracleText??"").toLowerCase();
const semanticOf=card=>card?.semantic||{};
const factsOf=card=>semanticOf(card)?.facts||{};
const tagsOf=card=>new Set(semanticOf(card)?.synergyTags||[]);
const producesOf=card=>new Set(semanticOf(card)?.produces||[]);

export function themeFlags(themeName=""){
  const t=norm(themeName);
  return {
    voltron:/\bvoltron\b/.test(t),
    artifacts:/artifact|equipment|vehicle|treasure|clue|food/.test(t),
    equipment:/\bequipment\b/.test(t),
    vehicles:/\bvehicles?\b/.test(t),
    artifactTokens:/treasure|clue|food|blood|map|powerstone|gold/.test(t),
    spells:/spellslinger|instant|sorcer|storm|magecraft|prowess/.test(t),
    enchantments:/enchant|aura|constellation/.test(t),
    auras:/\bauras?\b/.test(t),
    historic:/\bhistoric\b/.test(t),
    legends:/legendary|legends? matter/.test(t),
    creatures:/kindred|tribal|dragon|elf|goblin|zombie|vampire|angel|demon|human|soldier|warrior|wizard|merfolk|sliver|dinosaur|cat|dog|rat|snake|spirit|faerie|knight|samurai|ninja|rogue|cleric|shaman|elemental|beast/.test(t),
    creatureEngine:/token|aristocrat|sacrifice|\+1\/\+1|counter|blink|etb|lifegain|reanimator|graveyard/.test(t),
    lands:/landfall|lands? matter|land theme|land recursion/.test(t),
    tokens:/\btokens?\b/.test(t),
    clones:/\bclones?\b|copy theme|copy matters|shapeshifter/.test(t),
    rampTheme:/^ramp$|\bramp\b|mana acceleration/.test(t),
    reanimator:/reanimator|reanimation|graveyard recursion/.test(t),
    aristocrats:/aristocrat|sacrifice|death|dies/.test(t),
    lifegain:/lifegain|life gain/.test(t),
    blink:/\bblink\b|\betb\b|enter the battlefield/.test(t)
  };
}

export function archetypeKind(themeName=""){
  const f=themeFlags(themeName);
  if(f.voltron)return "voltron";
  if(f.equipment)return "equipment";
  if(f.auras)return "auras";
  if(f.vehicles)return "vehicles";
  if(f.artifactTokens)return "artifact_tokens";
  if(f.historic)return "historic";
  if(f.legends)return "legends";
  if(f.tokens)return "tokens";
  if(f.clones)return "clones";
  if(f.rampTheme)return "ramp";
  if(f.reanimator)return "reanimator";
  if(f.artifacts)return "artifacts";
  if(f.enchantments)return "enchantments";
  if(f.spells)return "spells";
  if(f.lands)return "lands";
  if(f.aristocrats)return "aristocrats";
  if(f.lifegain)return "lifegain";
  if(f.blink)return "blink";
  return "generic";
}

function themeWords(themeName=""){
  return norm(themeName).split(/\s+/).filter(w=>w.length>=3&&!new Set(["theme","tribal","kindred","matter","matters","deck","cards","card","the","and","with","good","stuff","balanced"]).has(w));
}
function singularWord(s=""){const x=norm(s);if(x.endsWith("ies")&&x.length>4)return `${x.slice(0,-3)}y`;if(x.endsWith("s")&&!x.endsWith("ss")&&x.length>3)return x.slice(0,-1);return x}
function subtypeMatchesTheme(subtype,words){const sub=singularWord(String(subtype||"").replace(/_/g," "));return [...words].some(w=>{const ww=singularWord(w);return ww===sub||ww.includes(sub)||sub.includes(ww)})}
function literalSubtypeAffinity(card,themeName=""){
  const words=new Set(themeWords(themeName)),produces=producesOf(card);
  for(const tag of produces){if(!tag.startsWith("spell:subtype:"))continue;const subtype=tag.slice("spell:subtype:".length);if(subtypeMatchesTheme(subtype,words))return .94}
  const deps=[...(semanticOf(card)?.dependencies||[]),...(semanticOf(card)?.themeDependencies||[])];
  for(const dep of deps){if(!dep.startsWith("spell:subtype:"))continue;const subtype=dep.slice("spell:subtype:".length);if(subtypeMatchesTheme(subtype,words))return .86}
  return 0;
}

const compatibleSpellScope=scope=>["instant_sorcery","noncreature","any"].includes(String(scope||""));
const depGroup=deps=>[...new Set((deps||[]).filter(Boolean))];
const abilityGroups=(facts,effectNames=null)=>{
  const wanted=effectNames?new Set(effectNames):null,out=[];
  for(const a of facts?.abilities||[]){
    if(a?.effects?.negative)continue;
    if(wanted&&!(a?.effects?.positive||[]).some(x=>wanted.has(x)))continue;
    out.push(depGroup(a?.dependencies));
  }
  return out;
};

// Dependency paths are theme-specific views over neutral semantics. Inner arrays are
// conjunctive prerequisites for one ability/path; outer arrays are alternatives. This is
// deliberately separate from archetypeAffinity: semantic relevance answers "what does this
// card do?", while the builder later answers "can THIS deck support that way of doing it?".
export function archetypeDependencyGroups(card,themeName=""){
  const kind=archetypeKind(themeName),facts=factsOf(card),semantic=semanticOf(card),type=typeOf(card),groups=[];
  const literal=literalSubtypeAffinity(card,themeName);
  if(literal){
    const words=new Set(themeWords(themeName));
    const matching=(semantic.themeDependencies||[]).filter(dep=>dep.startsWith("spell:subtype:")&&subtypeMatchesTheme(dep.slice("spell:subtype:".length),words));
    if(matching.length)groups.push(depGroup(matching));
    if([...producesOf(card)].some(tag=>tag.startsWith("spell:subtype:")&&subtypeMatchesTheme(tag.slice("spell:subtype:".length),words)))groups.push([]);
    return groups.length?groups:[[]];
  }
  if(["voltron","equipment","auras","vehicles","clones","lifegain","blink"].includes(kind))return [[]];
  if(kind==="spells"){
    // Being an instant/sorcery or carrying an actual relevant keyword is intrinsic and has
    // no deck-support prerequisite. Conditional payoffs/reducers preserve their own scope.
    if(/\b(?:instant|sorcery)\b/.test(type)||(facts.keywords||[]).some(k=>["magecraft","prowess","storm"].includes(k)))groups.push([]);
    for(const a of facts.castInteractions||[]){
      const r=a?.spellRequirement;if(!r||a?.effects?.negative||!(a?.effects?.positive||[]).length||r.ownership==="not_owned"||!(r.scopes||[]).some(compatibleSpellScope))continue;
      groups.push(depGroup(r.dependencies));
    }
    for(const r of facts.costReductionRequirements||[])if(r.ownership!=="not_owned"&&(r.scopes||[]).some(compatibleSpellScope))groups.push(depGroup(r.dependencies));
    if(facts.spellCopySupportsSpellslinger){
      const scopes=facts.copySpellScopes||[];if(scopes.includes("instant_sorcery"))groups.push(["spell:instant_sorcery"]);else if(scopes.includes("noncreature"))groups.push(["spell:noncreature"]);else groups.push(["spell:any"]);
    }
    if(facts.spellslingerRelevant&&!groups.length)groups.push([]); // typed graveyard/support text
    return groups;
  }
  if(kind==="tokens"||kind==="artifact_tokens"){
    groups.push(...abilityGroups(facts,["token","treasure"]));
    if((facts.tokenMultiplier||facts.tokenSupport)&&!groups.length){const d=(semantic.dependencies||[]).filter(x=>x==="tokens");groups.push(d.length?d:[])}
    if((facts.tokenForYou||roleIds(card).includes("token_generation"))&&!groups.length)groups.push([]);
    return groups;
  }
  if(kind==="ramp"){
    const roleGroups=semantic.roleDependencyGroups?.ramp||[];return roleGroups.length?roleGroups:[[]];
  }
  if(kind==="artifacts"){
    if(type.includes("artifact"))groups.push([]);
    if(facts.artifactSupport){const d=(semantic.dependencies||[]).filter(x=>x==="artifacts");groups.push(d.length?d:[])}
    for(const dep of semantic.themeDependencies||[])if(dep==="spell:artifact")groups.push([dep]);
    return groups;
  }
  if(kind==="enchantments"){
    if(type.includes("enchantment"))groups.push([]);
    if(facts.enchantmentSupport){const d=(semantic.dependencies||[]).filter(x=>x==="enchantments");groups.push(d.length?d:[])}
    for(const dep of semantic.themeDependencies||[])if(dep==="spell:enchantment")groups.push([dep]);
    return groups;
  }
  if(kind==="historic"){
    if(producesOf(card).has("spell:historic"))groups.push([]);
    for(const dep of semantic.themeDependencies||[])if(dep==="spell:historic")groups.push([dep]);return groups;
  }
  if(kind==="legends"){
    if(producesOf(card).has("spell:legendary"))groups.push([]);
    for(const dep of semantic.themeDependencies||[])if(dep==="spell:legendary")groups.push([dep]);return groups;
  }
  if(kind==="reanimator")return roleIds(card).includes("recursion")?[["graveyard"]]:((semantic.dependencies||[]).includes("graveyard")?[["graveyard"]]:[[]]);
  if(kind==="aristocrats"){
    const deps=(semantic.dependencies||[]).filter(x=>["creatures","tokens"].includes(x));return deps.length?[deps]:[[]];
  }
  if(kind==="lands")return (semantic.dependencies||[]).includes("lands")?[["lands"]]:[[]];
  return [];
}

function genericSemanticAffinity(card,themeName=""){
  const t=norm(themeName),facts=factsOf(card),ids=new Set(roleIds(card)),tags=tagsOf(card),text=oracleOf(card),keywords=new Set((facts.keywords||[]).map(norm));
  // These are archetype contracts too, just not large enough to need a dedicated kind.
  // They consume canonical roles/facts/keyword metadata in one shared place. Raw Oracle is
  // only used here for concepts the neutral parser does not yet expose, never independently
  // in server/builder scoring paths.
  if(/\bburn\b/.test(t))return (facts.abilities||[]).some(a=>(a.effects?.positive||[]).includes("damage")&&!a.effects?.negative)?.86:ids.has("damage_engine")?.82:0;
  if(/infect|poison|toxic/.test(t))return keywords.has("infect")||keywords.has("toxic")||/poison counter|poisoned/.test(text)?.94:0;
  if(/proliferate/.test(t))return keywords.has("proliferate")||/\bproliferate\b/.test(text)?.94:0;
  if(/deathtouch/.test(t))return keywords.has("deathtouch")?.9:0;
  if(/card draw/.test(t))return ids.has("card_draw")?.9:ids.has("card_advantage")||ids.has("impulse_draw")?.72:0;
  if(/discard/.test(t)&&!/wheel/.test(t))return /discard/.test(text)?.72:0;
  if(/wheels?/.test(t))return /each player[^.]{0,100}(?:discard|draw)|discard your hand[^.]{0,100}draw/.test(text)?.9:0;
  if(/lifedrain|drain/.test(t))return tags.has("lifegain")&&(facts.abilities||[]).some(a=>(a.effects?.positive||[]).includes("damage"))?.9:0;
  if(/^graveyard$|self[- ]?mill/.test(t))return facts.ownGraveyard||ids.has("recursion")?.76:0;
  if(/forced combat|goad/.test(t))return keywords.has("goad")||/\bgoad\b|must attack|attacks each combat/.test(text)?.88:0;
  if(/cycling/.test(t))return keywords.has("cycling")?.92:0;
  if(/cascade/.test(t))return keywords.has("cascade")?.92:0;
  if(/monarch/.test(t))return /\bmonarch\b/.test(text)?.86:0;
  if(/energy/.test(t))return /\{e\}|energy counter/.test(text)?.86:0;
  if(/\+1\/\+1 counters?|counters matter/.test(t))return /\+1\/\+1 counter/.test(text)?.88:0;
  if(/mill/.test(t))return /\bmill\b/.test(text)?.82:0;
  if(/group slug/.test(t))return /each opponent[^.]{0,100}(?:loses|damage)|whenever an opponent/.test(text)?.86:0;
  if(/group hug/.test(t))return /each player[^.]{0,100}(?:draw|may)|opponents?[^.]{0,80}draw/.test(text)?.78:0;
  if(/chaos/.test(t))return /at random|coin flip|flip a coin|exchange control|choose [^.]{0,50} at random/.test(text)?.82:0;
  if(/politics/.test(t))return /opponent chooses|choose an opponent|vote|votes|player of your choice/.test(text)?.76:0;
  return 0;
}

export function archetypeAffinity(card,themeName=""){
  const kind=archetypeKind(themeName),facts=factsOf(card),ids=roleIds(card),tags=tagsOf(card),type=typeOf(card);
  const literal=literalSubtypeAffinity(card,themeName);
  if(literal)return literal;
  if(kind==="voltron"){
    let a=0;if(facts.attachesToCreature)a=.92;else if(ids.includes("protection")||ids.includes("evasion"))a=.68;else if(facts.commanderSupport)a=.74;return a;
  }
  if(kind==="equipment")return facts.equipment?1:facts.attachesToCreature&&type.includes("artifact")?.82:0;
  if(kind==="auras")return facts.auraCreature?1:facts.aura?.82:0;
  if(kind==="vehicles")return /\bvehicle\b/.test(type)?.96:0;
  if(kind==="artifact_tokens"){
    const wanted=themeWords(themeName),kinds=new Set(facts.tokenKinds||[]);let a=0;for(const w of wanted)if(kinds.has(w))a=Math.max(a,.94);return a;
  }
  if(kind==="historic"){
    const prod=producesOf(card),deps=semanticOf(card)?.themeDependencies||[];return prod.has("spell:historic")?.78:deps.includes("spell:historic")?.90:0;
  }
  if(kind==="legends"){
    const prod=producesOf(card),deps=semanticOf(card)?.themeDependencies||[];return prod.has("spell:legendary")?.82:deps.includes("spell:legendary")?.90:0;
  }
  if(kind==="tokens"){
    let a=0;if(facts.tokenMultiplier)a=1;else if(ids.includes("token_support")||facts.tokenSupport)a=.92;else if(facts.tokenRepeatable)a=.86;else if(facts.tokenBurst)a=.72;else if(facts.tokenIncidental)a=.38;else if(ids.includes("token_generation")||facts.tokenForYou)a=.62;else if(tags.has("token")&&(ids.includes("engine")||ids.includes("payoff")))a=.58;return a;
  }
  if(kind==="clones"){let a=0;if(facts.clonePermanent||ids.includes("clone"))a=1;else if(facts.copySpell||ids.includes("spell_copy"))a=.72;else if(tags.has("clone")||tags.has("copy"))a=.68;return a}
  if(kind==="ramp"){
    let a=Math.max(roleConfidence(card,"ramp"),roleConfidence(card,"land_tutor"),roleConfidence(card,"cost_reduction")*.82);if(facts.additionalLand)a=Math.max(a,.88);return clamp(a);
  }
  if(kind==="reanimator"){let a=0;if(ids.includes("recursion"))a=.98;else if(facts.ownGraveyard&&(ids.includes("engine")||ids.includes("payoff")))a=.82;else if(tags.has("graveyard")&&(ids.includes("card_draw")||ids.includes("tutor")||ids.includes("engine")||ids.includes("payoff")))a=.68;return a}
  if(kind==="artifacts"){const deps=semanticOf(card)?.themeDependencies||[];return type.includes("artifact")?.72:facts.artifactSupport?.9:deps.includes("spell:artifact")?.90:0}
  if(kind==="enchantments"){const deps=semanticOf(card)?.themeDependencies||[];return type.includes("enchantment")?.72:facts.enchantmentSupport?.9:deps.includes("spell:enchantment")?.90:0}
  if(kind==="spells"){
    const intrinsic=Math.max(Number(facts.spellThemeStrength||0),(type.includes("instant")||type.includes("sorcery"))?.38:0);
    return clamp(intrinsic);
  }
  if(kind==="lands")return facts.additionalLand||tags.has("lands")?.9:ids.includes("land_tutor")?.72:0;
  if(kind==="aristocrats"){
    const death=tags.has("death")||tags.has("sacrifice"),outlet=ids.includes("sacrifice_outlet"),payoff=ids.includes("engine")||ids.includes("payoff");return outlet?.92:death&&payoff?.84:death?.58:0;
  }
  if(kind==="lifegain")return tags.has("lifegain")?.82:0;
  if(kind==="blink")return facts.selfBounce?.35:ids.includes("recursion")?.42:0;
  return genericSemanticAffinity(card,themeName);
}

export function themeEvidence(card,themeName="",contextAffinity=null){
  const kind=archetypeKind(themeName),context=clamp(contextAffinity??card?.contextThemeAffinity??card?.themeAffinity??0),archetype=clamp(archetypeAffinity(card,themeName));
  const explicit=kind!=="generic"||literalSubtypeAffinity(card,themeName)>0||archetype>0;
  // External context can rank cards that are already coherent, but cannot create strong
  // archetype membership by itself when canonical semantics say there is no fit.
  const effective=explicit?clamp(archetype*.78+Math.min(.80,context)*.22):context;
  return {kind,archetype,context,effective,explicit};
}

export function themeDependencyBaseline(dep,themeName=""){
  const f=themeFlags(themeName),t=norm(themeName);
  if(dep==="spell:instant_sorcery")return f.spells?.82:0;
  if(dep==="spell:noncreature")return f.spells?.74:0;
  if(dep==="spell:any")return f.spells?.58:0;
  if(dep==="spell:artifact")return f.artifacts?.78:0;
  if(dep==="spell:enchantment")return f.enchantments?.78:0;
  if(dep==="spell:creature")return (f.creatures||f.creatureEngine)?.72:0;
  if(dep==="spell:historic")return /historic|legend/.test(t)?.78:0;
  if(dep==="spell:legendary")return /legend/.test(t)?.78:0;
  if(dep==="ownership:not_owned")return /(theft|steal|opponent|exile)/.test(t)?.62:.12;
  if(dep.startsWith("spell:subtype:")){const subtype=dep.slice("spell:subtype:".length).replace(/_/g," ");return t.includes(subtype)?.84:0}
  if(dep.startsWith("spell:color:"))return 0;
  return 0;
}


const LOCAL_ARCHETYPE_CANDIDATES=[
  "Artifacts","Equipment","Vehicles","Spellslinger","Enchantments","Auras","Historic",
  "Legends Matter","Tokens","Clones","Ramp","Reanimator","Lands Matter","Aristocrats",
  "Lifegain","Blink / ETB","Burn","+1/+1 Counters","Graveyard","Proliferate"
];

// Shared local fallback used when EDHREC has no theme metadata. It does not parse Oracle
// independently: every candidate is evaluated through the same archetype contract engine
// used by LAB2, Deck Health and builder scoring. Subtype themes are proposed only when the
// neutral semantics say the card actually depends on casting that subtype, not merely because
// the Commander happens to have that creature type.
export function inferArchetypeSignals(card,{limit=8,minAffinity=.5}={}){
  const out=[];
  for(const name of LOCAL_ARCHETYPE_CANDIDATES){
    const evidence=themeEvidence(card,name,0);
    if(evidence.archetype>=minAffinity)out.push({name,affinity:evidence.archetype,weight:Math.round(evidence.archetype*5),why:"canonical archetype contract"});
  }
  const semantic=semanticOf(card),subtypes=new Set();
  for(const dep of [...(semantic.themeDependencies||[]),...(semantic.dependencies||[])])if(String(dep).startsWith("spell:subtype:"))subtypes.add(String(dep).slice("spell:subtype:".length));
  for(const subtype of subtypes){
    const label=subtype.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()),name=`Kindred: ${label}`,evidence=themeEvidence(card,name,0);
    if(evidence.archetype>=minAffinity)out.push({name,affinity:evidence.archetype,weight:Math.round(evidence.archetype*5),why:"canonical subtype dependency"});
  }
  return out.sort((a,b)=>b.affinity-a.affinity||a.name.localeCompare(b.name)).slice(0,Math.max(1,Number(limit)||8));
}
