// ManaShelf v2.4.1 — Archidekt Size method 6, validated against the user's real decks.
// Board membership is intentionally simple: Archidekt's first category is the primary one.
// Sideboard and Maybeboard are excluded; every other card quantity is counted.
export function partitionArchidektDeck(payload){
  const categories=Array.isArray(payload?.categories)?payload.categories:[];
  const categoryName=x=>typeof x==="string"?x:String(x?.name||x?.category||"");
  const catByName=new Map(categories.map(c=>[String(c?.name||"").toLocaleLowerCase("en-US"),c]));
  const mainboard=[],excluded=[],commanders=[];

  for(const entry of (payload?.cards||[])){
    const cardObj=entry?.card||{},oracle=cardObj?.oracleCard||cardObj?.oracle_card||{};
    const name=String(oracle?.name||cardObj?.name||entry?.name||"").trim();
    const quantity=Math.max(0,Number(entry?.quantity||1));
    if(!name||quantity<=0)continue;

    const cats=Array.isArray(entry?.categories)?entry.categories.map(categoryName).filter(Boolean):[];
    const primary=cats[0]||"";
    const excludedByBoard=/^(sideboard|maybeboard)$/i.test(primary);
    const primaryMeta=catByName.get(primary.toLocaleLowerCase("en-US"));
    const isCommander=Boolean(primaryMeta?.isPremier)||/^commander$/i.test(primary);

    if(isCommander)commanders.push(name);
    (excludedByBoard?excluded:mainboard).push({
      name,quantity,categories:cats,primaryCategory:primary
    });
  }

  return {
    categories,
    mainboard,
    excluded,
    commanders:[...new Set(commanders)],
    size:mainboard.reduce((n,c)=>n+c.quantity,0),
    excludedCount:excluded.reduce((n,c)=>n+c.quantity,0)
  };
}

export function archidektDeckSize(payload){
  return partitionArchidektDeck(payload).size;
}
