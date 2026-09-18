import { useApp } from "../../context/AppContext.jsx";
import InfoDot from "../../components/InfoDot.jsx";
import DeckMetricsSection from "./DeckMetricsSection.jsx";
import { key } from "../../utils.js";
import { MTG_TYPE_COLORS, THEME_BAR_COLORS, MTG_CURVE_TYPES, donutGradient, segmentedFillParts } from "./deckHealthLogic.js";
import { BRACKET_OPTIONS } from "./brackets.js";

function HealthCard({ h, hi, onAudit }) {
  const { t } = useApp();
  const max = Math.max(Number(h.refMax || 0), Number(h.value || 0), 1);
  const pctVal = Math.min(100, Math.round((Number(h.value || 0) / max) * 100));
  const markerPct = h.refMin != null ? Math.min(100, Math.round((Number(h.refMin) / max) * 100)) : null;
  const valueLabel = typeof h.value === "number" ? (Number.isInteger(h.value) ? h.value : h.value.toFixed(1)) : h.value;
  return (
    <article className="health-card">
      <div className="health-card-top"><div><span>{h.label}</span><strong>{h.level}</strong></div><InfoDot text={h.basis} /></div>
      <div className="health-value-row"><b>{valueLabel}</b><small>{h.display || ""}</small></div>
      <div className={`health-meter ${key(h.level)}`}>
        {markerPct != null && <span className="health-meter-marker" style={{ left: `${markerPct}%` }} title={t("Piso orientativo")}></span>}
        <i className={key(h.level)} style={{ width: `${pctVal}%` }}></i>
      </div>
      <div className="health-ref-row">
        {(h.refs || []).map((r, ri) => (
          <button type="button" key={ri} disabled={!r.cards?.length} onClick={() => onAudit(r.cards, `${h.label} · ${r.label}`)}>{r.label}{r.cards?.length ? " ↗" : ""}</button>
        ))}
      </div>
    </article>
  );
}

const ALL_SECTIONS = ["summary", "health", "rules", "identity", "changes", "metrics"];

