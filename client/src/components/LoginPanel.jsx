import { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { login, publicLogin } from "../api.js";

export default function LoginPanel() {
  const { t, tAttr, accessMode, setAccessMode, setSessionId, setSession, showError, clearError, setActivity, clearActivity } = useApp();
  const [username, setUsername] = useState(localStorage.getItem("ms-user") || "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("No hace falta iniciar sesión si la colección es pública.");
  const [busy, setBusy] = useState(false);

  const priv = accessMode === "private";

  const setAccess = (m) => {
    setAccessMode(m);
    setStatus(m === "private"
      ? "La contraseña se envía al bridge de autenticación configurado para obtener una sesión de Archidekt; ManaShelf no la guarda en su caché local."
      : "No hace falta iniciar sesión si la colección es pública.");
  };

  const submit = async () => {
    const u = username.trim();
    if (!u) return showError(new Error(t("Ingresá el usuario de Archidekt.")));
    if (priv && !password) return showError(new Error(t("Ingresá la contraseña para una colección privada.")));
    clearError();
    setBusy(true);
    setStatus(priv ? "Autenticando e importando colección…" : "Leyendo colección pública…");
    setActivity(priv ? `conectando · ${u}` : `colección pública · ${u}`);
    try {
      const d = priv ? await login(u, password) : await publicLogin(u);
      setSessionId(d.sessionId);
      setPassword("");
      localStorage.setItem("ms-user", u);
      setSession({
        username: d.username || u,
        decks: d.decks || [],
        totalDecks: d.totalDecks,
        uniqueCards: d.uniqueCards,
        totalCopies: d.totalCopies,
        archidektRecords: d.archidektRecords,
      });
    } catch (e) {
      showError(e);
      setStatus("No pude abrir la colección.");
    } finally {
      setBusy(false);
      clearActivity();
    }
  };

  return (
    <section className="login-panel">
      <div className="access-tabs">
        <button className={`access-tab${!priv ? " active" : ""}`} onClick={() => setAccess("public")}>{t("Colección pública")}</button>
        <button className={`access-tab${priv ? " active" : ""}`} onClick={() => setAccess("private")}>{t("Colección privada")}</button>
      </div>
      <div className="panel">
        <div className="panel-label">{priv ? t("CONECTAR CUENTA PRIVADA") : t("LEER COLECCIÓN PÚBLICA")}</div>
        <div className="control"><span>@</span><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={tAttr("usuario de Archidekt")} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /></div>
        {priv && (
          <div className="control"><span>••</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tAttr("contraseña")} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /></div>
        )}
        <button className="primary wide" disabled={busy} onClick={submit}>{priv ? t("Conectar cuenta →") : t("Abrir colección →")}</button>
        <div className="status">{t(status)}</div>
      </div>
    </section>
  );
}
