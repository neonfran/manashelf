// Independent theme-support counting for Deck Overview.
// A card may support any number of themes; membership is never exclusive.
export function countThemeSupport(cards,themeName,evidenceFn,{excludeName=null}={}){
  let cardCount=0;const names=[];const seen=new Set();
  for(const card of cards||[]){
    if(!card?.name||excludeName&&String(card.name).toLocaleLowerCase("en-US")===String(excludeName).toLocaleLowerCase("en-US"))continue;
    const evidence=Number(evidenceFn?.(themeName,card)||0);if(evidence<=0)continue;
    const qty=Math.max(0,Number(card.quantity||1));cardCount+=qty;
    const k=String(card.name).toLocaleLowerCase("en-US");if(!seen.has(k)){seen.add(k);names.push(card.name)}
  }
  return {cardCount,uniqueCardCount:names.length,cards:names};
}

export function countPredicateThemeSupport(cards,predicate,{excludeName=null}={}){
  let cardCount=0;const names=[];const seen=new Set();
  for(const card of cards||[]){
    if(!card?.name||excludeName&&String(card.name).toLocaleLowerCase("en-US")===String(excludeName).toLocaleLowerCase("en-US"))continue;
    if(!predicate?.(card))continue;
    const qty=Math.max(0,Number(card.quantity||1));cardCount+=qty;
    const k=String(card.name).toLocaleLowerCase("en-US");if(!seen.has(k)){seen.add(k);names.push(card.name)}
  }
  return {cardCount,uniqueCardCount:names.length,cards:names};
}
