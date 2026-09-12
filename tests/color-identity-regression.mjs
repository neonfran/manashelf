import assert from "node:assert/strict";
import { normalizeColorIdentity, colorIdentitySubset } from "../lib/color-identity.mjs";

const cases=[
  ["Blue, Black, Green",["U","B","G"],true],
  [["Blue","Black","Green"],["U","B","G"],true],
  ["UBG",["U","B","G"],true],
  ["{U}{B}{G}",["U","B","G"],true],
  ["White / Blue",["W","U"],true],
  ["Colorless",[],true],
  ["",[],false],
  [null,[],false],
  ["Blue, Mystery",["U"],false]
];
for(const [raw,colors,trusted] of cases){const got=normalizeColorIdentity(raw);assert.deepEqual(got.colors,colors,`normalize failed for ${JSON.stringify(raw)}`);assert.equal(got.trusted,trusted,`trust failed for ${JSON.stringify(raw)}`)}
assert.equal(colorIdentitySubset(["U","B"],["U","B","G"]),true);
assert.equal(colorIdentitySubset(["U","R"],["U","B","G"]),false);
console.log("color identity regression: OK");
