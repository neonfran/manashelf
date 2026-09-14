// ManaShelf canonical card identity helpers.
// The goal is not to rewrite display names. It is to make joins between Archidekt,
// Scryfall, EDHREC and Commander Spellbook resilient to harmless formatting differences
// and to multi-face names ("Front // Back") without card-specific exceptions.

const APOSTROPHES=/[\u2018\u2019\u201B\u2032\u02BC\uFF07]/g;
const DOUBLE_SLASH=/\s*\/\/\s*/g;

export function normalizeCardName(name=""){
  return String(name??"")
    .normalize("NFKC")
    .replace(APOSTROPHES,"'")
    .replace(DOUBLE_SLASH," // ")
    .replace(/\s+/g," ")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function cardNameFaces(name=""){
  const display=String(name??"").normalize("NFKC").replace(APOSTROPHES,"'").replace(DOUBLE_SLASH," // ").replace(/\s+/g," ").trim();
  if(!display)return [];
  return display.split(" // ").map(x=>x.trim()).filter(Boolean);
}

export function cardNameAliases(name=""){
  const out=[];
  const add=value=>{const k=normalizeCardName(value);if(k&&!out.includes(k))out.push(k)};
  add(name);
  const faces=cardNameFaces(name);
  // Scryfall and external services sometimes return the full multi-face oracle name while
  // Archidekt/export rows can surface only one face. Treat either face as an alias for joins.
  if(faces.length>1)for(const face of faces)add(face);
  return out;
}

export function cardIdentityKey(name=""){
  return cardNameAliases(name)[0]||"";
}

export function cardNameMatches(a,b){
  const left=new Set(cardNameAliases(a));
  return cardNameAliases(b).some(k=>left.has(k));
}

export function setCardAlias(map,name,value,{overwrite=true}={}){
  for(const alias of cardNameAliases(name))if(overwrite||!map.has(alias))map.set(alias,value);
  return map;
}

export function getCardAlias(map,name){
  for(const alias of cardNameAliases(name))if(map.has(alias))return map.get(alias);
  return undefined;
}

export function hasCardAlias(mapOrSet,name){
  for(const alias of cardNameAliases(name))if(mapOrSet.has(alias))return true;
  return false;
}
