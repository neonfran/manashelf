import { useApp } from "../../context/AppContext.jsx";
import { fmtNum } from "../shared/deckHealthLogic.js";

export function Lab3Summary({ d, commanderName, themeName }) {
  const { t } = useApp();
  const b = d.build || {}, s = b.summary || {}, r = s.roleCounts || {}, cov = b.validation?.semanticCoverage || {}, ctx = b.context?.summary || {}, targets = b.targets || {}, mana = b.mana || {};
  const shortfallCount = Object.keys(mana.shortfalls || {}).length;
  const combo = b.combo;
  return (
    <>
      <p className="lab2-result-meta">{t(`${Number(d.candidateCount || 0)} candidatas`)} · builder v{d.builderVersion} · context v{d.contextEngineVersion} · {d.themeSource || "semantic"}</p>
      <div className="lab2-summary-grid">
        <div className="lab2-summary-card"><span>SIZE</span><strong>{Number(b.size || 0)}/100</strong><small>{b.complete ? t("Lista completa") : t("Lista incompleta")}</small></div>
        <div className="lab2-summary-card"><span>THEME</span><strong>{Number(s.themeCards || 0)}</strong><small>{t(`objetivo ${Number(targets.theme || 0)}`)}</small></div>
        <div className="lab2-summary-card"><span>{t("RAMP / INTERACCIÓN")}</span><strong>{fmtNum(Number(r.ramp || 0), 1)} / {fmtNum(Number(r.interaction || 0), 1)}</strong><small>{t("contratos semánticos")}</small></div>
        <div className="lab2-summary-card"><span>{t("SEMÁNTICA")}</span><strong>{Number(cov.supported || 0)} / {Number(cov.partial || 0)} / {Number(cov.gap || 0)}</strong><small>supported / partial / gap</small></div>
        <div className="lab2-summary-card"><span>{t("MANÁ")}</span><strong>{Math.round(Number(mana.weightedCoverage ?? 1) * 100)}%</strong><small>{t(shortfallCount ? `${shortfallCount} color${shortfallCount === 1 ? "" : "es"} bajo objetivo` : "fuentes de color cubiertas")}</small></div>
        <div className="lab2-summary-card"><span>{t("DEPENDENCIAS")}</span><strong>{Math.round(Number(ctx.dependencyCoverage ?? ctx.avgDependencySatisfaction ?? 0) * 100)}%</strong><small>{t(`redundancia ${Math.round(Number(ctx.dependencyRedundancy || 0) * 100)}%`)}</small></div>
        <div className="lab2-summary-card"><span>PACKAGES</span><strong>{Number(ctx.packageLinks || 0)}</strong><small>{t(`support ${Math.round(Number(ctx.avgSupportContribution || 0) * 100)}% · dead risk ${Math.round(Number(ctx.avgDeadCardRisk || 0) * 100)}%`)}</small></div>
        {combo?.selected && <div className="lab2-summary-card"><span>COMBO</span><strong>{combo.infinite ? "∞" : "✓"}</strong><small>{t(`${Number(combo.pieces?.length || 0)} piezas · ${combo.infinite ? "infinito" : "completo"}`)}</small></div>}
      </div>
    </>
  );
}

export function Lab3Warnings({ d }) {
  const { t } = useApp();
  const b = d.build || {}, mana = b.mana || {};
  const shortageRows = Object.entries(b.shortages || {}).map(([k, v]) => ({ severity: "high", label: k, message: `${fmtNum(Number(v.have || 0), 1)} / ${fmtNum(Number(v.target || 0), 1)}` }));
  const manaRows = Object.entries(mana.shortfalls || {}).map(([color, v]) => ({ severity: "high", label: t(`Maná ${color}`), message: t(`${fmtNum(Number(v.sources || 0), 1)} / ${fmtNum(Number(v.target || 0), 1)} fuentes`) }));
  const warnings = [...(d.warnings || []).map((x) => ({ severity: "info", label: t("Nota"), message: x })), ...shortageRows, ...manaRows];
  if (!warnings.length) return null;
  return <div className="lab2-warnings">{warnings.map((x, i) => <div className={`lab2-warning-row ${x.severity}`} key={i}><b>{x.label}</b><p>{x.message}</p></div>)}</div>;
}

