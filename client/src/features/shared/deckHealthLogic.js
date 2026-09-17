import { key } from "../../utils.js";

export const MTG_TYPE_COLORS = { Creature: "#ff3ed1", Instant: "#34e7ff", Sorcery: "#ffb020", Artifact: "#8f70ff", Enchantment: "#55f0a5", Planeswalker: "#ff668f", Battle: "#b7a4d6", Other: "#f3efff", Land: "#6f7b8a" };
export const THEME_BAR_COLORS = ["#ff3ed1", "#34e7ff", "#8f70ff", "#ffb020", "#55f0a5"];
export const MTG_CURVE_TYPES = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Battle", "Other"];

export function donutGradient(dist) {
  const colors = (dist || []).map((x) => MTG_TYPE_COLORS[x.type] || MTG_TYPE_COLORS.Other);
  const total = Math.max(1, (dist || []).reduce((n, x) => n + Number(x.count || 0), 0));
  let at = 0;
  const parts = [];
  (dist || []).forEach((x, i) => {
    const from = (at / total) * 360;
    at += Number(x.count || 0);
    const to = (at / total) * 360;
    parts.push(`${colors[i] || MTG_TYPE_COLORS.Other} ${from}deg ${to}deg`);
  });
  return `conic-gradient(${parts.join(",") || "#332744 0deg 360deg"})`;
}

export function segmentedFillParts(value, segments = 10) {
  const raw = typeof value === "string" ? value.replace(/%/g, "") : value;
  const pctValue = Math.max(0, Math.min(100, Number(raw) || 0));
  return Array.from({ length: segments }, (_, i) => {
    const segmentStart = i * (100 / segments), segmentSize = 100 / segments;
    return Math.max(0, Math.min(100, ((pctValue - segmentStart) / segmentSize) * 100));
  });
}

export function pct(v) { return `${Math.round(Number(v || 0) * 100)}%`; }
export function confidenceLabel(v) { const n = Number(v || 0); return n >= 0.85 ? "Alta" : n >= 0.65 ? "Media" : "Baja"; }
export function fmtNum(v, d = 2) { const n = Number(v); if (!Number.isFinite(n)) return "—"; return Number.isInteger(n) ? String(n) : n.toFixed(d); }
export function humanizeToken(v) { return String(v || "").split("_").filter(Boolean).map((x) => (x.length <= 2 ? x.toUpperCase() : x.charAt(0).toUpperCase() + x.slice(1))).join(" ") || "—"; }

