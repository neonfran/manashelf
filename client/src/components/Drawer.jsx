import { useApp } from "../context/AppContext.jsx";
import { archidektAddCards } from "../api.js";
import { download } from "../utils.js";

export default function Drawer() {
  const { drawerOpen, setDrawerOpen, shortlist, setShortlist, history, accessMode, activeDeckDetail, showError, t } = useApp();
  if (!drawerOpen) return null;

  const remove = (name) => setShortlist((prev) => prev.filter((x) => x.name !== name));
  const clear = () => setShortlist([]);
  const exportTxt = () => download("manashelf-shortlist.txt", shortlist.map((x) => `1 ${x.name}`).join("\n"));
  const applyToDeck = async () => {
    const names = shortlist.filter((x) => x.owned).map((x) => x.name);
    if (!names.length) return alert(t("No hay cartas poseídas en la shortlist."));
    if (!confirm(`¿Agregar ${names.length} cartas a "${activeDeckDetail.name}" en Archidekt? Esta acción modifica el deck real.`)) return;
    try {
      const d = await archidektAddCards({ deckId: activeDeckDetail.id, names, confirm: "CONFIRMAR" });
      alert(`Archidekt actualizado: ${d.affected} cartas agregadas.`);
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div className="drawer">
      <div className="drawer-head">
        <strong>{drawerOpen === "shortlist" ? `Shortlist · ${shortlist.length}` : t("Historial")}</strong>
        <button onClick={() => setDrawerOpen(null)}>×</button>
      </div>
      <div className="drawer-body">
        {drawerOpen === "shortlist" ? (
          <>
            <div className="drawer-actions">
              <button className="ghost" onClick={exportTxt}>{t("Exportar TXT")}</button>
              <button className="ghost" onClick={clear}>{t("Vaciar")}</button>
              {accessMode === "private" && activeDeckDetail ? <button className="primary" onClick={applyToDeck}>{t("Agregar al deck actual")}</button> : null}
            </div>
            {shortlist.map((x) => (
              <div className="drawer-item" key={x.name}>
                <div><strong>{x.name}</strong><small>{x.role} · {x.owned ? `${x.available} disponible${x.available === 1 ? "" : "s"}` : t("No está en tu colección")}</small></div>
                <button className="tiny" onClick={() => remove(x.name)}>{t("Quitar")}</button>
              </div>
            ))}
          </>
        ) : history.length ? (
          history.map((h, i) => (
            <div className="drawer-item" key={i}>
              <div><strong>{h.commander || ""}</strong><small>{new Date(h.ts).toLocaleString()} · {h.mode}{h.deck ? ` · ${h.deck}` : ""}</small></div>
              <span>{h.summary?.recommendedOwned || 0} propias</span>
            </div>
          ))
        ) : (
          <p className="status">Todavía no hay análisis guardados.</p>
        )}
      </div>
    </div>
  );
}
