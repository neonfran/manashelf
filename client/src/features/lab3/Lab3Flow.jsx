import { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import CommanderAutocomplete from "../../components/CommanderAutocomplete.jsx";
import DeckInspector from "../../components/DeckInspector.jsx";
import DeckHealthPanel from "../shared/DeckHealthPanel.jsx";
import Lab3HarnessPanel from "./Lab3HarnessPanel.jsx";
import { Lab3Summary, Lab3Warnings, Lab3Context, Lab3DeckTable } from "./lab3AuditRender.jsx";
import {
  lab3Profile as fetchLab3Profile, lab3Progress, lab3Build, lab3BuildLog,
  lab3RecertStart, lab3RecertStatus, lab3RecertCancel,
  lab3StressStart, lab3StressStatus, lab3StressCancel,
} from "../../api.js";
import { download } from "../../utils.js";

const DEFAULT_SETTINGS = { themeFocus: 72, ramp: "standard", interaction: "standard", curve: "normal", synergyBias: "balanced", commanderDependence: "normal", comboPolicy: "off", landStyle: "balanced", protectExistingDecks: true };

export default function Lab3Flow() {
  const { t, showError, clearError, openModal, setActivity, clearActivity, setSubject, showSelection } = useApp();
  const [query, setQuery] = useState("");
  const [commander, setCommander] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState("Validando Commander en Semantic DB…");
  const [theme, setTheme] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [building, setBuilding] = useState(false);
  const [buildMessage, setBuildMessage] = useState("Preparando Semantic DB…");
  const [result, setResult] = useState(null);
  const [inspectorFilter, setInspectorFilter] = useState(null);
  const [copied, setCopied] = useState(false);
  const progressTimer = useRef(null);

  useEffect(() => () => clearInterval(progressTimer.current), []);
  useEffect(() => {
    if (profileLoading) setActivity(`LAB 3 · ${profileMessage}`);
    else if (building) setActivity(`LAB 3 · ${buildMessage}`);
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
    setProfileMessage("Validando Commander en Semantic DB…");
    progressTimer.current = setInterval(async () => {
      const p = await lab3Progress().catch(() => null);
      if (p?.message && p.active) setProfileMessage(p.message);
    }, 350);
    try {
      const p = await fetchLab3Profile(c.name);
      setProfile(p);
      const pc = p.commander || c;
      setCommander({ ...c, ...pc, image: pc.image || c.image, largeImage: pc.imageLarge || c.largeImage });
      setSubject("lab3", "Commander", c.name);
      showSelection("LAB 3 Commander", c.name);
    } catch (e) {
      showError(e);
    } finally {
      clearInterval(progressTimer.current);
      setProfileLoading(false);
    }
  };

  const themeSourceLabel = (th) => {
    const mode = th.themeContractMode || th.mode || (th.semanticSupported === false ? "external_fallback" : "semantic");
    if (th.localSemantic) return "Inferido por Semantic DB";
    if (th.fallback) return "Fallback estructural";
    if (mode === "external_fallback") return `${Number(th.count || 0).toLocaleString()} decks EDHREC · Fallback EDHREC`;
    return `${Number(th.count || 0).toLocaleString()} decks EDHREC · Contrato semántico`;
  };

  const chooseTheme = (th) => { setTheme(th); setResult(null); };

  const runBuild = async () => {
    if (!commander?.name) return showError(new Error("Elegí un Commander."));
    if (!theme) return showError(new Error("Elegí un theme."));
    clearError();
    setResult(null);
    setBuilding(true);
    setBuildMessage("Preparando Semantic DB…");
    progressTimer.current = setInterval(async () => {
      const p = await lab3Progress().catch(() => null);
      if (p?.message) setBuildMessage(p.message);
    }, 450);
    try {
      const d = await lab3Build({ commander: commander.name, theme, settings });
      setResult(d);
    } catch (e) {
      showError(e);
    } finally {
      clearInterval(progressTimer.current);
      setBuilding(false);
    }
  };

  const archidektText = () => (result?.build?.deck || []).map((c) => {
    const category = String(c.category || c.selectionPhase || "Uncategorized").replace(/[[\]\r\n]/g, " ").trim() || "Uncategorized";
    return `${Number(c.quantity || 1)}x ${c.name} [${category}]`;
  }).join("\n");
  const safeName = (name) => String(name || "manashelf-deck").normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "manashelf-deck";
  const exportDeck = () => { if (!result) return showError(new Error("Generá un mazo primero.")); download(`${safeName(commander?.name)}-lab3-archidekt.txt`, archidektText()); };
  const copyArchidekt = async () => {
    if (!result) return showError(new Error("Generá un mazo primero."));
    try { await navigator.clipboard.writeText(archidektText()); setCopied(true); setTimeout(() => setCopied(false), 1300); }
    catch { showError(new Error("No pude copiar el decklist al portapapeles.")); }
  };
  const exportLog = async () => {
    if (!result?.diagnosticLogId) return showError(new Error("No hay log LAB 3 disponible."));
    try {
      const log = await lab3BuildLog(result.diagnosticLogId);
      const version = String(log?.appVersion || "unknown").replace(/^v/i, "");
      const cmd = String(log?.input?.commander || commander?.name || "Commander");
      const th = String(log?.input?.theme?.name || theme?.name || "Theme");
      const stamp = String(log?.generatedAt || "").replace(/\D/g, "").slice(0, 14);
      const name = [`ManaShelf-v${version}`, "LAB3", cmd, th, "Build-Diagnostic", stamp ? `${stamp}Z` : null].filter(Boolean).map(safeName).join("__") + ".json";
      download(name, JSON.stringify(log, null, 2), "application/json;charset=utf-8");
    } catch (e) { showError(e); }
  };

  const onAudit = (names, label) => setInspectorFilter(names ? { names, label } : null);
  const deckDetail = result?.deckDetail || null;

  return (
    <section className="flow-panel lab2-panel lab3-panel">
      <div className="lab2-banner lab3-banner"><b>⚗3 MANASHELF LAB 3</b><span>{t("SEMANTIC BUILDER · CONTRATOS + CONTEXTO DE DECK · LAB 2 PERMANECE INTACTO")}</span></div>
      <div className="flow-head"><span>{t("SEMANTIC BUILD FROM COLLECTION")}</span><p>{t("Construye desde tu colección usando la Semantic DB, contratos de roles/arquetipos y dependencias del deck. EDHREC sólo ordena candidatos semánticamente compatibles.")}</p></div>

      <div className="lab2-step">
        <div className="lab2-step-head"><b>01</b><div><strong>Commander</strong><small>{t("Debe existir en el índice semántico y ser Commander-legal.")}</small></div></div>
        <CommanderAutocomplete value={query} onChange={setQuery} onSelect={chooseCommander} className="lab2-commander-search" />
        {commander && (
          <div className="chosen lab2-commander-chosen">
            <div className="chosen-card commander-click" onClick={() => openModal("commander", commander)}>
              {commander.image && <img src={commander.image} alt="" />}
              <div>
                <h3>{commander.name}</h3>
                <p>{commander.manaCost || ""} · {commander.typeLine || ""}</p>
                <small>{profileLoading ? profileMessage : `${Number(commander.ownedQuantity || 0) > 0 ? `EN TU COLECCIÓN · ${commander.ownedQuantity} copia${commander.ownedQuantity === 1 ? "" : "s"}` : t("COMMANDER NO POSEÍDO · el 99 se arma desde tu colección")} · ${commander.semanticStatus || "semantic"}`}</small>
              </div>
            </div>
          </div>
        )}
      </div>

      {profile && (
        <div className="lab2-step">
          <div className="lab2-step-head"><b>02</b><div><strong>Theme</strong><small>{t("El contrato semántico decide compatibilidad; EDHREC puede ordenar, no fabricar afinidad.")}</small></div></div>
          <div className="lab2-theme-grid">
            {(profile.themes || []).length ? profile.themes.map((th, i) => (
              <button type="button" key={i} className={`lab2-theme-choice${theme?.slug === th.slug ? " active" : ""}`} onClick={() => chooseTheme(th)}>
                <strong>{th.name}</strong><small>{themeSourceLabel(th)}</small>
              </button>
            )) : <p className="lab-muted">{t("No encontré themes para este Commander.")}</p>}
          </div>
        </div>
      )}

      {profile && (
        <div className="lab2-step">
          <div className="lab2-step-head"><b>03</b><div><strong>{t("Ajustes")}</strong><small>{t("Prioridades del builder contextual. No usa Classification 7 para decidir el deck.")}</small></div></div>
          <div className="lab2-settings-grid">
            <label className="lab2-setting lab2-range-setting"><span><strong>{t("Foco en el theme")}</strong><small>{t("Prioridad de densidad temática semántica.")}</small></span><div><input type="range" min={35} max={100} value={settings.themeFocus} onChange={(e) => setSettings((s) => ({ ...s, themeFocus: Number(e.target.value) }))} /><output>{settings.themeFocus}%</output></div></label>
            <label className="lab2-setting"><span><strong>{t("Ramp")}</strong><small>{t("Aceleración estructural, no simples mana abilities.")}</small></span><select value={settings.ramp} onChange={(e) => setSettings((s) => ({ ...s, ramp: e.target.value }))}><option value="standard">{t("Estándar")}</option><option value="more">{t("Más ramp")}</option><option value="heavy">{t("Mucho ramp")}</option></select></label>
            <label className="lab2-setting"><span><strong>Interacción</strong><small>{t("Removal, counters y graveyard hate con dirección semántica.")}</small></span><select value={settings.interaction} onChange={(e) => setSettings((s) => ({ ...s, interaction: e.target.value }))}><option value="standard">{t("Estándar")}</option><option value="more">{t("Más respuestas")}</option></select></label>
            <label className="lab2-setting"><span><strong>{t("Curva")}</strong><small>{t("Preferencia por costes bajos sin ignorar el contexto.")}</small></span><select value={settings.curve} onChange={(e) => setSettings((s) => ({ ...s, curve: e.target.value }))}><option value="normal">{t("Normal")}</option><option value="lower">{t("Más baja")}</option><option value="fastest">{t("Muy baja")}</option></select></label>
            <label className="lab2-setting"><span><strong>{t("Sinergia vs eficiencia")}</strong><small>{t("Balance entre contratos/contexto y señales externas.")}</small></span><select value={settings.synergyBias} onChange={(e) => setSettings((s) => ({ ...s, synergyBias: e.target.value }))}><option value="synergy">{t("Sinergia primero")}</option><option value="balanced">{t("Balanceado")}</option><option value="efficiency">{t("Eficiencia primero")}</option></select></label>
            <label className="lab2-setting"><span><strong>{t("Dependencia del Commander")}</strong><small>{t("Penaliza cartas cuyo plan necesita al Commander disponible.")}</small></span><select value={settings.commanderDependence} onChange={(e) => setSettings((s) => ({ ...s, commanderDependence: e.target.value }))}><option value="conservative">{t("Baja dependencia")}</option><option value="normal">Balanceada</option><option value="all-in">{t("Alta dependencia")}</option></select></label>
            <label className="lab2-setting"><span><strong>{t("Plan de combo")}</strong><small>{t("Usa Commander Spellbook. Si elige un paquete, LAB 3 bloquea todas sus piezas exactas o ninguna.")}</small></span><select value={settings.comboPolicy} onChange={(e) => setSettings((s) => ({ ...s, comboPolicy: e.target.value }))}><option value="off">{t("No buscar combos")}</option><option value="synergistic">{t("Sólo si encaja")}</option><option value="infinite">{t("Priorizar combo infinito")}</option></select></label>
            <label className="lab2-setting"><span><strong>{t("Base de maná")}</strong><small>{t("Básicas ilimitadas; no básicas desde tu colección.")}</small></span><select value={settings.landStyle} onChange={(e) => setSettings((s) => ({ ...s, landStyle: e.target.value }))}><option value="basics">{t("Básicas primero")}</option><option value="safe">{t("Segura · más tierras")}</option><option value="balanced">Balanceada</option><option value="lean">{t("Ajustada · menos tierras")}</option></select></label>
            <label className="lab2-setting lab2-switch-setting"><span><strong>{t("Proteger mazos existentes")}</strong><small>{t("No toma copias comprometidas cuando el uso cruzado está sincronizado.")}</small></span><input type="checkbox" checked={settings.protectExistingDecks} onChange={(e) => setSettings((s) => ({ ...s, protectExistingDecks: e.target.checked }))} /><i aria-hidden="true"></i></label>
          </div>
          <div className="lab2-build-actions">
            <button className="primary big" disabled={!theme || building} onClick={runBuild}>{t("Generar con LAB 3 →")}</button>
            <span>{theme ? `Theme seleccionado · ${theme.name}` : t("Elegí un theme para continuar.")}</span>
          </div>
        </div>
      )}

      <Lab3HarnessPanel
        kind="recert"
        title="Field pre-check 3 + Stress 200 + unseen holdout 60"
        description="Una sola corrida. Primero reconstruye Bruna/Voltron, Kotis/Voltron y Animar/+1/+1 Counters con la colección conectada y los settings de validación acordados. Si los tres pasan los gates genéricos, continúa automáticamente con Stress v4 200 y después con el holdout fijo unseen 60. Los tres bloques se exportan separados y ninguno se usa como entrenamiento."
        startLabel="Recertificar LAB 3 · 3 + 200 + 60"
        defaultTotal={263}
        showError={showError}
        api={{
          start: () => lab3RecertStart({ stressRuns: 200, stressSeed: "manashelf-lab3-stress-4", unseenRuns: 60 }),
          status: lab3RecertStatus,
          cancel: lab3RecertCancel,
          exportUrl: "/api/lab3/recert/export",
          exportFallbackName: "ManaShelf-LAB3-RECERTIFICATION-3x200x60.zip",
        }}
      />
      <Lab3HarnessPanel
        kind="stress"
        title="Corpus automático · 200 builds"
        description="Selecciona Commanders y themes de forma estratificada sobre el pool global Commander-legal del runtime semántico, registra semántica directa, inferida o fallback efectivo, ejecuta LAB 3 y agrupa anomalías por familia. El stress es deliberadamente independiente de tu colección y no modifica LAB 2 ni tus mazos."
        startLabel="Ejecutar 200 builds"
        defaultTotal={200}
        showError={showError}
        api={{
          start: () => lab3StressStart({ runs: 200, seed: "manashelf-lab3-stress-4" }),
          status: lab3StressStatus,
          cancel: lab3StressCancel,
          exportUrl: "/api/lab3/stress/export",
          exportFallbackName: "ManaShelf-LAB3-STRESS-CORPUS-v4.zip",
        }}
      />

      {building && <div className="lab-loading lab2-loading"><span></span><p>{buildMessage}</p></div>}

      {result && !building && (
        <div>
          <div className="lab2-result-head">
            <div><span>{t("MAZO GENERADO · LAB 3")}</span><h2>{commander?.name || "Commander"} · {result.build?.theme || theme?.name || "Theme"}</h2></div>
            <div className="lab2-result-actions">
              <button className="ghost" onClick={exportDeck}>{t("Exportar para Archidekt ⇩")}</button>
              <button className="ghost" onClick={copyArchidekt}>{copied ? t("Copiado ✓") : t("Copiar para Archidekt")}</button>
              <button className="ghost" onClick={exportLog}>{t("Exportar log semántico")}</button>
              <button className="ghost" onClick={runBuild}>{t("Regenerar")}</button>
            </div>
          </div>
          <Lab3Summary d={result} commanderName={commander?.name} themeName={theme?.name} />
          <Lab3Warnings d={result} />
          <details className="lab2-audit" open><summary>{t("Contexto semántico")} <span>{t("dependencias, coverage y bottlenecks")}</span></summary><div className="lab2-audit-body"><Lab3Context d={result} /></div></details>
          <section className="lab2-deck-section">
            <div className="lab2-section-title"><div><span>DECK LIST</span><h3>{t("Selección contextual LAB 3")}</h3></div><small>{t("El status semántico expone cuándo una carta todavía depende de cobertura parcial.")}</small></div>
            <div className="lab2-table-wrap"><Lab3DeckTable d={result} /></div>
          </section>
          <section className="lab2-health-title"><span>{t("DECK HEALTH · COMPARACIÓN")}</span><h3>{t("Auditoría del mazo generado")}</h3><p>{t("Evalúa el resultado de LAB 3 con la misma interfaz de Deck Health y Deck Metrics de LAB 2 para poder compararlos. Esta auditoría ocurre después del build y no interviene en la selección semántica.")}</p></section>
          <div className="lab2-health-workspace">
            <div className="lab-results">{result.health && <DeckHealthPanel data={result.health} detail={deckDetail} onAudit={onAudit} showMetrics={true} />}</div>
            <DeckInspector detail={deckDetail} filter={inspectorFilter} onClearFilter={() => setInspectorFilter(null)} title="Mazo generado" showCategory />
          </div>
        </div>
      )}
    </section>
  );
}
