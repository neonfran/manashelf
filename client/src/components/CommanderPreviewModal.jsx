import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { searchCommanders } from "../api.js";
import { key } from "../utils.js";

export default function CommanderPreviewModal({ name, image, largeImage, typeLine = "", manaCost = "", oracleText = "", loading = false }) {
  const { t, showCardZoom } = useApp();
  const [card, setCard] = useState({ name, image, largeImage, typeLine, manaCost, oracleText });
  const [busy, setBusy] = useState(loading);

  useEffect(() => {
    let cancelled = false;
    if (!name) return;
    setBusy(loading);
    (async () => {
      try {
        const d = await searchCommanders(name);
        const exact = (d.results || []).find((x) => key(x.name) === key(name)) || d.results?.[0];
        if (!cancelled && exact) {
          setCard({ name: exact.name, image: exact.image || image, largeImage: exact.largeImage || exact.image || image, typeLine: exact.typeLine || "", manaCost: exact.manaCost || "", oracleText: exact.oracleText || "" });
        }
      } catch {
        // keep whatever we already had
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const normal = card.image || card.largeImage || "";
  const large = card.largeImage || normal;

  return (
    <div className="commander-modal commander-modal-preview">
      {normal ? (
        <div className="commander-preview-image-wrap">
          <img
            className="commander-modal-image commander-preview-trigger"
            src={normal}
            alt={card.name}
            decoding="async"
            fetchPriority="high"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); showCardZoom(large, card.name); }}
          />
          <small>{t("Tocá la carta para ampliarla")}</small>
        </div>
      ) : (
        <div className="commander-preview-image-wrap commander-preview-placeholder"><span>⌛</span></div>
      )}
      <div>
        <div className="kicker">COMMANDER</div>
        <h2 className="commander-preview-name">{card.name}</h2>
        <p className="commander-preview-meta">{card.manaCost} {card.typeLine ? `· ${card.typeLine}` : ""}</p>
        <pre className="commander-preview-oracle">{card.oracleText || (busy ? t("Cargando detalles de la carta…") : t("Sin texto Oracle disponible."))}</pre>
      </div>
    </div>
  );
}
