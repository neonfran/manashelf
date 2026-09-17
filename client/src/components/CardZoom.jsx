import { useEffect } from "react";
import { useApp } from "../context/AppContext.jsx";

export default function CardZoom() {
  const { cardZoom, hideCardZoom, t } = useApp();

  useEffect(() => {
    if (!cardZoom) return;
    const onKey = (e) => {
      if (e.key === "Escape") hideCardZoom();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cardZoom, hideCardZoom]);

  if (!cardZoom) return null;
  return (
    <div className="card-zoom-layer" onClick={(e) => { if (e.target === e.currentTarget) hideCardZoom(); }}>
      <button type="button" className="card-zoom-close" aria-label={t("Cerrar")} onClick={hideCardZoom}>×</button>
      <img src={cardZoom.src} alt={cardZoom.alt} />
    </div>
  );
}