export const METRIC_HELP = {
  manaReliability: "Qué mide: si tu base de maná acompaña el plan temprano del mazo. Cómo leerlo: más alto suele ser mejor. Cómo lo calcula: mezcla probabilidad de land drops, fixing y acceso a los colores correctos hacia T3.",
  earlyDevelopment: "Qué mide: con qué frecuencia el mazo arranca haciendo algo útil en los primeros turnos. Cómo leerlo: más alto es mejor. Cómo lo calcula: simula aperturas y cuenta land drops, ramp, fixing y jugadas productivas entre T1 y T3.",
  resourceFlow: "Qué mide: cuánto acceso sostenido a recursos tiene el mazo. Cómo leerlo: más alto suele ser mejor. Cómo lo calcula: identifica draw, selection, tutors, recursion y engines, y estima qué tan seguido aparecen a tiempo.",
  interaction: "Qué mide: cuánta interacción real lleva el mazo. Cómo leerlo: más alto suele significar mejor cobertura. Cómo lo calcula: cuenta removal, wipes, protección y counters, y pondera eficiencia, coste y flexibilidad.",
  threatPayoff: "Qué mide: si el mazo tiene suficientes piezas que conviertan setup en presión. Cómo leerlo: más alto implica más acceso a payoffs; conviene leerlo junto con el detalle de threats/payoffs. Cómo lo calcula: clasifica amenazas y payoffs y estima su disponibilidad.",
  engineDensity: "Qué mide: cuántos motores repetibles de valor tiene el mazo. Cómo leerlo: más alto suele ser mejor. Cómo lo calcula: detecta cartas que generan ventaja repetible y estima su acceso hacia T5.",
  functionalDensity: "Qué mide: cuántos trabajos útiles cumple cada carta en promedio. Cómo leerlo: más alto significa mayor versatilidad. Cómo lo calcula: asigna roles primarios y secundarios y obtiene una densidad funcional ponderada.",
  setupPayoffBalance: "Qué mide: el equilibrio entre cartas que preparan el plan y cartas que lo capitalizan. Cómo leerlo: cuanto más cerca de 1.0, más balanceado. Muy por debajo o por encima suele indicar desequilibrio. Cómo lo calcula: compara enablers contra payoffs.",
  consistency: "Qué mide: qué tan seguido el mazo consigue encadenar su plan base. Cómo leerlo: más alto es mejor. Cómo lo calcula: combina cobertura de roles, redundancia y probabilidad de secuencia core en la simulación.",
  synergyDensity: "Qué mide: cuánto dialogan las cartas entre sí y con el plan del commander. Cómo leerlo: más alto es mejor, pero es una señal heurística. Cómo lo calcula: synergy tags, dependencias y coincidencias funcionales.",
  dependency: "Qué mide: si el mazo depende demasiado del commander o de piezas puntuales. Cómo leerlo: más bajo es mejor. Cómo lo calcula: estima cuánto cae la estructura sin commander, cementerio, criaturas o artefactos y detecta roles con poca redundancia.",
  deadCardRisk: "Qué mide: el riesgo de robar cartas que frecuentemente quedan sin contexto. Cómo leerlo: más bajo es mejor. Cómo lo calcula: proxy estructural basado en dependencias, usabilidad esperada y cuellos de botella. Es experimental.",
  resilience: "Qué mide: cuánto aguanta el mazo cuando pierde una parte importante de su plan. Cómo leerlo: más alto es mejor. Cómo lo calcula: compara cobertura funcional base contra escenarios sin commander, sin graveyard, sin artefactos o sin criaturas.",
  effectiveManaValue: "Qué mide: el coste real aproximado del mazo, más allá del MV impreso. Cómo leerlo: es contextual; en general más bajo implica un mazo más liviano, pero no es un score de calidad por sí solo. Cómo lo calcula: parte del MV impreso y descuenta reducers/rebajas detectadas.",
  turnOfRelevance: "Qué mide: en qué turno el mazo suele empezar a presentar algo realmente relevante. Cómo leerlo: cuanto antes, mejor; T1-T3 es más rápido que T5-T6. Cómo lo calcula: observa hitos como commander castable, engine online, payoff o threat disponible.",
  closingPower: "Qué mide: la capacidad de transformar ventaja en cierre real. Cómo leerlo: más alto es mejor, con menor certeza que una métrica puramente numérica. Cómo lo calcula: busca evidencia de finishers, multiplicadores, evasión, extra combats o líneas de combo.",
  goldfish: "Qué mide: el bloque de simulación temprana del mazo. Cómo leerlo: la cifra principal acá no es 'mejor o peor'; indica cuántas simulaciones se corrieron. El valor analítico está en la tabla T1-T7. Cómo lo calcula: ejecuta miles de aperturas sin oponentes ni combate real.",
};
export const METRIC_LABELS = { creature: "Creatures", artifact: "Artifacts", enchantment: "Enchantments", planeswalker: "Planeswalkers", land: "Lands", graveyard: "Graveyard", stack: "Stack", wipes: "Board wipes", protection: "Protection" };