export default function DeckHealthPanel({ data: d, detail, onAudit, showMetrics = false, sections = ALL_SECTIONS }) {
  const { t } = useApp();
  if (!d) return null;
  const show = (s) => sections.includes(s);

  const rulesOk = (d.structuralRules || []).filter((r) => !r.triggered).length;
  const rulesTotal = (d.structuralRules || []).length;
  const rulesRingPct = rulesTotal ? Math.round((rulesOk / rulesTotal) * 360) : 0;
  const rulesRingGradient = `conic-gradient(#55f0a5 0deg ${rulesRingPct}deg,#ffb020 ${rulesRingPct}deg 360deg)`;

  const themeCoreCount = new Map();
  for (const th of d.themes) for (const name of th.cards || []) themeCoreCount.set(name, (themeCoreCount.get(name) || 0) + 1);
  const themeCore = [...themeCoreCount.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const curveMax = Math.max(1, ...(d.context.curve || []).map((y) => y.count));

  return (
    <div>
      <div className="lab-result-head"><div><span>{t("SALUD DEL MAZO · EXPERIMENTAL")} <InfoDot text={`Método: cuatro ejes estructurales, clasificación heurística por texto Oracle y CMC medio ${d.context.avgCmc}. No conoce tu metajuego ni intención exacta.`} /></span><h2>{d.deck.name}</h2><p>{d.deck.commander || t("Commander no detectado")} · Size {d.deck.size}</p></div></div>

      {show("summary") && <section className="health-section dashboard-section" data-lab-section="summary">
        <div className="lab-section-title"><div><span>01</span><h3>{t("Resumen del mazo")}</h3></div><p>{t("Lectura rápida antes de entrar al diagnóstico.")}</p></div>
        <div className="deck-dashboard">
          <button className="dashboard-stat" onClick={() => onAudit(d.health?.[0]?.refs?.[0]?.cards || [], t("Tierras"))}><b>{d.context.lands ?? "—"}</b><span>{t("Tierras")}</span></button>
          <button className="dashboard-stat" onClick={() => onAudit(d.health?.[0]?.refs?.[1]?.cards || [], t("Ramp"))}><b>{d.context.ramp ?? "—"}</b><span>{t("Ramp")}</span></button>
          <button className="dashboard-stat" onClick={() => onAudit(d.health?.[1]?.refs?.[0]?.cards || [], t("Card Advantage"))}><b>{d.context.draw ?? "—"}</b><span>{t("Card Advantage")}</span></button>
          <button className="dashboard-stat" onClick={() => onAudit((d.health?.[2]?.refs || []).flatMap((r) => r.cards || []), t("Interacción"))}><b>{d.context.interaction ?? "—"}</b><span>{t("Interacción")}</span></button>
          <button className="dashboard-stat" onClick={() => onAudit(d.health?.[2]?.refs?.[2]?.cards || [], t("Board wipes"))}><b>{d.context.wipes ?? "—"}</b><span>{t("Board wipes")}</span></button>
          <div className="dashboard-stat"><b>{Number(d.context.avgCmc || 0).toFixed(1)}</b><span>{t("CMC medio")}</span></div>
        </div>
        {d.bracketEstimate && (
          <button
            type="button"
            className="dashboard-note"
            onClick={() => onAudit([...d.bracketEstimate.gameChangers, ...d.bracketEstimate.massLandDenial, ...d.bracketEstimate.extraTurns, ...d.bracketEstimate.twoCardCombos.flatMap((c) => c.pieces)], t("Bracket estimado"))}
          >
            <span className="dashboard-note-ring" style={{ background: "linear-gradient(135deg,var(--magenta),var(--violet))" }}><em>{BRACKET_OPTIONS.findIndex((b) => b.value === d.bracketEstimate.bracket)}</em></span>
            <span className="dashboard-note-copy">
              <strong>{t("Bracket estimado")} <InfoDot text={[
                t("Estimación propia, no oficial de WotC/Archidekt — sirve como referencia."),
                `${t("Game Changers")}: ${d.bracketEstimate.gameChangers.length}${d.bracketEstimate.gameChangers.length ? ` (${d.bracketEstimate.gameChangers.join(", ")})` : ""}.`,
                `${t("Denegación masiva de tierras")}: ${d.bracketEstimate.massLandDenial.length}${d.bracketEstimate.massLandDenial.length ? ` (${d.bracketEstimate.massLandDenial.join(", ")})` : ""}.`,
                `${t("Combos infinitos de 2 cartas")}: ${d.bracketEstimate.twoCardCombos.length}${d.bracketEstimate.twoCardCombos.length ? ` (${d.bracketEstimate.twoCardCombos.map((c) => c.pieces.join(" + ")).join(", ")})` : ""}.`,
                `${t("Turno extra")}: ${d.bracketEstimate.extraTurns.length}${d.bracketEstimate.extraTurns.length ? ` (${d.bracketEstimate.extraTurns.join(", ")})` : ""}.`,
              ].join(" ")} /></strong>
              <span>{t(BRACKET_OPTIONS.find((b) => b.value === d.bracketEstimate.bracket)?.label || d.bracketEstimate.bracket)}</span>
            </span>
          </button>
        )}
        <button type="button" className="dashboard-note" onClick={() => onAudit((d.structuralRules || []).flatMap((r) => r.cards || []), t("Criterios evaluados"))}>
          <span className="dashboard-note-ring" style={{ background: rulesRingGradient }}><em>{rulesOk}/{rulesTotal}</em></span>
          <span className="dashboard-note-copy"><strong>{t("Fundamentos")}</strong><span>{t(`${rulesOk}/${rulesTotal} sin alertas`)}</span><small>{t(`${rulesTotal} criterios evaluados`)}</small></span>
        </button>
        <div className="visual-dashboard">
          <div className="mana-curve compact">
            <div className="mana-curve-head"><strong>{t("Curva de maná")} <InfoDot text="Cartas no-tierra agrupadas por coste de maná convertido (CMC), coloreadas por tipo primario." /></strong><small>{t("Cartas según Mana Value (CMC)")}</small></div>
            <div className="curve-type-legend">{MTG_CURVE_TYPES.map((tp) => (
              <button type="button" key={tp} onClick={() => onAudit((d.context.curve || []).flatMap((x) => x.cardsByType?.[tp] || []), t(`Curva · ${tp}`))}><i style={{ background: MTG_TYPE_COLORS[tp] }}></i>{tp}</button>
            ))}</div>
            <div className="mana-curve-plot">
              <div className="curve-axis-labels"><span>{t("Cartas")}</span><span>CMC</span></div>
              <div className="mana-curve-bars">
                {(d.context.curve || []).map((x, ci) => {
                  const h = Math.max(7, Math.round((x.count / curveMax) * 100));
                  return (
                    <div className="curve-col" key={ci}>
                      <strong>{x.count}</strong>
                      <i className="curve-stack" style={{ height: `${h}%` }}>
                        {MTG_CURVE_TYPES.map((tp) => {
                          const n = Number(x.types?.[tp] || 0);
                          const segPct = x.count ? (n / x.count) * 100 : 0;
                          return n ? <button type="button" key={tp} className="curve-segment" style={{ height: `${segPct}%`, background: MTG_TYPE_COLORS[tp] }} title={`CMC ${x.cmc} · ${tp} · ${n}`} onClick={(e) => { e.stopPropagation(); onAudit(x.cardsByType?.[tp] || [], `CMC ${x.cmc} · ${tp}`); }} /> : null;
                        })}
                      </i>
                      <button type="button" className="curve-all" title={t(`Ver todas las cartas de CMC ${x.cmc}`)} onClick={() => onAudit(x.cards || [], `CMC ${x.cmc}`)}>{x.cmc}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="theme-chart">
            <div className="mana-curve-head"><strong>{t("Temáticas")} <InfoDot text="Temas detectados por evidencia EDHREC/Oracle. % = cartas que sostienen ese tema sobre el tamaño total del mazo (Size)." /></strong><small>{t("Temas inferidos")}</small></div>
            <div className="theme-chart-body">
              {d.themes.length ? d.themes.map((th, ti) => {
                const color = THEME_BAR_COLORS[ti % THEME_BAR_COLORS.length];
                const density = Math.max(0, Math.min(100, Number(String(th.density ?? 0).replace(/%/g, "")) || 0));
                const segs = segmentedFillParts(density, 10);
                return (
                  <button type="button" className="theme-bar-row" key={ti} onClick={() => onAudit(th.cards || [], t(`${th.name} · ${th.cardCount || th.cards?.length || 0} cartas detectadas`))}>
                    <span className="theme-bar-name">{th.name}</span>
                    <span className="theme-segments">{segs.map((f, i) => <i className="segmented-fill" key={i}><b style={{ width: `${f}%`, background: color }}></b></i>)}</span>
                    <b className="theme-bar-pct">{Math.round(density)}%</b>
                  </button>
                );
              }) : <p className="lab-muted">{t("Sin temáticas con evidencia suficiente.")}</p>}
            </div>
          </div>
          <div className="type-chart">
            <div className="mana-curve-head"><strong>{t("Tipos de carta")} <InfoDot text="Distribución del mazo por tipo primario de carta (Creature, Instant, etc.), sin contar tierras." /></strong><small>{t("Tipo primario")}</small></div>
            <div className="type-chart-body">
              <button type="button" className="type-donut" style={{ background: donutGradient(d.context.typeDistribution || []) }} onClick={() => onAudit(null, "")}>
                <span>{(d.context.typeDistribution || []).reduce((n, x) => n + x.count, 0)}</span><small>{t("cartas")}</small>
              </button>
              <div className="type-legend">
                {(d.context.typeDistribution || []).map((x) => (
                  <button key={x.type} onClick={() => onAudit(cardsByTypeLine(detail, x.type), t(`Tipo · ${x.type}`))}><i className="type-dot" style={{ background: MTG_TYPE_COLORS[x.type] || MTG_TYPE_COLORS.Other }}></i><span>{x.type}</span><b>{x.count}</b></button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {d.edhrecWarning && <div className="health-degraded"><strong>{t("Análisis local completo.")}</strong><span>{t(`${d.edhrecWarning} Themes e inclusiones pueden quedar vacíos hasta que EDHREC responda.`)}</span></div>}
      </section>}

      {show("health") && <section className="health-section structural-health-section" data-lab-section="health">
        <div className="lab-section-title"><div><span>02</span><h3>{t("Salud estructural")}</h3></div><p>{t("Los valores auditan las cartas detectadas en la lista lateral.")}</p></div>
        <div className="health-cards">{d.health.map((h, hi) => <HealthCard key={hi} h={h} hi={hi} onAudit={onAudit} />)}</div>
      </section>}

      {show("rules") && <section className="health-section rules-section" data-lab-section="rules">
        <div className="lab-section-title"><div><span>03</span><h3>{t("Estructura del mazo")}</h3></div><p>{t("Se evalúan los criterios estructurales del mazo y se señalan los puntos que merecen atención.")}</p></div>
        {(d.gaps || []).length > 0 && (
          <div className="rules-callouts"><h4>{t("A considerar")}</h4><div className="gap-grid">
            {d.gaps.map((g, i) => (
              <article className={`gap-card${g.severity !== "A considerar" ? " critical" : ""}`} key={i}><div><b>{g.type}</b><span>{g.severity}</span><InfoDot text={g.basis} /></div><p>{g.why}</p></article>
            ))}
          </div></div>
        )}
        <div className="rules-strip-head"><h4>{(d.structuralRules || []).length} {t("criterios evaluados")}</h4><small>{t("Referencia completa, no solo lo que necesita atención")}</small></div>
        <div className="structural-rule-list">
          {(d.structuralRules || []).map((r, ri) => (
            <button type="button" key={ri} className={`structural-rule ${r.triggered ? "triggered" : "ok"}`} disabled={!r.cards?.length} onClick={() => onAudit(r.cards, t(`Criterio · ${r.type}`))}>
              <i className="rule-icon">{r.triggered ? "⚠" : "✓"}</i><span><b>{r.type}</b><small>{r.summary || ""}</small></span>
            </button>
          ))}
        </div>
      </section>}

      {show("identity") && <section className="health-section identity-section" data-lab-section="identity">
        <div className="lab-section-title"><div><span>04</span><h3>{t("Identidad del mazo")}</h3></div><p>{t("Cada resultado muestra cuántas cartas concretas lo sostienen.")}</p></div>
        <div className="theme-grid-v2">
          {d.themes.length ? d.themes.map((th, ti) => {
            const sample = (th.cards || []).slice(0, 4);
            const rest = (th.cards || []).length - sample.length;
            return (
              <article className="theme-card theme-click" key={ti} tabIndex={0} onClick={() => onAudit(th.cards || [], t(`${th.name} · ${th.cardCount || th.cards?.length || 0} cartas detectadas`))}>
                <div><b>{th.name}</b><span className="theme-tier">{th.tier || "Theme"}</span><span>{t(`Confianza ${th.confidence}`)}</span><InfoDot text={th.explanation} /></div>
                <div className="theme-card-track"><i style={{ width: `${Math.min(100, Math.max(2, th.density))}%`, background: THEME_BAR_COLORS[ti % THEME_BAR_COLORS.length] }}></i></div>
                <p><strong>{t(`${th.cardCount || th.cards?.length || 0} cartas detectadas`)}</strong> {t(`que apoyan ${th.name} · ~${th.density}% del deck${th.commanderEvidence ? " · Commander compatible" : ""}`)}</p>
                {sample.length > 0 && <div className="theme-card-sample">{sample.map((n) => <span key={n}>{n}</span>)}{rest > 0 && <span className="more">{t(`+${rest} más`)}</span>}</div>}
              </article>
            );
          }) : <p className="lab-muted">{t("No hay evidencia suficiente para inferir un tema dominante. ManaShelf prefiere no inventarlo.")}</p>}
        </div>
        {themeCore.length > 0 && (
          <div className="theme-core">
            <div><b>{t("Cartas que atan varias temáticas")}</b><span>{t("Sostienen 2 o más de las temáticas de arriba a la vez — suelen ser el corazón funcional del mazo.")}</span></div>
            <div className="theme-core-list">
              {themeCore.map(([name, n]) => {
                const img = d.cardImages?.[name];
                return <span className={img?.image ? "has-preview" : ""} key={name}>{name} <b>×{n}</b>{img?.image && <img className="hover-preview" src={img.imageLarge || img.image} loading="lazy" alt="" />}</span>;
              })}
            </div>
          </div>
        )}
      </section>}

      {show("changes") && <section className="health-section cut-section" data-lab-section="changes">
        <div className="lab-section-title"><div><span>05</span><h3>{t("Cambios sugeridos · IN/OUT")}</h3></div><p>{t("Compará cada propuesta IN/OUT por función, curva y redundancia antes de aplicarla al mazo.")}</p></div>
        <div className="swap-grid">
          {(d.swaps || []).length ? d.swaps.map((x, si) => (
            <article className="swap-pair" key={si}>
              <div className="swap-pair-row">
                <div className="swap-mini in">
                  <div className="swap-img"><span className="swap-badge plus">+</span>{x.include.image && <><img className="swap-mini-image" src={x.include.image} loading="lazy" alt="" />{x.include.imageNormal && <img className="hover-preview" src={x.include.imageNormal} loading="lazy" alt="" />}</>}</div>
                  <small>IN</small><strong>{x.include.name}</strong><p>{x.include.reason || x.include.inclusionType || t("Recomendación contextual")}</p>
                </div>
                <div className="swap-connector" data-confidence={key(x.confidence)}><span className="swap-arrow">→</span><b>{x.confidence}</b><small>{t("confianza")}</small></div>
                <div className="swap-mini out">
                  <div className="swap-img"><span className="swap-badge minus">−</span>{x.cut?.image && <><img className="swap-mini-image" src={x.cut.image} loading="lazy" alt="" />{x.cut.imageNormal && <img className="hover-preview" src={x.cut.imageNormal} loading="lazy" alt="" />}</>}</div>
                  <small>OUT</small>
                  {x.cut ? <><strong>{x.cut.name}</strong><p>{(x.cut.reasons || []).slice(0, 2).join(" · ")}</p></> : <><strong>{t("Sin corte claro")}</strong><p>{t("Prefiero no proponer un cambio sin evidencia suficiente.")}</p></>}
                </div>
              </div>
              <footer><span>{(x.pairReasons || []).join(" · ") || t("Mejor combinación contextual disponible.")}</span>{x.impact && <div className="swap-impact"><span>CMC {x.impact.avgCmcDelta > 0 ? "+" : ""}{x.impact.avgCmcDelta}</span><span>{t("Roles críticos protegidos ✓")}</span></div>}</footer>
            </article>
          )) : <div className="empty-cut"><strong>{t("No encuentro un corte claro.")}</strong><span>{t("No hay suficiente evidencia para recomendar una salida sin arriesgar la estructura del mazo.")}</span></div>}
        </div>
        <p className="lab-confidence">{t("Revisá cada cambio según tu plan de juego, presupuesto y metajuego antes de aplicarlo.")}</p>
      </section>}

      {show("metrics") && showMetrics && <DeckMetricsSection dm={d.deckMetrics} onAudit={onAudit} />}
    </div>
  );
}

function cardsByTypeLine(detail, wanted) {
  if (!detail) return [];
  return (detail.mainboard || []).filter((c) => {
    const t = String(c.typeLine || c.meta?.typeLine || "").split("—")[0].toLowerCase();
    if (wanted === "Land") return t.includes("land");
    if (wanted === "Creature") return t.includes("creature");
    if (wanted === "Instant") return t.includes("instant");
    if (wanted === "Sorcery") return t.includes("sorcery");
    if (wanted === "Artifact") return t.includes("artifact");
    if (wanted === "Enchantment") return t.includes("enchantment");
    if (wanted === "Planeswalker") return t.includes("planeswalker");
    if (wanted === "Battle") return t.includes("battle");
    return true;
  }).map((c) => c.name);
}
