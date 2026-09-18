import { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

const STAGES_EXPLORE = ["Consultando recomendaciones EDHREC…", "Cruzando recomendaciones con tu colección…", "Consultando metadatos necesarios de Scryfall…", "Preparando recomendaciones y disponibilidad…"];
const STAGES_IMPROVE = ["Consultando recomendaciones EDHREC…", "Cruzando recomendaciones con tu colección…", "Calculando copias disponibles y uso en otros mazos…", "Consultando metadatos necesarios de Scryfall…", "Preparando resultados…"];

export default function AnalysisLoading({ mode }) {
  const { t } = useApp();
  const stages = mode === "improve" ? STAGES_IMPROVE : STAGES_EXPLORE;
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(sec);
      setStage((s) => Math.max(s, Math.min(stages.length - 1, Math.floor(sec / 3))));
    }, 500);
    return () => clearInterval(timer);
  }, [stages.length]);

  return (
    <section className="loading">
      <i></i>
      <div className="analysis-progress">
        <strong>{t(mode === "improve" ? "Analizando tu mazo…" : "Analizando Commander…")}</strong>
        <span>{t(stages[stage])}</span>
        <div className="analysis-track"><b></b></div>
        <small>{t(`${elapsed}s · etapa ${stage + 1}/${stages.length} · el porcentaje exacto depende de EDHREC/Scryfall`)}</small>
      </div>
    </section>
  );
}
