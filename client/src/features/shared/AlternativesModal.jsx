import { useEffect, useState } from "react";
import { alternatives } from "../../api.js";
import { typeBucket } from "./resultsLogic.js";

export default function AlternativesModal({ card }) {
  const [state, setState] = useState({ loading: true, rows: null, error: null });
  useEffect(() => {
    let cancelled = false;
    alternatives(card.name)
      .then((d) => { if (!cancelled) setState({ loading: false, rows: d.results || [], error: null }); })
      .catch((e) => { if (!cancelled) setState({ loading: false, rows: null, error: e.message || String(e) }); });
    return () => { cancelled = true; };
  }, [card.name]);

  return (
    <div>
      <div className="kicker">ALTERNATIVAS FUNCIONALES{state.loading ? "" : " · EDHREC"}</div>
      <h2>{card.name}</h2>
      {state.loading && <p className="status">Buscando cartas "Similar" de EDHREC que además estén disponibles en tu colección…</p>}
      {state.error && <><h2>No pude consultar alternativas</h2><p>{state.error}</p></>}
      {state.rows && (state.rows.length ? (
        <>
          <p>Estas cartas aparecen como similares en EDHREC y tienen copia disponible en tu colección. Scryfall se usa para validar metadatos.</p>
          <div className="alt-grid">
            {state.rows.map((x) => (
              <article className="alt-card" key={x.name}>
                {x.image ? <img src={x.image} loading="lazy" alt="" /> : null}
                <div><strong>{x.name}</strong><small>{typeBucket(x)} · CMC {x.cmc}</small><small>Disponible {x.availableQuantity}/{x.ownedQuantity}</small></div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p>No encontré una alternativa funcional de EDHREC con copia disponible en tu colección. No voy a sugerir una carta solo por compartir categoría.</p>
      ))}
    </div>
  );
}
