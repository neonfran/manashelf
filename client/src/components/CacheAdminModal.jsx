import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { cacheStatus, cacheDelete, cacheRecache, cacheJob } from "../api.js";
import { ago } from "../utils.js";

const LABELS = { decks: "Decks Archidekt", usage: "Uso de cartas", scryfall: "Scryfall / metadatos", commanders: "Catálogo de Commanders", edhrec: "EDHREC" };

export default function CacheAdminModal() {
  const { t } = useApp();
  const [sections, setSections] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null); // { message, current, total, errors }
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);

  const refresh = async () => {
    try {
      const d = await cacheStatus();
      setSections(d.sections);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  useEffect(() => {
    cancelled.current = false;
    refresh();
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async (section) => {
    setBusy(true);
    setProgress({ message: t("Iniciando…"), current: 0, total: 1 });
    try {
      let job = (await cacheRecache(section)).job;
      while (job.status === "running") {
        setProgress({ message: job.message || t("Actualizando…"), current: job.current || 0, total: Math.max(1, job.total || 1) });
        await new Promise((r) => setTimeout(r, 650));
        if (cancelled.current) return;
        job = (await cacheJob(job.id)).job;
      }
      setProgress({ message: job.message || "Listo", current: job.total || 1, total: Math.max(1, job.total || 1), errors: job.errors });
      await refresh();
    } catch (e) {
      setProgress(null);
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const del = async (section) => {
    const label = section === "all" ? "todas las secciones" : LABELS[section];
    if (!confirm(`¿Borrar caché de ${label}? Se reconstruirá cuando vuelva a hacer falta.`)) return;
    await cacheDelete(section);
    await refresh();
  };

  return (
    <div>
      <div className="kicker">ADMINISTRAR CACHÉ</div>
      <h2>{t("Caché local")}</h2>
      <p>Usá <strong>{t("Actualizar")}</strong> para refrescar datos conservando el caché válido anterior, o <strong>{t("Borrar")}</strong> para eliminar una sección. Podés copiar <code>.manashelf-cache</code> desde la versión anterior. ManaShelf reutiliza lo compatible y nunca borra un caché válido si una actualización falla.</p>
      <div className="drawer-actions cache-admin-top">
        <button className="primary" disabled={busy} onClick={() => start("all")}>{t("Actualizar todo ahora")}</button>
        <button className="ghost danger-ghost" disabled={busy} onClick={() => del("all")}>{t("Borrar todo")}</button>
      </div>
      <div className="cache-rows">
        {error ? <p className="status bad">{error}</p> : !sections ? <p className="status">Leyendo estado…</p> : (
          <>
            {Object.entries(sections).map(([k, v]) => (
              <div className="cache-row" key={k}>
                <div><strong>{LABELS[k]}</strong><small>{v.count} entradas · {ago(v.updatedAt)}</small></div>
                <div className="cache-actions">
                  <button className="ghost tiny" disabled={busy} onClick={() => start(k)}>{t("Actualizar")}</button>
                  <button className="ghost tiny danger-action" disabled={busy} onClick={() => del(k)}>{t("Borrar")}</button>
                </div>
              </div>
            ))}
            <div className="cache-row all-cache">
              <div><strong>{t("Todo")}</strong><small>Actualiza o elimina todas las secciones</small></div>
              <div className="cache-actions">
                <button className="ghost tiny" disabled={busy} onClick={() => start("all")}>Actualizar todo</button>
                <button className="ghost tiny danger-action" disabled={busy} onClick={() => del("all")}>Borrar todo</button>
              </div>
            </div>
          </>
        )}
      </div>
      {progress && (
        <div className="cache-progress">
          <strong>{progress.message}</strong>
          <progress max={progress.total} value={progress.current} />
          <small>{progress.errors?.length ? `${progress.errors.length} error(es); se conservó el caché anterior cuando fue posible.` : (progress.total ? `${progress.current} / ${progress.total}` : "")}</small>
        </div>
      )}
    </div>
  );
}
