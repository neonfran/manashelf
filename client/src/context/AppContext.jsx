import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { translate, translateAttr } from "../i18n.js";
import { setSessionId as setApiSessionId } from "../api.js";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() => (localStorage.getItem("ms-theme") === "light" ? "light" : "dark"));
  const [lang, setLang] = useState(() => (localStorage.getItem("ms-lang") === "en" ? "en" : "es"));
  const [mode, setModeState] = useState("explore");
  const [sessionId, setSessionIdState] = useState(null);
  const [accessMode, setAccessMode] = useState("public");
  const [session, setSession] = useState(null); // { username, decks, collectionStats, ... }
  const [lab2Unlocked, setLab2Unlocked] = useState(false);
  const [activeDeckDetail, setActiveDeckDetail] = useState(null); // Improve mode's selected deck, used by the shortlist drawer
  const [decks, setDecks] = useState([]);
  const [syncState, setSyncState] = useState(null); // latest /api/sync-status payload
  const [syncRetryTick, setSyncRetryTick] = useState(0);
  const [error, setErrorState] = useState(null);
  const [modal, setModal] = useState(null); // { type, props }
  const [drawerOpen, setDrawerOpen] = useState(null); // null | "shortlist" | "history"
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ms-history") || "[]");
    } catch {
      return [];
    }
  });
  const addHistory = useCallback((entry) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 30);
      localStorage.setItem("ms-history", JSON.stringify(next));
      return next;
    });
  }, []);
  const [cardZoom, setCardZoom] = useState(null); // { src, alt }
  const [terminalActivity, setTerminalActivityState] = useState(null); // busy message, e.g. "Consultando EDHREC…"
  const [terminalSubjects, setTerminalSubjects] = useState({}); // { [mode]: {kind, value} } commander/deck in focus per mode
  const [terminalNotice, setTerminalNotice] = useState(null); // { text, until } short "seleccionado // ..." flash
  const noticeTimer = useRef(null);
  const [shortlist, setShortlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ms-shortlist") || "[]");
    } catch {
      return [];
    }
  });
  const errorTimer = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ms-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("ms-lang", lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem("ms-shortlist", JSON.stringify(shortlist));
  }, [shortlist]);

  const t = useCallback((text) => (lang === "en" ? translate(text) : text), [lang]);
  const tAttr = useCallback((text) => (lang === "en" ? translateAttr(text) : text), [lang]);

  const setSessionIdAndApi = useCallback((id) => {
    setApiSessionId(id);
    setSessionIdState(id);
  }, []);

  const showError = useCallback((e) => {
    clearTimeout(errorTimer.current);
    setErrorState({ message: e?.message || String(e), detail: e?.detail || null });
    errorTimer.current = setTimeout(() => setErrorState(null), 6500);
  }, []);
  const clearError = useCallback(() => {
    clearTimeout(errorTimer.current);
    setErrorState(null);
  }, []);

  const logoutLocal = useCallback(() => {
    setSessionIdAndApi(null);
    setSession(null);
    setAccessMode("public");
    setLab2Unlocked(false);
  }, [setSessionIdAndApi]);

  const setActivity = useCallback((message) => setTerminalActivityState(message ? String(message) : null), []);
  const clearActivity = useCallback(() => setTerminalActivityState(null), []);
  const setSubject = useCallback((forMode, kind, value) => {
    setTerminalSubjects((prev) => ({ ...prev, [forMode]: value ? { kind, value } : null }));
  }, []);
  const showSelection = useCallback((kind, value) => {
    if (!value) return;
    clearTimeout(noticeTimer.current);
    const translatedKind = lang === "en" ? translate(String(kind || "item").trim()) : String(kind || "item").trim();
    const text = lang === "en" ? `selected // ${translatedKind} · ${String(value).trim()}` : `seleccionado // ${translatedKind} · ${String(value).trim()}`;
    setTerminalNotice({ text });
    noticeTimer.current = setTimeout(() => setTerminalNotice(null), 2650);
  }, [lang]);

  const toggleShortlist = useCallback((card) => {
    setShortlist((prev) => {
      const has = prev.some((x) => x.name.toLocaleLowerCase("en-US") === card.name.toLocaleLowerCase("en-US"));
      if (has) return prev.filter((x) => x.name.toLocaleLowerCase("en-US") !== card.name.toLocaleLowerCase("en-US"));
      return [...prev, { name: card.name, commander: card.commander || "", role: (card.roles || [])[0] || "Utility", owned: card.owned !== false, available: card.availableQuantity || 0 }];
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")),
      lang,
      setLang,
      t,
      tAttr,
      mode,
      setMode: setModeState,
      sessionId,
      setSessionId: setSessionIdAndApi,
      accessMode,
      setAccessMode,
      session,
      setSession,
      lab2Unlocked,
      setLab2Unlocked,
      error,
      showError,
      clearError,
      logoutLocal,
      shortlist,
      setShortlist,
      toggleShortlist,
      modal,
      openModal: (type, props = {}) => setModal({ type, props }),
      closeModal: () => setModal(null),
      drawerOpen,
      setDrawerOpen,
      cardZoom,
      showCardZoom: (src, alt = "Card") => src && setCardZoom({ src, alt }),
      hideCardZoom: () => setCardZoom(null),
      history,
      addHistory,
      activeDeckDetail,
      setActiveDeckDetail,
      decks,
      setDecks,
      syncState,
      setSyncState,
      syncRetryTick,
      notifySyncRetry: () => setSyncRetryTick((x) => x + 1),
      terminalActivity,
      setActivity,
      clearActivity,
      terminalSubject: terminalSubjects[mode] || null,
      setSubject,
      terminalNotice,
      showSelection,
    }),
    [theme, lang, t, tAttr, mode, sessionId, setSessionIdAndApi, accessMode, session, lab2Unlocked, error, showError, clearError, logoutLocal, shortlist, toggleShortlist, modal, drawerOpen, cardZoom, history, addHistory, activeDeckDetail, decks, syncState, syncRetryTick, terminalActivity, setActivity, clearActivity, terminalSubjects, mode, setSubject, terminalNotice, showSelection]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
