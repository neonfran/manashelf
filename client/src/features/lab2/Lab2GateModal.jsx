import { useRef, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { lab2Unlock } from "../../api.js";

export default function Lab2GateModal({ target = "lab3" }) {
  const { t, tAttr, setLab2Unlocked, setMode, closeModal } = useApp();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const unlock = async () => {
    if (!password) { inputRef.current?.focus(); return; }
    setBusy(true);
    setError("");
    try {
      await lab2Unlock(password);
      setLab2Unlocked(true);
      closeModal();
      setMode(target);
    } catch (e) {
      setError(e.message || String(e));
      inputRef.current?.select();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lab2-gate">
      <div className="kicker">{t("Herramientas de validación")} · {t("ACCESO RESTRINGIDO")}</div>
      <h2>{t("Herramientas de validación")}</h2>
      <p>{t("Stress y recertificación son procesos internos de validación; no hacen falta para armar mazos.")}</p>
      <div className="control">
        <span>⌁</span>
        <input
          ref={inputRef}
          type="password"
          autoComplete="current-password"
          placeholder={tAttr("Contraseña")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); unlock(); } }}
          autoFocus
        />
      </div>
      <p className="lab2-gate-error">{error}</p>
      <button className="primary" disabled={busy} onClick={unlock}>{t("Continuar")}</button>
    </div>
  );
}