export function classificationIsLand(c) { return /\bland\b/i.test(String(c?.typeLine || "")); }
export function classificationQty(c) { return Math.max(1, Number(c?.quantity || 1)); }
export function filteredQuantity(dm, names) {
  const wanted = new Set((names || []).map(key));
  return (dm?.classifications || []).filter((c) => wanted.has(key(c.name))).reduce((n, c) => n + classificationQty(c), 0);
}
export function metricReadingLabel(metricKey) {
  const map = { manaReliability: "↑ más alto = mejor", earlyDevelopment: "↑ más alto = mejor", resourceFlow: "↑ más alto = mejor", interaction: "↑ más alto = mejor", threatPayoff: "↑ más alto = mejor", engineDensity: "↑ más alto = mejor", functionalDensity: "↑ más alto = mejor", setupPayoffBalance: "◎ mejor cerca de 1.0", consistency: "↑ más alto = mejor", synergyDensity: "↑ más alto = mejor", dependency: "↓ más bajo = mejor", deadCardRisk: "↓ más bajo = mejor", resilience: "↑ más alto = mejor", effectiveManaValue: "◌ lectura contextual", turnOfRelevance: "↓ más temprano = mejor", closingPower: "↑ más alto = mejor", goldfish: "◌ no es score" };
  return map[metricKey] || "◌ lectura contextual";
}
export function metricFilterCards(dm, keyName) {
  const cls = dm?.classifications || [];
  const has = (c, ...roles) => roles.some((r) => (c.roles || []).includes(r));
  if (keyName === "manaReliability") return cls.filter((c) => classificationIsLand(c) || has(c, "ramp", "mana_fixing", "cost_reduction")).map((c) => c.name);
  if (keyName === "earlyDevelopment") return cls.filter((c) => !classificationIsLand(c) && Number(c.manaValue || 0) <= 3 && has(c, "ramp", "mana_fixing", "card_selection", "card_draw", "engine", "cost_reduction")).map((c) => c.name);
  if (keyName === "resourceFlow") return cls.filter((c) => has(c, "card_draw", "impulse_draw", "tutor", "recursion", "card_advantage")).map((c) => c.name);
  if (keyName === "interaction") return cls.filter((c) => has(c, "removal", "counterspell", "board_wipe", "graveyard_interaction")).map((c) => c.name);
  if (keyName === "threatPayoff") return cls.filter((c) => has(c, "threat", "payoff")).map((c) => c.name);
  if (keyName === "engineDensity") return cls.filter((c) => has(c, "engine")).map((c) => c.name);
  if (keyName === "functionalDensity") return cls.filter((c) => !classificationIsLand(c) && (c.roles || []).length >= 2).map((c) => c.name);
  if (keyName === "setupPayoffBalance") return cls.filter((c) => c.setup || c.payoff).map((c) => c.name);
  if (keyName === "consistency") return cls.filter((c) => has(c, "ramp", "card_draw", "engine", "payoff", "removal", "counterspell", "board_wipe")).map((c) => c.name);
  if (keyName === "synergyDensity") {
    const details = new Map((dm?.metrics?.synergyDensity?.details || []).map((x) => [key(x.name), x]));
    return cls.filter((c) => ["strong", "moderate"].includes(details.get(key(c.name))?.band)).map((c) => c.name);
  }
  if (keyName === "dependency") return cls.filter((c) => (c.dependencies || []).length).map((c) => c.name);
  if (keyName === "resilience") return cls.filter((c) => has(c, "protection", "recursion", "engine")).map((c) => c.name);
  if (keyName === "effectiveManaValue") return cls.filter((c) => has(c, "cost_reduction")).map((c) => c.name);
  if (keyName === "deadCardRisk") {
    const names = new Set((dm?.metrics?.deadCardRisk?.riskyCards || []).map((x) => key(x.name)));
    return cls.filter((c) => names.has(key(c.name))).map((c) => c.name);
  }
  if (keyName === "turnOfRelevance") return cls.filter((c) => has(c, "engine", "payoff", "threat", "finisher")).map((c) => c.name);
  if (keyName === "closingPower") return cls.filter((c) => has(c, "finisher", "damage_engine", "threat")).map((c) => c.name);
  if (keyName === "goldfish") return cls.map((c) => c.name);
  return [];
}
export function coverageFilterCards(dm, coverageKey) {
  const fromMetric = dm?.metrics?.interactionDensity?.coverage?.[coverageKey]?.cards;
  if (Array.isArray(fromMetric)) return fromMetric;
  const map = { creature: ["creature_removal", "removal"], artifact: ["artifact_removal"], enchantment: ["enchantment_removal"], planeswalker: ["planeswalker_removal"], land: ["land_interaction"], graveyard: ["graveyard_interaction"], stack: ["counterspell"], wipes: ["board_wipe"], protection: ["protection"] };
  const wanted = new Set(map[coverageKey] || []);
  return (dm?.classifications || []).filter((c) => (c.roles || []).some((r) => wanted.has(r))).map((c) => c.name);
}
