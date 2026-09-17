import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";

const MODE_LABELS = {
  explore: "Explorar Commander",
  improve: "Mejorar mi mazo",
  rank: "Descubrir Commanders",
  lab: "ManaShelf Lab",
  lab2: "ManaShelf Lab 2",
  lab3: "ManaShelf Lab 3",
};

function useTerminalText() {
  const { t, mode, terminalActivity, terminalSubject, terminalNotice } = useApp();
  const [display, setDisplay] = useState("ready");
  const lastRef = useRef("");
  const timerRef = useRef(null);

  useEffect(() => {
    const target = terminalActivity
      ? `procesando // ${terminalActivity}`
      : terminalNotice
        ? terminalNotice.text
        : terminalSubject
          ? `${terminalSubject.value}  //  ${t(MODE_LABELS[mode] || "")}`
          : t(MODE_LABELS[mode] || "ready");
    const clean = String(target || "ready").replace(/\s+/g, " ").trim();
    if (clean === lastRef.current) return;
    lastRef.current = clean;
    clearInterval(timerRef.current);
    let i = 0;
    setDisplay("");
    timerRef.current = setInterval(() => {
      i++;
      setDisplay(clean.slice(0, i));
      if (i >= clean.length) clearInterval(timerRef.current);
    }, 22);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalActivity, terminalSubject, terminalNotice, mode, t]);

  return display;
}

export default function Header() {
  const { theme, toggleTheme, lang, setLang, t, shortlist, setDrawerOpen, terminalActivity } = useApp();
  const text = useTerminalText();

  return (
    <header>
      <div className="brand"><span>✦</span> ManaShelf <small>v2.5.57</small><span className="beta-pill">BETA</span></div>
      <div className={`terminal-status${terminalActivity ? " busy" : ""}`} aria-live="polite" aria-label="Contexto actual">
        <span className="terminal-prompt">›</span>
        <span>{text}</span>
        <i className="terminal-cursor" aria-hidden="true"></i>
      </div>
      <div className="header-actions">
        <button className="ghost" title={t("Cambiar entre tema oscuro y claro")} aria-label={t("Cambiar tema")} onClick={toggleTheme}>{theme === "light" ? "☀" : "☾"}</button>
        <button className="ghost language-toggle" title={lang === "es" ? "Switch to Español" : "Cambiar a English"} aria-label={t("Cambiar idioma")} onClick={() => setLang(lang === "es" ? "en" : "es")}>{lang.toUpperCase()}</button>
        <button className="ghost" onClick={() => setDrawerOpen("history")}>{t("Historial")}</button>
        <button className="ghost" onClick={() => setDrawerOpen("shortlist")}>★ Shortlist <b>{shortlist.length}</b></button>
      </div>
    </header>
  );
}
