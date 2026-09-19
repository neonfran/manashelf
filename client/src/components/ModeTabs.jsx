import { useApp } from "../context/AppContext.jsx";
import { lab2Access } from "../api.js";

const MODES = [
  { id: "explore", num: "01", label: "Explorar Commander", small: "Cualquier leyenda" },
  { id: "improve", num: "02", label: "Mejorar mi mazo", small: "Deck existente" },
  { id: "rank", num: "03", label: "¿Qué Commander puedo armar?", small: "Desde tu colección" },
  { id: "lab", num: "⚗1", label: "LAB 1", small: "Deck check++", cls: "lab-mode" },
  { id: "lab3", num: "⚗2", label: "Deck Forge", small: "Arma tu mazo desde tu colección", cls: "lab3-mode" },
  // DeckBuilder Classic ("lab2") is retired from the UI but its code stays in the repo
  // (Lab2Flow.jsx, collection-deck-builder.mjs) as a fallback if something breaks in the
  // semantic engine above. Re-add an entry here to bring it back.
];

export default function ModeTabs() {
  const { t, mode, setMode, sessionId, lab2Unlocked, setLab2Unlocked, openModal, showError } = useApp();

  const enterLocked = async (target) => {
    if (!sessionId) return showError(new Error(t("Conectá una colección primero.")));
    if (lab2Unlocked) { setMode(target); return; }
    try {
      const status = await lab2Access();
      if (status.unlocked) { setLab2Unlocked(true); setMode(target); return; }
    } catch (e) { return showError(e); }
    openModal("lab2gate", { target });
  };

  const click = (m) => {
    if (m.locked) return enterLocked(m.id);
    setMode(m.id);
  };

  return (
    <section className="mode-tabs">
      {MODES.map((m) => {
        const locked = m.locked && !lab2Unlocked;
        return (
          <button key={m.id} className={`mode${m.cls ? ` ${m.cls}` : ""}${mode === m.id ? " active" : ""}${m.locked ? (locked ? " lab-locked" : " lab-unlocked") : ""}`} onClick={() => click(m)}>
            <b>{m.num}</b><span>{t(m.label)}<small>{t(m.small)}</small></span>
            {m.locked && <i className="lab-lock" aria-hidden="true">{locked ? "🔒" : "🔓"}</i>}
          </button>
        );
      })}
    </section>
  );
}