export function Lab3Context({ d }) {
  const { t } = useApp();
  const b = d.build || {}, s = b.summary || {}, ctx = b.context?.summary || {}, mana = b.mana || {};
  const bottlenecks = b.context?.bottlenecks || [];
  const roleRows = Object.entries(b.context?.roleCoverage || {}).filter(([, v]) => Number(v) > 0).sort((a, b2) => b2[1] - a[1]).slice(0, 12);
  const manaColors = Object.keys(mana.sourceTargets || {});
  const themeFacets = Object.entries(s.themeFacets || b.diagnostics?.themeFacetCounts || {}).filter(([, v]) => Number(v) > 0).sort((a, b2) => b2[1] - a[1]);
  const restrictedSources = mana.restrictedSources || [];
  return (
    <div className="lab2-audit-grid">
      <section><h4>{t("Coverage estructural")}</h4><div className="lab2-target-list">{roleRows.length ? roleRows.map(([k, v]) => <div key={k}><span>{k}</span><b>{fmtNum(Number(v), 1)}</b></div>) : <p>{t("Sin roles detectados.")}</p>}</div></section>
      <section><h4>{t("Fuentes de maná")}</h4><div className="lab2-target-list">{manaColors.length ? manaColors.map((color) => <div key={color}><span>{t(`${color} · demanda ${Number(mana.pipDemand?.[color] || 0)} pips`)}</span><b className={Number(mana.sourceCoverage?.[color] || 0) < 0.8 ? "under" : "ok"}>{fmtNum(Number(mana.sourcesByColor?.[color] || 0), 1)} / {Number(mana.sourceTargets?.[color] || 0)} · {Math.round(Number(mana.sourceCoverage?.[color] || 0) * 100)}%</b></div>) : <p>{t("Sin demanda de color detectada.")}</p>}</div></section>
      <section><h4>{t("Facetas del theme")}</h4><div className="lab2-target-list">{themeFacets.length ? themeFacets.map(([name, count]) => <div key={name}><span>{name}</span><b>{Number(count)}</b></div>) : <p>{t("Sin facetas temáticas detectadas.")}</p>}</div></section>
      <section><h4>{t("Fuentes restringidas")}</h4><div className="lab2-target-list">{restrictedSources.length ? restrictedSources.slice(0, 12).map((x, i) => <div key={i}><span>{x.name} · {(x.colors || []).join("/")}</span><b className={Number(x.usability || 0) < 0.5 ? "under" : "ok"}>{Math.round(Number(x.usability || 0) * 100)}%</b></div>) : <p>{t("Sin fuentes restringidas seleccionadas.")}</p>}</div></section>
      <section><h4>Bottlenecks</h4><div className="lab2-target-list">{bottlenecks.length ? bottlenecks.slice(0, 12).map((x, i) => <div key={i}><span>{x.dependency}</span><b className={Number(x.satisfaction) < 0.45 ? "under" : "ok"}>{t(`${Math.round(Number(x.satisfaction || 0) * 100)}% · demanda ${Number(x.demand || 0)}`)}</b></div>) : <p>{t("No hay bottlenecks fuertes detectados.")}</p>}</div></section>
      <section><h4>{t("Contexto de packages")}</h4><div className="lab2-target-list">
        <div><span>Dependency coverage</span><b>{Math.round(Number(ctx.dependencyCoverage || 0) * 100)}%</b></div>
        <div><span>{t("Redundancia")}</span><b>{Math.round(Number(ctx.dependencyRedundancy || 0) * 100)}%</b></div>
        <div><span>Producer → consumer links</span><b>{Number(ctx.packageLinks || 0)}</b></div>
        <div><span>{t("Dependencia del Commander")}</span><b>{Math.round(Number(ctx.commanderDependence || 0) * 100)}%</b></div>
      </div></section>
    </div>
  );
}

export function Lab3DeckTable({ d }) {
  const { t } = useApp();
  const rows = d.build?.deck || [];
  return (
    <table className="lab2-deck-table">
      <thead><tr><th>{t("CARTA")}</th><th>{t("TIPO")}</th><th>{t("CATEGORÍA")}</th><th>THEME</th><th>{t("SEMÁNTICA")}</th></tr></thead>
      <tbody>
        {rows.map((c, i) => (
          <tr key={i}>
            <td><span className="lab2-table-qty">{Number(c.quantity || 1)}×</span><button type="button" className="lab2-card-name" title={c.selectionReason || ""}>{c.name}</button></td>
            <td>{c.typeLine || ""}</td>
            <td><span className="lab2-category-pill">{c.category || c.selectionPhase || t("Sin categoría")}</span></td>
            <td>{Math.round(Number(c.themeScore || 0) * 100)}%</td>
            <td>{c.semanticStatus || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
