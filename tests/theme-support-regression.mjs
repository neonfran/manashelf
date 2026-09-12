import assert from "node:assert/strict";
import { countThemeSupport, countPredicateThemeSupport } from "../lib/theme-support.mjs";
const cards=[{name:"Hybrid Engine",quantity:1,flags:["Artifacts","Tokens"]},{name:"Token Maker",quantity:2,flags:["Tokens"]},{name:"Commander",quantity:1,flags:["Artifacts","Tokens"]}];
const evidence=(theme,c)=>c.flags.includes(theme)?1:0;
const artifacts=countThemeSupport(cards,"Artifacts",evidence,{excludeName:"Commander"}),tokens=countThemeSupport(cards,"Tokens",evidence,{excludeName:"Commander"});
assert.equal(artifacts.cardCount,1);assert.equal(tokens.cardCount,3,"quantities must count toward theme support");assert.ok(artifacts.cards.includes("Hybrid Engine")&&tokens.cards.includes("Hybrid Engine"),"one card must be allowed to support multiple themes simultaneously");
const generated=countPredicateThemeSupport(cards,c=>c.flags.includes("Tokens"),{excludeName:"Commander"});assert.equal(generated.cardCount,3);
console.log("theme support overlap regression: OK");
