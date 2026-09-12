import assert from "node:assert/strict";
import {compileCardV5} from "../compiler.mjs";
import {buildCardCapabilityGraph} from "../graph.mjs";

const c=compileCardV5({oracle_id:"graph-doom",name:"Doomsday Confluence",layout:"normal",type_line:"Sorcery",mana_cost:"{X}{X}{B}",cmc:1,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"Choose X. You may choose the same mode more than once.\n• Each player sacrifices a nonartifact creature of their choice.\n• Create a 3/3 black Dalek artifact creature token with menace.\n• Each opponent discards a card."});
const g=buildCardCapabilityGraph(c);
assert.equal(g.version,2);
assert.ok(g.nodes.some(n=>n.type==="option_group"&&n.policy==="repeatable"));
assert.ok(g.edges.some(e=>e.type==="offers_capability"));
assert.ok(g.edges.some(e=>e.type==="performs_action"));
assert.ok(g.signals.actions.some(x=>x.includes("sacrifice")));
assert.ok(g.signals.actions.some(x=>x.includes("discard")));

const m=compileCardV5({oracle_id:"graph-mdfc",name:"Test Spell // Test Land",layout:"modal_dfc",color_identity:["B"],legalities:{commander:"legal"},card_faces:[{name:"Test Spell",type_line:"Sorcery",mana_cost:"{B}",cmc:1,oracle_text:"Draw a card."},{name:"Test Land",type_line:"Land",mana_cost:"",cmc:0,oracle_text:"{T}: Add {B}."}]});
const mg=buildCardCapabilityGraph(m);
assert.ok(mg.nodes.some(n=>n.type==="option_group"&&n.groupId==="face-entry"));
assert.ok(mg.edges.some(e=>e.type==="has_access"));
assert.ok(mg.signals.produces.includes("resource:mana"));
assert.ok(mg.signals.produces.includes("resource:card_in_hand"));

const w=compileCardV5({oracle_id:"graph-win",name:"Contract",layout:"normal",type_line:"Enchantment",mana_cost:"{3}{B}{B}",cmc:5,color_identity:["B"],legalities:{commander:"legal"},oracle_text:"At the beginning of your upkeep, if you control four or more Demons with different names, you win the game."});
const wg=buildCardCapabilityGraph(w);
assert.ok(wg.nodes.some(n=>n.type==="logic_expr"&&n.op==="and"));
assert.ok(wg.nodes.some(n=>n.type==="logic_expr"&&n.op==="at_least"&&n.count===4));
assert.ok(wg.edges.some(e=>e.type==="condition_logic"));
console.log("semantic-v2 graph tests: PASS");
