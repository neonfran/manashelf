import { useApp } from "../../context/AppContext.jsx";
import { fmtNum, pct } from "../shared/deckHealthLogic.js";
import { key } from "../../utils.js";
import { typeBucket } from "../shared/resultsLogic.js";

export function deckPrimaryCategory(c) {
  return (c.categories || [])[0] || "Sin categoría";
}

export function Lab2Summary({ d }) {
  const { t } = useApp();
  const b = d.build, s = b.summary || {}, roles = b.roleCounts || {}, targets = b.targets || {};
  const combo = b.combo;
  const blocked = Number(d.availabilityExcluded || 0);
  const copyDetail = t(blocked ? `${blocked} candidatas bloqueadas por otros mazos` : `${Number(s.occupiedCards || 0)} slots ocupados en la lista final`);
  return (
    <div className="lab2-summary-grid">
      <div className="lab2-summary-card"><span>SIZE</span><strong>{b.size}/100</strong><small>{b.complete ? t("Lista completa") : t("Colección insuficiente")}</small></div>
      <div className="lab2-summary-card"><span>THEME</span><strong>{pct(s.themeDensity || 0)}</strong><small>{t(`${Number(s.themeCards || 0)} cartas · objetivo ${Number(targets.theme || 0)}`)}</small></div>
      <div className="lab2-summary-card"><span>{t("TIERRAS")}</span><strong>{Number(s.lands || 0)}</strong><small>{t(`objetivo ${Number(targets.lands || 0)} · MV ${Number(s.avgCmc || 0).toFixed(2)}`)}</small></div>
      <div className="lab2-summary-card"><span>{t("ESTRUCTURA")}</span><strong>{fmtNum(Number(roles.ramp || 0), 1)} / {fmtNum(Number(roles.interaction || 0), 1)}</strong><small>{t("ramp fiable / interacción")}</small></div>
      <div className="lab2-summary-card"><span>{t("COPIAS")}</span><strong>{Number(s.freeCards || 0)}</strong><small>{copyDetail}</small></div>
      {combo && <div className="lab2-summary-card"><span>COMBO</span><strong>{combo.infinite ? "∞" : "✓"}</strong><small>{t(`${Number(combo.pieces?.length || 0)} piezas · ${combo.infinite ? "infinito" : "completo"}`)}</small></div>}
    </div>
  );
}

const BRACKET_REASON_LABEL = { game_changer: "Game Changer", mass_land_denial: "Denegación masiva de tierras", extra_turn: "Turno extra" };

export function Lab2Warnings({ d }) {
  const { t } = useApp();
  const bracket = d.build?.bracket;
  const bracketRows = bracket?.excludedCount
    ? [{ severity: "info", label: "Bracket", message: t(`${bracket.excludedCount} candidata${bracket.excludedCount === 1 ? "" : "s"} excluida${bracket.excludedCount === 1 ? "" : "s"} por el bracket elegido (${bracket.excluded.map((x) => `${x.name} · ${t(BRACKET_REASON_LABEL[x.reason] || x.reason)}`).join(", ")}).`) }]
    : [];
  const forcedRows = bracket?.forcedGameChangers?.length
    ? [{ severity: "info", label: "Bracket", message: t(`Forzado por bracket: ${bracket.forcedGameChangers.join(", ")}.`) }]
    : [];
  const rows = [...(d.warnings || []).map((x) => ({ severity: "info", message: x })), ...(d.build?.shortages || []), ...bracketRows, ...forcedRows];
  if (!rows.length) return null;
  return (
    <div className="lab2-warnings">
      <div className="lab2-warning-head"><strong>{rows.some((x) => x.severity === "high") ? t("Compromisos detectados") : t("Notas del armado")}</strong><span>{rows.length}</span></div>
      {rows.map((x, i) => <div className={`lab2-warning-row ${x.severity || "info"}`} key={i}><b>{t(x.label || "Nota")}</b><p>{x.message || x}</p></div>)}
    </div>
  );
}

