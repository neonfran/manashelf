const arr=x=>Array.isArray(x)?x:[];

/**
 * Recover attachment target dependencies from structured Semantic Runtime facts only.
 * This intentionally never reads Oracle text. It exists because Runtime dependency v1
 * predates some target-aware Theme Features, while the structured action fingerprint
 * already retains enough information to recover a conservative subset of those needs.
 */
export function structuredAttachmentNeed(card){
  const faces=arr(card?.faces).filter(f=>["default","alternative_entry"].includes(f?.access?.kind||"default"));
  const subtypes=new Set(faces.flatMap(f=>arr(f?.subtypes)));
  const produced=new Set(card?.views?.dependency?.produces||[]);

  if(subtypes.has("Equipment"))return produced.has("permanent:creature")?null:"permanent:creature";
  if(!subtypes.has("Aura"))return null;

  const features=card?.views?.themeFeatures?.features||{};
  let beneficial=false;const targetKinds=new Set();
  for(const [feature,value] of Object.entries(features)){
    if(Number(value||0)<.5)continue;
    const beneficiary=feature.match(/^action_beneficiary:([^:]+):(?:you|source_controller)$/),polarity=feature.match(/^action_polarity:([^:]+):(?:positive|protective)$/);
    // Casting the Aura itself is of course beneficial to its controller, but that says
    // nothing about whether the *enchanted permanent* is ours.  Only effect actions may
    // establish a positive attachment dependency.
    if((beneficiary&&!['cast_face','keyword'].includes(beneficiary[1]))||(polarity&&!['cast_face','keyword'].includes(polarity[1])))beneficial=true;
    const m=feature.match(/^action_object:([^:]+):(creature|enchanted_creature|artifact|land|enchantment|planeswalker|battle|permanent)$/);
    if(m&&!['cast_face','keyword'].includes(m[1]))targetKinds.add(m[2]==="enchanted_creature"?"creature":m[2]);
  }

  // Offline Semantic-v2 source cards have capabilities instead of materialized Theme Features.
  if(!Object.keys(features).length){
    for(const cap of arr(card?.capabilities)){
      const action=String(cap?.action||"");if(["cast_face","keyword"].includes(action))continue;
      const b=cap?.beneficiary?.kind;if(b==="you"||b==="source_controller"||["positive","protective"].includes(cap?.polarity))beneficial=true;
      const o=String(cap?.object||"");if(["creature","artifact","land","enchantment","planeswalker","battle","permanent"].includes(o))targetKinds.add(o);
    }
  }

  if(!beneficial)return null;
  if(targetKinds.has("creature"))return produced.has("permanent:creature")?null:"permanent:creature";
  const specific=["artifact","land","enchantment","planeswalker","battle"].filter(x=>targetKinds.has(x));
  if(specific.length===1){const signal=`permanent:${specific[0]}`;return produced.has(signal)?null:signal;}
  return null;
}
