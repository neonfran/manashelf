import { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import CommanderAutocomplete from "../../components/CommanderAutocomplete.jsx";
import DeckInspector from "../../components/DeckInspector.jsx";
import DeckHealthPanel from "../shared/DeckHealthPanel.jsx";
import { lab2Profile as fetchLab2Profile, lab2Progress, lab2Build, lab2BuildLog } from "../../api.js";
import { download, key } from "../../utils.js";
import { Lab2Summary, Lab2Warnings, Lab2Audit, Lab2DeckTable } from "./lab2AuditRender.jsx";

function minimalThemeDescription(theme) {
  const name = String(theme?.name || theme || "Theme").trim(), k = name.toLocaleLowerCase("en-US");
  const rules = [
    [/spell|instant|sorcery/, "Prioriza lanzar y aprovechar instants y sorceries."], [/artifact/, "Prioriza artifacts y cartas que los generan o aprovechan."], [/enchant|aura/, "Prioriza enchantments/Auras y sus payoffs."], [/token/, "Prioriza crear, multiplicar y aprovechar tokens."], [/grave|reanim/, "Usa el cementerio como recurso y recupera valor desde él."], [/sacrifice|aristocrat/, "Convierte sacrificios y muertes en valor o daño."], [/landfall|lands? matter|lands?/, "Prioriza tierras y efectos que obtienen valor de ellas."], [/voltron|equipment/, "Concentra mejoras y protección en una amenaza principal."], [/counter/, "Construye alrededor de counters y sus payoffs."], [/lifegain|life gain/, "Gana vida repetidamente y aprovecha sus payoffs."], [/draw|card advantage/, "Prioriza robo y recompensas por generar cartas."], [/discard|wheel/, "Convierte descarte o recambio de manos en ventaja."], [/blink|flicker/, "Reutiliza permanentes mediante blink/flicker y ETB."], [/copy|clone/, "Copia spells o permanentes para multiplicar valor."], [/control/, "Prioriza respuestas, tempo y control del desarrollo rival."], [/stax|tax/, "Limita o encarece las acciones rivales mientras desarrolla su plan."], [/group slug|burn|damage/, "Aplica presión de daño o pérdida de vida de forma sostenida."], [/combo/, "Busca ensamblar interacciones de cartas que producen un cierre fuerte."], [/chaos/, "Prioriza efectos variables que alteran reglas, decisiones o resultados."], [/treasure/, "Genera y aprovecha Treasure como recurso y sinergia."], [/clue/, "Genera y aprovecha Clues como recurso y motor de valor."], [/food/, "Genera y aprovecha Food como recurso y payoff."], [/cycling/, "Aprovecha Cycling para filtrar cartas y activar payoffs."],
  ];
  for (const [re, desc] of rules) if (re.test(k)) return desc;
  const words = name.split(/\s+/);
  if (words.length <= 3 && /s$/.test(name) && !/[ /]/.test(name)) return `Mazo centrado en ${name} y sus sinergias de tipo de criatura.`;
  return `Prioriza cartas que refuerzan el plan "${name}".`;
}

const DEFAULT_SETTINGS = { themeFocus: 72, ramp: "standard", interaction: "standard", curve: "normal", synergyBias: "balanced", commanderDependence: "normal", comboPolicy: "off", landStyle: "balanced", protectExistingDecks: true };

export default function Lab2Flow() {
  const { t, showError, clearError, openModal, setActivity, clearActivity, setSubject, showSelection } = useApp();
  const [query, setQuery] = useState("");
  const [commander, setCommander] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState("Preparando perfil del Commander…");
  const [theme, setTheme] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [building, setBuilding] = useState(false);
  const [buildMessage, setBuildMessage] = useState("Preparando build…");
  const [result, setResult] = useState(null);
  const [inspectorFilter, setInspectorFilter] = useState(null);
  const [copied, setCopied] = useState(false);
  const progressTimer = useRef(null);

  useEffect(() => () => clearInterval(progressTimer.current), []);
  // Mirror whichever LAB 2 stage is running (profile lookup or build) onto the shared
  // terminal indicator, using the exact progress text the backend is reporting.
  useEffect(() => {
    if (profileLoading) setActivity(`LAB 2 · ${profileMessage}`);
    else if (building) setActivity(`LAB 2 · ${buildMessage}`);
    else clearActivity();
  }, [profileLoading, profileMessage, building, buildMessage, setActivity, clearActivity]);

  const chooseCommander = async (c) => {
    clearError();
    setCommander(c);
    setQuery(c.name);
    setProfile(null);
    setTheme(null);
    setResult(null);
    setProfileLoading(true);
    setProfileMessage("Preparando perfil del Commander…");
    progressTimer.current = setInterval(async () => {
      const p = await lab2Progress().catch(() => null);
      if (p?.message) setProfileMessage(p.message);
    }, 350);
    try {
      const p = await fetchLab2Profile(c.name);
      setProfile(p);
      const pc = p.commander || c;
      setCommander({ ...c, ...pc, image: pc.image || c.image, largeImage: pc.imageLarge || c.largeImage });
      setSubject("lab2", "Commander", c.name);
      showSelection("Commander", c.name);
    } catch (e) {
      showError(e);
    } finally {
      clearInterval(progressTimer.current);
      setProfileLoading(false);
    }
  };

  const chooseTheme = (th) => {
    setTheme(th);
    setResult(null);
  };

  const runBuild = async () => {
    if (!commander?.name) return showError(new Error("Elegí un Commander."));
    if (!theme) return showError(new Error("Elegí un theme."));
    clearError();
    setResult(null);
    setBuilding(true);
    setBuildMessage("Preparando build…");
    progressTimer.current = setInterval(async () => {
      const p = await lab2Progress().catch(() => null);
      if (p?.message) setBuildMessage(p.message);
    }, 450);
    try {
      const d = await lab2Build({ commander: commander.name, theme, settings });
      setResult(d);
    } catch (e) {
      showError(e);
    } finally {
      clearInterval(progressTimer.current);
      setBuilding(false);
    }
  };

  const archidektText = () => {
    if (!result?.deckDetail) return "";
    return (result.deckDetail.mainboard || []).map((c) => {
      const category = String((c.categories || [])[0] || "Uncategorized").replace(/[[\]\r\n]/g, " ").trim() || "Uncategorized";
      return `${Number(c.quantity || 1)}x ${c.name} [${category}]`;
    }).join("\n");
  };
  const safeName = (name) => String(name || "manashelf-deck").normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "manashelf-deck";
  const exportArchidekt = () => { if (!result?.deckDetail) return showError(new Error("Generá un mazo primero.")); download(`${safeName(result.deckDetail.name)}-archidekt.txt`, archidektText()); };
  const copyArchidekt = async () => {
    if (!result?.deckDetail) return showError(new Error("Generá un mazo primero."));
    try {
      await navigator.clipboard.writeText(archidektText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1300);
    } catch { showError(new Error("No pude copiar el decklist al portapapeles.")); }
  };
  const exportLog = async () => {
    if (!result?.diagnosticLogId) return showError(new Error("No hay un log de armado disponible."));
    try {
      const log = await lab2BuildLog(result.diagnosticLogId);
      const version = String(log?.appVersion || "unknown").replace(/^v/i, "");
      const cmd = String(log?.input?.commander || result.deckDetail?.commander || "Commander");
      const th = String(log?.input?.theme?.name || theme?.name || "Theme");
      const stamp = String(log?.generatedAt || "").replace(/\D/g, "").slice(0, 14);
      const name = [`ManaShelf-v${version}`, "LAB2", cmd, th, "Build-Diagnostic", stamp ? `${stamp}Z` : null].filter(Boolean).map(safeName).join("__") + ".json";
      download(name, JSON.stringify(log, null, 2), "application/json;charset=utf-8");
    } catch (e) { showError(e); }
  };

  const onAudit = (names, label) => setInspectorFilter(names ? { names, label } : null);

  return (
    <section className="flow-panel lab2-panel">
      <div className="lab2-banner"><b>⚗2 MANASHELF LAB 2</b><span>{t("GENERADOR EXPERIMENTAL · CONSTRUYE DESDE TU COLECCIÓN · NO MODIFICA ARCHIDEKT")}</span></div>
      <div className="flow-head"><span>{t("BUILD FROM COLLECTION")}</span><p>Elegí un Commander, seleccioná uno de sus themes y ManaShelf arma un deck coherente usando las mejores cartas legales disponibles en tu colección.</p></div>

      <div className="lab2-step">
        <div className="lab2-step-head"><b>01</b><div><strong>Commander</strong><small>{t("Buscá una criatura legendaria Commander-legal.")}</small></div></div>
        <CommanderAutocomplete value={query} onChange={setQuery} onSelect={chooseCommander} className="lab2-commander-search" />
        {commander && (
          <div className="chosen lab2-commander-chosen">
            <div className="chosen-card commander-click" onClick={() => openModal("commander", commander)}>
              {commander.image && <img src={commander.image} alt="" />}
              <div>
                <h3>{commander.name}</h3>
                <p>{commander.manaCost || ""} · {commander.typeLine || ""}</p>
                <small>{profileLoading ? profileMessage : Number(commander.ownedQuantity || 0) > 0 ? `EN TU COLECCIÓN · ${commander.ownedQuantity} copia${commander.ownedQuantity === 1 ? "" : "s"}` : t("COMMANDER NO POSEÍDO · el 99 se arma desde tu colección")}</small>
              </div>
            </div>
          </div>
        )}
      </div>

      {profile && (
        <div className="lab2-step">
          <div className="lab2-step-head"><b>02</b><div><strong>Theme</strong><small>{t("La construcción prioriza esta mecánica sin sacrificar estructura, curva ni maná.")}</small></div></div>
          <div className="lab2-theme-grid">
            {(profile.themes || []).length ? profile.themes.map((th, i) => (
              <button type="button" key={i} className={`lab2-theme-choice${theme?.slug === th.slug ? " active" : ""}`} title={minimalThemeDescription(th)} onClick={() => chooseTheme(th)}>
                <strong>{th.name}</strong><small>{th.fallback ? "Fallback balanceado" : th.localFallback ? "Inferido del Commander" : `${Number(th.count || 0).toLocaleString()} decks EDHREC`}</small>
              </button>
            )) : <p className="lab-muted">No encontré themes disponibles para este Commander.</p>}
          </div>
        </div>
      )}

      {profile && (
        <div className="lab2-step">
          <div className="lab2-step-head"><b>03</b><div><strong>{t("Ajustes")}</strong><small>{t("Definen prioridades del armado. El motor sigue respetando legalidad, estructura y validación de maná.")}</small></div></div>
          <div className="lab2-settings-grid">
            <label className="lab2-setting lab2-range-setting"><span><strong>{t("Foco en el theme")}</strong><small>{t("Cuánto espacio priorizar para cartas que realmente expresan el theme elegido.")}</small></span><div><input type="range" min={35} max={100} value={settings.themeFocus} onChange={(e) => setSettings((s) => ({ ...s, themeFocus: Number(e.target.value) }))} /><output>{settings.themeFocus}%</output></div></label>
            <label className="lab2-setting"><span><strong>{t("Ramp")}</strong><small>{t("Cuánta aceleración de maná buscar, además del ajuste automático por curva y coste del Commander.")}</small></span><select value={settings.ramp} onChange={(e) => setSettings((s) => ({ ...s, ramp: e.target.value }))}><option value="standard">{t("Estándar")}</option><option value="more">{t("Más ramp")}</option><option value="heavy">{t("Mucho ramp")}</option></select></label>
            <label className="lab2-setting"><span><strong>Interacción</strong><small>{t("Cuánto espacio dedicar a removal, counters, wipes y otras respuestas.")}</small></span><select value={settings.interaction} onChange={(e) => setSettings((s) => ({ ...s, interaction: e.target.value }))}><option value="standard">{t("Estándar")}</option><option value="more">{t("Más respuestas")}</option></select></label>
            <label className="lab2-setting"><span><strong>{t("Curva")}</strong><small>{t("Cuánto favorecer costes bajos y penalizar cartas caras al ordenar candidatos.")}</small></span><select value={settings.curve} onChange={(e) => setSettings((s) => ({ ...s, curve: e.target.value }))}><option value="normal">{t("Normal")}</option><option value="lower">{t("Más baja")}</option><option value="fastest">{t("Muy baja")}</option></select></label>
            <label className="lab2-setting"><span><strong>{t("Sinergia vs eficiencia")}</strong><small>{t("Balancea piezas que trabajan con el plan contra cartas fuertes y eficientes por sí solas.")}</small></span><select value={settings.synergyBias} onChange={(e) => setSettings((s) => ({ ...s, synergyBias: e.target.value }))}><option value="synergy">{t("Sinergia primero")}</option><option value="balanced">{t("Balanceado")}</option><option value="efficiency">{t("Eficiencia primero")}</option></select></label>
            <label className="lab2-setting"><span><strong>{t("Dependencia del Commander")}</strong><small>{t("Cuánto aceptar cartas cuyo rendimiento baja si el Commander no está disponible.")}</small></span><select value={settings.commanderDependence} onChange={(e) => setSettings((s) => ({ ...s, commanderDependence: e.target.value }))}><option value="conservative">{t("Baja dependencia")}</option><option value="normal">Balanceada</option><option value="all-in">{t("Alta dependencia")}</option></select></label>
            <label className="lab2-setting"><span><strong>{t("Plan de combo")}</strong><small>{t("Es independiente del theme. Usa Commander Spellbook y, si elige un combo, incluye todas sus piezas exactas o ninguna.")}</small></span><select value={settings.comboPolicy} onChange={(e) => setSettings((s) => ({ ...s, comboPolicy: e.target.value }))}><option value="off">{t("No buscar combos")}</option><option value="synergistic">{t("Sólo si encaja")}</option><option value="infinite">{t("Priorizar combo infinito")}</option></select></label>
            <label className="lab2-setting"><span><strong>{t("Base de maná")}</strong><small>{t("Define cuánto priorizar básicas o fixing. Siempre se validan colores producidos, pips, curva y ramp; “Básicas primero” sólo conserva no básicas realmente importantes.")}</small></span><select value={settings.landStyle} onChange={(e) => setSettings((s) => ({ ...s, landStyle: e.target.value }))}><option value="basics">{t("Básicas primero")}</option><option value="safe">{t("Segura · más tierras")}</option><option value="balanced">Balanceada</option><option value="lean">{t("Ajustada · menos tierras")}</option></select></label>
            <label className="lab2-setting lab2-switch-setting"><span><strong>{t("Proteger mazos existentes")}</strong><small>{t("No usa copias que ya están comprometidas en otros mazos cuando la sincronización puede verificarlo.")}</small></span><input type="checkbox" checked={settings.protectExistingDecks} onChange={(e) => setSettings((s) => ({ ...s, protectExistingDecks: e.target.checked }))} /><i aria-hidden="true"></i></label>
          </div>
          <div className="lab2-build-actions">
            <button className="primary big" disabled={!theme || building} onClick={runBuild}>{t("Generar mazo →")}</button>
            <span>{theme ? `Theme seleccionado · ${theme.name}` : t("Elegí un theme para continuar.")}</span>
          </div>
        </div>
      )}

      {building && <div className="lab-loading lab2-loading"><span></span><p>{buildMessage}</p></div>}

      {result && !building && (
        <div>
          <div className="lab2-result-head">
            <div><span>{t("MAZO GENERADO · LAB 2")}</span><h2>{result.build.commander} · {result.build.theme?.name || "Theme"}</h2><p>{result.candidateCount} {t("candidatos legales evaluados")} · builder v{result.builderVersion} · {result.themeSource === "theme-page" ? "EDHREC theme" : result.themeSource === "cache" ? "EDHREC cache" : result.themeSource === "commander-evidence" ? "evidencia del Commander" : result.themeSource === "fallback" ? "balance estructural" : result.themeSource || "EDHREC"}</p></div>
            <div className="lab2-result-actions">
              <button className="ghost" onClick={exportArchidekt}>{t("Exportar para Archidekt ⇩")}</button>
              <button className="ghost" onClick={copyArchidekt}>{copied ? t("Copiado ✓") : t("Copiar para Archidekt")}</button>
              <button className="ghost" onClick={exportLog}>{t("Exportar log diagnóstico")}</button>
              <button className="ghost" onClick={runBuild}>{t("Regenerar")}</button>
            </div>
          </div>
          <Lab2Summary d={result} />
          <Lab2Warnings d={result} />
          <details className="lab2-audit"><summary>{t("Criterio de armado")} <span>{t("objetivos, maná y decisiones")}</span></summary><div className="lab2-audit-body"><Lab2Audit d={result} /></div></details>
          <section className="lab2-deck-section">
            <div className="lab2-section-title"><div><span>DECK LIST</span><h3>{t("Deck list · roles y categorías")}</h3></div><small>{t("La categoría indica por qué la carta ocupa ese slot principal; una carta puede cubrir varios roles.")}</small></div>
            <div className="lab2-table-wrap"><Lab2DeckTable detail={result.deckDetail} profile={profile} /></div>
          </section>
          <section className="lab2-health-title"><span>DECK HEALTH</span><h3>{t("Auditoría del mazo generado")}</h3><p>{t("Se vuelve a evaluar el resultado con el mismo Deck Health y Deck Metrics experimentales del LAB.")}</p></section>
          <div className="lab2-health-workspace">
            <div className="lab-results"><DeckHealthPanel data={result.health} detail={result.deckDetail} onAudit={onAudit} showMetrics={true} /></div>
            <DeckInspector detail={result.deckDetail} filter={inspectorFilter} onClearFilter={() => setInspectorFilter(null)} title="Mazo generado" showCategory />
          </div>
        </div>
      )}
    </section>
  );
}
