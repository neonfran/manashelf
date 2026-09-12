import assert from "node:assert/strict";
import { COMBO_ENGINE_VERSION, normalizeSpellbookResponse, availableComboPackages, spellbookCardQuery, comboAvailabilitySummary, normalizeFindMyCombosResponse } from "../lib/combo-engine.mjs";

assert.equal(COMBO_ENGINE_VERSION,2);
assert.equal(spellbookCardQuery('Animar, Soul of Elements'),'card:"Animar, Soul of Elements" legal:commander');
assert.equal(spellbookCardQuery('Animar, Soul of Elements',{infiniteOnly:true}),'card:"Animar, Soul of Elements" legal:commander result:infinite');
const raw={count:2,next:null,results:[
  {id:"v1",identity:"GUR",uses:[{card:{name:"Animar, Soul of Elements"},mustBeCommander:false,quantity:1,zoneLocations:["B"]},{card:{name:"Ancestral Statue"},mustBeCommander:false,quantity:1}],requires:[],produces:[{feature:{name:"Infinite +1/+1 counters"}}],manaNeeded:"{4}",manaValueNeeded:4,popularity:123,legalities:{commander:true}},
  {id:"templated",uses:[{card:{name:"Animar, Soul of Elements"},must_be_commander:true,quantity:1}],requires:[{template:{name:"Any creature bounce outlet"}}],produces:[{feature:{name:"Infinite casts"}}],legalities:{commander:true}}
]};
const normalized=normalizeSpellbookResponse(raw,"Animar, Soul of Elements");
assert.equal(normalized.length,2);
assert.equal(normalized[0].pieces[1].name,"Ancestral Statue");
assert.ok(normalized[0].infinite,"infinite result features must be recognized");
assert.ok(normalized[1].hasTemplates,"generic template requirements must remain explicit");
const cards=[{name:"Ancestral Statue",ownedQuantity:1,availableQuantity:1}];
const available=availableComboPackages(normalized,cards,{commander:"Animar, Soul of Elements",commanderColors:["G","U","R"],policy:"infinite",protectExistingDecks:true});
assert.deepEqual(available.map(x=>x.id),["v1"],"only exact, complete, legal packages may be offered to the builder");
assert.equal(availableComboPackages(normalized,[],{commander:"Animar, Soul of Elements",commanderColors:["G","U","R"],policy:"infinite"}).length,0,"missing pieces must invalidate a package");
const summary=comboAvailabilitySummary(normalized,cards,{commander:"Animar, Soul of Elements",commanderColors:["G","U","R"]});
assert.equal(summary.apiVariantsFetched,2);assert.equal(summary.collectionComplete,1);assert.equal(summary.infiniteComplete,1);
const finder=normalizeFindMyCombosResponse({included:[raw.results[0]],almostIncluded:[raw.results[1]]},"Animar, Soul of Elements");
assert.equal(finder.included.length,1);assert.equal(finder.almostIncluded.length,1);assert.ok(finder.included[0].infinite);
console.log("combo engine smoke: OK");
