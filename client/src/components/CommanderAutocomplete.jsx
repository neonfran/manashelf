import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { searchCommanders } from "../api.js";

// Reusable Commander search box: debounced /api/commanders query, dropdown with images,
// and arrow-key/Enter navigation — matches the original setupCommanderAutocomplete behavior.
export default function CommanderAutocomplete({ value, onChange, onSelect, placeholder, icon = "♛", className = "" }) {
  const { t, tAttr, showError } = useApp();
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    setActiveIndex(-1);
    const q = value.trim();
    if (q.length < 2) { setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const d = await searchCommanders(q);
        setResults(d.results || []);
        setOpen(true);
      } catch (e) {
        showError(e);
      }
    }, 220);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pick = (c) => {
    setOpen(false);
    onChange(c.name);
    onSelect(c);
  };

  const onKeyDown = (e) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i < 0 ? (dir > 0 ? 0 : results.length - 1) : (i + dir + results.length) % results.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[activeIndex >= 0 ? activeIndex : 0]);
    }
  };

  return (
    <div className={`commander-search ${className}`}>
      <div className="control">
        <span>{icon}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 140)}
          placeholder={tAttr(placeholder || "Buscar criatura legendaria…")}
          autoComplete="off"
        />
      </div>
      <div className={`dropdown${open && results.length ? "" : " hidden"}`}>
        {results.map((c, i) => (
          <button type="button" key={c.id || c.name} className={`drop${i === activeIndex ? " keyboard-active" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)}>
            {c.image ? <img src={c.image} loading="lazy" alt="" /> : null}
            <span><strong>{c.name}</strong><small>{c.typeLine}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}
