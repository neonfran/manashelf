// ManaShelf Deck Metrics Engine v1
// Pure, dependency-free EDH deck diagnostics for Lab validation.
// Scope: deterministic semantic tags + lightweight development simulation.

export const METRICS_ENGINE_VERSION = 1;
export const CLASSIFICATION_VERSION = 1;
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

export function classifyCard(card,{tribalType=null,commanderName=""}={}){
  const text=textOf(card),type=typeOf(card),name=String(card?.name||"");
  const roles=[],dependencies=[],synergyTags=[],produces=[],benefitsFrom=[];
  const add=(id,c=.9)=>addRole(roles,id,c);

  if(isLand(card)){add("land",1);add("mana_source",1);if(inferProducedMana(card).length>1)add("mana_fixing",.98)}
  if(!isLand(card)&&(/add \{[wubrgc]\}|add one mana|create .*treasure|treasure token|search your library for .*land/.test(text))){add("ramp",.92);if(/any color|search your library for .*land|treasure/.test(text))add("mana_fixing",.88)}
  if(/costs? \{?\d+\}? less|costs? one less|spells? you cast cost|affinity for|convoke/.test(text))add("cost_reduction",.9);

  if(/draw (a|one|two|three|four|five|x|\d+) cards?|draw cards/.test(text))add("card_draw",.96);
  if(/investigate|surveil|scry \d|look at the top .* (put|you may)/.test(text))add("card_selection",.82);
  if(/exile .*you may (play|cast)|you may play .* exile|play .* from exile/.test(text)){add("impulse_draw",.86);add("card_advantage",.75)}
  if(/search your library for (a|an|up to|two|three|target).*card|search your library for .* card/.test(text))add("tutor",.9);
  if(/from your graveyard to (your hand|the battlefield)|return target .* from your graveyard|cast .* from your graveyard|play .* from your graveyard/.test(text))add("recursion",.94);

  if(/counter target (spell|activated|triggered)/.test(text))add("counterspell",.99);
  const wipe=/destroy all|exile all|all creatures get -|each creature gets -|damage to each creature|each player sacrifices .*creatures/.test(text);
  if(wipe)add("board_wipe",.96);
  if(!wipe&&/destroy target|exile target|return target (creature|permanent|nonland|artifact|enchantment)|target creature gets -|deals? (\d+|x) damage to target/.test(text))add("removal",.9);
  if(/exile .*graveyard|exile all cards from .*graveyard|cards in graveyards can('|’)t|players can('|’)t cast spells from graveyards|graveyard.*exile/.test(text))add("graveyard_interaction",.96);
  if(/destroy target artifact|exile target artifact|artifact or enchantment/.test(text))add("artifact_removal",.93);
  if(/destroy target enchantment|exile target enchantment|artifact or enchantment/.test(text))add("enchantment_removal",.93);
  if(/destroy target creature|exile target creature|target creature gets -|damage to target creature/.test(text))add("creature_removal",.93);
  if(/destroy target planeswalker|exile target planeswalker|any target/.test(text))add("planeswalker_removal",.72);
  if(/destroy target land|exile target land|nonbasic land/.test(text))add("land_interaction",.92);

  if(/hexproof|indestructible|phases? out|protection from|regenerate|return .* you control to .* hand/.test(text))add("protection",.88);
  if(/create .* token/.test(text))add("token_generation",.9);
  if(/haste|gain haste/.test(text))add("haste",.92);
  if(/flying|trample|menace|unblockable|can('|’)t be blocked/.test(text))add("evasion",.72);
  if(/sacrifice (a|another|one or more|any number of).*[:.,]|sacrifice a creature:|sacrifice another creature/.test(text))add("sacrifice_outlet",.9);

  const repeatable=/whenever|at the beginning|at the end|each upkeep|whenever you cast|whenever .* enters|whenever .* deals combat damage|\{t\}:|once each turn/.test(text);
  const engineValue=/draw|create .*token|return .*graveyard|exile .*you may|put .*counter|gain .*life|search your library/.test(text);
  if(repeatable&&engineValue)add("engine",.8);
  if(repeatable&&/deals? .*damage/.test(text))add("damage_engine",.75);

  if(/extra combat|additional combat|double .*power|double .*damage|triple .*damage|win the game|loses the game|each opponent loses x|each opponent loses .* for each|deals? damage equal to .* each opponent/.test(text))add("finisher",.83);
  if((isCreature(card)&&mvOf(card)>=5)||/whenever .* deals combat damage|whenever .* attacks|at the beginning of combat/.test(text))add("threat",.62);
  if(/whenever|for each|you control|get \+|gets \+|additional|double|triple|instead/.test(text)&&/(draw|create .*token|add \{|damage|counter|gain .*life|power|toughness|cost)/.test(text))add("payoff",.7);

  if(/creature enters|creatures enter|enters the battlefield/.test(text)){synergyTags.push("creature_etb");benefitsFrom.push("creature_etb")}
  if(/dies|sacrifice/.test(text)){synergyTags.push("sacrifice","death");benefitsFrom.push("death")}
  if(/graveyard/.test(text)){synergyTags.push("graveyard");dependencies.push("graveyard")}
  if(/artifact/.test(text)){synergyTags.push("artifact");if(!type.includes("artifact"))benefitsFrom.push("artifact")}
  if(/enchantment/.test(text)){synergyTags.push("enchantment");if(!type.includes("enchantment"))benefitsFrom.push("enchantment")}
  if(/instant or sorcery|instant and sorcery|magecraft|noncreature spell/.test(text)){synergyTags.push("spellslinger");benefitsFrom.push("spellslinger")}
  if(/token/.test(text)){synergyTags.push("token");benefitsFrom.push("token")}
  if(/combat damage|attacks|attack each combat/.test(text)){synergyTags.push("combat");benefitsFrom.push("combat")}
  if(/you gain life|gained life/.test(text)){synergyTags.push("lifegain");benefitsFrom.push("lifegain")}
  if(/landfall|whenever a land enters|additional land/.test(text)){synergyTags.push("lands");benefitsFrom.push("lands")}

  if(isCreature(card)){produces.push("creature_etb");synergyTags.push("creature")}
  if(type.includes("artifact"))produces.push("artifact");
  if(type.includes("enchantment"))produces.push("enchantment");
  if(type.includes("instant")||type.includes("sorcery"))produces.push("spellslinger");
  if(hasRole({semantic:{roles}},"token_generation"))produces.push("token");

  if(tribalType){
    const re=new RegExp(`\\b${String(tribalType).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}s?\\b`,`i`);
    if(re.test(type)){synergyTags.push(`tribe:${tribalType.toLowerCase()}`);produces.push(`tribe:${tribalType.toLowerCase()}`)}
    if(re.test(text)){synergyTags.push(`tribe:${tribalType.toLowerCase()}`);benefitsFrom.push(`tribe:${tribalType.toLowerCase()}`);add("tribal_payoff",.92)}
  }

  if(/if you control your commander|commander you control|your commander/.test(text)){dependencies.push("commander");benefitsFrom.push("commander")}
  if(/if you control a creature|target creature you control|creatures? you control/.test(text))dependencies.push("creatures");
  if(/if you control an artifact|artifacts? you control/.test(text))dependencies.push("artifacts");
  if(/if you control an enchantment|enchantments? you control/.test(text))dependencies.push("enchantments");
  if(/if you control a token|tokens? you control/.test(text))dependencies.push("tokens");

  const ids=roles.map(r=>r.id);
  const setupRoles=new Set(["ramp","mana_fixing","cost_reduction","card_selection","tutor","protection"]);
  const payoffRoles=new Set(["payoff","threat","finisher","engine","tribal_payoff"]);
  const setup=ids.some(x=>setupRoles.has(x));
  const payoff=ids.some(x=>payoffRoles.has(x));
  const primary=ids[0]||(/creature/.test(type)?"creature":/land/.test(type)?"land":"utility");
  const roleWeight=ids.reduce((n,id)=>n+(id===primary?1:setupRoles.has(id)||payoffRoles.has(id)?0.5:0.25),0);
  const confidence=roles.length?round(roles.reduce((n,r)=>n+r.confidence,0)/roles.length,2):0.55;
  return {name,roles,roleIds:ids,primaryRole:primary,dependencies:uniq(dependencies),synergyTags:uniq(synergyTags),produces:uniq(produces),benefitsFrom:uniq(benefitsFrom),setup,payoff,functionalWeight:round(roleWeight,2),confidence,classificationSource:"rules",isCommander:name.toLowerCase()===String(commanderName||"").toLowerCase()};
}

const semanticCache=new Map();
export function applySemanticClassification(cards,options={}){
  return (cards||[]).map(c=>{
    const cacheKey=[CLASSIFICATION_VERSION,String(c?.name||""),String(c?.meta?.oracleText||c?.oracleText||""),String(c?.meta?.typeLine||c?.typeLine||""),String(options.tribalType||"")].join("|");
    let semantic=semanticCache.get(cacheKey);
    if(!semantic){semantic=classifyCard(c,{...options,commanderName:""});semanticCache.set(cacheKey,semantic)}
    semantic={...semantic,isCommander:String(c?.name||"").toLowerCase()===String(options.commanderName||"").toLowerCase()};
    return {...c,semantic};
  });
}

function countRole(cards,id){return cards.reduce((n,c)=>n+(hasRole(c,id)?qty(c):0),0)}
function cardsForRole(cards,id){return cards.filter(c=>hasRole(c,id)).map(c=>c.name)}
function countWhere(cards,fn){return cards.reduce((n,c)=>n+(fn(c)?qty(c):0),0)}

function interactionCoverage(cards){
  const defs={creature:"creature_removal",artifact:"artifact_removal",enchantment:"enchantment_removal",planeswalker:"planeswalker_removal",land:"land_interaction",graveyard:"graveyard_interaction",stack:"counterspell",wipes:"board_wipe",protection:"protection"};
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
    if(!commanderRemoved&&String(c.name).toLowerCase()===String(commanderName||"").toLowerCase()){q=Math.max(0,q-1);commanderRemoved=true}
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
  const library=expandLibrary(cards,commanderName),commander=cards.find(c=>String(c.name).toLowerCase()===String(commanderName||"").toLowerCase())||null;
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
