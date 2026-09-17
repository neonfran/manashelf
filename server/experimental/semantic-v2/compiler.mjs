import {compileCard as compileLegacyCard, semanticFacts} from "../semantic/compiler.mjs";
import {
  SEMANTIC_V2_SCHEMA,SEMANTIC_V2_SCHEMA_VERSION,SEMANTIC_V2_COMPILER_VERSION,COVERAGE,
  predicate,and,or,not,cardinality,logicTrue,entityRef
} from "./schema.mjs";

const lower=x=>String(x||"").toLowerCase();
const clean=x=>String(x||"").trim();
const uniq=xs=>[...new Set((xs||[]).filter(x=>x!==null&&x!==undefined&&x!==""))];
const NUMBER_WORDS={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50};
const num=x=>NUMBER_WORDS[lower(x)]??(Number.isFinite(Number(x))?Number(x):null);
const MULTIWORD_PRINTED_SUBTYPES=["Time Lord"];
const COMPOSITE_SUBTYPE_PHRASES=new Map([["eldrazi spawn",["Eldrazi","Spawn"]]]);
const PREDEFINED_ARTIFACT_TOKEN_SUBTYPES=new Set(["Blood","Clue","Food","Gold","Incubator","Junk","Map","Powerstone","Treasure"]);
const TOKEN_DESCRIPTOR_NOISE=new Set(["a","an","one","two","three","four","five","six","seven","eight","nine","ten","x","xx","colorless","white","blue","black","red","green","and","or","tapped","untapped","attacking","legendary","snow","artifact","creature","enchantment","land","token","tokens"]);
function tokenDescriptor(rawText){
  const raw=String(rawText||"");
  const m=raw.match(/\bcreate(?:s|d)?\s+(?:(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+|x)\s+)?(.{1,120}?)\s+tokens?\b/i);
  if(!m||/\bcopy of\b/i.test(m[1]))return null;
  let descriptor=m[1].replace(/\b(?:named|with|that(?:'s| is))\b.*$/i,"").trim();if(!descriptor)return null;
  const cardTypes=[];for(const t of ["Artifact","Creature","Enchantment","Land"])if(new RegExp(`\\b${t}\\b`,`i`).test(descriptor))cardTypes.push(t);
  const words=descriptor.replace(/\b\d+\s*\/\s*\d+\b/g," ").replace(/[^A-Za-z'’-]+/g," ").trim().split(/\s+/).filter(Boolean);
  const subtypes=[];for(const word of words){if(TOKEN_DESCRIPTOR_NOISE.has(word.toLowerCase()))continue;const normalized=word[0].toUpperCase()+word.slice(1).toLowerCase();if(!subtypes.includes(normalized))subtypes.push(normalized);}
  for(const st of subtypes)if(PREDEFINED_ARTIFACT_TOKEN_SUBTYPES.has(st)&&!cardTypes.includes("Artifact"))cardTypes.push("Artifact");
  const named=raw.match(/\btokens? named ([A-Z][A-Za-z0-9'’ -]*?)(?=[.,]|$)/);
  return {cardTypes:uniq(cardTypes),subtypes:uniq(subtypes),name:named?.[1]?.trim()||null};
}

const META_ACTIONS=new Set(["modal_instruction","modal_choice","reminder_text"]);

function refFrom(value,rawText="",role="entity"){
  const v=String(value||"").toLowerCase();
  const raw=lower(rawText);
  if(/\bthat player\b/.test(raw) && ["actor","beneficiary","target"].includes(role))return entityRef("referenced_player",{antecedent:"event_or_previous_clause.player"});
  const map={
    you:"you",source_controller:"you",opponent:"opponent",each_opponent:"each_opponent",all_opponents:"each_opponent",
    target_player:"target_player",referenced_player:"referenced_player",all_players:"each_player",each_player:"each_player",
    object_controller:"object_controller",object_owner:"object_owner",source:"source",self:"source",player:"player"
  };
  if(map[v])return entityRef(map[v]);
  if(v)return entityRef("symbolic",{value});
  if(/\beach opponent\b|\byour opponents\b/.test(raw))return entityRef("each_opponent");
  if(/\btarget opponent\b/.test(raw))return entityRef("target_opponent");
  if(/\btarget player\b/.test(raw))return entityRef("target_player");
  return null;
}

function dependencyExpr(tags=[]){
  const items=uniq(tags).map(tag=>{
    const [ns,...rest]=String(tag).split(":");const value=rest.join(":");
    if(ns==="zone")return predicate("zone_requirement",value);
    if(ns==="permanent")return predicate("controls_permanent",value);
    if(ns==="card")return predicate("card_characteristic",value);
    if(ns==="event")return predicate("event_occurred",value);
    if(ns==="commander")return predicate("commander_state",value);
    return predicate("semantic_dependency",tag);
  });
  return and(items);
}

function conditionExpr(rawText,legacyCondition=null,{sourceName=null}={}){
  const t=lower(rawText);
  const rawOriginal=String(rawText||"");
  const parts=[];
  let xv=t.match(/\bif x is (one|two|three|four|five|six|seven|eight|nine|ten|\d+) or more\b/);
  if(xv)parts.push(predicate("variable_value",{variable:"X",comparison:"at_least",value:num(xv[1])}));
  else {xv=t.match(/\bif x is (one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/);if(xv)parts.push(predicate("variable_value",{variable:"X",comparison:"exactly",value:num(xv[1])}));}
  if(/^∞\s*[—-]/.test(clean(rawText)))parts.push(predicate("source_state","harnessed"));
  let m=t.match(/if you control (four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|\d+) or more ([a-z]+)s? with different names/);
  if(m){
    const rawKind=m[2].replace(/s$/,""),genericType={artifact:"Artifact",creature:"Creature",enchantment:"Enchantment",land:"Land",planeswalker:"Planeswalker"}[rawKind]||null;
    parts.push(cardinality("at_least",num(m[1]),[predicate("controlled_permanent",genericType?{cardType:genericType,controller:"you"}:{subtype:rawKind,controller:"you"})]));
    parts.push(predicate("distinct_names",true));
  }
  if(/if your library has no cards? in it|while your library has no cards? in it/.test(t))parts.push(predicate("zone_card_count",{owner:"you",zone:"library",comparison:"exactly",count:0}));
  if(/if (?:this|that) (?:creature|artifact|permanent) is tapped/.test(t))parts.push(predicate("source_state","tapped"));
  if(/(?:if|as long as) you control (?:your|a) commander(?:\b| as you cast)/.test(t))parts.push(predicate("commander_state","controlled"));
  // Deck-package conditions: preserve the controlled permanent family and any explicit cardinality.
  const basicSubtype=x=>x?x[0].toUpperCase()+x.slice(1).toLowerCase():null;
  const sourceNameNorm=lower(sourceName).trim(),sourceShort=sourceNameNorm.split(/[ ,]/)[0]||"";
  const shortCanNameSource=sourceShort.length>=4&&(sourceNameNorm.startsWith(`${sourceShort} of `)||sourceNameNorm.startsWith(`${sourceShort},`));
  const isSourceName=x=>Boolean(sourceNameNorm)&&(x===sourceNameNorm||(shortCanNameSource&&x===sourceShort));
  const looksLikePrintedProperName=x=>{
    if(!x||!x.includes(" "))return false;
    const escaped=x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\\ /g,"\\s+");
    const m=rawOriginal.match(new RegExp(`\\b${escaped}\\b`,`i`));if(!m)return false;
    const words=m[0].trim().split(/\s+/);if(words.length<2)return false;
    return words.every(w=>/^[A-Z][A-Za-z0-9'’-]*$/.test(w));
  };
  let ctl=t.match(/(?:if|only if|as long as) you control (two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|\d+) or more (artifacts?|creatures?|enchantments?|lands?|planeswalkers?)/);
  if(ctl){const typ=ctl[2].replace(/s$/,'');parts.push(cardinality("at_least",num(ctl[1]),[predicate("controlled_permanent",{cardType:typ[0].toUpperCase()+typ.slice(1),controller:"you"})]));}
  let ctlMax=t.match(/(?:if|only if|as long as) you control (one|two|three|four|five|six|seven|eight|nine|ten|\d+) or fewer (artifacts?|creatures?|enchantments?|lands?|planeswalkers?)/);
  if(ctlMax){const typ=ctlMax[2].replace(/s$/,'');parts.push(predicate("controlled_count_limit",{controller:"you",comparison:"at_most",count:num(ctlMax[1]),cardType:typ[0].toUpperCase()+typ.slice(1)}));}
  let nonlandNontoken=t.match(/(?:if|only if|as long as) you control (one|two|three|four|five|six|seven|eight|nine|ten|\d+) or more nonland,? nontoken permanents?/);
  if(nonlandNontoken)parts.push(cardinality("at_least",num(nonlandNontoken[1]),[predicate("controlled_permanent",{controller:"you",excludedCardType:"Land",token:false})]));
  // Land-entry gates are structural state, including the modern fast/slow/battle land families.
  let landCtl=t.match(/if you control (two|three|four|five|\d+) or more other lands/);if(landCtl)parts.push(cardinality("at_least",num(landCtl[1]),[predicate("controlled_permanent",{cardType:"Land",controller:"you",other:true})]));
  landCtl=t.match(/unless you control (two|three|four|five|\d+) or more other lands/);if(landCtl)parts.push(not(cardinality("at_least",num(landCtl[1]),[predicate("controlled_permanent",{cardType:"Land",controller:"you",other:true})])));
  landCtl=t.match(/unless you control (two|three|four|five|\d+) or fewer other lands/);if(landCtl)parts.push(not(cardinality("at_most",num(landCtl[1]),[predicate("controlled_permanent",{cardType:"Land",controller:"you",other:true})])));
  landCtl=t.match(/unless you control (two|three|four|five|\d+) or more basic lands/);if(landCtl)parts.push(not(cardinality("at_least",num(landCtl[1]),[predicate("controlled_permanent",{cardType:"Land",basic:true,controller:"you"})])));
  if(/unless you control (?:a|one) basic land/.test(t))parts.push(not(predicate("controlled_permanent",{cardType:"Land",basic:true,controller:"you"})));
  if(/unless you control (?:a )?mount or vehicle/.test(t))parts.push(not(or(predicate("controlled_permanent",{subtype:"Mount",controller:"you"}),predicate("controlled_permanent",{subtype:"Vehicle",controller:"you"}))));
  if(/unless you discard a creature card/.test(t))parts.push(not(predicate("card_characteristic","creature")));
  if(/unless you discard an? artifact card/.test(t))parts.push(not(predicate("card_characteristic","artifact")));
  if(/unless you return (?:a )?non-lair land you control/.test(t))parts.push(not(predicate("controlled_permanent",{cardType:"Land",controller:"you",excludedSubtype:"Lair"})));
  if(/unless you return (?:a )?land you control/.test(t))parts.push(not(predicate("controlled_permanent",{cardType:"Land",controller:"you"})));
  if(/unless you return an untapped island you control/.test(t))parts.push(not(predicate("controlled_permanent",{cardType:"Land",subtype:"Island",controller:"you",untapped:true})));
  if(/unless you return another creature you control/.test(t))parts.push(not(predicate("controlled_permanent",{cardType:"Creature",controller:"you",other:true})));
  if(/unless you exile (?:the top )?creature card (?:of|from) your graveyard/.test(t))parts.push(not(and(predicate("zone_requirement","your_graveyard"),predicate("card_characteristic","creature"))));
  if(/unless you exile a card from your graveyard/.test(t))parts.push(not(predicate("zone_requirement","your_graveyard")));
  ctl=t.match(/(?:if|only if|as long as) you control (?:(?:an?|another) )?(artifact|creature|enchantment|land|planeswalker)(?:\b| with)/);
  if(ctl)parts.push(predicate("controlled_permanent",{cardType:ctl[1][0].toUpperCase()+ctl[1].slice(1),controller:"you",powerAtLeast:(t.match(/creature with power (\d+) or greater/)||[])[1]?Number((t.match(/creature with power (\d+) or greater/)||[])[1]):undefined}));
  if(/(?:if|only if|as long as) you control (?:a )?legendary creature/.test(t))parts.push(predicate("controlled_permanent",{cardType:"Creature",legendary:true,controller:"you"}));
  let lands=t.match(/(?:if|only if|as long as) you control (?:a |an )?(plains|island|swamp|mountain|forest)(?: or (?:a |an )?(plains|island|swamp|mountain|forest))?/);
  if(lands){const ps=[lands[1],lands[2]].filter(Boolean).map(x=>predicate("controlled_permanent",{cardType:"Land",subtype:basicSubtype(x),controller:"you"}));parts.push(ps.length>1?or(ps):ps[0]);}
  if(/(?:if|only if|as long as) you control an artifact and an enchantment/.test(t))parts.push(and(predicate("controlled_permanent",{cardType:"Artifact",controller:"you"}),predicate("controlled_permanent",{cardType:"Enchantment",controller:"you"})));
  let none=t.match(/if you control no (artifacts?|creatures?|enchantments?|lands?)/);if(none){const typ=none[1].replace(/s$/,'');parts.push(not(predicate("controlled_permanent",{cardType:typ[0].toUpperCase()+typ.slice(1),controller:"you"})));}
  let scaled=t.match(/(?:where x is (?:one plus |twice |half )?the number of|for each) (artifacts?|creatures?|enchantments?|lands?|planeswalkers?) you control/);if(scaled){const typ=scaled[1].replace(/s$/,'');parts.push(predicate("controlled_permanent",{cardType:typ[0].toUpperCase()+typ.slice(1),controller:"you",scalesMagnitude:true}));}
  if(/(?:where x is (?:one plus |twice |half )?the number of|for each) legendary creatures? you control/.test(t))parts.push(predicate("controlled_permanent",{cardType:"Creature",legendary:true,controller:"you",scalesMagnitude:true}));
  if(/(?:where x is the number of|for each) artifacts? and\/or enchantments? you control/.test(t))parts.push(or(predicate("controlled_permanent",{cardType:"Artifact",controller:"you",scalesMagnitude:true}),predicate("controlled_permanent",{cardType:"Enchantment",controller:"you",scalesMagnitude:true})));
  if(/where x is the greatest mana value among artifacts you control/.test(t))parts.push(predicate("controlled_permanent",{cardType:"Artifact",controller:"you",scalesMagnitude:true,valueReference:"greatest_mana_value"}));
  if(/where x is the (?:greatest power|greatest toughness|total power) (?:among|of) (?:other )?creatures you control/.test(t))parts.push(predicate("controlled_permanent",{cardType:"Creature",controller:"you",scalesMagnitude:true,aggregateReference:(t.match(/greatest power|greatest toughness|total power/)||[])[0]||"aggregate"}));
  if(/where x is the number of creatures with defender you control/.test(t))parts.push(predicate("controlled_permanent",{cardType:"Creature",keyword:"Defender",controller:"you",scalesMagnitude:true}));
  let totalPower=t.match(/only if creatures you control have total power (two|three|four|five|six|seven|eight|nine|ten|\d+) or greater/);if(totalPower)parts.push(predicate("controlled_permanent",{cardType:"Creature",controller:"you",aggregate:{metric:"power",comparison:"at_least",value:num(totalPower[1])}}));
  const singularSubtype=x=>{
    x=String(x||"").trim().toLowerCase();
    const irregular={elves:"elf",dwarves:"dwarf",wolves:"wolf",zombies:"zombie",faeries:"faerie",thieves:"thief",leaves:"leaf",wives:"wife",knives:"knife",halves:"half",selves:"self",auras:"aura",ninjas:"ninja"};
    if(irregular[x])return irregular[x];
    if(x==="bolas")return x;
    if(/(?:ches|shes|xes|zes)$/.test(x))return x.slice(0,-2);
    if(x.endsWith("ies"))return x.slice(0,-3)+"y";
    if(x.endsWith("s")&&!/(?:ss|us|is)$/.test(x))return x.slice(0,-1);
    return x;
  };
  const descriptorCardType=x=>({artifact:"Artifact",artifacts:"Artifact",creature:"Creature",creatures:"Creature",enchantment:"Enchantment",enchantments:"Enchantment",land:"Land",lands:"Land",planeswalker:"Planeswalker",planeswalkers:"Planeswalker",permanent:"Permanent",permanents:"Permanent"}[x]||null);
  const parseControlledDescriptor=(rawType,{scalesMagnitude=false,allowSubtype=true}={})=>{
    let x=String(rawType||"").trim().toLowerCase().replace(/\s+/g," ").replace(/\s+as you (?:cast this spell|activate this ability)$/,'').replace(/^(?:a|an)\s+/,"");
    if(!x)return null;
    let negated=false,other=false;
    if(x.startsWith("no ")){negated=true;x=x.slice(3).trim();}
    if(x.startsWith("other ")){other=true;x=x.slice(6).trim();}
    const wrap=e=>negated?not(e):e;
    const base={controller:"you",...(other?{other:true}:{}),...(scalesMagnitude?{scalesMagnitude:true}:{})};

    if(isSourceName(x))return wrap(predicate("source_state","controlled"));
    if(x==="commander"||x==="commanders")return wrap(predicate("commander_state","controlled"));
    if(x==="familiar"||x==="familiars")return wrap(predicate("familiar_permanent",{controller:"you",scalesMagnitude}));
    if(x==="decorated permanent"||x==="decorated permanents")return wrap(predicate("decorated_permanent",{controller:"you",scalesMagnitude}));
    if(x==="permanent of each color"||x==="permanents of each color")return wrap(predicate("permanent_color_coverage",{controller:"you",colors:["W","U","B","R","G"]}));
    if(COMPOSITE_SUBTYPE_PHRASES.has(x))return wrap(and(COMPOSITE_SUBTYPE_PHRASES.get(x).map(st=>predicate("controlled_permanent",{...base,subtype:st}))));
    if(looksLikePrintedProperName(x)&&!MULTIWORD_PRINTED_SUBTYPES.some(st=>lower(st)===x))return wrap(predicate("named_permanent",{controller:"you",name:x}));

    // Quantifier grammar belongs to the caller/cardinality parser; do not split its "or more/fewer" as type logic.
    if(/^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|\d+) or (?:more|fewer)\b/.test(x))return null;
    // Common type unions/intersections are real logic, never a synthetic subtype label.
    let colorPair=x.match(/^(white|blue|black|red|green) or (white|blue|black|red|green) permanents?$/);
    if(colorPair)return wrap(or(predicate("controlled_permanent",{...base,color:colorPair[1]}),predicate("controlled_permanent",{...base,color:colorPair[2]})));
    const join=x.match(/^(.+?)\s+(and|or)\s+(?:a |an )?(.+)$/);
    if(join){
      const childAllows=y=>allowSubtype||/^[a-z-]+s$/.test(String(y||"").trim());
      const left=parseControlledDescriptor(join[1],{scalesMagnitude,allowSubtype:childAllows(join[1])}),right=parseControlledDescriptor(join[3],{scalesMagnitude,allowSubtype:childAllows(join[3])});
      if(left&&right)return wrap(join[2]==="and"?and(left,right):or(left,right));
      return null;
    }
    const nestedCtl=x.match(/^[a-z][a-z -]{1,30} if you control (?:a|an) (.+)$/);if(nestedCtl)return parseControlledDescriptor(nestedCtl[1],{scalesMagnitude,allowSubtype:true});

    // Special deck-building characteristic families.
    if(x==="outlaw"||x==="outlaws")return wrap(predicate("outlaw_permanent",{controller:"you",scalesMagnitude}));
    if(x==="historic permanent"||x==="historic permanents")return wrap(predicate("historic_permanent",{controller:"you",scalesMagnitude}));
    if(x==="nonland permanent"||x==="nonland permanents")return wrap(predicate("controlled_permanent",{...base,excludedCardType:"Land"}));
    if(/^(?:neither (?:creature|artifact|permanent)|only as a sorcery)$/.test(x)||/\b(?:that fought this turn|attacking you|attacking a planeswalker|remains tapped|of the chosen type|noted for target permanent)\b/.test(x))return wrap(predicate("board_state_requirement",{raw:x,controller:"you"}));

    // Runtime/board-state adjectives are characteristics, never subtypes.
    const stateFlags={tapped:"tapped",untapped:"untapped",attacking:"attacking",modified:"modified",equipped:"equipped",enchanted:"enchanted",goaded:"goaded",transformed:"transformed",stickered:"stickered","face-down":"faceDown"};
    const words=x.split(" ");const flags={};let consumed=true;
    while(words.length&&consumed){
      consumed=false;const k=stateFlags[words[0]];
      if(k){flags[k]=true;words.shift();consumed=true;}
      else if(words[0]==="nontoken"){flags.token=false;words.shift();consumed=true;}
      else if(words[0]==="token"){flags.token=true;words.shift();consumed=true;}
      else if(words[0]==="nonlegendary"){flags.legendary=false;words.shift();consumed=true;}
      else if(["white","blue","black","red","green"].includes(words[0])){flags.color=words.shift();consumed=true;}
      else if(words[0]==="colorless"){flags.colorless=true;words.shift();consumed=true;}
      else if(words[0]==="multicolored"){flags.multicolored=true;words.shift();consumed=true;}
      else if(words[0]==="legendary"){flags.legendary=true;words.shift();consumed=true;}
      else if(words[0]==="basic"){flags.basic=true;words.shift();consumed=true;}
      else if(words[0]==="snow"){flags.supertype="Snow";words.shift();consumed=true;}
    }
    x=words.join(" ").trim();
    if(!x&&flags.token===true)return wrap(predicate("controlled_permanent",{...base,...flags}));

    // Token descriptors (creature token, Blood token, artifact token) share token supply.
    let tok=x.match(/^(.+?) tokens?$/);
    if(tok){
      const label=tok[1].trim(),ct=descriptorCardType(label);
      if(ct&&ct!=="Permanent")return wrap(predicate("controlled_permanent",{...base,...flags,token:true,cardType:ct}));
      if(label==="creature")return wrap(predicate("controlled_permanent",{...base,...flags,token:true,cardType:"Creature"}));
      if(label&&label!=="noncreature")return wrap(predicate("controlled_permanent",{...base,...flags,token:true,subtype:singularSubtype(label)}));
      return wrap(predicate("controlled_permanent",{...base,...flags,token:true,...(label==="noncreature"?{excludedCardType:"Creature"}:{})}));
    }

    // "Human creature", "Griffin creature", and non-Human creature are type+subtype characteristics.
    let nonSubtype=x.match(/^non-([a-z][a-z-]{1,24}) creatures?$/);
    if(nonSubtype)return wrap(predicate("controlled_permanent",{...base,...flags,cardType:"Creature",excludedSubtype:singularSubtype(nonSubtype[1])}));
    let typedSubtype=x.match(/^([a-z][a-z-]{1,24}) (creatures?|artifacts?|enchantments?|lands?|planeswalkers?)$/);
    if(typedSubtype){
      const ct=descriptorCardType(typedSubtype[2]),prefix=typedSubtype[1];
      if(descriptorCardType(prefix))return wrap(predicate("controlled_permanent",{...base,...flags,cardType:ct,additionalCardType:descriptorCardType(prefix)}));
      return wrap(predicate("controlled_permanent",{...base,...flags,cardType:ct,subtype:singularSubtype(prefix)}));
    }

    const ct=descriptorCardType(x);
    if(ct){const value={...base,...flags};if(ct!=="Permanent")value.cardType=ct;return wrap(predicate("controlled_permanent",value));}
    if(["plains","island","swamp","mountain","forest"].includes(x))return wrap(predicate("controlled_permanent",{...base,...flags,cardType:"Land",subtype:basicSubtype(x)}));
    if(x==="token"||x==="tokens")return wrap(predicate("controlled_permanent",{...base,...flags,token:true}));
    // Named planeswalker families are not subtypes; preserve the family hint without poisoning subtype namespace.
    let named=x.match(/^([a-z][a-z '-]{1,24}) planeswalker$/);if(named)return wrap(predicate("controlled_permanent",{...base,...flags,cardType:"Planeswalker",nameFamily:named[1]}));
    // Reject grammar/aggregate phrases that are not card subtypes. Dedicated rules model them elsewhere.
    if(/^(?:at least|exactly|both |all |one$|neither |different|differently |kind of |counters? |colors? |unlocked |(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|\d+) or (?:more|fewer) )/.test(x)||/\b(?:among| on | named | with | than )\b/.test(` ${x} `))return null;
    if(/^(?:commander|color among permanent|colors among permanent|color among ally)$/.test(x))return null;
    if(!allowSubtype)return null;
    return wrap(predicate("controlled_permanent",{...base,...flags,subtype:singularSubtype(x)}));
  };
  const subtypePhraseIsReferential=x=>/^(?:your|this|that|the|another|target)\b/.test(x)||/\bcommander$/.test(x);
  // Explicit subtype negation must remain NOT(subtype), rather than inventing a `no_*` subtype.
  let subtypeNone=t.match(/(?:if|only if|as long as) you control no ([a-z][a-z -]{1,30})(?:[,.]|$)/);
  if(subtypeNone){const e=parseControlledDescriptor(`no ${subtypeNone[1]}`);if(e)parts.push(e);}
  let subtypeCount=t.match(/(?:if|only if|as long as) you control (?:(?:at least )?(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|\d+)(?: or more)? )(?!or fewer\b)((?:other )?[a-z][a-z -]{1,30})(?:[,.]|$)/);
  if(subtypeCount){const rawType=subtypeCount[2].trim();if(!(nonlandNontoken&&rawType==="nonland")&&!subtypePhraseIsReferential(rawType)){const e=parseControlledDescriptor(rawType);if(e&&e.op!=="not")parts.push(cardinality("at_least",num(subtypeCount[1]),[e]));}}
  let snowCount=t.match(/(?:if|only if|as long as) you control (two|three|four|five|six|seven|eight|nine|ten|\d+) or more snow permanents?/);if(snowCount)parts.push(cardinality("at_least",num(snowCount[1]),[predicate("controlled_permanent",{supertype:"Snow",controller:"you"})]));
  // Board-state descriptors such as "attacking modified creature" are structured characteristics, not subtypes.
  let subtypeCtl=t.match(/(?:if|only if|as long as) you control (?:(a|an) )?([a-z][a-z -]{1,40})(?:[,.]|$)/);
  if(subtypeCtl){const article=subtypeCtl[1]||null,rawType=subtypeCtl[2].trim();if(!subtypePhraseIsReferential(rawType)){const allowSubtype=Boolean(article)||/^[a-z-]+s$/.test(rawType);const e=parseControlledDescriptor(rawType,{allowSubtype});if(e)parts.push(e);}}
  // Scaling clauses share the same descriptor parser, so "other Goblin", "tapped artifact" and "Zombies" normalize consistently.
  let subtypeScale=t.match(/(?:where x is (?:one plus |twice |half )?the number of|for each) ([a-z][a-z -]{1,40}) you control(?: as you activate this ability)?/);
  if(subtypeScale){const rawType=subtypeScale[1].trim();if(!subtypePhraseIsReferential(rawType)){const e=parseControlledDescriptor(rawType,{scalesMagnitude:true});if(e)parts.push(e);}}
  // Color diversity is a runtime aggregate, not a creature/permanent subtype.
  if(/(?:where x is the number of|for each) colors? among (?:other )?permanents? you control/.test(t))parts.push(predicate("controlled_permanent",{controller:"you",colorDiversity:true,scalesMagnitude:true}));
  if(/where x is the greatest power among creatures you control/.test(t))parts.push(predicate("controlled_permanent",{cardType:"Creature",controller:"you",scalesMagnitude:true,powerReference:"greatest"}));
  if(/where x is the number of differently named lands you control/.test(t)){parts.push(predicate("controlled_permanent",{cardType:"Land",controller:"you",scalesMagnitude:true}));parts.push(predicate("distinct_names",true));}

  // Graveyard package profiles.  A graveyard-count payoff has two independent deck-building
  // requirements: enough ways to populate/use the graveyard and enough eligible payload cards.
  // Keep those separate so downstream dependency/context views do not confuse game state with
  // deck composition.
  const gyProfileExpr=raw=>{
    const x=String(raw||"").trim().toLowerCase().replace(/\s+/g," ");
    if(/^creature$/.test(x))return predicate("card_characteristic","creature");
    if(/^land$/.test(x))return predicate("card_characteristic","land");
    if(/^permanent$/.test(x))return predicate("card_characteristic","permanent");
    if(/^instant (?:and|and\/or|or) sorcery$/.test(x))return predicate("card_characteristic","instant_sorcery");
    if(/^artifact (?:and|and\/or|or) creature$/.test(x))return predicate("card_characteristic","artifact_creature");
    if(/^noncreature,? nonland$/.test(x))return predicate("card_characteristic","noncreature_nonland");
    const st=x.match(/^([a-z][a-z -]{1,28}) creature$/);if(st)return and(predicate("card_characteristic","creature"),predicate("card_characteristic",`subtype:${singularSubtype(st[1])}`));
    return null;
  };
  const addGyProfile=(profile,{count=null,comparison="scales"}={})=>{
    const pe=gyProfileExpr(profile);if(!pe)return false;
    const payload=count!==null&&count!==undefined?cardinality(comparison,count,[pe]):pe;
    parts.push(and(predicate("zone_requirement","your_graveyard"),payload));return true;
  };
  let gym=t.match(/(?:where x is (?:1 plus |twice |half )?the number of|for each) (creature|land|permanent|instant (?:and|and\/or|or) sorcery|artifact (?:and|and\/or|or) creature|noncreature,? nonland) cards? in your graveyard/);
  if(gym)addGyProfile(gym[1]);
  gym=t.match(/(?:if|as long as|only if) (?:there are|you have) (?:at least )?(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|\d+)(?: or more)? ([a-z][a-z ,\/&-]{1,50}) cards? in your graveyard/);
  if(gym)addGyProfile(gym[2],{count:num(gym[1]),comparison:"at_least"});
  gym=t.match(/(?:if|as long as|only if) (?:there is|there's) (?:an? )?([a-z][a-z -]{1,28}) card in your graveyard/);
  if(gym){const label=gym[1].trim();if(!/^(?:creature|land|permanent|instant|sorcery|artifact|enchantment|card)$/.test(label))parts.push(and(predicate("zone_requirement","your_graveyard"),predicate("card_characteristic",`subtype:${singularSubtype(label)}`)));}

  // Delirium / threshold-style graveyard composition.  Diversity is a package property,
  // not a generic raw condition; Context computes the aggregate unique-count from selected cards.
  let div=t.match(/(?:if|as long as|only if) there are (two|three|four|five|six|seven|eight|nine|ten|\d+) or more card types among cards in your graveyard/);
  if(div)parts.push(and(predicate("zone_requirement","your_graveyard"),cardinality("at_least",num(div[1]),[predicate("zone_card_type_diversity",{owner:"you",zone:"graveyard"})])));
  if(/(?:where x is the number of|for each) card types? among cards in your graveyard/.test(t))parts.push(and(predicate("zone_requirement","your_graveyard"),predicate("zone_card_type_diversity",{owner:"you",zone:"graveyard",scalesMagnitude:true})));
  div=t.match(/(?:if|as long as|only if) there are (two|three|four|five|six|seven|eight|nine|ten|\d+) or more mana values among cards in your graveyard/);
  if(div)parts.push(and(predicate("zone_requirement","your_graveyard"),cardinality("at_least",num(div[1]),[predicate("zone_mana_value_diversity",{owner:"you",zone:"graveyard"})])));
  if(/for each different mana value among (?:nonland )?cards in your graveyard|where x is the number of different mana values among cards in your graveyard/.test(t))parts.push(and(predicate("zone_requirement","your_graveyard"),predicate("zone_mana_value_diversity",{owner:"you",zone:"graveyard",scalesMagnitude:true})));

  // Domain-style scaling/thresholds depend on distinct basic land subtypes, not land count.
  if(/(?:where x is (?:1 plus )?the number of|for each) basic land type among lands you control/.test(t))parts.push(predicate("basic_land_type_diversity",{controller:"you",scalesMagnitude:true}));
  let domain=t.match(/if there are (two|three|four|five|\d+)(?: or more)? basic land types among lands you control/);
  if(domain)parts.push(cardinality("at_least",num(domain[1]),[predicate("basic_land_type_diversity",{controller:"you"})]));
  if(/number of basic land types among lands you control/.test(t)&&!parts.some(x=>JSON.stringify(x).includes('"basic_land_type_diversity"')))parts.push(predicate("basic_land_type_diversity",{controller:"you",scalesMagnitude:true}));

  // Revealed/referenced-card gates are deck-composition requirements even when the card itself is symbolic.
  if(/if (?:it|that card|the discarded card)(?:'s| is| was) (?:a )?creature card/.test(t))parts.push(predicate("card_characteristic","creature"));
  if(/if (?:it|that card)(?:'s| is| was) (?:an? )?(?:instant or sorcery|instant and sorcery) (?:card|spell)/.test(t))parts.push(predicate("card_characteristic","instant_sorcery"));
  if(/if (?:it|that card)(?:'s| is| was) (?:a )?land card/.test(t))parts.push(predicate("card_characteristic","land"));
  if(/if (?:it|that card)(?:'s| is| was) (?:an? )?artifact card/.test(t))parts.push(predicate("card_characteristic","artifact"));
  if(/if (?:it|that card)(?:'s| is| was) (?:an? )?enchantment card/.test(t))parts.push(predicate("card_characteristic","enchantment"));
  if(/creature card that shares a creature type with a creature you control/.test(t))parts.push(and(predicate("card_characteristic","creature"),predicate("shared_creature_type",{controller:"you"})));
  if(/greatest number of creatures you control that have a creature type in common/.test(t))parts.push(predicate("shared_creature_type",{controller:"you",scalesMagnitude:true}));
  if(/as long as you control a desert or there is a desert card in your graveyard/.test(t))parts.push(or(predicate("controlled_permanent",{cardType:"Land",subtype:"Desert",controller:"you"}),and(predicate("zone_requirement","your_graveyard"),predicate("card_characteristic","subtype:desert"))));
  if(/unless you control a legendary creature/.test(t))parts.push(not(predicate("controlled_permanent",{cardType:"Creature",legendary:true,controller:"you"})));
  if(/as long as you control this saga/.test(t))parts.push(predicate("source_state","controlled"));
  let hand=t.match(/if you have exactly (two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|\d+) cards? in your hand/);if(hand)parts.push(predicate("zone_card_count",{owner:"you",zone:"hand",comparison:"exactly",count:num(hand[1])}));
  if(/if you have at least (?:\d+|[a-z]+) life more than your starting life total/.test(t))parts.push(predicate("life_total_comparison",{player:"you",comparison:"above_starting",raw:clean(rawText)}));
  if(/if no mana was spent to cast/.test(t))parts.push(predicate("mana_spent_condition",{comparison:"none"}));
  if(/where x is the number of cards in your graveyard/.test(t))parts.push(predicate("zone_card_count",{owner:"you",zone:"graveyard",comparison:"scales"}));
  if(/only if you'?ve cast an instant or sorcery spell this turn/.test(t))parts.push(and(predicate("event_occurred","instant_sorcery_spell_cast"),predicate("card_characteristic","instant_sorcery")));
  let gy=t.match(/(?:if|as long as) there are (two|three|four|five|six|seven|eight|nine|ten|\d+) or more (?:[a-z]+ )?cards? in your graveyard/);if(gy)parts.push(predicate("zone_card_count",{owner:"you",zone:"graveyard",comparison:"at_least",count:num(gy[1])}));
  gy=t.match(/only if there are (two|three|four|five|six|seven|eight|nine|ten|\d+) or more cards? in your graveyard/);if(gy)parts.push(predicate("zone_card_count",{owner:"you",zone:"graveyard",comparison:"at_least",count:num(gy[1])}));
  if(/if you'?ve cast a noncreature spell this turn/.test(t))parts.push(predicate("event_occurred","noncreature_spell_cast"));
  if(/if it has a depletion counter on it/.test(t))parts.push(predicate("source_counter_count",{counter:"depletion",comparison:"at_least",count:1}));
  if(/only if this land entered this turn/.test(t))parts.push(predicate("source_state","entered_this_turn"));
  if(/if it is legendary|if that creature is legendary/.test(t))parts.push(predicate("target_characteristic",{legendary:true}));
  if(/if it targets? a colorless creature/.test(t))parts.push(predicate("target_characteristic",{cardTypes:["Creature"],colorless:true}));
  let cm=t.match(/if there are (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) or more ([a-z0-9 +\/-]+) counters? on (?:this creature|it|this permanent)/);if(cm)parts.push(predicate("source_counter_count",{counter:cm[2].trim(),comparison:"at_least",count:num(cm[1])}));
  cm=t.match(/(?:if|as long as) [^,]{0,80} has (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) or more ([a-z0-9 +\/-]+) counters? on it/);if(cm)parts.push(predicate("source_counter_count",{counter:cm[2].trim(),comparison:"at_least",count:num(cm[1])}));
  if(/if no cards? (?:are|is) in that graveyard/.test(t))parts.push(predicate("zone_card_count",{zone:"graveyard",owner:"referenced_player",comparison:"exactly",count:0}));
  if(/if your life total is less than your starting life total/.test(t))parts.push(predicate("life_total_comparison",{player:"you",comparison:"less_than_starting"}));
  if(/if (?:the )?[^,]{0,40}cost was paid/.test(t))parts.push(predicate("alternate_cost_paid",{raw:clean(rawText)}));
  let opp=t.match(/unless you have (two|three|four|five|six|seven|eight|nine|ten|\d+) or more opponents?/);
  if(opp)parts.push(not(predicate("opponent_count",{comparison:"at_least",count:num(opp[1])})));
  else {opp=t.match(/if you have (two|three|four|five|six|seven|eight|nine|ten|\d+) or more opponents?/);if(opp)parts.push(predicate("opponent_count",{comparison:"at_least",count:num(opp[1])}));}
  if(!parts.length&&legacyCondition)parts.push(predicate("raw_condition",legacyCondition));
  return and(parts);
}

function parseManaRestriction(rawText){
  const t=lower(rawText);if(!/\b(?:spend this mana only|this mana can(?:'t|not) be spent|spend this mana)\b/.test(t))return null;
  const out={kind:null,allowedUses:[],forbiddenUses:[]};
  if(/spend this mana only/.test(t))out.kind="spend_only";else if(/can(?:'t|not) be spent/.test(t))out.kind="spend_forbidden";else out.kind="spend_rule";
  const add=(dest,obj)=>{if(!dest.some(x=>JSON.stringify(x)===JSON.stringify(obj)))dest.push(obj);};
  const dest=out.kind==="spend_forbidden"?out.forbiddenUses:out.allowedUses;
  if(/cast (?:a )?creature spell/.test(t))add(dest,{kind:"cast_spell",cardTypes:["Creature"]});
  if(/cast (?:an? )?artifact spell/.test(t))add(dest,{kind:"cast_spell",cardTypes:["Artifact"]});
  if(/cast (?:an? )?instant spell/.test(t))add(dest,{kind:"cast_spell",cardTypes:["Instant"]});
  if(/cast (?:a )?sorcery spell/.test(t))add(dest,{kind:"cast_spell",cardTypes:["Sorcery"]});
  if(/cast (?:an? )?enchantment spell/.test(t))add(dest,{kind:"cast_spell",cardTypes:["Enchantment"]});
  if(/cast (?:a )?planeswalker spell/.test(t))add(dest,{kind:"cast_spell",cardTypes:["Planeswalker"]});
  if(/activate (?:an? |the )?abilit/.test(t))add(dest,{kind:"activate_ability"});
  if(/creature spell of the chosen type|creature source of the chosen type/.test(t))add(dest,{kind:"cast_spell",cardTypes:["Creature"],subtype:{kind:"chosen"}});
  if(/dragon (?:creature )?spell/.test(t))add(dest,{kind:"cast_spell",cardTypes:["Creature"],subtypes:["Dragon"]});
  return out;
}

function parseSearchConstraint(rawText){
  const t=lower(rawText);if(!/\bsearch\b[^.]{0,80}\blibrary\b/.test(t))return null;
  const out={cardTypes:[],subtypesAny:[],basic:null,destination:null,destinationTapped:false,quantity:1};
  if(/basic land card/.test(t)){out.cardTypes.push("Land");out.basic=true;}
  else if(/\bland card\b/.test(t))out.cardTypes.push("Land");
  for(const [needle,type] of [["creature card","Creature"],["artifact card","Artifact"],["enchantment card","Enchantment"],["instant card","Instant"],["sorcery card","Sorcery"],["planeswalker card","Planeswalker"],["battle card","Battle"]])if(t.includes(needle))out.cardTypes.push(type);
  const subtypeMatch=t.match(/for (?:an? |up to [^ ]+ )?([a-z]+)(?: or ([a-z]+))? card/);
  if(subtypeMatch){const vals=[subtypeMatch[1],subtypeMatch[2]].filter(Boolean).map(x=>x[0].toUpperCase()+x.slice(1));const generic=new Set(["basic","land","creature","artifact","enchantment","instant","sorcery","planeswalker","battle","card"]);for(const x of vals)if(!generic.has(lower(x)))out.subtypesAny.push(x);}
  if(out.subtypesAny.some(x=>["Plains","Island","Swamp","Mountain","Forest"].includes(x))&&!out.cardTypes.includes("Land"))out.cardTypes.push("Land");
  if(/onto the battlefield|put (?:it|that card|those cards|them) onto the battlefield/.test(t))out.destination="battlefield";
  else if(/into your hand|put (?:it|that card|those cards|them) into your hand/.test(t))out.destination="hand";
  if(out.destination==="battlefield"&&/onto the battlefield tapped|put (?:it|that card|those cards|them) onto the battlefield tapped/.test(t))out.destinationTapped=true;
  const q=t.match(/search[^.]{0,40}for (?:up to )?(one|two|three|four|five|\d+) /);if(q)out.quantity=num(q[1]);
  return out;
}

function parseActivationRequirements(rawText,fact,faceName=""){
  const t=lower(rawText), req=[], costs=[];
  const costText=String(fact?.activationCost?.raw||"");
  const c=lower(costText||rawText.split(":")[0]);
  let m=c.match(/remove (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) ([a-z0-9 +\/-]+) counters? from among permanents you control/);
  if(m){const count=num(m[1]);const counter=m[2].trim();req.push(predicate("available_counter_pool",{controller:"you",counter,count,comparison:"at_least"}));costs.push({resource:"counter",counter,amount:count,from:{kind:"permanents",controller:"you"}});}
  m=c.match(/remove (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) ([a-z0-9 +\/-]+) counters? from (?:this|it)/);
  if(m){const count=num(m[1]);const counter=m[2].trim();req.push(predicate("source_counter_count",{counter,count,comparison:"at_least"}));costs.push({resource:"counter",counter,amount:count,from:{kind:"source"}});}
  const selfName=clean(faceName).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  if(/\bsacrifice (?:this|it|~)(?:\s+(?:artifact|creature|permanent|land|enchantment))?(?:,|:|$)/i.test(costText)||(selfName&&new RegExp(`\\bsacrifice ${selfName}(?:,|:|$)`,`i`).test(costText)))costs.push({resource:"permanent",amount:1,from:{kind:"source"},operation:"sacrifice"});
  let sm=costText.match(/sacrifice (?:an?|one|another) (creature|artifact|enchantment|land|permanent)(?:\s+you control)?/i);
  if(sm)costs.push({resource:"permanent",amount:1,from:{kind:"controlled_permanent",relation:/another/i.test(sm[0])?"other":null},filter:{cardTypes:[sm[1][0].toUpperCase()+sm[1].slice(1).toLowerCase()]},operation:"sacrifice"});
  sm=costText.match(/sacrifice (?:any number of|x) (creatures?|artifacts?|permanents?)/i);
  if(sm)costs.push({resource:"permanent",amount:{kind:/\bx\b/i.test(sm[0])?"variable":"any_number"},from:{kind:"controlled_permanent"},filter:{cardTypes:[sm[1].replace(/s$/i,"")[0].toUpperCase()+sm[1].replace(/s$/i,"").slice(1).toLowerCase()]},operation:"sacrifice"});
  if(fact?.activationCost?.tap)costs.push({resource:"source_state",state:"untapped",amount:1,operation:"tap"});
  if(fact?.activationCost?.life)costs.push({resource:"life",amount:null,operation:"pay"});
  if(fact?.activationCost?.discard)costs.push({resource:"card_in_hand",amount:1,operation:"discard"});
  return {requirements:and(req),costs};
}

function replacementEvent(rawText){
  const t=lower(rawText);
  const m=t.match(/\b(?:you|they|a player|an opponent|target player|that player)[^.]{0,45}\bwould (draw|gain|lose|discard|sacrifice|mill|deal|take)\b/);
  if(!m)return null;
  const verb=m[1];
  return verb==="draw"?"draw":verb==="gain"&&/gain life/.test(t)?"gain_life":verb;
}

function operatorFor(fact,rawText){
  const t=lower(rawText), a=String(fact?.action||"");
  if(/\b(?:can't|cannot|may not)\b/.test(t))return "prohibit";
  if(/\bprevent\b/.test(t)&&a!=="prevent")return "prevent";
  const repl=replacementEvent(rawText);
  if(repl&&a===repl)return "replace";
  if(["reduce_cost","increase_cost","grant_keyword","remove_keyword","grant_named_ability"].includes(a))return "modify";
  if(["play_from_exile","cast_from_exile","play_from_graveyard","cast_from_graveyard","play_card"].includes(a)&&/\bmay\b/.test(t))return "permit";
  return "perform";
}

function actionOverride(fact,rawText){
  const t=lower(rawText);
  if(/\b(?:opponents?|players?) (?:can't|cannot) gain life\b/.test(t)||/\byour opponents can't gain life\b/.test(t))return "gain_life";
  if(/\b(?:spell|this spell) can't be countered\b/.test(t))return "counter_spell";
  return fact?.action||"unparsed_clause";
}


function symbolicQuantity(rawText){
  const t=lower(rawText);let base=null;
  if(/\bthat many\b/.test(t))base={op:"reference",kind:"previous_amount"};
  else if(/\b(?:x|where x)\b/.test(t))base={op:"variable",name:"X"};
  let m=t.match(/(?:equal to|for each|number of)\s+(?:the\s+)?number of\s+([^.]+)/);
  if(!m)m=t.match(/\bequal to the number of ([^.]+)/);
  if(!m)m=t.match(/\bfor each ([^.,]+)/);
  if(!m)m=t.match(/\bnumber of ([^.,]+)/);
  if(m){
    const rawSubject=m[1].replace(/\b(?:you control|your opponents control|in your graveyard|on the battlefield|among them).*$/,'$&').trim();
    base={op:"count",subject:{raw:rawSubject}};
  }
  if(!base)return null;
  if(/\btwice (?:that|the) (?:many|number)\b|\btwice the number\b/.test(t))base={op:"multiply",factor:2,arg:base};
  if(/\bhalf (?:that|the) (?:many|number)\b/.test(t))base={op:"multiply",factor:.5,arg:base};
  const plus=t.match(/\b(\d+) plus (?:the )?number of\b/);if(plus)base={op:"add",args:[{op:"fixed",value:Number(plus[1])},base]};
  return {kind:"symbolic",expr:base,raw:clean(rawText)};
}

function normalizeDynamicQuantities(capabilities){
  for(const cap of capabilities){
    const gaps=new Set(cap.gaps||[]),raw=cap.source?.rawText||"";
    if(gaps.has("DYNAMIC_DAMAGE_MAGNITUDE")){
      const q=symbolicQuantity(raw);if(q){cap.magnitude=q;gaps.delete("DYNAMIC_DAMAGE_MAGNITUDE");cap.details={...(cap.details||{}),quantitySemantics:"symbolic"};}
    }
    if(gaps.has("DYNAMIC_MANA_OUTPUT")){
      const q=symbolicQuantity(raw);if(q){cap.magnitude=q;gaps.delete("DYNAMIC_MANA_OUTPUT");cap.details={...(cap.details||{}),quantitySemantics:"symbolic"};}
    }
    if(gaps.has("DYNAMIC_PT_EXPRESSION")){
      const q=symbolicQuantity(raw);if(q){cap.details={...(cap.details||{}),ptExpression:q};gaps.delete("DYNAMIC_PT_EXPRESSION");}
    }
    cap.gaps=[...gaps];
    if(cap.coverage===COVERAGE.PARTIAL&&!cap.gaps.length&&!cap.details?.recoveredFromUnparsed)cap.coverage=COVERAGE.SUPPORTED;
  }
  return capabilities;
}

function magnitudeFromText(rawText,fact){
  if(fact?.magnitude!==null&&fact?.magnitude!==undefined)return fact.magnitude;
  const t=lower(rawText);
  let m=t.match(/\bdraws? (?:up to )?(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d+) cards?\b/);if(m)return {amount:num(m[1]),maximum:/up to/.test(m[0])};
  if(/\bdraws? cards? equal to\b/.test(t)){const q=symbolicQuantity(rawText);if(q)return q;}
  m=t.match(/\bmill (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) cards?\b/);if(m)return {amount:num(m[1])};
  m=t.match(/\bdeals? (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) damage\b/);if(m)return {amount:num(m[1])};
  m=t.match(/\blose (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) life\b/);if(m)return {amount:num(m[1])};
  return null;
}

function resourceFlows(action,operator,rawText,fact){
  if(operator!=="perform"&&operator!=="permit")return [];
  const mag=magnitudeFromText(rawText,fact);const n=mag?.amount??fact?.details?.mana?.output??null;
  switch(action){
    case "draw": return [{direction:"produce",resource:"card_in_hand",amount:n??1,beneficiary:"actor"}];
    case "add_mana": return [{direction:"produce",resource:"mana",amount:n,details:fact?.details?.mana||null,beneficiary:"actor"}];
    case "gain_life": return [{direction:"produce",resource:"life",amount:n,beneficiary:"actor"}];
    case "lose_life": return [{direction:"consume",resource:"life",amount:n,beneficiary:"target"}];
    case "discard": return [{direction:"consume",resource:"card_in_hand",amount:n??1,beneficiary:"target"}];
    case "mill": return [{direction:"move",resource:"card",amount:n,from:"library",to:"graveyard",beneficiary:"target"}];
    case "create_token": case "create": return [{direction:"produce",resource:"permanent_token",amount:n??1,beneficiary:"actor"}];
    case "sacrifice": return [{direction:"consume",resource:"permanent",amount:n??1,beneficiary:"target"}];
    default:return [];
  }
}

function faceAccess(layout,index,faces){
  const alternative=new Set(["modal_dfc","split","adventure"]);
  const sequential=new Set(["transform","reversible_card","flip","meld"]);
  if(alternative.has(layout))return {kind:"alternative_entry",group:"face-entry",policy:"exclusive",requirements:logicTrue(),fromZone:"hand"};
  if(sequential.has(layout)&&index>0)return {kind:"state_transition",fromFace:faces[index-1]?.id||`face-${index-1}`,requirements:predicate("state_transition_required",layout)};
  return {kind:"default",requirements:logicTrue()};
}

function selectionSpec(text){
  const t=lower(text);
  if(/choose x\b/.test(t))return {kind:"variable",symbol:"X",minimum:0,maximum:null};
  const up=t.match(/choose up to (one|two|three|four|five|\d+)/);if(up)return {kind:"range",minimum:0,maximum:num(up[1])};
  if(/choose one or both/.test(t))return {kind:"range",minimum:1,maximum:2};
  if(/choose one or more/.test(t))return {kind:"range",minimum:1,maximum:null};
  const m=t.match(/choose (one|two|three|four|five|\d+)/);if(m){const n=num(m[1]);return {kind:"exact",count:n};}
  return {kind:"unknown"};
}

function optionPolicy(instruction){
  const t=lower(instruction);
  if(/same mode more than once/.test(t))return "repeatable";
  const sel=selectionSpec(t);
  if(sel.kind==="exact"&&sel.count===1)return "exclusive";
  if(["range","exact","variable"].includes(sel.kind))return "combinable";
  return "independent";
}

function optionGroupsForFace(face,capabilities){
  const lines=String(face.oracleText||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const groups=[];
  for(let i=0;i<lines.length;i++){
    if(/^tiered\b/i.test(lines[i])){
      const instruction=lines[i];let j=i+1;while(j<lines.length&&!/^•/.test(lines[j]))j++;
      const optionLines=[];while(j<lines.length&&/^•/.test(lines[j])){optionLines.push(lines[j].replace(/^•\s*/,""));j++;}
      if(optionLines.length){
        const options=optionLines.map(option=>({text:option,capabilityIds:capabilities.filter(c=>c.source.faceIndex===face.index&&clean(c.source.rawAbilityText).replace(/^•\s*/,"")===option).map(c=>c.id)}));
        groups.push({id:`face-${face.index}:option-${groups.length}`,faceId:`face-${face.index}`,instruction,policy:"exclusive",selection:{kind:"exact",count:1},options,capabilityIds:options.flatMap(o=>o.capabilityIds)});
        i=j-1;
      }
      continue;
    }
    if(!/^choose\b/i.test(lines[i]))continue;
    let instruction=lines[i];
    if(i+1<lines.length&&!/^•/.test(lines[i+1])&&/same mode more than once/i.test(lines[i+1])){instruction+=` ${lines[i+1]}`;i++;}
    const optionLines=[];let j=i+1;
    while(j<lines.length&&/^•/.test(lines[j])){optionLines.push(lines[j].replace(/^•\s*/,""));j++;}
    if(!optionLines.length)continue;
    const optionIds=[];
    for(const option of optionLines){
      const ids=capabilities.filter(c=>c.source.faceIndex===face.index && clean(c.source.rawAbilityText).replace(/^•\s*/,"")===option).map(c=>c.id);
      optionIds.push({text:option,capabilityIds:ids});
    }
    groups.push({id:`face-${face.index}:option-${groups.length}`,faceId:`face-${face.index}`,instruction,policy:optionPolicy(instruction),selection:selectionSpec(instruction),options:optionIds,capabilityIds:optionIds.flatMap(o=>o.capabilityIds)});
    i=j-1;
  }
  return groups;
}

function capabilityFromFact({fact,face,ability,clause,secondary},index){
  const rawText=String(fact.rawText||ability.rawText||"");
  const action=actionOverride(fact,rawText);if(META_ACTIONS.has(action))return null;
  const operator=operatorFor(fact,rawText);
  const ar=parseActivationRequirements(rawText,fact,face?.name||"");
  let actor=refFrom(fact.actor,rawText,"actor");
  let beneficiary=refFrom(fact.beneficiary,rawText,"beneficiary");
  let target=refFrom(fact.target,rawText,"target");
  if(/\bthat player adds?\b/i.test(rawText)&&action==="add_mana"){actor=entityRef("referenced_player",{antecedent:"event.actor"});beneficiary=entityRef("referenced_player",{antecedent:"event.actor"});}
  if(/\bdeals?[^.]*damage to that player\b/i.test(rawText)){target=entityRef("referenced_player",{antecedent:"event.actor"});}
  if(operator==="prohibit"&&/your opponents? can't/i.test(rawText)){actor=entityRef("each_opponent");beneficiary=entityRef("each_opponent");}
  const req=and(dependencyExpr(fact.dependencies||[]),ar.requirements);
  let cond=conditionExpr(rawText,fact.condition,{sourceName:face?.name||null});
  // Some legacy clauses are split after the leading condition (for example
  // "If X is 2, ... . They ..."). Preserve a structured X gate across every
  // effect clause in that same ability instead of making the continuation look
  // unconditional.
  if(clean(rawText)!==clean(ability.rawText)&&/\bif x is (?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)(?: or more)?\b/i.test(ability.rawText||"")){
    cond=and(conditionExpr(ability.rawText,null,{sourceName:face?.name||null}),cond);
  }
  const details={...(fact.details||{})};
  if(action==="create_token"){
    const token=tokenDescriptor(rawText);
    if(token?.name)details.tokenName=token.name;
    if(token?.cardTypes?.length)details.tokenCardTypes=token.cardTypes;
    if(token?.subtypes?.length)details.tokenSubtypes=token.subtypes;
  }
  if(fact.costReductionScope)details.costReductionScope=fact.costReductionScope;
  if(action==="mana_restriction"){const r=parseManaRestriction(rawText);if(r)details.manaRestriction=r;}
  if(action==="search_library"){const s=parseSearchConstraint(rawText);if(s)details.searchConstraint=s;}
  return {
    id:`face-${face.index}:ability-${ability.index}:cap-${index}`,
    faceId:`face-${face.index}`,abilityId:`face-${face.index}:ability-${ability.index}`,
    operator,action,object:fact.object??null,
    actor,target,beneficiary,
    zones:{source:fact.sourceZone??null,destination:fact.destinationZone??null,owner:refFrom(fact.owner,rawText,"owner")},
    event:fact.event?{kind:fact.event}:null,trigger:fact.trigger??ability.kind??null,
    requirements:req,conditions:cond,costs:ar.costs,
    magnitude:magnitudeFromText(rawText,fact),frequency:fact.frequency??null,timing:fact.timing??null,
    polarity:fact.polarity??"neutral",resources:resourceFlows(action,operator,rawText,fact),
    coverage:fact.status===COVERAGE.SUPPORTED?COVERAGE.SUPPORTED:fact.status===COVERAGE.PARTIAL?COVERAGE.PARTIAL:COVERAGE.GAP,
    confidence:Number(fact.confidence??.5),
    source:{faceIndex:face.index,abilityIndex:ability.index,clauseIndex:(ability.clauses||[]).indexOf(clause),rawAbilityText:ability.rawText,rawText,secondary:!!secondary,legacyAction:fact.action??null},
    gaps:uniq(fact.unsupportedPatterns||[]),details
  };
}

function recoveredActor(rawText,fallback){
  const t=lower(rawText);
  if(/\bthat player\b/.test(t)||/^they\b/.test(t)||/\battacking player\b/.test(t))return entityRef("referenced_player",{antecedent:"previous_or_trigger.player"});
  if(/\bthat (?:creature|permanent|card)'?s controller\b|\bits controller\b/.test(t))return entityRef("object_controller");
  if(/\bsource'?s controller\b/.test(t))return entityRef("referenced_source_controller",{antecedent:"referenced_source.controller"});
  if(/\beach other player\b/.test(t))return entityRef("each_other_player");
  if(/\btarget players\b/.test(t))return entityRef("target_players");
  if(/\btarget opponent\b/.test(t))return entityRef("target_opponent");
  if(/\ban opponent\b/.test(t))return entityRef("opponent");
  if(/\btarget player\b/.test(t))return entityRef("target_player");
  if(/\beach opponent\b/.test(t))return entityRef("each_opponent");
  if(/\beach player\b/.test(t))return entityRef("each_player");
  if(/\byou\b/.test(t))return entityRef("you");
  return fallback||null;
}

function recoveredTarget(rawText,fallback){
  const t=lower(rawText);
  if(/\bthat player\b/.test(t))return entityRef("referenced_player",{antecedent:"previous_or_trigger.player"});
  if(/\btarget players\b/.test(t))return entityRef("target_players");
  if(/\btarget opponent\b/.test(t))return entityRef("target_opponent");
  if(/\btarget player\b/.test(t))return entityRef("target_player");
  if(/\beach opponent\b/.test(t))return entityRef("each_opponent");
  if(/\beach player\b/.test(t))return entityRef("each_player");
  return fallback||null;
}

function recoveredDestination(t){
  if(/\binto (?:your|their|its|the)?\s*hand\b|\bto (?:your|their|its|the)?\s*hand\b/.test(t))return "hand";
  if(/\bonto the battlefield\b|\bto the battlefield\b/.test(t))return "battlefield";
  if(/\binto (?:your|their|its|the)?\s*graveyard\b|\bto (?:your|their|its|the)?\s*graveyard\b/.test(t))return "graveyard";
  if(/\bon top of (?:your|their|its|the)?\s*library\b/.test(t))return "library_top";
  if(/\bon the bottom of (?:your|their|its|the)?\s*library\b/.test(t))return "library_bottom";
  if(/\binto (?:your|their|its|the)?\s*library\b/.test(t))return "library";
  if(/\bexile\b/.test(t))return "exile";
  return null;
}

function recoverUnparsedCapability(cap){
  if(cap.action!=="unparsed_clause")return [cap];
  const raw=cap.source.rawText,t=lower(raw), recovered=[];
  const replacedEvent=replacementEvent(raw);
  const explicitReplacementResultDraw=replacedEvent==="draw"&&(
    /\b(?:you|they|that player|target player|a player) draw(?:s)? (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x) cards?\b[^.]{0,60}\binstead\b/.test(t)||
    /\binstead[^.]{0,80}\b(?:you|they|that player|target player|a player) draw(?:s)? (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x) cards?\b/.test(t)||
    /\bthen draw (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x) cards?\b/.test(t)
  );
  const mk=(action,{operator="perform",object=null,actor=null,target=null,beneficiary=null,zones=null,details=null,resources=null,polarity=null,requirements=null,magnitude=null}={})=>{
    const c={...cap,id:`${cap.id}:recovered-${recovered.length}`,action,operator,object:object??cap.object,
      actor:actor??recoveredActor(raw,cap.actor),target:target??recoveredTarget(raw,cap.target),beneficiary:beneficiary??cap.beneficiary,
      zones:zones??cap.zones,coverage:COVERAGE.PARTIAL,confidence:Math.max(.68,Math.min(.88,cap.confidence||.7)),
      gaps:uniq((cap.gaps||[]).filter(x=>x!=="UNPARSED_CLAUSE").concat("GENERIC_ACTION_RECOVERY")),
      requirements:requirements?and(cap.requirements,requirements):cap.requirements,conditions:and(cap.conditions,conditionExpr(raw,null)),
      details:{...(cap.details||{}),...(details||{}),recoveredFromUnparsed:true},polarity:polarity??cap.polarity,magnitude:magnitude??magnitudeFromText(raw,cap)??cap.magnitude};
    c.resources=resources??resourceFlows(action,operator,raw,{magnitude:c.magnitude,details:c.details});recovered.push(c);
  };
  // Replacement control is itself semantic information. If the legacy parser
  // could not classify the sentence, preserve the replaced event rather than
  // leaving the whole clause as unknown. Result actions are recovered below.
  if(replacedEvent)mk(replacedEvent,{operator:"replace",object:"event",details:{replacementControl:true}});
  // Core resource and game-state actions. These are intentionally broad only because this function runs on clauses the primary parser could not classify.
  if(/\bdraws? (?:up to )?(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d+|x) cards?\b|\bdraws? cards? equal to\b/.test(t)&&(replacedEvent!=="draw"||explicitReplacementResultDraw)){
    const subject=recoveredActor(raw,cap.beneficiary)||entityRef("you");mk("draw",{object:"card",actor:subject,beneficiary:subject,details:explicitReplacementResultDraw?{replacementResult:true}:null,requirements:explicitReplacementResultDraw?predicate("replacement_event_available",{event:"draw"}):null});
  }
  if(/\bgains? (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x|that much|[a-z]+) life\b/.test(t))mk("gain_life",{object:"life"});
  if(/\bloses? (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x|that much|[a-z]+) life\b/.test(t))mk("lose_life",{object:"life"});
  if(/\b(?:add|adds) (?:\{[^}]+\}|one|two|three|four|five|six|seven|eight|nine|ten|x|that much|any amount of)[^.]{0,80}mana\b|\badd one mana of any color\b/.test(t))mk("add_mana",{object:"mana"});
  if(/\b(?:gets?|put|puts?) (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x|that many)?\s*(?:[+-]\d+\/[+-]\d+ |[a-z]+ )?counters?\b/.test(t))mk("modify_counter",{object:"counter",operator:"modify"});
  if(/\bloses? all (?:[a-z+/-]+ )?counters?\b|\bremove all (?:[a-z+/-]+ )?counters?\b/.test(t))mk("modify_counter",{object:"counter",operator:"modify",target:recoveredTarget(raw,cap.target),details:{operation:"remove_all",scope:/\bopponent/.test(t)?"player":"object_or_player"}});
  if(/\blife total becomes? (?:half |twice |equal to |the )?(?:\d+|[a-z]+|that number|the lowest|the highest|half)/.test(t))mk("set_life_total",{object:"life_total",operator:"modify"});
  if(/\bit becomes equal to (?:your|their) starting life total\b/.test(t))mk("set_life_total",{object:"life_total",operator:"modify",details:{value:"starting_life_total"}});
  if(/\bexchange life totals?\b/.test(t))mk("exchange_value",{object:"life_total",operator:"modify"});
  if(/\bchange (?:any|a|the) targets?\b/.test(t))mk("retarget",{object:"spell_or_ability",operator:"modify",details:{constraint:clean(raw)}});
  if(/\bgains? control of\b|\benters? under the control of\b|\byou control enchanted permanent\b/.test(t))mk("gain_control",{object:"permanent",operator:"modify"});
  if(/\blands? you control enter untapped\b/.test(t))mk("enter_untapped",{object:"land",operator:"modify"});
  if(/\bmay tap lands? you don'?t control for mana\b/.test(t))mk("mana_access_from_opponent_land",{object:"land",operator:"permit"});
  if(/\beach player loses all unspent mana\b/.test(t))mk("lose_unspent_mana",{object:"mana"});
  if(/\b(?:players?|you) (?:don'?t|do not) lose unspent mana\b/.test(t))mk("lose_unspent_mana",{object:"mana",operator:"prohibit",actor:/^you\b/.test(t)?entityRef("you"):entityRef("each_player")});
  if(/\bproduces? (?:two|three|four|five|\d+) times as much of that mana instead\b/.test(t)){const m=t.match(/\bproduces? (two|three|four|five|\d+) times/);mk("modify_mana_output",{object:"mana",operator:"modify",details:{operation:"multiply",factor:num(m?.[1])||null,reference:"replaced_mana_event"}});}
  if(/\b(?:land|permanent) is tapped for mana\b[^.]*\bproduces?\b[^.]*\binstead\b/.test(t)||/\b(?:it|that land|that permanent) produces? \{[wubrgc]\}[^.]*\binstead\b/.test(t))mk("add_mana",{object:"mana",operator:"replace",details:{replacementControl:true,manaReplacement:true}});
  if(/\bcosts? \{?\d+\}? (?:less|more) to activate\b/.test(t)){const less=/less to activate/.test(t);mk(less?"reduce_activation_cost":"increase_activation_cost",{object:"activated_ability",operator:"modify",details:{scope:"activated_ability"}});}
  if(/\b(?:blitz|escape|equip|cycling|kicker|flashback) costs? [^.]{0,80} cost \{?\d+\}? less\b/.test(t)){const km=t.match(/\b(blitz|escape|equip|cycling|kicker|flashback) costs?/);mk("reduce_cost",{object:"keyword_cost",operator:"modify",details:{scope:km?.[1]||"keyword_cost",dynamic:/for each/.test(t)}});}
  if(/\b(?:spells?|cards?|creatures?|permanents?|lands?) [^.]{0,120}\b(?:has|have|gain) (?:rebound|jump-start|flashback|escape|riot|haste|flying|lifelink|trample|vigilance|deathtouch|menace|reach|hexproof|indestructible|ward|sneak|afflict(?: \d+)?|miracle(?: \{[^}]+\})?|plot|warp(?: \{[^}]+\})?|evoke(?: \{[^}]+\})?|emerge|replicate|scavenge|dredge(?: \d+)?|slivercycling(?: \{[^}]+\})?|cycling|foretell|exalted|fear|wither|horsemanship|poisonous(?: \d+)?|soulshift(?: [x\d]+)?|rampage(?: \d+)?)\b/.test(t)){const km=t.match(/\b(?:has|have|gain) (rebound|jump-start|flashback|escape|riot|haste|flying|lifelink|trample|vigilance|deathtouch|menace|reach|hexproof|indestructible|ward|sneak|afflict(?: \d+)?|miracle(?: \{[^}]+\})?|plot|warp(?: \{[^}]+\})?|evoke(?: \{[^}]+\})?|emerge|replicate|scavenge|dredge(?: \d+)?|slivercycling(?: \{[^}]+\})?|cycling|foretell|exalted|fear|wither|horsemanship|poisonous(?: \d+)?|soulshift(?: [x\d]+)?|rampage(?: \d+)?)\b/);mk("grant_keyword",{object:"keyword",operator:"modify",zones:{source:/graveyard/.test(t)?"graveyard":/hand/.test(t)?"hand":/top card of your library/.test(t)?"library_top":null,destination:null,owner:/your (?:graveyard|hand|library)/.test(t)?entityRef("you"):null},details:{keyword:km?.[1]||null,scope:"referenced_objects",filter:{cardTypes:/creature card|creature spell/.test(t)?["Creature"]:/land card/.test(t)?["Land"]:null,colors:/exactly two colors/.test(t)?{count:2}:null}}});}
  if(/\b(?:is|are|becomes?|become) (?:an? )?(?:artifact |enchantment |phyrexian |zombie |vampire |forest |land |creature |basic\b)/.test(t)||/\bin addition to (?:its|their) other (?:types|colors)\b/.test(t))mk("set_characteristics",{object:"type_line",operator:"modify",details:{operation:/in addition/.test(t)?"add":"set_or_modify"}});
  if(/\bisn'?t a creature\b|\bis not a creature\b/.test(t))mk("set_characteristics",{object:"type_line",operator:"modify",details:{operation:"remove_type",cardType:"Creature"}});
  const def=t.match(/^x is (.+)$/);if(def)mk("define_variable",{object:"X",operator:"modify",details:{expression:symbolicQuantity(raw)?.expr||{op:"raw",value:def[1]}}});
  if(/^(?:it|she|he)'?s an? [^.]*\bland\b/.test(t)||/^enchanted land is snow\b/.test(t)||/\blands? [^.]{0,70} are basic\b/.test(t))mk("set_characteristics",{object:"type_line",operator:"modify",details:{operation:"set_or_modify",rawCharacteristic:clean(raw)}});
  if(/\b(?:blitz|scavenge|replicate|escape|emerge|plot|evoke|warp|miracle|foretell|cycling|morph|ninjutsu|embalm) cost is equal to\b/.test(t)){const km=t.match(/\b(blitz|scavenge|replicate|escape|emerge|plot|evoke|warp|miracle|foretell|cycling|morph|ninjutsu|embalm) cost/);mk("define_keyword_cost",{object:"cost",operator:"modify",details:{keyword:km?.[1]||null,expression:symbolicQuantity(raw)?.expr||{op:"raw",value:clean(raw)}}});}
  if(/\bspend mana of any type\b/.test(t))mk("mana_spending_permission",{object:"mana",operator:"permit",details:{anyType:true}});
  if(/\bdouble the value of x\b/.test(t))mk("modify_variable",{object:"X",operator:"modify",details:{operation:"multiply",factor:2}});
  if(/\b(?:flip|transform|convert) (?:this creature|it|this permanent|[a-z])/i.test(t)||/\byou may (?:flip|transform|convert) (?:it|this creature|this permanent)\b/.test(t))mk("state_transition",{object:"card_face",operator:"modify",details:{operation:/\bflip\b/.test(t)?"flip":/\bconvert\b/.test(t)?"convert":"transform"}});
  if(/\bturn [^.]{0,90} face down\b/.test(t))mk("set_face_state",{object:"permanent",operator:"modify",details:{state:"face_down"}});
  if(/\bturn [^.]{0,90} face up\b/.test(t))mk("set_face_state",{object:"permanent",operator:"modify",details:{state:"face_up"}});
  if(/\b(?:this creature|it|this card) escapes with\b[^.]*counters?/.test(t))mk("modify_counter",{object:"counter",operator:"modify",details:{operation:"enters_with",accessMethod:"escape"}});
  if(/\b(?:one or more|[a-z0-9]+) counters? would be put on\b[^.]*\b(?:twice|double) that many\b[^.]*\binstead\b/.test(t))mk("modify_counter",{object:"counter",operator:"replace",details:{operation:"multiply",factor:2,replacementControl:true}});
  if(/\bdamage that would reduce [^.]*life total to less than (\d+) reduces it to \1 instead\b/.test(t)){const dm=t.match(/less than (\d+)/);mk("set_life_total",{object:"life_total",operator:"replace",details:{operation:"damage_floor",minimum:Number(dm?.[1]||0)}});}
  if(/\bnote (?:the )?(?:number and kind of counters|a creature type)\b/.test(t))mk("remember_choice",{object:/creature type/.test(t)?"creature_type":"counter_state",operator:"perform"});
  if(/\bseparates? [^.]{0,100} into two (?:face-down )?piles\b/.test(t))mk("partition_choice",{object:"cards",operator:"perform",details:{piles:2}});
  if(/\bstart your engines!?\b/.test(t))mk("keyword_action",{object:"start_your_engines",details:{keyword:"start_your_engines"}});
  for(const kw of ["forage","recruit","time travel","planeswalk","chaos ensues"]){if(new RegExp(`\\b${kw.replace(' ','\\s+')}\\b`).test(t))mk("keyword_action",{object:kw.replace(/\s+/g,"_"),details:{keyword:kw}});}
  if(/\bvote(?:s|d| voting)?\b/.test(t))mk("vote",{object:"vote",operator:"perform"});
  if(/\bbid(?:ding)?\b/.test(t))mk("bid",{object:"bid",operator:"perform"});
  if(/\bthis effect doesn'?t remove this aura\b/.test(t))mk("attachment_persists",{object:"aura",operator:"modify"});
  if(/\bthis ability doesn'?t affect its color identity\b/.test(t))mk("rules_annotation",{object:"color_identity",operator:"modify",details:{nonFunctional:true}});
  if(/^(?:\{tk\})+\s*[—-]\s*\d+\/\d+\.?$/.test(t)){const cost=(t.match(/\{tk\}/g)||[]).length,pt=t.match(/(\d+)\/(\d+)/);mk("ticket_stat_option",{object:"power_toughness",operator:"modify",details:{ticketCost:cost,power:Number(pt?.[1]),toughness:Number(pt?.[2])}});}
  if(/^\d+\+\s*\|/.test(t))mk("threshold_option",{object:"keyword_or_stats",operator:"modify",details:{raw:clean(raw)}});
  // Zone movement and information actions. Multiple actions in one clause remain multiple capabilities.
  if(/\bexile(?:s|d)?\b/.test(t))mk("exile",{object:/cards?/.test(t)?"card":"object",zones:{source:cap.zones?.source||null,destination:"exile",owner:cap.zones?.owner||null}});
  if(/\breturn(?:s|ed)?\b/.test(t))mk("return",{object:/cards?/.test(t)?"card":"object",zones:{source:cap.zones?.source||null,destination:recoveredDestination(t),owner:cap.zones?.owner||null}});
  if(/\bput(?:s|ting)?\b/.test(t)&&/\b(?:hand|graveyard|battlefield|librar(?:y|ies))\b/.test(t))mk("move_card",{object:"card",zones:{source:cap.zones?.source||null,destination:recoveredDestination(t),owner:cap.zones?.owner||null}});
  if(/\bput [^.]{0,100} on the bottom of [^.]{0,60}librar(?:y|ies)\b/.test(t))mk("tuck",{object:/\bcreatures?\b/.test(t)?"creature":"permanent",zones:{source:"battlefield",destination:"library_bottom",owner:cap.zones?.owner||null}});
  if(/\bexchange (?:your|their|that player'?s?) graveyard and librar(?:y|ies)\b/.test(t))mk("exchange_zones",{object:"cards",operator:"modify",zones:{source:"graveyard",destination:"library",owner:recoveredActor(raw,cap.actor)}});
  if(/\breveal(?:s|ed|ing)?\b/.test(t))mk("reveal",{object:/hand/.test(t)?"hand":/cards?/.test(t)?"card":"object"});
  if(/\blook at\b/.test(t))mk("look_at",{object:/cards?/.test(t)?"card":"object"});
  if(/\bsearch(?:es|ed|ing)?\b/.test(t))mk("search",{object:/library/.test(t)?"library":"zone"});
  if(/\bshuffle(?:s|d)?\b/.test(t))mk("shuffle",{object:/library/.test(t)?"library":"cards"});
  // Choice is meaningful flexibility even when the chosen object's downstream reference is unresolved.
  if(/\bchoose(?:s|n)?\b/.test(t))mk("choose",{object:/card/.test(t)?"card":/color/.test(t)?"color":/creature type/.test(t)?"creature_type":"choice"});
  // Creation / digital acquisition / named keyword actions.
  if(/\bcreate(?:s|d)?\b/.test(t))mk("create_token",{object:/token/.test(t)?"token":"object",beneficiary:recoveredActor(raw,cap.beneficiary)||entityRef("you")});
  if(/\bconjure(?:s|d)?\b/.test(t))mk("conjure",{object:"card",beneficiary:recoveredActor(raw,cap.beneficiary)||entityRef("you")});
  if(/\bseek\b/.test(t))mk("seek",{object:"card",beneficiary:entityRef("you")});
  if(/\bdraft\b/.test(t))mk("draft",{object:/spellbook/.test(t)?"spellbook_card":"card",beneficiary:entityRef("you")});
  if(/\bincubate\b/.test(t))mk("incubate",{object:"incubator_token",beneficiary:entityRef("you")});
  if(/\bearthbend\b/.test(t))mk("earthbend",{object:"land",beneficiary:entityRef("you")});
  if(/\bprepared\b/.test(t)&&/\benters? prepared\b|\bbecomes? prepared\b/.test(t))mk("prepare",{object:"source",beneficiary:entityRef("you")});
  // Random/selection primitives.
  if(/\bflip (?:a|the) coin\b|\bflip \w+ coins?\b/.test(t))mk("flip_coin",{object:"coin"});
  if(/\broll (?:a|an|the|x|\d+|one|two|three|four|five|six)[^.]{0,30}\bdie\b|\broll x six-sided dice\b/.test(t))mk("roll_die",{object:"die"});
  // State/resource modifications.
  if(/\benters? tapped\b/.test(t))mk("enter_tapped",{object:"source",operator:"modify"});
  if(/\btap (?:an?|any number of|up to [^ ]+|target|another|it\b|him\b|her\b|this permanent|that permanent)\b/.test(t))mk("tap",{object:"permanent"});
  if(/\buntaps?\b/.test(t))mk("untap",{object:"permanent"});
  if(/\b(?:put|distribute|remove|get|gets?|move)[^.]{0,80}\bcounters?\b/.test(t))mk("modify_counter",{object:"counter",operator:/\bremove\b/.test(t)?"perform":"modify"});
  if(/\bgive [^.]{0,80} another counter\b/.test(t))mk("modify_counter",{object:"counter",operator:"modify",details:{operation:"add_one_each_kind"}});
  if(/\bmaximum hand size\b/.test(t))mk("modify_hand_size",{object:"hand_size",operator:"modify"});
  if(/\bmaximum life total\b/.test(t))mk("modify_life_maximum",{object:"life_total",operator:"modify"});
  if(/\b(?:double|switch)\b[^.]{0,90}\bpower\b|\bassigns? combat damage equal to its toughness\b/.test(t))mk(/assigns? combat damage/.test(t)?"modify_damage_assignment":"modify_power_toughness",{object:"creature",operator:"modify"});
  if(/\bgains?\b[^.]{0,120}\b(?:flying|first strike|double strike|trample|lifelink|haste|vigilance|deathtouch|menace|reach|hexproof|indestructible|ward|suspend|riot)\b/.test(t))mk("grant_keyword",{object:"keyword",operator:"modify"});
  if(/\blose(?:s)? all abilities\b/.test(t))mk("remove_abilities",{object:"ability",operator:"modify"});
  // Turn-structure effects.
  let combat=t.match(/\b(?:there (?:is|are)|take) (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) additional combat phases?\b/);
  if(combat)mk("additional_combat",{object:"combat_phase",magnitude:{amount:num(combat[1])||1},details:{phase:"combat",additional:true}});
  // Game/permission effects.
  if(/\bloses? the game\b/.test(t))mk("lose_game",{object:"game",operator:/\bcan't lose the game\b/.test(t)?"prohibit":"perform",target:recoveredTarget(raw,cap.target)||(/\beach opponent\b/.test(t)?entityRef("each_opponent"):cap.target),requirements:/\b(?:if|who (?:doesn't|does not))\b/.test(t)?predicate("loss_condition",{raw:clean(raw)}):null});
  if(/\bwins? the game\b/.test(t))mk("win_game",{object:"game",actor:recoveredActor(raw,cap.actor),beneficiary:recoveredActor(raw,cap.beneficiary),requirements:/\bif\b/.test(t)?predicate("win_condition",{raw:clean(raw)}):null});
  if(/\bthe game is a draw\b/.test(t))mk("draw_game",{object:"game"});
  if(/\bmay begin the game with [^.]{0,100} on the battlefield\b/.test(t))mk("pregame_battlefield",{object:"source",operator:"permit",zones:{source:"opening_hand",destination:"battlefield",owner:entityRef("you")},details:{scope:clean(raw)}});
  if(/\b(?:may|can) cast\b/.test(t))mk("cast_permission",{object:"spell",operator:"permit"});
  if(/\b(?:may|can) play\b[^.]{0,100}\b(?:cards?|it|them|that card|those cards)\b/.test(t))mk("play_permission",{object:"card",operator:"permit",details:{scope:clean(raw)}});
  if(/\bmay plot [^.]{0,100} from (?:the top of )?(?:your )?library\b/.test(t))mk("plot_from_zone",{object:"card",operator:"permit",zones:{source:/top of/.test(t)?"library_top":"library",destination:"exile",owner:entityRef("you")}});
  if(/\b(?:you|players?|opponents?|that player|target player|each opponent) (?:can't|cannot) cast [^.]*spells?\b/.test(t))mk("cast_spell",{object:"spell",operator:"prohibit",details:{restriction:clean(raw)}});
  if(/\b(?:can't|cannot) cast [^.]*spells?\b|\bspells? (?:can't|cannot) be cast\b/.test(t))mk("cast_spell",{object:"spell",operator:"prohibit",details:{restriction:clean(raw)}});
  if(/\b(?:can't|cannot) cast [^.]+ during (?:your|their|the) [^.]+turns?\b/.test(t))mk("casting_timing_restriction",{object:"spell",operator:"prohibit",details:{restriction:clean(raw)}});
  if(/\b(?:you|players?|opponents?|that player|target player|each opponent) (?:can't|cannot) play [^.]*\b/.test(t))mk(/\blands?\b/.test(t)?"play_land":"play_card",{object:/\blands?\b/.test(t)?"land":"card",operator:"prohibit",details:{restriction:clean(raw)}});
  // Core game actions and state/rule modifications missed by the legacy parser.
  if(/\b(?:fight|fights)\b/.test(t))mk("fight",{object:"creature"});
  if(/\bdestroys?\b|\bdestroy\b/.test(t))mk("destroy",{object:/land/.test(t)?"land":/artifact/.test(t)?"artifact":/enchantment/.test(t)?"enchantment":/creature/.test(t)?"creature":"permanent"});
  if(/\b(?:deals?|deal) [^.]{0,100}damage\b/.test(t))mk("deal_damage",{object:"damage",target:recoveredTarget(raw,cap.target)});
  if(/\bcounter (?:target |all |up to [^ ]+ )?(?:spell|activated|triggered|ability|spells|abilities)\b/.test(t))mk(/ability/.test(t)&&!/spell/.test(t)?"counter_ability":"counter_spell",{object:/ability/.test(t)&&!/spell/.test(t)?"ability":"spell"});
  if(/\bcounter (?:up to )?(?:one|two|three|four|five|six|seven|eight|nine|ten|x|\d+)?\s*(?:target )?spells? and\/or abilities?\b/.test(t)){mk("counter_spell",{object:"spell"});mk("counter_ability",{object:"ability"});}
  if(/\bcounter it unless [^.]+ pays?\b/.test(t)){mk(/\b(?:casts?|cast) (?:an? )?[^.]*spell\b/.test(t)?"counter_spell":"counter_ability",{object:/\bspell\b/.test(t)?"spell":"ability",requirements:predicate("unless_payment",{raw:clean(raw)})});}
  if(/\bcopy (?:that|target|the|those|it|this|a) [^.]{0,50}(?:spell|card|ability)|\bcopy it\b/.test(t))mk("copy",{object:/ability/.test(t)?"ability":/card/.test(t)?"card":"spell"});
  if(/\bexchange control\b/.test(t))mk("exchange_control",{object:"permanent"});
  if(/\bgain control\b/.test(t))mk("gain_control",{object:"permanent"});
  if(/\badditional combat phase\b/.test(t))mk("additional_combat",{object:"combat_phase"});
  if(/\badditional main phase\b/.test(t))mk("additional_main_phase",{object:"main_phase"});
  if(/\bextra turns?\b|\badditional turns?\b/.test(t)){const tm=t.match(/\b(?:take|takes) (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) extra turns?\b/);const subject=recoveredActor(raw,cap.beneficiary)||entityRef("you");mk("extra_turn",{object:"turn",actor:subject,beneficiary:subject,magnitude:tm?{amount:num(tm[1])||1}:null});}
  const skipped=t.match(/\b(?:skip|skips) (?:their|your) next (x|one|two|three|four|five|\d+) turns?\b/);if(skipped){const subject=recoveredActor(raw,cap.target)||entityRef("referenced_player");mk("skip_turn",{object:"turn",target:subject,magnitude:{amount:skipped[1]==="x"?{kind:"variable",name:"X"}:num(skipped[1])}});}
  if(/\bblocks? (?:this turn|it|that creature|this creature|target creature)[^.]{0,30}if able|\bblocks? [^.]{0,60}if able/.test(t))mk("must_block",{object:"combat_requirement",operator:"modify"});
  if(/\battacks? [^.]{0,60}if able/.test(t))mk("must_attack",{object:"combat_requirement",operator:"modify"});
  if(/\bonly [^.]{0,80}can attack\b/.test(t))mk("attack_restriction",{object:"combat_rule",operator:"modify"});
  if(/\bassigns? no combat damage\b/.test(t))mk("prevent_combat_damage_assignment",{object:"combat_damage",operator:"modify"});
  if(/\bassigns? combat damage\b/.test(t))mk("modify_damage_assignment",{object:"combat_damage",operator:"modify"});
  // Characteristics and continuous rule changes.
  if(/\b(?:is|are|becomes?|become) all colors\b|\b(?:is|are|becomes?|become) (?:the )?(?:color(?: or colors)?|colors) of (?:your|their|the) choice\b|\b(?:is|are) the chosen color\b|\b(?:all |nonland )?(?:creatures?|permanents?|spells?)(?: you control)? (?:is|are) (?:white|blue|black|red|green|colorless)\b|\bbecomes? (?:white|blue|black|red|green|colorless)\b/.test(t))mk("modify_color",{object:"object_color",operator:"modify",details:{rawCharacteristic:clean(raw)}});
  if(/\bbecomes? an? [a-z][a-z '-]*(?:artifact|creature|land|enchantment|planeswalker|battle)\b|\b(?:is|are) an? [a-z][a-z '-]*(?:artifact|creature|land|enchantment)\b|\bit'?s an? [a-z0-9/ +'-]*(?:artifact|creature|land|enchantment|planeswalker)\b/.test(t))mk("modify_type",{object:"type_line",operator:"modify",details:{rawCharacteristic:clean(raw)}});
  if(/\bnonbasic lands are (?:plains|islands|swamps|mountains|forests)\b|\bbasic lands [^.]{0,100} are the [^.]{0,60}chosen type\b/.test(t))mk("set_characteristics",{object:"type_line",operator:"modify",details:{operation:"set_or_modify",rawCharacteristic:clean(raw)}});
  if(/\b(?:target |each |all |this |enchanted )?(?:creature|land|permanent)s? (?:becomes?|become|is|are) (?:that|the chosen) type\b/.test(t))mk("set_referenced_type",{object:"type_line",operator:"modify",details:{rawCharacteristic:clean(raw)}});
  if(/\b(?:target |this )?creature loses all creature types\b/.test(t))mk("set_characteristics",{object:"type_line",operator:"modify",details:{operation:"remove_subtypes",rawCharacteristic:clean(raw)}});
  if(/\b(?:is|are|becomes?) legendary\b|\bisn'?t legendary\b/.test(t))mk("set_characteristics",{object:"supertype",operator:"modify",details:{operation:/isn'?t legendary/.test(t)?"remove":"add",supertype:"Legendary"}});
  if(/\b(?:is|are|becomes?) snow\b|\bno longer snow\b/.test(t))mk("set_characteristics",{object:"supertype",operator:"modify",details:{operation:/no longer snow/.test(t)?"remove":"add",supertype:"Snow",rawCharacteristic:clean(raw)}});
  if(/\bstill an? (?:artifact|creature|land|enchantment|planeswalker)\b/.test(t))mk("retain_characteristic",{object:"type_line",operator:"modify",details:{rawCharacteristic:clean(raw)}});
  if(/\bbase power and toughness\b|\bbase toughness\b|\bbase power\b/.test(t))mk("set_base_power_toughness",{object:"power_toughness",operator:"modify"});
  if(/\bpower becomes? equal\b|\btoughness becomes? equal\b/.test(t))mk("set_power_toughness",{object:"power_toughness",operator:"modify"});
  if(/\bexchange [^.]{0,50}(?:life totals?|power|toughness)\b/.test(t))mk("exchange_value",{object:/life total/.test(t)?"life_total":"power_toughness",operator:"modify"});
  if(/\blife total [^.]{0,40}becomes? equal\b/.test(t))mk("set_life_total",{object:"life_total",operator:"modify"});
  if(/\bchange the text\b/.test(t))mk("modify_rules_text",{object:"rules_text",operator:"modify"});
  if(/\blegend rule\b/.test(t))mk("modify_game_rule",{object:"legend_rule",operator:"modify"});
  // Ability/keyword grants. Keep the literal grant as partial when the keyword is not normalized yet.
  if(/\b(?:has|have|gains?|gain) [^.]{0,120}\b(?:afterlife|encore|escape|flashback|buyback|kicker|cycling|madness|retrace|unearth|persist|undying|cascade|storm|prowess|myriad|annihilator|affinity|ward|toxic|backup|blitz|casualty|convoke|delve|improvise|offering|ninjutsu|channel|crew|equip|fortify|suspend|split second|undaunted|conspire|ripple|prowl|sunburst|bloodthirst|offspring|web-slinging|demonstrate|shadow|swampwalk|islandwalk|plainswalk|forestwalk|mountainwalk|horsemanship|wither|fear|exalted|training|evolve|firebending(?: \d+)?|poisonous(?: \d+)?|cumulative upkeep|rampage(?: \d+)?)\b/.test(t))mk("grant_ability",{object:"ability",operator:"modify",details:{literalGrant:raw}});
  if(/\b(?:creatures?|spells?|cards?|permanents?|rats?|slivers?|humans?) [^.]{0,120}\b(?:has|have|gains?|gain) (split second|undaunted|conspire|ripple(?: \d+)?|prowl(?: \{[^}]+\})?|sunburst|bloodthirst(?: \d+)?|offspring(?: \{[^}]+\})?|web-slinging(?: \{[^}]+\})?|demonstrate|shadow|swampwalk|islandwalk|plainswalk|forestwalk|mountainwalk|horsemanship|wither|fear|exalted|training|evolve|firebending(?: \d+)?|poisonous(?: \d+)?|cumulative upkeep(?: \{[^}]+\})?|rampage(?: \d+)?)\b/.test(t)){const km=t.match(/\b(?:has|have|gains?|gain) (split second|undaunted|conspire|ripple(?: \d+)?|prowl(?: \{[^}]+\})?|sunburst|bloodthirst(?: \d+)?|offspring(?: \{[^}]+\})?|web-slinging(?: \{[^}]+\})?|demonstrate|shadow|swampwalk|islandwalk|plainswalk|forestwalk|mountainwalk|horsemanship|wither|fear|exalted|training|evolve|firebending(?: \d+)?|poisonous(?: \d+)?|cumulative upkeep(?: \{[^}]+\})?|rampage(?: \d+)?)\b/);mk("grant_keyword",{object:"keyword",operator:"modify",details:{keyword:km?.[1]||null,scope:"referenced_objects"}});}
  // Costs, permissions, and activation/casting restrictions are distinct from the resulting action.
  if(/\bcosts? [^.]{0,70}(?:less|more) to cast\b/.test(t))mk(/less/.test(t)?"reduce_cost":"increase_cost",{object:"casting_cost",operator:"modify"});
  if(/\b(?:plotting|foretelling|unlock|morph|buyback|cycling|equip|crew|saddle|kicker|flashback|escape|emerge|evoke|ninjutsu) [^.]{0,80}costs? [^.]{0,40}(?:less|more)\b|\b(?:plot|foretell|unlock|morph|buyback|cycling|equip|crew|saddle|kicker|flashback|escape|emerge|evoke|ninjutsu) costs? [^.]{0,40}(?:less|more)\b/.test(t)){const km=t.match(/\b(plotting|foretelling|plot|foretell|unlock|morph|buyback|cycling|equip|crew|saddle|kicker|flashback|escape|emerge|evoke|ninjutsu)\b/);mk(/\bless\b/.test(t)?"reduce_cost":"increase_cost",{object:"keyword_cost",operator:"modify",details:{scope:(km?.[1]||"keyword_cost").replace(/ing$/,'')}});}
  if(/\b(?:all )?(?:[a-z-]+ )?costs? cost \{?\d+\}? (?:less|more)\b/.test(t)){const km=t.match(/\b([a-z-]+) costs? cost\b/);mk(/\bless\b/.test(t)?"reduce_cost":"increase_cost",{object:"keyword_cost",operator:"modify",details:{scope:km?.[1]||"keyword_cost"}});}
  if(/\bpay [^.]{0,70}rather than paying (?:its|the) mana cost\b/.test(t))mk("alternate_cost",{object:"casting_cost",operator:"modify"});
  if(/\bwithout paying (?:its|their|the) mana cost\b/.test(t))mk("waive_mana_cost",{object:"casting_cost",operator:"modify"});
  if(/\bmay pay\b/.test(t))mk("payment_option",{object:"cost",operator:"permit"});
  if(/\bunless (?:you|they|that player|its controller) pay\b/.test(t))mk("optional_payment_requirement",{object:"cost",operator:"modify"});
  if(/\bactivate no more than|\bcan't activate|\bcannot activate|\bmay activate [^.]{0,100}only\b|\bactivate only\b/.test(t))mk("activation_restriction",{object:"ability_activation",operator:/can't activate|cannot activate/.test(t)?"prohibit":"modify"});
  if(/\bdo this only\b/.test(t))mk("timing_restriction",{object:"action_timing",operator:"modify"});
  if(/\bcan't cast [^.]{0,100}if\b|\bcan't play lands?\b/.test(t))mk(/play land/.test(t)?"play_land":"cast_spell",{object:/play land/.test(t)?"land":"spell",operator:"prohibit"});
  // Mana behavior beyond simple production.
  if(/\bdon't lose this mana|\bdoesn't empty from your mana pool|\bdoes not empty from your mana pool/.test(t))mk("preserve_mana",{object:"mana",operator:"modify"});
  if(/\bproduces? [^.]*(?:instead of any other type|instead)\b|\bmana becomes? [^.]*instead\b/.test(t))mk("replace_mana_type",{object:"mana",operator:"replace",details:{replacementControl:true,raw:clean(raw)}});
  if(/\bactivates? a mana ability\b/.test(t))mk("force_mana_ability_activation",{object:"mana_ability"});
  if(/\blose all unspent mana\b/.test(t))mk("lose_unspent_mana",{object:"mana"});
  if(/\benter(?:s|ing)? with (?:an? |one |two |three |four |five |six |seven |eight |nine |ten |x )?additional [^.]{0,40}counters?\b/.test(t))mk("modify_counter",{object:"counter",operator:"modify",details:{operation:"enters_with_additional",raw:clean(raw)}});
  if(/\bthat many plus one of each of those kinds of counters are put\b/.test(t))mk("modify_counter",{object:"counter",operator:"replace",details:{operation:"additive_replacement",delta:1,replacementControl:true}});
  if(/\bpopulate\b/.test(t))mk("populate",{object:"token",operator:"perform"});
  if(/\bendures? (x|\d+)\b/.test(t)){const em=t.match(/\bendures? (x|\d+)\b/);mk("keyword_action",{object:"endure",details:{keyword:"endure",amount:em?.[1]==="x"?{kind:"variable",name:"X"}:Number(em?.[1]||0)}});}
  if(/\b(?:(?:saddles? mounts? and )?crews? vehicles?|saddles? mounts?) as though [^.]{0,60}power were (\d+) greater\b/.test(t)){const m=t.match(/power were (\d+) greater/);mk("crew_saddle_power_modifier",{object:"power_for_crew_or_saddle",operator:"modify",details:{bonus:Number(m?.[1]||0)}});}
  // Modern/keyword-like actions that still matter to deck interaction even before full rules expansion.
  if(/\bamass (?:[a-z]+ )?(?:x|\d+)\b/.test(t))mk("amass",{object:"army_token"});
  if(/\bairbend\b/.test(t))mk("airbend",{object:"permanent"});
  if(/\bblights? (?:x|\d+)\b/.test(t))mk("blight",{object:"player_or_permanent"});
  if(/\byou get \{tk\}\b/.test(t))mk("gain_ticket",{object:"ticket",beneficiary:entityRef("you")});
  if(/\bdaybound\b/.test(t))mk("daybound",{object:"state_rule",operator:"modify"});
  if(/\bnightbound\b/.test(t))mk("nightbound",{object:"state_rule",operator:"modify"});
  // Turn/combat and object-state rules.
  if(/\bskip (?:your|their|that player'?s?) next turn\b|\bskips? that turn\b/.test(t))mk("skip_turn",{object:"turn",operator:"modify"});
  if(/\bskip(?:s)? (?:all |each instance of |their |your |the |that player'?s? )?(?:next )?(?:combat phases?|upkeep steps?|draw steps?|steps?|phases?)\b/.test(t))mk("skip_phase",{object:"turn_phase",operator:"modify",details:{phase:/combat/.test(t)?"combat":/upkeep/.test(t)?"upkeep":/draw/.test(t)?"draw":"chosen_or_referenced",scope:clean(raw)}});
  if(/\badditional upkeep steps?\b/.test(t))mk("additional_upkeep",{object:"upkeep_step",operator:"modify"});
  if(/\badditional beginning phases?\b/.test(t))mk("additional_beginning_phase",{object:"beginning_phase",operator:"modify"});
  if(/\badditional main phases?\b/.test(t))mk("additional_main_phase",{object:"main_phase",operator:"modify"});
  if(/\bend the turn\b/.test(t))mk("end_turn",{object:"turn"});
  if(/\bremove [^.]{0,60} from combat\b/.test(t))mk("remove_from_combat",{object:"creature"});
  if(/\bcan block [^.]{0,60}as though it had reach\b/.test(t))mk("block_as_reach",{object:"combat_rule",operator:"modify"});
  if(/\bcan attack [^.]{0,80}as though it had haste\b/.test(t))mk("attack_as_haste",{object:"combat_rule",operator:"modify"});
  if(/\bcan block (?:an additional|additional) [^.]{0,30}creatures?\b|\bcan block any number of creatures\b/.test(t))mk("additional_block_capacity",{object:"combat_rule",operator:"modify",details:{scope:clean(raw)}});
  if(/\btarget unblocked attacking creature becomes blocked\b|\btarget attacking creatures? become blocked\b/.test(t))mk("force_block",{object:"combat_state",operator:"modify"});
  if(/\b(?:all )?creatures? [^.]{0,80}able to block [^.]{0,80} do so\b/.test(t))mk("must_block",{object:"combat_requirement",operator:"modify"});
  if(/\bmay have (?:it|him|her|this creature|[a-z0-9 ,'-]+) block an attacking creature\b/.test(t))mk("block_assignment",{object:"combat_rule",operator:"modify"});
  if(/\bmay attack only the nearest opponent\b/.test(t))mk("attack_restriction",{object:"combat_rule",operator:"modify",details:{scope:clean(raw)}});
  if(/\bno more than [^.]{0,50}(?:creature|creatures) can attack\b/.test(t))mk("attack_limit",{object:"combat_rule",operator:"modify"});
  if(/\bno more than [^.]{0,50}(?:creature|creatures) can block\b/.test(t))mk("block_limit",{object:"combat_rule",operator:"modify"});
  if(/\bassigns? [^.]{0,100}combat damage [^.]{0,40}as though (?:it|they|he|she) weren'?t blocked\b/.test(t))mk("assign_damage_as_unblocked",{object:"combat_rule",operator:"modify"});
  if(/\blethal damage [^.]{0,100}determined by [^.]{0,60}rather than/.test(t))mk("modify_lethal_damage_rule",{object:"damage_rule",operator:"modify"});
  if(/\bturn (?:it|that card|that creature|this creature) face up\b/.test(t))mk("turn_face_up",{object:"card_state"});
  if(/\bbecomes? plotted\b/.test(t))mk("become_plotted",{object:"card_state",operator:"modify"});
  if(/\b(?:permanents?|they|it) (?:can't|cannot) phase in\b/.test(t))mk("phase_in",{object:"permanent",operator:"prohibit",details:{restriction:clean(raw)}});
  if(/\b(?:permanents?|enchanted creature|it|they) [^.]{0,60}(?:can't|cannot) be turned face up\b/.test(t))mk("turn_face_up",{object:"permanent",operator:"prohibit",details:{restriction:clean(raw)}});
  if(/\byou control (?:target|that|the) (?:opponent|player) during [^.]+(?:turn|phase)\b|\bcontrols? the (?:second|first|target) player during [^.]+turn\b/.test(t))mk("control_player",{object:"player",operator:"modify",target:recoveredTarget(raw,cap.target),details:{duration:clean(raw)}});
  if(/\bunattach\b/.test(t))mk("unattach",{object:"equipment",operator:"perform"});
  if(/\bdamage [^.]{0,100}(?:can't|cannot) be prevented\b/.test(t))mk("prevent_damage",{object:"damage",operator:"prohibit",details:{scope:clean(raw)}});
  if(/\bcounters? (?:can't|cannot) be (?:put|removed)\b|\b(?:can't|cannot) have [^.]{0,40}counters? put on\b/.test(t))mk("counter_restriction",{object:"counter",operator:"prohibit",details:{restriction:clean(raw)}});
  // Common named actions that are already atomic concepts in Magic rules text.
  if(/\bdetain\b/.test(t))mk("detain",{object:"permanent"});
  if(/\bclash with\b/.test(t))mk("clash",{object:"player"});
  if(/\bbolster (?:x|\d+)\b/.test(t))mk("bolster",{object:"creature"});
  if(/\blearn\b/.test(t))mk("learn",{object:"card_choice",beneficiary:entityRef("you")});
  if(/\binvestigate\b/.test(t))mk("investigate",{object:"clue_token",beneficiary:entityRef("you")});
  if(/\bexplores?\b/.test(t))mk("explore",{object:"creature"});
  if(/\bventure into the dungeon\b/.test(t))mk("venture",{object:"dungeon"});
  if(/\btake the initiative\b/.test(t))mk("take_initiative",{object:"initiative"});
  if(/\bmay play (?:x|one|two|three|four|five|\d+) additional lands?\b/.test(t))mk("additional_land",{object:"land_play",operator:"permit",magnitude:{amount:/\bx\b/.test(t)?{kind:"variable",name:"X"}:num((t.match(/may play (one|two|three|four|five|\d+)/)||[])[1])||1}});
  if(/\byou control enchanted (?:land|enchantment|artifact|equipment|creature|permanent)\b/.test(t))mk("gain_control",{object:(t.match(/enchanted (land|enchantment|artifact|equipment|creature|permanent)/)||[])[1]||"permanent",operator:"modify"});
  if(/\b(?:this equipment|this aura) can be attached only to\b|\bcan't be equipped\b/.test(t))mk("attachment_restriction",{object:"attachment",operator:"modify",details:{restriction:clean(raw)}});
  if(/\bthe same is true for [^.]+\b/.test(t))mk("inherit_previous_characteristic",{object:"characteristic",operator:"modify",details:{reference:"previous_clause",scope:clean(raw)}});
  if(/\bcloak the top card of\b/.test(t))mk("cloak",{object:"card",zones:{source:"library_top",destination:"battlefield",owner:entityRef("you")}});
  if(/\bcollect evidence (x|\d+)\b/.test(t)){const m=t.match(/collect evidence (x|\d+)/);mk("collect_evidence",{object:"graveyard_cards",details:{amount:m?.[1]==="x"?{kind:"variable",name:"X"}:Number(m?.[1]||0)}});}
  // Deck-building and option constraints are semantic facts, not gameplay actions.
  if(/\bcan be your commander\b/.test(t))mk("commander_eligibility",{object:"deck_rule",operator:"permit"});
  if(/\ba deck can have any number of cards named\b/.test(t))mk("deck_copy_limit_override",{object:"deck_rule",operator:"modify",details:{limit:"any_number"}});
  {const dm=t.match(/\ba deck can have up to (one|two|three|four|five|six|seven|eight|nine|ten|\d+) cards named\b/);if(dm)mk("deck_copy_limit_override",{object:"deck_rule",operator:"modify",details:{limit:num(dm[1])}});}
  if(/\bcompanion\b/.test(t)&&/\bstarting deck\b/.test(t))mk("companion_requirement",{object:"deck_rule",operator:"modify"});
  if(/\beach mode must target a different\b/.test(t))mk("mode_target_constraint",{object:"option_group",operator:"modify"});
  if(/\bx can'?t be 0\b|\bx cannot be 0\b/.test(t))mk("variable_constraint",{object:"X",operator:"modify",details:{comparison:"greater_than",value:0}});
  if(/\bx can'?t be greater than\b|\bx cannot be greater than\b/.test(t))mk("variable_constraint",{object:"X",operator:"modify",details:{comparison:"max_dynamic",raw}});
  if(/\bthis effect can'?t reduce [^.]{0,80}to less than\b/.test(t))mk("effect_floor_constraint",{object:"effect_magnitude",operator:"modify"});
  if(/\bthis effect can'?t reduce the amount of mana [^.]{0,80}by more than\b/.test(t))mk("cost_reduction_cap",{object:"casting_cost",operator:"modify",details:{raw:clean(raw)}});
  if(/\bthis ability can'?t cause [^.]{0,80}greater than\b/.test(t))mk("effect_cap_constraint",{object:"effect_magnitude",operator:"modify"});
  // Ability/cost/timing rules.
  if(/\bactivated abilities of [^.]{0,100}cost [^.]{0,50}less to activate\b/.test(t))mk("reduce_activation_cost",{object:"activation_cost",operator:"modify"});
  if(/\bactivated abilities of [^.]{0,100}cost [^.]{0,50}more to activate\b/.test(t))mk("increase_activation_cost",{object:"activation_cost",operator:"modify"});
  if(/\bthis ability costs [^.]{0,80}(?:more|less) to activate\b/.test(t))mk(/less/.test(t)?"reduce_activation_cost":"increase_activation_cost",{object:"activation_cost",operator:"modify"});
  if(/\bactivate no more times each turn than\b|\bcan be activated an additional time\b|\bmay activate [^.]{0,80}two more times this turn\b/.test(t))mk("activation_limit",{object:"ability_activation",operator:"modify",details:{rule:clean(raw)}});
  if(/\bmay activate [^.]{0,120}any time you could cast an instant\b/.test(t))mk("activation_timing_permission",{object:"ability_activation",operator:"permit",details:{timing:"instant_speed"}});
  if(/\bmay activate abilities? [^.]{0,120}as though [^.]{0,80} had haste\b/.test(t))mk("activation_timing_permission",{object:"ability_activation",operator:"permit",details:{timing:"ignore_summoning_sickness",scope:clean(raw)}});
  if(/\bonly [^.]{0,100} may activate this ability\b/.test(t))mk("activation_permission",{object:"ability_activation",operator:"permit",details:{actorRestriction:clean(raw)}});
  if(/\bcast this spell only\b/.test(t))mk("casting_timing_restriction",{object:"spell",operator:"modify"});
  if(/\bthe next [^.]{0,100}spell [^.]{0,80}can be cast as though it had flash\b|\bthe next creature card you play [^.]{0,60}as though it had flash\b/.test(t))mk("casting_timing_permission",{object:/creature card/.test(t)?"card":"spell",operator:"permit",details:{timing:"flash",scope:clean(raw)}});
  if(/\bmana of any type can be spent to (?:cast|activate)\b|\bspend (?:[a-z]+ )?mana as though it were mana of (?:any|another|the chosen) (?:type|color)\b|\bspend [a-z]+ mana as though it were [a-z]+ mana\b/.test(t))mk("mana_spending_flexibility",{object:/\bactivate\b/.test(t)?"activation_cost":"casting_cost",operator:"modify",details:{scope:clean(raw)}});
  if(/\bspend [^.]{0,80} mana only as though it were colorless mana\b/.test(t))mk("mana_restriction",{object:"mana_spending",operator:"modify",details:{manaRestriction:{kind:"spend_only_as",allowedUses:[{kind:"mana_type",type:"colorless"}],raw:clean(raw)}}});
  if(/\bspend only mana [^.]{0,140}\b(?:activate|cast)\b/.test(t))mk("mana_restriction",{object:/\bactivate\b/.test(t)?"activation_cost":"casting_cost",operator:"modify",details:{manaRestriction:{kind:"spend_only",raw:clean(raw)}}});
  if(/\bhas foretell\b/.test(t))mk("grant_ability",{object:"ability",operator:"modify",details:{keyword:"Foretell"}});
  if(/\bhave freerunning\b/.test(t))mk("grant_ability",{object:"ability",operator:"modify",details:{keyword:"Freerunning"}});
  if(/\bgains? rebound\b/.test(t))mk("grant_ability",{object:"ability",operator:"modify",details:{keyword:"Rebound"}});
  if(/\bmadness cost is equal to its mana cost\b/.test(t))mk("set_alternative_cost",{object:"madness_cost",operator:"modify"});
  if(/\brather than pay [^.]{0,100}pay [^.]{0,100}(?:life|mana)\b|\bpay (?:its|the) [a-z-]+ cost rather than (?:its|the) mana cost\b|\brather than pay the mana cost\b/.test(t))mk("replace_cost",{object:"casting_cost",operator:"replace",details:{scope:clean(raw)}});
  if(/\bpay any amount of (?:life|mana)\b|\bpay any amount of \{e\}/.test(t))mk("pay_variable_cost",{object:/life/.test(t)?"life":/\{e\}/.test(t)?"energy":"mana"});
  if(/\bcost(?:s)? an additional [^.]{0,50}life to (?:cast|activate)\b/.test(t))mk(/activate/.test(t)?"increase_activation_cost":"increase_cost",{object:/activate/.test(t)?"activation_cost":"casting_cost",operator:"modify",details:{resource:"life",raw:clean(raw)}});
  if(/\b(?:players?|you) can't pay life to (?:cast|activate)\b/.test(t))mk("payment_restriction",{object:"life",operator:"prohibit",details:{scope:clean(raw)}});
  if(/\bcan't spend mana to cast this spell\b/.test(t))mk("mana_payment_restriction",{object:"casting_cost",operator:"prohibit"});
  if(/\beach spell that would cost less than [^.]{0,60} costs [^.]{0,60} to cast\b/.test(t))mk("minimum_casting_cost",{object:"casting_cost",operator:"modify",details:{raw:clean(raw)}});
  // Trigger/rule suppression and ability copying.
  if(/\b(?:entering|dying)[^.]{0,40}don'?t cause [^.]{0,120}to trigger\b|\bdoesn'?t cause [^.]{0,120}to trigger\b/.test(t))mk("suppress_trigger",{object:"triggered_ability",operator:"prohibit",details:{scope:clean(raw)}});
  if(/\b(?:cards?|lands?|permanents?) [^.]{0,120}(?:can't|cannot) enter the battlefield\b/.test(t))mk("zone_entry_restriction",{object:/\blands?\b/.test(t)?"land":"card",operator:"prohibit",zones:{source:/graveyards?/.test(t)&&/librar(?:y|ies)/.test(t)?"graveyard_or_library":/graveyards?/.test(t)?"graveyard":/librar(?:y|ies)/.test(t)?"library":null,destination:"battlefield",owner:null},details:{restriction:clean(raw)}});
  if(/\bhas all activated abilities of\b/.test(t))mk("copy_activated_abilities",{object:"ability",operator:"modify"});
  if(/\bcounters remain on [^.]{0,80}as it moves to any zone\b/.test(t))mk("retain_counters_across_zones",{object:"counter",operator:"modify"});
  // Copy/target continuation and countering that the old parser often left as references only.
  if(/\beach copy targets?\b|\bthe copy targets?\b/.test(t))mk("set_copy_target",{object:"copy",operator:"modify"});
  if(/\bcast the copies\b/.test(t))mk("cast_copy",{object:"spell_copy",operator:"permit"});
  if(/\bcounter (?:up to )?(?:one |two |three )?(?:target )?(?:activated|triggered) (?:ability|abilities)\b/.test(t))mk("counter_ability",{object:"ability"});
  if(/\bcounter [a-z0-9' ,.-]+\.?$/.test(t)&&!/\bcounter on\b/.test(t))mk("counter_spell",{object:"spell"});
  // Replacement/rule text families.
  if(/\bif damage would be dealt [^.]{0,120}instead\b|\bthe next [^.]{0,80}damage [^.]{0,100}instead\b/.test(t))mk("redirect_damage",{object:"damage",operator:"replace"});
  if(/\bskip (?:that|this|your) (?:draw step|step) instead\b/.test(t))mk("replace_step",{object:"turn_step",operator:"replace"});
  if(/\brepeat this process\b/.test(t))mk("repeat_process",{object:"previous_process",operator:"modify"});
  if(/\bround up each time\b/.test(t))mk("rounding_rule",{object:"quantity",operator:"modify",details:{rounding:"up"}});
  // Set membership / characteristic continuation.
  if(/\bthis creature is the chosen type\b|\btarget creature becomes that type\b|\bthis land is the chosen type\b/.test(t))mk("set_referenced_type",{object:"type_line",operator:"modify"});
  if(/\bthis creature becomes that color\b/.test(t))mk("set_referenced_color",{object:"object_color",operator:"modify"});
  if(/\bdevotion [^.]{0,100}increased by\b/.test(t))mk("modify_devotion",{object:"devotion",operator:"modify"});
  if(/\bit'?s an enchantment\b|\bthey'?re [0-9x+\/-]+ [^.]{0,80}creatures\b/.test(t))mk("set_characteristics",{object:"type_line",operator:"modify"});
  // High-impact Commander long-tail families. Keep these generic: no card-name patches.
  // Type/subtype/color rewrites and symbolic grants/removals.
  if(/\b(?:target|this|enchanted) creature becomes? an? [a-z][a-z '-]{1,40}(?: until|\.|$)/.test(t))mk("modify_type",{object:"creature_type",operator:"modify",details:{operation:"set_or_add_subtype",rawCharacteristic:clean(raw)}});
  if(/\b(?:this creature|[a-z][a-z '-]+) is also (?:an? )?[a-z][a-z ',&-]{1,90}\b/.test(t))mk("modify_type",{object:"creature_type",operator:"modify",details:{operation:"add_subtypes",rawCharacteristic:clean(raw)}});
  if(/\b(?:enchanted creature|this creature|it|he|she) (?:is|becomes) an? [a-z][a-z '-]{1,50}(?:\.|$)/.test(t)&&!/\b(?:copy|blocked|unblocked|tapped|untapped)\b/.test(t))mk("modify_type",{object:"creature_type",operator:"modify",details:{operation:"set_or_add_subtype",rawCharacteristic:clean(raw)}});
  if(/\b(?:he|she|it)'?s an? [^.]{0,60} in addition to (?:his|her|its|their) other types\b/.test(t))mk("modify_type",{object:"creature_type",operator:"modify",details:{operation:"add_subtypes",rawCharacteristic:clean(raw)}});
  if(/\bcreatures? you control are the chosen type\b|\beach creature you control becomes that type\b/.test(t))mk("set_referenced_type",{object:"creature_type",operator:"modify",details:{rawCharacteristic:clean(raw)}});
  if(/\blands? you control gain all basic land types\b/.test(t))mk("modify_type",{object:"land_type",operator:"modify",details:{operation:"add_all_basic_land_types"}});
  if(/\beach land of the first chosen type becomes the second chosen type\b/.test(t))mk("set_referenced_type",{object:"land_type",operator:"modify",details:{mapping:"first_chosen_to_second_chosen"}});
  if(/\b(?:target|enchanted|this) (?:snow )?permanent isn'?t snow\b/.test(t))mk("set_characteristics",{object:"supertype",operator:"modify",details:{operation:"remove",supertype:"Snow"}});
  if(/\bstill a [^.]{0,40}\bland\b/.test(t))mk("retain_characteristic",{object:"type_line",operator:"modify",details:{rawCharacteristic:clean(raw)}});
  if(/\b(?:gets?|get) [+-]?(?:x|\d+)\/[+-]?(?:y|x|\d+)\b/.test(t))mk("modify_power_toughness",{object:"creature",operator:"modify",details:{dynamic:true,raw:clean(raw)}});
  {const mm=t.match(/\b(double|triple) (?:the )?(power and toughness|power|toughness)\b/);if(mm)mk("modify_power_toughness",{object:"creature",operator:"modify",details:{operation:"multiply",factor:mm[1]==="triple"?3:2,characteristic:mm[2]}});}
  if(/\b(?:creatures?|auras?|slivers?) [^.]{0,100}\b(?:has|have|gains?|gain) (skulk|intimidate|umbra armor|absorb(?: \d+)?|frenzy(?: \d+)?|flanking|provoke|decayed)\b/.test(t)){const km=t.match(/\b(?:has|have|gains?|gain) (skulk|intimidate|umbra armor|absorb(?: \d+)?|frenzy(?: \d+)?|flanking|provoke|decayed)\b/);mk("grant_keyword",{object:"keyword",operator:"modify",details:{keyword:km?.[1]||null,scope:"referenced_objects"}});}
  if(/\b(?:creatures? you control|[a-z][a-z ',.-]+) gains? that ability\b/.test(t))mk("grant_referenced_ability",{object:"ability",operator:"modify",details:{reference:"chosen_or_previous_ability"}});
  if(/\b(?:target creature|this creature|it) loses? (?:all )?(?:forestwalk|islandwalk|swampwalk|mountainwalk|plainswalk|landwalk abilities|shadow|flanking|banding|\"bands with other\" abilities)\b/.test(t))mk("remove_keyword",{object:"keyword",operator:"modify",details:{raw:clean(raw)}});
  if(/\bhas all loyalty abilities of\b/.test(t))mk("copy_loyalty_abilities",{object:"ability",operator:"modify"});
  if(/\bhas all abilities of ability stickers\b/.test(t))mk("copy_abilities",{object:"ability",operator:"modify",details:{source:"ability_stickers"}});
  if(/\bhas soulshift x\b/.test(t))mk("grant_keyword",{object:"keyword",operator:"modify",details:{keyword:"soulshift",amount:{kind:"variable",name:"X"}}});

  // Turn/combat/state rules with direct deck-building or interaction consequences.
  if(/\b(?:that player|target opponent|target player) becomes the monarch\b/.test(t))mk("become_monarch",{object:"monarch",operator:"modify",target:recoveredTarget(raw,cap.target)});
  if(/\b(?:it|this game) becomes? (?:day|night)\b/.test(t))mk("set_day_night",{object:"day_night_state",operator:"modify",details:{state:/\bnight\b/.test(t)?"night":"day"}});
  if(/\bbecomes? saddled until end of turn\b/.test(t))mk("become_saddled",{object:"mount_state",operator:"modify"});
  if(/\bthose creatures are now attacking that player\b|\b[a-z][a-z ',.-]+ is attacking that player or planeswalker\b/.test(t))mk("reassign_attacker",{object:"combat_state",operator:"modify",target:recoveredTarget(raw,cap.target)});
  if(/\bcan block creatures with shadow as though it had shadow\b|\btapped creatures you control can block as though they were untapped\b/.test(t))mk("block_permission",{object:"combat_rule",operator:"permit",details:{rule:clean(raw)}});
  if(/\bcan be blocked as though they didn'?t have [^.]{0,60}abilities\b/.test(t))mk("block_rule_override",{object:"combat_rule",operator:"modify",details:{rule:clean(raw)}});
  if(/\bthis creature can only attack alone\b/.test(t))mk("attack_restriction",{object:"combat_rule",operator:"modify",details:{restriction:"attack_alone"}});
  if(/\bonly creatures in the chosen piles can block this turn\b/.test(t))mk("block_restriction",{object:"combat_rule",operator:"modify",details:{rule:clean(raw)}});
  if(/\b(?:all )?walls able to block [^.]{0,60} do so\b/.test(t))mk("must_block",{object:"combat_requirement",operator:"modify"});
  if(/\btarget creature [^.]{0,80} blocks target creature [^.]{0,80} this turn if able\b/.test(t))mk("must_block",{object:"combat_requirement",operator:"modify",details:{assignment:clean(raw)}});
  if(/\bif this creature is unblocked, [^.]{0,100}assign its combat damage to a creature\b/.test(t))mk("modify_damage_assignment",{object:"combat_damage",operator:"modify",details:{rule:clean(raw)}});
  if(/\brather than the attacking player, you assign the combat damage\b/.test(t))mk("modify_damage_assignment",{object:"combat_damage",operator:"modify",details:{controller:"you"}});
  if(/\bend the combat phase\b/.test(t))mk("end_combat",{object:"combat_phase",operator:"perform"});
  if(/\battacking creatures become blocked\b/.test(t))mk("force_block",{object:"combat_state",operator:"modify"});
  if(/\bcan block up to (?:one|two|three|four|five|\d+) additional creatures?\b/.test(t))mk("additional_block_capacity",{object:"combat_rule",operator:"modify",details:{scope:clean(raw)}});
  if(/\ball creatures can attack [^.]{0,120}as though those creatures had haste\b/.test(t))mk("attack_as_haste",{object:"combat_rule",operator:"permit",details:{scope:clean(raw)}});
  if(/\bdamage isn'?t removed from [^.]{0,80}during cleanup steps\b/.test(t))mk("damage_persistence",{object:"damage",operator:"modify"});
  if(/\ball damage is dealt [^.]{0,100}as though its source had (infect|wither)\b/.test(t)){const dm=t.match(/source had (infect|wither)/);mk("damage_keyword_override",{object:"damage",operator:"modify",details:{keyword:dm?.[1]||null}});}
  if(/\bcan'?t be destroyed by lethal damage unless\b/.test(t))mk("destruction_restriction",{object:"creature",operator:"modify",details:{rule:clean(raw)}});

  // Castability, costs, mana and resource commitments.
  if(/\b(?:may )?tap (?:one|two|three|four|five|six|seven|eight|nine|ten|x|\d+) (?:other )?untapped [^.]{0,80}(?:you control)?\b/.test(t))mk("tap",{object:"permanent",operator:"perform",details:{resourceCommitment:true,raw:clean(raw)}});
  if(/\bfor each [^.]{0,50}counter on [^.]{0,60},? that player taps? an untapped\b|\bthat player taps an untapped [^.]{0,70} for each [^.]{0,40}counter\b/.test(t))mk("tap",{object:"permanent",operator:"perform",details:{dynamic:true,raw:clean(raw)}});
  if(/\bthe first card you foretell each turn costs? \{0\} to foretell\b/.test(t))mk("set_keyword_cost",{object:"foretell_cost",operator:"modify",details:{keyword:"foretell",manaCost:"{0}",frequency:"first_each_turn"}});
  if(/\bforetell cost is its mana cost reduced by \{[^}]+\}/.test(t))mk("set_keyword_cost",{object:"foretell_cost",operator:"modify",details:{keyword:"foretell",formula:clean(raw)}});
  if(/\bloyalty abilities [^.]{0,80}cost an additional \[\+?\d+\] to activate\b/.test(t))mk("increase_activation_cost",{object:"loyalty_ability",operator:"modify",details:{resource:"loyalty",raw:clean(raw)}});
  if(/\bno more than one mana of each color may be spent this way\b/.test(t))mk("mana_restriction",{object:"mana_spending",operator:"modify",details:{manaRestriction:{kind:"max_one_each_color",raw:clean(raw)}}});
  if(/\byou may play lands and cast spells from one of those piles\b/.test(t)){mk("play_permission",{object:"land",operator:"permit",details:{zone:"referenced_pile"}});mk("cast_permission",{object:"spell",operator:"permit",details:{zone:"referenced_pile"}});}
  if(/\bcast any number of [^.]{0,70}spells from among cards you own outside the game\b/.test(t))mk("cast_from_zone",{object:"spell",operator:"permit",zones:{source:"outside_game",destination:"stack",owner:entityRef("you")},details:{scope:clean(raw)}});
  if(/\bthe player plays that card if able\b/.test(t))mk("play_referenced_card",{object:"card",operator:"perform",target:entityRef("referenced_object")});
  if(/\byou control (?:that|the) player until [^.]+resolv/.test(t)|/\byou control the player while [^.]+resolving\b/.test(t))mk("control_player",{object:"player",operator:"modify",target:entityRef("referenced_player"),details:{duration:clean(raw)}});
  if(/\bplayers? can'?t cycle cards\b/.test(t))mk("cycle",{object:"card",operator:"prohibit"});
  if(/\byour life total can'?t change\b/.test(t))mk("modify_life_total",{object:"life_total",operator:"prohibit",details:{rule:"cannot_change"}});
  if(/\b(?:double|triple) (?:your|its controller'?s?) life total\b/.test(t))mk("modify_life_total",{object:"life_total",operator:"modify",details:{operation:"multiply",factor:/\btriple\b/.test(t)?3:2}});
  if(/\bredistribute any number of players'? life totals\b/.test(t))mk("redistribute_life_totals",{object:"life_total",operator:"modify"});

  // Copies, zones, replacement/control rules and target constraints.
  if(/\brepeat the following process x times\b/.test(t))mk("repeat_process",{object:"following_process",operator:"modify",magnitude:{amount:{kind:"variable",name:"X"}}});
  if(/\bround down each time\b/.test(t))mk("rounding_rule",{object:"quantity",operator:"modify",details:{rounding:"down"}});
  if(/\b(?:copy any number of target|copy all|copy each of those|copy them\b)[^.]{0,80}(?:instant|sorcery|spells?)\b|\bcopy them\.?$/.test(t))mk("copy_spell",{object:"spell",operator:"perform",details:{scope:clean(raw)}});
  if(/\bcopy all other activated and triggered abilities\b/.test(t))mk("copy_ability",{object:"ability",operator:"perform",details:{scope:clean(raw)}});
  if(/\bcopy an instant or sorcery card\b/.test(t))mk("copy_card",{object:"card",operator:"perform",details:{cardTypes:["Instant","Sorcery"]}});
  if(/\benter as copies of the chosen creature\b|\b(?:permanents?|shards? you control) become copies of it\b|\bequipped creature is a copy of the last chosen card\b/.test(t))mk("copy_permanent_state",{object:"permanent",operator:"modify",details:{scope:clean(raw)}});
  if(/\breorder your graveyard at random\b/.test(t))mk("reorder_graveyard",{object:"graveyard",operator:"perform",zones:{source:"graveyard",destination:"graveyard",owner:entityRef("you")}});
  if(/\bexchange your hand and graveyard\b/.test(t))mk("exchange_zones",{object:"cards",operator:"modify",zones:{source:"hand",destination:"graveyard",owner:entityRef("you")},details:{otherZone:"graveyard"}});
  if(/\bcloak a card from your hand\b/.test(t))mk("cloak",{object:"card",operator:"perform",zones:{source:"hand",destination:"battlefield",owner:entityRef("you")}});
  if(/\bif a creature would enter the battlefield under an opponent'?s control [^.]* it enters under your control instead\b/.test(t))mk("gain_control",{object:"creature",operator:"replace",details:{replacementControl:true,scope:clean(raw)}});
  if(/\bcounter that ability unless its controller pays?\b/.test(t))mk("counter_ability",{object:"ability",operator:"perform",requirements:predicate("unless_payment",{raw:clean(raw)})});
  if(/\b(?:reselect|change) (?:that spell'?s |its )?target at random\b/.test(t))mk("retarget",{object:"spell_or_ability",operator:"modify",details:{random:true,constraint:clean(raw)}});
  if(/\bthe new target must be (?:a player|a creature)\b|\bthe new targets can'?t be\b/.test(t))mk("target_constraint",{object:"target",operator:"modify",details:{constraint:clean(raw)}});
  if(/\bthis ability still resolves if its target becomes illegal\b/.test(t))mk("resolution_rule_override",{object:"ability",operator:"modify",details:{rule:clean(raw)}});
  if(/\bother permanents enter untapped\b|\bgates you control enter untapped\b/.test(t))mk("enter_untapped",{object:/gates/.test(t)?"Gate":"permanent",operator:"modify"});
  if(/\bnote (?:one of )?[^.]{0,100}\b/.test(t))mk("note_game_information",{object:"game_information",operator:"perform",details:{raw:clean(raw)}});
  if(/\bcount the number of cards in your library\b/.test(t))mk("count_zone",{object:"card",operator:"perform",zones:{source:"library",destination:null,owner:entityRef("you")}});
  if(/\bcan'?t have more than (?:one|two|three|four|five|six|seven|eight|nine|ten|\d+) [^.]{0,40}counters? on it\b/.test(t))mk("counter_limit",{object:"counter",operator:"modify",details:{rule:clean(raw)}});
  if(/\bcan boast twice during each of your turns rather than once\b/.test(t))mk("activation_limit",{object:"boast",operator:"modify",details:{limit:2,period:"turn"}});
  if(/\b(?:crews? vehicles?|saddles? mounts? and crews? vehicles?) using its toughness rather than its power\b|\bstations permanents using its toughness rather than its power\b/.test(t))mk("power_substitution",{object:"activation_power_requirement",operator:"modify",details:{use:"toughness",insteadOf:"power",scope:clean(raw)}});
  // Remaining high-impact long-tail: explicit state, dependency and interaction rules.
  if(/\bthey(?:'re| are) an? (?:artifact|creature|land|enchantment|planeswalker)\b/.test(t))mk("modify_type",{object:"type_line",operator:"modify",details:{rawCharacteristic:clean(raw)}});
  if(/\b(?:target )?creature [^.]{0,50}becomes? an? [a-z][a-z '-]{1,40}(?:\.| until|$)/.test(t))mk("modify_type",{object:"creature_type",operator:"modify",details:{operation:"set_or_add_subtype",rawCharacteristic:clean(raw)}});
  if(/\bit'?s an? [a-z][a-z '-]{1,50}\.?$/.test(t)&&!/\b(?:artifact|creature|land|enchantment|planeswalker)\b/.test(t))mk("modify_type",{object:"creature_type",operator:"modify",details:{operation:"set_or_add_subtype",rawCharacteristic:clean(raw)}});
  if(/\b(?:this artifact|target permanent|target creature) becomes the chosen color\b/.test(t))mk("set_referenced_color",{object:"object_color",operator:"modify",details:{reference:"chosen_color"}});
  if(/\beach land you control becomes that type\b/.test(t))mk("set_referenced_type",{object:"land_type",operator:"modify",details:{reference:"chosen_type"}});
  if(/\bit'?s still an? [a-z][a-z '-]{1,50}\b/.test(t))mk("retain_characteristic",{object:"type_line",operator:"modify",details:{rawCharacteristic:clean(raw)}});
  if(/\bit isn'?t an? (?:artifact|creature|land|enchantment|planeswalker)\b/.test(t))mk("set_characteristics",{object:"type_line",operator:"modify",details:{operation:"remove_type",rawCharacteristic:clean(raw)}});
  if(/\bbecomes your choice of [+-]?\d+\/[+-]?\d+ or [+-]?\d+\/[+-]?\d+\b/.test(t))mk("set_power_toughness",{object:"power_toughness",operator:"modify",details:{choice:clean(raw)}});
  if(/\b(?:double|triple) target creature'?s power and toughness\b/.test(t))mk("modify_power_toughness",{object:"creature",operator:"modify",details:{operation:"multiply",factor:/\btriple\b/.test(t)?3:2}});
  if(/\bgets? twice -x\/-x\b/.test(t))mk("modify_power_toughness",{object:"creature",operator:"modify",details:{operation:"multiply_dynamic_modifier",factor:2,raw:clean(raw)}});
  if(/\ball instances of color words in the text of spells and permanents are changed to the chosen color word\b/.test(t))mk("modify_rules_text",{object:"color_words",operator:"modify",details:{replacement:"chosen_color_word"}});

  if(/\bhas all activated and triggered abilities of the last chosen card\b/.test(t))mk("copy_abilities",{object:"ability",operator:"modify",details:{source:"last_chosen_card"}});
  if(/\bhumans you control have each of the chosen abilities\b/.test(t))mk("grant_referenced_ability",{object:"ability",operator:"modify",details:{reference:"chosen_abilities",scope:"Humans you control"}});
  if(/\bit gains this card'?s other abilities\b/.test(t))mk("grant_referenced_ability",{object:"ability",operator:"modify",details:{reference:"source_other_abilities"}});
  if(/\b(?:they|it) gains? (decayed|skulk)\b/.test(t)){const km=t.match(/gains? (decayed|skulk)/);mk("grant_keyword",{object:"keyword",operator:"modify",details:{keyword:km?.[1]||null,scope:"referenced_object"}});}

  if(/\bthe amount you pay can'?t be more than\b/.test(t))mk("variable_payment_cap",{object:"cost",operator:"modify",details:{capFormula:clean(raw)}});
  if(/\bmay activate exhaust abilities as though they haven'?t been activated\b/.test(t))mk("activation_limit_override",{object:"exhaust_ability",operator:"permit",details:{scope:clean(raw)}});
  if(/\bthe player skips each instance of the chosen step or phase this turn\b/.test(t))mk("skip_phase",{object:"turn_phase",operator:"modify",details:{phase:"chosen",scope:clean(raw)}});
  if(/\bif target spell has only one target [^.]{0,100}change that spell'?s target to another creature\b/.test(t))mk("retarget",{object:"spell",operator:"modify",details:{constraint:"single_target_to_another_creature"}});
  if(/\bchange that spell'?s target to another creature\b/.test(t))mk("retarget",{object:"spell",operator:"modify",details:{constraint:"to_another_creature",reference:"previous_target_constraint"}});
  if(/\bcounter up to one target creature spell if [^.]{0,40}was spent to cast this spell\b/.test(t))mk("counter_spell",{object:"creature_spell",operator:"perform",requirements:predicate("mana_spent_condition",{raw:clean(raw)})});
  if(/\b(?:[a-z][a-z '’-]+|this equipment|this aura) can be attached only to\b/.test(t))mk("attachment_restriction",{object:"attachment",operator:"modify",details:{restriction:clean(raw)}});
  if(/\bonly creatures can be enchanted this way\b/.test(t))mk("attachment_restriction",{object:"aura_attachment",operator:"modify",details:{restriction:"creatures_only"}});
  if(/\bif you do, it enters attached to that creature\b/.test(t))mk("enter_attached",{object:"attachment",operator:"modify",target:entityRef("referenced_object")});
  if(/\bthe monarch controls enchanted creature\b/.test(t))mk("gain_control",{object:"creature",operator:"modify",actor:entityRef("monarch"),target:entityRef("enchanted_creature")});
  if(/\bthe new creature type can'?t be wall\b/.test(t))mk("type_choice_constraint",{object:"creature_type",operator:"prohibit",details:{excludedType:"Wall"}});
  if(/\battacking doesn'?t cause creatures you control to tap this combat\b/.test(t))mk("attack_without_tapping",{object:"combat_rule",operator:"modify"});
  if(/\bthere is an additional end step after this step\b/.test(t))mk("additional_end_step",{object:"end_step",operator:"modify"});
  if(/\bcreatures in each sector can be blocked this turn only by creatures in the same sector\b/.test(t))mk("block_restriction",{object:"combat_rule",operator:"modify",details:{restriction:"same_sector"}});
  if(/\bthis creature attacks a player you noted [^.]{0,80}each combat if able\b/.test(t))mk("must_attack",{object:"combat_requirement",operator:"modify",details:{target:"noted_player"}});
  if(/\bassign its combat damage to a creature defending player controls\b/.test(t))mk("modify_damage_assignment",{object:"combat_damage",operator:"modify",details:{rule:clean(raw)}});
  if(/\bthis effect doesn'?t affect combat damage that would be dealt by red creatures\b/.test(t))mk("effect_exception",{object:"combat_damage",operator:"modify",details:{exception:"red_creatures",raw:clean(raw)}});
  if(/^ignore this effect for each creature\b/.test(t))mk("effect_exception",{object:"previous_effect",operator:"modify",details:{scope:clean(raw)}});
  if(/^this effect doesn'?t remove auras(?: and equipment you control)?\b/.test(t))mk("attachment_preservation",{object:"attachment",operator:"modify",details:{scope:clean(raw)}});
  if(/^if this enchantment leaves the battlefield, this effect continues until end of turn\.?$/.test(t))mk("effect_duration",{object:"previous_effect",operator:"modify",details:{continuesAfterSourceLeaves:true,duration:"until_end_of_turn"}});

  if(/\btap the chosen permanents you don'?t control\b|\btap those creatures\b/.test(t))mk("tap",{object:/creatures/.test(t)?"creature":"permanent",operator:"perform",target:/chosen permanents/.test(t)?entityRef("chosen_permanents"):entityRef("referenced_collection")});
  if(/\bdouble the amount of each type of unspent mana you have\b/.test(t))mk("modify_mana_output",{object:"mana_pool",operator:"modify",details:{operation:"multiply",factor:2,scope:"each_type_unspent"}});
  if(/\byou get (?:x|that many) \{e\}(?:\b|[.,;]|$)/.test(t))mk("gain_energy",{object:"energy",operator:"perform",beneficiary:entityRef("you"),magnitude:{amount:/\bx\b/.test(t)?{kind:"variable",name:"X"}:{kind:"referenced_amount"}}});
  if(/\bincubates? x\b/.test(t))mk("incubate",{object:"incubator_token",operator:"perform",magnitude:{amount:{kind:"variable",name:"X"}}});
  if(/\bfateseal (?:x|\d+)\b/.test(t))mk("fateseal",{object:"library",operator:"perform"});
  if(/\b(?:open (?:one|two|three|\d+) attractions?|roll to visit your attractions)\b/.test(t))mk(/open /.test(t)?"open_attraction":"visit_attractions",{object:"attraction",operator:"perform"});
  if(/\bmay behold an? [a-z]+\b/.test(t))mk("behold",{object:"card_type_or_subtype",operator:"perform",details:{raw:clean(raw)}});
  if(/\b(?:lock or unlock|unlock) (?:(?:a|a locked) door of )?(?:up to one )?target room\b/.test(t))mk("modify_room_door",{object:"Room",operator:"modify",details:{raw:clean(raw)}});

  // Explicit option/result families that materially affect modality, costs or access.
  {const m=clean(raw).match(/^Craft with (.+?)\s+(\{[^\n]+\})$/i);if(m){
    const material=m[1].trim(),manaCost=m[2].trim();
    mk("craft",{object:"card",operator:"perform",requirements:predicate("craft_material",{raw:material}),details:{material,manaCost,stateTransition:true}});
    mk("additional_cost",{object:"cost",operator:"modify",details:{kind:"craft",manaCost,material}});
  }}
  {const m=clean(raw).match(/^•\s*([^—]+?)\s*—\s*(\{[^}]+\})\s*—\s*(\d+)\/(\d+)\.?$/);if(m){
    const optionName=m[1].trim(),additionalCost=m[2],power=Number(m[3]),toughness=Number(m[4]);
    mk("set_power_toughness",{object:"creature",operator:"modify",requirements:predicate("tiered_option_selected",{name:optionName}),details:{tieredOption:optionName,basePower:power,baseToughness:toughness,additionalCost}});
    mk("additional_cost",{object:"cost",operator:"modify",requirements:predicate("tiered_option_selected",{name:optionName}),details:{kind:"tiered",optionName,manaCost:additionalCost}});
  }}
  {const m=clean(raw).match(/^•\s*Target (artifact|creature|enchantment|land) card\.?$/i);if(m)mk("select_target_card",{object:"card",operator:"perform",target:entityRef("target_card"),details:{cardTypes:[m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()]}});}
  if(/^•\s*Target creature becomes unprepared\.?$/i.test(clean(raw)))mk("modify_prepared_state",{object:"creature",operator:"modify",target:entityRef("target_creature"),details:{prepared:false}});
  {const m=clean(raw).match(/^•\s*(\d+)\s*—\s*(menace|vigilance|lifelink|flying|indestructible|haste|deathtouch|first strike|double strike|trample|reach)(?:,\s*(menace|vigilance|lifelink|flying|indestructible|haste|deathtouch|first strike|double strike|trample|reach))?\.?$/i);if(m){
    for(const kw of [m[2],m[3]].filter(Boolean))mk("grant_keyword",{object:"keyword",operator:"modify",requirements:predicate("die_result",{value:Number(m[1])}),details:{keyword:kw.toLowerCase(),duration:"until_end_of_turn",resultMapping:true}});
  }}
  {const m=clean(raw).match(/^(\d+)(?:\s*[—-]\s*(\d+))?\s*\|\s*X is (one|two|three|four|five|six|seven|eight|nine|ten|\d+)\.?$/i);if(m)mk("set_variable",{object:"X",operator:"modify",requirements:predicate("die_result_range",{minimum:Number(m[1]),maximum:Number(m[2]||m[1])}),details:{variable:"X",value:num(m[3]),source:"die_result"}});}
  if(/\bif x is (?:four|4) or more, do all of the above\b/.test(t)||/^do all of the above\.?$/.test(t))mk("resolve_prior_effects",{object:"prior_effects",operator:"perform",requirements:predicate("variable_value",{variable:"X",comparison:"at_least",value:4}),details:{scope:"all_above"}});
  if(/\byou may roll again\b/.test(t))mk("reroll_dice",{object:"die_roll",operator:"permit",details:{scope:"previous_roll"}});
  {const m=t.match(/\broll x d(\d+)\b/);if(m)mk("roll_dice",{object:"die",operator:"perform",magnitude:{amount:{kind:"variable",name:"X"}},details:{sides:Number(m[1])}});}
  if(/\bharness (?:the |this )?[a-z0-9 '’.-]+\.?$/.test(t))mk("harness",{object:"source",operator:"modify",details:{state:"harnessed"}});
  if(/\bspace sculptor\b/.test(t)&&/\bdivides the battlefield into\b/.test(t))mk("partition_battlefield",{object:"battlefield",operator:"modify",details:{sectors:["alpha","beta","gamma"],raw:clean(raw)}});
  if(/\bseparates them into a face-down pile and a face-up pile\b/.test(t))mk("partition_cards",{object:"card",operator:"perform",actor:entityRef("target_opponent"),zones:{source:"library",destination:null,owner:entityRef("you")},details:{visibility:["face_down","face_up"],count:4}});
  if(/\beach one then blocks all creatures the other was blocking\b/.test(t))mk("reassign_blockers",{object:"combat_assignment",operator:"modify",details:{swapAssignments:true}});
  if(/\bassign each pile to a different one of those attacking creatures at random\b/.test(t))mk("assign_block_piles",{object:"combat_assignment",operator:"modify",details:{random:true}});
  if(/\beach creature in a pile that can block the creature that pile is assigned to does so\b/.test(t))mk("force_block_assignment",{object:"combat_assignment",operator:"modify",details:{fromAssignedPile:true}});
  if(/^you do the same with\b/.test(t))mk("repeat_previous_effect",{object:"previous_effect",operator:"perform",actor:entityRef("you"),details:{reference:"previous_clause",scope:clean(raw)}});
  if(/^then target opponent does the same\b/.test(t))mk("repeat_previous_effect",{object:"previous_effect",operator:"perform",actor:entityRef("target_opponent"),details:{reference:"previous_clause",scope:clean(raw)}});
  if(/^each opponent attacking that player does the same\b/.test(t))mk("repeat_previous_effect",{object:"previous_effect",operator:"perform",actor:entityRef("each_attacking_opponent"),details:{reference:"previous_clause",triggerParticipant:true}});
  if(/\bthey face that choice an additional time\b/.test(t))mk("repeat_choice",{object:"villainous_choice",operator:"replace",details:{additionalTimes:1}});
  if(/\bit isn'?t an equipment\b/.test(t))mk("modify_type",{object:"type_line",operator:"modify",details:{operation:"remove_subtype",subtype:"Equipment"}});
  if(/^effects from spells named [^.]+ count it as a card named [^.]+\.?$/i.test(clean(raw)))mk("name_alias",{object:"card_name",operator:"modify",zones:{source:"graveyard",destination:null,owner:null},details:{raw:clean(raw)}});
  if(/\btarget opponent guesses whether\b|\ban opponent guesses whether\b|\bthat player guesses whether\b/.test(t))mk("guess",{object:"hidden_information",operator:"perform",actor:/^target opponent/.test(t)?entityRef("target_opponent"):/^an opponent/.test(t)?entityRef("opponent"):entityRef("referenced_player"),details:{raw:clean(raw)}});
  if(/\bseparates all [^.]+ into (?:two|three) piles\b/.test(t))mk("partition_permanents",{object:"permanent",operator:"perform",details:{raw:clean(raw)}});
  if(/\bone of their piles is chosen\b/.test(t))mk("choose_pile",{object:"pile",operator:"perform",details:{raw:clean(raw)}});

  if(/\bif you would roll one or more (?:planar )?dice, instead roll that many (?:planar )?dice plus one and ignore (?:the lowest roll|one)\b/.test(t))mk("modify_dice_roll",{object:"dice_roll",operator:"replace",details:{extraDice:1,ignoreOne:true}});
  {const m=t.match(/\broll (one|two|three|four|five|six|seven|eight|nine|ten|\d+) six-sided dice and store those results\b/);if(m){
    mk("roll_dice",{object:"die",operator:"perform",magnitude:{amount:num(m[1])},details:{sides:6}});
    mk("store_roll_result",{object:"die_result",operator:"perform",details:{on:"source"}});
  }}
  if(/\bmay reroll any number of [^.]{0,80}stored results\b/.test(t))mk("reroll_dice",{object:"stored_die_result",operator:"permit",details:{quantity:"any_number",source:"stored_results"}});
  if(/\bif a rigger you control would assemble a contraption, it assembles two contraptions instead\b/.test(t))mk("modify_assemble",{object:"Contraption",operator:"replace",details:{factor:2}});
  if(/\bas [^.]{0,40}enters, you may exchange (?:his|her|its) text box and another creature'?s\b|\bexchange the text boxes of those creatures\b/.test(t))mk("exchange_rules_text",{object:"rules_text",operator:"modify"});
  if(/\bif this card is in a graveyard, effects from spells named [^.]+ count it as a card named [^.]+\b/.test(t))mk("name_alias",{object:"card_name",operator:"modify",zones:{source:"graveyard",destination:null,owner:null},details:{raw:clean(raw)}});
  if(/\bif an opponent would face a villainous choice, they face that choice an additional time\b/.test(t))mk("repeat_choice",{object:"villainous_choice",operator:"replace",details:{additionalTimes:1}});
  if(/\bif you do, increase or decrease the result by 1\b/.test(t))mk("modify_result",{object:"previous_result",operator:"modify",details:{deltaChoice:[-1,1]}});
  if(/\bif two or more cards are tied for greatest, the target or targets remain unchanged\b/.test(t))mk("retarget_tie_rule",{object:"target",operator:"modify",details:{rule:"unchanged_on_tie"}});
  if(/\bchanging targets this way doesn'?t trigger abilities\b/.test(t))mk("suppress_trigger",{object:"triggered_ability",operator:"prohibit",details:{scope:clean(raw)}});
  if(/\bif you lose a flip, [^.]+ has no effect\b/.test(t))mk("effect_failure_condition",{object:"spell_effect",operator:"modify",details:{condition:"lose_flip"}});
  if(/\bthis effect can'?t reduce their speed below 1\b/.test(t))mk("effect_floor_constraint",{object:"speed",operator:"modify",details:{floor:1}});
  if(/\breduce that opponent'?s speed by 1\b/.test(t))mk("modify_speed",{object:"speed",operator:"modify",target:entityRef("referenced_player"),magnitude:{amount:-1}});
  // Un-set ticket/sticker mechanics are still modeled as capabilities when Commander legality says legal.
  if(/\b(?:put|distribute) (?:up to (?:one|two|three|four|five|\d+) |a |an )?(?:name |art |power and toughness |ability |mana cost )?stickers?\b/.test(t))mk("put_sticker",{object:"sticker",details:{scope:clean(raw)}});
  if(/\bclaim the prize\b/.test(t))mk("claim_prize",{object:"attraction_prize",operator:"perform",details:{scope:clean(raw)}});
  if(/\byou get (?:\{tk\})+(?:\.|$)/.test(t))mk("gain_ticket",{object:"ticket",beneficiary:entityRef("you")});
  // Case solve text is a dependency requirement, not a produced game action.
  if(/^to solve\s*[—-]/.test(t)){const rule=clean(raw).replace(/^to solve\s*[—-]\s*/i,"");mk("case_solve_requirement",{object:"case",operator:"modify",requirements:predicate("case_solve",{raw:rule}),details:{rawRequirement:rule}});}
  // Standalone keyword lines can survive the legacy parser without a fact. Preserve them as intrinsic keyword potential.
  {const km=clean(raw).match(/^(Crew|Saddle|Disturb|Modular|Soulshift|Rampage|Poisonous|Afflict|Toxic|Ward|Backup|Blitz|Casualty|Convoke|Delve|Improvise|Offering|Ninjutsu|Cycling|Equip|Fortify|Suspend|Buyback|Kicker|Flashback|Escape|Emerge|Evoke|Foretell|Miracle|Plot|Scavenge|Dredge)(?:\s+(.+))?$/i);if(km)mk("has_keyword",{object:"keyword",details:{keyword:km[1],parameter:km[2]||null}});}
  // Explicit sacrifice/discard even when legacy structure could not bind the object/reference.
  if(/\bsacrifice(?:s|d)?\b/.test(t))mk("sacrifice",{object:/creature/.test(t)?"creature":"permanent"});
  if(/\bdiscard(?:s|ed)?\b/.test(t))mk("discard",{object:"card"});
  if(!recovered.length)return [cap];
  return recovered;
}

function recoverUnparsedCapabilities(capabilities){return capabilities.flatMap(recoverUnparsedCapability);}


function isPureKeywordReminder(rawText,keywords=[]){
  const raw=clean(rawText);if(!raw||!raw.endsWith(")")||!raw.includes("("))return false;
  const head=raw.slice(0,raw.indexOf("(")).trim().toLowerCase();
  return (keywords||[]).some(k=>{const q=lower(k);return head===q||head.startsWith(`${q} `)||head.startsWith(`${q}—`)||head.startsWith(`${q} —`);});
}

function intrinsicKeywordCapabilities(faces,keywords=[]){
  const out=[];let n=0;
  for(const keyword of uniq(keywords)){
    const q=lower(keyword);let targets=faces.filter(f=>lower(f.oracleText).includes(q));if(!targets.length)targets=faces.slice(0,1);
    for(const face of targets)out.push({
      id:`${face.id}:intrinsic:keyword-${n++}`,faceId:face.id,abilityId:null,operator:"perform",action:"has_keyword",object:"keyword",
      actor:entityRef("source"),target:null,beneficiary:entityRef("source_controller"),zones:{source:null,destination:null,owner:null},event:null,trigger:"intrinsic",
      requirements:face.access?.requirements||logicTrue(),conditions:logicTrue(),costs:[],magnitude:null,frequency:"continuous",timing:null,polarity:"neutral",resources:[],
      coverage:COVERAGE.SUPPORTED,confidence:1,gaps:[],details:{keyword},source:{faceIndex:face.index,abilityIndex:null,rawAbilityText:"",rawText:keyword,secondary:false,synthetic:"keyword_metadata"}
    });
  }
  return out;
}

function intrinsicFaceCapabilities(faces){
  const out=[];
  for(const face of faces){
    const types=new Set(face.cardTypes||[]);const access=face.access||{};
    const playableFromHand=["default","alternative_entry"].includes(access.kind);
    const base={faceId:face.id,abilityId:null,operator:"perform",actor:entityRef("you"),target:null,beneficiary:entityRef("you"),zones:{source:"hand",destination:null,owner:entityRef("you")},event:null,trigger:"intrinsic",requirements:access.requirements||logicTrue(),conditions:logicTrue(),costs:[],magnitude:null,frequency:"once_per_card_use",timing:null,polarity:"neutral",resources:[],coverage:COVERAGE.SUPPORTED,confidence:1,gaps:[],details:{cardTypes:[...(face.cardTypes||[])],subtypes:[...(face.subtypes||[])]}};
    if(types.has("Land")){
      out.push({...base,id:`${face.id}:intrinsic:land-state`,action:"be_land",object:"land",source:{faceIndex:face.index,abilityIndex:null,rawAbilityText:"",rawText:face.typeLine,secondary:false,synthetic:"face_type"}});
      if(playableFromHand)out.push({...base,id:`${face.id}:intrinsic:play-land`,action:"play_as_land",object:"land",zones:{...base.zones,destination:"battlefield"},source:{faceIndex:face.index,abilityIndex:null,rawAbilityText:"",rawText:face.typeLine,secondary:false,synthetic:"face_entry"}});
    }else if(playableFromHand){
      out.push({...base,id:`${face.id}:intrinsic:cast-face`,action:"cast_face",object:"spell",zones:{...base.zones,destination:"stack"},details:{...base.details,manaCost:face.manaCost,manaValue:face.manaValue},source:{faceIndex:face.index,abilityIndex:null,rawAbilityText:"",rawText:face.typeLine,secondary:false,synthetic:"face_entry"}});
    }else{
      out.push({...base,id:`${face.id}:intrinsic:state-type`,action:"be_face_state",object:"card_face",zones:{source:null,destination:null,owner:entityRef("you")},source:{faceIndex:face.index,abilityIndex:null,rawAbilityText:"",rawText:face.typeLine,secondary:false,synthetic:"face_state"}});
    }
  }
  return out;
}

function replacementResultCaps(capabilities){
  const extra=[];
  for(const cap of capabilities){
    const raw=cap.source.rawText,t=lower(raw),evt=replacementEvent(raw);if(!evt)continue;
    // When the replacement result itself performs the same verb ("draw four cards instead"),
    // keep both semantics: replacement of the original event + real resulting action.
    if(evt==="draw"&&cap.action==="draw"&&cap.operator==="replace"){
      const after=(t.split("instead").pop()||"");
      const beforeInstead=t.slice(0,t.lastIndexOf("instead"));
      const resultDraw=/\b(?:you|they|that player|target player) draw(?:s)?\b[^.]{0,40}\binstead\b/.test(beforeInstead)||/\binstead[^.]{0,80}\bdraw\b/.test(t)||/\bthen draw\b/.test(t);
      // If the only occurrence is the replaced event ("would draw ... instead X"), do not add positive draw.
      const explicitResult=/\b(?:you|they|that player|target player) draw(?:s)? (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x)\b[^.]{0,50}\binstead/.test(t)||/\bthen draw (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x)\b/.test(t);
      if(resultDraw&&explicitResult)extra.push({...cap,id:`${cap.id}:replacement-result`,operator:"perform",requirements:and(cap.requirements,predicate("replacement_event_available",{event:"draw"})),details:{...cap.details,replacementResult:true},source:{...cap.source,synthetic:"replacement_result"}});
    }
  }
  return extra;
}

function replacementControlCaps(capabilities){
  const extra=[];
  for(const cap of capabilities){
    const evt=replacementEvent(cap.source.rawText);if(!evt)continue;
    const already=cap.operator==="replace"&&cap.action===evt;
    if(already)continue;
    extra.push({
      ...cap,id:`${cap.id}:replacement`,operator:"replace",action:evt,object:"event",resources:[],magnitude:null,
      actor:refFrom(null,cap.source.rawText,"actor")||entityRef("you"),target:null,beneficiary:null,
      details:{replacementResultCapabilityId:cap.id},confidence:Math.min(1,Math.max(.85,cap.confidence)),
      source:{...cap.source,synthetic:"replacement_control"}
    });
  }
  return extra;
}

function prohibitedMentionCaps(legacy,capabilities){
  const extra=[];
  for(const face of legacy.faces||[])for(const ability of face.abilities||[]){
    const raw=ability.rawText||"",t=lower(raw);
    if(!/\b(?:can't|cannot|may not)\b/.test(t))continue;
    if(capabilities.some(c=>c.source.faceIndex===face.index&&c.source.abilityIndex===ability.index&&c.operator==="prohibit"))continue;
    let action=null;
    if(/gain life/.test(t))action="gain_life";else if(/be countered/.test(t))action="counter_spell";else if(/attack/.test(t))action="attack";else if(/block/.test(t))action="block";else if(/cast/.test(t))action="cast_spell";
    if(!action)continue;
    extra.push({id:`face-${face.index}:ability-${ability.index}:prohibition`,faceId:`face-${face.index}`,abilityId:`face-${face.index}:ability-${ability.index}`,operator:"prohibit",action,object:null,
      actor:/opponents?/.test(t)?entityRef("each_opponent"):entityRef("symbolic",{value:"subject"}),target:null,beneficiary:null,zones:{source:null,destination:null,owner:null},event:null,trigger:ability.kind,
      requirements:logicTrue(),conditions:logicTrue(),costs:[],magnitude:null,frequency:null,timing:null,polarity:"restrictive",resources:[],coverage:COVERAGE.SUPPORTED,confidence:.95,
      source:{faceIndex:face.index,abilityIndex:ability.index,rawAbilityText:raw,rawText:raw,secondary:false,synthetic:"prohibition"},gaps:[],details:{}});
  }
  return extra;
}


function referenceMentions(rawText){
  const t=lower(rawText), out=[];const add=(expression,kind,role="object",extra={})=>out.push({expression,kind,role,...extra});
  if(/\bthat player\b/.test(t))add("that player","referenced_player","player",{bindingHint:"event_or_previous_player"});
  if(/\bthat card\b/.test(t))add("that card","referenced_object","object",{objectType:"card"});
  if(/\bthose cards\b/.test(t))add("those cards","referenced_collection","object",{objectType:"card",plural:true});
  if(/\bamong them\b/.test(t))add("them","referenced_collection","object",{plural:true,bindingHint:"previous_collection"});
  else if(/\bthem\b/.test(t))add("them","referenced_collection","object",{plural:true});
  if(/\bthat spell\b/.test(t))add("that spell","referenced_object","object",{objectType:"spell"});
  if(/\bthat creature\b/.test(t))add("that creature","referenced_object","object",{objectType:"creature"});
  if(/\bthat permanent\b/.test(t))add("that permanent","referenced_object","object",{objectType:"permanent"});
  if(/\bthose permanents\b/.test(t))add("those permanents","referenced_collection","object",{objectType:"permanent",plural:true});
  if(/\b\bit\b/.test(t)&&!/\b(?:split|limit)\b/.test(t))add("it","referenced_object","object",{bindingHint:"nearest_referent"});
  if(/\bthis way\b/.test(t))add("this way","referenced_event","event",{bindingHint:"previous_result"});
  if(/\bthat many\b/.test(t))add("that many","referenced_amount","amount",{bindingHint:"previous_amount"});
  if(/\bits owner'?s?\b/.test(t))add("its owner","referenced_controller_relation","owner",{bindingHint:"referenced_object.owner"});
  if(/\bits controller\b/.test(t))add("its controller","referenced_controller_relation","controller",{bindingHint:"referenced_object.controller"});
  return out;
}

const REFERENT_PRODUCERS=new Set([
  "search_library","search","reveal","look_library","look_at","mill","discard","exile","draw","create_token","create",
  "counter_spell","counter_ability","deal_damage","destroy","sacrifice","cast_spell","cast_face","play_card","move_card","put_land_battlefield"
]);
function referenceCompatible(ref,cap){
  if(!cap)return false;const a=cap.action,o=String(cap.object||"").toLowerCase();
  if(ref.kind==="referenced_player")return [cap.actor?.kind,cap.target?.kind,cap.beneficiary?.kind].some(x=>x&&/player|opponent/.test(x))||/player|opponent/.test(o);
  if(ref.kind==="referenced_amount")return !!cap.magnitude||cap.resources?.some(r=>r.amount!==null&&r.amount!==undefined);
  if(ref.kind==="referenced_event")return true;
  if(!REFERENT_PRODUCERS.has(a)&&!/_referenced$/.test(a))return false;
  if(ref.objectType==="spell")return /spell/.test(o)||/spell|cast|counter/.test(a);
  if(ref.objectType==="creature")return /creature/.test(o)||["deal_damage","destroy","sacrifice","fight"].includes(a);
  if(ref.objectType==="permanent")return /permanent|creature|artifact|enchantment|land|planeswalker/.test(o)||["destroy","exile","return","tap","untap"].includes(a);
  if(ref.objectType==="card")return /card|library|hand|graveyard/.test(o)||["search_library","search","reveal","look_library","look_at","mill","discard","draw","exile"].includes(a);
  return true;
}

function bindCapabilityReferences(capabilities){
  const byAbility=new Map();
  for(const cap of capabilities){const key=cap.abilityId||`${cap.faceId}:none`;if(!byAbility.has(key))byAbility.set(key,[]);byAbility.get(key).push(cap);}
  for(const xs of byAbility.values()){
    xs.sort((a,b)=>(a.source?.clauseIndex??0)-(b.source?.clauseIndex??0)||String(a.id).localeCompare(String(b.id)));
    for(let i=0;i<xs.length;i++){
      const cap=xs[i];
      const hadReferenceGap=(cap.gaps||[]).includes("REFERENCE_RESOLUTION_REQUIRED");
      const hasExplicitPlayerRef=[cap.actor?.kind,cap.target?.kind,cap.beneficiary?.kind].includes("referenced_player");
      if(!hadReferenceGap&&!hasExplicitPlayerRef)continue;
      const refs=referenceMentions(cap.source?.rawText||"");if(!refs.length){
        if(hadReferenceGap)cap.gaps=cap.gaps.filter(g=>g!=="REFERENCE_RESOLUTION_REQUIRED");
        continue;
      }
      const bound=[];
      for(const ref of refs){
        if(ref.kind==="referenced_player"&&[cap.actor?.kind,cap.target?.kind,cap.beneficiary?.kind].includes("referenced_player")){
          bound.push({...ref,binding:"event_or_previous_player"});continue;
        }
        let antecedent=null;
        for(let j=i-1;j>=0;j--){if(referenceCompatible(ref,xs[j])){antecedent=xs[j];break;}}
        // Same-clause parser facts may be ordered after a secondary action; scan siblings as a fallback.
        if(!antecedent)for(let j=0;j<xs.length;j++){if(j!==i&&(xs[j].source?.clauseIndex??0)===(cap.source?.clauseIndex??0)&&referenceCompatible(ref,xs[j])){antecedent=xs[j];break;}}
        bound.push({...ref,binding:antecedent?"capability":"symbolic",antecedentCapabilityId:antecedent?.id||null});
      }
      cap.references=bound;
      const unresolved=bound.some(r=>r.binding==="symbolic");
      cap.gaps=(cap.gaps||[]).filter(g=>g!=="REFERENCE_RESOLUTION_REQUIRED");
      if(unresolved)cap.gaps=uniq(cap.gaps.concat("REFERENCE_ANTECEDENT_SYMBOLIC"));
      if(cap.coverage===COVERAGE.PARTIAL&&!cap.gaps.length&&!cap.details?.recoveredFromUnparsed)cap.coverage=COVERAGE.SUPPORTED;
      // When the action itself operates on a referenced object and no target was retained, keep the reference explicit.
      const objectRef=bound.find(r=>["referenced_object","referenced_collection"].includes(r.kind));
      if(objectRef&&!cap.target&&(/_referenced$/.test(cap.action)||["return","exile","move_card","copy","cast_referenced_cards","play_referenced_card","put_referenced_battlefield"].includes(cap.action))){
        cap.target=entityRef(objectRef.kind,{expression:objectRef.expression,antecedentCapabilityId:objectRef.antecedentCapabilityId||null,plural:!!objectRef.plural});
      }
    }
  }
  return capabilities;
}



function stripChapterPrefix(text){return clean(text).replace(/^(?:[IVX]+(?:\s*,\s*[IVX]+)*|[+−-]\s*\d+)\s*—\s*/i,"");}
function structuredTriggerRequirement(triggerText){
  const t=lower(triggerText||"");if(!t)return null;
  if(/\b(?:a|another|one or more|one or more of your|one of your|your) tokens? enters? (?:the battlefield|under your control)\b|\btokens? (?:you control )?enter(?:s)? the battlefield\b/.test(t))return predicate("event_occurred","token_created");
  if(/\b(?:a|another|one or more|one of your|your) creatures? enters? the battlefield\b|\bcreatures? (?:you control )?enter(?:s)? the battlefield\b/.test(t))return predicate("card_characteristic","creature");
  if(/\b(?:an?|another|one or more|one of your|your) artifacts? enters? the battlefield\b|\bartifacts? (?:you control )?enter(?:s)? the battlefield\b/.test(t))return predicate("card_characteristic","artifact");
  if(/\b(?:an?|another|one or more|one of your|your) enchantments? enters? the battlefield\b|\benchantments? (?:you control )?enter(?:s)? the battlefield\b/.test(t))return predicate("card_characteristic","enchantment");
  if(/\b(?:a|another|one or more|one of your|your) lands? enters? the battlefield\b|\blands? (?:you control )?enter(?:s)? the battlefield\b/.test(t))return predicate("card_characteristic","land");
  if(/\bcreatures? (?:you control )?dies?\b|\b(?:a|another|one or more|one of your|your) creatures? dies?\b/.test(t))return predicate("event_occurred","creature_death");
  if(/\byou gain life\b/.test(t))return predicate("event_occurred","life_gain");
  if(/\byou discard (?:a|one or more) cards?\b/.test(t))return predicate("event_occurred","discard");
  if(/\byou cast (?:an? )?(?:instant or sorcery|instant and sorcery) spell\b/.test(t))return predicate("card_characteristic","instant_sorcery");
  return null;
}
function logicHasPredicate(expr,p){
  if(!expr||typeof expr!=="object")return false;if(expr.op==="predicate")return expr.kind===p.kind&&JSON.stringify(expr.value)===JSON.stringify(p.value);
  if(expr.op==="not")return logicHasPredicate(expr.arg,p);return (Array.isArray(expr.args)?expr.args:[]).some(x=>logicHasPredicate(x,p));
}
function annotateStructuredTriggerDependencies(capabilities,legacy){
  for(const face of legacy.faces||[])for(const ability of face.abilities||[]){
    const ctx=splitAbilityContext(ability.rawText||"");if(!ctx.triggerText)continue;const req=structuredTriggerRequirement(ctx.triggerText);if(!req)continue;
    for(const cap of capabilities){
      if(cap.source?.faceIndex!==face.index||cap.source?.abilityIndex!==ability.index)continue;
      if(["cast_face","play_as_land","be_face_state","be_land","has_keyword"].includes(cap.action))continue;
      if(!logicHasPredicate(cap.requirements,req))cap.requirements=and(req,cap.requirements);
    }
  }
}

function splitAbilityContext(rawText){
  let text=stripChapterPrefix(rawText), triggerText=null, conditionText=null, activationPrefix=null;
  // Activated/loyalty costs are context, not part of the effect body.
  const colon=text.indexOf(":");
  if(colon>0&&/\{|\}|\b(?:sacrifice|discard|pay|tap|remove|exile)\b|^[+−-]\s*\d+/i.test(text.slice(0,colon))){activationPrefix=text.slice(0,colon).trim();text=text.slice(colon+1).trim();}
  const peel=()=>{
    let m=text.match(/^(Whenever|When)\s+(.+?),\s*(.+)$/i);
    if(m){triggerText=`${m[1]} ${m[2]}`;text=m[3].trim();return true;}
    m=text.match(/^(At the beginning of|At the end of)\s+(.+?),\s*(.+)$/i);
    if(m){triggerText=`${m[1]} ${m[2]}`;text=m[3].trim();return true;}
    // A would/instead sentence is a replacement rule, not an ordinary conditional antecedent.
    if(!/\bwould\b[^.]*\binstead\b/i.test(text)){
      m=text.match(/^(?:Then\s+)?If\s+(.+?),\s*(.+)$/i);if(m){conditionText=m[1].trim();text=m[2].trim();return true;}
      m=text.match(/^As long as\s+(.+?),\s*(.+)$/i);if(m){conditionText=m[1].trim();text=m[2].trim();return true;}
    }
    return false;
  };
  // Trigger can be followed by an explicit if-clause.
  peel();peel();
  return {raw:clean(rawText),body:text,triggerText,conditionText,activationPrefix};
}

const ACTION_MENTION={
  draw:/\bdraw\b/i,deal_damage:/\b(?:deal|deals|dealt)\b[^.]{0,50}\bdamage\b/i,discard:/\bdiscard\b/i,mill:/\bmill\b/i,
  sacrifice:/\bsacrifice\b/i,destroy:/\bdestroy\b/i,exile:/\bexile\b/i,return:/\breturn\b/i,add_mana:/\badd\b[^.]{0,50}\bmana\b/i,
  gain_life:/\bgain(?:s)?\b[^.]{0,40}\blife\b/i,lose_life:/\blose(?:s)?\b[^.]{0,40}\blife\b/i,cast_spell:/\bcast\b/i,
  counter_spell:/\bcounter\b[^.]{0,50}\bspell\b/i,counter_ability:/\bcounter\b[^.]{0,50}\babilit/i,create_token:/\bcreate\b[^.]{0,80}\btoken\b/i,
  tap:/\btap\b/i,untap:/\buntap\b/i,gain_control:/\bgain control\b/i,fight:/\bfight\b/i
};
function antecedentOnlyLegacyCapability(cap){
  if(cap.source?.synthetic||!cap.source?.rawText)return false;
  const ctx=splitAbilityContext(cap.source.rawText);if(!ctx.triggerText||ctx.body===ctx.raw)return false;
  const re=ACTION_MENTION[cap.action];if(!re)return false;
  return re.test(ctx.triggerText)&&!re.test(ctx.body);
}

function directEffectCapabilities(raw,legacy,existingCapabilities=[]){
  const out=[];let serial=0;
  for(const face of legacy.faces||[])for(const ability of face.abilities||[]){
    const abilityRaw=clean(ability.rawText||"");
    // Parenthetical land-type reminder text and keyword reminder text are not
    // independent abilities. Re-parsing them creates phantom mana/draw facts.
    if((abilityRaw.startsWith("(")&&abilityRaw.endsWith(")"))||isPureKeywordReminder(abilityRaw,legacy.keywords))continue;
    const ctx=splitAbilityContext(abilityRaw);
    // This pass exists specifically to separate antecedent trigger/condition
    // from its consequent. Activated costs are already modeled by the primary
    // compiler and must not cause the effect to be parsed a second time.
    if(!ctx.triggerText&&!ctx.conditionText)continue;
    if(!ctx.body||ctx.body===abilityRaw)continue;
    // Reparse only the effect consequent. This prevents trigger events from masquerading as produced effects.
    const synthetic={oracle_id:`${legacy.oracleId}:effect:${face.index}:${ability.index}`,name:`${legacy.name} effect`,layout:"normal",type_line:"Ability",oracle_text:ctx.body,mana_cost:"",cmc:0,color_identity:legacy.colorIdentity||[],legalities:{commander:"legal"}};
    const parsed=compileLegacyCard(synthetic,{source:"semantic-v2-direct-effect"});
    let local=[];
    for(const entry of semanticFacts(parsed,{includeEmbedded:false})){
      const c=capabilityFromFact(entry,serial++);if(!c)continue;local.push(c);
    }
    local=recoverUnparsedCapabilities(local);
    // The legacy parser often already captured the consequent correctly. The
    // direct-effect pass exists to recover effects that were lost because a
    // trigger/condition was mistaken for the produced action, not to emit a
    // second copy of every correctly parsed effect in a triggered ability.
    const alreadyKnown=new Set(existingCapabilities
      .filter(c=>c.source?.faceIndex===face.index&&c.source?.abilityIndex===ability.index)
      .map(c=>`${c.operator}|${c.action}`));
    local=local.filter(c=>!alreadyKnown.has(`${c.operator}|${c.action}`));
    for(let i=0;i<local.length;i++){
      const c=local[i];c.id=`face-${face.index}:ability-${ability.index}:direct-${i}`;c.faceId=`face-${face.index}`;c.abilityId=`face-${face.index}:ability-${ability.index}`;
      const contextPreds=[];const structuredTrigger=ctx.triggerText?structuredTriggerRequirement(ctx.triggerText):null;
      if(structuredTrigger)c.requirements=and(structuredTrigger,c.requirements);else if(ctx.triggerText)contextPreds.push(predicate("trigger_event",{raw:ctx.triggerText}));
      if(ctx.conditionText)contextPreds.push(predicate("condition",{raw:ctx.conditionText}));
      c.conditions=and(...contextPreds,c.conditions);c.source={...c.source,faceIndex:face.index,abilityIndex:ability.index,rawAbilityText:ability.rawText,rawText:ctx.body,synthetic:"direct_effect_parse",context:{triggerText:ctx.triggerText,conditionText:ctx.conditionText,activationPrefix:ctx.activationPrefix}};
      c.details={...(c.details||{}),directEffectParse:true};out.push(c);
    }
  }
  return out;
}

function retireSupersededUnparsed(capabilities){
  const byAbility=new Map();
  for(const c of capabilities){const key=c.abilityId||`${c.faceId}:none`;if(!byAbility.has(key))byAbility.set(key,[]);byAbility.get(key).push(c);}
  const keep=[];
  for(const cap of capabilities){
    if(cap.action!=="unparsed_clause"){keep.push(cap);continue;}
    const peers=byAbility.get(cap.abilityId)||[];
    const raw=clean(cap.source?.rawText||""),t=lower(raw);
    if(raw.length<=3&&/^[\]\['".,;:!?-]+$/.test(raw))continue;
    // A structured replacement control fully supersedes an unparsed
    // "would ... instead" shell; result actions remain separate capabilities.
    if(replacementEvent(raw)&&peers.some(p=>p!==cap&&p.operator==="replace"&&p.action===replacementEvent(raw))){continue;}
    const structured=peers.filter(p=>p!==cap&&p.action!=="unparsed_clause");
    if(structured.length){
      const mentioned=Object.entries(ACTION_MENTION).filter(([,re])=>re.test(raw)).map(([a])=>a);
      const structuredActions=new Set(structured.map(x=>x.action));
      const ctx=splitAbilityContext(raw),directPeers=structured.filter(p=>p.source?.synthetic==="direct_effect_parse"),directHasGap=peers.some(p=>p.source?.synthetic==="direct_effect_parse"&&p.action==="unparsed_clause");
      const wholeTriggerCovered=ctx.body!==ctx.raw&&!!ctx.triggerText&&directPeers.length>0&&!directHasGap;
      const triggerFragment=/^(?:whenever|when|at the beginning of|at the end of)\b/i.test(raw)&&mentioned.length===0;
      const effectsCovered=mentioned.length>0&&mentioned.every(a=>structuredActions.has(a));
      if(wholeTriggerCovered||triggerFragment||effectsCovered)continue;
    }
    keep.push(cap);
  }
  return keep;
}

function embeddedGrantedCapabilities(raw,legacy,capabilities){
  const nested=[],links=[];let serial=0;
  for(const face of legacy.faces||[])for(const ability of face.abilities||[]){
    const peers=capabilities.filter(c=>c.source?.faceIndex===face.index&&c.source?.abilityIndex===ability.index);
    if(!peers.some(c=>(c.gaps||[]).includes("EMBEDDED_GRANTED_RULES")))continue;
    const original=String(ability.rawText||"");
    const quoted=[...original.matchAll(/"([^"]{3,})"/g)].map(m=>m[1].trim()).filter(Boolean);
    if(!quoted.length)continue;
    const grantParent=peers.find(c=>c.action==="grant_ability")||peers.find(c=>["create_token","copy_permanent","investigate","incubate","amass"].includes(c.action))||peers[0];
    if(!grantParent)continue;
    let parsedAny=false;
    for(let qi=0;qi<quoted.length;qi++){
      const rule=quoted[qi];
      // Only parse quoted text as rules when it contains clear rules syntax; quoted names/flavor stay metadata.
      if(!/[{}:]|\b(?:when|whenever|at the beginning|you|target|add|draw|gain|lose|sacrifice|exile|destroy|counter|create|put|gets?|has|have|can\'t|may|cast|play|tap|untap)\b/i.test(rule))continue;
      const synthetic={oracle_id:`${legacy.oracleId}:embedded:${face.index}:${ability.index}:${qi}`,name:`${legacy.name} embedded rule`,layout:"normal",type_line:"Ability",oracle_text:rule,mana_cost:"",cmc:0,color_identity:legacy.colorIdentity||[],legalities:{commander:"legal"}};
      const parsed=compileLegacyCard(synthetic,{source:"semantic-v2-embedded-rule"});
      let local=0;
      for(const entry of semanticFacts(parsed,{includeEmbedded:false})){
        const c=capabilityFromFact(entry,serial++);if(!c)continue;
        c.id=`${grantParent.id}:embedded-${qi}-${local++}`;
        c.faceId=grantParent.faceId;c.abilityId=grantParent.abilityId;
        c.access={kind:"granted",viaCapabilityId:grantParent.id,host:grantParent.object||null};
        c.requirements=and(predicate("granted_capability_active",{viaCapabilityId:grantParent.id}),c.requirements);
        c.source={...c.source,faceIndex:face.index,abilityIndex:ability.index,rawAbilityText:original,embeddedRawText:rule,synthetic:"embedded_granted_rule"};
        c.details={...(c.details||{}),embeddedGrantedRule:true,grantSourceCapabilityId:grantParent.id};
        nested.push(c);links.push({parentId:grantParent.id,childId:c.id,type:grantParent.action==="grant_ability"?"grants":"creates_with"});parsedAny=true;
      }
    }
    if(parsedAny)for(const c of peers){c.gaps=(c.gaps||[]).filter(g=>g!=="EMBEDDED_GRANTED_RULES");if(c.coverage===COVERAGE.PARTIAL&&!c.gaps.length&&!c.details?.recoveredFromUnparsed)c.coverage=COVERAGE.SUPPORTED;}
  }
  return {nested,links};
}

function buildRelations(faces,capabilities,optionGroups,embeddedLinks=[]){
  const relations=[];let n=0;const add=r=>relations.push({id:`rel-${n++}`,...r});
  // Sequential/state access is explicit even when the transformation effect itself is parsed separately.
  for(const face of faces)if(face.access?.kind==="state_transition")add({type:"state_transition",fromFaceId:face.access.fromFace,toFaceId:face.id,details:{requirements:face.access.requirements}});
  // Choice membership creates graph edges without removing any option's potential.
  for(const group of optionGroups)for(const opt of group.options||[])for(const cid of opt.capabilityIds||[])add({type:"choice_contains",fromGroupId:group.id,toCapabilityId:cid,details:{policy:group.policy,selection:group.selection}});
  const capIds=new Set(capabilities.map(c=>c.id));
  for(const link of embeddedLinks)if(capIds.has(link.parentId)&&capIds.has(link.childId))add({type:link.type,fromCapabilityId:link.parentId,toCapabilityId:link.childId});
  // Clause ordering: "Then" is sequence; "If you do" depends on a prior capability in the same ability.
  const byAbility=new Map();
  for(const cap of capabilities){if(cap.source?.synthetic)continue;const key=`${cap.source.faceIndex}:${cap.source.abilityIndex}`;if(!byAbility.has(key))byAbility.set(key,[]);byAbility.get(key).push(cap);}
  for(const xs of byAbility.values()){
    xs.sort((a,b)=>(a.source.clauseIndex??0)-(b.source.clauseIndex??0));
    for(let i=1;i<xs.length;i++){
      const cur=xs[i],prev=xs[i-1],t=lower(cur.source.rawText);
      if(/^then\b/.test(t))add({type:"sequence",fromCapabilityId:prev.id,toCapabilityId:cur.id});
      if(/^if you do\b|^if they do\b|^if that player does\b/.test(t))add({type:"requires_previous",fromCapabilityId:prev.id,toCapabilityId:cur.id});
    }
  }
  // Replacement controls point at their result capability when one is known.
  for(const cap of capabilities){const rid=cap.details?.replacementResultCapabilityId;if(cap.operator==="replace"&&rid&&capabilities.some(x=>x.id===rid))add({type:"replaces",fromCapabilityId:cap.id,toCapabilityId:rid});}
  for(const cap of capabilities)if(cap.source?.synthetic==="replacement_result"){
    const base=cap.id.replace(/:replacement-result$/,'');if(capabilities.some(x=>x.id===base))add({type:"result_of",fromCapabilityId:cap.id,toCapabilityId:base});
  }
  // Explicit references stay visible as graph relations instead of being silently assigned.
  for(const cap of capabilities){
    for(const [role,ref] of [["actor",cap.actor],["target",cap.target],["beneficiary",cap.beneficiary]])if(ref?.kind==="referenced_player")add({type:"reference",fromCapabilityId:cap.id,details:{role,antecedent:ref.antecedent||null}});
    for(const ref of cap.references||[])add({type:"reference",fromCapabilityId:cap.id,toCapabilityId:ref.antecedentCapabilityId||undefined,details:{role:ref.role,expression:ref.expression,kind:ref.kind,binding:ref.binding}});
  }
  return relations;
}

function normalizePrintedSubtypes(typeLine,subtypes=[]){
  const line=String(typeLine||"");if(!line.includes("—"))return [...(subtypes||[])];
  let right=line.split("—").slice(1).join("—").trim();
  const placeholders=new Map();MULTIWORD_PRINTED_SUBTYPES.forEach((st,i)=>{const token=`__MW${i}__`;if(right.includes(st)){right=right.replaceAll(st,token);placeholders.set(token,st);}});
  const parsed=right.split(/\s+/).filter(Boolean).map(x=>placeholders.get(x)||x);
  return parsed.length?parsed:[...(subtypes||[])];
}

export function compileCardV5(raw,{source="scryfall-oracle-cards"}={}){
  const legacy=compileLegacyCard(raw,{source:`${source}:legacy-parser-v4`});
  const faces=(legacy.faces||[]).map(f=>({
    id:`face-${f.index}`,index:f.index,name:f.name,typeLine:f.typeLine,cardTypes:f.cardTypes,subtypes:normalizePrintedSubtypes(f.typeLine,f.subtypes),manaCost:f.manaCost,manaValue:f.manaValue,oracleText:f.oracleText,
    access:null,coverage:f.status,gaps:f.unsupportedPatterns||[],abilities:(f.abilities||[]).map(a=>({id:`face-${f.index}:ability-${a.index}`,index:a.index,kind:a.kind,rawText:a.rawText,coverage:a.status}))
  }));
  for(const face of faces)face.access=faceAccess(legacy.layout,face.index,faces);
  let idx=0;const capabilities=[];
  for(const entry of semanticFacts(legacy,{includeEmbedded:false})){
    if(isPureKeywordReminder(entry.ability?.rawText,legacy.keywords))continue;
    const c=capabilityFromFact(entry,idx++);if(c)capabilities.push(c);
  }
  const primaryCaps=capabilities.filter(c=>!antecedentOnlyLegacyCapability(c));
  const recoveredCaps=recoverUnparsedCapabilities(primaryCaps);
  capabilities.length=0;capabilities.push(...recoveredCaps);
  capabilities.push(...directEffectCapabilities(raw,legacy,capabilities));
  capabilities.push(...intrinsicFaceCapabilities(faces));
  capabilities.push(...intrinsicKeywordCapabilities(faces,legacy.keywords));
  capabilities.push(...replacementResultCaps(capabilities));
  capabilities.push(...replacementControlCaps(capabilities));
  capabilities.push(...prohibitedMentionCaps(legacy,capabilities));
  {const retired=retireSupersededUnparsed(capabilities);capabilities.length=0;capabilities.push(...retired);}
  const embedded=embeddedGrantedCapabilities(raw,legacy,capabilities);
  capabilities.push(...embedded.nested);
  const recoveredAfterEmbedding=recoverUnparsedCapabilities(capabilities);
  capabilities.length=0;capabilities.push(...recoveredAfterEmbedding);
  {const retired=retireSupersededUnparsed(capabilities);capabilities.length=0;capabilities.push(...retired);}
  // Deduplicate synthetic control facts that normalize to the same ability/operator/action.
  const seen=new Map(),alias=new Map(),dedup=[];
  for(const c of capabilities){
    const key=[c.faceId,c.abilityId,c.operator,c.action,c.source.rawText,c.source.secondary].join("|");
    if(seen.has(key)&&c.source.synthetic){alias.set(c.id,seen.get(key));continue;}
    seen.set(key,c.id);dedup.push(c);
  }
  for(const c of dedup){
    if(c.details?.replacementResultCapabilityId&&alias.has(c.details.replacementResultCapabilityId))c.details.replacementResultCapabilityId=alias.get(c.details.replacementResultCapabilityId);
    for(const ref of c.references||[])if(ref.antecedentCapabilityId&&alias.has(ref.antecedentCapabilityId))ref.antecedentCapabilityId=alias.get(ref.antecedentCapabilityId);
  }
  bindCapabilityReferences(dedup);
  normalizeDynamicQuantities(dedup);
  annotateStructuredTriggerDependencies(dedup,legacy);
  const optionGroups=faces.flatMap(f=>optionGroupsForFace(f,dedup));
  const faceChoiceGroup=["modal_dfc","split","adventure"].includes(legacy.layout)?{
    id:"face-entry",faceId:null,instruction:"Choose an available face/mode when playing or casting this card.",policy:"exclusive",selection:{kind:"exact",count:1},
    options:faces.map(f=>({text:f.name,faceId:f.id,capabilityIds:dedup.filter(c=>c.faceId===f.id).map(c=>c.id)})),capabilityIds:dedup.map(c=>c.id)
  }:null;
  if(faceChoiceGroup)optionGroups.unshift(faceChoiceGroup);
  const oracleCaps=dedup.filter(c=>!c.source?.synthetic || !["face_type","face_entry","face_state"].includes(c.source.synthetic));
  const gapCount=oracleCaps.filter(c=>c.coverage===COVERAGE.GAP).length, partialCount=oracleCaps.filter(c=>c.coverage===COVERAGE.PARTIAL).length;
  const coverage=gapCount? (oracleCaps.length===gapCount?COVERAGE.GAP:COVERAGE.PARTIAL) : partialCount?COVERAGE.PARTIAL:COVERAGE.SUPPORTED;
  const canonicalEmbeddedLinks=embedded.links.map(l=>({...l,parentId:alias.get(l.parentId)||l.parentId,childId:alias.get(l.childId)||l.childId}));
  const relations=buildRelations(faces,dedup,optionGroups,canonicalEmbeddedLinks);
  return {
    schema:SEMANTIC_V2_SCHEMA,schemaVersion:SEMANTIC_V2_SCHEMA_VERSION,compilerVersion:SEMANTIC_V2_COMPILER_VERSION,source,
    oracleId:legacy.oracleId,name:legacy.name,layout:legacy.layout,keywords:legacy.keywords,colorIdentity:legacy.colorIdentity,legalities:legacy.legalities,
    faces,capabilities:dedup,optionGroups,relations,
    coverage:{status:coverage,totalCapabilities:dedup.length,oracleCapabilities:oracleCaps.length,supported:oracleCaps.filter(c=>c.coverage===COVERAGE.SUPPORTED).length,partial:partialCount,gaps:gapCount,
      gapFamilies:uniq(dedup.flatMap(c=>c.gaps))},
    provenance:{...legacy.provenance,parserFoundation:"semantic-compiler-v4",semanticSourceVersion:raw?._semanticSource??null}
  };
}

export const compilerV5Internals={replacementEvent,operatorFor,conditionExpr,parseActivationRequirements,selectionSpec,optionPolicy,refFrom};
