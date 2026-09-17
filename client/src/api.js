let sessionId = null;
export function setSessionId(id) {
  sessionId = id;
}
export function getSessionId() {
  return sessionId;
}
export const authHeaders = () => ({ "Content-Type": "application/json", "X-ManaShelf-Session": sessionId || "" });
const sessionHeader = () => ({ "X-ManaShelf-Session": sessionId || "" });

export async function req(url, opt = {}) {
  const r = await fetch(url, opt);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "Error"), { detail: d.detail });
  return d;
}

// --- Login / session ---
export const login = (username, password) =>
  req("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
export const publicLogin = (username) =>
  req("/api/public-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
export const logout = () => req("/api/logout", { method: "POST", headers: authHeaders(), body: "{}" });

// --- Decks / sync ---
export const deckCatalog = (hydrate = false) => req(`/api/deck-catalog${hydrate ? "?hydrate=1" : ""}`, { headers: sessionHeader() });
export const syncStatus = () => req("/api/sync-status", { headers: sessionHeader() });
export const syncRetry = () => req("/api/sync-retry", { method: "POST", headers: authHeaders(), body: "{}" });
export const decksSync = () => req("/api/decks/sync", { method: "POST", headers: authHeaders(), body: "{}" });
export const decksSizes = () => req("/api/decks/sizes", { headers: authHeaders() });
export const deckDetail = (deckId) => req("/api/deck-detail", { method: "POST", headers: authHeaders(), body: JSON.stringify({ deckId }) });

// --- Commanders ---
export const searchCommanders = (q) => req(`/api/commanders?q=${encodeURIComponent(q)}`);
export const collectionLookup = (name) => req(`/api/collection/lookup?name=${encodeURIComponent(name)}`, { headers: authHeaders() });

// --- Explore / Improve analysis ---
export const analyze = (payload) => req("/api/analyze", { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
export const collectionStats = (username) => req("/api/collection", { method: "POST", headers: authHeaders(), body: JSON.stringify({ username }) });
export const alternatives = (card) => req("/api/alternatives", { method: "POST", headers: authHeaders(), body: JSON.stringify({ card }) });

// --- Rank / Discover ---
export const ownedCommandersStart = () => req("/api/owned-commanders/start", { method: "POST", headers: authHeaders(), body: "{}" });
export const ownedCommandersStatus = (jobId) => req(`/api/owned-commanders/status?jobId=${encodeURIComponent(jobId)}`);
export const ownedCommanders = () => req("/api/owned-commanders", { headers: authHeaders() });
export const edhrecTagCatalog = () => req("/api/edhrec/tag-catalog");
export const edhrecTagCommanders = (tags) => req("/api/edhrec/tag-commanders", { method: "POST", headers: authHeaders(), body: JSON.stringify({ tags }) });
export const compareCommanders = (commanders) => req("/api/compare-commanders", { method: "POST", headers: authHeaders(), body: JSON.stringify({ commanders }) });
export const buildability = (commander) => req("/api/buildability", { method: "POST", headers: authHeaders(), body: JSON.stringify({ commander }) });
export const rankCommandersStart = () => req("/api/rank-commanders/start", { method: "POST", headers: authHeaders(), body: "{}" });
export const rankCommandersStatus = (jobId) => req(`/api/rank-commanders/status?jobId=${encodeURIComponent(jobId)}`);

// --- LAB (Deck Health) ---
export const deckHealth = (deckId, includeMetrics = false) =>
  req("/api/lab/deck-health", { method: "POST", headers: authHeaders(), body: JSON.stringify({ deckId, includeMetrics }) });

// --- LAB 2 ---
export const lab2Access = () => req("/api/lab2/access", { headers: sessionHeader() });
export const lab2Unlock = (password) => req("/api/lab2/unlock", { method: "POST", headers: authHeaders(), body: JSON.stringify({ password }) });
export const lab2Profile = (commander) => req("/api/lab2/profile", { method: "POST", headers: authHeaders(), body: JSON.stringify({ commander }) });
export const lab2Progress = () => req("/api/lab2/progress", { headers: authHeaders() });
export const lab2Build = (payload) => req("/api/lab2/build", { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
export const lab2BuildLog = (id) => req(`/api/lab2/build-log?id=${encodeURIComponent(id)}`, { headers: authHeaders() });

// --- LAB 3 ---
export const lab3Status = () => req("/api/lab3/status", { headers: authHeaders() });
export const lab3Profile = (commander) => req("/api/lab3/profile", { method: "POST", headers: authHeaders(), body: JSON.stringify({ commander }) });
export const lab3Progress = () => req("/api/lab3/progress", { headers: authHeaders() });
export const lab3Build = (payload) => req("/api/lab3/build", { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
export const lab3BuildLog = (id) => req(`/api/lab3/build-log?id=${encodeURIComponent(id)}`, { headers: authHeaders() });
export const lab3RecertStart = (payload) => req("/api/lab3/recert/start", { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
export const lab3RecertStatus = () => req("/api/lab3/recert/status", { headers: authHeaders() });
export const lab3RecertCancel = () => req("/api/lab3/recert/cancel", { method: "POST", headers: authHeaders(), body: "{}" });
export const lab3StressStart = (payload) => req("/api/lab3/stress/start", { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
export const lab3StressStatus = () => req("/api/lab3/stress/status", { headers: authHeaders() });
export const lab3StressCancel = () => req("/api/lab3/stress/cancel", { method: "POST", headers: authHeaders(), body: "{}" });

// --- Cache admin ---
export const cacheStatus = () => req("/api/cache/status", { headers: sessionHeader() });
export const cacheDelete = (section) => req("/api/cache/delete", { method: "POST", headers: authHeaders(), body: JSON.stringify({ section }) });
export const cacheRecache = (section) => req("/api/cache/recache", { method: "POST", headers: authHeaders(), body: JSON.stringify({ section }) });
export const cacheJob = (id) => req(`/api/cache/job?id=${encodeURIComponent(id)}`);

// --- Archidekt actions ---
export const archidektAddCards = (payload) => req("/api/archidekt/add-cards", { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
export const archidektCreateDeck = (payload) => req("/api/archidekt/create-deck", { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
