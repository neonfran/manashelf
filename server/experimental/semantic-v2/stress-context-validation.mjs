import fs from "node:fs";
import readline from "node:readline";
import {streamSemanticV2Cards} from "./graph.mjs";
import {buildContextState} from "./context-optimizer.mjs";

const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const singular=s=>{s=String(s||"");const irregular={elves:"elf",dwarves:"dwarf",wolves:"wolf",zombies:"zombie",faeries:"faerie"};if(irregular[s])return irregular[s];if(/(?:ches|shes|xes|zes)$/.test(s))return s.slice(0,-2);if(s.endsWith("ies"))return s.slice(0,-3)+"y";return s.endsWith("s")&&!/(?:ss|us|is)$/.test(s)?s.slice(0,-1):s;};
function themeFacet(label){
  const x=norm(label);if(!x)return null;
  const maps=[
    [/artifact/,"artifacts"],[/enchant/,"enchantments"],[/aura/,"auras"],[/equipment|voltron/,"equipment"],[/token/,"tokens"],
    [/sacrifice|aristocrat|death/,"sacrifice"],[/life ?gain/,"lifegain"],[/counter/,"counters"],[/graveyard|reanim/,"graveyard"],
    [/spell|instant|sorcery|magecraft|storm/,"spellslinger"],[/landfall|\blands?\b/,"lands"],[/clone|copy/,"clones"],[/historic/,"historic"],[/legend/,"legends"]
  ];
  for(const [re,f] of maps)if(re.test(x))return f;
  const ignore=new Set(["kindred","tribal","creature","creatures","theme","typal"]),words=x.split(/\s+/).filter(w=>w&&!ignore.has(w));
  if(words.length===1&&words[0].length>2)return `kindred:${singular(words[0])}`;
  return null;
}

async function loadCorpusIndex(db){
  const map=new Map(),permanentSubtypes=new Set();
  for await(const c of streamSemanticV2Cards(db)){
    if(!map.has(c.name))map.set(c.name,c);
    for(const f of c.faces||[])if(["default","alternative_entry"].includes(f.access?.kind)&&(f.cardTypes||[]).some(t=>["Creature","Artifact","Enchantment","Planeswalker","Battle","Land","Kindred"].includes(t)))for(const st of f.subtypes||[])permanentSubtypes.add(norm(st).replace(/ /g,"_"));
  }
  return {map,permanentSubtypes};
}
async function run(db,casesPath,outPath){
  const corpus=await loadCorpusIndex(db),byName=corpus.map,out=fs.createWriteStream(outPath);const stats={cases:0,okCases:0,processed:0,optimizerErrors:0,missingCardCopies:0,missingNames:{},themeMapped:0,themeUsed:0,totalBottlenecks:0,maxBottlenecks:0,falseClassBottlenecks:0,impossibleSubtypeBottlenecks:0,impossibleSubtypeExamples:{},commanderBottlenecks:0,landAccessViolations:0,stateFaceCastViolations:0,totalCardsAnalyzed:0,sumDependencySemantic:0,sumDependencyReliability:0,sumStructuralScore:0,sumThemeDensity:0,unresolvedCards:0};
  const rl=readline.createInterface({input:fs.createReadStream(casesPath),crlfDelay:Infinity});
  for await(const line of rl){if(!line.trim())continue;stats.cases++;const row=JSON.parse(line);if(row.status!=="ok")continue;stats.okCases++;
    try{
      const commander=byName.get(row.commander)||null,cards=[];let expected=0;
      for(const d of row.deck||[]){if(d.category==="Commander")continue;const q=Math.max(1,Number(d.quantity||1));expected+=q;const c=byName.get(d.name);if(!c){stats.missingCardCopies+=q;stats.missingNames[d.name]=(stats.missingNames[d.name]||0)+q;continue;}for(let i=0;i<q;i++)cards.push(c);}
      const facet=themeFacet(row.theme);if(facet)stats.themeMapped++;const state=buildContextState(cards,{commander,themeFacet:facet});stats.processed++;stats.totalCardsAnalyzed+=state.cardCount;stats.totalBottlenecks+=state.bottlenecks.length;stats.maxBottlenecks=Math.max(stats.maxBottlenecks,state.bottlenecks.length);stats.sumDependencySemantic+=state.summary.avgDependencySemantic;stats.sumDependencyReliability+=state.summary.avgDependencyReliability;stats.sumStructuralScore+=state.summary.avgStructuralScore;stats.sumThemeDensity+=state.summary.themeDensity;stats.unresolvedCards+=state.summary.unresolvedCards;if(facet&&state.summary.themeDensity>0)stats.themeUsed++;
      for(const b of state.bottlenecks){
        if(/^(?:internal|state|condition|environment|constraint):/.test(b.signal))stats.falseClassBottlenecks++;
        if(b.signal==="commander:controlled")stats.commanderBottlenecks++;
        if(b.signal.startsWith("permanent:subtype:")){
          const st=b.signal.slice("permanent:subtype:".length);if(!corpus.permanentSubtypes.has(st)){stats.impossibleSubtypeBottlenecks++;stats.impossibleSubtypeExamples[st]=(stats.impossibleSubtypeExamples[st]||0)+1;}
        }
      }
      for(const p of state.cards){
        const transitionLand=p.mana.landFaces.some(f=>f.access==="state_transition");if(transitionLand&&(p.roleScores.land_slot||0)>0)stats.landAccessViolations++;
        if(p.castability.entries.some(e=>e.access==="state_transition"))stats.stateFaceCastViolations++;
      }
      out.write(JSON.stringify({id:row.id,commander:row.commander,theme:row.theme,themeFacet:facet,expectedNonCommanderCopies:expected,mappedNonCommanderCopies:cards.length,summary:state.summary,bottlenecks:state.bottlenecks.slice(0,12)})+'\n');
    }catch(e){stats.optimizerErrors++;out.write(JSON.stringify({id:row.id,error:String(e?.stack||e)})+'\n');}
  }
  await new Promise((resolve,reject)=>{out.end(resolve);out.on("error",reject);});
  const n=Math.max(1,stats.processed);stats.avgBottlenecks=stats.totalBottlenecks/n;stats.avgDependencySemantic=stats.sumDependencySemantic/n;stats.avgDependencyReliability=stats.sumDependencyReliability/n;stats.avgStructuralScore=stats.sumStructuralScore/n;stats.avgThemeDensity=stats.sumThemeDensity/n;stats.missingNameCount=Object.keys(stats.missingNames).length;stats.missingExamples=Object.entries(stats.missingNames).sort((a,b)=>b[1]-a[1]).slice(0,30);stats.impossibleSubtypeExamples=Object.entries(stats.impossibleSubtypeExamples).sort((a,b)=>b[1]-a[1]).slice(0,30);delete stats.missingNames;delete stats.sumDependencySemantic;delete stats.sumDependencyReliability;delete stats.sumStructuralScore;delete stats.sumThemeDensity;return stats;
}
if(import.meta.url===`file://${process.argv[1]}`){const [db,cases,out]=process.argv.slice(2);if(!db||!cases||!out)throw new Error("usage: node stress-context-validation.mjs <semantic-db.jsonl.gz> <cases.jsonl> <out.jsonl>");console.log(JSON.stringify(await run(db,cases,out),null,2));}
