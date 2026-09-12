// ManaShelf Deck Metrics Engine v1
import { cardNameMatches } from "./card-identity.mjs";

// Pure, dependency-free EDH deck diagnostics for Lab validation.
// Scope: deterministic semantic tags + lightweight development simulation.

export const METRICS_ENGINE_VERSION = 1;
export const CLASSIFICATION_VERSION = 7;
export const SIMULATION_VERSION = 1;

const COLORS=["W","U","B","R","G"];
const COLOR_NAMES={W:"white",U:"blue",B:"black",R:"red",G:"green"};
const uniq=a=>[...new Set(a.filter(Boolean))];
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const round=(n,d=2)=>Number(Number(n||0).toFixed(d));
const qty=c=>Math.max(1,Number(c?.quantity||1));
const textOf=c=>String(c?.meta?.oracleText??c?.oracleText??"").toLowerCase();
const typeOf=c=>String(c?.meta?.typeLine??c?.typeLine??"").toLowerCase();
const manaCostOf=c=>String(c?.meta?.manaCost??c?.manaCost??"");
const mvOf=c=>Number(c?.meta?.cmc??c?.cmc??0)||0;
const producedOf=c=>Array.isArray(c?.meta?.producedMana)?c.meta.producedMana:Array.isArray(c?.producedMana)?c.producedMana:[];
const isLand=c=>/\bland\b/.test(typeOf(c).split("//")[0]);
const isCreature=c=>/\bcreature\b/.test(typeOf(c));

const COLOR_WORDS={white:"W",blue:"U",black:"B",red:"R",green:"G",colorless:"C"};
const SPELL_SCOPE_WORDS=new Set(["spell","spells","a","an","another","your","first","second","third","each","every","this","that","target","copied","copy","cast"]);
const slugTag=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
const keywordsOf=card=>(Array.isArray(card?.meta?.keywords)?card.meta.keywords:Array.isArray(card?.keywords)?card.keywords:[]).map(x=>String(x||"").toLowerCase());

