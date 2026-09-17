import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { key, sortByRecent, touchRecentDeck } from "../utils.js";

function deckCountLabel(d) {
  return d.exactMainCount != null ? `Size · ${d.exactMainCount}` : "Size · …";
}

export default function DeckPicker({ onSelect, placeholder }) {
  const { t, tAttr, decks } = useApp();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const q = key(query);
  const list = q.length ? sortByRecent(decks.filter((d) => key(d.name).includes(q) || key(d.commander || "").includes(q))) : [];

  const pick = (d) => {
    setQuery(d.name);
    setOpen(false);
    touchRecentDeck(d.id);
    onSelect(d.id);
  };

  return (
    <div className="deck-autocomplete">
      <div className="control">
        <span>⌕</span>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 140)}
          placeholder={tAttr(placeholder || "Escribí el nombre del mazo…")}
          autoComplete="off"
        />
      </div>
      <div className={`deck-picker deck-dropdown${open && list.length ? "" : " hidden"}`}>
        {list.map((d) => (
          <button type="button" className="deck-option" key={d.id} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(d)}>
            {d.commanderImage ? <img src={d.commanderImage} loading="eager" fetchPriority="high" decoding="async" alt="" /> : <div className="deck-thumb"></div>}
            <span><strong>{d.name}</strong><small>{d.commander || t("Commander por identificar")}</small></span>
            <b className="deck-count">{deckCountLabel(d)}</b>
          </button>
        ))}
      </div>
    </div>
  );
}
