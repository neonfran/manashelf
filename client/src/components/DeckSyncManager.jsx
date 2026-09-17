import { useEffect, useRef } from "react";
import { useApp } from "../context/AppContext.jsx";
import { deckCatalog, syncStatus, decksSizes } from "../api.js";

// Mounted once at the app root. Mirrors the original app's background polling: keeps the
// deck catalog (Commander identity + images) and cross-deck usage sync status up to date
// while a session is open, without any component needing to manage it itself.
export default function DeckSyncManager() {
  const { sessionId, accessMode, setDecks, setSyncState, syncRetryTick } = useApp();
  const syncTimerRef = useRef(null);
  const sizeTimerRef = useRef(null);
  const sizeAttemptsRef = useRef(0);
  const finalizedRef = useRef(null);

  const mergeDeckRows = (rows) => {
    setDecks((prev) => {
      const byId = new Map(prev.map((d) => [Number(d.id), d]));
      return (rows || []).map((row) => {
        const current = byId.get(Number(row.id)) || {};
        const keep = { commander: current.commander || null, commanderImage: current.commanderImage || null, commanderImageLarge: current.commanderImageLarge || null, previewMethod: current.previewMethod || null };
        const merged = { ...current, ...row };
        if (!row.commander && keep.commander) merged.commander = keep.commander;
        if (!row.commanderImage && keep.commanderImage) merged.commanderImage = keep.commanderImage;
        if (!row.commanderImageLarge && keep.commanderImageLarge) merged.commanderImageLarge = keep.commanderImageLarge;
        if (!row.previewMethod && keep.previewMethod) merged.previewMethod = keep.previewMethod;
        return merged;
      });
    });
  };

  const loadCatalog = async () => {
    try {
      let d = await deckCatalog(false);
      if (Number(d.missingMetadata || 0) > 0 || Number(d.missingImages || 0) > 0) {
        d = await deckCatalog(true);
      }
      mergeDeckRows(d.decks || []);
    } catch (e) {
      console.warn("[deck-catalog] load failed", e);
    }
  };

  const pollSync = async () => {
    if (!sessionId || accessMode !== "private") return null;
    try {
      const s = await syncStatus();
      setSyncState(s);
      if (s.status === "done" || s.status === "done_with_errors") {
        if (syncTimerRef.current) { clearInterval(syncTimerRef.current); syncTimerRef.current = null; }
        const finalizedKey = Number(s.finishedAt || 0) || `${s.status}:${s.completedDecks}:${s.failedDecks}`;
        if (finalizedRef.current !== finalizedKey) {
          finalizedRef.current = finalizedKey;
          await loadCatalog();
        }
      }
      return s;
    } catch {
      return null;
    }
  };

  const pollDeckSizes = async () => {
    if (!sessionId) return;
    sizeAttemptsRef.current++;
    try {
      const r = await decksSizes();
      const sizes = r.sizes || {};
      let pending = 0;
      setDecks((prev) => {
        let changed = false;
        const next = prev.map((d) => {
          if (d.exactMainCount == null) {
            if (sizes[d.id] != null) { changed = true; return { ...d, exactMainCount: sizes[d.id], mainCount: sizes[d.id] }; }
            pending++;
          }
          return d;
        });
        return changed ? next : prev;
      });
      if ((!pending || sizeAttemptsRef.current >= 20) && sizeTimerRef.current) { clearInterval(sizeTimerRef.current); sizeTimerRef.current = null; }
    } catch {
      if (sizeAttemptsRef.current >= 20 && sizeTimerRef.current) { clearInterval(sizeTimerRef.current); sizeTimerRef.current = null; }
    }
  };

  useEffect(() => {
    if (!sessionId) {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      if (sizeTimerRef.current) clearInterval(sizeTimerRef.current);
      syncTimerRef.current = null; sizeTimerRef.current = null;
      finalizedRef.current = null; sizeAttemptsRef.current = 0;
      return;
    }
    (async () => {
      if (accessMode === "private") {
        const first = await pollSync();
        if (first && first.status !== "done" && first.status !== "done_with_errors" && !syncTimerRef.current) {
          syncTimerRef.current = setInterval(pollSync, 1200);
        }
      } else if (syncRetryTick === 0) {
        await loadCatalog();
      }
      if (syncRetryTick === 0) {
        sizeAttemptsRef.current = 0;
        sizeTimerRef.current = setInterval(pollDeckSizes, 3000);
        pollDeckSizes();
      }
    })();
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      if (sizeTimerRef.current) clearInterval(sizeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, syncRetryTick]);

  return null;
}
