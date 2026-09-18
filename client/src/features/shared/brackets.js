// Commander Brackets setting — options and reference text shared by LAB 2 and LAB 3.
// Definitions follow WotC's official Commander Brackets system (source cited in
// BRACKET_INFO_TEXT below), not an in-house interpretation, per explicit product decision:
// ambiguous concepts (e.g. Mass Land Denial vs. single-target land destruction) must match
// the cited source's own wording rather than being redefined here.
export const BRACKET_OPTIONS = [
  { value: "none", label: "Sin restricción" },
  { value: "exhibition", label: "Bracket 1 · Exhibición" },
  { value: "core", label: "Bracket 2 · Core" },
  { value: "upgraded", label: "Bracket 3 · Mejorado" },
  { value: "optimized", label: "Bracket 4 · Optimizado" },
  { value: "cedh", label: "Bracket 5 · cEDH" },
];

export const BRACKET_INFO_TEXT =
  "Fuente: magic.wizards.com/en/formats/commander (sistema de Brackets de Wizards of the Coast, en beta). " +
  "\"Denegación masiva de tierras\" es específicamente destruir, exiliar, hacer rebotar, mantener tapadas o cambiar qué maná producen 4 o más tierras por jugador sin reemplazarlas (ejemplos citados por WotC: Armageddon, Winter Orb, Blood Moon) — NO incluye destrucción de tierras dirigida a una sola carta (ej.: Strip Mine, Wasteland), que no está restringida en ningún bracket. " +
  "Los Game Changers son la lista oficial y curada por WotC; se valida contra el campo game_changer que Scryfall ya expone por carta, así que se mantiene al día sola. " +
  "Exhibición y Core no permiten ninguno; Mejorado permite hasta 3; Optimizado y cEDH no tienen límite. " +
  "Exhibición además excluye cartas de turno extra por completo; Core y Mejorado sólo piden que aparezcan en baja cantidad (guía que este builder no mide por cantidad). " +
  "Los combos infinitos de 2 cartas (incluyendo al Commander como una de las dos) quedan fuera de Exhibición, Core y Mejorado, y permitidos desde Optimizado.";

export const BRACKET_SETTING_DESCRIPTION =
  "Basado en el sistema oficial de Brackets de Wizards of the Coast. Restringe Game Changers, denegación masiva de tierras y combos infinitos de 2 cartas según el bracket elegido; no cambia legalidad de Commander, sólo qué candidatas puede usar el builder.";
