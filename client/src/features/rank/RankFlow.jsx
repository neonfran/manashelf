import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import BuildabilityCard from "./BuildabilityCard.jsx";
import { key } from "../../utils.js";
import { edhrecTagCatalog, edhrecTagCommanders, ownedCommandersStart, ownedCommandersStatus, ownedCommanders as fetchOwnedCommanders, buildability, compareCommanders as compareCommandersApi } from "../../api.js";

export default function RankFlow() {
  const { t, tAttr, showError, setActivity, clearActivity, setSubject, showSelection } = useApp();

  const [loadStatus, setLoadStatus] = useState("Preparando Commanders de tu colección…");
  const [loadPct, setLoadPct] = useState(null);
  const [allOwned, setAllOwned] = useState([]);
  const [owned, setOwned] = useState([]);
  const [tagCatalog, setTagCatalog] = useState([]);
  const [tagQuery, setTagQuery] = useState("");
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [activeTags, setActiveTags] = useState([]);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [compareList, setCompareList] = useState([]);
  const [compareQuery, setCompareQuery] = useState("");
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(null); // commander name being analyzed
  const [buildResult, setBuildResult] = useState(null);

  useEffect(() => {
    if (loadPct != null) setActivity(loadStatus);
    else clearActivity();
  }, [loadPct, loadStatus, setActivity, clearActivity]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t2 = await edhrecTagCatalog();
        if (!cancelled) setTagCatalog(t2.tags || []);
        setLoadPct(8);
        const started = await ownedCommandersStart();
        let job = started.job;
        while (job && job.status === "running") {
          const pct = job.total > 0 ? Math.max(6, Math.min(96, Math.round((Number(job.current || 0) / Number(job.total)) * 100))) : 12;
          if (cancelled) return;
          setLoadStatus(job.message || "Cargando Commanders…");
          setLoadPct(pct);
          await new Promise((r) => setTimeout(r, 350));
          job = (await ownedCommandersStatus(job.id)).job;
        }
        let results;
        if (!job || job.status !== "done") {
          setLoadStatus("Reintentando con carga directa…");
          results = (await fetchOwnedCommanders()).results || [];
        } else {
          results = job.results || [];
        }
        if (cancelled) return;
        setAllOwned(results);
        setOwned(results);
        setLoadPct(100);
        setLoadStatus(`${results.length} Commanders listos`);
        setTimeout(() => { if (!cancelled) setLoadPct(null); }, 220);
      } catch (e) {
        if (!cancelled) { showError(e); setLoadStatus(t("No pude cargar Commanders.")); setLoadPct(null); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTag = async (tag) => {
    const next = activeTags.some((x) => x.slug === tag.slug) ? activeTags.filter((x) => x.slug !== tag.slug) : [...activeTags, tag];
    setActiveTags(next);
    if (!next.length) { setOwned(allOwned); return; }
    try {
      setLoadStatus("Aplicando tags EDHREC…");
      const d = await edhrecTagCommanders(next.map((x) => x.slug));
      setOwned(d.results || []);
    } catch (e) { showError(e); }
  };

  const visibleTags = tagQuery
    ? tagCatalog.filter((x) => key(x.name).includes(key(tagQuery)) || key(x.slug).includes(key(tagQuery))).slice(0, 50)
    : tagsExpanded ? tagCatalog : (() => {
        const base = tagCatalog.slice(0, 14);
        for (const t2 of activeTags) if (!base.some((x) => x.slug === t2.slug)) base.push(t2);
        return base;
      })();

  const q = key(search);
  const rows = owned.filter((c) => !q || key(c.name).includes(q) || (c.colorIdentity || []).join("").toLowerCase().includes(q) || (c.signals || []).some((s) => key(s).includes(q)));

  const toggleCompare = (c) => {
    if (!c) return;
    setCompareList((prev) => {
      const exists = prev.some((x) => key(x.name) === key(c.name));
      if (exists) return prev.filter((x) => key(x.name) !== key(c.name));
      if (prev.length >= 10) { showError(new Error(t("Podés seleccionar hasta 10 Commanders."))); return prev; }
      return [...prev, c];
    });
  };

  const analyzeOne = async (c) => {
    setAnalyzing(c.name);
    setActivity(`analizando · ${c.name}`);
    try {
      const d = await buildability(c.name);
      setBuildResult(d.result);
      setCollapsed(true);
      setSubject("rank", "Commander", c.name);
      showSelection("Commander", c.name);
    } catch (e) { showError(e); }
    finally { setAnalyzing(null); clearActivity(); }
  };

  const runCompare = async () => {
    if (compareList.length < 2 || compareList.length > 10) return;
    setComparing(true);
    setCompareResult(null);
    setActivity(`comparando · ${compareList.length} Commanders`);
    try {
      const d = await compareCommandersApi(compareList.map((c) => c.name));
      setCompareResult(d);
      setCollapsed(true);
      if ((d.failures || []).length) showError(new Error(t(`${d.failures.length} Commander${d.failures.length === 1 ? "" : "s"} no pudieron consultarse en EDHREC.`)));
    } catch (e) { showError(e); }
    finally { setComparing(false); clearActivity(); }
  };

  const compareCandidates = key(compareQuery)
    ? allOwned.filter((c) => key(c.name).includes(key(compareQuery))).filter((c) => !compareList.some((x) => key(x.name) === key(c.name))).slice(0, 10)
    : [];

  return (
    <section className={`flow-panel${buildResult ? " analysis-focus" : ""}`}>
      <div className="flow-head"><span>{t("DESCUBRIR COMMANDERS")}</span><p>{t("Explorá únicamente criaturas legendarias Commander-legales de tu colección. EDHREC se consulta solo cuando elegís analizar o comparar.")}</p></div>

      <div className="discovery-tools">
        <div className="control discover-main-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tAttr("Buscar Commander por nombre, color o señal…")} autoComplete="off" /></div>
        <div className="tag-panel">
          <div className="tag-filter-head">
            <div><strong>{t("FILTRAR POR TAG EDHREC")}</strong><small>{t("Elegí uno o varios. No hace falta recorrer toda la lista.")}</small></div>
            <button className="ghost tiny" type="button" onClick={() => setTagsExpanded((v) => !v)}>{tagsExpanded ? t("Mostrar menos") : `${t("Ver todos los tags")} (${tagCatalog.length || "…"})`}</button>
          </div>
          <div className="tag-search-row">
            <div className="control tag-search"><span>⌕</span><input value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} placeholder={tAttr("Buscar tag…")} autoComplete="off" /></div>
            <div className="discover-selected-tags">
              {activeTags.length ? <><span className="selected-label">{t("ACTIVOS")}</span>{activeTags.map((x) => <button type="button" key={x.slug} onClick={() => toggleTag(x)}>{x.name} ×</button>)}</> : <small>{t("Sin tags activos")}</small>}
            </div>
          </div>
          <div className={`discover-filters${tagsExpanded || tagQuery ? " expanded" : ""}`}>
            {visibleTags.length ? visibleTags.map((x) => (
              <button key={x.slug} className={activeTags.some((a) => a.slug === x.slug) ? "active" : ""} onClick={() => toggleTag(x)}>{x.name}</button>
            )) : <small className="status">{tagCatalog.length ? t("No encontré tags con ese texto.") : t("Cargando tags EDHREC…")}</small>}
          </div>
        </div>
      </div>

      {!buildResult && (
        <>
          <div className="discover-list-head">
            <div className="discover-list-title">
              <span>{t("COMMANDERS DE TU COLECCIÓN")}</span><strong>{rows.length}</strong>
              <div className="status">{activeTags.length ? t(`${activeTags.map((x) => x.name).join(" + ")} · ${rows.length} resultado${rows.length === 1 ? "" : "s"}`) : t("de tu colección para explorar")}</div>
              {loadPct != null && <div className="discover-load-progress"><i style={{ width: `${loadPct}%` }}></i></div>}
            </div>
            <button className="primary discover-gallery-toggle" onClick={() => setCollapsed((v) => !v)}>{collapsed ? t(`Ver ${rows.length} Commander${rows.length === 1 ? "" : "s"} ↓`) : `${t("Ocultar Commanders")} ↑`}</button>
          </div>
          {!collapsed && (
            <div className="discover-grid">
              {rows.length ? rows.map((c) => (
                <article className={`discover-card${compareList.some((x) => key(x.name) === key(c.name)) ? " selected" : ""}`} key={c.name}>
                  {c.image && <div className="discover-card-img"><img src={c.image} loading="lazy" alt="" />{c.imageLarge && <img className="hover-preview" src={c.imageLarge} loading="lazy" alt="" />}</div>}
                  <div><h3>{c.name}</h3><p>{(c.colorIdentity || []).join("") || "C"} · {t(`Tenés ${c.ownedQuantity}`)}</p><button className="ghost tiny" disabled={analyzing === c.name} onClick={() => analyzeOne(c)}>{analyzing === c.name ? t("Analizando…") : t("Analizar con EDHREC")}</button></div>
                  <button className={`commander-select-circle${compareList.some((x) => key(x.name) === key(c.name)) ? " active" : ""}`} aria-label={tAttr(`Seleccionar ${c.name}`)} onClick={() => toggleCompare(c)}>{compareList.some((x) => key(x.name) === key(c.name)) ? "✓" : ""}</button>
                </article>
              )) : <p className="status discover-empty">{t("No hay Commanders de tu colección que coincidan con estos filtros.")}</p>}
            </div>
          )}
        </>
      )}

      {buildResult && (
        <>
          <button className="ghost discovery-back" onClick={() => { setBuildResult(null); setCollapsed(false); }}>{t("← Volver a mis Commanders")}</button>
          <BuildabilityCard x={buildResult} />
        </>
      )}

      {!buildResult && (
        <div className="compare-five">
          <div><div className="panel-label">{t("COMPARAR SELECCIÓN · HASTA 10")}</div><p>{t("Elegí entre 2 y 10 criaturas legendarias de tu colección. ManaShelf consulta EDHREC solamente para esas cartas y las ordena por cantidad de recomendaciones que ya tenés.")}</p></div>
          <div className="commander-search">
            <div className="control"><span>＋</span><input value={compareQuery} onChange={(e) => setCompareQuery(e.target.value)} placeholder={tAttr("Agregar a la selección…")} autoComplete="off" /></div>
            <div className={`dropdown${compareCandidates.length ? "" : " hidden"}`}>
              {compareCandidates.map((c) => (
                <button type="button" className="drop" key={c.name} onMouseDown={(e) => e.preventDefault()} onClick={() => { toggleCompare(c); setCompareQuery(""); }}>
                  {c.image ? <img src={c.image} alt="" /> : null}<span><strong>{c.name}</strong><small>{t("En tu colección")}</small></span>
                </button>
              ))}
            </div>
          </div>
          <div className="compare-chips">{compareList.map((c) => <button className="compare-chip" key={c.name} onClick={() => toggleCompare(c)}>{c.name} ×</button>)}</div>
          <div className={`floating-compare-wrap${compareList.length >= 2 ? "" : " hidden"}`}>
            <button className="primary floating-compare" disabled={compareList.length < 2 || comparing} onClick={runCompare}>{comparing ? t("Comparando…") : t(`Comparar ${compareList.length} seleccionados`)}</button>
          </div>
          <div className={`rank-results${compareResult ? " compare-layout" : ""}`}>
            {compareResult && (
              <>
                <div className="compare-result-head"><div><span>{t("COMPARACIÓN EDHREC")}</span><h3>{t(`${(compareResult.results || []).length} Commanders evaluados`)}</h3></div><small>{t("Orden: recomendaciones EDHREC que ya tenés")}</small></div>
                <div className="compare-result-grid">
                  {(compareResult.results || []).map((x, i) => (
                    <article className="compare-result-card" key={x.name}>
                      {x.image && <img src={x.image} loading="lazy" alt="" />}
                      <div className="compare-rank">#{i + 1}</div>
                      <h3>{x.name}</h3>
                      <div className="compare-metric hero"><span>{t("EN TU COLECCIÓN")}</span><strong>{x.owned}</strong><small>{t(`de ${x.recommendations} recomendaciones`)}</small></div>
                      <div className="compare-meter"><i style={{ width: `${Math.max(0, Math.min(100, x.coveragePct || 0))}%` }}></i></div>
                      <div className="compare-stats"><div><span>{t("Cobertura")}</span><b>{x.coveragePct}%</b></div><div><span>{t("Disponibles")}</span><b>{x.available}</b></div><div><span>{t("Ocupadas")}</span><b>{x.occupied}</b></div><div><span>{t("No poseídas")}</span><b>{x.missing}</b></div></div>
                    </article>
                  ))}
                </div>
                {(compareResult.failures || []).length > 0 && <div className="compare-partial-note">{t(`${compareResult.failures.length} análisis no pudieron completarse.`)}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