function oracleAbilityLines(card){
  const text=String(card?.meta?.oracleText??card?.oracleText??"").toLowerCase().replace(/\([^()]{0,320}\)/g," ");
  return text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
}
function spellRequirementFromText(value=""){
  const text=String(value||"").toLowerCase(),deps=[],scopes=[],colors=[];
  const notOwned=/you don(?:'|’)t own|you do not own|an? opponent owns|owned by an? opponent/.test(text);
  if(notOwned)deps.push("ownership:not_owned");
  for(const [word,color] of Object.entries(COLOR_WORDS))if(new RegExp(`\\b${word}\\b[^,.;]{0,35}\\b(?:creature|artifact|enchantment|instant|sorcery|spell)s?\\b`).test(text)){colors.push(color);deps.push(`spell:color:${color}`)}
  // Preserve the actual spell domain. Multiple entries here are conjunctive unless they are
  // represented by one explicit umbrella such as instant_sorcery/noncreature/historic.
  if(/instant or sorcery|instant and sorcery|instant, sorcery|instant\/sorcery/.test(text))scopes.push("instant_sorcery");
  else if(/\b(?:instant|sorcery) spell/.test(text))scopes.push("instant_sorcery");
  if(/\bnoncreature spell/.test(text))scopes.push("noncreature");
  if(/\bartifact(?: creature)? spell/.test(text))scopes.push("artifact");
  if(/\benchantment(?: creature)? spell/.test(text))scopes.push("enchantment");
  if(/\bcreature spell/.test(text))scopes.push("creature");
  if(/\bhistoric spell/.test(text))scopes.push("historic");
  if(/\blegendary spell/.test(text))scopes.push("legendary");
  if(/\bcommander spell/.test(text))scopes.push("commander");

  // A subtype restriction can coexist with a card-type restriction: "Merfolk creature spell"
  // means both Creature and Merfolk. Do not collapse the subtype just because Creature matched.
  const subtypeQualifiers=new Set(["white","blue","black","red","green","colorless","artifact","enchantment","legendary","historic","noncreature","instant","sorcery","commander","another","target","your","the","a","an"]);
  const creatureSubtype=(text.match(/\b([a-z][a-z'’-]{1,30}) creature spell/)||[])[1];
  if(creatureSubtype&&!subtypeQualifiers.has(creatureSubtype))scopes.push(`subtype:${slugTag(creatureSubtype)}`);

  if(/\bspell\b/.test(text)&&!scopes.length){
    const before=(text.match(/(?:^|cast(?: or copy)?|copy)\s*(?:a |an |another |your |the )?([a-z][a-z'’ -]{1,36}) spell/)||[])[1];
    if(before){
      const words=before.trim().split(/\s+/).filter(Boolean),last=words[words.length-1];
      if(last&&!SPELL_SCOPE_WORDS.has(last)&&!Object.hasOwn(COLOR_WORDS,last)&&!subtypeQualifiers.has(last))scopes.push(`subtype:${slugTag(last)}`);
    }
    if(!scopes.length)scopes.push("any");
  }
  for(const scope of uniq(scopes))deps.push(`spell:${scope}`);
  return {scopes:uniq(scopes),colors:uniq(colors),ownership:notOwned?"not_owned":"own_or_any",dependencies:uniq(deps)};
}
function conditionDependenciesFromText(value=""){
  const t=String(value||"").toLowerCase(),out=[];
  if(/(?:if|as long as) you control (?:an? |another )?creature|(?:target|another) creature you control|creatures? you control/.test(t))out.push("creatures");
  if(/(?:if|as long as) you control (?:an? |another )?artifact|artifacts? you control|for each artifact you control|number of artifacts you control/.test(t))out.push("artifacts");
  if(/(?:if|as long as) you control (?:an? |another )?enchantment|enchantments? you control|for each enchantment you control|number of enchantments you control/.test(t))out.push("enchantments");
  if(/(?:if|as long as) you control (?:an? |another )?token|tokens? you control|for each token you control|number of tokens? you control/.test(t))out.push("tokens");
  if(/your graveyard|cards? in your graveyard|from your graveyard/.test(t))out.push("graveyard");
  if(/whenever you attack|when you attack|attacks each combat|combat damage/.test(t))out.push("combat");
  if(/you don(?:'|’)t own|you do not own/.test(t))out.push("ownership:not_owned");
  return uniq(out);
}
function abilityEffects(text=""){
  const t=String(text||"").toLowerCase();
  const positive=[];
  if(/draw (?:a|one|two|three|four|five|x|\d+|that many) cards?|draw cards/.test(t))positive.push("draw");
  if(/create[s]? [^.]{0,130}tokens?/.test(t))positive.push("token");
  if(/create[s]? [^.]{0,130}treasure/.test(t))positive.push("treasure");
  if(/\badd\b[^.]{0,90}(?:mana|\{[wubrgc]\})/.test(t))positive.push("mana");
  if(/scry|surveil|investigate/.test(t))positive.push("selection");
  if(/copy (?:target |that |it |this )?[^.]{0,80}spell/.test(t))positive.push("copy_spell");
  if(/return [^.]{0,100}(?:from|in) your graveyard|cast [^.]{0,100}from your graveyard/.test(t))positive.push("recursion");
  if(/deals? [^.]{0,80}damage to (?:any target|target opponent|each opponent)|each opponent loses/.test(t))positive.push("damage");
  if(/put [^.]{0,100}counter|gets? \+[x0-9*]+\/\+[x0-9*]+|gains? (?:flying|trample|menace|double strike|hexproof|indestructible)/.test(t))positive.push("board_value");
  if(/costs? [^.]{0,70}less/.test(t))positive.push("cost_reduction");
  const negative=/you lose [^.]{0,50}life|deals? [^.]{0,50}damage to you|you sacrifice|sacrifice (?:this|it|that permanent|that creature)|you discard|counter that spell/.test(t);
  return {positive:uniq(positive),negative};
}
function parseAbilitySemantics(card){
  return oracleAbilityLines(card).map((text,index)=>{
    const triggerMatch=text.match(/whenever you (?:cast or copy|cast|copy) ([^,.;]+)/);
    const triggerEvent=triggerMatch?"cast":/whenever [^.]{0,100} (?:enters|enters the battlefield)/.test(text)?"enter":/whenever [^.]{0,100} dies/.test(text)?"dies":/whenever [^.]{0,100} attacks/.test(text)?"attack":/whenever [^.]{0,100} deals combat damage/.test(text)?"combat_damage":null;
    const requirement=triggerMatch?spellRequirementFromText(triggerMatch[1]):null;
    const effectText=triggerMatch?text.slice(text.indexOf(triggerMatch[0])+triggerMatch[0].length).replace(/^\s*[,—-]\s*/,""):text;
    const effects=abilityEffects(effectText);
    const costReduction=/costs? [^.]{0,90}less(?: to cast)?/.test(text)?spellRequirementFromText(text):null;
    const triggerClause=triggerEvent?text.split(/[,—]/,1)[0]:"";
    const eventDependencies=triggerEvent&&triggerEvent!=="cast"?triggerDependencies(triggerClause):[];
    const dependencies=uniq([...(requirement?.dependencies||[]),...eventDependencies,...conditionDependenciesFromText(triggerClause||text)]);
    return {index,text,triggerEvent,spellRequirement:requirement,effects,costReduction,dependencies};
  });
}
function spellProductionTags(card){
  if(isLand(card))return [];
  const type=typeOf(card),out=["spell:any"];
  const creature=/\bcreature\b/.test(type),artifact=/\bartifact\b/.test(type),enchantment=/\benchantment\b/.test(type),instant=/\binstant\b/.test(type),sorcery=/\bsorcery\b/.test(type),legendary=/\blegendary\b/.test(type),saga=/\bsaga\b/.test(type);
  if(creature)out.push("spell:creature");else out.push("spell:noncreature");
  if(artifact)out.push("spell:artifact");if(enchantment)out.push("spell:enchantment");if(instant||sorcery)out.push("spell:instant_sorcery");if(legendary)out.push("spell:legendary");if(artifact||legendary||saga)out.push("spell:historic");
  const subtype=type.split(/[—-]/)[1]||"";for(const x of subtype.trim().split(/\s+/).filter(Boolean))out.push(`spell:subtype:${slugTag(x)}`);
  const ci=Array.isArray(card?.meta?.colorIdentity)?card.meta.colorIdentity:Array.isArray(card?.colorIdentity)?card.colorIdentity:[];for(const c of ci)if(COLORS.includes(String(c)))out.push(`spell:color:${String(c)}`);
  return uniq(out);
}

function role(id,confidence=0.9,source="rules"){return {id,confidence,source}}
function addRole(out,id,confidence=0.9,source="rules"){if(!out.some(x=>x.id===id))out.push(role(id,confidence,source))}
function hasRole(card,id){return (card.semantic?.roles||[]).some(r=>(r.id||r)===id)}
function roleIds(card){return (card.semantic?.roles||[]).map(r=>r.id||r)}

export function parseManaCost(cost){
  const tokens=[...String(cost||"").matchAll(/\{([^}]+)\}/g)].map(m=>m[1].toUpperCase());
  const pips={W:0,U:0,B:0,R:0,G:0,C:0}; let generic=0,variable=false;
  for(const t of tokens){
    if(/^\d+$/.test(t)){generic+=Number(t);continue}
    if(t==="X"||t==="Y"||t==="Z"){variable=true;continue}
    for(const c of COLORS)if(new RegExp(`(^|/)${c}($|/)`).test(t))pips[c]++;
    if(t==="C")pips.C++;
  }
  return {tokens,pips,generic,variable,colors:COLORS.filter(c=>pips[c]>0),coloredPips:COLORS.reduce((n,c)=>n+pips[c],0)};
}

export function inferProducedMana(card){
  const given=producedOf(card).map(String).filter(x=>COLORS.includes(x)||x==="C");
  if(given.length)return uniq(given);
  if(!isLand(card))return [];
  const t=textOf(card),type=typeOf(card),out=[];
  if(/plains/.test(type)||/add \{w\}/.test(t))out.push("W");
  if(/island/.test(type)||/add \{u\}/.test(t))out.push("U");
  if(/swamp/.test(type)||/add \{b\}/.test(t))out.push("B");
  if(/mountain/.test(type)||/add \{r\}/.test(t))out.push("R");
  if(/forest/.test(type)||/add \{g\}/.test(t))out.push("G");
  if(/add one mana of any color|add one mana of any type|add \{w\}, \{u\}, \{b\}, \{r\}, or \{g\}|any color/.test(t))out.push(...COLORS);
  if(/add \{c\}/.test(t)||(!out.length&&/\{t\}: add/.test(t)))out.push("C");
  return uniq(out);
}

const WORD_NUMBERS={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
function statedNumber(value=""){
  const x=String(value||"").toLowerCase();
  if(/^\d+$/.test(x))return Number(x);
  return WORD_NUMBERS[x]||0;
}
function manaOutputAmount(text=""){
  const t=String(text||"").toLowerCase();
  const symbols=[...t.matchAll(/\{([wubrgc])\}/g)];
  if(symbols.length)return symbols.length;
  const m=t.match(/add (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) mana/);
  if(m)return statedNumber(m[1]);
  if(/add x mana|add an amount of mana|add that much mana/.test(t))return 2; // variable output: useful potential, never treated as fully reliable by itself
  if(/\badd\b[^.]{0,55}\bmana\b/.test(t))return 1;
  return 0;
}
function activationManaCost(text=""){
  const parsed=parseManaCost(text),symbolic=parsed.generic+parsed.coloredPips+Number(parsed.pips.C||0);
  return Math.max(0,symbolic);
}
function triggerDependencies(text=""){
  const t=String(text||"").toLowerCase();
  if(/whenever you (?:cast|cast or copy|copy)\b/.test(t)){
    const req=spellRequirementFromText(t);
    if(req.dependencies.length)return req.dependencies;
  }
  if(/combat|attacks?|deals? combat damage/.test(t))return ["combat"];
  if(/opponent|a player|each player/.test(t))return ["opponent_actions"];
  if(/artifacts?/.test(t))return ["artifacts"];
  if(/enchantments?/.test(t))return ["enchantments"];
  if(/lands?/.test(t))return ["lands"];
  if(/tokens?/.test(t))return ["tokens"];
  if(/creatures?[^.]{0,80}(?:enters?|dies|attacks?)/.test(t))return [/under your control|you control|your creature/.test(t)?"creatures":"external_events"];
  if(/you gain life|you gained life/.test(t))return ["lifegain_events"];
  return ["conditional_event"];
}
function triggerDependency(text=""){return triggerDependencies(text)[0]||"conditional_event"}

// Canonical acceleration facts. This deliberately separates "can create/convert mana"
// from "actually accelerates mana" so filtering and incidental Treasure text cannot fill
// structural ramp quotas.
export function deriveManaAccelerationFacts(card){
  const functionalText=textOf(card).replace(/\([^()]{0,320}\)/g," "),type=typeOf(card),mv=mvOf(card);
  const permanent=/artifact|creature|enchantment|planeswalker/.test(type);
  const landRamp=/search your library[^.]{0,180}(?:basic land|plains|island|swamp|mountain|forest)[^.]{0,90}(?:card|onto the battlefield)|put [^.]{0,100}land card[^.]{0,80}onto the battlefield/.test(functionalText);
  const additionalLand=/play an additional land|play (?:one|two|\d+) additional lands?|you may play [^.]{0,40}additional land/.test(functionalText);

  const activated=[];
  for(const match of functionalText.matchAll(/([^.:\n]{0,150}):\s*add ([^.\n]+)/g)){
    const costText=match[1],effectText=`add ${match[2]}`,output=manaOutputAmount(effectText),manaCost=activationManaCost(costText),sacrifices=/sacrifice/.test(costText),requiresOtherTap=/tap an untapped|tap another|tap two|tap three/.test(costText),net=output-manaCost;
    activated.push({output,manaCost,net,sacrifices,requiresOtherTap,repeatable:!sacrifices,effectText,costText});
  }
  const bestActivatedNet=Math.max(-99,...activated.map(x=>x.net));
  const repeatablePositiveActivation=activated.some(x=>x.repeatable&&x.net>0);
  const oneShotPositiveActivation=activated.some(x=>x.sacrifices&&x.net>0);
  const filteringActivation=activated.some(x=>x.output>0&&x.net<=0);

  const triggeredManaMatch=functionalText.match(/((?:whenever|when|at the beginning of|at the end of)[^.]{0,220}\badd\b[^.]*)/);
  const triggeredMana=Boolean(triggeredManaMatch),manaTriggerDependencies=triggeredMana?triggerDependencies(triggeredManaMatch[1]):[],manaTriggerDependency=manaTriggerDependencies[0]||null;

  const treasureText=/create[s]? [^.]{0,120}treasure/.test(functionalText);
  const treasureForOpponent=/(?:an? opponent|opponent|its controller|the controller|that spell(?:'|’)s controller|that creature(?:'|’)s controller|target player|that player|that opponent)[^.]{0,100}create[s]? [^.]{0,90}treasure/.test(functionalText);
  const explicitTreasureForYou=/you create[s]? [^.]{0,100}treasure|under your control[^.]{0,80}treasure/.test(functionalText);
  const treasureForYou=explicitTreasureForYou||(treasureText&&!treasureForOpponent);
  const treasureTriggerMatch=treasureForYou?functionalText.match(/((?:whenever|when|at the beginning of|at the end of)[^.]{0,240}create[s]? [^.]{0,120}treasure[^.]*)/):null;
  const treasureRepeatable=Boolean(treasureTriggerMatch),treasureTriggerDependencies=treasureRepeatable?triggerDependencies(treasureTriggerMatch[1]):[],treasureTriggerDependency=treasureTriggerDependencies[0]||null;
  const treasureCountMatch=functionalText.match(/create[s]? (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) [^.]{0,80}treasure/);
  const treasureCount=treasureCountMatch?statedNumber(treasureCountMatch[1]):0;
  const treasureVariable=treasureForYou&&/create[s]? [^.]{0,90}treasure[^.]{0,100}for each|for each [^.]{0,100}create[s]? [^.]{0,100}treasure/.test(functionalText);
  const treasureOneShot=treasureForYou&&!treasureRepeatable;

  const directManaOutsideAbility=!activated.length&&!triggeredMana&&/\badd\b[^.]{0,70}(?:\{[wubrgc]\}|mana)/.test(functionalText);
  const ritualOutput=directManaOutsideAbility?manaOutputAmount(functionalText):0;
  const ritualNet=directManaOutsideAbility&&!permanent?ritualOutput-Math.max(0,mv):0;

  const treasureRampPotential=treasureForYou&&(treasureRepeatable||treasureVariable||(treasureCount>=2&&mv<=3));
  const rampPotential=landRamp||additionalLand||repeatablePositiveActivation||oneShotPositiveActivation||triggeredMana||treasureRampPotential||ritualNet>0;
  const fixingPotential=/any color|any type/.test(functionalText)&&(activated.length>0||treasureForYou||landRamp||directManaOutsideAbility);
  const conditional=rampPotential&&(triggeredMana||treasureRepeatable||treasureVariable||activated.some(x=>x.requiresOtherTap));
  const dependencies=treasureRepeatable?treasureTriggerDependencies:triggeredMana?manaTriggerDependencies:treasureVariable?triggerDependencies(functionalText):activated.some(x=>x.requiresOtherTap)?["creatures"]:[];
  const dependency=dependencies[0]||null;
  return {landRamp,additionalLand,activated,bestActivatedNet,repeatablePositiveActivation,oneShotPositiveActivation,filteringActivation,triggeredMana,manaTriggerDependency,manaTriggerDependencies,treasureForYou,treasureForOpponent,treasureRepeatable,treasureTriggerDependency,treasureTriggerDependencies,treasureOneShot,treasureCount,treasureVariable,directManaOutsideAbility,ritualOutput,ritualNet,rampPotential,fixingPotential,conditional,dependency,dependencies};
}

// Canonical low-level facts. Roles and archetype/theme adapters should derive from these
// facts instead of independently grepping the same Oracle text in multiple places.
export function deriveCardFacts(card){
  const text=textOf(card),type=typeOf(card),functionalText=text.replace(/\([^()]{0,320}\)/g," "),mana=deriveManaAccelerationFacts(card);
  const aura=/\baura\b/.test(type),equipment=/\bequipment\b/.test(type);
  const auraCreature=aura&&/enchant [^.\n]{0,55}(?:creature|commander)/.test(functionalText);
  const auraLand=aura&&/enchant [^.\n]{0,55}(?:land|plains|island|swamp|mountain|forest)/.test(functionalText);
  const attachesToCreature=equipment||auraCreature||/attach [^.]{0,80} to (?:target |a |that )?creature|equipped creature|enchanted creature/.test(functionalText);

  const genericTokenCreation=/create[s]? [^.]{0,140}token/.test(functionalText);
  const tokenForOpponent=/(?:an? opponent|opponent|its controller|that (?:spell|creature)(?:'|’)s controller|target player|that player|that opponent)[^.]{0,120}create[s]? [^.]{0,100}token/.test(functionalText);
  const tokenForYou=/you create[s]? [^.]{0,120}token|create[s]? [^.]{0,120}token under your control/.test(functionalText)||(genericTokenCreation&&!tokenForOpponent&&!/each opponent[^.]{0,100}create[s]?/.test(functionalText));

  const ownGraveyard=/your graveyard|from your graveyard|in your graveyard|cards? in your graveyard|mill (?:a card|two|three|four|five|\d+ cards?|yourself)/.test(functionalText);
  const opponentGraveyard=/(?:target player|an? opponent|opponent(?:'|’)s|their) graveyard|graveyard of (?:target player|an? opponent)/.test(functionalText);
  const artifactSupport=/artifacts? you control|artifact spells? you cast|whenever an? artifact [^.]{0,60}(?:enters|is put)|for each artifact you control|number of artifacts you control|sacrifice an? artifact/.test(functionalText);
  const enchantmentSupport=/enchantments? you control|enchantment spells? you cast|whenever an? enchantment [^.]{0,60}(?:enters|is put)|for each enchantment you control|number of enchantments you control|sacrifice an? enchantment/.test(functionalText);
  const tokenMultiplier=/if [^.]{0,90}tokens? would be created under your control[^.]{0,140}(?:twice|double|that many plus|additional)|create [^.]{0,90}(?:twice|double) that many tokens?|create that many additional tokens?|one or more tokens? would be created under your control[^.]{0,120}instead/.test(functionalText);
  const tokenSupport=tokenMultiplier||/tokens? you control|whenever you create [^.]{0,70}token|for each token you control|number of tokens? you control|sacrifice (?:a|one or more) tokens?/.test(functionalText);
  const tokenRepeatable=tokenForYou&&/(?:whenever|at the beginning of|at the end of|each upkeep|each combat|each end step)[^.]{0,160}create[s]? [^.]{0,110}tokens?|create[s]? [^.]{0,110}tokens?[^.]{0,120}(?:whenever|each time)/.test(functionalText);
  const tokenBurst=tokenForYou&&/(?:create[s]? (?:two|three|four|five|six|seven|eight|nine|ten|\d+) [^.]{0,100}tokens?|create[s]? [^.]{0,100}tokens? for each|for each [^.]{0,100}create[s]? [^.]{0,100}tokens?|create that many [^.]{0,80}tokens?)/.test(functionalText);
  const tokenIncidental=tokenForYou&&!tokenMultiplier&&!tokenSupport&&!tokenRepeatable&&!tokenBurst;
  const tokenKinds=tokenForYou?uniq([...functionalText.matchAll(/create[s]? [^.]{0,110}\b(treasure|clue|food|blood|map|powerstone|gold) tokens?\b/g)].map(m=>m[1])):[];
  const abilities=parseAbilitySemantics(card),keywords=keywordsOf(card);
  const castInteractions=abilities.filter(a=>a.triggerEvent==="cast"&&a.spellRequirement);
  const costReductionRequirements=abilities.map(a=>a.costReduction).filter(Boolean);
  const copySpell=/copy target [^.]{0,80}spell|copy (?:that|it|this) spell|copy target (?:instant|sorcery)/.test(functionalText);
  const copySpellScopes=[];
  if(/copy target [^.]{0,45}artifact spell|copy [^.]{0,45}artifact spell/.test(functionalText))copySpellScopes.push("artifact");
  if(/copy target [^.]{0,45}creature spell|copy [^.]{0,45}creature spell/.test(functionalText))copySpellScopes.push("creature");
  if(/copy target (?:instant|sorcery)|copy target [^.]{0,45}(?:instant or sorcery|instant and sorcery) spell|(?:instant or sorcery|instant and sorcery)[^.]{0,100}copy (?:that|it|this) spell/.test(functionalText))copySpellScopes.push("instant_sorcery");
  if(/noncreature spell[^.]{0,100}copy (?:that|it|this) spell|copy target noncreature spell/.test(functionalText))copySpellScopes.push("noncreature");
  if(copySpell&&!copySpellScopes.length&&/copy target spell|copy (?:that|it|this) spell/.test(functionalText))copySpellScopes.push("any");
  const copySpellOwnership=/spell (?:an? opponent|opponents?) controls|spell you don(?:'|’)t control/.test(functionalText)?"opponent":/spell you control/.test(functionalText)?"own":"any";
  const compatibleSpellScope=scope=>["instant_sorcery","noncreature","any"].includes(scope);
  const positiveCompatibleCast=castInteractions.some(a=>a.effects.positive.length>0&&!a.effects.negative&&a.spellRequirement.ownership!=="not_owned"&&a.spellRequirement.scopes.some(compatibleSpellScope));
  const spellCopySupportsSpellslinger=copySpellScopes.some(compatibleSpellScope)&&copySpellOwnership!=="opponent";
  const typedInstantSorcerySupport=/(?:instant or sorcery|instant and sorcery) (?:spells?|cards?)[^.]{0,120}(?:you cast|you own|you control|in your graveyard|from your graveyard|cost|copy|cast)|(?:cast|copy|return)[^.]{0,90}(?:instant or sorcery|instant and sorcery) (?:spell|card)/.test(functionalText);
  const keywordSpellRelevant=keywords.some(k=>["magecraft","prowess","storm"].includes(k));
  const costReductionSupportsSpellslinger=costReductionRequirements.some(r=>r.ownership!=="not_owned"&&r.scopes.some(compatibleSpellScope));
  const spellslingerRelevant=positiveCompatibleCast||spellCopySupportsSpellslinger||typedInstantSorcerySupport||keywordSpellRelevant||costReductionSupportsSpellslinger;
  const spellThemeStrength=Math.max(
    keywordSpellRelevant?.92:0,
    castInteractions.some(a=>a.effects.positive.length>0&&!a.effects.negative&&a.spellRequirement.ownership!=="not_owned"&&a.spellRequirement.scopes.includes("instant_sorcery"))?.94:0,
    castInteractions.some(a=>a.effects.positive.length>0&&!a.effects.negative&&a.spellRequirement.ownership!=="not_owned"&&a.spellRequirement.scopes.includes("noncreature"))?.78:0,
    castInteractions.some(a=>a.effects.positive.length>0&&!a.effects.negative&&a.spellRequirement.ownership!=="not_owned"&&a.spellRequirement.scopes.includes("any"))?.68:0,
    spellCopySupportsSpellslinger?.82:0,
    typedInstantSorcerySupport?.86:0,
    costReductionSupportsSpellslinger?.84:0
  );
  const repeatableValueAbilities=abilities.filter(a=>a.triggerEvent&&a.effects.positive.length>0&&!a.effects.negative);
  const castInteractionDependencies=uniq(castInteractions.filter(a=>a.effects.positive.length>0&&!a.effects.negative).flatMap(a=>a.spellRequirement?.dependencies||[]));
  const tokenAbilityDependencies=uniq(abilities.filter(a=>a.effects.positive.includes("token")||a.effects.positive.includes("treasure")).flatMap(a=>a.spellRequirement?.dependencies||[]));
  const costReductionDependencies=uniq(costReductionRequirements.flatMap(r=>r.dependencies||[]));
  const selfBounce=/return target [^.]{0,100} you control to (?:its owner(?:'|’)s|your) hand|return (?:a|an|another) [^.]{0,80} you control to (?:its owner(?:'|’)s|your) hand/.test(functionalText);
  const clonePermanent=/\benter(?:s)? (?:the battlefield )?as (?:a )?copy of|may (?:have [^.]{0,70} )?enter (?:the battlefield )?as (?:a )?copy of|becomes? a copy of|copy target (?:creature|artifact|permanent)(?! spell)|token that(?:'|’)s a copy of|token copy of/.test(functionalText);
  const additionalLand=/play an additional land|play (?:one|two|\d+) additional lands?|you may play [^.]{0,40}additional land/.test(functionalText);
  const commanderSupport=/(?:your commander|commander you control)[^.]{0,120}(?:gets?|gains?|has|equip|attach|hexproof|indestructible|damage|power|toughness)/.test(functionalText);

  const selfEvasionKeyword=isCreature(card)&&/(?:^|\n)(?:flying|trample|menace|shadow|horsemanship|fear|intimidate)(?:[,.\n]|$)/.test(functionalText);
  const grantsEvasion=/(?:target|enchanted|equipped|this|that) creature[^.]{0,100}(?:gains?|has|gets?)[^.]{0,80}(?:flying|trample|menace|shadow|horsemanship|fear|intimidate)|creatures you control[^.]{0,100}(?:have|gain)[^.]{0,80}(?:flying|trample|menace|shadow)|can(?:'|’)t be blocked|unblockable/.test(functionalText);
  const selfHasteKeyword=isCreature(card)&&/(?:^|\n)haste(?:[,.\n]|$)/.test(functionalText);
  const grantsHaste=/(?:target|enchanted|equipped|this|that) creature[^.]{0,100}(?:gains?|has)[^.]{0,70}haste|creatures you control[^.]{0,100}(?:have|gain)[^.]{0,70}haste/.test(functionalText);

  // Structural wipes must answer a creature/permanent board. Narrow mass removal (for
  // example, “destroy all enchantments”) remains useful interaction but does not satisfy
  // the same Commander deck-building quota.
  const scalableMinusWipe=/all creatures get -(?:x|\d+)\/-(?:x|\d+)[^.]{0,140}(?:for each|where x|equal to|number of)/.test(functionalText)||/all creatures get -x\/-x/.test(functionalText);
  const broadWipe=/(?:destroy|exile) all (?:other )?(?:creatures|nonland permanents|permanents)\b|each player sacrifices (?:all|each|\d+|two|three) creatures/.test(functionalText)||scalableMinusWipe;
  const narrowMassRemoval=/(?:destroy|exile) all (?:other )?(?:artifacts|enchantments)\b|destroy each (?:artifact|enchantment)|exile each (?:artifact|enchantment)/.test(functionalText);
  const partialSweeper=!broadWipe&&/(?:destroy|exile) all [^.]{0,90}(?:creatures|permanents)\b|(?:damage to each creature|each creature gets -|all creatures get -\d+\/-\d+|destroy each [^.]{0,80}(?:creature|permanent)|exile each [^.]{0,80}(?:creature|permanent))/.test(functionalText);

  return {functionalText,abilities,keywords,castInteractions,castInteractionDependencies,costReductionRequirements,costReductionDependencies,tokenAbilityDependencies,aura,equipment,auraCreature,auraLand,attachesToCreature,genericTokenCreation,tokenForYou,tokenForOpponent,ownGraveyard,opponentGraveyard,artifactSupport,enchantmentSupport,tokenSupport,tokenMultiplier,tokenRepeatable,tokenBurst,tokenIncidental,tokenKinds,clonePermanent,copySpell,copySpellScopes:uniq(copySpellScopes),copySpellOwnership,spellCopySupportsSpellslinger,costReductionSupportsSpellslinger,spellslingerRelevant,spellThemeStrength,repeatableValueAbilities,selfBounce,additionalLand,commanderSupport,selfEvasionKeyword,grantsEvasion,selfHasteKeyword,grantsHaste,broadWipe,narrowMassRemoval,partialSweeper,mana,spellProductionTags:spellProductionTags(card)};
}

export function classifyCard(card,{tribalType=null,commanderName=""}={}){
  const text=textOf(card),type=typeOf(card),name=String(card?.name||""),facts=deriveCardFacts(card);
  // Functional parsing must ignore parenthetical reminder text. Otherwise a spell that
  // gives an opponent a Treasure can look like mana acceleration just because the
  // reminder text explains that Treasures have “{T}, Sacrifice: Add one mana…”.
  const functionalText=facts.functionalText;
  const roles=[],dependencies=[],globalDependencies=[],synergyTags=[],produces=[],benefitsFrom=[];
  const add=(id,c=.9)=>addRole(roles,id,c);

  if(isLand(card)){add("land",1);add("mana_source",1);if(inferProducedMana(card).length>1)add("mana_fixing",.98)}
  const manaFacts=facts.mana||deriveManaAccelerationFacts(card),landRamp=manaFacts.landRamp;
  if(!isLand(card)&&manaFacts.rampPotential)add("ramp",manaFacts.conditional?.74:.92);
  if(!isLand(card)&&(manaFacts.fixingPotential||landRamp))add("mana_fixing",manaFacts.rampPotential?.88:.84);
  if(landRamp)add("land_tutor",.94);
  if(facts.costReductionRequirements.length||/affinity for|convoke/.test(functionalText))add("cost_reduction",.9);

  if(/draw (a|one|two|three|four|five|x|\d+) cards?|draw cards/.test(functionalText))add("card_draw",.96);
  if(/investigate|surveil|scry \d|look at the top .* (put|you may)/.test(functionalText))add("card_selection",.82);
  if(/exile .*you may (play|cast)|you may play .* exile|play .* from exile/.test(functionalText)){add("impulse_draw",.86);add("card_advantage",.75)}
  const genericTutor=/search your library for (a|an|up to|two|three|target).*card|search your library for .* card/.test(functionalText);
  if(genericTutor&&!landRamp)add("tutor",.9);
  if(/from your graveyard to (your hand|the battlefield)|return target .* from your graveyard|cast .* from your graveyard|play .* from your graveyard|\bescape[—-]/.test(functionalText))add("recursion",.94);

  // Match constrained counters too (“counter target noncreature spell”, etc.).
  if(/counter target [^.]{0,60}(?:spell|activated ability|triggered ability)/.test(functionalText))add("counterspell",.99);
  const broadWipe=facts.broadWipe,partialSweeper=facts.partialSweeper;
  if(broadWipe)add("board_wipe",.96);
  if(facts.narrowMassRemoval)add("mass_removal",.86);
  if(partialSweeper)add("partial_sweeper",.76);
  // Remove self-directed target clauses before classifying hostile interaction. This keeps
  // blink/self-bounce/reuse text from masquerading as removal while preserving a separate
  // semantic fact for those effects.
  const hostileText=functionalText.replace(/(?:destroy|exile|return) target [^.]{0,110} you control[^.]*\.?/g," ");
  if(!broadWipe&&!partialSweeper&&/destroy target|exile target|return target (creature|permanent|nonland|artifact|enchantment)|target creature gets -|deals? (\d+|x) damage to target/.test(hostileText))add("removal",.9);
  // Graveyard interaction is directional. Exiling cards from your own graveyard as a
  // cost/resource is not graveyard hate and must not satisfy interaction quotas.
  const graveyardHate=/exile (?:all|target|up to [^.]{0,40})[^.]{0,120} from (?:target|an? opponent(?:'|’)s|a player(?:'|’)s) graveyard|exile all cards from target player(?:'|’)s graveyard|cards in graveyards can(?:'|’)t|players can(?:'|’)t cast spells from graveyards|players can(?:'|’)t play cards from graveyards/.test(functionalText);
  if(graveyardHate){add("graveyard_hate",.96);add("graveyard_interaction",.96)}
  if(/destroy target artifact|exile target artifact|artifact or enchantment/.test(hostileText))add("artifact_removal",.93);
  if(/destroy target enchantment|exile target enchantment|artifact or enchantment/.test(hostileText))add("enchantment_removal",.93);
  if(/destroy target creature|exile target creature|target creature gets -|damage to target creature/.test(hostileText))add("creature_removal",.93);
  if(/destroy target planeswalker|exile target planeswalker|any target/.test(hostileText))add("planeswalker_removal",.72);
  if(/destroy target land|exile target land|nonbasic land/.test(hostileText))add("land_interaction",.92);

  const protective=/gains? (?:hexproof|indestructible)|has (?:hexproof|indestructible)|target [^.]{0,50} you control phases? out|phase out target [^.]{0,50} you control|protection from|regenerate target|regenerate it|exile target [^.]{0,80} you control[^.]{0,150}return (?:it|that card|that permanent|that creature) [^.]{0,80}battlefield/.test(functionalText);
  if(protective&&!/can(?:'|’)t be regenerated|cannot be regenerated/.test(functionalText))add("protection",.88);
  if(facts.selfBounce)add("self_bounce",.72);
  // “Feign Death” style effects are real resilience even when Oracle text does not say
  // “from your graveyard” explicitly.
  if(/when [^.]{0,100} dies\b[^.]{0,180}return (?:it|that card|that creature) [^.]{0,90}battlefield/.test(functionalText))add("recursion",.9);
  if(facts.tokenForYou)add("token_generation",facts.tokenMultiplier?.98:facts.tokenRepeatable?.94:facts.tokenBurst?.88:facts.tokenIncidental?.62:.82);
  if(facts.tokenSupport)add("token_support",facts.tokenMultiplier?.98:.86);
  if(facts.clonePermanent)add("clone",.98);
  if(facts.copySpell)add("spell_copy",.9);
  if(facts.selfHasteKeyword||facts.grantsHaste)add("haste",.92);
  if(facts.selfEvasionKeyword||facts.grantsEvasion)add("evasion",.78);
  if(/sacrifice (a|another|one or more|any number of).*[:.,]|sacrifice a creature:|sacrifice another creature/.test(functionalText))add("sacrifice_outlet",.9);

  const activatedValueAbility=facts.abilities.some(a=>(/\{t\}:|once each turn/.test(a.text))&&a.effects.positive.length>0&&!a.effects.negative);
  if(facts.repeatableValueAbilities.length||activatedValueAbility)add("engine",.8);
  if(facts.repeatableValueAbilities.some(a=>a.effects.positive.includes("damage")))add("damage_engine",.75);

  if(/extra combat|additional combat|double .*power|double .*damage|triple .*damage|win the game|loses the game|each opponent loses x|each opponent loses .* for each|deals? damage equal to .* each opponent|creatures you control[^.]{0,120}get \+[x0-9*]+\/\+[x0-9*]+[^.]{0,100}(?:trample|flying|menace|double strike)/.test(functionalText))add("finisher",.83);
  if((isCreature(card)&&mvOf(card)>=5)||/whenever .* deals combat damage|whenever .* attacks|at the beginning of combat/.test(functionalText))add("threat",.62);
  const effectClauses=functionalText.split(/[.\n]+/).map(x=>x.trim()).filter(Boolean);
  const payoffClause=effectClauses.some(clause=>/whenever|for each|you control|get \+|gets \+|additional|double|triple|instead/.test(clause)&&/(draw|create .*token|add \{|damage|counter|gain .*life|power|toughness|cost)/.test(clause));
  if(payoffClause)add("payoff",.7);

  if(/creature enters|creatures enter|enters the battlefield/.test(functionalText)){synergyTags.push("creature_etb");benefitsFrom.push("creature_etb")}
  if(/dies|sacrifice/.test(functionalText)){synergyTags.push("sacrifice","death");benefitsFrom.push("death")}
  if(facts.ownGraveyard||hasRole({semantic:{roles}},"recursion")){synergyTags.push("graveyard");dependencies.push("graveyard")}
  if(type.includes("artifact"))synergyTags.push("artifact");else if(facts.artifactSupport){synergyTags.push("artifact");benefitsFrom.push("artifact")}
  if(type.includes("enchantment"))synergyTags.push("enchantment");else if(facts.enchantmentSupport){synergyTags.push("enchantment");benefitsFrom.push("enchantment")}
  for(const a of facts.castInteractions||[]){
    if(!a.effects?.positive?.length||a.effects?.negative)continue;
    if(a.spellRequirement?.ownership==="not_owned")benefitsFrom.push("opponent_cards");
    else benefitsFrom.push(...(a.spellRequirement?.dependencies||[]).filter(x=>x.startsWith("spell:")));
  }
  if(facts.tokenForYou||facts.tokenSupport){synergyTags.push("token");benefitsFrom.push("token")}
  if(facts.clonePermanent){synergyTags.push("clone");benefitsFrom.push("spell:creature","spell:artifact","spell:enchantment")}
  if(facts.copySpell){synergyTags.push("copy");if(facts.spellCopySupportsSpellslinger)benefitsFrom.push("spell:instant_sorcery")}
  if(/combat damage|attacks|attack each combat/.test(functionalText)){synergyTags.push("combat");benefitsFrom.push("combat")}
  if(/you gain life|gained life/.test(functionalText)){synergyTags.push("lifegain");benefitsFrom.push("lifegain")}
  if(/landfall|whenever a land enters|additional land/.test(functionalText)||facts.additionalLand){synergyTags.push("lands");benefitsFrom.push("lands")}

  if(isCreature(card)){produces.push("creature_etb");synergyTags.push("creature")}
  if(type.includes("artifact"))produces.push("artifact");
  if(type.includes("enchantment"))produces.push("enchantment");
  produces.push(...facts.spellProductionTags);
  if(hasRole({semantic:{roles}},"token_generation"))produces.push("token");

  if(tribalType){
    const re=new RegExp(`\\b${String(tribalType).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}s?\\b`,`i`);
    if(re.test(type)){synergyTags.push(`tribe:${tribalType.toLowerCase()}`);produces.push(`tribe:${tribalType.toLowerCase()}`)}
    if(re.test(text)){synergyTags.push(`tribe:${tribalType.toLowerCase()}`);benefitsFrom.push(`tribe:${tribalType.toLowerCase()}`);add("tribal_payoff",.92)}
  }

  // Mentioning “your commander's color identity” (Arcane Signet) is a rules reference,
  // not a battlefield dependency. Only effects that actually require controlling the
  // Commander get the dependency penalty.
  if(/if you control your commander|commander you control|while you control your commander|as long as you control your commander/.test(functionalText)){dependencies.push("commander");globalDependencies.push("commander");benefitsFrom.push("commander")}
  if(/library has no cards|no cards in your library|draw a card while your library has no cards/.test(functionalText)){dependencies.push("library_empty");globalDependencies.push("library_empty")}
  if(/six cards? in your hand with different mana values|different mana values among cards? in your hand/.test(functionalText)){dependencies.push("varied_mana_values");globalDependencies.push("varied_mana_values")}
  if(/if you control a creature|target creature you control|creatures? you control/.test(functionalText))dependencies.push("creatures");
  if(/if you control an artifact|artifacts? you control/.test(functionalText))dependencies.push("artifacts");
  if(/if you control an enchantment|enchantments? you control/.test(functionalText))dependencies.push("enchantments");
  if(/if you control a token|tokens? you control/.test(functionalText))dependencies.push("tokens");
  dependencies.push(...(facts.abilities||[]).flatMap(a=>a.dependencies||[]));


  const depGroup=deps=>uniq((deps||[]).filter(Boolean));
  const resourceGroups=(facts.abilities||[]).filter(a=>!a.effects?.negative&&(a.effects?.positive||[]).some(x=>["draw","selection","recursion"].includes(x))).map(a=>depGroup(a.dependencies));
  const engineGroups=(facts.repeatableValueAbilities||[]).map(a=>depGroup(a.dependencies));
  const tokenGroups=(facts.abilities||[]).filter(a=>!a.effects?.negative&&(a.effects?.positive||[]).some(x=>x==="token"||x==="treasure")).map(a=>depGroup(a.dependencies));
  const manaGroups=[];
  if(facts.mana?.rampPotential)manaGroups.push(depGroup(facts.mana?.dependencies));
  const reductionGroups=(facts.costReductionRequirements||[]).map(r=>depGroup(r.dependencies));
  // Dependencies are scoped to the capability that needs them. A card can have several
  // independent ways to satisfy a role; each inner group is conjunctive, while groups are
  // alternatives. This prevents an unrelated conditional ability from penalizing a valid one.
  const roleDependencyGroups={
    ramp:[...manaGroups,...reductionGroups],
    resources:resourceGroups,
    interaction:[],wipes:[],resilience:[],finishers:[],
    token_generation:tokenGroups,
    engine:engineGroups,
    payoff:engineGroups,
    cost_reduction:reductionGroups
  };
  const roleDependencies=Object.fromEntries(Object.entries(roleDependencyGroups).map(([k,groups])=>[k,uniq(groups.flat())]));
  // Retained as neutral diagnostic metadata. Theme evaluation itself selects only the
  // dependency groups relevant to the requested archetype (see archetype-contracts.mjs).
  const themeDependencies=uniq([...(facts.castInteractionDependencies||[]),...(facts.costReductionDependencies||[]),...(facts.tokenAbilityDependencies||[]),...(facts.mana?.dependencies||[])]);
  const ids=roles.map(r=>r.id);
  const setupRoles=new Set(["ramp","mana_fixing","cost_reduction","card_selection","tutor","protection"]);
  const payoffRoles=new Set(["payoff","threat","finisher","engine","tribal_payoff"]);
  const setup=ids.some(x=>setupRoles.has(x));
  const payoff=ids.some(x=>payoffRoles.has(x));
  const primary=ids[0]||(/creature/.test(type)?"creature":/land/.test(type)?"land":"utility");
  const roleWeight=ids.reduce((n,id)=>n+(id===primary?1:setupRoles.has(id)||payoffRoles.has(id)?0.5:0.25),0);
  const confidence=roles.length?round(roles.reduce((n,r)=>n+r.confidence,0)/roles.length,2):0.55;
  return {name,roles,roleIds:ids,primaryRole:primary,dependencies:uniq(dependencies),globalDependencies:uniq(globalDependencies),themeDependencies,roleDependencies,roleDependencyGroups,synergyTags:uniq(synergyTags),produces:uniq(produces),benefitsFrom:uniq(benefitsFrom),facts:{abilities:facts.abilities,keywords:facts.keywords,aura:facts.aura,equipment:facts.equipment,auraCreature:facts.auraCreature,auraLand:facts.auraLand,attachesToCreature:facts.attachesToCreature,tokenForYou:facts.tokenForYou,tokenForOpponent:facts.tokenForOpponent,ownGraveyard:facts.ownGraveyard,opponentGraveyard:facts.opponentGraveyard,artifactSupport:facts.artifactSupport,enchantmentSupport:facts.enchantmentSupport,tokenSupport:facts.tokenSupport,tokenMultiplier:facts.tokenMultiplier,tokenRepeatable:facts.tokenRepeatable,tokenBurst:facts.tokenBurst,tokenIncidental:facts.tokenIncidental,tokenKinds:facts.tokenKinds,clonePermanent:facts.clonePermanent,copySpell:facts.copySpell,copySpellScopes:facts.copySpellScopes,spellCopySupportsSpellslinger:facts.spellCopySupportsSpellslinger,spellslingerRelevant:facts.spellslingerRelevant,spellThemeStrength:facts.spellThemeStrength,castInteractions:facts.castInteractions,costReductionRequirements:facts.costReductionRequirements,copySpellOwnership:facts.copySpellOwnership,selfBounce:facts.selfBounce,mana:facts.mana,additionalLand:facts.additionalLand,commanderSupport:facts.commanderSupport,broadWipe:facts.broadWipe,narrowMassRemoval:facts.narrowMassRemoval,partialSweeper:facts.partialSweeper},setup,payoff,functionalWeight:round(roleWeight,2),confidence,classificationSource:"rules",isCommander:cardNameMatches(name,commanderName)};
}

const semanticCache=new Map();
export function applySemanticClassification(cards,options={}){
  return (cards||[]).map(c=>{
    const cacheKey=[CLASSIFICATION_VERSION,String(c?.name||""),String(c?.meta?.oracleText||c?.oracleText||""),String(c?.meta?.typeLine||c?.typeLine||""),String(options.tribalType||"")].join("|");
    let semantic=semanticCache.get(cacheKey);
    if(!semantic){semantic=classifyCard(c,{...options,commanderName:""});semanticCache.set(cacheKey,semantic)}
    semantic={...semantic,isCommander:cardNameMatches(c?.name,options.commanderName)};
    return {...c,semantic};
  });
}

function countRole(cards,id){return cards.reduce((n,c)=>n+(hasRole(c,id)?qty(c):0),0)}
function cardsForRole(cards,id){return cards.filter(c=>hasRole(c,id)).map(c=>c.name)}
function countWhere(cards,fn){return cards.reduce((n,c)=>n+(fn(c)?qty(c):0),0)}

function interactionCoverage(cards){
  const defs={creature:"creature_removal",artifact:"artifact_removal",enchantment:"enchantment_removal",planeswalker:"planeswalker_removal",land:"land_interaction",graveyard:"graveyard_hate",stack:"counterspell",wipes:"board_wipe",protection:"protection"};
  const out={}; for(const [k,r] of Object.entries(defs))out[k]={count:countRole(cards,r),cards:cardsForRole(cards,r)};
  // Generic removal can answer creatures even if parser only caught broad permanent wording.
  out.creature.count=Math.max(out.creature.count,countRole(cards,"removal"));
  out.creature.cards=uniq([...out.creature.cards,...cardsForRole(cards,"removal")]);
  return out;
}

function dependencyMetrics(cards){
  const nonlands=cards.filter(c=>!isLand(c));
  const denom=Math.max(1,nonlands.reduce((n,c)=>n+qty(c)*Math.max(.5,c.semantic.functionalWeight||.5),0));
  const types=["commander","graveyard","creatures","artifacts","enchantments","tokens"];
  const dependencies={};
  for(const d of types){
    const affected=nonlands.filter(c=>c.semantic.dependencies.includes(d));
    const weight=affected.reduce((n,c)=>n+qty(c)*Math.max(.5,c.semantic.functionalWeight||.5),0);
    const ratio=weight/denom;
    dependencies[d]={ratio:round(ratio,3),level:ratio>=.25?"HIGH":ratio>=.12?"MEDIUM":"LOW",count:affected.reduce((n,c)=>n+qty(c),0),cards:affected.map(c=>c.name)};
  }
  const roleMap=new Map();
  for(const c of nonlands)for(const r of roleIds(c))if(!["threat","payoff"].includes(r)){if(!roleMap.has(r))roleMap.set(r,[]);roleMap.get(r).push(c.name)}
  const bottlenecks=[...roleMap].filter(([,names])=>uniq(names).length===1).map(([role,names])=>({role,cards:uniq(names)}));
  return {dependencies,bottlenecks};
}

function synergyMetrics(cards){
  const produced=new Map();
  for(const c of cards)for(const tag of c.semantic.produces)produced.set(tag,(produced.get(tag)||0)+qty(c));
  let strong=0,moderate=0,generic=0,low=0,weighted=0,total=0;
  const details=[];
  for(const c of cards.filter(c=>!isLand(c))){
    const q=qty(c),matches=c.semantic.benefitsFrom.reduce((n,t)=>n+(produced.get(t)||0),0);
    let band="generic",score=.35;
    if(c.semantic.benefitsFrom.length&&matches>=8){band="strong";score=1}
    else if(c.semantic.benefitsFrom.length&&matches>=3){band="moderate";score=.7}
    else if(c.semantic.benefitsFrom.length&&!matches){band="low";score=.1}
    if(band==="strong")strong+=q;else if(band==="moderate")moderate+=q;else if(band==="low")low+=q;else generic+=q;
    weighted+=score*q;total+=q; details.push({name:c.name,band,score,matches,tags:c.semantic.benefitsFrom});
  }
  return {strong,moderate,generic,low,density:round(weighted/Math.max(1,total),3),details};
}

function interactionEfficiency(cards){
  const ints=cards.filter(c=>["removal","counterspell","board_wipe","graveyard_interaction"].some(r=>hasRole(c,r)));
  const total=ints.reduce((n,c)=>n+qty(c),0);
  if(!total)return {count:0,averageMv:0,instantPct:0,broadPct:0,conditionalPct:0,score:0};
  let mv=0,instant=0,broad=0,conditional=0,score=0;
  for(const c of ints){
    const q=qty(c),t=typeOf(c),txt=textOf(c),m=mvOf(c);
    mv+=m*q;if(/instant/.test(t))instant+=q;
    const categories=["creature_removal","artifact_removal","enchantment_removal","planeswalker_removal","land_interaction","graveyard_interaction","counterspell"].filter(r=>hasRole(c,r)).length;
    if(categories>=2||/any target|nonland permanent|target permanent/.test(txt))broad+=q;
    if(/only if|if .* attacked|tapped creature|power \d|mana value \d|unless its controller/.test(txt))conditional+=q;
    const costScore=m<=1?1:m<=2?.9:m<=3?.75:m<=4?.58:.42;
    const speedScore=/instant/.test(t)||/flash/.test(txt)?1:.72;
    const coverageScore=clamp(.45+categories*.16,.45,1);
    const reliability=/only if|tapped creature|power \d|mana value \d/.test(txt)?.72:1;
    score+=costScore*speedScore*coverageScore*reliability*q;
  }
  return {count:total,averageMv:round(mv/total,2),instantPct:round(instant/total,3),broadPct:round(broad/total,3),conditionalPct:round(conditional/total,3),score:round(score/total,3)};
}

function effectiveManaValue(cards){
  const nonlands=cards.filter(c=>!isLand(c));
  const total=nonlands.reduce((n,c)=>n+qty(c),0),printed=nonlands.reduce((n,c)=>n+mvOf(c)*qty(c),0)/Math.max(1,total);
  const reducers=cards.filter(c=>hasRole(c,"cost_reduction"));
  let adjustedSum=0;
  for(const c of nonlands){
    let discount=0;
    for(const r of reducers){
      const txt=textOf(r),ct=typeOf(c);
      if(/dragon spells/.test(txt)&&/dragon/.test(ct))discount+=1;
      else if(/creature spells/.test(txt)&&/creature/.test(ct))discount+=.65;
      else if(/artifact spells/.test(txt)&&/artifact/.test(ct))discount+=.65;
      else if(/spells you cast cost/.test(txt))discount+=.45;
    }
    adjustedSum+=Math.max(0,mvOf(c)-Math.min(discount,Math.max(0,mvOf(c)-1)))*qty(c);
  }
  return {printedAverage:round(printed,2),adjustedAverage:round(adjustedSum/Math.max(1,total),2),reducers:reducers.map(c=>c.name),confidence:reducers.length?.78:.98};
}

function closingPower(cards){
  const evidence={finishers:countRole(cards,"finisher"),threats:countRole(cards,"threat"),extraCombat:countWhere(cards,c=>/extra combat|additional combat/.test(textOf(c))),massEvasion:countWhere(cards,c=>/creatures you control.*(flying|trample|menace)|can('|’)t be blocked/.test(textOf(c))),damageMultipliers:countWhere(cards,c=>/double .*damage|triple .*damage|twice that much damage/.test(textOf(c))),massReanimation:countWhere(cards,c=>/return all .*graveyard.*battlefield|each player returns.*graveyard/.test(textOf(c))),directLifeLoss:countWhere(cards,c=>/each opponent loses|damage to each opponent/.test(textOf(c))),infiniteLines:0};
  const raw=evidence.finishers*2+evidence.extraCombat*2+evidence.massEvasion+evidence.damageMultipliers*2+evidence.massReanimation*2+evidence.directLifeLoss;
  return {level:raw>=14?"HIGH":raw>=7?"MEDIUM":"LOW",score:clamp(raw/18,0,1),confidence:.58,evidence};
}

function structuralResilience(cards){
  const relevant=cards.filter(c=>!isLand(c));
  const base=relevant.reduce((n,c)=>n+qty(c)*Math.max(.5,c.semantic.functionalWeight),0);
  const scenario=(dep)=>{
    const remaining=relevant.filter(c=>!c.semantic.dependencies.includes(dep));
    const val=remaining.reduce((n,c)=>n+qty(c)*Math.max(.5,c.semantic.functionalWeight),0);
    return round(val/Math.max(1,base),3);
  };
  return {baseline:1,withoutCommander:scenario("commander"),withoutGraveyard:scenario("graveyard"),withoutArtifacts:scenario("artifacts"),withoutCreatures:scenario("creatures"),confidence:.68};
}

// Stable lightweight PRNG so same deck + version produces comparable Lab results.
function hashSeed(s){let h=2166136261>>>0;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function shuffle(arr,r){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

function expandLibrary(cards,commanderName){
  const lib=[];let commanderRemoved=false;
  for(const c of cards){
    let q=qty(c);
    if(!commanderRemoved&&cardNameMatches(c.name,commanderName)){q=Math.max(0,q-1);commanderRemoved=true}
    for(let i=0;i<q;i++)lib.push(c);
  }
  return lib;
}
function landColors(lands){const set=new Set();for(const c of lands)for(const x of inferProducedMana(c))set.add(x);return set}
function colorSourceCounts(lands){const out={W:0,U:0,B:0,R:0,G:0,C:0};for(const land of lands)for(const c of inferProducedMana(land))out[c]=(out[c]||0)+1;return out}
function canPay(card,manaCount,landsOrColors){
  const req=parseManaCost(manaCostOf(card));
  if(mvOf(card)>manaCount)return false;
  if(landsOrColors instanceof Set){for(const c of COLORS)if(req.pips[c]>0&&!landsOrColors.has(c))return false;return true}
  const counts=colorSourceCounts(landsOrColors||[]);
  for(const c of COLORS)if(req.pips[c]>(counts[c]||0))return false;
  return true;
}
function earlyAction(c){return ["ramp","mana_fixing","card_selection","card_draw","engine","cost_reduction"].some(r=>hasRole(c,r))&&mvOf(c)<=3}
function keepHand(hand){const lands=hand.filter(isLand).length;return lands>=2&&lands<=4&&hand.some(earlyAction)}
function mulligan(library,r){
  for(let size=7;size>=5;size--){const shuffled=shuffle(library,r),hand=shuffled.slice(0,7);if(size===5||keepHand(hand)){
      if(size<7){const keep=hand.slice().sort((a,b)=>{const pa=isLand(a)?0:earlyAction(a)?1:2,pb=isLand(b)?0:earlyAction(b)?1:2;return pa-pb}).slice(0,size);return {hand:keep,deck:shuffled.slice(7),mulligans:7-size}}
      return {hand,deck:shuffled.slice(7),mulligans:0};
    }}
  return {hand:[],deck:library,mulligans:2};
}

export function simulateDevelopment(cards,{commanderName="",iterations=5000,turns=7,seed="manashelf"}={}){
  const library=expandLibrary(cards,commanderName),commander=cards.find(c=>cardNameMatches(c.name,commanderName))||null;
  const r=rng(hashSeed(`${seed}|${library.map(c=>c.name).join("|")}|${iterations}|${turns}|v${SIMULATION_VERSION}`));
  const out={iterations,turns,mulligans:0,byTurn:Array.from({length:turns},(_,i)=>({turn:i+1,landDrop:0,rampCast:0,rampDeployed:0,productive:0,resourceAvailable:0,engineAvailable:0,payoffAvailable:0,threatAvailable:0,commanderCastable:0,requiredColors:0,manaSum:0}))};
  const demandByTurn=Array.from({length:turns},(_,i)=>{const demand=new Set();for(const c of cards)if(!isLand(c)&&mvOf(c)<=i+1)for(const col of parseManaCost(manaCostOf(c)).colors)demand.add(col);return [...demand]});
  for(let sim=0;sim<iterations;sim++){
    const m=mulligan(library,r);out.mulligans+=m.mulligans;let hand=m.hand.slice(),drawPile=m.deck.slice(),landsInPlay=[],board=[],bonusMana=0,rampDeployed=false;
    for(let turn=1;turn<=turns;turn++){
      if(turn>1&&drawPile.length)hand.push(drawPile.shift());
      const landIndex=hand.findIndex(isLand);let landPlayed=false;
      if(landIndex>=0){landsInPlay.push(hand.splice(landIndex,1)[0]);landPlayed=true}
      const colors=landColors(landsInPlay),availableMana=landsInPlay.length+bonusMana;
      let spent=0,rampCast=false,productive=false;
      // Cast at most one early setup/ramp spell; enough for development probabilities without a game engine.
      const playable=hand.map((c,i)=>({c,i})).filter(x=>!isLand(x.c)&&earlyAction(x.c)&&canPay(x.c,availableMana-spent,landsInPlay)).sort((a,b)=>mvOf(a.c)-mvOf(b.c));
      if(playable.length){const {c,i}=playable[0];spent+=Math.max(1,mvOf(c));hand.splice(i,1);productive=true;if(hasRole(c,"ramp")){bonusMana+=1;rampCast=true;rampDeployed=true}if(!/instant|sorcery/.test(typeOf(c)))board.push(c)}
      const stateCards=[...hand,...landsInPlay,...board];
      const row=out.byTurn[turn-1];
      if(landPlayed)row.landDrop++;
      if(rampCast)row.rampCast++;
      if(rampDeployed)row.rampDeployed++;
      if(productive)row.productive++;
      if(stateCards.some(c=>["card_draw","impulse_draw","tutor","recursion","card_advantage"].some(x=>hasRole(c,x))))row.resourceAvailable++;
      if(stateCards.some(c=>hasRole(c,"engine")))row.engineAvailable++;
      if(stateCards.some(c=>hasRole(c,"payoff")))row.payoffAvailable++;
      if(stateCards.some(c=>hasRole(c,"threat")||hasRole(c,"finisher")))row.threatAvailable++;
      if(commander&&canPay(commander,availableMana,landsInPlay))row.commanderCastable++;
      const demand=demandByTurn[turn-1];if(!demand.length||demand.every(c=>colors.has(c)))row.requiredColors++;
      row.manaSum+=availableMana;
    }
  }
  for(const row of out.byTurn){for(const k of ["landDrop","rampCast","rampDeployed","productive","resourceAvailable","engineAvailable","payoffAvailable","threatAvailable","commanderCastable","requiredColors"])row[k]=round(row[k]/iterations,3);row.averageMana=round(row.manaSum/iterations,2);delete row.manaSum}
  out.averageMulligans=round(out.mulligans/iterations,2);delete out.mulligans;
  return out;
}

function manaReliability(cards,simulation){
  const lands=cards.filter(isLand),landCount=lands.reduce((n,c)=>n+qty(c),0),sources={W:0,U:0,B:0,R:0,G:0,C:0},allSources={W:0,U:0,B:0,R:0,G:0,C:0};
  for(const c of lands){for(const col of inferProducedMana(c))sources[col]=(sources[col]||0)+qty(c)}
  for(const c of cards){for(const col of inferProducedMana(c))allSources[col]=(allSources[col]||0)+qty(c)}
  const demand={W:0,U:0,B:0,R:0,G:0};for(const c of cards.filter(c=>!isLand(c))){const p=parseManaCost(manaCostOf(c));for(const col of COLORS)demand[col]+=p.pips[col]*qty(c)}
  const t3=simulation.byTurn[2]||simulation.byTurn.at(-1)||{};
  return {landCount,sources,allSources,demand,landDropT1:simulation.byTurn[0]?.landDrop||0,landDropT2:simulation.byTurn[1]?.landDrop||0,landDropT3:t3.landDrop||0,requiredColorsT3:t3.requiredColors||0,rampByT3:t3.rampDeployed||0,averageManaT3:t3.averageMana||0,confidence:.94};
}

function setupPayoff(cards,simulation){
  const enablers=countWhere(cards,c=>c.semantic.setup),payoffs=countWhere(cards,c=>c.semantic.payoff),both=countWhere(cards,c=>c.semantic.setup&&c.semantic.payoff);
  const t5=simulation.byTurn[4]||{};
  return {enablers,payoffs,both,ratio:round(enablers/Math.max(1,payoffs),2),payoffAvailableT5:t5.payoffAvailable||0};
}

function functionalDensity(cards){
  const nonlands=cards.filter(c=>!isLand(c));let weighted=0,total=0,one=0,two=0,threePlus=0;
  for(const c of nonlands){const q=qty(c),roles=roleIds(c).length;weighted+=(c.semantic.functionalWeight||0)*q;total+=q;if(roles<=1)one+=q;else if(roles===2)two+=q;else threePlus+=q}
  return {value:round(weighted/Math.max(1,total),2),oneRole:one,twoRoles:two,threePlusRoles:threePlus};
}

function gameplanConsistency(cards,simulation,synergy,dependency){
  const t3=simulation.byTurn[2]||{},t5=simulation.byTurn[4]||{};
  const roleCounts=["ramp","card_draw","engine","payoff","interaction"].map(id=>id==="interaction"?countWhere(cards,c=>["removal","counterspell","board_wipe"].some(r=>hasRole(c,r))):countRole(cards,id));
  const redundancy=roleCounts.filter(n=>n>=3).length/roleCounts.length;
  const coreSequence=(t3.landDrop||0)*(.5+.5*(t3.productive||0))*(.5+.5*(t5.payoffAvailable||0));
  const depPenalty=dependency.dependencies.commander?.ratio||0;
  const value=clamp(coreSequence*.55+redundancy*.2+synergy.density*.25-depPenalty*.2);
  return {value:round(value,3),roleRedundancy:round(redundancy,2),coreSequenceProbability:round(coreSequence,3),confidence:.66};
}

function deadCardRisk(cards){
  // Structural proxy only: cards with dependencies unsupported by enough producers.
  const support={creatures:countWhere(cards,isCreature),artifacts:countWhere(cards,c=>/artifact/.test(typeOf(c))),enchantments:countWhere(cards,c=>/enchantment/.test(typeOf(c))),tokens:countRole(cards,"token_generation"),graveyard:countWhere(cards,c=>/graveyard|mill/.test(textOf(c))),commander:1};
  const risky=[];let riskWeight=0,total=0;
  for(const c of cards.filter(c=>!isLand(c))){const q=qty(c);total+=q;let risk=0;for(const d of c.semantic.dependencies){const s=support[d]??99;if(s<=2)risk+=.55;else if(s<=5)risk+=.25}risk=clamp(risk);if(risk>=.25)risky.push({name:c.name,risk:round(risk,2),dependencies:c.semantic.dependencies});riskWeight+=risk*q}
  return {rate:round(riskWeight/Math.max(1,total),3),riskyCards:risky.sort((a,b)=>b.risk-a.risk).slice(0,12),confidence:.48,method:"structural_proxy"};
}

export function buildDeckMetrics(cards,{commanderName="",tribalType=null,iterations=5000,deckSignature=""}={}){
  const classified=applySemanticClassification(cards,{commanderName,tribalType});
  const nonlands=classified.filter(c=>!isLand(c)),nonlandCount=nonlands.reduce((n,c)=>n+qty(c),0);
  const simulation=simulateDevelopment(classified,{commanderName,iterations,seed:deckSignature||commanderName});
  const coverage=interactionCoverage(classified),intCount=countWhere(classified,c=>["removal","counterspell","board_wipe","graveyard_interaction"].some(r=>hasRole(c,r)));
  const dependency=dependencyMetrics(classified),synergy=synergyMetrics(classified),efficiency=interactionEfficiency(classified),effectiveMv=effectiveManaValue(classified),closing=closingPower(classified),resilience=structuralResilience(classified),mana=manaReliability(classified,simulation),functional=functionalDensity(classified),setup=setupPayoff(classified,simulation),dead=deadCardRisk(classified),consistency=gameplanConsistency(classified,simulation,synergy,dependency);
  const resource={immediateDraw:countRole(classified,"card_draw"),repeatableEngines:countRole(classified,"engine"),tutors:countRole(classified,"tutor"),recursion:countRole(classified,"recursion"),resourceEffects:countWhere(classified,c=>["card_draw","impulse_draw","tutor","recursion","card_advantage"].some(r=>hasRole(c,r))),resourceAvailableT5:simulation.byTurn[4]?.resourceAvailable||0};
  const threat={threats:countRole(classified,"threat"),payoffs:countRole(classified,"payoff"),finishers:countRole(classified,"finisher"),threatDensity:round(countRole(classified,"threat")/Math.max(1,nonlandCount),3),payoffDensity:round(countRole(classified,"payoff")/Math.max(1,nonlandCount),3),payoffAvailableT5:simulation.byTurn[4]?.payoffAvailable||0,threatAvailableT6:simulation.byTurn[5]?.threatAvailable||0};
  const engines={count:countRole(classified,"engine"),density:round(countRole(classified,"engine")/Math.max(1,nonlandCount),3),availableT4:simulation.byTurn[3]?.engineAvailable||0,availableT5:simulation.byTurn[4]?.engineAvailable||0,availableT6:simulation.byTurn[5]?.engineAvailable||0};
  const speed={byTurn:simulation.byTurn.map(x=>({turn:x.turn,relevance:round(Math.max(x.engineAvailable,x.payoffAvailable,x.threatAvailable,x.commanderCastable),3)})),medianTurn:null,confidence:.61};
  speed.medianTurn=speed.byTurn.find(x=>x.relevance>=.5)?.turn??null;

  const metrics={
    manaReliability:mana,
    earlyDevelopment:{productiveT1:simulation.byTurn[0]?.productive||0,productiveT2:simulation.byTurn[1]?.productive||0,productiveT3:simulation.byTurn[2]?.productive||0,averageManaT3:simulation.byTurn[2]?.averageMana||0,confidence:.86},
    resourceFlow:{...resource,confidence:.82},
    interactionDensity:{count:intCount,density:round(intCount/Math.max(1,nonlandCount),3),coverage,confidence:.94},
    interactionEfficiency:{...efficiency,confidence:.82},
    threatPayoffDensity:{...threat,confidence:.72},
    engineDensity:{...engines,confidence:.76},
    functionalDensity:{...functional,confidence:.79},
    setupPayoffBalance:{...setup,confidence:.72},
    gameplanConsistency:consistency,
    synergyDensity:{...synergy,confidence:.62},
    dependencyRisk:{...dependency,confidence:.78},
    deadCardRisk:dead,
    resilience:{...resilience},
    effectiveManaValue:effectiveMv,
    speed,
    closingPower:closing,
    goldfishDevelopment:{...simulation,confidence:.84}
  };

  return {
    engine:{metricsVersion:METRICS_ENGINE_VERSION,classificationVersion:CLASSIFICATION_VERSION,simulationVersion:SIMULATION_VERSION,simulationCount:iterations},
    metrics,
    classifications:classified.map(c=>({name:c.name,quantity:qty(c),typeLine:c.meta?.typeLine||c.typeLine||"",manaValue:mvOf(c),manaCost:manaCostOf(c),roles:roleIds(c),primaryRole:c.semantic.primaryRole,dependencies:c.semantic.dependencies,synergyTags:c.semantic.synergyTags,setup:c.semantic.setup,payoff:c.semantic.payoff,functionalWeight:c.semantic.functionalWeight,confidence:c.semantic.confidence})),
    caveats:[
      "El simulador modela desarrollo temprano, no partidas completas de Commander.",
      "Synergy, closing power, dead-card risk y resiliencia son métricas heurísticas y muestran menor confianza.",
      "Las clasificaciones se basan en datos Scryfall y reglas de Oracle text; interacciones implícitas o combos pueden no detectarse."
    ]
  };
}
