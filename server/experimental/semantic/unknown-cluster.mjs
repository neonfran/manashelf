const CUES=["choose","reveal","look","scry","surveil","mill","sacrifice","fight","transform","discover","manifest","venture","vote","exchange","control","gain","lose","counter","damage","discard","search","shuffle","cast","play","attach","equip","enchant","proliferate","investigate","connive","learn","explore"];
export function unknownPatternFingerprint(clause){
  const t=String(clause?.rawText||"").toLowerCase();
  const shape=[clause?.trigger||"unknown"];
  if(/\bif\b|\bunless\b|\bas long as\b/.test(t))shape.push("conditional");
  if(/\bfor each\b|\bx\b|\bthat many\b/.test(t))shape.push("scaling");
  if(/\bchoose (?:one|two|three|one or more)\b/.test(t))shape.push("modal");
  if(/["“”]/.test(t))shape.push("quoted");
  const cues=CUES.filter(x=>new RegExp(`\\b${x}\\b`).test(t)).slice(0,5);
  return [...new Set([...(clause?.unsupportedPatterns||["UNKNOWN"]),...shape,...cues])].join("|");
}
