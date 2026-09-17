import { key } from "../../utils.js";

const BASICS = new Set(["plains", "island", "swamp", "mountain", "forest", "wastes"]);

export default function AddCutModal({ card, deckDetail, categories }) {
  const recNames = new Set(categories.flatMap((cat) => cat.matches.map((x) => key(x.name))));
  const cuts = (deckDetail.mainboard || []).filter((x) => key(x.name) !== key(deckDetail.commander) && !BASICS.has(key(x.name)) && !recNames.has(key(x.name))).slice(0, 8);
  return (
    <div>
      <div className="kicker">ADD / CUT</div>
      <h2>Agregar {card.name}</h2>
      <p>Candidatos a CUT: cartas del mainboard que no aparecen entre las recomendaciones actuales de EDHREC. Es una heurística, no una orden automática.</p>
      <div className="modal-list">
        {cuts.length ? cuts.map((x) => (
          <div className="modal-row" key={x.name}><span>{x.name}</span><b>CUT candidato</b></div>
        )) : <div>No encontré un CUT obvio.</div>}
      </div>
    </div>
  );
}
