import { useEffect, useRef, useState } from "react";
import { authHeaders } from "../../api.js";

async function downloadBlob(url, fallbackName) {
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { const j = await r.json(); msg = j.error || j.detail || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const blob = await r.blob();
  const cd = r.headers.get("content-disposition") || "";
  const m = cd.match(/filename="?([^";]+)"?/i);
  const name = m?.[1] || fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Shared UI for LAB 3's recertification (3 + 200 + 60) and stress-harness (200 builds)
// panels: both poll a start/status/cancel job every second and offer a ZIP export once done.
export default function Lab3HarnessPanel({ kind, title, description, startLabel, defaultTotal, api, showError }) {
  const [status, setStatus] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const poll = async () => {
    try {
      const s = await api.status();
      setStatus(s);
      if (!s.active && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    } catch (e) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      showError(e);
    }
  };

  const start = async () => {
    try {
      const s = await api.start();
      setStatus(s);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(poll, 1000);
    } catch (e) { showError(e); }
  };
  const cancel = async () => {
    try { setStatus(await api.cancel()); } catch (e) { showError(e); }
  };
  const doExport = async () => {
    try { await downloadBlob(api.exportUrl, api.exportFallbackName); } catch (e) { showError(e); }
  };

  const active = Boolean(status?.active);
  const total = Number(status?.total ?? status?.planned ?? status?.requested ?? defaultTotal);
  const processed = Number(status?.processed ?? (Number(status?.completed || 0) + Number(status?.failed || 0)) ?? 0);
  const failed = Number(status?.failed || 0);
  const anomalous = Number(status?.anomalous ?? status?.summary?.anomalous ?? 0);
  const clusters = status?.clusters || [];
  const exportReady = Boolean(status?.exportReady);

  let summaryText = kind === "recert"
    ? "263 builds · field pre-check 3 + Stress v4 200 + unseen 60 · evidencia validation-only"
    : "Seed fija: manashelf-lab3-stress-4 · pool global · reproducible";
  if (kind === "recert") {
    const decision = status?.summary?.decision || null;
    const stage = status?.stage || "idle";
    summaryText = active ? `${processed}/${total} procesados · etapa ${stage} · ${failed} fallidos · ${anomalous} con anomalías` : decision ? `${processed}/${total} procesados · ${failed} fallidos · ${anomalous} con anomalías · ${decision}` : summaryText;
  } else if (status) {
    const completed = Number(status.completed || 0), planned = Number(status.planned || status.requested || defaultTotal);
    const summary = status.summary;
    summaryText = summary ? `${completed}/${planned} completos · ${failed} fallidos · ${Number(summary.anomalous || 0)} con anomalías · ${Number(summary.uniqueThemes || 0)} themes · seed ${status.seed}` : active ? `${completed}/${planned} casos · pool global · seed ${status?.seed || "manashelf-lab3-stress-4"}` : summaryText;
  }

  return (
    <section className="lab3-stress-panel" aria-labelledby={`lab3-${kind}-title`}>
      <div><span>{kind === "recert" ? "LAB 3 · RECERTIFICACIÓN" : "LAB 3 · STRESS HARNESS v4"}</span><h3 id={`lab3-${kind}-title`}>{title}</h3><p>{description}</p></div>
      <div className="lab3-stress-actions">
        <button type="button" className={kind === "recert" ? "primary" : "ghost"} disabled={active} onClick={start}>{startLabel}</button>
        {active && <button type="button" className="ghost" onClick={cancel}>Detener {kind === "recert" ? "recertificación" : ""}</button>}
        {exportReady && <button type="button" className="primary" onClick={doExport}>{kind === "recert" ? "Exportar evidencia completa" : "Exportar corpus ZIP"}</button>}
      </div>
      <div className="lab3-stress-progress">
        <div><strong>{status?.message || "Listo para " + (kind === "recert" ? "recertificar." : "ejecutar.")}</strong><small>{summaryText}</small></div>
        <progress max={Math.max(1, total)} value={Math.min(total, processed)}></progress>
      </div>
      {clusters.length > 0 && (
        <div className="lab3-stress-clusters">
          {clusters.slice(0, kind === "recert" ? 12 : 10).map((c, i) => (
            <span key={i} data-severity={c.severity || "medium"} title={c.examples?.[0]?.message || ""}>{c.family} · {Number(c.count || 0)}</span>
          ))}
        </div>
      )}
    </section>
  );
}
