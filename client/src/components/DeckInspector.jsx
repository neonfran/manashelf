import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../context/AppContext.jsx";
import { key } from "../utils.js";
import { typeBucket } from "../features/shared/resultsLogic.js";

function deckPrimaryCategory(c) {
  return (c.categories || []).find((x) => !/^commander$/i.test(x)) || (c.categories || [])[0] || "Sin categoría";
}

export default function DeckInspector({ id, detail, filter, onClearFilter, showCategory = false, title = "Mazo" }) {
  const { t } = useApp();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("ms-inspector-collapsed") === "1");
  const [sort, setSort] = useState(showCategory ? "type:asc" : "");
  const [preview, setPreview] = useState(null);
  const asideRef = useRef(null);

  const showPreview = (card) => {
    if (!card.imageNormal) return;
    const r = asideRef.current?.getBoundingClientRect();
    setPreview({ src: card.imageNormal, alt: card.name, right: r ? Math.max(16, window.innerWidth - r.left + 16) : 16 });
  };
  const hidePreview = () => setPreview(null);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("ms-inspector-collapsed", !c ? "1" : "0");
      return !c;
    });
  };

  if (!detail) return null;

  let cards = [...(detail.mainboard || [])];
  if (filter?.names) {
    const wanted = new Set(filter.names.map(key));
    cards = cards.filter((c) => wanted.has(key(c.name)));
  }
  const [sortKey, sortDir] = (sort || "type:asc").split(":");
  const compare = (a, b) => {
    if (sortKey === "cmc") return Number(a.cmc || 0) - Number(b.cmc || 0) || a.name.localeCompare(b.name);
    if (sortKey === "category") return deckPrimaryCategory(a).localeCompare(deckPrimaryCategory(b)) || a.name.localeCompare(b.name);
    if (sortKey === "name") return a.name.localeCompare(b.name);
    return typeBucket(a).localeCompare(typeBucket(b)) || a.name.localeCompare(b.name);
  };
  cards.sort((a, b) => (sortDir === "desc" ? -1 : 1) * compare(a, b));

  return (
    <aside id={id} ref={asideRef} className={`deck-inspector${collapsed ? " collapsed" : ""}`}>
      <button type="button" className="deck-inspector-toggle" title={collapsed ? t("Abrir deck list") : t("Ocultar deck list")} aria-label={collapsed ? t("Abrir deck list") : t("Ocultar deck list")} onClick={toggleCollapsed}>
        {collapsed ? <><span className="deck-toggle-triangle expand">◀</span><span className="deck-toggle-label">Deck List</span></> : <span className="deck-toggle-triangle collapse">▶</span>}
      </button>
      <div className="deck-inspector-head">
        <div className="deck-inspector-titlebar"><span>{t("DECK LIST")}</span></div>
        <div className="deck-inspector-context"><strong>{title}</strong><small>Commander · {(detail.commanders || [detail.commander]).filter(Boolean).join(" + ") || "—"}</small></div>
        <div className="deck-inspector-tools">
          <small className="deck-size-pill">{t("Size")} · {detail.size} {t("cartas")}</small>
          <label className="deck-sort-label">
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t("Ordenar deck")}>
              {!showCategory && <option value="">{t("Ordenar…")}</option>}
              <option value="type:asc">{t("Tipo ↑")}</option>
              <option value="type:desc">{t("Tipo ↓")}</option>
              {showCategory && <>
                <option value="category:asc">{t("Categoría ↑")}</option>
                <option value="category:desc">{t("Categoría ↓")}</option>
              </>}
              <option value="cmc:asc">CMC ↑</option>
              <option value="cmc:desc">CMC ↓</option>
              <option value="name:asc">{t("Nombre ↑")}</option>
              <option value="name:desc">{t("Nombre ↓")}</option>
            </select>
          </label>
        </div>
      </div>
      {filter?.names && (
        <div className="deck-inspector-filter">
          <span>{t(`Filtro: ${filter.label} · ${cards.reduce((n, c) => n + Number(c.quantity || 1), 0)} cartas`)}</span>
          <button type="button" onClick={onClearFilter}>{t("Limpiar filtro")}</button>
        </div>
      )}
      <div className="deck-card-list">
        {cards.length ? cards.map((c) => (
          <div className={`deck-list-row${showCategory ? " lab2-deck-list-row" : ""}`} key={c.name}>
            <span className="deck-qty">{c.quantity > 1 ? `${c.quantity}×` : ""}</span>
            <span
              className="deck-list-name"
              title={c.name}
              data-deck-card-preview={c.imageNormal || undefined}
              onMouseEnter={() => showPreview(c)}
              onMouseLeave={hidePreview}
              onFocus={() => showPreview(c)}
              onBlur={hidePreview}
              tabIndex={c.imageNormal ? 0 : undefined}
            >{c.name}</span>
            <span className="deck-list-type">{typeBucket(c)}</span>
            {showCategory && <span className="deck-list-category">{deckPrimaryCategory(c)}</span>}
            <span className="deck-list-meta">CMC {Number(c.cmc || 0)}</span>
          </div>
        )) : <p className="lab-muted">{t("No hay cartas para este filtro.")}</p>}
      </div>
      {createPortal(
        <div className={`deck-card-preview-portal${preview ? " visible" : ""}`} style={preview ? { right: `${preview.right}px`, left: "auto" } : undefined}>
          <img src={preview?.src || ""} alt={preview?.alt || ""} />
        </div>,
        document.body
      )}
    </aside>
  );
}
