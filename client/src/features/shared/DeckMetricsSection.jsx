import InfoDot from "../../components/InfoDot.jsx";
import SortableTable from "../../components/SortableTable.jsx";
import { METRIC_HELP, METRIC_LABELS, classificationIsLand, classificationQty, filteredQuantity, metricReadingLabel, metricFilterCards, coverageFilterCards, pct, fmtNum, confidenceLabel } from "./deckHealthLogic.js";

function MetricCard({ metric, dm, onAudit }) {
  const names = metricFilterCards(dm, metric.key);
  const qty = filteredQuantity(dm, names);
  return (
    <article className={`metrics-lab-card metrics-tone-${confidenceLabel(metric.confidence).toLowerCase()}`} tabIndex={0} onClick={() => onAudit(names, metric.title)}>
      <div className="metrics-card-header">
        <div className="metrics-card-head-copy">
          <small>{metric.eyebrow}</small>
          <h4>{metric.title} <InfoDot text={METRIC_HELP[metric.key] || ""} /></h4>
          <span className="metric-reading">{metricReadingLabel(metric.key)}</span>
        </div>
        <b className="metrics-confidence-pill">{confidenceLabel(metric.confidence)}</b>
      </div>
      <div className="metric-primary"><strong>{metric.value}</strong><span>{metric.valueLabel}</span></div>
      <div className="metric-mini-stats">{metric.stats.map((x, i) => <span key={i}><b>{x.value}</b><small>{x.label}</small></span>)}</div>
      <div className="metric-filter-note"><span>Tocar filtra deck list</span><b>{qty} cartas</b></div>
    </article>
  );
}

