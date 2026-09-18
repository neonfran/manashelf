import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import DeckPicker from "../../components/DeckPicker.jsx";
import DeckInspector from "../../components/DeckInspector.jsx";
import DeckHealthPanel from "../shared/DeckHealthPanel.jsx";
import { deckDetail as fetchDeckDetail, searchCommanders, deckHealth } from "../../api.js";
import { download, key } from "../../utils.js";

export default function LabFlow() {
  const { t, tAttr, decks, showError, setActivity, clearActivity, setSubject, showSelection } = useApp();
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [commander, setCommander] = useState(null);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [deckError, setDeckError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [inspectorFilter, setInspectorFilter] = useState(null);

  const selectDeck = async (id) => {
    setSelectedDeckId(id);
    setDetail(null); setCommander(null); setDeckError(null); setHealthData(null); setInspectorFilter(null);
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
      setSubject("lab", "Mazo", dd.name);
      showSelection("Mazo", dd.name);
    } catch (e) {
      setDeckError(e.message || String(e));
    } finally {
      setLoadingDeck(false);
      clearActivity();
    }
  };

  const runAnalyze = async () => {
    if (!selectedDeckId) return showError(new Error(t("Seleccioná un mazo primero.")));
    setAnalyzing(true);
    setHealthData(null);
    setActivity(`clasificando · ${detail?.name || ""}`);
    try {
      const d = await deckHealth(selectedDeckId, true);
      setHealthData(d);
    } catch (e) {
      showError(e);
    } finally {
      setAnalyzing(false);
      clearActivity();
    }
  };

  const exportDetail = () => {
    if (!detail) return showError(new Error(t("Seleccioná un mazo primero.")));
    const commanders = (detail.commanders || [detail.commander]).filter(Boolean);
    const commanderKeys = new Set(commanders.map(key));
    const lines = (detail.mainboard || []).filter((c) => !commanderKeys.has(key(c.name))).map((c) => `${Number(c.quantity || 1)} ${c.name}`);
    const text = [...(commanders.length ? ["Commander", ...commanders.map((c) => `1 ${c}`), ""] : []), "Deck", ...lines].join("\n");
    download(`${key(detail.name).replace(/\s+/g, "-") || "manashelf-deck"}.txt`, text);
  };

  const onAudit = (names, label) => setInspectorFilter(names ? { names, label } : null);

  return (
    <section id="labFlow" className="flow-panel lab-panel">
      <div className="lab-banner"><b>⚗ MANASHELF LAB</b><span>{t("FUNCIÓN EXPERIMENTAL · SOLO LECTURA · NO MODIFICA ARCHIDEKT")}</span></div>
      <div className="flow-head"><span>{t("SALUD DEL MAZO + SALUD DE TEMÁTICAS")}</span><p>{t("Analizá un mazo con métricas experimentales sin modificar tu lista en Archidekt.")}</p></div>
      <DeckPicker onSelect={selectDeck} placeholder={tAttr("Buscar mazo para analizar…")} />
      {loadingDeck && <div className="inline-loading"><i></i><span>{t("Leyendo Commander, Size y cartas del deck…")}</span></div>}
      {detail && (
        <div className="deck-summary lab-deck-summary">
          <div className="deck-art commander-click">{commander?.image ? <img src={commander.image} alt="" /> : <span className="deck-art-placeholder">♛</span>}</div>
          <div className="deck-info">
            <div className="panel-label">{t("DECK SELECCIONADO")}</div>
            <h2>{detail.name}</h2>
            <div className="deck-commander"><span>Commander</span><strong>{(detail.commanders || [detail.commander]).filter(Boolean).join(" + ")}</strong></div>
            <div className="deck-counts"><span><b>{t("SIZE")}</b> · <strong>{detail.size}</strong> {t("cartas")}</span></div>
            <a className="ghost-link" href={detail.url} target="_blank" rel="noopener noreferrer">{t("Abrir en Archidekt ↗")}</a>
          </div>
          <div className="improve-actions">
            <button className="primary big" disabled={analyzing} onClick={runAnalyze}>{analyzing ? t("Analizando…") : t("Analizar Deck Health →")}</button>
            <button className="ghost" onClick={exportDetail}>{t("Exportar decklist ⇩")}</button>
          </div>
        </div>
      )}
      {deckError && <div className="status bad">{deckError}</div>}
      {analyzing && <div className="lab-loading"><span></span><p>{t("Clasificando cartas y detectando el plan del mazo…")}</p></div>}

      {healthData && !analyzing && (
        <div className="lab-workspace">
          <div className="lab-results">
            <DeckHealthPanel data={healthData} detail={detail} onAudit={onAudit} showMetrics={true} />
          </div>
          <DeckInspector id="labDeckInspector" detail={detail} filter={inspectorFilter} onClearFilter={() => setInspectorFilter(null)} title={detail?.name} />
        </div>
      )}
    </section>
  );
}
