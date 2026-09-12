import assert from "node:assert/strict";
import { hashSeed, seededRandom, selectStressCommanders, selectStressThemes, playableAsLandFromHand, modalPotential, analyzeStressBuild, clusterStressIssues, summarizeStressCases } from "../stress-harness.mjs";
import { createZip } from "../zip-buffer.mjs";

const face=(typeLine,access="default")=>({typeLine,access:{kind:access},cardTypes:typeLine.split(/\s+—\s+/)[0].split(/\s+/).filter(x=>["Basic","Land","Creature","Artifact","Enchantment","Instant","Sorcery"].includes(x))});
const commander=(name,ci)=>({oracleId:`o-${name}`,name,status:"supported",layout:"normal",colorIdentity:ci,legalities:{commander:"legal"},faces:[face("Legendary Creature — Test")]});
const pool=[];for(let i=0;i<180;i++)pool.push({oracleId:`c-w-${i}`,name:`White ${i}`,status:"supported",colorIdentity:["W"],legalities:{commander:"legal"},faces:[face("Creature — Test")]});for(let i=0;i<180;i++)pool.push({oracleId:`c-u-${i}`,name:`Blue ${i}`,status:"supported",colorIdentity:["U"],legalities:{commander:"legal"},faces:[face("Creature — Test")]});for(let i=0;i<180;i++)pool.push({oracleId:`c-wu-${i}`,name:`WU ${i}`,status:"supported",colorIdentity:["W","U"],legalities:{commander:"legal"},faces:[face("Creature — Test")]});
const runtime=[];for(let i=0;i<20;i++)runtime.push(commander(`Mono W ${i}`,["W"]));for(let i=0;i<20;i++)runtime.push(commander(`Mono U ${i}`,["U"]));for(let i=0;i<30;i++)runtime.push(commander(`Azorius ${i}`,["W","U"]));

assert.equal(hashSeed("x"),hashSeed("x"));
const r1=seededRandom(123),r2=seededRandom(123);assert.deepEqual([r1(),r1(),r1()],[r2(),r2(),r2()]);
const pickedA=selectStressCommanders({runtimeCards:runtime,poolCards:pool,commanderCount:12,seed:99,minPool:140});
const pickedB=selectStressCommanders({runtimeCards:runtime,poolCards:pool,commanderCount:12,seed:99,minPool:140});
assert.deepEqual(pickedA.map(x=>x.name),pickedB.map(x=>x.name));assert.equal(new Set(pickedA.map(x=>x.name)).size,pickedA.length);assert.ok(pickedA.some(x=>x.colorIdentity.length===1));assert.ok(pickedA.some(x=>x.colorIdentity.length===2));

const themes=[{name:"Artifacts",count:100,themeContractMode:"semantic"},{name:"Group Slug",count:80,themeContractMode:"external_fallback"},{name:"Tokens",count:90,themeContractMode:"semantic"},{name:"Chaos",count:20,themeContractMode:"external_fallback"}];
const usage=new Map(),modes=new Map(),chosen=selectStressThemes(themes,{perCommander:3,seed:7,themeUsage:usage,modeUsage:modes});assert.equal(chosen.length,3);assert.ok(chosen.some(x=>x.themeContractMode==="external_fallback"));

const transformLand={name:"Front Artifact // Back Land",layout:"transform",faces:[face("Artifact","default"),face("Land","state_transition")],views:{mana:{isPlayableLand:false}},optionGroups:[],relations:[{type:"state_transition"}]};
const mdfcLand={name:"Spell // Land",layout:"modal_dfc",faces:[face("Sorcery","default"),face("Land","alternative_entry")],views:{mana:{isPlayableLand:true}},optionGroups:[{policy:"exclusive"}],relations:[]};
assert.equal(playableAsLandFromHand(transformLand),false);assert.equal(playableAsLandFromHand(mdfcLand),true);assert.equal(modalPotential(mdfcLand).mutuallyExclusive,true);assert.equal(modalPotential(transformLand).sequential,true);
const confluence={name:"Test Confluence",layout:"normal",faces:[face("Sorcery")],optionGroups:[{policy:"repeatable"}],relations:[]};assert.equal(modalPotential(confluence).repeatable,true);assert.equal(modalPotential(confluence).mutuallyExclusive,false);

const semMap=new Map([["front artifact // back land",transformLand]]);const build={complete:true,size:100,validation:{semanticCoverage:{gap:0}},shortages:{},mana:{weightedCoverage:1,shortfalls:{},pipDemand:{B:10}},summary:{lands:40,nonbasicLands:27,basicLands:13,themeCards:20,themeFacets:{theme:20}},deck:[{name:"Front Artifact // Back Land",quantity:1,category:"Land",selectionPhase:"mana",roles:{}}],context:{bottlenecks:[]}};const issues=analyzeStressBuild({build,semanticByName:semMap,settings:{landStyle:"safe"},themeMode:"external_fallback"});assert.ok(issues.some(x=>x.family==="land_face_playability"));assert.ok(issues.some(x=>x.family==="safe_nonbasic_pressure"));assert.ok(issues.some(x=>x.family==="fallback_facet_collapse"));

// Conditional finishers are scoped even when the condition remains explicitly unresolved;
// the stress harness must not misreport that as "unscoped".
const scopedFinisher={name:"Scoped Finisher",layout:"normal",faces:[face("Enchantment")],views:{roles:{finisher:{adjudication:"positive",conditional:true}},dependency:{packageNeeds:[],stateNeeds:[],environmentNeeds:[],internalConstraints:[],unresolvedConditions:["condition:unresolved"]}}};
const scopedMap=new Map([["scoped finisher",scopedFinisher]]),scopedBuild={complete:true,size:100,validation:{semanticCoverage:{gap:0}},shortages:{},mana:{weightedCoverage:1,shortfalls:{},pipDemand:{}},summary:{lands:40,nonbasicLands:0,basicLands:40,themeCards:0,themeFacets:{}},deck:[{name:"Scoped Finisher",quantity:1,category:"Finisher",selectionPhase:"structural",roles:{finisher:.99}}],context:{bottlenecks:[]}};
assert.equal(analyzeStressBuild({build:scopedBuild,semanticByName:scopedMap,settings:{landStyle:"balanced"},themeMode:"semantic"}).some(x=>x.family==="conditional_finisher_unscoped"),false);

const cases=[{id:"a",status:"ok",commander:"A",theme:"T",themeMode:"semantic",colorKey:"WU",candidateCount:1200,modal:{selected:2,modalDfc:1,transform:1,chooseModes:1,repeatable:0},metrics:{weightedManaCoverage:.9,themeCards:20},anomalies:issues},{id:"b",status:"ok",commander:"B",theme:"T2",themeMode:"external_fallback",colorKey:"B",candidateCount:900,modal:{selected:1,modalDfc:0,transform:0,chooseModes:1,repeatable:1},metrics:{weightedManaCoverage:.8,themeCards:10},anomalies:[]}];assert.ok(clusterStressIssues(cases).length>=3);const summary=summarizeStressCases(cases);assert.equal(summary.completed,2);assert.equal(summary.modal.repeatable,1);assert.equal(summary.avgCandidatePool,1050);
const zip=createZip([{name:"a.json",data:"{\"ok\":true}"},{name:"b.txt",data:"hello"}]);assert.equal(zip.readUInt32LE(0),0x04034b50);assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
console.log("LAB3 stress harness tests: OK");
