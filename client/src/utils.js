export const key = (s) => String(s || "").toLocaleLowerCase("en-US");

export function elapsed(ms) {
  if (!ms) return "";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function ago(ts) {
  if (!ts) return "sin fecha";
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return "hace segundos";
  if (sec < 3600) return `hace ${Math.round(sec / 60)} min`;
  if (sec < 86400) return `hace ${Math.round(sec / 3600)} h`;
  return `hace ${Math.round(sec / 86400)} días`;
}

export function download(name, text, type = "text/plain;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

let recentDecks = JSON.parse(localStorage.getItem("ms-recent-decks") || "{}");
export function touchRecentDeck(id) {
  recentDecks[String(id)] = Date.now();
  localStorage.setItem("ms-recent-decks", JSON.stringify(recentDecks));
}
export function sortByRecent(list) {
  return [...list].sort((a, b) => {
    const ua = Date.parse(a.updatedAt || "") || 0, ub = Date.parse(b.updatedAt || "") || 0;
    if (ua !== ub) return ub - ua;
    const ta = recentDecks[String(a.id)] || 0, tb = recentDecks[String(b.id)] || 0;
    if (ta !== tb) return tb - ta;
    return 0;
  });
}

export function deckCachedCommander(cards) {
  const c = (cards || []).find((x) => (x.categories || []).some((y) => String(y).toLowerCase() === "commander"));
  return c?.name || c?.display_name || null;
}
