import { METRIC_HELP } from "./deckHealthLogic.js";
import { translate } from "../../i18n.js";

const METRIC_HELP_EN = {
  manaReliability: "What it measures: whether your mana base supports the deck's early plan. How to read it: higher is generally better. How it works: combines land-drop probability, fixing, ramp and access to the correct colors by turn 3.",
  earlyDevelopment: "What it measures: how often the deck starts by doing something useful in the first turns. How to read it: higher is better. How it works: simulates opening hands and tracks land drops, ramp, fixing and productive plays from turns 1 to 3.",
  resourceFlow: "What it measures: how much sustained access to resources the deck has. How to read it: higher is generally better. How it works: identifies draw, selection, tutors, recursion and engines, then estimates how often they are available on time.",
  interaction: "What it measures: how much real interaction the deck plays. How to read it: higher usually means better coverage. How it works: counts removal, wipes, protection and counters, while considering efficiency, mana cost and flexibility.",
  threatPayoff: "What it measures: whether the deck has enough cards that turn setup into pressure. How to read it: higher means greater payoff access; read it together with the threat/payoff breakdown. How it works: classifies threats and payoffs and estimates their availability.",
  engineDensity: "What it measures: how many repeatable value engines the deck contains. How to read it: higher is generally better. How it works: detects cards that repeatedly generate advantage and estimates access by turn 5.",
  functionalDensity: "What it measures: how many useful jobs each card performs on average. How to read it: higher means more versatility. How it works: assigns primary and secondary roles and calculates weighted functional density.",
  setupPayoffBalance: "What it measures: the balance between cards that set up the plan and cards that capitalize on it. How to read it: values closer to 1.0 are more balanced; much lower or higher may indicate an imbalance. How it works: compares enablers against payoffs.",
  consistency: "What it measures: how often the deck can assemble its basic game plan. How to read it: higher is better. How it works: combines role coverage, redundancy and the simulated probability of its core sequence.",
  synergyDensity: "What it measures: how strongly cards connect with one another and with the commander's plan. How to read it: higher is better, but this is a heuristic signal. How it works: uses synergy tags, dependencies and functional matches.",
  dependency: "What it measures: whether the deck depends too heavily on the commander or specific pieces. How to read it: lower is better. How it works: estimates how much functionality drops without the commander, graveyard, creatures or artifacts, and detects low-redundancy roles.",
  deadCardRisk: "What it measures: the risk of drawing cards that often lack the context they need. How to read it: lower is better. How it works: uses a structural proxy based on dependencies, expected usability and bottlenecks. Experimental.",
  resilience: "What it measures: how much of the deck still works after losing an important part of its plan. How to read it: higher is better. How it works: compares baseline functional coverage against scenarios without the commander, graveyard, artifacts or creatures.",
  effectiveManaValue: "What it measures: the deck's approximate real casting cost beyond printed mana value. How to read it: contextual; lower generally means a lighter deck, but it is not a quality score by itself. How it works: starts from printed mana value and applies detected reliable cost reductions.",
  turnOfRelevance: "What it measures: when the deck usually begins presenting something opponents must care about. How to read it: earlier is better. How it works: tracks milestones such as commander castability, an engine online, a payoff or a threat being available.",
  closingPower: "What it measures: the deck's ability to convert an advantage into an actual finish. How to read it: higher is better, with less certainty than purely numeric metrics. How it works: looks for finishers, damage multipliers, evasion, extra combats and combo evidence.",
  goldfish: "What it measures: the deck's early-development simulation. How to read it: the headline number is not good or bad; it is the number of simulations. The useful analysis is in the turn-by-turn table. How it works: runs thousands of opening sequences without opponents or real combat.",
};

const EXACT = {
  "Turno simulado, de T1 a T7.": "Simulated turn, from T1 to T7.",
  "Probabilidad de poder hacer el land drop correspondiente a ese turno.": "Probability of being able to make the land drop for that turn.",
  "Maná utilizable promedio estimado en ese turno.": "Estimated average usable mana on that turn.",
  "Probabilidad de poder usar el turno en una jugada temprana funcional: ramp, fixing, draw/selection, engine o cost reduction de MV 3 o menos.": "Probability of having a functional early play: ramp, fixing, draw/selection, engine or mana-value-3-or-less cost reduction.",
  "Probabilidad de tener disponible al menos un motor repetible de valor.": "Probability of having at least one repeatable value engine available.",
  "Probabilidad de tener disponible una carta que capitaliza el setup del mazo.": "Probability of having a card available that capitalizes on the deck's setup.",
  "Probabilidad de tener disponible una amenaza o finisher según la clasificación semántica.": "Probability of having a threat or finisher available according to the semantic classification.",
  "Probabilidad de poder pagar el coste y colores del Commander en ese turno.": "Probability of being able to pay the commander's mana cost and color requirements on that turn.",
  "Roles con una sola carta o muy poca redundancia. No son errores automáticos: son puntos de dependencia que conviene conocer.": "Roles supported by a single card or very little redundancy. They are not automatic errors; they are dependency points worth knowing.",
  "La cifra grande es la señal principal. Debajo aparecen las variables que la explican. El pie 'Filtra N cartas' coincide con la cantidad que vas a ver en la deck list al tocar la tarjeta.": "The large number is the primary signal. The variables underneath explain it. The card count at the bottom matches what the deck list will show when you click the metric.",
  "Alta: datos y cálculos directos. Media: mezcla de datos y heurísticas. Baja: señal experimental muy dependiente del contexto.": "High: mostly direct data and calculations. Medium: a mix of data and heuristics. Low: an experimental signal that depends heavily on context.",
  "Cartas no-tierra agrupadas por coste de maná convertido (CMC), coloreadas por tipo primario.": "Nonland cards grouped by converted mana cost (CMC), colored by primary card type.",
  "Temas detectados por evidencia EDHREC/Oracle. % = cartas que sostienen ese tema sobre el tamaño total del mazo (Size).": "Themes detected from EDHREC/Oracle evidence. % = cards supporting that theme divided by total deck size.",
  "Distribución del mazo por tipo primario de carta (Creature, Instant, etc.), sin contar tierras.": "Deck distribution by primary card type (Creature, Instant, etc.), excluding lands.",
};

export function translateLabInfo(text) {
  for (const [k, v] of Object.entries(METRIC_HELP)) if (v === text) return METRIC_HELP_EN[k] || text;
  const m = String(text).match(/^Método: cuatro ejes estructurales, clasificación heurística por texto Oracle y CMC medio (.+)\. No conoce tu metajuego ni intención exacta\.$/);
  if (m) return `Method: four structural axes, heuristic Oracle-text classification and average CMC ${m[1]}. It does not know your metagame or exact intent.`;
  return EXACT[text] || translate(text);
}
