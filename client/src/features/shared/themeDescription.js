// Short, specific hover description for a Commander theme choice (LAB 2 / LAB 3 theme grids).
// Keyword-matched against known EDHREC theme families first; falls back to a tribal-synergy
// guess for pluralized creature-type-looking names, then a generic "reinforces this plan" line.
export function minimalThemeDescription(theme) {
  const name = String(theme?.name || theme || "Theme").trim();
  const k = name.toLocaleLowerCase("en-US");
  const rules = [
    // Specific multi-word / narrow patterns first, so they win over broader keywords below
    // (e.g. "Counterspells" must match here, not fall into the /spell/ pattern further down).
    [/cantrip/, "Prioriza hechizos baratos que se reemplazan a sí mismos con robo o selección de cartas."],
    [/counterspell|counter magic/, "Prioriza contrahechizos para negar amenazas y jugadas clave del rival."],
    [/extra turn/, "Prioriza cartas que otorgan turnos adicionales para acumular ventaja."],
    [/extra combat|combat matters/, "Prioriza combates adicionales para multiplicar el daño de ataque."],
    [/\bmill\b/, "Mengua la biblioteca del rival como plan de victoria alternativo."],
    [/midrange/, "Balancea amenazas eficientes con respuestas flexibles turno a turno."],
    [/devotion/, "Concentra símbolos de maná de un color para maximizar efectos de devoción."],
    [/tap.?\/?.?untap|untap/, "Explota permanentes que se enderezan repetidamente para generar valor extra."],
    [/tempo/, "Prioriza jugadas eficientes que ganan turnos y presionan el desarrollo rival."],
    [/blue moon/, "Combina control azul con efectos disruptivos sobre el maná no básico rival."],
    [/superfriends|planeswalker/, "Prioriza planeswalkers y los protege para acumular lealtad."],
    [/aggro|weenie|go[- ]?wide/, "Prioriza criaturas baratas y presión de ataque temprana y constante."],
    [/politic|group hug/, "Usa negociación, incentivos o generosidad para influir en la mesa a su favor."],
    [/theft|steal|mind control/, "Prioriza robar o tomar control temporal de recursos y criaturas rivales."],
    [/proliferate|\+1\/\+1/, "Acumula y multiplica contadores +1/+1 u otros marcadores."],
    [/energy/, "Genera y gasta contadores de energía como recurso adicional."],
    [/populate/, "Duplica sus mejores tokens de criatura para escalar el plan."],
    [/mutate/, "Apila criaturas con mutar para acumular habilidades y tamaño."],
    [/kicker/, "Prioriza hechizos con kicker para escalar su efecto según el maná disponible."],
    [/convoke|affinity/, "Reduce el coste de sus hechizos aprovechando criaturas o artifacts en mesa."],
    [/flying|evasion/, "Prioriza evasión (vuelo u otras) para conectar daño de forma consistente."],
    [/ninjutsu/, "Aprovecha ninjutsu para reemplazar atacantes por amenazas evasivas."],
    [/storm/, "Encadena hechizos baratos para copiar un conteo de storm en un mismo turno."],
    [/party|adventurers/, "Prioriza Clerics, Rogues, Warriors y Wizards como 'party' de aventureros."],
    [/ramp|big mana/, "Prioriza acelerar el maná disponible para adelantar el plan del mazo."],
    [/historic/, "Prioriza artifacts, leyendas y sagas -cartas 'históricas'- y sus payoffs."],
    [/spell|instant|sorcery/, "Prioriza lanzar y aprovechar instants y sorceries."],
    [/artifact/, "Prioriza artifacts y cartas que los generan o aprovechan."],
    [/enchant|aura/, "Prioriza enchantments/Auras y sus payoffs."],
    [/token/, "Prioriza crear, multiplicar y aprovechar tokens."],
    [/grave|reanim/, "Usa el cementerio como recurso y recupera valor desde él."],
    [/sacrifice|aristocrat/, "Convierte sacrificios y muertes en valor o daño."],
    [/landfall|lands? matter|lands?/, "Prioriza tierras y efectos que obtienen valor de ellas."],
    [/voltron|equipment/, "Concentra mejoras y protección en una amenaza principal."],
    [/counter/, "Construye alrededor de counters y sus payoffs."],
    [/lifegain|life gain/, "Gana vida repetidamente y aprovecha sus payoffs."],
    [/draw|card advantage/, "Prioriza robo y recompensas por generar cartas."],
    [/discard|wheel/, "Convierte descarte o recambio de manos en ventaja."],
    [/blink|flicker/, "Reutiliza permanentes mediante blink/flicker y ETB."],
    [/copy|clone/, "Copia spells o permanentes para multiplicar valor."],
    [/control/, "Prioriza respuestas, tempo y control del desarrollo rival."],
    [/stax|tax/, "Limita o encarece las acciones rivales mientras desarrolla su plan."],
    [/group slug|burn|damage/, "Aplica presión de daño o pérdida de vida de forma sostenida."],
    [/combo/, "Busca ensamblar interacciones de cartas que producen un cierre fuerte."],
    [/chaos/, "Prioriza efectos variables que alteran reglas, decisiones o resultados."],
    [/treasure/, "Genera y aprovecha Treasure como recurso y sinergia."],
    [/clue/, "Genera y aprovecha Clues como recurso y motor de valor."],
    [/food/, "Genera y aprovecha Food como recurso y payoff."],
    [/cycling/, "Aprovecha Cycling para filtrar cartas y activar payoffs."],
  ];
  for (const [re, desc] of rules) if (re.test(k)) return desc;
  const words = name.split(/\s+/);
  const knownNonTribal = /^(cantrips?|combos?|wheels?|tokens?|treasures?|clues?|spells?|counters?|artifacts?|instants?|sorceries)$/;
  if (words.length <= 3 && /s$/.test(name) && !/[ /]/.test(name) && !knownNonTribal.test(k)) return `Mazo centrado en ${name} y sus sinergias de tipo de criatura.`;
  return `Prioriza cartas que refuerzan el plan "${name}".`;
}
