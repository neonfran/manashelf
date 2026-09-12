import assert from "node:assert/strict";
import {compareLab2Lab3} from "../ab-compare.mjs";

const lab2={result:{size:100,summary:{lands:38,themeCards:44},roleCounts:{ramp:10,resources:11,interaction:10,wipes:2,resilience:4,finishers:2}},deck:[{name:"A",quantity:1},{name:"B",quantity:1}]};
const lab3={size:100,summary:{lands:38,themeCards:47,roleCounts:{ramp:10.5,resources:10.8,interaction:11,wipes:2.1,protection:4.2,recursion:2.3,finishers:2}},validation:{semanticCoverage:{supported:90,partial:10,gap:0}},context:{summary:{avgDependencySatisfaction:.91},bottlenecks:[]},shortages:{},deck:[{name:"A",quantity:1},{name:"C",quantity:1}]};
const out=compareLab2Lab3(lab2,lab3,{candidateScope:"full-runtime-pool"});
assert.equal(out.schema,"manashelf-lab2-lab3-ab-v1");
assert.equal(out.deck.sharedUnique,1);
assert.equal(out.deck.uniqueLab2,2);
assert.equal(out.deck.uniqueLab3,2);
assert.equal(out.deck.jaccard,.333);
assert.deepEqual(out.caveats,[]);
assert.equal(out.lab3.semanticCoverage.gap,0);
console.log("LAB3 A/B comparison tests passed");
