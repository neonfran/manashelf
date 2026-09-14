// ManaShelf color-identity normalization.
// External sources are not assumed to use Scryfall's W/U/B/R/G representation.
// This module performs only conservative normalization for coarse local filtering;
// Scryfall `color_identity` remains authoritative before a card enters a Commander build.

const TOKEN={w:"W",white:"W",u:"U",blue:"U",b:"B",black:"B",r:"R",red:"R",g:"G",green:"G"};
const ORDER=["W","U","B","R","G"];

export function normalizeColorIdentity(raw){
  const original=raw;
  if(raw==null)return {colors:[],trusted:false,raw:original,unknown:[]};
  let parts=[];
  if(Array.isArray(raw))parts=raw.flatMap(x=>String(x??"").split(/[,;/|\s]+/));
  else{
    const text=String(raw).trim();
    if(!text)return {colors:[],trusted:false,raw:original,unknown:[]};
    if(/^(?:colorless|colourless|none|c)$/i.test(text))return {colors:[],trusted:true,raw:original,unknown:[]};
    const compact=text.replace(/[{}\[\]()'"\s,;/|+-]/g,"");
    if(/^[WUBRG]+$/i.test(compact))parts=compact.toUpperCase().split("");
    else parts=text.replace(/[{}\[\]()'"]/g," ").split(/[,;/|\s+-]+/);
  }
  const colors=[],unknown=[];
  for(const rawPart of parts){
    const token=String(rawPart||"").trim().toLowerCase();
    if(!token)continue;
    if(/^(?:colorless|colourless|none|c)$/.test(token))continue;
    const mapped=TOKEN[token];
    if(mapped){if(!colors.includes(mapped))colors.push(mapped)}else unknown.push(token);
  }
  colors.sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b));
  return {colors,trusted:parts.length>0&&unknown.length===0,raw:original,unknown};
}

export function colorIdentitySubset(cardIdentity,commanderIdentity){
  const allowed=new Set(commanderIdentity||[]);
  return (cardIdentity||[]).every(color=>allowed.has(color));
}
