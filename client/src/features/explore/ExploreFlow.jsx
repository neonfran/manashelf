import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import CommanderAutocomplete from "../../components/CommanderAutocomplete.jsx";
import ResultsPanel from "../shared/ResultsPanel.jsx";
import AnalysisLoading from "../shared/AnalysisLoading.jsx";
import { analyze, collectionLookup } from "../../api.js";

export default function ExploreFlow() {
  const { t, sessionId, showError, clearError, addHistory, setActivity, clearActivity, setSubject, showSelection } = useApp();
  const [query, setQuery] = useState("");
  const [commander, setCommander] = useState(null);
  const [ownedStatus, setOwnedStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const chooseCommander = async (c) => {
    setData(null);
    setCommander(c);
    setQuery(c.name);
    setOwnedStatus("Consultando colección…");
    setActivity(`colección · ${c.name}`);
    try {
      const own = await collectionLookup(c.name);
      setOwnedStatus(own.owned ? `EN TU COLECCIÓN · Tenés ${own.quantity}` : t("NO ESTÁ EN TU COLECCIÓN"));
    } catch {
      setOwnedStatus("");
    } finally {
      clearActivity();
      setSubject("explore", "Commander", c.name);
      showSelection("Commander", c.name);
    }
  };

  const runAnalysis = async () => {
    if (!sessionId) return showError(new Error(t("Conectá una colección primero.")));
    if (!commander?.name) return showError(new Error("Elegí un Commander."));
    clearError();
    setLoading(true);
    setActivity(`analizando · ${commander.name}`);
    try {
      const d = await analyze({ commander: commander.name, includeMissing: true });
      setData(d);
      addHistory({ ts: Date.now(), mode: "explore", commander: commander.name, deck: null, summary: d.summary });
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
      clearActivity();
    }
  };

  return (
    <>
      <section className="flow-panel">
        <div className="flow-head"><span>{t("EXPLORAR COMMANDER")}</span><p>{t("Buscá una criatura legendaria y cruzá EDHREC con tu colección.")}</p></div>
        <CommanderAutocomplete value={query} onChange={setQuery} onSelect={chooseCommander} />
        {commander && (
          <div className="chosen">
            <div className="chosen-card commander-click">
              {commander.image ? <img src={commander.image} alt="" /> : null}
              <div>
                <h3>{commander.name}</h3>
                <p>{commander.manaCost} · {commander.typeLine}</p>
                <small className="owned-commander-status">{ownedStatus}</small>
              </div>
            </div>
            <button className="primary big" onClick={runAnalysis}>{t("Analizar colección →")}</button>
          </div>
        )}
      </section>

      {loading && <AnalysisLoading mode="explore" />}
      {data && !loading && <ResultsPanel data={data} commander={commander} mode="explore" resultModeLabel={t("EXPLORAR COMMANDER")} />}
    </>
  );
}