export default function DeckMetricsSection({ dm, onAudit }) {
  if (!dm?.metrics) return null;
  const m = dm.metrics, e = dm.engine || {}, sim = m.goldfishDevelopment || {}, rows = sim.byTurn || [], cls = dm.classifications || [];
  const nonlandCount = cls.filter((c) => !classificationIsLand(c)).reduce((n, c) => n + classificationQty(c), 0) || 1;

  const core = [
    { key: "manaReliability", title: "Fiabilidad de maná", eyebrow: "Base de maná", value: pct(m.manaReliability?.requiredColorsT3), valueLabel: "colores correctos en T3", confidence: m.manaReliability?.confidence, stats: [{ value: pct(m.manaReliability?.landDropT3), label: "Land T3" }, { value: pct(m.manaReliability?.rampByT3), label: "Ramp T3" }] },
    { key: "earlyDevelopment", title: "Desarrollo temprano", eyebrow: "Turns T1–T3", value: pct(m.earlyDevelopment?.productiveT3), valueLabel: "turnos productivos en T3", confidence: m.earlyDevelopment?.confidence, stats: [{ value: pct(m.earlyDevelopment?.productiveT2), label: "Productivo T2" }, { value: fmtNum(m.earlyDevelopment?.averageManaT3, 1), label: "Mana T3" }] },
    { key: "resourceFlow", title: "Flujo de recursos", eyebrow: "Recursos", value: pct((m.resourceFlow?.resourceEffects || 0) / nonlandCount), valueLabel: "densidad de recursos", confidence: m.resourceFlow?.confidence, stats: [{ value: fmtNum(m.resourceFlow?.resourceEffects, 0), label: "Cartas" }, { value: pct(m.resourceFlow?.resourceAvailableT5), label: "Acceso T5" }, { value: fmtNum(m.resourceFlow?.repeatableEngines, 0), label: "Engines" }] },
    { key: "interaction", title: "Interacción", eyebrow: "Cantidad + calidad", value: pct(m.interactionDensity?.density), valueLabel: "densidad de interacción", confidence: m.interactionDensity?.confidence, stats: [{ value: fmtNum(m.interactionDensity?.count, 0), label: "Cartas" }, { value: pct(m.interactionEfficiency?.score), label: "Eficiencia" }] },
    { key: "threatPayoff", title: "Amenazas / Payoffs", eyebrow: "Presión", value: pct(m.threatPayoffDensity?.payoffDensity), valueLabel: "densidad de payoffs", confidence: m.threatPayoffDensity?.confidence, stats: [{ value: fmtNum(m.threatPayoffDensity?.payoffs, 0), label: "Payoffs" }, { value: fmtNum(m.threatPayoffDensity?.threats, 0), label: "Threats" }, { value: pct(m.threatPayoffDensity?.payoffAvailableT5), label: "Payoff T5" }] },
    { key: "engineDensity", title: "Densidad de engines", eyebrow: "Motores", value: pct(m.engineDensity?.density), valueLabel: "densidad de engines", confidence: m.engineDensity?.confidence, stats: [{ value: fmtNum(m.engineDensity?.count, 0), label: "Engines" }, { value: pct(m.engineDensity?.availableT5), label: "Disponible T5" }] },
  ];
  const structure = [
    { key: "functionalDensity", title: "Densidad funcional", eyebrow: "Versatilidad", value: fmtNum(m.functionalDensity?.value, 2), valueLabel: "roles ponderados por carta", confidence: m.functionalDensity?.confidence, stats: [{ value: fmtNum(m.functionalDensity?.twoRoles, 0), label: "2 roles" }, { value: fmtNum(m.functionalDensity?.threePlusRoles, 0), label: "3+ roles" }] },
    { key: "setupPayoffBalance", title: "Setup / Payoff", eyebrow: "Balance", value: fmtNum(m.setupPayoffBalance?.ratio, 2), valueLabel: "setup por payoff", confidence: m.setupPayoffBalance?.confidence, stats: [{ value: fmtNum(m.setupPayoffBalance?.enablers, 0), label: "Setup" }, { value: fmtNum(m.setupPayoffBalance?.payoffs, 0), label: "Payoffs" }] },
    { key: "consistency", title: "Consistencia", eyebrow: "Plan de juego", value: pct(m.gameplanConsistency?.value), valueLabel: "consistencia estimada", confidence: m.gameplanConsistency?.confidence, stats: [{ value: pct(m.gameplanConsistency?.coreSequenceProbability), label: "Secuencia core" }, { value: pct(m.gameplanConsistency?.roleRedundancy), label: "Redundancia" }] },
    { key: "synergyDensity", title: "Densidad de sinergia", eyebrow: "Sinergia", value: pct(m.synergyDensity?.density), valueLabel: "densidad de sinergia", confidence: m.synergyDensity?.confidence, stats: [{ value: fmtNum(m.synergyDensity?.strong, 0), label: "Fuerte" }, { value: fmtNum(m.synergyDensity?.moderate, 0), label: "Moderada" }] },
    { key: "dependency", title: "Dependencia", eyebrow: "Fragilidad", value: m.dependencyRisk?.dependencies?.commander?.level || "LOW", valueLabel: "dependencia del commander", confidence: m.dependencyRisk?.confidence, stats: [{ value: pct(m.dependencyRisk?.dependencies?.commander?.ratio), label: "Commander" }, { value: String((m.dependencyRisk?.bottlenecks || []).length), label: "Roles frágiles" }] },
    { key: "resilience", title: "Resiliencia", eyebrow: "Recuperación", value: pct(m.resilience?.withoutCommander), valueLabel: "función sin commander", confidence: m.resilience?.confidence, stats: [{ value: pct(m.resilience?.withoutGraveyard), label: "Sin graveyard" }, { value: pct(m.resilience?.withoutArtifacts), label: "Sin artifacts" }] },
    { key: "effectiveManaValue", title: "MV efectivo", eyebrow: "Curva ajustada", value: fmtNum(m.effectiveManaValue?.adjustedAverage, 2), valueLabel: "mana value efectivo", confidence: m.effectiveManaValue?.confidence, stats: [{ value: fmtNum(m.effectiveManaValue?.printedAverage, 2), label: "Printed MV" }, { value: String((m.effectiveManaValue?.reducers || []).length), label: "Reducers" }] },
  ];
  const experimental = [
    { key: "deadCardRisk", title: "Riesgo de carta muerta", eyebrow: "Experimental", value: pct(m.deadCardRisk?.rate), valueLabel: "riesgo estructural", confidence: m.deadCardRisk?.confidence, stats: [{ value: String((m.deadCardRisk?.riskyCards || []).length), label: "Señaladas" }] },
    { key: "turnOfRelevance", title: "Turno de relevancia", eyebrow: "Timing", value: m.speed?.medianTurn ? `T${m.speed.medianTurn}` : "—", valueLabel: "hito ≥50%", confidence: m.speed?.confidence, stats: [] },
    { key: "closingPower", title: "Capacidad de cierre", eyebrow: "Cierre", value: m.closingPower?.level || "—", valueLabel: "capacidad de cierre", confidence: m.closingPower?.confidence, stats: [{ value: String(m.closingPower?.evidence?.finishers ?? 0), label: "Finishers" }, { value: String(m.closingPower?.evidence?.extraCombat ?? 0), label: "Extra combats" }] },
    { key: "goldfish", title: "Goldfish", eyebrow: "Simulador", value: String(sim.iterations || e.simulationCount || 0), valueLabel: "simulaciones", confidence: sim.confidence, stats: [{ value: fmtNum(sim.averageMulligans, 2), label: "Avg mulligans" }] },
  ];

  const cov = m.interactionDensity?.coverage || {};
  const coverageOrder = ["creature", "artifact", "enchantment", "graveyard", "stack", "wipes", "protection", "planeswalker", "land"];
  const bottlenecksData = (m.dependencyRisk?.bottlenecks || []).slice(0, 8);
  const bottleneckSummary = bottlenecksData.length ? `Detecté ${bottlenecksData.length} roles con muy poca redundancia. No significa que estén mal: marca dónde una sola pieza sostiene una función.` : "No detecté roles sostenidos por una sola carta.";
  const risky = m.deadCardRisk?.riskyCards || [];

  return (
    <section className="health-section metrics-lab-section" data-lab-section="metrics">
      <div className="lab-section-title"><div><span>06</span><h3>Motor de métricas del mazo</h3></div><p>LAB · motor v{e.metricsVersion || 1} · clasificación v{e.classificationVersion || 1} · simulación v{e.simulationVersion || 1}</p></div>
      <div className="metrics-engine-banner"><strong>SOLO LAB</strong><span>Estas métricas son experimentales y se muestran sólo en LAB. No alteran EDHREComendaciones ni los cambios IN/OUT.</span></div>
      <div className="metrics-intro-grid">
        <article className="metrics-intro-card"><h4>Cómo leerlo <InfoDot text="La cifra grande es la señal principal. Debajo aparecen las variables que la explican. El pie 'Filtra N cartas' coincide con la cantidad que vas a ver en la deck list al tocar la tarjeta." /></h4><p>La cifra grande concentra el foco; los datos secundarios explican de dónde sale.</p></article>
        <article className="metrics-intro-card"><h4>Confianza <InfoDot text="Alta: datos y cálculos directos. Media: mezcla de datos y heurísticas. Baja: señal experimental muy dependiente del contexto." /></h4><p><span className="metrics-mini-pill high">Alta</span><span className="metrics-mini-pill medium">Media</span><span className="metrics-mini-pill low">Baja</span></p></article>
      </div>
      <section className="metrics-cluster"><div className="metrics-cluster-head"><div><h4>Métricas principales</h4><p>Todos usan una señal principal comparable y debajo muestran las variables que la explican. Tocá una tarjeta para ver exactamente qué cartas participan.</p></div></div><div className="metrics-overview-grid">{core.map((x) => <MetricCard key={x.key} metric={x} dm={dm} onAudit={onAudit} />)}</div></section>
      <section className="metrics-cluster"><div className="metrics-cluster-head"><div><h4>Estructura y balance</h4><p>Cómo está construido el mazo: redundancia, roles, dependencia, resiliencia y curva real.</p></div></div><div className="metrics-overview-grid">{structure.map((x) => <MetricCard key={x.key} metric={x} dm={dm} onAudit={onAudit} />)}</div></section>
      <details className="metrics-details metrics-group-details"><summary>Experimental / heurística</summary><div className="metrics-group-panel"><div className="metrics-cluster-head"><div><h4>Experimental / heurística</h4><p>Señales útiles pero más dependientes de interpretación; permanecen plegadas para reducir ruido.</p></div></div><div className="metrics-overview-grid">{experimental.map((x) => <MetricCard key={x.key} metric={x} dm={dm} onAudit={onAudit} />)}</div></div></details>
      <div className="metrics-support-grid">
        <article>
          <h4>Cobertura de interacción <InfoDot text={METRIC_HELP.interaction} /></h4>
          <p className="support-copy">Cada bloque es clickeable y la cantidad coincide con la deck list filtrada.</p>
          <div className="coverage-mini-grid">
            {coverageOrder.filter((k) => cov[k]).map((k) => (
              <button type="button" className="coverage-item" key={k} onClick={() => onAudit(coverageFilterCards(dm, k), `Interaction · ${METRIC_LABELS[k] || k}`)}>
                <span>{METRIC_LABELS[k] || k}</span><b>{cov[k].count ?? 0}</b><small>cartas</small>
              </button>
            ))}
          </div>
        </article>
        <article>
          <h4>Roles frágiles <InfoDot text="Roles con una sola carta o muy poca redundancia. No son errores automáticos: son puntos de dependencia que conviene conocer." /></h4>
          <p className="bottleneck-lead">{bottleneckSummary}</p>
          <div className="bottleneck-list">
            {bottlenecksData.length ? bottlenecksData.map((x, i) => (
              <button type="button" className="bottleneck-item" key={i} onClick={() => onAudit(x.cards || [], `Rol frágil · ${x.role}`)}>
                <strong>{x.role}</strong><p>Este rol depende de <b>{(x.cards || []).join(", ") || "—"}</b>. Si esa pieza falta, hay poca o ninguna redundancia.</p>
              </button>
            )) : <div className="bottleneck-item static"><strong>Sin alertas</strong><p>No encontré un rol crítico sostenido por una sola pieza.</p></div>}
          </div>
        </article>
      </div>
      <div className="metrics-table-wrap">
        <div className="metrics-table-head"><div><h4>Simulación de desarrollo <InfoDot text={METRIC_HELP.goldfish} /></h4><small>Lectura de T1–T7 · pasá por la i de cada columna para ver su definición.</small></div><small>{sim.iterations || 0} iteraciones · no simula oponentes ni combate real</small></div>
        <SortableTable className="metrics-table simulation-table"
          headers={[
            { label: "Turno", info: "Turno simulado, de T1 a T7." },
            { label: "Land", info: "Probabilidad de poder hacer el land drop correspondiente a ese turno." },
            { label: "Mana", info: "Maná utilizable promedio estimado en ese turno." },
            { label: "Productivo", info: "Probabilidad de poder usar el turno en una jugada temprana funcional: ramp, fixing, draw/selection, engine o cost reduction de MV 3 o menos." },
            { label: "Engine", info: "Probabilidad de tener disponible al menos un motor repetible de valor." },
            { label: "Payoff", info: "Probabilidad de tener disponible una carta que capitaliza el setup del mazo." },
            { label: "Threat", info: "Probabilidad de tener disponible una amenaza o finisher según la clasificación semántica." },
            { label: "Commander", info: "Probabilidad de poder pagar el coste y colores del Commander en ese turno." },
          ]}
          rows={rows.map((r) => [`T${r.turn}`, pct(r.landDrop), fmtNum(r.averageMana, 2), pct(r.productive), pct(r.engineAvailable), pct(r.payoffAvailable), pct(r.threatAvailable), pct(r.commanderCastable)])}
        />
      </div>
      <details className="metrics-details">
        <summary>Clasificación semántica · {cls.length} entradas</summary>
        <div className="metrics-table-wrap semantic-table-wrap">
          <SortableTable className="metrics-table semantic-table semantic-compact-table"
            headers={["Carta", "Primario", "Roles", "Dependencias", "Synergy tags", "Func.", "Conf."]}
            rows={cls.map((c) => [
              <button type="button" className="metric-card-link" key={c.name} onClick={() => onAudit([c.name], `Métrica · ${c.name}`)}>{c.name}</button>,
              c.primaryRole || "—", (c.roles || []).join(", ") || "—", (c.dependencies || []).join(", ") || "—", (c.synergyTags || []).slice(0, 5).join(", ") || "—", fmtNum(c.functionalWeight, 2), pct(c.confidence),
            ])}
          />
        </div>
      </details>
      <details className="metrics-details">
        <summary>Detalles experimentales</summary>
        <div className="metrics-debug-grid">
          <article><h4>Proxy de cartas muertas <InfoDot text={METRIC_HELP.deadCardRisk} /></h4><div className="metric-chip-list">{risky.length ? risky.map((x, i) => <span key={i}>{x.name} · {pct(x.risk)} · {(x.dependencies || []).join(", ")}</span>) : <span>Sin riesgos estructurales altos detectados</span>}</div></article>
          <article><h4>Evidencia de cierre <InfoDot text={METRIC_HELP.closingPower} /></h4><pre>{JSON.stringify(m.closingPower?.evidence || {}, null, 2)}</pre></article>
          <article><h4>Resumen de resiliencia <InfoDot text={METRIC_HELP.resilience} /></h4><pre>{JSON.stringify({ withoutCommander: m.resilience?.withoutCommander, withoutGraveyard: m.resilience?.withoutGraveyard, withoutArtifacts: m.resilience?.withoutArtifacts, withoutCreatures: m.resilience?.withoutCreatures }, null, 2)}</pre></article>
        </div>
      </details>
      <div className="metrics-caveats">{(dm.caveats || []).map((x, i) => <span key={i}>• {x}</span>)}</div>
    </section>
  );
}

