import { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { key, download } from "../../utils.js";
import { mainboardSet, contextualAvailable, usedOutsideCurrentDeck, statusOf, typeBucket, categoryDesc } from "./resultsLogic.js";

export default function ResultsPanel({ data, commander, deckDetail = null, mode, selectedDeckId = null, resultModeLabel, hideInDeck = false, onToggleHideInDeck }) {
  const { t, shortlist, toggleShortlist, openModal } = useApp();
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [sort, setSort] = useState("synergy");
  const [view, setView] = useState("cards");
  const [activeId, setActiveId] = useState(() => (data.categories.find((c) => c.matches.length) || data.categories[0])?.id || null);

  const mb = useMemo(() => mainboardSet(deckDetail), [deckDetail]);
  const roles = useMemo(() => [...new Set(data.categories.flatMap((c) => c.matches.flatMap((x) => x.roles || [])))].sort(), [data]);
  const themes = data.commanderThemes || [];

  const matchesFilters = (c) => {
    const st = statusOf(c, mb, mode, selectedDeckId);
    if (collectionFilter === "owned" && st === "missing") return false;
    if (collectionFilter === "available" && !contextualAvailable(c, mode, selectedDeckId)) return false;
    if (roleFilter && !(c.roles || []).includes(roleFilter)) return false;
    if (themeFilter && !(c.themeTags || []).includes(themeFilter)) return false;
    return true;
  };

  const active = data.categories.find((c) => c.id === activeId) || null;

  const filtered = useMemo(() => {
    if (!active) return [];
    let a = active.matches.filter(matchesFilters);
    if (mode === "improve" && hideInDeck) a = a.filter((c) => !mb.has(key(c.name)));
    if (sort === "synergy") a = [...a].sort((x, y) => y.synergy - x.synergy || y.inclusionPct - x.inclusionPct);
    else if (sort === "inclusion") a = [...a].sort((x, y) => y.inclusionPct - x.inclusionPct);
    else if (sort === "availability") a = [...a].sort((x, y) => y.availableQuantity - x.availableQuantity);
    else if (sort === "name") a = [...a].sort((x, y) => x.name.localeCompare(y.name));
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, collectionFilter, roleFilter, themeFilter, sort, hideInDeck, mode, mb]);

  const summary = data.summary;
  const ownedN = Number(summary.recommendedOwned || 0), availableN = Number(summary.withFreeCopies || 0), missingN = Number(summary.missing || 0);
  const sync = data.deckSync || {};

  const exportResults = () => {
    const unique = new Map();
    for (const cat of data.categories) for (const c of cat.matches) if (!unique.has(key(c.name))) unique.set(key(c.name), c);
    download(`manashelf-${key(commander.name).replace(/\s+/g, "-")}-recomendaciones.txt`, [...unique.values()].map((c) => `1 ${c.name}`).join("\n"));
  };

  return (
    <section className="results">
      <div className="results-top">
        <div><div className="kicker">{resultModeLabel}</div><h2>{mode === "improve" ? `${deckDetail?.name || ""} · ${commander.name}` : commander.name}</h2>
          <p>{sync.status === "done" ? `Uso en mazos sincronizado: ${sync.syncedDecks || 0}/${sync.totalDecks || 0}` : `Resultados listos · uso en mazos ${sync.syncedDecks || 0}/${sync.totalDecks || 0}`}</p>
        </div>
        <div className="result-actions">
          <button className="ghost" onClick={() => openModal("assist", { data, deckDetail, mode, commander })}>{t("Completar a 100")}</button>
          <button className="ghost" onClick={exportResults}>{t("Exportar resultados")}</button>
        </div>
      </div>

      <div className="summary-explainer">
        <div className="stat total-stat"><span>{t("RECOMENDACIONES EDHREC ÚNICAS")}</span><strong>{ownedN + missingN}</strong></div>
        <div className="summary-branch">
          <div className="stat"><span>{t("EN COLECCIÓN")}</span><strong>{ownedN}</strong></div>
          <div className="stat"><span>{t("CON COPIA DISPONIBLE")}</span><strong>{availableN}</strong></div>
          <div className="stat"><span>{t("SIN COPIA DISPONIBLE")}</span><strong>{Math.max(0, ownedN - availableN)}</strong></div>
          <div className="stat"><span>{t("NO POSEÍDAS")}</span><strong>{missingN}</strong></div>
        </div>
        <p className="summary-note"><strong>{summary.usedInDecks || 0}</strong> {t("de las recomendadas que tenés aparecen en al menos un mazo. Ese dato puede superponerse con “disponible” si poseés más de una copia.")}</p>
      </div>

      <div className="toolbar">
        <div className="filter-stack state-filter" role="group" aria-label="Estado de colección">
          <button className={`state-choice${collectionFilter === "all" ? " active" : ""}`} aria-pressed={collectionFilter === "all"} onClick={() => setCollectionFilter("all")}>{t("Todas")}</button>
          <button className={`state-choice${collectionFilter === "owned" ? " active" : ""}`} aria-pressed={collectionFilter === "owned"} onClick={() => setCollectionFilter("owned")}>{t("En Colección")}</button>
          <button className={`state-choice${collectionFilter === "available" ? " active" : ""}`} aria-pressed={collectionFilter === "available"} onClick={() => setCollectionFilter("available")}>{t("Disponibles")}</button>
          {mode === "improve" && (
            <button className={`state-choice in-deck-filter${!hideInDeck ? " active" : ""}`} aria-pressed={!hideInDeck} onClick={onToggleHideInDeck}>{t("Ya en el mazo")}</button>
          )}
        </div>
        <div className="toolbar-right">
          <label className="select-labeled"><span>{t("ROL MANASHELF")}</span>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} title="Roles inferidos por ManaShelf desde tipo y texto Oracle de Scryfall; no son categorías EDHREC.">
              <option value="">{t("Todos los roles ManaShelf")}</option>
              {roles.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          {themes.length > 0 && (
            <label className="select-labeled"><span>{t("TEMÁTICA")}</span>
              <select value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)} title="Temáticas que EDHREC asocia a este Commander y que tenés evidencia de sostener.">
                <option value="">{t("Todas las temáticas")}</option>
                {themes.map((th) => <option key={th}>{th}</option>)}
              </select>
            </label>
          )}
          <label className="select-labeled sort-labeled"><span>{t("ORDENAR POR")}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="synergy">{t("Sinergia")}</option>
              <option value="inclusion">{t("Inclusión")}</option>
              <option value="availability">{t("Disponibles")}</option>
              <option value="name">{t("Nombre")}</option>
            </select>
          </label>
          <div className="view-toggle">
            <button className={view === "cards" ? "active" : ""} title="Vista en miniaturas" onClick={() => setView("cards")}>
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" /><rect x="9" y="1.5" width="5.5" height="5.5" rx="1" /><rect x="1.5" y="9" width="5.5" height="5.5" rx="1" /><rect x="9" y="9" width="5.5" height="5.5" rx="1" /></svg>
            </button>
            <button className={view === "list" ? "active" : ""} title="Vista en lista" onClick={() => setView("list")}>
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><line x1="1.5" y1="3" x2="14.5" y2="3" /><line x1="1.5" y1="8" x2="14.5" y2="8" /><line x1="1.5" y1="13" x2="14.5" y2="13" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="shell">
        <aside>
          <div className="asideTitle">{t("SECCIONES EDHREC")}</div>
          <p className="asideHelp">{t("Estas categorías vienen de EDHREC. Los roles del filtro de arriba los infiere ManaShelf.")}</p>
          <div>
            {data.categories.map((c) => {
              const visible = c.matches.filter(matchesFilters).length;
              return <button key={c.id} className={`cat${activeId === c.id ? " active" : ""}`} onClick={() => setActiveId(c.id)}><span>{c.label}</span><b>{visible}/{c.totalEdhrec}</b></button>;
            })}
          </div>
        </aside>
        <div className="catalog">
          <div className="catalogHead"><h3>{active?.label}</h3><p>{active ? `${categoryDesc(active)} ${filtered.length} visibles de ${active.totalEdhrec} recomendaciones.` : ""}</p></div>
          {view === "list" && (
            <div className="list-header"><div>{t("CARTA")}</div><div>{t("TIPO")}</div><div>{t("CATEGORÍA")}</div><div>CMC</div><div>{t("COLECCIÓN")}</div></div>
          )}
          <div className={`grid${view === "list" ? " list-view" : ""}`}>
            {filtered.map((c) => (
              <CardArticle key={c.name} c={c} view={view} mode={mode} mb={mb} selectedDeckId={selectedDeckId} data={data} deckDetail={deckDetail} />
            ))}
          </div>
          {!filtered.length && <div className="empty">{t("No hay cartas para mostrar con estos filtros.")}</div>}
        </div>
      </div>
    </section>
  );
}

