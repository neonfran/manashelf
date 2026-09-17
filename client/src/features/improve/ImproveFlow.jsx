import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import DeckPicker from "../../components/DeckPicker.jsx";
import DeckInspector from "../../components/DeckInspector.jsx";
import DeckHealthPanel from "../shared/DeckHealthPanel.jsx";
import ResultsPanel from "../shared/ResultsPanel.jsx";
import AnalysisLoading from "../shared/AnalysisLoading.jsx";
import { deckDetail as fetchDeckDetail, searchCommanders, analyze, deckHealth } from "../../api.js";
import { download, key } from "../../utils.js";

export default function ImproveFlow() {
  const { t, decks, showError, clearError, addHistory, setActiveDeckDetail, setActivity, clearActivity, setSubject, showSelection } = useApp();
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [commander, setCommander] = useState(null);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [deckError, setDeckError] = useState(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeData, setAnalyzeData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [tab, setTab] = useState("deckcheck");
  const [inspectorFilter, setInspectorFilter] = useState(null);
  const [hideInDeck, setHideInDeck] = useState(false);

  useEffect(() => { setActiveDeckDetail(detail); }, [detail, setActiveDeckDetail]);

  const selectDeck = async (id) => {
    setSelectedDeckId(id);
    setDetail(null); setCommander(null); setDeckError(null);
    setAnalyzeData(null); setHealthData(null); setInspectorFilter(null);
    setLoadingDeck(true);
    const catalogDeck = decks.find((d) => d.id === Number(id));
    setActivity(`cargando mazo · ${catalogDeck?.name || id}`);
    try {
      const dd = await fetchDeckDetail(id);
      if (!dd.commander) throw new Error(t("No pude identificar el Commander del mazo."));
      const fallbackImage = dd.commanderImage || catalogDeck?.commanderImage || "";
      const fallbackLarge = dd.commanderImageLarge || catalogDeck?.commanderImageLarge || fallbackImage;
      setDetail(dd);
      setCommander({ name: dd.commander, image: fallbackImage, largeImage: fallbackLarge });
      searchCommanders(dd.commander).then((search) => {
        const exact = (search.results || []).find((x) => key(x.name) === key(dd.commander)) || search.results?.[0];
        if (exact) setCommander(exact);
      }).catch(() => {});
      setSubject("improve", "Mazo", dd.name);
      showSelection("Mazo", dd.name);
    } catch (e) {
      setDeckError(e.message || String(e));
    } finally {
      setLoadingDeck(false);
      clearActivity();
    }
  };

  const runAnalyze = async () => {
    if (!detail || !selectedDeckId) return showError(new Error("Seleccioná un mazo primero."));
    clearError();
    setAnalyzing(true);
    setAnalyzeData(null); setHealthData(null);
    setActivity(`analizando · ${detail.name}`);
    try {
      const [a, h] = await Promise.all([
        analyze({ commander: commander.name, includeMissing: true }),
        deckHealth(selectedDeckId, true),
      ]);
      setAnalyzeData(a);
      setHealthData(h);
      setTab("deckcheck");
      addHistory({ ts: Date.now(), mode: "improve", commander: commander.name, deck: detail.name, summary: a.summary });
    } catch (e) {
      showError(e);
    } finally {
      setAnalyzing(false);
      clearActivity();
    }
  };

  const exportDetail = () => {
    if (!detail) return showError(new Error("Seleccioná un mazo primero."));
    const commanders = (detail.commanders || [detail.commander]).filter(Boolean);
    const commanderKeys = new Set(commanders.map(key));
    const lines = (detail.mainboard || []).filter((c) => !commanderKeys.has(key(c.name))).map((c) => `${Number(c.quantity || 1)} ${c.name}`);
    const text = [...(commanders.length ? ["Commander", ...commanders.map((c) => `1 ${c}`), ""] : []), "Deck", ...lines].join("\n");
    download(`${key(detail.name).replace(/\s+/g, "-") || "manashelf-deck"}.txt`, text);
  };

  const onAudit = (names, label) => setInspectorFilter(names ? { names, label } : null);

  return (
    <>
      <section className="flow-panel">
        <div className="flow-head"><span>{t("MEJORAR MI MAZO")}</span></div>
        <DeckPicker onSelect={selectDeck} />
        {loadingDeck && <div className="inline-loading"><i></i><span>{t("Leyendo Commander, Size y cartas del deck…")}</span></div>}
        {detail && (
          <div className="deck-summary">
            <div className="deck-art commander-click">{commander?.image ? <img src={commander.image} alt="" /> : <span className="deck-art-placeholder">♛</span>}</div>
            <div className="deck-info">
              <div className="panel-label">{t("DECK SELECCIONADO")}</div>
              <h2>{detail.name}</h2>
              <div className="deck-commander"><span>Commander</span><strong>{(detail.commanders || [detail.commander]).filter(Boolean).join(" + ")}</strong></div>
              <div className="deck-counts"><span><b>{t("SIZE")}</b> · <strong>{detail.size}</strong> {t("cartas")}</span><small>Size real del deck · {detail.excludedCount || 0} carta{Number(detail.excludedCount || 0) === 1 ? "" : "s"} de Sideboard/Maybeboard excluida{Number(detail.excludedCount || 0) === 1 ? "" : "s"}</small></div>
              <a className="ghost-link" href={detail.url} target="_blank" rel="noopener noreferrer">{t("Abrir en Archidekt ↗")}</a>
            </div>
            <div className="improve-actions">
              <button className="primary big" disabled={analyzing} onClick={runAnalyze}>{analyzing ? t("Analizando…") : t("Analizar mazo →")}</button>
              <button className="ghost" onClick={exportDetail}>{t("Exportar decklist ⇩")}</button>
            </div>
          </div>
        )}
        {deckError && <div className="status bad">{deckError}</div>}
        {analyzing && <div className="lab-loading"><span></span><p>{t("Analizando recomendaciones, estructura, curva e identidad…")}</p></div>}
      </section>

      {healthData && !analyzing && (
        <nav className="ribbon-tabs floating" aria-label="Secciones del análisis">
          <button type="button" className={tab === "deckcheck" ? "active" : ""} onClick={() => setTab("deckcheck")}>{t("Chequeo del mazo")}</button>
          <button type="button" className={tab === "changes" ? "active" : ""} onClick={() => setTab("changes")}>SWAPS</button>
          <button type="button" className={tab === "recommendations" ? "active" : ""} onClick={() => setTab("recommendations")}>{t("EDHREComendaciones")}</button>
        </nav>
      )}

      {healthData && !analyzing && tab !== "recommendations" && (
        <div className="lab-workspace">
          <div className="lab-results improve-health-results">
            <DeckHealthPanel data={healthData} detail={detail} onAudit={onAudit} showMetrics={false} sections={tab === "changes" ? ["changes"] : ["summary", "health", "rules", "identity"]} />
          </div>
          <DeckInspector detail={detail} filter={inspectorFilter} onClearFilter={() => setInspectorFilter(null)} title={detail?.name} />
        </div>
      )}

      {analyzeData && !analyzing && tab === "recommendations" && (
        <ResultsPanel data={analyzeData} commander={commander} deckDetail={detail} mode="improve" selectedDeckId={selectedDeckId} resultModeLabel={t("MEJORAR MI MAZO")} hideInDeck={hideInDeck} onToggleHideInDeck={() => setHideInDeck((v) => !v)} />
      )}
    </>
  );
}
