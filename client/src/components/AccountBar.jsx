import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { logout, syncRetry, decksSync } from "../api.js";
import { elapsed } from "../utils.js";

function syncCopy(s) {
  if (!s) return { title: "Cargando mazos", text: "Preparando caché y verificando mazos…" };
  const done = s.completedDecks || 0, total = s.totalDecks || 0, failed = s.failedDecks || 0;
  if (s.status === "done" || s.status === "done_with_errors") {
    if (failed) return { title: `Carga incompleta · ${done}/${total}`, text: `${failed} mazo${failed === 1 ? "" : "s"} no ${failed === 1 ? "pudo" : "pudieron"} cargarse después de los reintentos automáticos.`, showActions: true };
    return { title: "Mazos cargados", text: `${s.cachedDecks || 0} desde caché · ${s.fetchedDecks || 0} actualizados · carga completa` };
  }
  if (s.phase === "auto_retry") return { title: `Recuperando mazos · ${done}/${total}`, text: s.currentDeck || `Reintento automático ${s.retryRound || 1}/${s.maxRetryRounds || 3}…` };
  if (s.phase === "manual_retry") return { title: `Recargando mazos · ${done}/${total}`, text: s.currentDeck ? `Ahora: ${s.currentDeck}` : "Reintentando los mazos que faltan…" };
  return { title: `Cargando mazos · ${done}/${total}`, text: s.currentDeck ? `Ahora: ${s.currentDeck}` : "Verificando el catálogo completo…" };
}

export default function AccountBar() {
  const { t, session, accessMode, syncState, logoutLocal, openModal, notifySyncRetry } = useApp();
  const [retrying, setRetrying] = useState(false);
  if (!session) return null;

  const copy = syncCopy(syncState);
  const total = Math.max(1, syncState?.totalDecks || 1);
  const done = Math.min(total, syncState?.completedDecks || 0);

  const doLogout = async () => {
    try { await logout(); } catch { /* best-effort */ }
    logoutLocal();
  };
  const doReconnect = async () => {
    try { await logout(); } catch { /* best-effort */ }
    location.reload();
  };
  const retry = async () => {
    setRetrying(true);
    try {
      const hasFailures = Number(syncState?.failedDecks || 0) > 0;
      await (hasFailures ? syncRetry() : decksSync());
      notifySyncRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <section className="account-bar account-panel-v2">
      <div className="account-top-row-v2">
        <div className="account-identity-v2">
          <span className="account-online-dot" aria-hidden="true"></span>
          <div className="account-avatar-v2" aria-hidden="true">{(session.username || "M").trim().charAt(0).toUpperCase()}</div>
          <div className="account-identity-copy-v2">
            <strong className="account-name-v2">{session.username}</strong>
            <span className="account-meta-v2">Archidekt · {Number(session.archidektRecords || 0).toLocaleString("es-AR")} registros · {session.totalDecks} mazos</span>
          </div>
          <em className="account-status-pill-v2">{accessMode === "private" ? t("COLECCIÓN PRIVADA") : t("COLECCIÓN PÚBLICA")}</em>
        </div>
        <div className="account-actions account-actions-v2">
          <button className="account-action-btn" type="button" onClick={() => openModal("cacheAdmin")}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h12m0 0-3-3m3 3-3 3M20 17H8m0 0 3 3m-3-3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span><strong>{t("Caché")}</strong><small>{t("Actualizar / Borrar")}</small></span>
          </button>
          <button className="account-action-btn" type="button" onClick={doReconnect}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 7h12m0 0-3-3m3 3-3 3M17 17H5m0 0 3 3m-3-3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span><strong>{t("Cambiar colección")}</strong></span>
          </button>
          <button className="account-action-btn account-action-danger" type="button" onClick={doLogout}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M9 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span><strong>{t("Cerrar sesión")}</strong></span>
          </button>
        </div>
      </div>

      <div className="account-metrics-v2" aria-label="Resumen de colección">
        <div className="account-metric-v2 metric-purple"><span className="account-metric-icon-v2" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 6h14l-1 14H6L5 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M4 3h16v3H4V3Zm5 7h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></span><div><small>{t("Mazos")}</small><strong>{Number(session.totalDecks || 0).toLocaleString("es-AR")}</strong><span>{t("gestionados")}</span></div></div>
        <div className="account-metric-v2 metric-pink"><span className="account-metric-icon-v2" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m12 3 8 4-8 4-8-4 8-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="m4 12 8 4 8-4M4 17l8 4 8-4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg></span><div><small>{t("Cartas únicas")}</small><strong>{Number(session.uniqueCards || 0).toLocaleString("es-AR")}</strong><span>{t("nombres de carta")}</span></div></div>
        <div className="account-metric-v2 metric-teal"><span className="account-metric-icon-v2" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="10" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M6 15H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" /></svg></span><div><small>{t("Copias")}</small><strong>{Number(session.totalCopies || 0).toLocaleString("es-AR")}</strong><span>{t("copias en total")}</span></div></div>
        <div className="account-metric-v2 metric-amber"><span className="account-metric-icon-v2" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 5h14v14H5z" stroke="currentColor" strokeWidth="1.8" /><path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></span><div><small>{t("Registros Archidekt")}</small><strong>{Number(session.archidektRecords || 0).toLocaleString("es-AR")}</strong><span>{t("filas informadas")}</span></div></div>
      </div>

      {accessMode === "private" && (
        <div className="sync-mini sync-panel-v2">
          <div className="sync-title-v2"><span className="sync-symbol-v2">↻</span><strong>{t(copy.title)}</strong></div>
          <div className="sync-layout-v2">
            <div className="sync-progress-v2">
              <div className="sync-head-v2"><span></span><strong>{done} / {total}</strong></div>
              <progress max={total} value={done}></progress>
              <div className="sync-sub-v2"><span>{t(copy.text)}</span></div>
            </div>
            <span className="sync-time-pill-v2">{elapsed(syncState?.startedAt)}</span>
          </div>
          {copy.showActions && (
            <div className="sync-actions">
              <button className="tiny" disabled={retrying}>{t("Ver errores")}</button>
              <button className="tiny accent" disabled={retrying} onClick={retry}>{t("↻ Recargar mazos")}</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
