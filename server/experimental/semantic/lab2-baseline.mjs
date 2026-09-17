import fs from "node:fs";
export const EXPECTED_LAB2_BASELINE={schema:"manashelf-lab2-build-log-v8",appVersion:"2.5.41-beta",builderVersion:14,classificationVersion:7,manaModelVersion:5,comboEngineVersion:2,healthSemanticSource:"classification-v7"};
export function inspectLab2LogObject(log){
  const e=log?.engines||{};const actual={schema:log?.schema,appVersion:log?.appVersion,builderVersion:log?.builderVersion??e.builderVersion,classificationVersion:e.classificationVersion,manaModelVersion:e.manaModelVersion,comboEngineVersion:e.comboEngineVersion,healthSemanticSource:e.healthSemanticSource};
  const mismatches=Object.entries(EXPECTED_LAB2_BASELINE).filter(([k,v])=>actual[k]!==v).map(([field,expected])=>({field,expected,actual:actual[field]}));
  const summary=log?.result?.summary||{};
  return {valid:mismatches.length===0,expected:EXPECTED_LAB2_BASELINE,actual,mismatches,fixture:{commander:log?.input?.commander||null,theme:log?.input?.theme?.name||null,size:log?.result?.size??null,complete:log?.result?.complete??null,lands:summary.lands??null,nonlands:summary.nonlands??null,avgCmc:summary.avgCmc??null,themeCards:summary.themeCards??null,themeDensity:summary.themeDensity??null,roleCounts:log?.result?.roleCounts||null,manaValidated:log?.result?.mana?.validation?.validated??null}};
}
export function inspectLab2LogFile(filePath){return inspectLab2LogObject(JSON.parse(fs.readFileSync(filePath,"utf8")));}
export function compareLab2Logs(logs){return logs.map(({label,log})=>({label,...inspectLab2LogObject(log)}));}
