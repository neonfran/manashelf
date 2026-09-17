import { key } from "../../utils.js";

export function mainboardSet(deckDetail) {
  return new Set((deckDetail?.mainboard || []).map((c) => key(c.name)));
}
export function usedOutsideCurrentDeck(c, mode, selectedDeckId) {
  return (c.usedInDecks || []).filter((d) => !(mode === "improve" && Number(d.deckId) === Number(selectedDeckId))).reduce((n, d) => n + Number(d.quantity || 0), 0);
}
export function contextualAvailable(c, mode, selectedDeckId) {
  return c.ownedQuantity > 0 && Math.max(0, Number(c.ownedQuantity || 0) - usedOutsideCurrentDeck(c, mode, selectedDeckId)) > 0;
}
export function statusOf(c, mb, mode, selectedDeckId) {
  if (c.owned === false || !c.ownedQuantity) return "missing";
  if (mode === "improve" && mb.has(key(c.name))) return "inDeck";
  if (contextualAvailable(c, mode, selectedDeckId)) return "available";
  return "occupied";
}
export function typeBucket(c) {
  const t = String(c.typeLine || "");
  for (const x of ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Battle", "Land"]) if (t.includes(x)) return x;
  return t.split("—")[0].trim() || "Otro";
}
const CATEGORY_DESC = { highsynergy: "Especialmente asociadas a este Commander.", topcards: "Las cartas más usadas.", gamechangers: "Game Changers relevantes.", newcards: "Incorporaciones recientes.", creatures: "Criaturas habituales.", instants: "Instantáneos habituales.", sorceries: "Conjuros habituales.", artifacts: "Artefactos habituales.", enchantments: "Encantamientos habituales.", lands: "Tierras habituales." };
export function categoryDesc(c) {
  return CATEGORY_DESC[String(c.id || c.label).toLowerCase().replace(/[^a-z]/g, "")] || "Clasificación publicada por EDHREC.";
}
