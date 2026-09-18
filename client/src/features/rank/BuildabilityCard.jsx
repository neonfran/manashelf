import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { typeBucket } from "../shared/resultsLogic.js";

function OwnedSection({ section, index }) {
  const { t } = useApp();
  const [open, setOpen] = useState(index === 0);
  return (
    <details className="build-section" open={open} onToggle={(e) => setOpen(e.target.open)}>
      <summary onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}><span>{section.label}</span><b>{t(`${section.cards.length} en colección`)}</b></summary>
      {open && (
        <div className="grid build-owned-grid">
          {section.cards.map((c) => {
            const available = Number(c.availableQuantity || 0), owned = Number(c.ownedQuantity || 0);
            const syn = Math.round(Number(c.synergy || 0) * 100), inc = Number(c.inclusionPct || 0);
            return (
              <article className="card build-owned-card" data-available={available > 0 ? 1 : 0} key={c.name}>
                <div className="pic build-card-img">
                  {c.image && <img src={c.imageNormal || c.image} loading="lazy" decoding="async" alt="" />}
                  <span className={`stock-badge${available > 0 ? "" : " missing-stock"}`}><b>{available > 0 ? t(`Disponible ${available}/${owned}`) : t("Sin copia disponible")}</b><small>{t(`Tenés ${owned}`)}</small></span>
                </div>
                <div className="card-body">
                  <h4>{c.name}</h4>
                  <div className="metrics"><span className="syn">{t(`${syn >= 0 ? "+" : ""}${syn}% sinergia`)}</span><span>{t(`${inc}% inclusión`)}</span></div>
                  <div className="role-line"><span className="role">{typeBucket(c)}</span><span className="role">CMC {Number(c.cmc || 0)}</span></div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </details>
  );
}

export default function BuildabilityCard({ x }) {
  const { t } = useApp();
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const sections = x.ownedSections || [];
  return (
    <div className="build-card">
      <div className="kicker">{t("QUÉ COMMANDER PUEDO ARMAR")}</div>
      <h3>{x.name}</h3>
      <span className="owned-flag">{t("Commander en tu colección")}</span>
      <p className="build-lead">{t(`Tenés ${x.owned} de ${x.recommendations} recomendaciones EDHREC. El ranking usa esta cantidad absoluta.`)}</p>
      <div className="build-controls">
        <label className="switch-line"><input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} /> <span>{t("Mostrar solo cartas con copia disponible")}</span></label>
      </div>
      <div className="build-metrics">
        <div className="build-metric"><span>{t("EN COLECCIÓN")}</span><strong>{x.owned}</strong></div>
        <div className="build-metric"><span>{t("CON COPIA DISPONIBLE")}</span><strong>{x.available}</strong></div>
        <div className="build-metric"><span>{t("SIN COPIA DISPONIBLE")}</span><strong>{x.occupied}</strong></div>
      </div>
      <div className={`build-owned-sections${onlyAvailable ? " only-available" : ""}`}>
        <h4>{t("Secciones EDHREC · solo cartas de tu colección")}</h4>
        {sections.length ? sections.map((s, i) => <OwnedSection section={s} index={i} key={s.id || i} />) : <p className="status">{t("No encontré coincidencias poseídas.")}</p>}
      </div>
      <style>{`.build-owned-sections.only-available .build-owned-card[data-available="0"]{display:none}`}</style>
    </div>
  );
}
