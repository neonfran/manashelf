import { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { archidektCreateDeck } from "../../api.js";
import { download, key } from "../../utils.js";
import { typeBucket } from "./resultsLogic.js";

function buildPool(data, deckDetail, mode, availability) {
  const existing = new Set((deckDetail?.mainboard || []).map((x) => key(x.name)));
  const target = mode === "improve" ? Math.max(0, 100 - (deckDetail?.size || 0)) : 99;
  const pool = new Map();
  for (const cat of data.categories) for (const c of cat.matches) {
    if (existing.has(key(c.name)) || c.ownedQuantity <= 0) continue;
    if (availability === "available" && c.availableQuantity <= 0) continue;
    const old = pool.get(key(c.name));
    if (!old || c.synergy > old.synergy) pool.set(key(c.name), c);
  }
  const quotas = { Ramp: 10, Draw: 10, Removal: 10, "Board Wipes": 3, Protection: 5, Counterspells: 3, Recursion: 4, Finishers: 5 };
  const chosen = [];
  const vals = [...pool.values()].sort((a, b) => b.synergy - a.synergy);
  for (const [role, n] of Object.entries(quotas)) {
    for (const c of vals.filter((x) => (x.roles || []).includes(role))) {
      if (chosen.length >= target) break;
      if (chosen.some((x) => key(x.name) === key(c.name))) continue;
      if (chosen.filter((x) => x._fillRole === role).length < n) chosen.push({ ...c, _fillRole: role, _fillWhy: `Cubre el rol ${role}` });
    }
  }
  for (const c of vals) {
    if (chosen.length >= target) break;
    if (!chosen.some((x) => key(x.name) === key(c.name))) chosen.push({ ...c, _fillRole: (c.roles || [])[0] || "Utility", _fillWhy: "Sinergia EDHREC alta, sin un rol prioritario pendiente" });
  }
  return { target, chosen: chosen.slice(0, target) };
}

export default function AssistModal({ data, deckDetail, mode, commander }) {
  const { t, accessMode, showError } = useApp();
  const [availability, setAvailability] = useState("available");
  const built = useMemo(() => buildPool(data, deckDetail, mode, availability), [data, deckDetail, mode, availability]);

  const exportTxt = () => download(`manashelf-${key(commander.name).replace(/\s+/g, "-")}.txt`, `1 ${commander.name}\n${built.chosen.map((c) => `1 ${c.name}`).join("\n")}`);
  const createDeck = async () => {
    const name = prompt(t("Nombre para el nuevo deck:"), `${commander.name} · ManaShelf`);
    if (!name) return;
    if (!confirm(t(`Crear "${name}" en Archidekt con este borrador?`))) return;
    try {
      const d = await archidektCreateDeck({ name, commander: commander.name, cards: built.chosen.map((x) => x.name), confirm: "CONFIRMAR" });
      alert(t("Deck creado."));
      window.open(d.url, "_blank");
    } catch (e) { showError(e); }
  };

  return (
    <div>
      <div className="kicker">{t("ASISTENTE A 100")}</div>
      <h2>{mode === "improve" ? t(`Faltan ${built.target} slots para 100`) : t("Borrador de 99 + Commander")}</h2>
      <p>{t("Prioriza cartas propias con copia disponible, roles funcionales y sinergia EDHREC. Revisá tierras y curva antes de aplicarlo.")}</p>
      <div className="assist-toggle">
        <span>{t("Mostrando:")}</span>
        <button type="button" className={`tiny${availability === "available" ? " accent" : ""}`} onClick={() => setAvailability("available")}>{t("Disponibles (no usadas en otro mazo)")}</button>
        <button type="button" className={`tiny${availability === "owned" ? " accent" : ""}`} onClick={() => setAvailability("owned")}>{t("En colección (aunque estén usadas)")}</button>
      </div>
      <div className="drawer-actions">
        <button className="ghost" onClick={exportTxt}>{t("Exportar decklist")}</button>
        {accessMode === "private" && mode === "explore" && <button className="primary" onClick={createDeck}>{t("Crear en Archidekt")}</button>}
      </div>
      <div className="modal-list assist-list">
        <div className="modal-row assist-row assist-head"><span>{t("Carta")}</span><span>{t("Tipo")}</span><span>{t("Categoría")}</span><span>{t("Qué suple")}</span></div>
        {built.chosen.map((c) => (
          <div className="modal-row assist-row" key={c.name}>
            <span className="assist-name">{c.name}</span>
            <span className="assist-type">{typeBucket(c)}</span>
            <span className="assist-role">{c._fillRole}</span>
            <span className="assist-why">{t(c._fillWhy)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