export function Lab2Audit({ d }) {
  const { t: tr } = useApp();
  const b = d.build || {}, t = b.targets || {}, r = b.roleCounts || {}, mana = b.mana || {}, adj = mana.targetAdjustment || {};
  const colors = ["W", "U", "B", "R", "G"], types = b.typeCounts || {}, profile = t.typeProfile || {};
  const rows = [["Theme", r.theme, t.theme], ["Ramp", r.ramp, t.ramp], [tr("Recursos"), r.resources, t.resources], [tr("Interacción"), r.interaction, t.interaction], ["Board wipes", r.wipes, t.wipes], [tr("Protección / recursión"), r.resilience, t.resilience], ["Finishers", r.finishers, t.finishers], [tr("Tierras"), b.summary?.lands, t.lands]];
  const typeRows = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment"].map((name) => {
    const actual = Number(types[name] || 0), floor = Number(profile.floors?.[name] || 0), desired = Number(profile.desired?.[name] || 0), cap = Number(profile.caps?.[name] || 0);
    return { name, actual, floor, desired, cap, under: floor && actual < floor };
  });
  const sourceRows = colors.filter((c) => Number(mana.demand?.share?.[c] || 0) > 0 || Number(mana.effectiveSources?.[c] ?? mana.sources?.[c] ?? 0) > 0).map((c) => {
    const sources = Number(mana.effectiveSources?.[c] ?? mana.sources?.[c] ?? 0), landSources = Number(mana.landSources?.[c] ?? mana.sources?.[c] ?? 0), support = Number(mana.nonlandSupport?.[c] || 0), wanted = Number(mana.requirements?.required?.[c] || 0), prob = Math.round(Number(mana.sourceProbabilities?.[c] || 0) * 100);
    const hard = mana.requirements?.hardest?.[c];
    const hint = hard ? `${hard.card} · ${hard.pips} pip${Number(hard.pips) === 1 ? "" : "s"} · T${hard.turn}` : tr("sin requisito temprano crítico");
    return { c, sources, landSources, support, wanted, prob, hint };
  });
  const landReason = adj.reasons?.length ? adj.reasons.join(" · ") : tr("sin ajuste adicional después del primer armado");
  const landDrops = mana.landDropProbabilities || {}, basic = Number(mana.basicCount || 0), nonbasic = Number(mana.nonbasicCount || 0), fetches = Number(mana.fetchCount || 0), manaRepairs = Array.isArray(mana.repairSwaps) ? mana.repairSwaps.length : 0;
  const combo = b.combo;
  return (
    <div>
      <div className="lab2-audit-grid">
        <section>
          <h4>{tr("Objetivos dinámicos")}</h4>
          <div className="lab2-target-list">{rows.map(([name, actual, tgt]) => <div key={name}><span>{name}</span><b className={Number(actual || 0) < Number(tgt || 0) ? "under" : "ok"}>{fmtNum(Number(actual || 0), 1)} / {fmtNum(Number(tgt || 0), 1)}</b></div>)}</div>
          <h4 className="lab2-subhead">{tr("Balance por tipo")}</h4>
          <div className="lab2-target-list">{typeRows.map((x) => <div key={x.name}><span>{x.name}</span><b className={x.under ? "under" : "ok"}>{tr(`${x.actual}${x.desired ? ` · objetivo ~${x.desired}` : ""}${x.floor ? ` · piso ${x.floor}` : ""}${x.cap ? ` · tope ${x.cap}` : ""}`)}</b></div>)}</div>
        </section>
        <section>
          <h4>{tr("Base de maná")}</h4>
          <p>{tr(`Objetivo inicial ${Number(adj.baseTarget ?? t.lands ?? 0)} → final ${Number(t.lands || 0)}. ${landReason}.`)}</p>
          <div className="lab2-mana-meta">
            <span><b>{basic}</b><small>{tr("básicas")}</small></span><span><b>{nonbasic}</b><small>{tr("no básicas")}</small></span><span><b>{fetches}</b><small>{tr("fetches")}</small></span><span><b>{manaRepairs}</b><small>{tr("swaps de fixing")}</small></span><span><b>{Math.round(Number(landDrops.turn3 || 0) * 100)}%</b><small>{tr("3 tierras en T3")}</small></span>
          </div>
          <div className="lab2-mana-sources">
            {sourceRows.length ? sourceRows.map((x) => (
              <span title={x.hint} key={x.c}><b>{x.c}</b><strong>{fmtNum(x.sources, 1)}{x.wanted ? ` / ${x.wanted}` : ""}</strong><small>{tr(`${fmtNum(x.landSources, 1)} tierras${x.support ? ` + ${fmtNum(x.support, 1)} soporte temprano` : ""} · ${x.prob}% cast`)}</small></span>
            )) : <span><small>{tr("Sin demanda de color detectada.")}</small></span>}
          </div>
        </section>
      </div>
      {combo && (
        <section className="lab2-combo-audit">
          <h4>{tr("Combo seleccionado")}</h4>
          <p><b>{combo.infinite ? tr("Combo infinito") : tr("Combo completo")}</b> · {combo.pieces.map((p) => p.name).join(" + ")}</p>
          {combo.produces?.length > 0 && <p>{tr("Resultado:")} {combo.produces.map((x) => x.name || x).join(" · ")}</p>}
          {combo.manaNeeded && <p>{tr("Maná requerido:")} {String(combo.manaNeeded)}</p>}
        </section>
      )}
      <div className="lab2-audit-notes">{(b.audit?.notes || []).map((n, i) => <p key={i}>• {n}</p>)}</div>
    </div>
  );
}