function CardArticle({ c, view, mode, mb, selectedDeckId, data, deckDetail }) {
  const { shortlist, toggleShortlist, openModal, t } = useApp();
  const inDeck = mode === "improve" && mb.has(key(c.name));
  const missing = c.owned === false || !c.ownedQuantity;
  const availableNow = contextualAvailable(c, mode, selectedDeckId);
  const outside = (c.usedInDecks || []).filter((d) => !(mode === "improve" && Number(d.deckId) === Number(selectedDeckId)));
  const availableQty = Math.max(0, Number(c.ownedQuantity || 0) - usedOutsideCurrentDeck(c, mode, selectedDeckId));
  const shortlisted = shortlist.some((x) => key(x.name) === key(c.name));

  if (view === "list") {
    const stockText = missing ? "No está en tu colección" : inDeck ? `Tenés ${c.ownedQuantity} · ya en este mazo` : `Disponible ${availableQty}/${c.ownedQuantity}`;
    return (
      <article className={`list-row${missing ? " not-owned" : ""}${inDeck ? " in-deck" : ""}`}>
        <span className="lr-name">{c.name}{inDeck && <b className="lr-indeck">YA EN EL MAZO</b>}</span>
        <span className="lr-type">{typeBucket(c)}</span>
        <span className="lr-role">{(c.roles || [])[0] || "—"}</span>
        <span className="lr-cmc">{Number.isFinite(Number(c.cmc)) ? Number(c.cmc) : "—"}</span>
        <span className="lr-stock">{stockText}</span>
      </article>
    );
  }

  return (
    <article className={`card${missing ? " not-owned" : ""}`}>
      <div className="pic">
        {c.image ? <img src={c.image} loading="lazy" decoding="async" alt="" /> : null}
        {missing ? <span className="stock-badge missing-stock">{t("NO ESTÁ EN TU COLECCIÓN")}</span> : inDeck ? (
          <span className="stock-badge in-deck-stock"><b>Tenés {c.ownedQuantity}</b><small>{availableQty > 0 ? `+${availableQty} sin usar` : "Todas usadas en este mazo"}</small></span>
        ) : (
          <span className="stock-badge"><b>Disponible {availableQty}/{c.ownedQuantity}</b><small>Tenés {c.ownedQuantity} · {availableQty} sin usar</small></span>
        )}
        {!missing && (
          <span className="usage-overlay" tabIndex={0}>
            {outside.length ? `EN ${outside.length} MAZO${outside.length === 1 ? "" : "S"}` : "NO USADA FUERA"}
            <em>{outside.length ? outside.map((d, i) => <a key={i} href={`https://archidekt.com/decks/${Number(d.deckId)}`} target="_blank" rel="noreferrer">{d.deckName} ×{Number(d.quantity || 0)}</a>) : <span>No está usada en otro mazo</span>}</em>
          </span>
        )}
        {inDeck && <span className="in-deck-badge">YA EN EL MAZO</span>}
      </div>
      <div className="card-body">
        <h4>{c.name}</h4>
        <div className="metrics"><span className="syn">{c.synergy >= 0 ? "+" : ""}{Math.round(c.synergy * 100)}% sinergia</span><span>{c.inclusionPct}% inclusión</span></div>
        <div className="role-line">{(c.roles || []).map((r) => <span className="role" key={r}>{r}</span>)}</div>
        <div className="card-actions">
          <button className={shortlisted ? "shortlisted" : ""} onClick={() => toggleShortlist(c)}>{shortlisted ? "★ En shortlist" : "☆ Shortlist"}</button>
          {(!availableNow || missing) && <button onClick={() => openModal("alternatives", { card: c })}>Alternativas funcionales</button>}
          {mode === "improve" && !inDeck && <button onClick={() => openModal("addcut", { card: c, deckDetail, categories: data.categories })}>ADD / CUT</button>}
        </div>
      </div>
    </article>
  );
}