export function lab2AvailabilityLabel(c, lab2DeckDetail, lab2Profile, t) {
  if (c.builder?.syntheticBasic) return t("Básica ilimitada");
  if (key(c.name) === key(lab2DeckDetail?.commander)) return Number(c.builder?.ownedQuantity || lab2Profile?.commander?.ownedQuantity || 0) > 0 ? t("Commander poseído") : t("Commander no poseído");
  const avail = Number(c.builder?.availableQuantity || 0), used = Number(c.builder?.usedQuantity || 0), qty = Number(c.quantity || 1);
  if (avail >= qty) return t(`Disponible · ${avail}`);
  if (used > 0) return t(`En otros mazos · ${used}`);
  return t("En colección");
}

const CATEGORY_ORDER = { Commander: 0, "Combo Piece": 1, "Theme Engine": 2, "Theme Payoff": 3, "Theme Support": 4, "Ramp / Fixing": 5, "Draw / Resources": 6, Interaction: 7, "Board Wipe": 8, "Protection / Recursion": 9, Finisher: 10, Utility: 11, Land: 12, Lands: 12 };

export function Lab2DeckTable({ detail, profile }) {
  const { t } = useApp();
  const cards = [...(detail?.mainboard || [])].sort((a, b) => (CATEGORY_ORDER[deckPrimaryCategory(a)] ?? 50) - (CATEGORY_ORDER[deckPrimaryCategory(b)] ?? 50) || typeBucket(a).localeCompare(typeBucket(b)) || a.name.localeCompare(b.name));
  return (
    <table className="lab2-deck-table">
      <thead><tr><th>{t("CARTA")}</th><th>{t("TIPO")}</th><th>{t("CATEGORÍA")}</th><th>CMC</th><th>{t("DISPONIBILIDAD")}</th></tr></thead>
      <tbody>
        {cards.map((c) => (
          <tr key={c.name}>
            <td><span className="lab2-table-qty">{Number(c.quantity || 1)}×</span><button type="button" className="lab2-card-name" title={c.builder?.selectionReason || ""}>{c.name}</button></td>
            <td>{typeBucket(c)}</td>
            <td><span className="lab2-category-pill">{deckPrimaryCategory(c)}</span></td>
            <td>{Number(c.cmc || 0)}</td>
            <td>{lab2AvailabilityLabel(c, detail, profile, t)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
